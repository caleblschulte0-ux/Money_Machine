/**
 * Backend tests. `node --test` — no dependencies, no network, no spend.
 *
 * The fake upstream lets us assert the things that only show up in production
 * otherwise: what happens on a 529, on a timeout, when a leaked build asks for
 * a model we do not allow, and when the day's budget is gone.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { loadConfig, ConfigError } from '../lib/config.mjs';
import { createLedger, usdFor } from '../lib/cost.mjs';
import { createLogger, FIELDS, hashId, scrub } from '../lib/logging.mjs';
import { createRateLimiter } from '../lib/ratelimit.mjs';
import { backoffMs, callUpstream } from '../lib/upstream.mjs';
import { validateMessagesRequest, ValidationError } from '../lib/validate.mjs';
import { createHandler } from '../lib/server.mjs';

const BASE_ENV = {
  BARKLY_ENV: 'development',
  ANTHROPIC_API_KEY: 'sk-test',
  BARKLY_RETRY_BASE_MS: '1',
  BARKLY_UPSTREAM_TIMEOUT_MS: '50',
};

const okReply = (text = '{"speech":"woof"}') =>
  JSON.stringify({
    type: 'message',
    content: [{ type: 'text', text }],
    usage: { input_tokens: 100, output_tokens: 20 },
  });

/** Minimal req/res doubles — enough for the handler, nothing more. */
function fakeReq({ method = 'POST', url = '/v1/messages', headers = {}, body = '' } = {}) {
  const listeners = {};
  const req = {
    method,
    url,
    headers,
    socket: { remoteAddress: '10.0.0.1' },
    on(evt, fn) {
      listeners[evt] = fn;
      return req;
    },
    destroy() {},
  };
  queueMicrotask(() => {
    if (body && listeners.data) listeners.data(Buffer.from(body));
    listeners.end?.();
  });
  return req;
}

function fakeRes() {
  return {
    headersSent: false,
    status: 0,
    headers: {},
    body: '',
    writeHead(status, headers) {
      this.status = status;
      this.headers = { ...this.headers, ...headers };
      this.headersSent = true;
    },
    end(payload = '') {
      this.body = String(payload);
      this.done = true;
    },
    json() {
      return JSON.parse(this.body);
    },
  };
}

function harness(overrides = {}, deps = {}) {
  const config = loadConfig({ ...BASE_ENV, ...overrides });
  const logs = [];
  const logger = createLogger({ level: 'debug', sink: (line) => logs.push(JSON.parse(line)) });
  const handler = createHandler(config, { logger, noSweep: true, rng: () => 0.5, ...deps });
  const call = async (reqOpts) => {
    const res = fakeRes();
    await handler(fakeReq(reqOpts), res);
    return res;
  };
  return { config, handler, logs, call };
}

const validBody = JSON.stringify({
  model: 'claude-opus-5',
  max_tokens: 600,
  system: 'you are a dog',
  messages: [{ role: 'user', content: 'hi barkly' }],
});

// ------------------------------------------------------------------ config

test('production refuses to boot half-configured', () => {
  assert.throws(() => loadConfig({ BARKLY_ENV: 'production' }), ConfigError);
  assert.throws(
    () => loadConfig({ BARKLY_ENV: 'production', ANTHROPIC_API_KEY: 'k' }),
    /BARKLY_ALLOWED_ORIGINS/,
  );
  assert.throws(
    () =>
      loadConfig({
        BARKLY_ENV: 'production',
        ANTHROPIC_API_KEY: 'k',
        BARKLY_ALLOWED_ORIGINS: 'https://barkly.app',
      }),
    /BARKLY_APP_TOKEN/,
  );
  const good = loadConfig({
    BARKLY_ENV: 'production',
    ANTHROPIC_API_KEY: 'k',
    BARKLY_ALLOWED_ORIGINS: 'https://barkly.app',
    BARKLY_APP_TOKEN: 't',
  });
  assert.equal(good.isProd, true);
});

test('development boots with nothing at all', () => {
  const c = loadConfig({});
  assert.equal(c.env, 'development');
  assert.equal(c.apiKey, '');
});

test('price is null unless the operator sets one — no invented numbers', () => {
  assert.equal(loadConfig(BASE_ENV).pricing, null);
  const priced = loadConfig({
    ...BASE_ENV,
    BARKLY_PRICE_INPUT_PER_MTOK: '3',
    BARKLY_PRICE_OUTPUT_PER_MTOK: '15',
  });
  assert.deepEqual(priced.pricing, { inputPerMTok: 3, outputPerMTok: 15 });
});

// -------------------------------------------------------------- validation

test('rejects a model this deployment does not allow', () => {
  const config = loadConfig(BASE_ENV);
  assert.throws(
    () => validateMessagesRequest(JSON.stringify({ model: 'some-expensive-model', messages: [{ role: 'user', content: 'x' }] }), config),
    ValidationError,
  );
});

test('caps max_tokens at the server ceiling however much the client asks for', () => {
  const config = loadConfig({ ...BASE_ENV, BARKLY_MAX_OUTPUT_TOKENS: '500' });
  const { body } = validateMessagesRequest(
    JSON.stringify({ model: 'claude-opus-5', max_tokens: 64000, messages: [{ role: 'user', content: 'x' }] }),
    config,
  );
  assert.equal(body.max_tokens, 500);
});

test('unknown fields never reach the upstream on our key', () => {
  const config = loadConfig(BASE_ENV);
  const { body } = validateMessagesRequest(
    JSON.stringify({
      model: 'claude-opus-5',
      messages: [{ role: 'user', content: 'x' }],
      tools: [{ name: 'exfiltrate' }],
      metadata: { user_id: 'someone' },
      stream: true,
    }),
    config,
  );
  assert.equal(body.tools, undefined);
  assert.equal(body.metadata, undefined);
  assert.equal(body.stream, undefined);
});

test('rejects oversized conversations before they cost anything', () => {
  const config = loadConfig({ ...BASE_ENV, BARKLY_MAX_MESSAGES: '3' });
  const many = Array.from({ length: 10 }, () => ({ role: 'user', content: 'x' }));
  assert.throws(
    () => validateMessagesRequest(JSON.stringify({ model: 'claude-opus-5', messages: many }), config),
    /too many messages/,
  );
});

// ------------------------------------------------------------- rate limits

test('the bucket allows a burst then refills over time', () => {
  let t = 0;
  const limiter = createRateLimiter({ rpm: 60, burst: 3, now: () => t });
  assert.equal(limiter.take('dev').ok, true);
  assert.equal(limiter.take('dev').ok, true);
  assert.equal(limiter.take('dev').ok, true);
  const blocked = limiter.take('dev');
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfterMs > 0);
  t += 1000; // 60/min == one token per second
  assert.equal(limiter.take('dev').ok, true);
});

test('one noisy device does not limit another', () => {
  const limiter = createRateLimiter({ rpm: 60, burst: 1, now: () => 0 });
  limiter.take('a');
  assert.equal(limiter.take('a').ok, false);
  assert.equal(limiter.take('b').ok, true);
});

// ------------------------------------------------------------------ retries

test('retries a 529 and succeeds', async () => {
  let calls = 0;
  const result = await callUpstream({
    url: 'http://x/v1/messages',
    headers: {},
    body: '{}',
    timeoutMs: 50,
    retries: 2,
    retryBaseMs: 1,
    fetchImpl: async () => {
      calls += 1;
      if (calls < 3) return new Response('overloaded', { status: 529 });
      return new Response(okReply(), { status: 200 });
    },
  });
  assert.equal(result.status, 200);
  assert.equal(result.attempts, 3);
  assert.equal(result.retried, true);
});

test('does not retry a 400 — our bug, retrying just spends twice', async () => {
  let calls = 0;
  const result = await callUpstream({
    url: 'http://x/v1/messages',
    headers: {},
    body: '{}',
    timeoutMs: 50,
    retries: 3,
    retryBaseMs: 1,
    fetchImpl: async () => {
      calls += 1;
      return new Response('{"error":"bad"}', { status: 400 });
    },
  });
  assert.equal(result.status, 400);
  assert.equal(calls, 1);
});

test('a hung upstream becomes a 504, not an infinite wait', async () => {
  const result = await callUpstream({
    url: 'http://x/v1/messages',
    headers: {},
    body: '{}',
    timeoutMs: 20,
    retries: 1,
    retryBaseMs: 1,
    fetchImpl: (url, opts) =>
      new Promise((_resolve, reject) => {
        opts.signal.addEventListener('abort', () => {
          const e = new Error('aborted');
          e.name = 'AbortError';
          reject(e);
        });
      }),
  });
  assert.equal(result.status, 504);
  assert.match(result.text, /upstream_timeout/);
});

test('backoff grows and is jittered', () => {
  assert.ok(backoffMs(1, 100, () => 1) > backoffMs(0, 100, () => 1));
  assert.notEqual(backoffMs(2, 100, () => 0), backoffMs(2, 100, () => 1));
});

// ------------------------------------------------------------------ ledger

test('tokens are always exact; dollars only when a price is configured', () => {
  const bare = createLedger({ pricing: null, now: () => 0 });
  bare.record('dev', { input_tokens: 1000, output_tokens: 100 });
  assert.equal(bare.today().totalTokens, 1100);
  assert.equal(bare.today().usd, null);

  const priced = createLedger({ pricing: { inputPerMTok: 3, outputPerMTok: 15 }, now: () => 0 });
  priced.record('dev', { input_tokens: 1_000_000, output_tokens: 1_000_000 });
  assert.equal(priced.today().usd, 18);
});

test('cached input tokens still count toward the cap', () => {
  const usd = usdFor(
    { input_tokens: 0, cache_read_input_tokens: 1_000_000, output_tokens: 0 },
    { inputPerMTok: 3, outputPerMTok: 15 },
  );
  assert.equal(usd, 3);
});

test('caps fire per-day and per-device', () => {
  const ledger = createLedger({ pricing: null, now: () => 0 });
  ledger.record('noisy', { input_tokens: 5000, output_tokens: 0 });
  assert.equal(ledger.overCap('noisy', { perDeviceDailyTokenCap: 1000 }), 'device_daily_token_cap');
  assert.equal(ledger.overCap('quiet', { perDeviceDailyTokenCap: 1000 }), null);
  assert.equal(ledger.overCap('quiet', { dailyTokenCap: 1000 }), 'daily_token_cap');
});

// ----------------------------------------------------------------- logging

test('logging cannot carry conversation content', () => {
  const child = 'my name is Sam and I live at 12 Elm Street and my mum is called Jo';
  const out = scrub({
    event: 'x',
    speech: child,
    userText: child,
    prompt: child,
    promptChars: 812,
    nested: { text: child },
    messages: [{ role: 'user', content: child }],
  });
  // Not truncated - absent. A truncated address is still an address.
  assert.equal(out.speech, undefined);
  assert.equal(out.userText, undefined);
  assert.equal(out.prompt, undefined);
  assert.equal(out.nested, undefined);
  assert.equal(out.messages, undefined);
  assert.ok(!JSON.stringify(out).includes('Sam'));
  // Operational fields survive: sizes, ids, statuses.
  assert.equal(out.promptChars, 812);
  assert.equal(out.event, 'x');
});

test('a new string field must be added to the allowlist deliberately', () => {
  assert.ok(!FIELDS.has('speech'));
  assert.ok(FIELDS.has('requestId'));
  assert.equal(scrub({ somethingNew: 'a sentence a child said' }).somethingNew, undefined);
});

test('device ids are hashed, not stored', () => {
  const raw = 'device-abc-123';
  const h = hashId(raw, 'salt');
  assert.notEqual(h, raw);
  assert.equal(h, hashId(raw, 'salt'));
  assert.notEqual(h, hashId(raw, 'other-salt'));
});

// ----------------------------------------------------------- the whole path

test('a healthy request is proxied and accounted for', async () => {
  let seen = null;
  const { call, handler, logs } = harness(
    {},
    {
      fetchImpl: async (url, opts) => {
        seen = JSON.parse(opts.body);
        return new Response(okReply(), { status: 200 });
      },
    },
  );
  const res = await call({ body: validBody });
  assert.equal(res.status, 200);
  assert.equal(seen.model, 'claude-opus-5');
  assert.equal(handler.ledger.today().totalTokens, 120);
  const completed = logs.find((l) => l.event === 'dialogue.completed');
  assert.equal(completed.inputTokens, 100);
  assert.equal(completed.status, 200);
  // The log knows the size of the prompt and nothing about its contents.
  assert.ok(completed.promptChars > 0);
  assert.ok(!JSON.stringify(logs).includes('hi barkly'));
});

test('only POST /v1/messages exists', async () => {
  const { call } = harness();
  assert.equal((await call({ method: 'GET', url: '/v1/models' })).status, 404);
  assert.equal((await call({ method: 'POST', url: '/v1/complete' })).status, 404);
  assert.equal((await call({ method: 'GET', url: '/healthz' })).status, 200);
});

test('the app token is required when configured', async () => {
  const { call } = harness({ BARKLY_APP_TOKEN: 'shh' }, { fetchImpl: async () => new Response(okReply()) });
  assert.equal((await call({ body: validBody })).status, 401);
  const ok = await call({ body: validBody, headers: { 'x-barkly-app-token': 'shh' } });
  assert.equal(ok.status, 200);
});

test('rate limiting returns 429 with a retry-after', async () => {
  const { call } = harness(
    { BARKLY_RPM_LIMIT: '60', BARKLY_BURST_LIMIT: '1' },
    { fetchImpl: async () => new Response(okReply()) },
  );
  assert.equal((await call({ body: validBody })).status, 200);
  const blocked = await call({ body: validBody });
  assert.equal(blocked.status, 429);
  assert.ok(blocked.headers['retry-after']);
});

test('an exhausted budget tells the client to fall back rather than dying', async () => {
  const { call } = harness(
    { BARKLY_DEVICE_DAILY_TOKEN_CAP: '50' },
    { fetchImpl: async () => new Response(okReply()) },
  );
  assert.equal((await call({ body: validBody })).status, 200); // 120 tokens spent
  const capped = await call({ body: validBody });
  assert.equal(capped.status, 429);
  assert.equal(capped.headers['x-barkly-fallback'], '1');
  assert.equal(capped.json().error.type, 'budget_exhausted');
});

test('an upstream outage is a fallback signal; a bad request is not', async () => {
  const down = harness({}, { fetchImpl: async () => new Response('boom', { status: 503 }) });
  const outage = await down.call({ body: validBody });
  assert.equal(outage.headers['x-barkly-fallback'], '1');

  const bad = harness({}, { fetchImpl: async () => new Response(okReply()) });
  const rejected = await bad.call({ body: '{"messages":[]}' });
  assert.equal(rejected.status, 400);
  assert.equal(rejected.headers['x-barkly-fallback'], undefined);
});

test('a body over the cap is refused without buffering it', async () => {
  const { call } = harness({ BARKLY_MAX_BODY_BYTES: '64' }, { fetchImpl: async () => new Response(okReply()) });
  const res = await call({ body: 'x'.repeat(500) });
  assert.equal(res.status, 413);
});

test('the usage report is admin-only', async () => {
  const { call } = harness({ BARKLY_ADMIN_TOKEN: 'admin' }, { fetchImpl: async () => new Response(okReply()) });
  assert.equal((await call({ method: 'GET', url: '/admin/usage' })).status, 404);
  const res = await call({
    method: 'GET',
    url: '/admin/usage',
    headers: { 'x-barkly-admin-token': 'admin' },
  });
  assert.equal(res.status, 200);
  assert.equal(res.json().pricingConfigured, false);
});

test('CORS reflects only allowed origins', async () => {
  const { call } = harness(
    { BARKLY_ALLOWED_ORIGINS: 'https://barkly.app' },
    { fetchImpl: async () => new Response(okReply()) },
  );
  const good = await call({ body: validBody, headers: { origin: 'https://barkly.app' } });
  assert.equal(good.headers['Access-Control-Allow-Origin'], 'https://barkly.app');
  const bad = await call({ body: validBody, headers: { origin: 'https://evil.example' } });
  assert.equal(bad.headers['Access-Control-Allow-Origin'], 'null');
});
