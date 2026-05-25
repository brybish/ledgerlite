import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, issueSession, setSessionCookie } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";
import { ok, bad, handleError, audit } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "local";
    if (!rateLimit(`login:${ip}`, 10, 60_000)) return bad("Too many attempts, slow down.", 429);
    const body = loginSchema.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return bad("Invalid email or password.", 401);
    }
    setSessionCookie(await issueSession({ sub: user.id, email: user.email, role: user.role }));
    await audit(user.id, "auth.login");
    return ok({ id: user.id, email: user.email, name: user.name });
  } catch (err) {
    return handleError(err);
  }
}
