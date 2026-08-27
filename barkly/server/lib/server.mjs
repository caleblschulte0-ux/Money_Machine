/**
 * The Barkly proxy's request handling, as a pure(ish) factory so tests can
 * drive it with a fake clock and a fake fetch instead of real money.
 *
 * Contract with the app: it speaks the Anthropic Messages API, so the client
 * SDK works unchanged with `baseURL` pointed here. Everything else — which
 * model, how big, how often, how much — is decided on this side, because
 * anything the app can configure an attacker can configure too.
 */

import http from 'node:http';
import { createLedger } from './cost.mjs';
import { createLogger, hashId } from './logging.mjs';
import { createRateLimiter } from './ratelimit.mjs';
import { callUpstream } from './upstream.mjs';
import { validateMessagesRequest, ValidationError } from './validate.mjs';
import { loadCliConfig, runCli } from './cli.mjs';
import { loadVoiceConfig, validateVoiceRequest, voiceBody, voiceUrl } from './voice.mjs';

/** Client hint that the failure is permanent-ish, so fall back to scripted Barkly. */
const FALLBACK_HEADER = 'x-barkly-fallback';

function corsHeaders(origin, allowed) {
  const allowAll = allowed.includes('*');
  const ok = allowAll || (origin && allowed.includes(origin));
  return {
    'Access-Control-Allow-Origin': allowAll ? '*' : ok ? origin : 'null',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers':
      'content-type, anthropic-version, x-api-key, x-barkly-device, x-barkly-app-token, anthropic-dangerous-direct-browser-access',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > maxBytes) {
        reject(new ValidationError(`request too large (max ${maxBytes} bytes)`, 413));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

export function createHandler(config, deps = {}) {
  const log = deps.logger || createLogger({ level: config.logLevel, env: config.env });
  const limiter =
    deps.limiter || createRateLimiter({ rpm: config.rpm, burst: config.burst, now: deps.now });
  const ledger = deps.ledger || createLedger({ pricing: config.pricing, now: deps.now });
  const fetchImpl = deps.fetchImpl || fetch;
  const rng = deps.rng || Math.random;
  const now = deps.now || (() => Date.now());
  const salt = config.appToken || config.env;
  const voice = deps.voice || loadVoiceConfig(deps.env || process.env);
  // The subscription brain. When it is on there is no API key and no
  // per-message cost, and the app cannot tell the difference.
  const cli = deps.cli || loadCliConfig(deps.env || process.env);

  let requestSeq = 0;

  const sweeper = deps.noSweep
    ? null
    : setInterval(() => limiter.sweep(), 5 * 60_000).unref?.() ?? null;

  /**
   * Synthesis. Returns audio bytes, never JSON on success — the app plays the
   * body directly. Everything that can go wrong answers with the fallback
   * header so Barkly drops to the device voice instead of going silent.
   */
  async function handleVoice({ raw, requestId, device, send, res, cors }) {
    let text;
    try {
      ({ text } = validateVoiceRequest(raw, voice));
    } catch (err) {
      const status = err instanceof ValidationError ? err.status : 400;
      log.warn('voice.invalid', { requestId, device, error: String(err.message) });
      return send(status, { error: { type: 'invalid_request_error', message: err.message } });
    }

    const startedAt = now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), voice.timeoutMs);
    try {
      const upstream = await fetchImpl(voiceUrl(voice), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'audio/mpeg',
          'xi-api-key': voice.apiKey,
        },
        body: voiceBody(text, voice),
        signal: controller.signal,
      });

      if (!upstream.ok) {
        log.warn('voice.upstream_failed', { requestId, device, status: upstream.status });
        return send(
          upstream.status >= 500 ? 502 : upstream.status,
          { error: { type: 'voice_failed', message: 'voice unavailable' } },
          { [FALLBACK_HEADER]: '1' },
        );
      }

      const audio = Buffer.from(await upstream.arrayBuffer());
      ledger.recordVoice(device, text.length);
      log.info('voice.completed', {
        requestId,
        device,
        chars: text.length, // length only, never the line itself
        bytes: audio.length,
        latencyMs: now() - startedAt,
      });
      res.writeHead(200, {
        ...cors,
        'content-type': 'audio/mpeg',
        'content-length': String(audio.length),
        // Clips are content-addressed by the client; let the platform cache too.
        'cache-control': 'private, max-age=86400',
      });
      return res.end(audio);
    } catch (err) {
      const timedOut = err?.name === 'AbortError';
      log.warn('voice.failed', { requestId, device, reason: timedOut ? 'timeout' : 'network' });
      return send(
        timedOut ? 504 : 502,
        { error: { type: 'voice_failed', message: 'voice unavailable' } },
        { [FALLBACK_HEADER]: '1' },
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async function handler(req, res) {
    const origin = req.headers.origin;
    const cors = corsHeaders(origin, config.allowedOrigins);
    const send = (status, payload, extra = {}) => {
      res.writeHead(status, { ...cors, 'content-type': 'application/json', ...extra });
      res.end(typeof payload === 'string' ? payload : JSON.stringify(payload));
    };

    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors);
      return res.end();
    }

    if (req.method === 'GET' && req.url === '/healthz') {
      return send(200, {
        ok: true,
        env: config.env,
        model: config.defaultModel,
        voice: voice.enabled ? 'configured' : 'unconfigured',
        brain: cli.enabled ? `cli:${cli.model}` : config.apiKey ? 'api' : 'unconfigured',
      });
    }

    if (req.method === 'GET' && req.url === '/admin/usage') {
      if (!config.adminToken || req.headers['x-barkly-admin-token'] !== config.adminToken) {
        return send(404, { error: { type: 'not_found', message: 'not found' } });
      }
      return send(200, {
        env: config.env,
        pricingConfigured: Boolean(config.pricing),
        today: ledger.today(),
        history: ledger.report(),
        caps: {
          dailyTokenCap: config.dailyTokenCap,
          dailyUsdCap: config.dailyUsdCap,
          perDeviceDailyTokenCap: config.perDeviceDailyTokenCap,
        },
        rateLimiterEntries: limiter.size,
        voice: {
          enabled: voice.enabled,
          charsToday: ledger.voiceCharsToday(),
          dailyCharCap: voice.dailyCharCap,
          perDeviceDailyCharCap: voice.perDeviceDailyCharCap,
        },
      });
    }

    const isDialogue = req.method === 'POST' && req.url === '/v1/messages';
    const isVoice = req.method === 'POST' && req.url === '/v1/voice';
    if (!isDialogue && !isVoice) {
      return send(404, { error: { type: 'not_found', message: 'not found' } });
    }

    const requestId = `r${(requestSeq += 1)}-${now().toString(36)}`;
    const device = hashId(req.headers['x-barkly-device'] || clientIp(req), salt);

    // The app token is obfuscation, not authentication — the app ships it. It
    // exists so a stranger who finds this host cannot simply curl it.
    if (config.appToken && req.headers['x-barkly-app-token'] !== config.appToken) {
      log.warn('auth.rejected', { requestId, device });
      return send(401, { error: { type: 'unauthorized', message: 'unauthorized' } });
    }

    if (isDialogue && !cli.enabled && !config.apiKey) {
      log.error('config.missing_key', { requestId });
      return send(
        503,
        { error: { type: 'not_configured', message: 'backend has no upstream credential' } },
        { [FALLBACK_HEADER]: '1' },
      );
    }
    if (isVoice && !voice.enabled) {
      // Not an error: a deployment without a designed Barkly voice yet. The
      // app hears "use the device voice" and does exactly that.
      return send(
        503,
        { error: { type: 'voice_not_configured', message: 'no voice configured' } },
        { [FALLBACK_HEADER]: '1' },
      );
    }

    const gate = limiter.take(device);
    if (!gate.ok) {
      log.warn('ratelimit.blocked', { requestId, device, retryAfterMs: gate.retryAfterMs });
      return send(
        429,
        { error: { type: 'rate_limit_error', message: 'slow down a moment' } },
        { 'retry-after': String(Math.ceil(gate.retryAfterMs / 1000)) },
      );
    }

    const capped = isVoice ? ledger.overVoiceCap(device, voice) : ledger.overCap(device, config);
    if (capped) {
      log.warn('budget.capped', { requestId, device, reason: capped });
      return send(
        429,
        { error: { type: 'budget_exhausted', message: capped } },
        { [FALLBACK_HEADER]: '1', 'retry-after': '3600' },
      );
    }

    let raw;
    try {
      raw = await readBody(req, config.maxBodyBytes);
    } catch (err) {
      const status = err instanceof ValidationError ? err.status : 400;
      log.warn('request.body_rejected', { requestId, device, error: String(err.message) });
      if (!res.headersSent) send(status, { error: { type: 'invalid_request_error', message: err.message } });
      return;
    }

    if (isVoice) return handleVoice({ raw, requestId, device, send, res, cors });

    let checked;
    try {
      checked = validateMessagesRequest(raw, config);
    } catch (err) {
      const status = err instanceof ValidationError ? err.status : 400;
      log.warn('request.invalid', { requestId, device, error: String(err.message) });
      return send(status, { error: { type: 'invalid_request_error', message: err.message } });
    }

    const startedAt = now();
    // Both brains return the same shape, so nothing below cares which ran.
    const result = cli.enabled
      ? await runCli(checked.body, cli, deps.cliDeps)
      : await callUpstream({
          url: `${config.upstream}/v1/messages`,
          headers: {
            'content-type': 'application/json',
            'x-api-key': config.apiKey,
            'anthropic-version': config.anthropicVersion,
          },
          body: JSON.stringify(checked.body),
          timeoutMs: config.timeoutMs,
          retries: config.retries,
          retryBaseMs: config.retryBaseMs,
          fetchImpl,
          rng,
          onRetry: ({ attempt, status, waitMs }) =>
            log.warn('upstream.retry', { requestId, device, attempt, status: String(status), waitMs }),
        });

    // Usage accounting. Parsing is best-effort: never fail a good reply
    // because the bookkeeping could not read it.
    let usage = null;
    try {
      const parsed = JSON.parse(result.text);
      if (parsed && parsed.usage) usage = ledger.record(device, parsed.usage);
    } catch {
      /* non-JSON upstream body; tokens unknown for this request */
    }

    const latencyMs = now() - startedAt;
    const level = result.status >= 500 ? 'error' : result.status >= 400 ? 'warn' : 'info';
    log[level]('dialogue.completed', {
      requestId,
      device,
      model: cli.enabled ? `cli:${cli.model}` : checked.model,
      status: result.status,
      latencyMs,
      attempts: result.attempts,
      retried: result.retried,
      promptChars: checked.estimatedInputChars, // size only — never the text
      inputTokens: usage?.input ?? null,
      outputTokens: usage?.output ?? null,
      usd: usage?.usd ?? null,
    });

    const extra = {};
    // Tell the client when falling back to scripted Barkly is the right move:
    // upstream is down or we are out of budget, not "you sent a bad request".
    if (result.status >= 500 || result.status === 429) extra[FALLBACK_HEADER] = '1';
    send(result.status, result.text, extra);
  }

  handler.close = () => {
    if (sweeper) clearInterval(sweeper);
  };
  handler.ledger = ledger;
  return handler;
}

export function createServer(config, deps = {}) {
  const handler = createHandler(config, deps);
  const server = http.createServer((req, res) => {
    handler(req, res).catch((err) => {
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: { type: 'internal_error', message: 'internal error' } }));
      }
      (deps.logger || console).error?.('handler.crashed', { error: String(err?.message || err) });
    });
  });
  server.on('close', () => handler.close());
  server.ledger = handler.ledger;
  return server;
}

export { FALLBACK_HEADER };
