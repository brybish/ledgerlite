import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, bad, handleError, audit } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { assetUpdateSchema } from "@/lib/validation";

// PATCH /api/assets/:id — edit any subset of fields. User-scoped so a user can
// never touch another user's row.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const u = await requireUser(req);
    const body = assetUpdateSchema.parse(await req.json());

    const existing = await prisma.asset.findFirst({ where: { id: params.id, userId: u.id, deletedAt: null } });
    if (!existing) return bad("Asset not found.", 404);

    const updated = await prisma.asset.update({
      where: { id: existing.id },
      data: {
        ...body,
        acquisitionDate: body.acquisitionDate ? new Date(body.acquisitionDate) : undefined,
      },
    });
    await audit(u.id, "asset.update", "assets", updated.id);
    return ok(updated);
  } catch (err) {
    return handleError(err);
  }
}

// DELETE /api/assets/:id — soft delete (sets deletedAt; row is retained for audit).
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const u = await requireUser(req);
    const existing = await prisma.asset.findFirst({ where: { id: params.id, userId: u.id, deletedAt: null } });
    if (!existing) return bad("Asset not found.", 404);
    await prisma.asset.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
    await audit(u.id, "asset.delete", "assets", existing.id);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
