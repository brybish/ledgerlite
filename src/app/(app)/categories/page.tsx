"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { Card, Input, Button, Select, Label, Skeleton } from "@/components/ui";

// Manage the chart of accounts. Users can add their own categories (e.g.
// Expense → Shopping); they immediately show up in every category dropdown.
const CLASSES = ["REVENUE", "EXPENSE", "ASSET", "LIABILITY", "EQUITY"] as const;
const CLASS_LABEL: Record<string, string> = { REVENUE: "Revenue", EXPENSE: "Expense", ASSET: "Asset", LIABILITY: "Liability", EQUITY: "Equity" };

export default function CategoriesPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [klass, setKlass] = useState("EXPENSE");

  const q = useQuery({ queryKey: ["categories"], queryFn: () => api<any>("/categories") });
  const items: any[] = q.data?.items ?? [];

  const create = useMutation({
    mutationFn: () => api("/categories", { method: "POST", body: JSON.stringify({ name: name.trim(), class: klass }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categories"] }); setName(""); },
  });

  const canAdd = name.trim().length > 0 && !create.isPending;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Categories</h1>

      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Add a category</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e: any) => setName(e.target.value)} placeholder="e.g. Shopping"
              onKeyDown={(e: any) => { if (e.key === "Enter" && canAdd) create.mutate(); }} />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={klass} onChange={(e: any) => setKlass(e.target.value)}>
              {CLASSES.map((c) => <option key={c} value={c}>{CLASS_LABEL[c]}</option>)}
            </Select>
          </div>
          <Button onClick={() => create.mutate()} disabled={!canAdd}>{create.isPending ? "Adding…" : "Add category"}</Button>
        </div>
        {create.error && <p className="mt-2 text-sm text-red-600">{(create.error as any).message}</p>}
        <p className="mt-2 text-xs text-gray-400">Tip: pick <span className="font-medium">Expense</span> for spending categories like Shopping, and <span className="font-medium">Revenue</span> for income.</p>
      </Card>

      {q.isLoading ? <Skeleton className="h-64" /> : (
        <div className="grid gap-4 sm:grid-cols-2">
          {CLASSES.map((c) => {
            const inClass = items.filter((i) => i.class === c);
            if (inClass.length === 0) return null;
            return (
              <Card key={c}>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">{CLASS_LABEL[c]}</h3>
                <ul className="space-y-1">
                  {inClass.map((i) => (
                    <li key={i.id} className="flex items-center justify-between text-sm">
                      <span>{i.name}</span>
                      {i.system && <span className="text-xs text-gray-400">built-in</span>}
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
