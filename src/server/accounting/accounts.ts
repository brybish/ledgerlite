import { AccountClass } from "@prisma/client";

// ===========================================================================
// Canonical chart of accounts (seeded per-user as `system` categories).
// ---------------------------------------------------------------------------
// ACCOUNTING DECISION — "Owner Contributions":
// The original spec lists "Owner Contributions" under Income. In double-entry
// accounting a capital injection is NOT revenue — it does not belong on the
// P&L because it would overstate operating performance. We therefore classify
// it as EQUITY. This keeps the income statement clean (revenue = earned income
// only) and routes contributions correctly onto the balance sheet. This is the
// single deliberate deviation from the literal spec, made to honor the
// explicit requirement to "maintain double-entry principles" and "clearly
// separate equity / revenue".
// ===========================================================================

export interface SeedCategory {
  name: string;
  class: AccountClass;
  subgroup?: string;
}

export const CHART_OF_ACCOUNTS: SeedCategory[] = [
  // Revenue
  { name: "Revenue", class: "REVENUE" },
  { name: "Interest Income", class: "REVENUE" },
  { name: "Other Income", class: "REVENUE" },

  // Equity (note the Owner Contributions decision above)
  { name: "Owner Contributions", class: "EQUITY" },
  { name: "Owner Equity", class: "EQUITY" },
  { name: "Retained Earnings", class: "EQUITY" },

  // Expenses
  { name: "Fuel", class: "EXPENSE" },
  { name: "Equipment", class: "EXPENSE" },
  { name: "Payroll", class: "EXPENSE" },
  { name: "Software", class: "EXPENSE" },
  { name: "Advertising", class: "EXPENSE" },
  { name: "Meals", class: "EXPENSE" },
  { name: "Utilities", class: "EXPENSE" },
  { name: "Rent", class: "EXPENSE" },
  { name: "Insurance", class: "EXPENSE" },
  { name: "Repairs & Maintenance", class: "EXPENSE" },
  { name: "Office Supplies", class: "EXPENSE" },
  { name: "Misc Expense", class: "EXPENSE" },

  // Asset accounts (used by manual entries / future GL postings)
  { name: "Cash", class: "ASSET" },
  { name: "Accounts Receivable", class: "ASSET" },
  { name: "Equipment Asset", class: "ASSET" },
  { name: "Vehicles", class: "ASSET" },
  { name: "Inventory", class: "ASSET" },
  { name: "Investments", class: "ASSET" },

  // Liability accounts
  { name: "Credit Cards", class: "LIABILITY", subgroup: "CURRENT" },
  { name: "Taxes Payable", class: "LIABILITY", subgroup: "CURRENT" },
  { name: "Loans Payable", class: "LIABILITY", subgroup: "LONG_TERM" },
  { name: "Notes Payable", class: "LIABILITY", subgroup: "LONG_TERM" },
];
