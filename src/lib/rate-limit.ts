// Minimal in-memory fixed-window rate limiter. Good enough for a single
// instance / local dev. For multi-instance production, swap the Map for Redis
// (e.g. @upstash/ratelimit) — the interface stays the same.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= limit) return false;
  b.count++;
  return true;
}
