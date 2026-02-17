const bucket = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  maxRequests = 8,
  windowMs = 60_000
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entries = bucket.get(key) ?? [];
  const fresh = entries.filter((ts) => now - ts < windowMs);

  if (fresh.length >= maxRequests) {
    const oldest = fresh[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    bucket.set(key, fresh);
    return { allowed: false, retryAfterSec };
  }

  fresh.push(now);
  bucket.set(key, fresh);
  return { allowed: true, retryAfterSec: 0 };
}
