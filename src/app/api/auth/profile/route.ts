import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, bad, handleError, audit } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { profileSchema } from "@/lib/validation";
import { Prisma } from "@prisma/client";

// PATCH /api/auth/profile — update display name and/or email.
export async function PATCH(req: NextRequest) {
  try {
    const u = await requireUser(req);
    const body = profileSchema.parse(await req.json());

    try {
      const updated = await prisma.user.update({
        where: { id: u.id },
        data: { name: body.name ?? undefined, email: body.email ?? undefined },
      });
      await audit(u.id, "auth.profile_update", "users", u.id);
      return ok({ id: updated.id, email: updated.email, name: updated.name, role: updated.role });
    } catch (e) {
      // Unique constraint on email.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return bad("That email is already in use.", 409);
      }
      throw e;
    }
  } catch (err) {
    return handleError(err);
  }
}
