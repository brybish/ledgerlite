import { NextRequest } from "next/server";
import { requireUser, hashPassword, verifyPassword } from "@/lib/auth";
import { ok, bad, handleError, audit } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { passwordChangeSchema } from "@/lib/validation";

// POST /api/auth/password — change password. Requires the current password;
// the JWT session is unaffected (it isn't derived from the password).
export async function POST(req: NextRequest) {
  try {
    const u = await requireUser(req);
    const { currentPassword, newPassword } = passwordChangeSchema.parse(await req.json());

    const okCurrent = await verifyPassword(currentPassword, u.passwordHash);
    if (!okCurrent) return bad("Current password is incorrect.", 403);

    await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await hashPassword(newPassword) } });
    await audit(u.id, "auth.password_change", "users", u.id);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
