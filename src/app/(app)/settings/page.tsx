"use client";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, fmtUSD } from "@/lib/client";
import { Button, Card, Input, Label, Skeleton } from "@/components/ui";
import { PlaidLinkButton } from "@/components/PlaidLinkButton";

export default function SettingsPage() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => api<any>("/auth/me") });
  const banks = useQuery({ queryKey: ["institutions"], queryFn: () => api<any>("/institutions") });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <ProfileCard me={me} onSaved={() => qc.invalidateQueries({ queryKey: ["me"] })} />
      <PasswordCard />
      <BanksCard banks={banks} onChanged={() => { qc.invalidateQueries({ queryKey: ["institutions"] }); qc.invalidateQueries({ queryKey: ["transactions"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); }} />
    </div>
  );
}

function ProfileCard({ me, onSaved }: any) {
  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const nameVal = name ?? me.data?.name ?? "";
  const emailVal = email ?? me.data?.email ?? "";

  const save = useMutation({
    mutationFn: () => api("/auth/profile", { method: "PATCH", body: JSON.stringify({ name: nameVal.trim(), email: emailVal.trim() }) }),
    onSuccess: () => { onSaved(); setName(null); setEmail(null); },
  });

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Profile</h2>
      {me.isLoading ? <Skeleton className="h-20" /> : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>Name</Label>
            <Input value={nameVal} onChange={(e: any) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={emailVal} onChange={(e: any) => setEmail(e.target.value)} />
          </div>
          <div className="sm:col-span-2 flex items-center gap-3">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save profile"}</Button>
            <span className="text-xs text-gray-400">Role: {me.data?.role}</span>
            {save.isSuccess && <span className="text-sm text-green-600">Saved.</span>}
            {save.error && <span className="text-sm text-red-600">{(save.error as any).message}</span>}
          </div>
        </div>
      )}
    </Card>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localErr, setLocalErr] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => api("/auth/password", { method: "POST", body: JSON.stringify({ currentPassword: current, newPassword: next }) }),
    onSuccess: () => { setCurrent(""); setNext(""); setConfirm(""); setLocalErr(null); },
  });

  const submit = () => {
    setLocalErr(null);
    if (next.length < 8) return setLocalErr("New password must be at least 8 characters.");
    if (next !== confirm) return setLocalErr("New passwords don't match.");
    save.mutate();
  };

  return (
    <Card>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Change password</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <Label>Current password</Label>
          <Input type="password" value={current} onChange={(e: any) => setCurrent(e.target.value)} />
        </div>
        <div>
          <Label>New password</Label>
          <Input type="password" value={next} onChange={(e: any) => setNext(e.target.value)} />
        </div>
        <div>
          <Label>Confirm new password</Label>
          <Input type="password" value={confirm} onChange={(e: any) => setConfirm(e.target.value)} />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={submit} disabled={save.isPending || !current || !next}>{save.isPending ? "Updating…" : "Update password"}</Button>
        {save.isSuccess && <span className="text-sm text-green-600">Password updated.</span>}
        {(localErr || save.error) && <span className="text-sm text-red-600">{localErr ?? (save.error as any).message}</span>}
      </div>
    </Card>
  );
}

function BanksCard({ banks, onChanged }: any) {
  const sync = useMutation({
    mutationFn: (institutionId: string) => api<{ added: number; modified: number; removed: number }>("/plaid/sync", { method: "POST", body: JSON.stringify({ institutionId }) }),
    onSuccess: onChanged,
  });

  const items = banks.data?.items ?? [];

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Connected banks</h2>
        <PlaidLinkButton onLinked={onChanged} />
      </div>

      {banks.isLoading ? (
        <Skeleton className="h-16" />
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">No banks connected yet. Use “Connect a bank” to link one through Plaid and import transactions.</p>
      ) : (
        items.map((inst: any) => (
          <div key={inst.id} className="border-b border-gray-100 py-3 last:border-0 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <span className="font-medium">{inst.name}</span>
              <Button variant="outline" className="px-2 py-1 text-xs" onClick={() => sync.mutate(inst.id)} disabled={sync.isPending && sync.variables === inst.id}>
                {sync.isPending && sync.variables === inst.id ? "Syncing…" : "Sync now"}
              </Button>
            </div>
            <div className="mt-1 space-y-0.5">
              {inst.bankAccounts.map((a: any) => (
                <div key={a.id} className="flex justify-between text-sm text-gray-500">
                  <span>{a.name}{a.mask ? ` ••${a.mask}` : ""} <span className="text-gray-400">· {a.type.toLowerCase()}</span></span>
                  <span className="tabular-nums">{fmtUSD(a.currentBalance)}</span>
                </div>
              ))}
            </div>
            {sync.isSuccess && sync.variables === inst.id && (
              <p className="mt-1 text-xs text-green-600">Synced: {sync.data.added} added, {sync.data.modified} updated, {sync.data.removed} removed.</p>
            )}
          </div>
        ))
      )}
      {sync.error && <p className="mt-2 text-sm text-red-600">{(sync.error as any).message}</p>}
    </Card>
  );
}
