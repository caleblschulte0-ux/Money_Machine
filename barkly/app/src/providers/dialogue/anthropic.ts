/**
 * Anthropic (Claude) dialogue adapter.
 *
 * SECRETS: EXPO_PUBLIC_* vars are bundled into the app binary and are NOT
 * secret. Calling Anthropic directly from the device with an API key is a
 * DEVELOPMENT convenience only. Production points
 * EXPO_PUBLIC_BARKLY_BACKEND_URL at the proxy in barkly/server, which holds
 * the real key and decides model, size, rate and budget on its own side.
 *
 * Written against `fetch` rather than the vendor SDK, deliberately:
 *
 * - The SDK drags Node builtins into a React Native bundle (which is why
 *   metro.config.js had to shim `node:fs`).
 * - We need the response HEADERS, not just the body: the proxy sets
 *   `x-barkly-fallback` to say "stop retrying me, use the offline dog".
 * - Timeout and retry policy belong to us. A child watching a silent dog is
 *   a product failure at 8 seconds, whatever a default says.
 *
 * One endpoint, one shape. Everything it can throw is a DialogueError, so the
 * layer above always has a line for Barkly to say.
 */

import { DialogueError, failureForStatus } from '../errors';
import { DialogueProvider, DialogueRequest } from '../types';

export interface AnthropicDialogueConfig {
  apiKey?: string;
  /** Backend proxy URL for production; defaults to Anthropic's API for dev. */
  baseURL?: string;
  model?: string;
  /** Sent as x-barkly-app-token so a stranger cannot curl the proxy. */
  appToken?: string;
  /** Stable per-install id; the proxy rate-limits and budgets on it. */
  deviceId?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

const DEFAULT_MODEL = 'claude-opus-5';
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 1;
const ANTHROPIC_VERSION = '2023-06-01';

/**
 * Statuses where trying the same request again is reasonable.
 * 429 is deliberately NOT here: the proxy just said slow down, and a 400ms
 * backoff is not slowing down.
 */
const RETRYABLE = new Set([408, 500, 502, 503, 504, 529]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

export function createAnthropicDialogue(config: AnthropicDialogueConfig): DialogueProvider {
  const { apiKey, baseURL, appToken } = config;
  const model = config.model || DEFAULT_MODEL;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = config.maxRetries ?? DEFAULT_RETRIES;
  const available = Boolean(apiKey || baseURL);
  const endpoint = `${(baseURL || 'https://api.anthropic.com').replace(/\/+$/, '')}/v1/messages`;

  function headers(): Record<string, string> {
    const h: Record<string, string> = {
      'content-type': 'application/json',
      'anthropic-version': ANTHROPIC_VERSION,
    };
    // Only a DEV build carries a key; a proxy build sends none at all.
    if (apiKey && !baseURL) {
      h['x-api-key'] = apiKey;
      h['anthropic-dangerous-direct-browser-access'] = 'true';
    }
    if (appToken) h['x-barkly-app-token'] = appToken;
    // Read per request, not at construction: the id is loaded from storage
    // during boot, which finishes after the providers are built.
    const device = config.deviceId;
    if (device) h['x-barkly-device'] = device;
    return h;
  }

  async function attempt(body: string): Promise<{ text: string; fallback: boolean }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: headers(),
        body,
        signal: controller.signal,
      });
    } catch (cause) {
      const aborted = (cause as { name?: string })?.name === 'AbortError';
      throw new DialogueError(aborted ? 'timeout' : 'offline', { cause });
    } finally {
      clearTimeout(timer);
    }

    const askedToFallback = res.headers.get('x-barkly-fallback') === '1';
    if (!res.ok) {
      // The proxy's own hint wins over the status heuristic: it knows the
      // difference between "busy" and "the day's budget is gone".
      throw new DialogueError(failureForStatus(res.status), {
        status: res.status,
        forceFallback: askedToFallback,
      });
    }

    let payload: { content?: AnthropicContentBlock[] };
    try {
      payload = await res.json();
    } catch (cause) {
      throw new DialogueError('malformed', { cause });
    }

    let text = '';
    for (const block of payload.content ?? []) {
      if (block.type === 'text' && typeof block.text === 'string') text += block.text;
    }
    if (!text.trim()) throw new DialogueError('malformed');
    return { text, fallback: askedToFallback };
  }

  return {
    // Honest even when nothing is configured: Settings shows this string, and
    // "anthropic:claude-opus-5" in a build with no key is a lie a reader acts on.
    name: !available
      ? 'no model configured'
      : baseURL
        ? `barkly-backend:${model}`
        : `anthropic:${model}`,
    isAvailable: () => available,

    async complete(req: DialogueRequest): Promise<string> {
      const body = JSON.stringify({
        model,
        // Barkly speaks in 1-3 short sentences; the JSON envelope is small.
        max_tokens: 600,
        // Low effort keeps latency down for casual chat.
        output_config: { effort: 'low' },
        system: req.systemPrompt,
        messages: [
          ...req.turns.map((t) => ({
            role: t.role === 'user' ? 'user' : 'assistant',
            content: t.text,
          })),
          { role: 'user', content: req.userText },
        ],
      });

      let lastError: DialogueError | null = null;
      for (let i = 0; i <= maxRetries; i++) {
        try {
          const { text } = await attempt(body);
          return text;
        } catch (err) {
          const e = err instanceof DialogueError ? err : new DialogueError('unknown', { cause: err });
          lastError = e;
          const worthRetrying = e.recoverable && (e.status === undefined || RETRYABLE.has(e.status));
          if (i === maxRetries || !worthRetrying) break;
          await sleep(400 * 2 ** i);
        }
      }
      throw lastError ?? new DialogueError('unknown');
    },
  };
}
