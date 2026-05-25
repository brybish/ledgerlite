import Anthropic from "@anthropic-ai/sdk";

// ===========================================================================
// AI transaction classification (Claude).
// ---------------------------------------------------------------------------
// Given a batch of uncategorized transactions and the user's chart of accounts,
// Claude suggests the best-fit category for each (or null when unsure). We use
// structured outputs (a dynamic enum of the user's category names) so the model
// can only return a real category, and prompt-cache the stable system+category
// prefix so repeated batches are cheaper. Suggestions are returned for the user
// to review and accept — never auto-applied.
//
// Model defaults to claude-opus-4-7; override with ANTHROPIC_MODEL (e.g.
// claude-haiku-4-5 for ~5x lower cost on this simple classification task).
// ===========================================================================

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-7";

export const aiConfigured = (): boolean => !!process.env.ANTHROPIC_API_KEY;

export interface ClassifyTxn {
  id: string;
  description: string;
  merchantName: string | null;
  amount: number; // signed cents (positive = money in, negative = money out)
}
export interface CategoryOption {
  id: string;
  name: string;
  class: string; // "REVENUE" | "EXPENSE"
}
export interface Suggestion {
  transactionId: string;
  suggestedCategoryId: string | null;
  suggestedCategoryName: string | null;
}

export async function suggestCategories(
  txns: ClassifyTxn[],
  categories: CategoryOption[]
): Promise<Suggestion[]> {
  // Nothing to do / nothing to suggest from → all null.
  if (txns.length === 0) return [];
  const names = categories.map((c) => c.name);
  if (names.length === 0) {
    return txns.map((t) => ({ transactionId: t.id, suggestedCategoryId: null, suggestedCategoryName: null }));
  }

  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

  const system = [
    "You are an expert bookkeeping assistant for a small-business accounting app.",
    "For each transaction, choose the single best-fit category from the allowed list below, or null if none is a good fit.",
    "Sign convention: a POSITIVE amount is money IN (income/revenue); a NEGATIVE amount is money OUT (an expense).",
    "Use REVENUE categories for positive amounts and EXPENSE categories for negative amounts.",
    "When you are not reasonably confident, return null rather than guessing.",
    "",
    "Allowed categories (name — class):",
    ...categories.map((c) => `- ${c.name} — ${c.class}`),
  ].join("\n");

  const payload = JSON.stringify(
    txns.map((t) => ({
      id: t.id,
      description: t.description,
      merchant: t.merchantName ?? undefined,
      amount: (t.amount / 100).toFixed(2), // signed dollars
    }))
  );

  // Force a tool call so the model returns structured, parseable data. The enum
  // constrains it to real category names; we still validate names server-side.
  const tool: Anthropic.Tool = {
    name: "submit_classifications",
    description: "Record the chosen category for every transaction.",
    input_schema: {
      type: "object",
      properties: {
        classifications: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "The transaction id, copied exactly." },
              category: {
                anyOf: [{ type: "string", enum: names }, { type: "null" }],
                description: "Exactly one allowed category name, or null if none is a good fit.",
              },
            },
            required: ["id", "category"],
          },
        },
      },
      required: ["classifications"],
    },
  };

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    tools: [tool],
    tool_choice: { type: "tool", name: "submit_classifications" },
    messages: [
      {
        role: "user",
        content: "Classify each of these transactions. Return exactly one entry per transaction id.\n\n" + payload,
      },
    ],
  });

  const block = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  const result = (block?.input ?? {}) as { classifications?: { id: string; category: string | null }[] };

  const byName = new Map(categories.map((c) => [c.name, c.id]));
  const requested = new Set(txns.map((t) => t.id));
  const seen = new Set<string>();
  const out: Suggestion[] = [];

  for (const c of result.classifications ?? []) {
    if (!requested.has(c.id) || seen.has(c.id)) continue;
    seen.add(c.id);
    const catId = c.category ? byName.get(c.category) ?? null : null;
    out.push({
      transactionId: c.id,
      suggestedCategoryId: catId,
      suggestedCategoryName: catId ? c.category : null,
    });
  }
  // Any transaction the model skipped → explicit null suggestion (still reviewable).
  for (const t of txns) {
    if (!seen.has(t.id)) out.push({ transactionId: t.id, suggestedCategoryId: null, suggestedCategoryName: null });
  }
  return out;
}
