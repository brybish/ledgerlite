"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, fmtUSD } from "@/lib/client";
import { Button, Card, Input, Select, Textarea, Label, Skeleton } from "@/components/ui";

// Assets & Liabilities — full CRUD. Money is entered in dollars and converted
// to integer cents at the form boundary (the API and DB store cents). All
// mutations invalidate their query + the balance sheet so figures stay live.
const dollarsToCents = (s: string) => Math.round(parseFloat(s || "0") * 100);
const centsToDollars = (c: number) => (c / 100).toFixed(2);
const ASSET_TYPES = ["Equipment", "Vehicles", "Real Estate", "Cash", "Inventory", "Investments", "Other"];
const LIAB_TYPES = ["Loans Payable", "Credit Cards", "Mortgage", "Line of Credit", "Accounts Payable", "Other"];

export default function AssetsPage() {
  const qc = useQueryClient();
  const assets = useQuery({ queryKey: ["assets"], queryFn: () => api<any>("/assets") });
  const liabs = useQuery({ queryKey: ["liabs"], queryFn: () => api<any>("/liabilities") });

  // null = no form open; "new" = create; otherwise the id being edited.
  const [assetForm, setAssetForm] = useState<string | null>(null);
  const [liabForm, setLiabForm] = useState<string | null>(null);

  const invalidate = (key: string) => {
    qc.invalidateQueries({ queryKey: [key] });
    qc.invalidateQueries({ queryKey: ["balance-sheet"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const saveAsset = useMutation({
    mutationFn: (v: { id?: string; body: any }) =>
      api(`/assets${v.id ? `/${v.id}` : ""}`, { method: v.id ? "PATCH" : "POST", body: JSON.stringify(v.body) }),
    onSuccess: () => { invalidate("assets"); setAssetForm(null); },
  });
  const delAsset = useMutation({
    mutationFn: (id: string) => api(`/assets/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidate("assets"),
  });
  const saveLiab = useMutation({
    mutationFn: (v: { id?: string; body: any }) =>
      api(`/liabilities${v.id ? `/${v.id}` : ""}`, { method: v.id ? "PATCH" : "POST", body: JSON.stringify(v.body) }),
    onSuccess: () => { invalidate("liabs"); setLiabForm(null); },
  });
  const delLiab = useMutation({
    mutationFn: (id: string) => api(`/liabilities/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidate("liabs"),
  });

  const totalAssets = (assets.data?.items ?? []).reduce((s: number, a: any) => s + a.value, 0);
  const totalLiabs = (liabs.data?.items ?? []).reduce((s: number, l: any) => s + l.balance, 0);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Assets &amp; Liabilities</h1>

      {/* ASSETS */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Assets <span className="ml-2 text-gray-400">{fmtUSD(totalAssets)}</span>
          </h2>
          {assetForm !== "new" && <Button onClick={() => setAssetForm("new")}>Add asset</Button>}
        </div>

        {assetForm === "new" && (
          <AssetForm
            onCancel={() => setAssetForm(null)}
            onSubmit={(body: any) => saveAsset.mutate({ body })}
            pending={saveAsset.isPending}
            error={saveAsset.error?.message}
          />
        )}

        {assets.isLoading ? (
          <Skeleton className="h-24" />
        ) : (assets.data?.items?.length ?? 0) === 0 && assetForm !== "new" ? (
          <p className="py-4 text-sm text-gray-500">No assets yet. Add one to include it on your balance sheet.</p>
        ) : (
          assets.data?.items.map((a: any) =>
            assetForm === a.id ? (
              <AssetForm
                key={a.id}
                initial={a}
                onCancel={() => setAssetForm(null)}
                onSubmit={(body: any) => saveAsset.mutate({ id: a.id, body })}
                pending={saveAsset.isPending}
                error={saveAsset.error?.message}
              />
            ) : (
              <Row
                key={a.id}
                title={a.name}
                subtitle={`${a.type}${a.depreciable ? " · depreciable" : ""}`}
                amount={fmtUSD(a.value)}
                onEdit={() => { saveAsset.reset(); setAssetForm(a.id); }}
                onDelete={() => { if (confirm(`Delete asset "${a.name}"?`)) delAsset.mutate(a.id); }}
                deleting={delAsset.isPending && delAsset.variables === a.id}
              />
            )
          )
        )}
      </Card>

      {/* LIABILITIES */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Liabilities <span className="ml-2 text-gray-400">{fmtUSD(totalLiabs)}</span>
          </h2>
          {liabForm !== "new" && <Button onClick={() => setLiabForm("new")}>Add liability</Button>}
        </div>

        {liabForm === "new" && (
          <LiabForm
            onCancel={() => setLiabForm(null)}
            onSubmit={(body: any) => saveLiab.mutate({ body })}
            pending={saveLiab.isPending}
            error={saveLiab.error?.message}
          />
        )}

        {liabs.isLoading ? (
          <Skeleton className="h-24" />
        ) : (liabs.data?.items?.length ?? 0) === 0 && liabForm !== "new" ? (
          <p className="py-4 text-sm text-gray-500">No liabilities yet.</p>
        ) : (
          liabs.data?.items.map((l: any) =>
            liabForm === l.id ? (
              <LiabForm
                key={l.id}
                initial={l}
                onCancel={() => setLiabForm(null)}
                onSubmit={(body: any) => saveLiab.mutate({ id: l.id, body })}
                pending={saveLiab.isPending}
                error={saveLiab.error?.message}
              />
            ) : (
              <Row
                key={l.id}
                title={l.name}
                subtitle={`${l.type}${l.longTerm ? " · long-term" : ""}${l.interestRate != null ? ` · ${l.interestRate}%` : ""}`}
                amount={fmtUSD(l.balance)}
                onEdit={() => { saveLiab.reset(); setLiabForm(l.id); }}
                onDelete={() => { if (confirm(`Delete liability "${l.name}"?`)) delLiab.mutate(l.id); }}
                deleting={delLiab.isPending && delLiab.variables === l.id}
              />
            )
          )
        )}
      </Card>
    </div>
  );
}

function Row({ title, subtitle, amount, onEdit, onDelete, deleting }: any) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 py-2.5 text-sm last:border-0 dark:border-gray-800">
      <div>
        <span className="font-medium">{title}</span>
        <span className="ml-2 text-gray-400">{subtitle}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="tabular-nums">{amount}</span>
        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={onEdit}>Edit</Button>
        <Button variant="ghost" className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950" onClick={onDelete} disabled={deleting}>
          {deleting ? "…" : "Delete"}
        </Button>
      </div>
    </div>
  );
}

function FormShell({ children, onCancel, onSave, pending, error, editing }: any) {
  return (
    <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/40">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex gap-2">
        <Button onClick={onSave} disabled={pending}>{pending ? "Saving…" : editing ? "Save changes" : "Add"}</Button>
        <Button variant="outline" onClick={onCancel} disabled={pending}>Cancel</Button>
      </div>
    </div>
  );
}

function AssetForm({ initial, onSubmit, onCancel, pending, error }: any) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState(initial?.type ?? ASSET_TYPES[0]);
  const [value, setValue] = useState(initial ? centsToDollars(initial.value) : "");
  const [acqDate, setAcqDate] = useState(initial?.acquisitionDate ? initial.acquisitionDate.slice(0, 10) : "");
  const [depreciable, setDepreciable] = useState(initial?.depreciable ?? false);
  const [life, setLife] = useState(initial?.usefulLifeMonths ? String(initial.usefulLifeMonths) : "");
  const [salvage, setSalvage] = useState(initial ? centsToDollars(initial.salvageValue ?? 0) : "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const submit = () => {
    const body: any = {
      name: name.trim(),
      type: type.trim(),
      value: dollarsToCents(value),
      depreciable,
      salvageValue: dollarsToCents(salvage || "0"),
    };
    if (acqDate) body.acquisitionDate = new Date(acqDate + "T00:00:00Z").toISOString();
    if (depreciable && life) body.usefulLifeMonths = parseInt(life, 10);
    if (notes.trim()) body.notes = notes.trim();
    onSubmit(body);
  };

  return (
    <FormShell onCancel={onCancel} onSave={submit} pending={pending} error={error} editing={!!initial}>
      <div className="sm:col-span-2">
        <Label>Name</Label>
        <Input value={name} onChange={(e: any) => setName(e.target.value)} placeholder="e.g. Ford F-250" />
      </div>
      <div>
        <Label>Type</Label>
        <Select value={type} onChange={(e: any) => setType(e.target.value)}>
          {ASSET_TYPES.map((t) => <option key={t}>{t}</option>)}
        </Select>
      </div>
      <div>
        <Label>Current value (USD)</Label>
        <Input type="number" step="0.01" value={value} onChange={(e: any) => setValue(e.target.value)} placeholder="0.00" />
      </div>
      <div>
        <Label>Acquisition date (optional)</Label>
        <Input type="date" value={acqDate} onChange={(e: any) => setAcqDate(e.target.value)} />
      </div>
      <div className="flex items-end pb-1">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={depreciable} onChange={(e) => setDepreciable(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
          Depreciable (straight-line)
        </label>
      </div>
      {depreciable && (
        <>
          <div>
            <Label>Useful life (months)</Label>
            <Input type="number" value={life} onChange={(e: any) => setLife(e.target.value)} placeholder="e.g. 60" />
          </div>
          <div>
            <Label>Salvage value (USD)</Label>
            <Input type="number" step="0.01" value={salvage} onChange={(e: any) => setSalvage(e.target.value)} placeholder="0.00" />
          </div>
        </>
      )}
      <div className="sm:col-span-2">
        <Label>Notes (optional)</Label>
        <Textarea rows={2} value={notes} onChange={(e: any) => setNotes(e.target.value)} />
      </div>
    </FormShell>
  );
}

function LiabForm({ initial, onSubmit, onCancel, pending, error }: any) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState(initial?.type ?? LIAB_TYPES[0]);
  const [balance, setBalance] = useState(initial ? centsToDollars(initial.balance) : "");
  const [longTerm, setLongTerm] = useState(initial?.longTerm ?? false);
  const [rate, setRate] = useState(initial?.interestRate != null ? String(initial.interestRate) : "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const submit = () => {
    const body: any = {
      name: name.trim(),
      type: type.trim(),
      balance: dollarsToCents(balance),
      longTerm,
    };
    if (rate !== "") body.interestRate = parseFloat(rate);
    if (notes.trim()) body.notes = notes.trim();
    onSubmit(body);
  };

  return (
    <FormShell onCancel={onCancel} onSave={submit} pending={pending} error={error} editing={!!initial}>
      <div className="sm:col-span-2">
        <Label>Name</Label>
        <Input value={name} onChange={(e: any) => setName(e.target.value)} placeholder="e.g. Equipment Loan" />
      </div>
      <div>
        <Label>Type</Label>
        <Select value={type} onChange={(e: any) => setType(e.target.value)}>
          {LIAB_TYPES.map((t) => <option key={t}>{t}</option>)}
        </Select>
      </div>
      <div>
        <Label>Outstanding balance (USD)</Label>
        <Input type="number" step="0.01" value={balance} onChange={(e: any) => setBalance(e.target.value)} placeholder="0.00" />
      </div>
      <div>
        <Label>Interest rate % (optional)</Label>
        <Input type="number" step="0.01" value={rate} onChange={(e: any) => setRate(e.target.value)} placeholder="e.g. 6.5" />
      </div>
      <div className="flex items-end pb-1">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={longTerm} onChange={(e) => setLongTerm(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
          Long-term (due &gt; 12 months)
        </label>
      </div>
      <div className="sm:col-span-2">
        <Label>Notes (optional)</Label>
        <Textarea rows={2} value={notes} onChange={(e: any) => setNotes(e.target.value)} />
      </div>
    </FormShell>
  );
}
