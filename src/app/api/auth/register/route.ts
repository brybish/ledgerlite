import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, issueSession, setSessionCookie } from "@/lib/auth";
import { registerSchema } from "@/lib/validation";
import { ok, bad, handleError, audit } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { CHART_OF_ACCOUNTS } from "@/server/accounting/accounts";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    if (!rateLimit(`register:${ip}`, 5, 60_000)) return bad("Too many attempts, slow down.", 429);

    const body = registerSchema.parse(await req.json());
    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) return bad("An account with that email already exists.", 409);

    const user = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name,
        passwordHash: await hashPassword(body.password),
        categories: {
          create: CHART_OF_ACCOUNTS.map((c) => ({ name: c.name, class: c.class, subgroup: c.subgroup, system: true })),
        },
      },
    });

    setSessionCookie(await issueSession({ sub: user.id, email: user.email, role: user.role }));
    await audit(user.id, "auth.register");
    return ok({ id: user.id, email: user.email, name: user.name });
  } catch (err) {
    return handleError(err);
  }
}
