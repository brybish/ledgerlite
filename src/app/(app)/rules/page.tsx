"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client";
import { Button, Card, Input, Select, Label, Skeleton } from "@/components/ui";

// Categorization rules — full CRUD plus a "Run rules now" action that applies
// enabled rules to any uncategorized transactions (first match by priority wins).
const FIELDS = ["MERCHANT", "DESCRIPTION", "AMOUNT"] as const;
const OPS = ["CONTAINS", "EQUALS", "STARTS_WITH", "GT", "LT"] as const;
const OP_LABEL: Record<string, string> = { CONTAINS: "contains", EQUALS: "equals", STARTS_WITH: "starts with", GT: "greater than", LT: "less than" };

export default function RulesPage() {
  const qc = useQueryClient();
  const rules = useQuery({ queryKey: ["rules"], queryFn: () => api<any>("/rules") });
  const cats = useQuery({ queryKey: ["categories"], queryFn: () => api<any>("/categories") });

  const [form, setForm] = useState<string | null>(null); // "new" | rule id | null
  const [runMsg, setRunMsg] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["rules"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
  };

  const save = useMutation({
    mutationFn: (v: { id?: string; body: any }) =>
      api(`/rules${v.id ? `/${v.id}` : ""}`, { method: v.id ? "PATCH" : "POST", body: JSON.stringify(v.body) }),
    onSuccess: () => { invalidate(); setForm(null); },
  });
  const del = useMutation({
    mutationFn: (id: string) => api(`/rules/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
  const toggle = useMutation({
    mutationFn: (v: { id: string; enabled: boolean }) =>
      api(`/rules/${v.id}`, { method: "PATCH", body: JSON.stringify({ enabled: v.enabled }) }),
    onSuccess: invalidate,
  });
  const run = useMutation({
    mutationFn: () => api<{ updated: number }>("/rules/run", { method: "POST" }),
    onSuccess: (r) => { setRunMsg(`Applied rules to ${r.updated} transaction${r.updated === 1 ? "" : "s"}.`); invalidate(); },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Categorization Rules</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => { setRunMsg(null); run.mutate(); }} disabled={run.isPending}>
            {run.isPending ? "Running…" : "Run rules now"}
          </Button>
          {form !== "new" && <Button onClick={() => { save.reset(); setForm("new"); }}>Add rule</Button>}
        </div>
      </div>

      {runMsg && <p className="text-sm text-green-600">{runMsg}</p>}

      <Card>
        {form === "new" && (
          <RuleForm
            categories={cats.data?.items ?? []}
            onCancel={() => setForm(null)}
            onSubmit={(body: any) => save.mutate({ body })}
            pending={save.isPending}
            error={save.error?.message}
          />
        )}

        {rules.isLoading ? (
          <Skeleton className="h-24" />
        ) : (rules.data?.items?.length ?? 0) === 0 && form !== "new" ? (
          <p className="py-4 text-sm text-gray-500">No rules yet. Add one to auto-categorize transactions on import.</p>
        ) : (
          rules.data?.items.map((r: any) =>
            form === r.id ? (
              <RuleForm
                key={r.id}
                initial={r}
                categories={cats.data?.items ?? []}
                onCancel={() => setForm(null)}
                onSubmit={(body: any) => save.mutate({ id: r.id, body })}
                pending={save.isPending}
                error={save.error?.message}
              />
            ) : (
              <div key={r.id} className="flex items-center justify-between border-b border-gray-100 py-2.5 text-sm last:border-0 dark:border-gray-800">
                <div className={r.enabled ? "" : "opacity-50"}>
                  <span className="font-medium">{r.name}</span>
                  <span className="ml-2 text-gray-500">
                    if {r.field.toLowerCase()} {OP_LABEL[r.op]} &ldquo;{r.value}&rdquo; → {r.category?.name}
                  </span>
                  <span className="ml-2 text-gray-400">p{r.priority}</span>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-gray-500">
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      onChange={(e) => toggle.mutate({ id: r.id, enabled: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    {r.enabled ? "On" : "Off"}
                  </label>
                  <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => { save.reset(); setForm(r.id); }}>Edit</Button>
                  <Button
                    variant="ghost"
                    className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                    onClick={() => { if (confirm(`Delete rule "${r.name}"?`)) del.mutate(r.id); }}
                    disabled={del.isPending && del.variables === r.id}
                  >
                    {del.isPending && del.variables === r.id ? "…" : "Delete"}
                  </Button>
                </div>
              </div>
            )
          )
        )}
      </Card>
    </div>
  );
}

function RuleForm({ initial, categories, onSubmit, onCancel, pending, error }: any) {
  const [name, setName] = useState(initial?.name ?? "");
  const [field, setField] = useState(initial?.field ?? "MERCHANT");
  const [op, setOp] = useState(initial?.op ?? "CONTAINS");
  const [value, setValue] = useState(initial?.value ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [priority, setPriority] = useState(initial?.priority != null ? String(initial.priority) : "100");

  const isAmount = field === "AMOUNT";
  const submit = () => {
    const body: any = {
      name: name.trim(),
      field,
      op,
      value: value.trim(),
      categoryId,
      priority: parseInt(priority || "100", 10),
    };
    onSubmit(body);
  };

  return (
    <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/40">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Rule name</Label>
          <Input value={name} onChange={(e: any) => setName(e.target.value)} placeholder="e.g. Shell → Fuel" />
        </div>
        <div>
          <Label>Match field</Label>
          <Select value={field} onChange={(e: any) => { setField(e.target.value); if (e.target.value === "AMOUNT" && (op === "CONTAINS" || op === "STARTS_WITH")) setOp("EQUALS"); }}>
            {FIELDS.map((f) => <option key={f} value={f}>{f.charAt(0) + f.slice(1).toLowerCase()}</option>)}
          </Select>
        </div>
        <div>
          <Label>Condition</Label>
          <Select value={op} onChange={(e: any) => setOp(e.target.value)}>
            {OPS.filter((o) => !(isAmount && (o === "CONTAINS" || o === "STARTS_WITH"))).map((o) => (
              <option key={o} value={o}>{OP_LABEL[o]}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>{isAmount ? "Amount (USD)" : "Text to match"}</Label>
          <Input value={value} onChange={(e: any) => setValue(e.target.value)} placeholder={isAmount ? "e.g. 50.00" : "e.g. SHELL"} />
        </div>
        <div>
          <Label>Assign category</Label>
          <Select value={categoryId} onChange={(e: any) => setCategoryId(e.target.value)}>
            <option value="" disabled>Select a category…</option>
            {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.class.toLowerCase()})</option>)}
          </Select>
        </div>
        <div>
          <Label>Priority (lower runs first)</Label>
          <Input type="number" value={priority} onChange={(e: any) => setPriority(e.target.value)} />
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex gap-2">
        <Button onClick={submit} disabled={pending || !categoryId}>{pending ? "Saving…" : initial ? "Save changes" : "Add rule"}</Button>
        <Button variant="outline" onClick={onCancel} disabled={pending}>Cancel</Button>
      </div>
    </div>
  );
}
