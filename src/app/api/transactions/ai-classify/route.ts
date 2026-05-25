import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireUser } from "@/lib/auth";
import { ok, bad, handleError, audit } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { aiConfigured, suggestCategories } from "@/lib/ai-classify";

const schema = z.object({ ids: z.array(z.string().cuid()).max(200).optional() });

// POST /api/transactions/ai-classify — ask Claude to suggest a category for each
// uncategorized transaction. Returns suggestions for review; does NOT apply them.
export async function POST(req: NextRequest) {
  try {
    const u = await requireUser(req);
    if (!aiConfigured()) return ok({ configured: false, suggestions: [] });

    const { ids } = schema.parse(await req.json().catch(() => ({})));

    const txns = await prisma.transaction.findMany({
      where: {
        userId: u.id,
        categoryId: null,
        isSplit: false,
        deletedAt: null,
        ...(ids ? { id: { in: ids } } : {}),
      },
      orderBy: { date: "desc" },
      take: 100, // bound cost/latency per run
      select: { id: true, description: true, merchantName: true, amount: true },
    });

    const categories = await prisma.category.findMany({
      where: { userId: u.id, deletedAt: null, class: { in: ["REVENUE", "EXPENSE"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, class: true },
    });

    let suggestions;
    try {
      suggestions = await suggestCategories(txns, categories);
    } catch (e) {
      if (e instanceof Anthropic.APIError) return bad(`AI request failed: ${e.message}`, 502);
      throw e;
    }

    // Join the transaction details back so the review UI can render each row.
    const byId = new Map(txns.map((t) => [t.id, t]));
    const enriched = suggestions
      .map((s) => {
        const t = byId.get(s.transactionId);
        if (!t) return null;
        return {
          transactionId: s.transactionId,
          description: t.description,
          merchantName: t.merchantName,
          amount: t.amount,
          suggestedCategoryId: s.suggestedCategoryId,
          suggestedCategoryName: s.suggestedCategoryName,
        };
      })
      .filter(Boolean);

    await audit(u.id, "transaction.ai_classify", "transactions", undefined, { count: txns.length });
    return ok({ configured: true, suggestions: enriched });
  } catch (err) {
    return handleError(err);
  }
}
