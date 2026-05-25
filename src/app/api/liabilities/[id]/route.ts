import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, bad, handleError, audit } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { liabilityUpdateSchema } from "@/lib/validation";

// PATCH /api/liabilities/:id — edit any subset of fields, user-scoped.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const u = await requireUser(req);
    const body = liabilityUpdateSchema.parse(await req.json());

    const existing = await prisma.liability.findFirst({ where: { id: params.id, userId: u.id, deletedAt: null } });
    if (!existing) return bad("Liability not found.", 404);

    const updated = await prisma.liability.update({ where: { id: existing.id }, data: body });
    await audit(u.id, "liability.update", "liabilities", updated.id);
    return ok(updated);
  } catch (err) {
    return handleError(err);
  }
}

// DELETE /api/liabilities/:id — soft delete.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const u = await requireUser(req);
    const existing = await prisma.liability.findFirst({ where: { id: params.id, userId: u.id, deletedAt: null } });
    if (!existing) return bad("Liability not found.", 404);
    await prisma.liability.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
    await audit(u.id, "liability.delete", "liabilities", existing.id);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
