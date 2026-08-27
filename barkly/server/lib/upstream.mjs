/**
 * Talking to Anthropic: bounded time, bounded retries, honest failures.
 *
 * Rules:
 * - Every attempt has a hard deadline (AbortController). A hung socket must
 *   never hold a child staring at a silent dog.
 * - Retry only what is worth retrying: network errors, 408/429, and 5xx.
 *   A 400 is our bug and retrying it just spends money twice.
 * - Respect `retry-after` when the server sends one; otherwise exponential
 *   backoff with jitter so a thousand devices do not resynchronise.
 * - The whole call is also bounded by an overall deadline, so retries cannot
 *   stack into a 90-second wait.
 */

const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 504, 529]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function backoffMs(attempt, base, rng = Math.random) {
  const exp = base * 2 ** attempt;
  return Math.round(exp * (0.5 + rng() * 0.5)); // full-ish jitter
}

function retryAfterMs(headers) {
  const raw = headers?.get?.('retry-after');
  if (!raw) return null;
  const secs = Number(raw);
  if (Number.isFinite(secs)) return Math.min(secs * 1000, 10_000);
  const at = Date.parse(raw);
  return Number.isFinite(at) ? Math.max(0, Math.min(at - Date.now(), 10_000)) : null;
}

/**
 * @returns {{ status: number, text: string, attempts: number, retried: boolean }}
 */
export async function callUpstream({
  url,
  headers,
  body,
  timeoutMs,
  retries,
  retryBaseMs,
  overallDeadlineMs = timeoutMs * (retries + 1) + retryBaseMs * 4,
  fetchImpl = fetch,
  rng = Math.random,
  onRetry = () => {},
}) {
  const startedAt = Date.now();
  let attempt = 0;
  let lastError = null;

  while (attempt <= retries) {
    const remaining = overallDeadlineMs - (Date.now() - startedAt);
    if (remaining <= 0) break;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs, remaining));
    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });
      clearTimeout(timer);
      const text = await res.text();

      if (!RETRYABLE.has(res.status) || attempt === retries) {
        return { status: res.status, text, attempts: attempt + 1, retried: attempt > 0 };
      }
      const wait = retryAfterMs(res.headers) ?? backoffMs(attempt, retryBaseMs, rng);
      onRetry({ attempt: attempt + 1, status: res.status, waitMs: wait });
      await sleep(Math.min(wait, Math.max(0, overallDeadlineMs - (Date.now() - startedAt))));
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      const aborted = err?.name === 'AbortError';
      if (attempt === retries) break;
      const wait = backoffMs(attempt, retryBaseMs, rng);
      onRetry({ attempt: attempt + 1, status: aborted ? 'timeout' : 'network', waitMs: wait });
      await sleep(Math.min(wait, Math.max(0, overallDeadlineMs - (Date.now() - startedAt))));
    }
    attempt += 1;
  }

  const timedOut = lastError?.name === 'AbortError';
  return {
    status: timedOut ? 504 : 502,
    text: JSON.stringify({
      type: 'error',
      error: {
        type: timedOut ? 'upstream_timeout' : 'upstream_unreachable',
        message: timedOut ? 'upstream timed out' : 'upstream unreachable',
      },
    }),
    attempts: attempt + 1,
    retried: attempt > 0,
  };
}
