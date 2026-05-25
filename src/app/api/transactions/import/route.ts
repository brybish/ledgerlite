import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { ok, handleError, audit } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { txnImportSchema } from "@/lib/validation";
import { applyRulesToUncategorized } from "@/server/accounting/rules-engine";

// POST /api/transactions/import — bulk-create transactions from a parsed CSV.
// Rows arrive already normalized to signed cents (positive = money in). We
// de-duplicate against existing rows AND within the file on
// (date, amount, description) so re-importing the same export is safe, then
// run the categorization rules over everything uncategorized.
export async function POST(req: NextRequest) {
  try {
    const u = await requireUser(req);
    const { rows, source } = txnImportSchema.parse(await req.json());

    // Only look at existing rows inside the imported date window — keeps the
    // dedup query bounded even for large histories.
    const times = rows.map((r) => new Date(r.date).getTime());
    const minD = new Date(Math.min(...times));
    const maxD = new Date(Math.max(...times));
    const existing = await prisma.transaction.findMany({
      where: { userId: u.id, deletedAt: null, date: { gte: minD, lte: maxD } },
      select: { date: true, amount: true, description: true },
    });

    const key = (date: Date, amount: number, description: string) =>
      `${date.toISOString()}|${amount}|${description}`;
    const seen = new Set(existing.map((e) => key(e.date, e.amount, e.description)));

    const fresh: { date: Date; amount: number; description: string; merchantName: string | null }[] = [];
    for (const r of rows) {
      const d = new Date(r.date);
      const k = key(d, r.amount, r.description);
      if (seen.has(k)) continue; // skip dupes (existing or earlier in this file)
      seen.add(k);
      fresh.push({ date: d, amount: r.amount, description: r.description, merchantName: r.merchantName ?? null });
    }

    let imported = 0;
    if (fresh.length > 0) {
      const res = await prisma.transaction.createMany({
        data: fresh.map((r) => ({
          userId: u.id,
          date: r.date,
          description: r.description,
          merchantName: r.merchantName,
          amount: r.amount,
          type: r.amount < 0 ? ("DEBIT" as const) : ("CREDIT" as const),
          institutionName: source || "CSV import",
        })),
      });
      imported = res.count;
    }

    const rulesApplied = imported > 0 ? await applyRulesToUncategorized(u.id) : 0;
    await audit(u.id, "transaction.import", "transactions", undefined, {
      imported,
      skipped: rows.length - imported,
      source: source ?? null,
    });

    return ok({ imported, skipped: rows.length - imported, rulesApplied });
  } catch (err) {
    return handleError(err);
  }
}
