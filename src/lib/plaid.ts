import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";
import { applyRulesToUncategorized } from "@/server/accounting/rules-engine";
import { TxnType, AccountType } from "@prisma/client";

// ===========================================================================
// Plaid integration
// ---------------------------------------------------------------------------
// We NEVER store raw bank credentials. The Plaid Link flow (browser) returns a
// short-lived public_token; we exchange it server-side for a long-lived
// access_token which we encrypt at rest (AES-256-GCM, see lib/crypto). All
// Plaid calls happen server-side only.
//
// Transaction ingestion uses Plaid's /transactions/sync endpoint, which is
// cursor-based and inherently deduplicating + paginated. We persist the cursor
// per Institution so repeated "Download" clicks only fetch deltas. As a second
// safety net, transactions are upserted on the unique (userId, plaidTransactionId)
// key so a re-import can never create duplicates.
// ===========================================================================

function plaidClient(): PlaidApi {
  const env = (process.env.PLAID_ENV ?? "sandbox") as keyof typeof PlaidEnvironments;
  const config = new Configuration({
    basePath: PlaidEnvironments[env],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID ?? "",
        "PLAID-SECRET": process.env.PLAID_SECRET ?? "",
      },
    },
  });
  return new PlaidApi(config);
}

export async function createLinkToken(userId: string): Promise<string> {
  const client = plaidClient();
  const res = await client.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: "LedgerLite",
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: "en",
  });
  return res.data.link_token;
}

// Exchange the public token, persist the institution + its accounts.
export async function exchangePublicToken(userId: string, publicToken: string): Promise<{ institutionId: string }> {
  const client = plaidClient();
  const exchange = await client.itemPublicTokenExchange({ public_token: publicToken });
  const accessToken = exchange.data.access_token;
  const itemId = exchange.data.item_id;

  // Resolve institution name + accounts.
  const accountsRes = await client.accountsGet({ access_token: accessToken });
  const instName = accountsRes.data.item.institution_id
    ? (await client
        .institutionsGetById({
          institution_id: accountsRes.data.item.institution_id,
          country_codes: [CountryCode.Us],
        })
        .then((r) => r.data.institution.name)
        .catch(() => "Bank"))
    : "Bank";

  const institution = await prisma.institution.upsert({
    where: { plaidItemId: itemId },
    create: { userId, name: instName, plaidItemId: itemId, accessTokenEnc: encrypt(accessToken) },
    update: { accessTokenEnc: encrypt(accessToken), deletedAt: null },
  });

  for (const acct of accountsRes.data.accounts) {
    await prisma.bankAccount.upsert({
      where: { plaidAccountId: acct.account_id },
      create: {
        userId,
        institutionId: institution.id,
        plaidAccountId: acct.account_id,
        name: acct.name,
        mask: acct.mask ?? null,
        type: mapAccountType(acct.type),
        subtype: acct.subtype ?? null,
        currentBalance: Math.round((acct.balances.current ?? 0) * 100),
        availableBalance: acct.balances.available != null ? Math.round(acct.balances.available * 100) : null,
        isoCurrency: acct.balances.iso_currency_code ?? "USD",
      },
      update: {
        name: acct.name,
        currentBalance: Math.round((acct.balances.current ?? 0) * 100),
        availableBalance: acct.balances.available != null ? Math.round(acct.balances.available * 100) : null,
      },
    });
  }

  return { institutionId: institution.id };
}

function mapAccountType(t: string): AccountType {
  switch (t) {
    case "depository":
      return "DEPOSITORY";
    case "credit":
      return "CREDIT";
    case "loan":
      return "LOAN";
    case "investment":
      return "INVESTMENT";
    default:
      return "OTHER";
  }
}

export interface SyncResult {
  added: number;
  modified: number;
  removed: number;
  rulesApplied: number;
}

// Incrementally sync transactions for one institution. Handles pagination via
// has_more, persists the cursor, and upserts to guarantee no duplicates.
export async function syncTransactions(userId: string, institutionId: string): Promise<SyncResult> {
  const inst = await prisma.institution.findFirstOrThrow({ where: { id: institutionId, userId } });
  const client = plaidClient();
  const accessToken = decrypt(inst.accessTokenEnc);

  const accountMap = new Map(
    (await prisma.bankAccount.findMany({ where: { institutionId } })).map((a) => [a.plaidAccountId, a])
  );

  let cursor = inst.syncCursor ?? undefined;
  let added = 0;
  let modified = 0;
  let removed = 0;
  let hasMore = true;

  // Plaid recommends looping until has_more === false within one sync run.
  while (hasMore) {
    const res = await withRetry(() =>
      client.transactionsSync({ access_token: accessToken, cursor, count: 250 })
    );
    const data = res.data;

    for (const t of data.added) {
      const acct = accountMap.get(t.account_id);
      // Plaid sign: positive amount = money OUT of the account. We invert to
      // our convention (positive = money IN).
      const signedCents = Math.round(-t.amount * 100);
      await prisma.transaction.upsert({
        where: { userId_plaidTransactionId: { userId, plaidTransactionId: t.transaction_id } },
        create: {
          userId,
          bankAccountId: acct?.id ?? null,
          plaidTransactionId: t.transaction_id,
          date: new Date(t.date),
          description: t.name,
          merchantName: t.merchant_name ?? null,
          amount: signedCents,
          type: signedCents < 0 ? TxnType.DEBIT : TxnType.CREDIT,
          pending: t.pending,
          accountName: acct?.name ?? null,
          institutionName: inst.name,
          categoryFromBank: t.personal_finance_category?.primary ?? null,
        },
        update: { pending: t.pending },
      });
      added++;
    }

    for (const t of data.modified) {
      await prisma.transaction.updateMany({
        where: { userId, plaidTransactionId: t.transaction_id },
        data: { pending: t.pending, amount: Math.round(-t.amount * 100) },
      });
      modified++;
    }

    for (const t of data.removed) {
      if (!t.transaction_id) continue;
      // Soft-delete removed transactions to preserve history/audit.
      await prisma.transaction.updateMany({
        where: { userId, plaidTransactionId: t.transaction_id },
        data: { deletedAt: new Date() },
      });
      removed++;
    }

    cursor = data.next_cursor;
    hasMore = data.has_more;
  }

  await prisma.institution.update({ where: { id: institutionId }, data: { syncCursor: cursor } });

  // Auto-apply categorization rules to anything newly imported.
  const rulesApplied = await applyRulesToUncategorized(userId);

  return { added, modified, removed, rulesApplied };
}

// Simple exponential-backoff retry for transient Plaid/API failures.
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 2 ** i * 400));
    }
  }
  throw lastErr;
}
