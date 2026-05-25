"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { Button, Select, Input, Label } from "@/components/ui";

// Add a single transaction by hand. The user enters a positive dollar amount and
// picks a direction; we convert to the app's signed-cents convention
// (money in = positive, money out = negative) before sending.
export function AddTransactionModal({ categories, onClose }: { categories: any[]; onClose: () => void }) {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"out" | "in">("out");
  const [categoryId, setCategoryId] = useState("");
  const [notes, setNotes] = useState("");

  const cents = Math.round(parseFloat(amount || "0") * 100);
  const signed = direction === "out" ? -Math.abs(cents) : Math.abs(cents);
  const valid = description.trim().length > 0 && amount.trim() !== "" && !Number.isNaN(cents) && cents !== 0 && !!date;

  const save = useMutation({
    mutationFn: () =>
      api("/transactions", {
        method: "POST",
        body: JSON.stringify({
          // Anchor at noon UTC so the calendar day survives local-time display.
          date: `${date}T12:00:00.000Z`,
          description: description.trim(),
          amount: signed,
          categoryId: categoryId || undefined,
          notes: notes.trim() || undefined,
        }),
      }),
    onSuccess: () => {
      ["txns", "pnl", "uncat", "dashboard"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-800 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add transaction</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="space-y-3">
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e: any) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Input value={description} onChange={(e: any) => setDescription(e.target.value)} placeholder="e.g. Office supplies" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Amount (USD)</Label>
              <Input type="number" step="0.01" min="0" value={amount} onChange={(e: any) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>Direction</Label>
              <Select value={direction} onChange={(e: any) => setDirection(e.target.value)}>
                <option value="out">Money out (expense)</option>
                <option value="in">Money in (income)</option>
              </Select>
            </div>
          </div>
          <div>
            <Label>Category (optional)</Label>
            <Select value={categoryId} onChange={(e: any) => setCategoryId(e.target.value)}>
              <option value="">— Leave uncategorized (rules will try) —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.class.toLowerCase()})</option>)}
            </Select>
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Input value={notes} onChange={(e: any) => setNotes(e.target.value)} placeholder="optional" />
          </div>
        </div>

        {save.error && <p className="mt-3 text-sm text-red-600">{(save.error as any).message}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!valid || save.isPending}>{save.isPending ? "Saving…" : "Add"}</Button>
        </div>
      </div>
    </div>
  );
}
