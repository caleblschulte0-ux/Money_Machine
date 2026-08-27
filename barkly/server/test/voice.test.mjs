/**
 * The voice route. Billed per character, so the caps and the refusals matter
 * more here than anywhere else in the proxy.
 */

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { loadConfig } from '../lib/config.mjs';
import { createLedger } from '../lib/cost.mjs';
import { createLogger } from '../lib/logging.mjs';
import { createHandler } from '../lib/server.mjs';
import { loadVoiceConfig, validateVoiceRequest, voiceBody, voiceUrl } from '../lib/voice.mjs';

const BASE_ENV = { BARKLY_ENV: 'development', ANTHROPIC_API_KEY: 'sk-test' };
const VOICE_ENV = { ELEVENLABS_API_KEY: 'el-test', BARKLY_VOICE_ID: 'barkly-voice' };

const AUDIO = Buffer.from('ID3fake-mp3-bytes');

function fakeReq({ method = 'POST', url = '/v1/voice', headers = {}, body = '' } = {}) {
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
      this.body = payload;
      this.done = true;
    },
    json() {
      return JSON.parse(String(this.body));
    },
  };
}

function harness(envOver = {}, deps = {}) {
  const env = { ...BASE_ENV, ...envOver };
  const config = loadConfig(env);
  const logs = [];
  const logger = createLogger({ level: 'debug', sink: (l) => logs.push(JSON.parse(l)) });
  const ledger = createLedger({ now: () => 0 });
  const handler = createHandler(config, {
    logger,
    ledger,
    noSweep: true,
    env,
    voice: loadVoiceConfig(env),
    ...deps,
  });
  return {
    logs,
    ledger,
    call: async (opts) => {
      const res = fakeRes();
      await handler(fakeReq(opts), res);
      return res;
    },
  };
}

const say = (text) => JSON.stringify({ text });

/** A fake `say.py`: writes `audio` to stdout, or exits 1 when audio is null. */
function fakeSay(audio, seen = {}) {
  return (bin, args, opts) => {
    seen.bin = bin;
    seen.args = args;
    seen.opts = opts;
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => {};
    child.stdin = {
      end: (text) => {
        seen.stdin = text;
        queueMicrotask(() => {
          if (audio) child.stdout.emit('data', audio);
          child.emit('close', audio ? 0 : 1);
        });
      },
    };
    return child;
  };
}

test('with nothing configured the FREE local engine is the voice', () => {
  // The whole point: a real voice with no account, no key, no signup.
  const bare = loadVoiceConfig({});
  assert.equal(bare.engine, 'local');
  assert.equal(bare.enabled, true);
});

test('ElevenLabs takes over only when it is fully configured', () => {
  assert.equal(loadVoiceConfig({ ELEVENLABS_API_KEY: 'k' }).engine, 'local'); // half is not enough
  assert.equal(loadVoiceConfig({ BARKLY_VOICE_ID: 'v' }).engine, 'local');
  const both = loadVoiceConfig(VOICE_ENV);
  assert.equal(both.engine, 'elevenlabs');
  assert.equal(both.enabled, true);
});

test('the engine can be forced either way', () => {
  assert.equal(loadVoiceConfig({ ...VOICE_ENV, BARKLY_VOICE_ENGINE: 'local' }).engine, 'local');
  const forced = loadVoiceConfig({ BARKLY_VOICE_ENGINE: 'elevenlabs' });
  assert.equal(forced.engine, 'elevenlabs');
  // Forced but unconfigured is honestly off rather than pretending.
  assert.equal(forced.enabled, false);
});

test('an engine that is forced on but unconfigured falls back rather than erroring', async () => {
  const { call } = harness({ BARKLY_VOICE_ENGINE: 'elevenlabs' });
  const res = await call({ body: say('hello') });
  assert.equal(res.status, 503);
  assert.equal(res.headers['x-barkly-fallback'], '1');
  assert.equal(res.json().error.type, 'voice_not_configured');
});

test('the local engine returns audio bytes and bills nothing', async () => {
  const { call, ledger } = harness(
    { BARKLY_VOICE_ENGINE: 'local' },
    { spawnImpl: fakeSay(AUDIO) },
  );
  const res = await call({ body: say('Good dog. Obviously.') });
  assert.equal(res.status, 200);
  assert.equal(res.headers['content-type'], 'audio/mpeg');
  assert.ok(Buffer.isBuffer(res.body));
  // Chars are still metered, purely so a runaway loop cannot pin a CPU.
  assert.equal(ledger.voiceCharsToday(), 'Good dog. Obviously.'.length);
});

test('the line goes in on STDIN, never in argv', async () => {
  const seen = {};
  const { call } = harness(
    { BARKLY_VOICE_ENGINE: 'local' },
    { spawnImpl: fakeSay(AUDIO, seen) },
  );
  const secret = '`rm -rf /` my mum is called Josephine';
  await call({ body: say(secret) });
  // argv carries the script path and nothing else a child typed.
  assert.ok(!JSON.stringify(seen.args).includes('Josephine'));
  assert.equal(seen.stdin, secret);
  assert.equal(seen.opts.shell, false);
});

test('a broken local engine falls back to the device voice', async () => {
  const { call } = harness(
    { BARKLY_VOICE_ENGINE: 'local' },
    { spawnImpl: fakeSay(null) },
  );
  const res = await call({ body: say('hi') });
  assert.equal(res.status, 502);
  assert.equal(res.headers['x-barkly-fallback'], '1');
});

test('returns audio bytes, not JSON', async () => {
  let sent = null;
  const { call, ledger } = harness(VOICE_ENV, {
    fetchImpl: async (url, opts) => {
      sent = { url, body: JSON.parse(opts.body), headers: opts.headers };
      return new Response(AUDIO, { status: 200 });
    },
  });
  const res = await call({ body: say('Good dog. Obviously.') });
  assert.equal(res.status, 200);
  assert.equal(res.headers['content-type'], 'audio/mpeg');
  assert.ok(Buffer.isBuffer(res.body));
  assert.equal(sent.body.text, 'Good dog. Obviously.');
  assert.equal(sent.headers['xi-api-key'], 'el-test');
  assert.equal(ledger.voiceCharsToday(), 'Good dog. Obviously.'.length);
});

test('the client cannot choose the voice — that is a product decision', () => {
  const voice = loadVoiceConfig(VOICE_ENV);
  const { text } = validateVoiceRequest(
    JSON.stringify({ text: 'hi', voiceId: 'someone-elses-cloned-voice', model_id: 'expensive' }),
    voice,
  );
  assert.equal(text, 'hi');
  assert.ok(voiceUrl(voice).includes('barkly-voice'));
  assert.equal(JSON.parse(voiceBody(text, voice)).model_id, voice.modelId);
});

test('refuses a wall of text — Barkly says short sentences', async () => {
  const { call } = harness(
    { ...VOICE_ENV, BARKLY_VOICE_MAX_CHARS: '40' },
    { fetchImpl: async () => new Response(AUDIO) },
  );
  const res = await call({ body: say('x'.repeat(500)) });
  assert.equal(res.status, 413);
});

test('control characters are stripped before anything is billed', () => {
  const voice = loadVoiceConfig(VOICE_ENV);
  // Built from char codes so this file's own source stays plain ASCII.
  const dirty = JSON.stringify({
    text: `good${String.fromCharCode(7)}boy${String.fromCharCode(31)}`,
  });
  assert.equal(validateVoiceRequest(dirty, voice).text, 'good boy');
});

test('a per-device character cap stops a runaway loop', async () => {
  const { call } = harness(
    { ...VOICE_ENV, BARKLY_VOICE_DEVICE_DAILY_CHAR_CAP: '10' },
    { fetchImpl: async () => new Response(AUDIO) },
  );
  assert.equal((await call({ body: say('twelve chars') })).status, 200);
  const capped = await call({ body: say('more') });
  assert.equal(capped.status, 429);
  assert.equal(capped.headers['x-barkly-fallback'], '1');
});

test('a vendor outage falls back to the device voice', async () => {
  const { call } = harness(VOICE_ENV, {
    fetchImpl: async () => new Response('nope', { status: 500 }),
  });
  const res = await call({ body: say('hi') });
  assert.equal(res.status, 502);
  assert.equal(res.headers['x-barkly-fallback'], '1');
});

test('a hung vendor times out instead of holding the turn open', async () => {
  const { call } = harness(
    { ...VOICE_ENV, BARKLY_VOICE_TIMEOUT_MS: '20' },
    {
      fetchImpl: (_url, opts) =>
        new Promise((_r, rej) =>
          opts.signal.addEventListener('abort', () => {
            const e = new Error('aborted');
            e.name = 'AbortError';
            rej(e);
          }),
        ),
    },
  );
  const res = await call({ body: say('hi') });
  assert.equal(res.status, 504);
  assert.equal(res.headers['x-barkly-fallback'], '1');
});

test('the spoken line is never written to a log', async () => {
  const secret = 'my mum is called Josephine';
  const { call, logs } = harness(VOICE_ENV, { fetchImpl: async () => new Response(AUDIO) });
  await call({ body: say(secret) });
  const dump = JSON.stringify(logs);
  assert.ok(!dump.includes('Josephine'));
  const done = logs.find((l) => l.event === 'voice.completed');
  assert.equal(done.chars, secret.length); // the size, not the words
});
