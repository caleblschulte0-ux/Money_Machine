/**
 * The client half of the production dialogue path: what happens when the
 * network is slow, the backend is down, the budget is gone, or the reply is
 * nonsense. None of those may reach a child as an error code.
 */

import { createAnthropicDialogue } from '../src/providers/dialogue/anthropic';
import { createResilientDialogue } from '../src/providers/dialogue/resilient';
import { createScriptedDialogue } from '../src/providers/dialogue/scripted';
import { currentDeviceId, DEVICE_KEY, loadDeviceId, resetDeviceId } from '../src/providers/device';
import { barklyLineFor, DialogueError, failureForStatus } from '../src/providers/errors';
import { DialogueProvider, DialogueRequest } from '../src/providers/types';
import { KeyValueStore } from '../src/storage/types';

const REQ: DialogueRequest = { systemPrompt: 'you are a dog', turns: [], userText: 'hi' };

function memStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    get: async (k) => map.get(k) ?? null,
    set: async (k, v) => void map.set(k, v),
    remove: async (k) => void map.delete(k),
  };
}

const reply = (text = '{"speech":"woof"}') =>
  new Response(JSON.stringify({ content: [{ type: 'text', text }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

function withFetch(impl: jest.Mock) {
  (globalThis as unknown as { fetch: unknown }).fetch = impl;
  return impl;
}

const realFetch = globalThis.fetch;
afterEach(() => {
  (globalThis as unknown as { fetch: unknown }).fetch = realFetch;
  jest.useRealTimers();
});

describe('every failure has a line Barkly can say', () => {
  it('maps statuses onto the failure vocabulary', () => {
    expect(failureForStatus(429)).toBe('rate_limited');
    expect(failureForStatus(503)).toBe('unavailable');
    expect(failureForStatus(401)).toBe('unauthorized');
    expect(failureForStatus(400)).toBe('bad_request');
    expect(failureForStatus(504)).toBe('timeout');
  });

  it('never surfaces a status code or the word provider to a child', () => {
    for (const kind of ['offline', 'timeout', 'rate_limited', 'unavailable', 'unauthorized', 'bad_request', 'malformed', 'unknown'] as const) {
      const line = new DialogueError(kind, { status: 503 }).barklyLine;
      expect(line).not.toMatch(/\d{3}|provider|error|http|api|token|server/i);
      expect(line.length).toBeGreaterThan(8);
    }
  });

  it('gives a line even for something that is not a DialogueError at all', () => {
    expect(barklyLineFor(new TypeError('undefined is not a function'))).toMatch(/say it again/i);
    expect(barklyLineFor(null)).toBeTruthy();
  });

  it('lets the backend force a fallback the status alone would not imply', () => {
    expect(new DialogueError('timeout').shouldFallback).toBe(false);
    expect(new DialogueError('timeout', { forceFallback: true }).shouldFallback).toBe(true);
  });
});

describe('the Anthropic adapter', () => {
  it('sends no key when it is talking to the proxy', async () => {
    const f = withFetch(jest.fn().mockResolvedValue(reply()));
    const p = createAnthropicDialogue({ baseURL: 'https://barkly.example', apiKey: 'sk-leak' });
    await p.complete(REQ);
    const headers = f.mock.calls[0][1].headers;
    expect(headers['x-api-key']).toBeUndefined();
    expect(f.mock.calls[0][0]).toBe('https://barkly.example/v1/messages');
  });

  it('sends the device id it has at CALL time, not construction time', async () => {
    const store = memStore();
    let id: string | undefined;
    const f = withFetch(jest.fn().mockResolvedValue(reply()));
    const p = createAnthropicDialogue({
      baseURL: 'https://barkly.example',
      get deviceId() {
        return id;
      },
    });
    id = await loadDeviceId(store); // resolves after the provider was built
    await p.complete(REQ);
    expect(f.mock.calls[0][1].headers['x-barkly-device']).toBe(id);
  });

  it('retries a 503 and then succeeds', async () => {
    const f = withFetch(
      jest
        .fn()
        .mockResolvedValueOnce(new Response('down', { status: 503 }))
        .mockResolvedValueOnce(reply()),
    );
    const p = createAnthropicDialogue({ baseURL: 'https://x', maxRetries: 1 });
    await expect(p.complete(REQ)).resolves.toContain('woof');
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 429 — being told to slow down is not a reason to hurry', async () => {
    const f = withFetch(jest.fn().mockResolvedValue(new Response('slow', { status: 429 })));
    const p = createAnthropicDialogue({ baseURL: 'https://x', maxRetries: 3 });
    await expect(p.complete(REQ)).rejects.toMatchObject({ kind: 'rate_limited' });
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('turns a network failure into an offline error, not a crash', async () => {
    withFetch(jest.fn().mockRejectedValue(new TypeError('Network request failed')));
    const p = createAnthropicDialogue({ baseURL: 'https://x', maxRetries: 0 });
    await expect(p.complete(REQ)).rejects.toMatchObject({ kind: 'offline' });
  });

  it('times out rather than leaving a child watching a silent dog', async () => {
    withFetch(
      jest.fn().mockImplementation(
        (_url: string, opts: { signal: AbortSignal }) =>
          new Promise((_res, rej) => {
            opts.signal.addEventListener('abort', () => {
              const e = new Error('aborted');
              e.name = 'AbortError';
              rej(e);
            });
          }),
      ),
    );
    const p = createAnthropicDialogue({ baseURL: 'https://x', maxRetries: 0, timeoutMs: 20 });
    await expect(p.complete(REQ)).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('treats an empty reply as malformed rather than speaking nothing', async () => {
    withFetch(jest.fn().mockResolvedValue(reply('   ')));
    const p = createAnthropicDialogue({ baseURL: 'https://x', maxRetries: 0 });
    await expect(p.complete(REQ)).rejects.toMatchObject({ kind: 'malformed' });
  });

  it('is unavailable with no configuration at all', () => {
    expect(createAnthropicDialogue({}).isAvailable()).toBe(false);
    expect(createAnthropicDialogue({ baseURL: 'https://x' }).isAvailable()).toBe(true);
  });
});

describe('Barkly does not die when the service does', () => {
  const failing = (kind: ConstructorParameters<typeof DialogueError>[0]): DialogueProvider => ({
    name: 'failing',
    isAvailable: () => true,
    complete: async () => {
      throw new DialogueError(kind);
    },
  });

  it('answers from the offline brain when the model is down', async () => {
    const r = createResilientDialogue(failing('unavailable'), createScriptedDialogue());
    const out = await r.complete(REQ);
    expect(JSON.parse(out).speech).toBeTruthy();
    expect(r.status().using).toBe('fallback');
  });

  it('rethrows a recoverable blip instead of hiding it behind a script', async () => {
    // "Say that again?" keeps him a real dog; silently switching brains does not.
    const r = createResilientDialogue(failing('timeout'), createScriptedDialogue());
    await expect(r.complete(REQ)).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('opens a breaker so the next turn is instant instead of another 15s wait', async () => {
    let now = 0;
    const primary = failing('unavailable');
    const spy = jest.spyOn(primary, 'complete');
    const r = createResilientDialogue(primary, createScriptedDialogue(), {
      threshold: 2,
      cooldownMs: 1000,
      now: () => now,
    });
    await r.complete(REQ);
    await r.complete(REQ);
    expect(r.status().breakerOpen).toBe(true);
    await r.complete(REQ); // straight to fallback, no network attempt
    expect(spy).toHaveBeenCalledTimes(2);

    now += 1001; // breaker closes on its own
    expect(r.status().breakerOpen).toBe(false);
    await r.complete(REQ);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('recovers fully once the model answers again', async () => {
    let broken = true;
    const flaky: DialogueProvider = {
      name: 'flaky',
      isAvailable: () => true,
      complete: async () => {
        if (broken) throw new DialogueError('unavailable');
        return '{"speech":"back"}';
      },
    };
    const r = createResilientDialogue(flaky, createScriptedDialogue(), { threshold: 5 });
    await r.complete(REQ);
    expect(r.status().consecutiveFailures).toBe(1);
    broken = false;
    await r.complete(REQ);
    expect(r.status().using).toBe('primary');
    expect(r.status().consecutiveFailures).toBe(0);
    expect(r.status().lastFailure).toBeUndefined();
  });

  it('goes straight to scripted in a build with no model configured', async () => {
    const unconfigured = createAnthropicDialogue({});
    const spy = jest.spyOn(unconfigured, 'complete');
    const r = createResilientDialogue(unconfigured, createScriptedDialogue());
    await r.complete(REQ);
    expect(spy).not.toHaveBeenCalled();
    expect(r.isAvailable()).toBe(true);
  });
});

describe('the device id is anonymous and disposable', () => {
  it('persists across boots', async () => {
    const store = memStore();
    await resetDeviceId(store);
    const first = await loadDeviceId(store);
    await resetDeviceId(store);
    await store.set(DEVICE_KEY, first);
    expect(await loadDeviceId(store)).toBe(first);
    expect(currentDeviceId()).toBe(first);
  });

  it('survives a storage that throws — the app must still boot', async () => {
    const broken: KeyValueStore = {
      get: async () => {
        throw new Error('storage unavailable');
      },
      set: async () => {
        throw new Error('storage unavailable');
      },
      remove: async () => {},
    };
    await resetDeviceId(broken);
    const id = await loadDeviceId(broken);
    expect(id.length).toBeGreaterThanOrEqual(8);
  });

  it('is replaced by Forget Everything, like a reinstall', async () => {
    const store = memStore();
    await resetDeviceId(store);
    const before = await loadDeviceId(store);
    await resetDeviceId(store);
    const after = await loadDeviceId(store);
    expect(after).not.toBe(before);
  });
});
