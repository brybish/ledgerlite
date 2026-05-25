# LedgerLite — project guide for Claude Code

QuickBooks-style personal/business accounting app. This file orients you (Claude Code)
on architecture, conventions, and what's done vs. pending. Read before editing.

## Stack
- Next.js 14 (App Router) + TypeScript. API route handlers ARE the backend.
- Prisma + PostgreSQL (local: Homebrew postgresql@16).
- Auth: bcrypt + JWT (jose) in an httpOnly cookie. TanStack Query on the client.
- Tailwind, Recharts. Plaid for bank import (react-plaid-link on the frontend).

## Run locally
- DB must be running: `brew services start postgresql@16`
- `npm run dev` (http://localhost:3000). Demo login: demo@ledgerlite.dev / demopassword123
- `npm run db:push` (sync schema), `npm run db:seed` (demo data), `npm run db:studio`
- `.env` holds DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY, and PLAID_* keys. Never commit it.

## Non-negotiable conventions (preserve these)
- MONEY IS INTEGER CENTS everywhere in code and DB. Convert to dollars only at the UI edge.
- Transaction.amount is SIGNED cents: positive = money in (credit), negative = money out
  (debit). Plaid's sign is opposite and is normalized on import (amount = -plaidAmount*100).
- "Owner Contributions" is classified as EQUITY, not Revenue (deliberate; see
  src/server/accounting/accounts.ts). Keeps double-entry separation intact.
- The balance sheet NEVER silently plugs the accounting equation. Any gap surfaces as an
  explicit "Opening Balance / Unreconciled Equity" line.
- Plaid access tokens are AES-256-GCM encrypted at rest (src/lib/crypto.ts). Never store
  raw bank credentials. Never select/return the encrypted token to the client.
- Every API route is user-scoped (requireUser) and Zod-validated. Deletes are SOFT
  (set deletedAt). Mutations write an audit log via the audit() helper.
- Split transactions: split amounts must sum exactly to the transaction amount; the
  income statement expands splits per-category when isSplit is true.

## Layout
- src/lib/        prisma, money, crypto, auth, validation (Zod), api helpers, client fetch
- src/server/accounting/   accounts, income-statement, balance-sheet, rules-engine
- src/app/api/    route handlers (see list below)
- src/app/(app)/  authed pages: dashboard, transactions, rules, income-statement,
                  balance-sheet, assets, settings
- src/components/ ui.tsx (Button/Card/Input/Select/Textarea/Label/Skeleton), Sidebar,
                  PlaidLinkButton, SplitEditor
- prisma/         schema.prisma, seed.ts

## Status — DONE
- Auth (register/login/logout, password change, profile edit)
- Accounting engine: income statement + balance sheet with equation check
- Rules engine + full CRUD UI (enable toggle, priority, "run rules now")
- Plaid: link-token / exchange / sync (dedup, cursor, retry) + Link widget on Settings
- Transactions: filter/search/paginate, inline categorize, bulk categorize, splits
- Assets & Liabilities: full CRUD (assets support straight-line depreciation fields)
- Statement export: CSV + client-side PDF (jsPDF) for BOTH the Income Statement
  (respects the date range) and the Balance Sheet
- Income Statement period controls: current-year default + Year/Month dropdowns
- No-Plaid data entry: manual "Add transaction" form + CSV import (column mapping,
  sign convention, (date,amount,description) dedup, auto rule application)
- Custom categories: Categories page to add chart-of-accounts entries (name + class),
  one-level subcategories (Category.parentId self-relation), and delete of
  user-created categories (system protected; reverts their txns to uncategorized)
- Reset transactions: Settings "Danger zone" hard-deletes all of a user's txns
- AI categorize: /api/transactions/ai-classify suggests a category per uncategorized
  txn (Claude via forced tool-use, prompt-cached; review/accept modal). Needs
  ANTHROPIC_API_KEY; ANTHROPIC_MODEL defaults to claude-opus-4-7 (set to
  claude-haiku-4-5 for ~5x lower cost — current prod setting)

## Status — PENDING / next steps
- Richer dashboard widgets; transaction notes/business-flag UI.
- Plaid needs live keys in .env to run beyond the friendly "not configured" message.
  Sandbox test creds at the Plaid modal: user_good / pass_good.

## Working agreement
- After changing the schema, run `npm run db:push` and regenerate the client.
- Keep `npx tsc --noEmit` clean. For UI/route work, a full `npm run build` catches
  Next-specific issues that tsc misses.
- This is a git repo; commit working increments with clear messages.
