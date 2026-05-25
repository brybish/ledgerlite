"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client";
import { Button, Card, Input } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true); setError(null);
    try {
      await api("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      router.push("/dashboard");
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <h1 className="text-xl font-semibold">Sign in to LedgerLite</h1>
        <div className="mt-4 space-y-3">
          <Input type="email" placeholder="you@business.com" value={email} onChange={(e: any) => setEmail(e.target.value)} />
          <Input type="password" placeholder="Password" value={password} onChange={(e: any) => setPassword(e.target.value)} onKeyDown={(e: any) => e.key === "Enter" && submit()} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button className="w-full" disabled={loading} onClick={submit}>{loading ? "Signing in…" : "Sign in"}</Button>
        </div>
        <p className="mt-4 text-center text-sm text-gray-500">No account? <Link className="text-brand" href="/register">Create one</Link></p>
      </Card>
    </div>
  );
}
