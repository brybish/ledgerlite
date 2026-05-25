"use client";
// Thin typed fetch wrapper. Credentials are included so the httpOnly session
// cookie rides along automatically.
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json();
}
export const fmtUSD = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
