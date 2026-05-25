"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client";
import { Button, Card, Input } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true); setError(null);
    try {
      await api("/auth/register", { method: "POST", body: JSON.stringify(form) });
      router.push("/dashboard");
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <h1 className="text-xl font-semibold">Create your account</h1>
        <div className="mt-4 space-y-3">
          <Input placeholder="Business name (optional)" value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} />
          <Input type="email" placeholder="you@business.com" value={form.email} onChange={(e: any) => setForm({ ...form, email: e.target.value })} />
          <Input type="password" placeholder="Password (min 10 chars)" value={form.password} onChange={(e: any) => setForm({ ...form, password: e.target.value })} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button className="w-full" disabled={loading} onClick={submit}>{loading ? "Creating…" : "Create account"}</Button>
        </div>
        <p className="mt-4 text-center text-sm text-gray-500">Have an account? <Link className="text-brand" href="/login">Sign in</Link></p>
      </Card>
    </div>
  );
}
