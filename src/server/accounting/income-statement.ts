import { prisma } from "@/lib/prisma";

// ===========================================================================
// Income Statement (Profit & Loss)
// ---------------------------------------------------------------------------
// Sign convention reminder: transaction.amount is signed cents where
//   positive = money IN (credit / inflow)
//   negative = money OUT (debit / outflow)
//
// Reporting convention on the statement:
//   revenueTotal  = Σ(amount) over lines categorized to a REVENUE account
//                   (inflows are already positive, so this reads naturally)
//   expenseTotal  = Σ(-amount) over lines categorized to an EXPENSE account
//                   (outflows are negative, so negating gives a positive cost)
//   netIncome     = revenueTotal - expenseTotal
//
// Split handling: when a transaction isSplit, we ignore its top-level category
// and instead attribute each split line to its own category. This lets a
// single bank charge map to several accounting categories.
// ===========================================================================

export interface StatementLine {
  categoryId: string;
  categoryName: string;
  amount: number; // cents, positive magnitude
}

export interface IncomeStatement {
  start: string | null;
  end: string | null;
  revenue: StatementLine[];
  expenses: StatementLine[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  uncategorizedCount: number;
}

interface Range {
  start?: Date;
  end?: Date;
}

// Pull the categorized "legs" for a user over a date range. Each leg is a
// (categoryClass, categoryName, signedAmount) tuple, expanding splits.
async function getLegs(userId: string, range: Range) {
  const txns = await prisma.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      pending: false,
      date: { gte: range.start, lte: range.end },
    },
    include: {
      category: true,
      splits: { include: { category: true } },
    },
  });

  const legs: { class: string | null; categoryId: string | null; name: string; amount: number }[] = [];
  let uncategorized = 0;

  for (const t of txns) {
    if (t.isSplit && t.splits.length > 0) {
      for (const s of t.splits) {
        legs.push({ class: s.category.class, categoryId: s.categoryId, name: s.category.name, amount: s.amount });
      }
    } else if (t.category) {
      legs.push({ class: t.category.class, categoryId: t.categoryId, name: t.category.name, amount: t.amount });
    } else {
      uncategorized++;
    }
  }
  return { legs, uncategorized };
}

export async function buildIncomeStatement(userId: string, range: Range): Promise<IncomeStatement> {
  const { legs, uncategorized } = await getLegs(userId, range);

  const revenueMap = new Map<string, StatementLine>();
  const expenseMap = new Map<string, StatementLine>();

  for (const leg of legs) {
    if (leg.class === "REVENUE") {
      const cur = revenueMap.get(leg.name) ?? { categoryId: leg.categoryId!, categoryName: leg.name, amount: 0 };
      cur.amount += leg.amount; // inflows positive
      revenueMap.set(leg.name, cur);
    } else if (leg.class === "EXPENSE") {
      const cur = expenseMap.get(leg.name) ?? { categoryId: leg.categoryId!, categoryName: leg.name, amount: 0 };
      cur.amount += -leg.amount; // outflows negative -> positive cost
      expenseMap.set(leg.name, cur);
    }
    // ASSET/LIABILITY/EQUITY legs do not hit the P&L.
  }

  const revenue = [...revenueMap.values()].sort((a, b) => b.amount - a.amount);
  const expenses = [...expenseMap.values()].sort((a, b) => b.amount - a.amount);
  const totalRevenue = revenue.reduce((s, l) => s + l.amount, 0);
  const totalExpenses = expenses.reduce((s, l) => s + l.amount, 0);

  return {
    start: range.start?.toISOString() ?? null,
    end: range.end?.toISOString() ?? null,
    revenue,
    expenses,
    totalRevenue,
    totalExpenses,
    netIncome: totalRevenue - totalExpenses,
    uncategorizedCount: uncategorized,
  };
}

// Net income from inception up to `asOf` — feeds Retained Earnings on the
// balance sheet.
export async function netIncomeToDate(userId: string, asOf?: Date): Promise<number> {
  const stmt = await buildIncomeStatement(userId, { end: asOf });
  return stmt.netIncome;
}
