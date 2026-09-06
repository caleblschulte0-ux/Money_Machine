/**
 * The app had no sound at all. These hold the two things that make that stay
 * fixed: the mixer behaves, and it is actually REACHED.
 */
// expo-audio needs a native module jest does not have, and every test here
// injects its own player anyway. Same treatment as voice.test / voiceBank.test.
jest.mock('expo-audio', () => ({
  createAudioPlayer: () => ({ play: () => {}, remove: () => {} }),
}));

import { playSfx, setSfxMuted, __setSfxPlayerFactory, __resetSfx, SfxName } from '../src/audio/sfx';
import { feel, setFeelMuted } from '../src/ui/feel';

declare const __filename: string;
declare const require: (m: string) => any;
const { readFileSync, existsSync, statSync } = require('fs') as any;
const { join } = require('path') as any;
const ROOT = join(__filename, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

// Names, not module ids: jest resolves every asset to the same number.
let played: SfxName[] = [];
const fakePlayer = () => ({ play: () => {}, remove: () => {} }) as any;

beforeEach(() => {
  played = [];
  __resetSfx();
  setSfxMuted(false);
  setFeelMuted(false);
  __setSfxPlayerFactory((_source: number, name: SfxName) => { played.push(name); return fakePlayer(); });
});

afterEach(() => { __resetSfx(); });

describe('the mixer', () => {
  it('plays a clip', () => {
    playSfx('coin');
    expect(played).toEqual(['coin']);
  });

  it('refuses to stack the same sound on itself', () => {
    // A child mashing the dog fires `touch` as fast as the screen samples;
    // nine overlapping copies of one click is a fault noise, not feedback.
    playSfx('tap', 1000);
    playSfx('tap', 1010);
    playSfx('tap', 1040);
    expect(played).toHaveLength(1);
    playSfx('tap', 1200);
    expect(played).toHaveLength(2);
  });

  it('lets a different sound through immediately', () => {
    playSfx('dig', 1000);
    playSfx('coin', 1005);
    expect(played).toHaveLength(2);
  });

  it('is silent when the toy is muted, and muting the dog does it', () => {
    setFeelMuted(true);
    playSfx('coin');
    feel('act');
    expect(played).toHaveLength(0);
  });

  it('never throws when there is no audio device', () => {
    __setSfxPlayerFactory(() => { throw new Error('no device'); });
    expect(() => playSfx('levelup')).not.toThrow();
  });
});

describe('sound rides the feeling vocabulary', () => {
  it('a feeling already wired in the app makes its sound', () => {
    feel('touch');
    expect(played).toHaveLength(1);
  });

  it('a caller can name a better sound than the default', () => {
    feel('act', 'eat');
    expect(played).toEqual(['eat']);
    __resetSfx(); played = [];
    feel('act');
    expect(played).toEqual(['tap']);
  });

  it('thump stays silent, because this file calls it felt rather than heard', () => {
    feel('thump');
    expect(played).toHaveLength(0);
  });
});

describe('it is actually reached', () => {
  /*
   * The failure mode of this repo is a capability that is built, tested and
   * never called -- three found in one week. A sound system nothing plays is
   * the same bug with a soundtrack, so this asserts the seam rather than the
   * unit.
   */
  it('the room plays sound at the moments that deserve one', () => {
    const room = read('src/ui/BarklyRoom.tsx');
    expect(room).toContain("from '../audio/sfx'");
    expect(room).toMatch(/playSfx\('arrive'\)/);   // walking somewhere new
    expect(room).toMatch(/playSfx\('levelup'\)/);  // a rung crossed
    expect(room).toMatch(/playSfx\('coin'\)/);     // a reward landing
    expect(room).toMatch(/playSfx\('pop'\)/);      // a panel arriving
    expect(room).toMatch(/feel\('act', 'dig'\)/);  // paws in earth
    expect(room).toMatch(/feel\('act', 'eat'\)/);  // a bite
  });

  it('every clip the code names exists on disk, and is small enough to ship', () => {
    const names: SfxName[] = ['tap', 'pop', 'close', 'coin', 'levelup', 'eat', 'dig', 'arrive', 'nope'];
    let total = 0;
    for (const name of names) {
      const path = join(ROOT, 'assets', 'sfx', `${name}.wav`);
      expect(existsSync(path)).toBe(true);
      total += statSync(path).size;
    }
    // The whole set is inlined into a single-file web build alongside 5MB of
    // voice. It has to stay a rounding error.
    expect(total).toBeLessThan(200 * 1024);
  });

  it('the generator records that nobody has heard these', () => {
    // If that admission ever disappears, either someone auditioned them (good,
    // update the note) or it was quietly dropped (not good).
    expect(read('scripts/make-sfx.py')).toMatch(/cannot hear them/i);
  });
});
