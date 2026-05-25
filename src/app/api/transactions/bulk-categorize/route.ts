import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, bad, handleError, audit } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// POST /api/transactions/bulk-categorize
// Assigns one category (or clears it) across many transactions at once. Only
// affects rows owned by the user. Splits are cleared on any row that had them,
// since assigning a single category supersedes a split (keeps the ledger
// consistent with how the income statement reads each row).
const schema = z.object({
  ids: z.array(z.string().cuid()).min(1).max(500),
  categoryId: z.string().cuid().nullable(),
});

export async function POST(req: NextRequest) {
  try {
    const u = await requireUser(req);
    const { ids, categoryId } = schema.parse(await req.json());

    // Verify the category belongs to the user (when setting, not clearing).
    if (categoryId) {
      const cat = await prisma.category.findFirst({ where: { id: categoryId, userId: u.id, deletedAt: null } });
      if (!cat) return bad("Category not found.", 404);
    }

    // Scope strictly to this user's transactions.
    const owned = await prisma.transaction.findMany({
      where: { id: { in: ids }, userId: u.id, deletedAt: null },
      select: { id: true },
    });
    const ownedIds = owned.map((t) => t.id);
    if (ownedIds.length === 0) return bad("No matching transactions.", 404);

    const [, updated] = await prisma.$transaction([
      prisma.transactionSplit.deleteMany({ where: { transactionId: { in: ownedIds } } }),
      prisma.transaction.updateMany({
        where: { id: { in: ownedIds } },
        data: { categoryId, isSplit: false },
      }),
    ]);

    await audit(u.id, "transaction.bulk_categorize", "transactions", undefined, { count: updated.count, categoryId });
    return ok({ updated: updated.count });
  } catch (err) {
    return handleError(err);
  }
}
