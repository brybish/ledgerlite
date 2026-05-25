import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, bad, handleError, audit } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { ruleUpdateSchema } from "@/lib/validation";

// PATCH /api/rules/:id — edit any subset of fields (including toggling `enabled`
// or changing `priority`). User-scoped.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const u = await requireUser(req);
    const body = ruleUpdateSchema.parse(await req.json());

    const existing = await prisma.categorizationRule.findFirst({ where: { id: params.id, userId: u.id, deletedAt: null } });
    if (!existing) return bad("Rule not found.", 404);

    const updated = await prisma.categorizationRule.update({
      where: { id: existing.id },
      data: body,
      include: { category: true },
    });
    await audit(u.id, "rule.update", "categorization_rules", updated.id);
    return ok(updated);
  } catch (err) {
    return handleError(err);
  }
}

// DELETE /api/rules/:id — soft delete.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const u = await requireUser(req);
    const existing = await prisma.categorizationRule.findFirst({ where: { id: params.id, userId: u.id, deletedAt: null } });
    if (!existing) return bad("Rule not found.", 404);
    await prisma.categorizationRule.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
    await audit(u.id, "rule.delete", "categorization_rules", existing.id);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
