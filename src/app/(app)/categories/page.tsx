"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { Card, Input, Button, Select, Label, Skeleton } from "@/components/ui";

// Manage the chart of accounts: add top-level categories or subcategories
// (e.g. Shopping under Expense), and delete user-created ones. Built-in (system)
// categories can't be deleted.
const CLASSES = ["REVENUE", "EXPENSE", "ASSET", "LIABILITY", "EQUITY"] as const;
const CLASS_LABEL: Record<string, string> = { REVENUE: "Revenue", EXPENSE: "Expense", ASSET: "Asset", LIABILITY: "Liability", EQUITY: "Equity" };

function Row({ c, onDelete, deleting, sub }: { c: any; onDelete: (c: any) => void; deleting: boolean; sub?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-sm">
      <span className={sub ? "text-gray-600 dark:text-gray-400" : ""}>{sub ? "↳ " : ""}{c.name}</span>
      {c.system ? (
        <span className="text-xs text-gray-400">built-in</span>
      ) : (
        <button onClick={() => onDelete(c)} disabled={deleting} className="text-xs text-red-600 hover:underline disabled:opacity-50">Delete</button>
      )}
    </div>
  );
}

export default function CategoriesPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [klass, setKlass] = useState("EXPENSE");
  const [parentId, setParentId] = useState("");

  const q = useQuery({ queryKey: ["categories"], queryFn: () => api<any>("/categories") });
  const items: any[] = q.data?.items ?? [];
  const topLevel = items.filter((i) => !i.parentId);
  const childrenOf = (id: string) => items.filter((i) => i.parentId === id);
  const parentClass = parentId ? items.find((i) => i.id === parentId)?.class : null;

  const invalidate = () => ["categories", "txns", "pnl", "uncat", "dashboard"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  const create = useMutation({
    mutationFn: () => api("/categories", { method: "POST", body: JSON.stringify(parentId ? { name: name.trim(), parentId } : { name: name.trim(), class: klass }) }),
    onSuccess: () => { invalidate(); setName(""); },
  });
  const del = useMutation({
    mutationFn: (id: string) => api(`/categories/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const canAdd = name.trim().length > 0 && !create.isPending;
  const remove = (c: any) => {
    if (window.confirm(`Delete "${c.name}"? Any subcategories are removed too, and its transactions become uncategorized.`)) del.mutate(c.id);
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Categories</h1>

      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Add a category</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <Label>Name</Label>
            <Input value={name} onChange={(e: any) => setName(e.target.value)} placeholder="e.g. Shopping" onKeyDown={(e: any) => { if (e.key === "Enter" && canAdd) create.mutate(); }} />
          </div>
          <div>
            <Label>Parent (optional)</Label>
            <Select value={parentId} onChange={(e: any) => setParentId(e.target.value)}>
              <option value="">— None (top-level) —</option>
              {topLevel.map((p) => <option key={p.id} value={p.id}>{p.name} ({CLASS_LABEL[p.class]})</option>)}
            </Select>
          </div>
          <div>
            <Label>Type</Label>
            <Select value={parentId ? parentClass : klass} onChange={(e: any) => setKlass(e.target.value)} disabled={!!parentId}>
              {CLASSES.map((c) => <option key={c} value={c}>{CLASS_LABEL[c]}</option>)}
            </Select>
          </div>
          <Button onClick={() => create.mutate()} disabled={!canAdd}>{create.isPending ? "Adding…" : "Add"}</Button>
        </div>
        {create.error && <p className="mt-2 text-sm text-red-600">{(create.error as any).message}</p>}
        {del.error && <p className="mt-2 text-sm text-red-600">{(del.error as any).message}</p>}
        <p className="mt-2 text-xs text-gray-400">Pick a <span className="font-medium">Parent</span> to make a subcategory (it inherits the parent’s type). Leave it “None” for a top-level category.</p>
      </Card>

      {q.isLoading ? <Skeleton className="h-64" /> : (
        <div className="grid gap-4 sm:grid-cols-2">
          {CLASSES.map((c) => {
            const tops = topLevel.filter((i) => i.class === c);
            if (tops.length === 0) return null;
            return (
              <Card key={c}>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">{CLASS_LABEL[c]}</h3>
                <ul className="space-y-1">
                  {tops.map((i) => (
                    <li key={i.id}>
                      <Row c={i} onDelete={remove} deleting={del.isPending} />
                      {childrenOf(i.id).length > 0 && (
                        <ul className="ml-3 mt-1 space-y-1 border-l border-gray-200 pl-3 dark:border-gray-800">
                          {childrenOf(i.id).map((ch) => <li key={ch.id}><Row c={ch} onDelete={remove} deleting={del.isPending} sub /></li>)}
                        </ul>
                      )}
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
