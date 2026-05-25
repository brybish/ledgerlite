"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmtUSD } from "@/lib/client";
import { Button, Input, Textarea, Select, Label } from "@/components/ui";

// Edit a transaction's description, business/personal classification, and notes.
// (Category/splits are handled by the inline dropdown + SplitEditor.)
export function TransactionEditModal({ txn, onClose }: { txn: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [description, setDescription] = useState(txn.description ?? "");
  const [notes, setNotes] = useState(txn.notes ?? "");
  const [isBusiness, setIsBusiness] = useState(txn.isBusiness ?? true);

  const save = useMutation({
    mutationFn: () =>
      api(`/transactions/${txn.id}`, {
        method: "PATCH",
        body: JSON.stringify({ description: description.trim() || undefined, notes, isBusiness }),
      }),
    onSuccess: () => {
      ["txns", "pnl", "uncat", "dashboard"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-800 dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Edit transaction</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <p className="mb-4 text-sm text-gray-500">{new Date(txn.date).toLocaleDateString()} · <span className={txn.amount >= 0 ? "text-emerald-600" : ""}>{fmtUSD(txn.amount)}</span></p>

        <div className="space-y-3">
          <div>
            <Label>Description</Label>
            <Input value={description} onChange={(e: any) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label>Classification</Label>
            <Select value={isBusiness ? "business" : "personal"} onChange={(e: any) => setIsBusiness(e.target.value === "business")}>
              <option value="business">Business</option>
              <option value="personal">Personal</option>
            </Select>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea rows={3} value={notes} onChange={(e: any) => setNotes(e.target.value)} placeholder="Optional notes…" />
          </div>
        </div>

        {save.error && <p className="mt-2 text-sm text-red-600">{(save.error as any).message}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
        </div>
      </div>
    </div>
  );
}
