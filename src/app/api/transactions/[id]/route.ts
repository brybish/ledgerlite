import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, bad, handleError, audit } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { txnUpdateSchema } from "@/lib/validation";

// PATCH /api/transactions/:id
// Handles categorize, edit description/notes, business/personal flag, and
// splitting. When `splits` is provided we validate that the split amounts sum
// to the transaction amount (double-entry integrity) before persisting.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const u = await requireUser(req);
    const body = txnUpdateSchema.parse(await req.json());

    const txn = await prisma.transaction.findFirst({ where: { id: params.id, userId: u.id, deletedAt: null } });
    if (!txn) return bad("Transaction not found.", 404);

    if (body.splits) {
      const sum = body.splits.reduce((s, x) => s + x.amount, 0);
      if (sum !== txn.amount) {
        return bad(`Splits must total the transaction amount (${txn.amount} cents); got ${sum}.`, 422);
      }
      await prisma.$transaction([
        prisma.transactionSplit.deleteMany({ where: { transactionId: txn.id } }),
        prisma.transactionSplit.createMany({
          data: body.splits.map((s) => ({ transactionId: txn.id, categoryId: s.categoryId, amount: s.amount, notes: s.notes })),
        }),
        prisma.transaction.update({ where: { id: txn.id }, data: { isSplit: true, categoryId: null } }),
      ]);
    }

    const updated = await prisma.transaction.update({
      where: { id: txn.id },
      data: {
        categoryId: body.splits ? null : body.categoryId ?? undefined,
        description: body.description ?? undefined,
        notes: body.notes ?? undefined,
        isBusiness: body.isBusiness ?? undefined,
      },
      include: { category: true, splits: { include: { category: true } } },
    });

    await audit(u.id, "transaction.update", "transactions", txn.id);
    return ok(updated);
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const u = await requireUser(req);
    const txn = await prisma.transaction.findFirst({ where: { id: params.id, userId: u.id } });
    if (!txn) return bad("Transaction not found.", 404);
    await prisma.transaction.update({ where: { id: txn.id }, data: { deletedAt: new Date() } });
    await audit(u.id, "transaction.delete", "transactions", txn.id);
    return ok({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
