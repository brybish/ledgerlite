import { z } from "zod";

// Centralized Zod schemas. Every API route validates input with these before
// touching the database — this is our server-side validation + injection guard
// (Prisma parameterizes queries, and Zod rejects malformed/oversized input).

export const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(10, "Use at least 10 characters").max(200),
  name: z.string().max(120).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

export const txnUpdateSchema = z.object({
  categoryId: z.string().cuid().nullable().optional(),
  description: z.string().max(500).optional(),
  notes: z.string().max(2000).nullable().optional(),
  isBusiness: z.boolean().optional(),
  splits: z
    .array(z.object({ categoryId: z.string().cuid(), amount: z.number().int(), notes: z.string().max(500).optional() }))
    .optional(),
});

// Manual transaction entry. `amount` is SIGNED cents (positive = money in,
// negative = money out) — the client converts dollars + an in/out toggle before
// sending. bankAccountId/plaidTransactionId stay null for non-Plaid rows.
export const txnCreateSchema = z.object({
  date: z.string().datetime(),
  description: z.string().min(1).max(500),
  amount: z.number().int(),
  categoryId: z.string().cuid().nullable().optional(),
  merchantName: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  isBusiness: z.boolean().default(true),
});

// Bulk CSV import. Each row already normalized to signed cents on the client.
export const txnImportSchema = z.object({
  source: z.string().max(120).optional(),
  rows: z
    .array(
      z.object({
        date: z.string().datetime(),
        description: z.string().min(1).max(500),
        amount: z.number().int(),
        merchantName: z.string().max(200).optional(),
      })
    )
    .min(1, "No rows to import.")
    .max(5000, "Import is capped at 5000 rows at a time."),
});

export const ruleSchema = z.object({
  name: z.string().min(1).max(120),
  field: z.enum(["MERCHANT", "DESCRIPTION", "AMOUNT"]),
  op: z.enum(["CONTAINS", "EQUALS", "STARTS_WITH", "GT", "LT"]),
  value: z.string().min(1).max(200),
  categoryId: z.string().cuid(),
  priority: z.number().int().min(0).max(10000).default(100),
  enabled: z.boolean().default(true),
});

export const ruleUpdateSchema = ruleSchema.partial().strict();

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(200),
});

export const profileSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    email: z.string().email().max(200).optional(),
  })
  .strict()
  .refine((d) => d.name !== undefined || d.email !== undefined, { message: "Nothing to update." });

export const assetSchema = z.object({
  name: z.string().min(1).max(160),
  type: z.string().min(1).max(80),
  value: z.number().int(), // cents
  acquisitionDate: z.string().datetime().optional(),
  depreciable: z.boolean().default(false),
  usefulLifeMonths: z.number().int().positive().optional(),
  salvageValue: z.number().int().nonnegative().default(0),
  notes: z.string().max(2000).optional(),
});

export const liabilitySchema = z.object({
  name: z.string().min(1).max(160),
  type: z.string().min(1).max(80),
  balance: z.number().int(),
  longTerm: z.boolean().default(false),
  interestRate: z.number().nonnegative().max(100).optional(),
  notes: z.string().max(2000).optional(),
});

// Edits are partial: any subset of the create fields may be sent. `.strict()`
// rejects unknown keys so a typo can't silently no-op.
export const assetUpdateSchema = assetSchema.partial().strict();
export const liabilityUpdateSchema = liabilitySchema.partial().strict();

export const dateRangeSchema = z.object({
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
});
