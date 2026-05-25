import { prisma } from "@/lib/prisma";
import type { CategorizationRule, Transaction } from "@prisma/client";

// ===========================================================================
// Categorization Rules Engine
// ---------------------------------------------------------------------------
// Rules are evaluated in ascending `priority` order; the FIRST matching rule
// wins and assigns its category. Used both during Plaid import (auto-apply)
// and on manual "re-run rules" actions. Matching is case-insensitive for text
// fields. AMOUNT comparisons parse the rule value as dollars -> cents.
// ===========================================================================

function matches(rule: CategorizationRule, txn: Pick<Transaction, "merchantName" | "description" | "amount">): boolean {
  const text = (
    rule.field === "MERCHANT" ? txn.merchantName ?? "" : rule.field === "DESCRIPTION" ? txn.description : ""
  ).toLowerCase();
  const val = rule.value.toLowerCase();

  switch (rule.op) {
    case "CONTAINS":
      return rule.field === "AMOUNT" ? false : text.includes(val);
    case "STARTS_WITH":
      return rule.field === "AMOUNT" ? false : text.startsWith(val);
    case "EQUALS":
      if (rule.field === "AMOUNT") return Math.abs(txn.amount) === Math.round(parseFloat(rule.value) * 100);
      return text === val;
    case "GT":
      return Math.abs(txn.amount) > Math.round(parseFloat(rule.value) * 100);
    case "LT":
      return Math.abs(txn.amount) < Math.round(parseFloat(rule.value) * 100);
    default:
      return false;
  }
}

// Returns the categoryId to assign, or null if no rule matches.
export function categorize(
  rules: CategorizationRule[],
  txn: Pick<Transaction, "merchantName" | "description" | "amount">
): string | null {
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (matches(rule, txn)) return rule.categoryId;
  }
  return null;
}

// Re-run all enabled rules across a user's currently-uncategorized transactions.
// Returns the number of transactions updated. Only fills empty categories — it
// never overwrites a manual categorization.
export async function applyRulesToUncategorized(userId: string): Promise<number> {
  const rules = await prisma.categorizationRule.findMany({
    where: { userId, enabled: true, deletedAt: null },
    orderBy: { priority: "asc" },
  });
  if (rules.length === 0) return 0;

  const targets = await prisma.transaction.findMany({
    where: { userId, categoryId: null, isSplit: false, deletedAt: null },
    select: { id: true, merchantName: true, description: true, amount: true },
  });

  let updated = 0;
  for (const t of targets) {
    const categoryId = categorize(rules, t);
    if (categoryId) {
      await prisma.transaction.update({ where: { id: t.id }, data: { categoryId } });
      updated++;
    }
  }
  return updated;
}
