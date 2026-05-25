import { prisma } from "@/lib/prisma";
import { netIncomeToDate } from "./income-statement";

// ===========================================================================
// Balance Sheet
// ---------------------------------------------------------------------------
// We assemble three sections from multiple sources:
//
//   ASSETS      = cash/investment bank balances + manually entered assets
//   LIABILITIES = credit/loan bank balances     + manually entered liabilities
//   EQUITY      = owner contributions + retained earnings (cumulative net
//                 income to date)
//
// THE ACCOUNTING EQUATION (Assets = Liabilities + Equity):
// With real imported data the equation rarely balances to the penny, because
// we don't have opening balances for every account at inception. Rather than
// silently "plug" the difference, we surface it as an explicit
// "Opening Balance / Unreconciled Equity" line so the books visibly balance
// and the user can see exactly what needs reconciling. This is honest
// double-entry behavior — QuickBooks does the same with its "Opening Balance
// Equity" account.
// ===========================================================================

export interface BSLine {
  label: string;
  amount: number; // cents
}
export interface BalanceSheet {
  asOf: string;
  assets: {
    current: BSLine[];
    longTerm: BSLine[];
    total: number;
  };
  liabilities: {
    current: BSLine[];
    longTerm: BSLine[];
    total: number;
  };
  equity: {
    lines: BSLine[];
    total: number;
  };
  // Convenience totals + equation validation.
  totalAssets: number;
  totalLiabilitiesAndEquity: number;
  balances: boolean; // true if equation holds after the reconciling line
}

export async function buildBalanceSheet(userId: string, asOf: Date = new Date()): Promise<BalanceSheet> {
  const [accounts, manualAssets, manualLiabilities, contributions, retained] = await Promise.all([
    prisma.bankAccount.findMany({ where: { userId, deletedAt: null } }),
    prisma.asset.findMany({ where: { userId, deletedAt: null } }),
    prisma.liability.findMany({ where: { userId, deletedAt: null } }),
    sumEquityContributions(userId, asOf),
    netIncomeToDate(userId, asOf),
  ]);

  // ---- Assets ----
  const currentAssets: BSLine[] = [];
  const longTermAssets: BSLine[] = [];

  // Bank cash: depository + investment accounts are current/liquid assets.
  const cash = accounts
    .filter((a) => a.type === "DEPOSITORY" || a.type === "INVESTMENT")
    .reduce((s, a) => s + a.currentBalance, 0);
  if (accounts.some((a) => a.type === "DEPOSITORY" || a.type === "INVESTMENT")) {
    currentAssets.push({ label: "Cash & Bank Accounts", amount: cash });
  }

  for (const a of manualAssets) {
    // Long-lived assets (with a useful life) are long-term; everything else
    // is treated as current for this lightweight model.
    (a.depreciable ? longTermAssets : currentAssets).push({ label: a.name, amount: a.value });
  }

  const totalAssets =
    currentAssets.reduce((s, l) => s + l.amount, 0) + longTermAssets.reduce((s, l) => s + l.amount, 0);

  // ---- Liabilities ----
  const currentLiabilities: BSLine[] = [];
  const longTermLiabilities: BSLine[] = [];

  // Plaid credit/loan balances represent amounts owed (positive = owed).
  for (const a of accounts.filter((x) => x.type === "CREDIT" || x.type === "LOAN")) {
    const line = { label: a.name, amount: Math.abs(a.currentBalance) };
    (a.type === "LOAN" ? longTermLiabilities : currentLiabilities).push(line);
  }
  for (const l of manualLiabilities) {
    (l.longTerm ? longTermLiabilities : currentLiabilities).push({ label: l.name, amount: l.balance });
  }

  const totalLiabilities =
    currentLiabilities.reduce((s, l) => s + l.amount, 0) + longTermLiabilities.reduce((s, l) => s + l.amount, 0);

  // ---- Equity ----
  const equityLines: BSLine[] = [
    { label: "Owner Contributions", amount: contributions },
    { label: "Retained Earnings", amount: retained },
  ];
  const baseEquity = contributions + retained;

  // Reconciling line so the sheet visibly balances (see header note).
  const reconciling = totalAssets - (totalLiabilities + baseEquity);
  if (reconciling !== 0) {
    equityLines.push({ label: "Opening Balance / Unreconciled Equity", amount: reconciling });
  }
  const totalEquity = baseEquity + reconciling;

  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

  return {
    asOf: asOf.toISOString(),
    assets: { current: currentAssets, longTerm: longTermAssets, total: totalAssets },
    liabilities: { current: currentLiabilities, longTerm: longTermLiabilities, total: totalLiabilities },
    equity: { lines: equityLines, total: totalEquity },
    totalAssets,
    totalLiabilitiesAndEquity,
    balances: totalAssets === totalLiabilitiesAndEquity,
  };
}

// Sum transactions whose category is the EQUITY "Owner Contributions" account.
async function sumEquityContributions(userId: string, asOf: Date): Promise<number> {
  const cat = await prisma.category.findFirst({
    where: { userId, name: "Owner Contributions", deletedAt: null },
  });
  if (!cat) return 0;
  const agg = await prisma.transaction.aggregate({
    where: { userId, categoryId: cat.id, deletedAt: null, date: { lte: asOf } },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}
