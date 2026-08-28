/**
 * The banked voice — the recordings that ship inside the app.
 *
 * There is exactly one way this feature fails, and it fails SILENTLY. The bank
 * is looked up by the text the voice engine is handed, and that text has been
 * through `bronx()`: he says "Dere ya are", not "There you are". Key the bank on
 * the source spelling and every single lookup misses, no error is thrown, the
 * device voice answers instead, and you ship two megabytes of audio nobody ever
 * hears. It would look exactly like it looked before the feature existed.
 *
 * So the tests here are about the JOIN, not about audio:
 *
 *   THE KEYS ARE THE SPOKEN FORM   not the written form
 *   THE GENERATED FILE IS IN SYNC  with the harvest and with the mp3s on disk
 *   A MISS FALLS THROUGH           an unbanked line returns null, never throws
 *   THE CHAIN IS ORDERED           bank first, proxy second, device last
 */

// expo-audio wants a native module jest does not have. Every test here either
// injects its own player or never gets as far as making one.
jest.mock('expo-audio', () => ({
  createAudioPlayer: () => ({
    play: () => {},
    pause: () => {},
    remove: () => {},
    addListener: () => ({ remove: () => {} }),
  }),
  setAudioModeAsync: async () => {},
}));

import { bronx } from '../src/barkly/dialect';
import { BANKED_LINE_COUNT, VOICE_BANK } from '../src/audio/voiceBank';
import { createBankedVoice } from '../src/providers/tts/bankedVoice';
import { createVoiceEngine } from '../src/audio/voiceEngine';

// The harvest, straight from the file the build script writes. Imported rather
// than read with fs so this stays a plain app test with no Node types.
import harvest from '../voice-bank/lines.json';

const HARVEST = harvest as { entries: { key: string; spoken: string; source: string; tag: string }[] };

describe('the bank is keyed on what he SAYS, not on what is written down', () => {
  it('every key is already in dialect — running bronx over it changes nothing', () => {
    // If a key were the source spelling, bronx() would still have work to do on
    // it. This one assertion is the whole bug class.
    for (const key of Object.keys(VOICE_BANK)) {
      expect(bronx(key)).toBe(key);
    }
  });

  it('the written form of a line that bronx changes is NOT a key', () => {
    const changed = HARVEST.entries.filter((e) => e.source !== e.spoken);
    // Sanity: the dialect layer is doing something, or this test proves nothing.
    expect(changed.length).toBeGreaterThan(20);
    for (const e of changed) {
      expect(VOICE_BANK[e.source]).toBeUndefined();
    }
  });

  it('the recorded lines are the harvested spoken forms', () => {
    const harvested = new Set(HARVEST.entries.map((e) => e.spoken));
    for (const key of Object.keys(VOICE_BANK)) {
      expect(harvested.has(key)).toBe(true);
    }
  });
});

describe('the generated module tells the truth about itself', () => {
  it('the count matches the table', () => {
    expect(BANKED_LINE_COUNT).toBe(Object.keys(VOICE_BANK).length);
  });

  it('has enough of him to be worth the bytes', () => {
    // A pipeline that quietly produced an empty bank would look identical to
    // one that was never run. This is the floor that makes that loud.
    expect(BANKED_LINE_COUNT).toBeGreaterThanOrEqual(100);
  });

  it('covers the moments you hear before you have typed anything', () => {
    // Greetings, reactions and thoughts are the whole first minute of the app.
    const byTag = new Map<string, { have: number; want: number }>();
    for (const e of HARVEST.entries) {
      const row = byTag.get(e.tag) ?? { have: 0, want: 0 };
      row.want += 1;
      if (VOICE_BANK[e.spoken] !== undefined) row.have += 1;
      byTag.set(e.tag, row);
    }
    for (const tag of ['greetings', 'reactions', 'thoughts', 'mishaps']) {
      const row = byTag.get(tag);
      expect(row).toBeDefined();
      expect(row!.have).toBe(row!.want);
    }
  });
});

describe('a line it does not have falls through instead of failing', () => {
  const fakePlayer = () => {
    const listeners: ((s: { didJustFinish?: boolean }) => void)[] = [];
    return {
      played: 0,
      paused: 0,
      removed: 0,
      addListener(_: string, fn: (s: { didJustFinish?: boolean }) => void) {
        listeners.push(fn);
      },
      play() {
        this.played += 1;
        // Finish on the next tick, the way a very short clip would.
        setTimeout(() => listeners.forEach((fn) => fn({ didJustFinish: true })), 0);
      },
      pause() {
        this.paused += 1;
      },
      remove() {
        this.removed += 1;
      },
    };
  };

  it('returns null for a line nobody recorded', async () => {
    const voice = createBankedVoice({ bank: { 'a banked line.': 1 } });
    await expect(voice.play('something he made up about your skateboard')).resolves.toBeNull();
  });

  it('plays, and resolves when the clip ends', async () => {
    const player = fakePlayer();
    const voice = createBankedVoice({
      bank: { 'a banked line.': 1 },
      createPlayer: (() => player) as never,
    });
    let started = false;
    const playback = await voice.play('a banked line.', { onStart: () => (started = true) });
    expect(playback).not.toBeNull();
    expect(started).toBe(true);
    await playback!.done;
    expect(player.played).toBe(1);
    expect(player.removed).toBe(1);
  });

  it('tolerates the whitespace a line picks up on its way through the app', async () => {
    const voice = createBankedVoice({
      bank: { 'a banked line.': 1 },
      createPlayer: (() => fakePlayer()) as never,
    });
    await expect(voice.play('  a banked line.  ')).resolves.not.toBeNull();
  });

  it('an empty bank is unavailable rather than broken', () => {
    expect(createBankedVoice({ bank: {} }).isAvailable()).toBe(false);
    expect(createBankedVoice({ bank: { x: 1 } }).isAvailable()).toBe(true);
  });
});

describe('the chain: bank, then proxy, then the phone', () => {
  const fakeVoice = (name: string, knows: string[], log: string[]) => ({
    name,
    isAvailable: () => true,
    warm: async () => {},
    clearCache: () => {},
    play: async (text: string) => {
      if (!knows.includes(text)) return null;
      log.push(name);
      return { done: Promise.resolve(), stop: () => {} };
    },
  });

  it('a banked line never reaches the proxy', async () => {
    const log: string[] = [];
    const engine = createVoiceEngine({
      voices: [fakeVoice('bank', ['known'], log), fakeVoice('proxy', ['known', 'other'], log)],
      device: { speak: async () => void log.push('device'), stop: async () => {} } as never,
      wait: async () => {},
    });
    await engine.speak('known');
    expect(log).toEqual(['bank']);
  });

  it('an unbanked line goes to the proxy, and then to the phone', async () => {
    const log: string[] = [];
    const device = { speak: async () => void log.push('device'), stop: async () => {} } as never;
    const withProxy = createVoiceEngine({
      voices: [fakeVoice('bank', ['known'], log), fakeVoice('proxy', ['other'], log)],
      device,
      wait: async () => {},
    });
    await withProxy.speak('other');
    expect(log).toEqual(['proxy']);

    log.length = 0;
    const noProxy = createVoiceEngine({
      voices: [fakeVoice('bank', ['known'], log)],
      device,
      wait: async () => {},
    });
    await noProxy.speak('made up on the spot');
    expect(log).toEqual(['device']);
  });
});
