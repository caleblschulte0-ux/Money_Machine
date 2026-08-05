/**
 * Token-bucket rate limiter used for login attempts, API keys, outbound
 * provider calls and per-customer agent invocations.
 *
 * In-memory by default; the interface is small enough that a Redis-backed
 * implementation can be dropped in without touching call sites.
 */
export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly retryAfterMs: number;
}

export interface RateLimitRule {
  readonly capacity: number;
  readonly refillPerSecond: number;
}

export interface RateLimiter {
  consume(key: string, cost?: number): RateLimitDecision;
  reset(key: string): void;
}

interface Bucket {
  tokens: number;
  updatedAt: number;
}

export class MemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly rule: RateLimitRule,
    private readonly now: () => number = () => Date.now(),
  ) {}

  consume(key: string, cost = 1): RateLimitDecision {
    const now = this.now();
    const bucket = this.buckets.get(key) ?? { tokens: this.rule.capacity, updatedAt: now };
    const elapsedSeconds = Math.max(0, (now - bucket.updatedAt) / 1000);
    bucket.tokens = Math.min(
      this.rule.capacity,
      bucket.tokens + elapsedSeconds * this.rule.refillPerSecond,
    );
    bucket.updatedAt = now;

    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      this.buckets.set(key, bucket);
      return { allowed: true, remaining: Math.floor(bucket.tokens), retryAfterMs: 0 };
    }

    this.buckets.set(key, bucket);
    const deficit = cost - bucket.tokens;
    return {
      allowed: false,
      remaining: Math.floor(bucket.tokens),
      retryAfterMs: Math.ceil((deficit / this.rule.refillPerSecond) * 1000),
    };
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }
}

/** Defaults chosen to be restrictive; call sites may override. */
export const RATE_LIMITS = {
  login: { capacity: 5, refillPerSecond: 5 / 900 } satisfies RateLimitRule, // 5 per 15 min
  passwordReset: { capacity: 3, refillPerSecond: 3 / 3600 } satisfies RateLimitRule,
  apiDefault: { capacity: 120, refillPerSecond: 2 } satisfies RateLimitRule,
  agentRunPerCustomer: { capacity: 20, refillPerSecond: 20 / 3600 } satisfies RateLimitRule,
  outboundEmailPerContact: { capacity: 3, refillPerSecond: 3 / 86400 } satisfies RateLimitRule,
} as const;
