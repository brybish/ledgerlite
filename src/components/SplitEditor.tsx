"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmtUSD } from "@/lib/client";
import { Button, Select, Input, Label } from "@/components/ui";

// Split a single transaction across multiple categories. The server enforces
// that split amounts sum exactly to the transaction amount (in cents); we
// mirror that here with a live remaining-balance readout and a disabled Save
// until it reconciles. Amounts are entered in dollars, signed the same way as
// the parent transaction (negative = money out), and converted to cents.
type Line = { categoryId: string; amount: string; notes: string };

const toCents = (s: string) => Math.round(parseFloat(s || "0") * 100);

export function SplitEditor({
  txn,
  categories,
  onClose,
}: {
  txn: any;
  categories: any[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const existing: Line[] =
    txn.isSplit && txn.splits?.length
      ? txn.splits.map((s: any) => ({ categoryId: s.categoryId, amount: (s.amount / 100).toFixed(2), notes: s.notes ?? "" }))
      : [
          { categoryId: "", amount: (txn.amount / 100).toFixed(2), notes: "" },
          { categoryId: "", amount: "0.00", notes: "" },
        ];
  const [lines, setLines] = useState<Line[]>(existing);

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, { categoryId: "", amount: "0.00", notes: "" }]);
  const removeLine = (i: number) => setLines((ls) => (ls.length > 2 ? ls.filter((_, idx) => idx !== i) : ls));

  const sumCents = lines.reduce((s, l) => s + toCents(l.amount), 0);
  const remaining = txn.amount - sumCents;
  const balanced = remaining === 0;
  const allCategorized = lines.every((l) => l.categoryId);

  const save = useMutation({
    mutationFn: () =>
      api(`/transactions/${txn.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          splits: lines.map((l) => ({ categoryId: l.categoryId, amount: toCents(l.amount), notes: l.notes.trim() || undefined })),
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["txns"] });
      qc.invalidateQueries({ queryKey: ["pnl"] });
      qc.invalidateQueries({ queryKey: ["uncat"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-800 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Split transaction</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <p className="mb-4 text-sm text-gray-500">
          {txn.merchantName ?? txn.description} · total <span className="font-medium">{fmtUSD(txn.amount)}</span>
        </p>

        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 items-end gap-2">
              <div className="col-span-5">
                {i === 0 && <Label>Category</Label>}
                <Select value={l.categoryId} onChange={(e: any) => setLine(i, { categoryId: e.target.value })}>
                  <option value="" disabled>Select…</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.class.toLowerCase()})</option>)}
                </Select>
              </div>
              <div className="col-span-3">
                {i === 0 && <Label>Amount (USD)</Label>}
                <Input type="number" step="0.01" value={l.amount} onChange={(e: any) => setLine(i, { amount: e.target.value })} />
              </div>
              <div className="col-span-3">
                {i === 0 && <Label>Notes</Label>}
                <Input value={l.notes} onChange={(e: any) => setLine(i, { notes: e.target.value })} placeholder="optional" />
              </div>
              <div className="col-span-1">
                <Button variant="ghost" className="px-2 py-2 text-xs text-red-600" onClick={() => removeLine(i)} disabled={lines.length <= 2}>✕</Button>
              </div>
            </div>
          ))}
        </div>

        <button onClick={addLine} className="mt-2 text-sm font-medium text-brand hover:underline">+ Add line</button>

        <div className="mt-4 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-950/40">
          <span className="text-gray-500">Allocated {fmtUSD(sumCents)} of {fmtUSD(txn.amount)}</span>
          <span className={balanced ? "font-medium text-green-600" : "font-medium text-amber-600"}>
            {balanced ? "Balanced ✓" : `${fmtUSD(remaining)} remaining`}
          </span>
        </div>

        {save.error && <p className="mt-2 text-sm text-red-600">{(save.error as any).message}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !balanced || !allCategorized}>
            {save.isPending ? "Saving…" : "Save split"}
          </Button>
        </div>
      </div>
    </div>
  );
}
