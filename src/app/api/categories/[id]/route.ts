import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, bad, handleError, audit } from "@/lib/api";
import { prisma } from "@/lib/prisma";

// DELETE /api/categories/:id — soft-delete a user-created category (and its
// subcategories). Built-in (system) categories cannot be deleted. Transactions
// that referenced the deleted categories revert to uncategorized, and any rules
// targeting them are disabled, so nothing keeps re-assigning a gone category.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const u = await requireUser(req);
    const cat = await prisma.category.findFirst({ where: { id: params.id, userId: u.id, deletedAt: null } });
    if (!cat) return bad("Category not found.", 404);
    if (cat.system) return bad("Built-in categories can’t be deleted.", 422);

    const children = await prisma.category.findMany({
      where: { userId: u.id, parentId: cat.id, deletedAt: null },
      select: { id: true },
    });
    const ids = [cat.id, ...children.map((c) => c.id)];
    const now = new Date();

    const [txns] = await prisma.$transaction([
      prisma.transaction.updateMany({ where: { userId: u.id, categoryId: { in: ids } }, data: { categoryId: null } }),
      prisma.categorizationRule.updateMany({ where: { userId: u.id, categoryId: { in: ids }, deletedAt: null }, data: { deletedAt: now } }),
      prisma.category.updateMany({ where: { id: { in: ids } }, data: { deletedAt: now } }),
    ]);

    await audit(u.id, "category.delete", "transaction_categories", cat.id, {
      removed: ids.length,
      transactionsUncategorized: txns.count,
    });
    return ok({ deleted: ids.length, transactionsUncategorized: txns.count });
  } catch (err) {
    return handleError(err);
  }
}
