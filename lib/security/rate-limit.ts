import "server-only";

import { createHash } from "node:crypto";
import { getRateLimitClientAddress } from "./rate-limit-ip.mjs";

type RateLimitEntry = { count: number; resetAt: number };
type RateLimitResult = { allowed: boolean; retryAfterSeconds: number; remaining: number };

const buckets = new Map<string, RateLimitEntry>();
let lastCleanup = 0;

function fingerprint(request: Request) {
  const address = getRateLimitClientAddress(request);
  return createHash("sha256").update(address).digest("base64url").slice(0, 20);
}

export { getRateLimitClientAddress };

function cleanup(now: number) {
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [key, value] of buckets) {
    if (value.resetAt <= now) buckets.delete(key);
  }
}

export function checkRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  cleanup(now);
  const key = `${scope}:${fingerprint(request)}`;
  const current = buckets.get(key);
  const entry = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + windowMs }
    : current;
  entry.count += 1;
  buckets.set(key, entry);
  return {
    allowed: entry.count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1_000)),
    remaining: Math.max(0, limit - entry.count),
  };
}

export function resetRateLimit(request: Request, scope: string) {
  buckets.delete(`${scope}:${fingerprint(request)}`);
}
