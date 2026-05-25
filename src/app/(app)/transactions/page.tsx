"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmtUSD } from "@/lib/client";
import { Card, Input, Button, Skeleton } from "@/components/ui";

// Transaction management: server-side filtering/sorting/pagination via the
// /transactions endpoint, with inline category assignment that PATCHes a single
// row and invalidates the cache so statements update immediately.

export default function TransactionsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ pageSize: "50", page: String(page), sort: "date", dir: "desc" });
  if (q) params.set("q", q);
  if (filter) params.set("filter", filter);

  const txns = useQuery({ queryKey: ["txns", q, filter, page], queryFn: () => api<any>(`/transactions?${params}`) });
  const cats = useQuery({ queryKey: ["cats"], queryFn: () => api<any>("/reports/income-statement").then(() => fetchCats()) });

  // Categories come from a dedicated lightweight call (reuse income-statement
  // categories isn't ideal, so we read them directly here).
  async function fetchCats() {
    return api<any>("/transactions?pageSize=1").then(() => api<any>("/categories").catch(() => ({ items: [] })));
  }

  const categorize = useMutation({
    mutationFn: ({ id, categoryId }: { id: string; categoryId: string }) =>
      api(`/transactions/${id}`, { method: "PATCH", body: JSON.stringify({ categoryId }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["txns"] });
      qc.invalidateQueries({ queryKey: ["pnl"] });
      qc.invalidateQueries({ queryKey: ["uncat"] });
    },
  });

  const filters = [
    { v: "", label: "All" },
    { v: "uncategorized", label: "Uncategorized" },
    { v: "income", label: "Income" },
    { v: "expense", label: "Expense" },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Transactions</h1>

      <Card className="flex flex-wrap items-center gap-3">
        <Input placeholder="Search description or merchant…" value={q} onChange={(e: any) => { setQ(e.target.value); setPage(1); }} className="max-w-xs" />
        <div className="flex gap-1">
          {filters.map((f) => (
            <Button key={f.v} variant={filter === f.v ? "primary" : "outline"} onClick={() => { setFilter(f.v); setPage(1); }}>{f.label}</Button>
          ))}
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-900/50">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {txns.isLoading && (
              <tr><td colSpan={4} className="p-4"><Skeleton className="h-40" /></td></tr>
            )}
            {txns.data?.items?.map((t: any) => (
              <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="whitespace-nowrap px-4 py-2.5 text-gray-500">{new Date(t.date).toLocaleDateString()}</td>
                <td className="px-4 py-2.5">
                  <p className="font-medium">{t.merchantName ?? t.description}</p>
                  {t.pending && <span className="text-xs text-amber-600">pending</span>}
                </td>
                <td className="px-4 py-2.5">
                  <select
                    className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900"
                    value={t.categoryId ?? ""}
                    onChange={(e) => categorize.mutate({ id: t.id, categoryId: e.target.value })}
                  >
                    <option value="">— Uncategorized —</option>
                    {cats.data?.items?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </td>
                <td className={`px-4 py-2.5 text-right font-medium ${t.amount >= 0 ? "text-emerald-600" : ""}`}>{fmtUSD(t.amount)}</td>
              </tr>
            ))}
            {txns.data?.items?.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-500">No transactions. Connect a bank or load demo data.</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      {txns.data && txns.data.pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Page {txns.data.page} of {txns.data.pages} · {txns.data.total} total</span>
          <div className="flex gap-2">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" disabled={page >= txns.data.pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
