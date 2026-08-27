/**
 * The voice pipeline. The properties worth holding onto are the ones that
 * only break in front of a child: two Barklys talking over each other, a
 * mouth flapping to a line that already ended, and a dog that goes completely
 * silent because a vendor had a bad afternoon.
 */

// expo-audio needs a native module jest does not have. The engine tests below
// inject their own players, so a minimal stub is enough and keeps the real
// provider's fetch/cache logic under test.
jest.mock('expo-audio', () => ({
  createAudioPlayer: () => ({
    play: () => {},
    pause: () => {},
    remove: () => {},
    addListener: () => ({ remove: () => {} }),
  }),
  setAudioModeAsync: async () => {},
}));

import { clipKey, createVoiceCache } from '../src/audio/voiceCache';
import { createVoiceEngine, estimateDurationMs } from '../src/audio/voiceEngine';
import { createBarklyVoice } from '../src/providers/tts/barklyVoiceTts';
import { TextToSpeechProvider } from '../src/providers/types';

/** A device TTS double that records what it was asked to say. */
function fakeDevice(): TextToSpeechProvider & { said: string[]; stops: number; fail?: boolean } {
  const it = {
    name: 'fake-device',
    said: [] as string[],
    stops: 0,
    fail: false,
    isAvailable: async () => true,
    speak: async (text: string, opts?: { onStart?: () => void }) => {
      if (it.fail) throw new Error('no speech engine');
      opts?.onStart?.();
      it.said.push(text);
    },
    stop: async () => {
      it.stops += 1;
    },
  };
  return it;
}

/** A Barkly-voice double: resolves after `ms` unless stopped first. */
function fakeVoice(opts: { available?: boolean; ms?: number; fail?: boolean } = {}) {
  const played: string[] = [];
  let stops = 0;
  return {
    played,
    get stops() {
      return stops;
    },
    provider: {
      name: 'fake-barkly-voice',
      isAvailable: () => opts.available !== false,
      warm: async () => {},
      clearCache: () => {},
      play: async (text: string, o?: { onStart?: () => void }) => {
        if (opts.fail) return null;
        played.push(text);
        o?.onStart?.();
        let finish: () => void = () => {};
        const done = new Promise<void>((r) => {
          finish = r;
        });
        const timer = setTimeout(finish, opts.ms ?? 5);
        return {
          done,
          stop: () => {
            stops += 1;
            clearTimeout(timer);
            finish();
          },
        };
      },
    },
  };
}

describe('the clip cache', () => {
  it('keys on the voice and the text, ignoring case and padding', () => {
    expect(clipKey('v1', 'Good dog.')).toBe(clipKey('v1', '  good dog.  '));
    expect(clipKey('v1', 'Good dog.')).not.toBe(clipKey('v2', 'Good dog.'));
    expect(clipKey('v1', 'Good dog.')).not.toBe(clipKey('v1', 'Bad dog.'));
  });

  it('evicts the least recently used clip, not the oldest touched', () => {
    const cache = createVoiceCache({ maxEntries: 2, maxBytes: 1000 });
    cache.put('a', { uri: 'data:a', bytes: 10, at: 0 });
    cache.put('b', { uri: 'data:b', bytes: 10, at: 0 });
    cache.get('a'); // 'a' is now the most recent
    cache.put('c', { uri: 'data:c', bytes: 10, at: 0 });
    expect(cache.get('a')).toBeDefined();
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBeDefined();
  });

  it('stays inside its byte budget', () => {
    const cache = createVoiceCache({ maxEntries: 100, maxBytes: 100 });
    for (let i = 0; i < 20; i++) cache.put(`k${i}`, { uri: `data:${i}`, bytes: 30, at: 0 });
    expect(cache.bytes).toBeLessThanOrEqual(100);
  });

  it('refuses a single clip larger than the whole budget', () => {
    const cache = createVoiceCache({ maxEntries: 4, maxBytes: 50 });
    cache.put('huge', { uri: 'data:x', bytes: 500, at: 0 });
    expect(cache.size).toBe(0);
  });
});

describe('the Barkly voice provider', () => {
  const audio = () =>
    new Response(new Uint8Array([1, 2, 3, 4]), {
      status: 200,
      headers: { 'content-type': 'audio/mpeg' },
    });

  it('is unavailable without a proxy — the key never ships in the app', () => {
    expect(createBarklyVoice({}).isAvailable()).toBe(false);
    expect(createBarklyVoice({ baseURL: 'https://p' }).isAvailable()).toBe(true);
  });

  it('sends only the text — the client cannot pick a voice', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(audio());
    const v = createBarklyVoice({ baseURL: 'https://p', appToken: 't', fetchImpl });
    await v.warm('Good dog.');
    const [url, opts] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://p/v1/voice');
    expect(JSON.parse(opts.body)).toEqual({ text: 'Good dog.' });
    expect(opts.headers['x-barkly-app-token']).toBe('t');
  });

  it('does not pay twice for the same line', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(audio());
    const v = createBarklyVoice({ baseURL: 'https://p', fetchImpl });
    await v.warm('No. Nap.');
    await v.warm('no. nap.');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('gives up quietly when the voice is not configured server-side', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(new Response('{}', { status: 503 }));
    const v = createBarklyVoice({ baseURL: 'https://p', fetchImpl });
    await expect(v.play('hi')).resolves.toBeNull();
  });

  it('gives up quietly when the network is gone', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    const v = createBarklyVoice({ baseURL: 'https://p', fetchImpl });
    await expect(v.play('hi')).resolves.toBeNull();
  });
});

describe('the voice engine', () => {
  const engineWith = (over: Parameters<typeof createVoiceEngine>[0]) =>
    createVoiceEngine({ wait: async () => {}, ...over });

  it('prefers Barkly, falls back to the device, then to silence', async () => {
    const device = fakeDevice();
    const good = fakeVoice();
    expect((await engineWith({ voice: good.provider, device }).speak('one')).route).toBe('barkly');
    expect(good.played).toEqual(['one']);

    const broken = fakeVoice({ fail: true });
    expect((await engineWith({ voice: broken.provider, device }).speak('two')).route).toBe('device');
    expect(device.said).toEqual(['two']);

    device.fail = true;
    expect((await engineWith({ voice: broken.provider, device }).speak('three')).route).toBe('silent');
  });

  it('never lets two utterances overlap — a new line cuts the old one off', async () => {
    const device = fakeDevice();
    const voice = fakeVoice({ ms: 10_000 });
    const engine = engineWith({ voice: voice.provider, device });

    const first = engine.speak('I was going to say something long');
    await new Promise((r) => setTimeout(r, 0)); // let the first player attach
    const second = engine.speak('never mind');

    await expect(first).resolves.toMatchObject({ interrupted: true });
    expect(voice.stops).toBeGreaterThanOrEqual(1);
    expect(engine.lastRoute).toBe('barkly');

    engine.stop(); // the second one is still going; end it so the test can too
    await second;
  });

  it('stop() ends the current line immediately', async () => {
    const device = fakeDevice();
    const voice = fakeVoice({ ms: 10_000 });
    const engine = engineWith({ voice: voice.provider, device });
    const speaking = engine.speak('a long thought about squirrels');
    await new Promise((r) => setTimeout(r, 0));
    engine.stop();
    await expect(speaking).resolves.toMatchObject({ interrupted: true });
    expect(engine.speaking).toBe(false);
  });

  it('backgrounding shuts him up — nobody wants a dog talking from a pocket', async () => {
    const device = fakeDevice();
    const voice = fakeVoice({ ms: 10_000 });
    const engine = engineWith({ voice: voice.provider, device });
    const speaking = engine.speak('still going');
    await new Promise((r) => setTimeout(r, 0));
    engine.onBackground();
    await speaking;
    expect(voice.stops).toBeGreaterThanOrEqual(1);
  });

  it('muted is quiet, not broken: no audio, but the same shape of time', async () => {
    const device = fakeDevice();
    const voice = fakeVoice();
    const waits: number[] = [];
    const engine = createVoiceEngine({
      voice: voice.provider,
      device,
      muted: true,
      wait: async (ms) => void waits.push(ms),
    });
    const result = await engine.speak('Good dog. Obviously.');
    expect(result.route).toBe('silent');
    expect(voice.played).toEqual([]);
    expect(device.said).toEqual([]);
    // The mouth animation still has a duration to run against.
    expect(waits[0]).toBeGreaterThan(500);
  });

  it('unmuting restores the real voice', async () => {
    const device = fakeDevice();
    const voice = fakeVoice();
    const engine = engineWith({ voice: voice.provider, device, muted: true });
    await engine.speak('quiet one');
    engine.setMuted(false);
    await engine.speak('loud one');
    expect(voice.played).toEqual(['loud one']);
  });

  it('an empty line is not an utterance', async () => {
    const device = fakeDevice();
    const engine = engineWith({ device });
    await engine.speak('   ');
    expect(device.said).toEqual([]);
  });

  it('estimates a plausible duration so silence still reads as talking', () => {
    expect(estimateDurationMs('Hi.')).toBeGreaterThanOrEqual(700);
    expect(estimateDurationMs('one two three four five six seven eight nine ten')).toBeGreaterThan(
      estimateDurationMs('Hi.'),
    );
    expect(estimateDurationMs('word '.repeat(5000))).toBeLessThanOrEqual(20_000);
  });

  it('resolves even when everything fails, so speaking is never a stuck state', async () => {
    const device = fakeDevice();
    device.fail = true;
    const engine = engineWith({ voice: fakeVoice({ fail: true }).provider, device });
    await expect(engine.speak('anyone there')).resolves.toMatchObject({ route: 'silent' });
  });
});
