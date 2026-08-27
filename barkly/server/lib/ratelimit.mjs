/**
 * Abuse protection: a token bucket per caller, plus daily ceilings.
 *
 * The bucket smooths bursts (a child tapping the mic repeatedly is fine); the
 * daily caps are the actual protection against a leaked build draining the
 * account. Identity is the device id when the app sends one, IP otherwise, so
 * one abusive device does not rate-limit a whole school's shared NAT.
 *
 * In-memory on purpose: one small proxy, no dependency on Redis to boot. The
 * `store` seam is where a shared backend goes when there is more than one
 * instance — see README "Scaling".
 */

export function createRateLimiter({ rpm, burst, now = () => Date.now() }) {
  const refillPerMs = rpm / 60_000;
  const buckets = new Map(); // id -> { tokens, at }

  return {
    /** @returns {{ ok: boolean, retryAfterMs: number }} */
    take(id) {
      const t = now();
      const b = buckets.get(id) || { tokens: burst, at: t };
      b.tokens = Math.min(burst, b.tokens + (t - b.at) * refillPerMs);
      b.at = t;
      if (b.tokens < 1) {
        buckets.set(id, b);
        return { ok: false, retryAfterMs: Math.ceil((1 - b.tokens) / refillPerMs) };
      }
      b.tokens -= 1;
      buckets.set(id, b);
      return { ok: true, retryAfterMs: 0 };
    },
    /** Drop buckets that have fully refilled — keeps memory flat over months. */
    sweep() {
      const t = now();
      for (const [id, b] of buckets) {
        if (b.tokens + (t - b.at) * refillPerMs >= burst) buckets.delete(id);
      }
    },
    get size() {
      return buckets.size;
    },
  };
}
