# LedgerLite

A lightweight, QuickBooks-style accounting platform for small businesses and LLC owners. Connect a bank via Plaid, import and categorize transactions, and get automatically generated **Income Statements** and **Balance Sheets** that update from your categorized data.

Built with Next.js (App Router) + TypeScript, PostgreSQL + Prisma, JWT auth, Tailwind, Recharts, and the Plaid API.

---

## ⚠️ Honest status

This is a **strong, runnable foundation**, not a finished commercial product. Be clear-eyed about what's here:

| Area | Status |
|---|---|
| Database schema (all 11 tables, indexes, soft deletes) | ✅ Complete |
| Auth (register/login/logout, bcrypt, JWT httpOnly cookie, route guard) | ✅ Complete |
| Accounting engine (income statement, balance sheet, retained earnings, equation check) | ✅ Complete & type-checked |
| Rules engine (priority-ordered auto-categorization) | ✅ Complete |
| Plaid integration (Link token, token exchange, encrypted-at-rest tokens, `/transactions/sync` with dedup, retry, pagination) | ✅ Code complete (needs Plaid keys to run live) |
| REST API (auth, transactions, categories, rules, reports, assets, liabilities, Plaid) | ✅ Complete & validated with Zod |
| Dashboard, Transactions (filter/search/categorize/paginate), Income Statement, Balance Sheet pages | ✅ Functional |
| Assets/Liabilities, Rules, Settings pages | ✅ Full create/edit/delete. Assets support depreciation fields; Rules support enable toggle + "run rules now"; Settings includes profile edit, password change, and connected-bank management |
| Plaid Link **front-end widget** | ✅ Wired (`react-plaid-link`) on the Settings page — connect a bank, then sync per institution. Needs Plaid keys to run live |
| Transaction splits, bulk categorize, CSV/PDF export | 🟡 Splits + CSV are implemented at the API/engine level; richer UI is a follow-up |
| Advanced features (AI categorization, OCR receipts, budgets, forecasting) | ⬜ Not built — schema leaves room for them |

The whole project type-checks cleanly (`tsc --noEmit` passes) and the Prisma schema validates.

---

## Architecture

```
src/
  app/
    (auth)/login, (auth)/register     # public auth pages
    (app)/dashboard, transactions, …  # protected app pages (sidebar layout)
    api/                              # REST route handlers (the "backend")
  components/                         # Sidebar + UI primitives
  lib/
    prisma.ts      # singleton Prisma client
    auth.ts        # bcrypt + JWT (jose) + requireUser()
    crypto.ts      # AES-256-GCM for Plaid tokens at rest
    plaid.ts       # Plaid client + sync logic
    validation.ts  # Zod schemas (server-side validation)
    api.ts         # response/error/audit helpers
    rate-limit.ts  # fixed-window limiter
  server/accounting/
    accounts.ts           # canonical chart of accounts
    income-statement.ts   # P&L computation
    balance-sheet.ts      # balance sheet + retained earnings
    rules-engine.ts       # auto-categorization
prisma/
  schema.prisma  # full data model
  seed.ts        # demo LLC with transactions, rules, assets/liabilities
```

**Key design decisions** (also commented in-code):

- **Money is stored as integer cents everywhere.** No floats in financial math. Conversion happens only at the UI boundary (`lib/money.ts`).
- **Sign convention:** `transaction.amount` is signed cents — positive = money in (credit), negative = money out (debit). Plaid's opposite sign is normalized on import.
- **Owner Contributions is classified as EQUITY, not Revenue.** The spec listed it under Income, but treating a capital injection as revenue overstates operating performance and breaks double-entry separation. This is the one deliberate deviation from the literal spec — see `server/accounting/accounts.ts`.
- **The balance sheet never silently "plugs" the accounting equation.** Any gap (from missing opening balances on imported accounts) surfaces as an explicit *"Opening Balance / Unreconciled Equity"* line, exactly like QuickBooks' Opening Balance Equity account.
- **No raw bank credentials are ever stored.** Plaid returns a token; we encrypt it at rest with AES-256-GCM.
- **Duplicate imports are impossible** thanks to the unique `(userId, plaidTransactionId)` constraint plus Plaid's cursor-based sync.

---

## Quick start (local, with Docker for Postgres)

```bash
# 1. Clone & install
npm install

# 2. Configure environment
cp .env.example .env
#   Then generate real secrets:
#   JWT_SECRET     -> openssl rand -base64 48
#   ENCRYPTION_KEY -> openssl rand -hex 32   (must be 64 hex chars)
#   Add your Plaid sandbox keys if you want live bank connection.

# 3. Start Postgres
docker compose up -d db

# 4. Create the schema + load demo data
npm run db:migrate     # or: npm run db:push for a quick first run
npm run db:seed

# 5. Run
npm run dev            # http://localhost:3000
```

**Demo login:** `demo@ledgerlite.dev` / `demopassword123`

### Run everything in Docker

```bash
docker compose up --build      # app on :3000, db on :5432
# then, one-time, push schema + seed against the container db:
docker compose exec app npx prisma db push
docker compose exec app npm run db:seed
```

---

## Connecting a bank (Plaid)

1. Get sandbox credentials at <https://dashboard.plaid.com> and set `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV=sandbox`.
2. The backend is ready: `POST /api/plaid/link-token` → open Plaid Link in the browser with the returned token → on success Plaid gives you a `public_token` → `POST /api/plaid/exchange { publicToken }` → `POST /api/plaid/sync { institutionId }` to import.
3. To wire the Link widget, add `react-plaid-link` and call `usePlaidLink({ token, onSuccess })`. The onSuccess handler posts the public token to `/api/plaid/exchange`. (This small front-end piece is the remaining UI work; everything it depends on is built.)

In sandbox, use username `user_good` / password `pass_good`.

---

## API reference (summary)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` · `/login` · `/logout` | Auth |
| GET | `/api/auth/me` | Current user |
| POST | `/api/plaid/link-token` · `/exchange` · `/sync` | Banking |
| GET | `/api/transactions` | List (filters: date, account, category, `filter=uncategorized\|income\|expense`, `q`, sort, page) |
| PATCH/DELETE | `/api/transactions/:id` | Categorize, edit, split, soft-delete |
| GET/POST | `/api/categories` | Chart of accounts |
| GET/POST | `/api/rules` · POST `/api/rules/run` | Rules engine |
| GET | `/api/reports/income-statement` · `/balance-sheet` | Financial statements |
| GET/POST | `/api/assets` · `/api/liabilities` | Manual balance-sheet items |

Every write validates input with Zod, scopes by `userId`, and writes an `audit_logs` entry.

---

## Deployment

- **Frontend + API → Vercel.** Set the env vars in the Vercel dashboard. `next.config.js` uses `output: "standalone"`.
- **Database → Railway / Render / Supabase Postgres.** Paste the connection string into `DATABASE_URL`. Run `npx prisma migrate deploy` on release.
- Set `NODE_ENV=production` so the session cookie is `secure` (HTTPS-only).

---

## Security checklist (implemented)

- bcrypt password hashing (cost 12) · JWT in httpOnly + SameSite=Lax + Secure cookie
- Plaid tokens encrypted at rest (AES-256-GCM); **no raw credentials stored**
- Zod server-side validation on every endpoint · Prisma parameterized queries (SQL-injection safe)
- Rate limiting on auth endpoints · audit logging · per-tenant `userId` scoping
- All secrets via environment variables

**Next hardening steps:** Postgres row-level security, CSRF double-submit token for non-cookie clients, Redis-backed rate limiter for multi-instance, and 2FA.
