"use client";
import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { api } from "@/lib/client";
import { Button } from "@/components/ui";

// Drives the Plaid Link flow end to end:
//   1. POST /plaid/link-token to get a short-lived link token
//   2. open() the Plaid Link modal with that token
//   3. on success, POST /plaid/exchange to store the institution + accounts
// The public token never touches our DB raw — the backend exchanges it for an
// access token which is encrypted at rest. Requires PLAID_CLIENT_ID/SECRET in
// .env (free sandbox keys work).
export function PlaidLinkButton({ onLinked, label = "Connect a bank" }: { onLinked?: () => void; label?: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const { linkToken } = await api<{ linkToken: string }>("/plaid/link-token", { method: "POST" });
      setToken(linkToken);
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      setError(
        msg.includes("Internal") || msg.includes("500")
          ? "Plaid isn't configured yet. Add PLAID_CLIENT_ID and PLAID_SECRET to your .env (free sandbox keys at dashboard.plaid.com), then restart."
          : msg
      );
      setLoading(false);
    }
  }, []);

  const onSuccess = useCallback(
    async (publicToken: string) => {
      try {
        await api("/plaid/exchange", { method: "POST", body: JSON.stringify({ publicToken }) });
        onLinked?.();
      } catch (e: any) {
        setError(e?.message ?? "Failed to link account.");
      } finally {
        setToken(null);
        setLoading(false);
      }
    },
    [onLinked]
  );

  const { open, ready } = usePlaidLink({
    token,
    onSuccess,
    onExit: () => { setToken(null); setLoading(false); },
  });

  // Auto-open once the SDK is ready with a fresh token.
  useEffect(() => {
    if (token && ready) open();
  }, [token, ready, open]);

  return (
    <div>
      <Button onClick={start} disabled={loading}>{loading ? "Opening…" : label}</Button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
