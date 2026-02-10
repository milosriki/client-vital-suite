/**
 * Rate Limiting Middleware
 * Per api-patterns/rate-limiting.md: Token bucket pattern
 *
 * Uses in-memory + optional Supabase persistence for rate limiting.
 * Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
 */

import { apiRateLimited } from "./api-response.ts";

interface RateLimitConfig {
  /** Max requests per window */
  limit: number;
  /** Window duration in seconds */
  windowSeconds: number;
  /** Key function: extracts identifier from request */
  keyFn?: (req: Request) => string;
}

// In-memory token bucket (per cold start)
const buckets = new Map<string, { tokens: number; lastRefill: number }>();

/**
 * Check rate limit for a request
 * Per api-patterns/rate-limiting.md: Token bucket (burst allowed, refills over time)
 *
 * @returns null if allowed, Response if rate limited
 */
export function checkRateLimit(
  req: Request,
  config: RateLimitConfig = { limit: 100, windowSeconds: 60 },
): { allowed: boolean; response?: Response; headers: Record<string, string> } {
  const key = config.keyFn
    ? config.keyFn(req)
    : req.headers.get("authorization")?.slice(-8) ||
      req.headers.get("x-forwarded-for") ||
      "anonymous";

  const now = Date.now();
  const bucket = buckets.get(key);
  const refillRate = config.limit / config.windowSeconds; // tokens per second

  if (!bucket) {
    // First request — full bucket minus 1
    buckets.set(key, { tokens: config.limit - 1, lastRefill: now });
    return {
      allowed: true,
      headers: rateLimitHeaders(
        config.limit,
        config.limit - 1,
        config.windowSeconds,
      ),
    };
  }

  // Refill tokens based on elapsed time
  const elapsedSeconds = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(
    config.limit,
    bucket.tokens + elapsedSeconds * refillRate,
  );
  bucket.lastRefill = now;

  if (bucket.tokens < 1) {
    // Rate limited
    const resetIn = Math.ceil((1 - bucket.tokens) / refillRate);
    return {
      allowed: false,
      response: apiRateLimited(resetIn, config.limit, 0),
      headers: rateLimitHeaders(config.limit, 0, resetIn),
    };
  }

  // Consume a token
  bucket.tokens -= 1;
  const remaining = Math.floor(bucket.tokens);

  return {
    allowed: true,
    headers: rateLimitHeaders(config.limit, remaining, config.windowSeconds),
  };
}

function rateLimitHeaders(
  limit: number,
  remaining: number,
  resetSeconds: number,
): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + resetSeconds),
  };
}

/**
 * Pre-configured rate limits per function type
 * Per api-patterns/rate-limiting.md: Different limits for different endpoints
 */
export const RATE_LIMITS = {
  /** Public-facing chat endpoints */
  chat: { limit: 30, windowSeconds: 60 },
  /** Webhook receivers */
  webhook: { limit: 200, windowSeconds: 60 },
  /** Admin/sync operations */
  admin: { limit: 10, windowSeconds: 60 },
  /** Data queries */
  query: { limit: 60, windowSeconds: 60 },
  /** AI-powered endpoints (expensive) */
  ai: { limit: 20, windowSeconds: 60 },
} as const;

/**
 * Cleanup old buckets (call periodically)
 */
export function cleanupBuckets(maxAgeMs = 300000): void {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastRefill > maxAgeMs) {
      buckets.delete(key);
    }
  }
}
