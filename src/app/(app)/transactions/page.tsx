"use client";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmtUSD } from "@/lib/client";
import { Card, Input, Button, Select, Skeleton } from "@/components/ui";
import { SplitEditor } from "@/components/SplitEditor";
import { AddTransactionModal } from "@/components/AddTransactionModal";
import { CsvImportModal } from "@/components/CsvImportModal";

// Transaction management: server-side filter/sort/pagination via /transactions.
// Supports single inline categorize, multi-select bulk categorize, and per-row
// splitting across multiple categories.
export default function TransactionsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCat, setBulkCat] = useState("");
  const [splitTxn, setSplitTxn] = useState<any | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const params = new URLSearchParams({ pageSize: "50", page: String(page), sort: "date", dir: "desc" });
  if (q) params.set("q", q);
  if (filter) params.set("filter", filter);

  const txns = useQuery({ queryKey: ["txns", q, filter, page], queryFn: () => api<any>(`/transactions?${params}`) });
  const cats = useQuery({ queryKey: ["categories"], queryFn: () => api<any>("/categories") });
  const categories = cats.data?.items ?? [];

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["txns"] });
    qc.invalidateQueries({ queryKey: ["pnl"] });
    qc.invalidateQueries({ queryKey: ["uncat"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const categorize = useMutation({
    mutationFn: ({ id, categoryId }: { id: string; categoryId: string }) =>
      api(`/transactions/${id}`, { method: "PATCH", body: JSON.stringify({ categoryId: categoryId || null }) }),
    onSuccess: invalidate,
  });

  const bulk = useMutation({
    mutationFn: (categoryId: string | null) =>
      api<{ updated: number }>("/transactions/bulk-categorize", { method: "POST", body: JSON.stringify({ ids: [...selected], categoryId }) }),
    onSuccess: () => { invalidate(); setSelected(new Set()); setBulkCat(""); },
  });

  const items = txns.data?.items ?? [];
  const allOnPageSelected = items.length > 0 && items.every((t: any) => selected.has(t.id));

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) items.forEach((t: any) => next.delete(t.id));
      else items.forEach((t: any) => next.add(t.id));
      return next;
    });
  };
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const filters = [
    { v: "", label: "All" },
    { v: "uncategorized", label: "Uncategorized" },
    { v: "income", label: "Income" },
    { v: "expense", label: "Expense" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImport(true)}>Import CSV</Button>
          <Button onClick={() => setShowAdd(true)}>Add transaction</Button>
        </div>
      </div>

      <Card className="flex flex-wrap items-center gap-3">
        <Input placeholder="Search description or merchant…" value={q} onChange={(e: any) => { setQ(e.target.value); setPage(1); }} className="max-w-xs" />
        <div className="flex gap-1">
          {filters.map((f) => (
            <Button key={f.v} variant={filter === f.v ? "primary" : "outline"} onClick={() => { setFilter(f.v); setPage(1); }}>{f.label}</Button>
          ))}
        </div>
      </Card>

      {selected.size > 0 && (
        <Card className="flex flex-wrap items-center gap-3 border-brand/40 bg-brand/5">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Select value={bulkCat} onChange={(e: any) => setBulkCat(e.target.value)} className="max-w-xs">
            <option value="">Set category to…</option>
            {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.class.toLowerCase()})</option>)}
          </Select>
          <Button onClick={() => bulk.mutate(bulkCat)} disabled={!bulkCat || bulk.isPending}>{bulk.isPending ? "Applying…" : "Apply"}</Button>
          <Button variant="outline" onClick={() => bulk.mutate(null)} disabled={bulk.isPending}>Clear category</Button>
          <Button variant="ghost" onClick={() => setSelected(new Set())}>Deselect all</Button>
          {bulk.error && <span className="text-sm text-red-600">{(bulk.error as any).message}</span>}
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-900/50">
            <tr>
              <th className="px-4 py-3"><input type="checkbox" checked={allOnPageSelected} onChange={toggleAll} className="h-4 w-4 rounded border-gray-300" /></th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {txns.isLoading && <tr><td colSpan={6} className="p-4"><Skeleton className="h-40" /></td></tr>}
            {items.map((t: any) => (
              <tr key={t.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${selected.has(t.id) ? "bg-brand/5" : ""}`}>
                <td className="px-4 py-2.5"><input type="checkbox" checked={selected.has(t.id)} onChange={() => toggleOne(t.id)} className="h-4 w-4 rounded border-gray-300" /></td>
                <td className="whitespace-nowrap px-4 py-2.5 text-gray-500">{new Date(t.date).toLocaleDateString()}</td>
                <td className="px-4 py-2.5">
                  <p className="font-medium">{t.merchantName ?? t.description}</p>
                  {t.pending && <span className="text-xs text-amber-600">pending</span>}
                  {t.isSplit && t.splits?.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {t.splits.map((s: any) => (
                        <p key={s.id} className="text-xs text-gray-400">↳ {s.category?.name}: {fmtUSD(s.amount)}</p>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {t.isSplit ? (
                    <span className="text-xs italic text-gray-400">Split ({t.splits?.length ?? 0})</span>
                  ) : (
                    <select
                      className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900"
                      value={t.categoryId ?? ""}
                      onChange={(e) => categorize.mutate({ id: t.id, categoryId: e.target.value })}
                    >
                      <option value="">— Uncategorized —</option>
                      {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  )}
                </td>
                <td className={`px-4 py-2.5 text-right font-medium ${t.amount >= 0 ? "text-emerald-600" : ""}`}>{fmtUSD(t.amount)}</td>
                <td className="px-4 py-2.5 text-right">
                  <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setSplitTxn(t)}>{t.isSplit ? "Edit split" : "Split"}</Button>
                </td>
              </tr>
            ))}
            {!txns.isLoading && items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500">No transactions. Connect a bank or load demo data.</td></tr>
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

      {splitTxn && <SplitEditor txn={splitTxn} categories={categories} onClose={() => setSplitTxn(null)} />}
      {showAdd && <AddTransactionModal categories={categories} onClose={() => setShowAdd(false)} />}
      {showImport && <CsvImportModal onClose={() => setShowImport(false)} />}
    </div>
  );
}
