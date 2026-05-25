"use client";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmtUSD } from "@/lib/client";
import { Button, Select, Skeleton } from "@/components/ui";

// Review-and-accept UI for AI category suggestions. The (paid) AI call is only
// fired when the user clicks the button. Each row's category dropdown defaults
// to Claude's suggestion; the user can change or clear any before applying.
type Sug = {
  transactionId: string;
  description: string;
  merchantName: string | null;
  amount: number;
  suggestedCategoryId: string | null;
  suggestedCategoryName: string | null;
};

export function AiClassifyModal({ categories, onClose }: { categories: any[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [choices, setChoices] = useState<Record<string, string>>({});

  const run = useMutation({
    mutationFn: () => api<{ configured: boolean; suggestions: Sug[] }>("/transactions/ai-classify", { method: "POST", body: JSON.stringify({}) }),
    onSuccess: (d) => setChoices(Object.fromEntries(d.suggestions.map((s) => [s.transactionId, s.suggestedCategoryId ?? ""]))),
  });

  const data = run.data;
  const suggestions = data?.suggestions ?? [];
  const selectedCount = useMemo(() => Object.values(choices).filter(Boolean).length, [choices]);

  const apply = useMutation({
    mutationFn: async () => {
      const groups = new Map<string, string[]>();
      for (const [txnId, catId] of Object.entries(choices)) {
        if (!catId) continue;
        const arr = groups.get(catId);
        if (arr) arr.push(txnId);
        else groups.set(catId, [txnId]);
      }
      for (const [categoryId, ids] of groups) {
        await api("/transactions/bulk-categorize", { method: "POST", body: JSON.stringify({ ids, categoryId }) });
      }
    },
    onSuccess: () => {
      ["txns", "pnl", "uncat", "dashboard"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-800 dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">AI categorize</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {/* Initial / loading / not-configured / results */}
        {!data && !run.isPending && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Claude will look at your uncategorized transactions and suggest a category for each. Nothing is applied until you review and accept.</p>
            {run.error && <p className="text-sm text-red-600">{(run.error as any).message}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={() => run.mutate()}>Suggest categories with AI</Button>
            </div>
          </div>
        )}

        {run.isPending && (
          <div className="space-y-2 py-2">
            <p className="text-sm text-gray-500">Asking Claude to classify your transactions…</p>
            <Skeleton className="h-48" />
          </div>
        )}

        {data && data.configured === false && (
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm dark:bg-amber-950/30">
              AI categorize isn’t configured yet. Add an <code>ANTHROPIC_API_KEY</code> environment variable (get one at <span className="font-medium">console.anthropic.com</span>), then redeploy.
            </div>
            <div className="flex justify-end"><Button variant="outline" onClick={onClose}>Close</Button></div>
          </div>
        )}

        {data && data.configured && (
          suggestions.length === 0 ? (
            <div className="space-y-4">
              <p className="py-6 text-center text-sm text-gray-500">🎉 Nothing to categorize — all transactions already have a category.</p>
              <div className="flex justify-end"><Button variant="outline" onClick={onClose}>Close</Button></div>
            </div>
          ) : (
            <>
              <p className="mb-2 text-sm text-gray-500">Review the suggestions, adjust any, then apply. <span className="font-medium text-gray-700 dark:text-gray-300">{selectedCount}</span> of {suggestions.length} will be set.</p>
              <div className="flex-1 overflow-auto rounded-lg border border-gray-200 dark:border-gray-800">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-900/80">
                    <tr><th className="px-3 py-2">Transaction</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Category</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {suggestions.map((s) => (
                      <tr key={s.transactionId}>
                        <td className="px-3 py-2">{s.merchantName ?? s.description}</td>
                        <td className={`px-3 py-2 text-right ${s.amount >= 0 ? "text-emerald-600" : ""}`}>{fmtUSD(s.amount)}</td>
                        <td className="px-3 py-2">
                          <Select value={choices[s.transactionId] ?? ""} onChange={(e: any) => setChoices((c) => ({ ...c, [s.transactionId]: e.target.value }))} className="text-xs">
                            <option value="">— Skip —</option>
                            {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}{c.id === s.suggestedCategoryId ? " ✨" : ""}</option>)}
                          </Select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {apply.error && <p className="mt-2 text-sm text-red-600">{(apply.error as any).message}</p>}
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={onClose} disabled={apply.isPending}>Cancel</Button>
                <Button onClick={() => apply.mutate()} disabled={selectedCount === 0 || apply.isPending}>{apply.isPending ? "Applying…" : `Apply ${selectedCount}`}</Button>
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}
