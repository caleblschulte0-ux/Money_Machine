/**
 * What you BOUGHT decides what he does.
 *
 * The play button read the LOCATION first:
 *
 *     location === 'park' ? 'fetch' : ... barkly.toy ? ... : 'play'
 *
 * so at the park it said "fetch" and ran the ball chase no matter what was in
 * his mouth. You could buy the rope, equip it, watch the shop report "has it",
 * press play — and he chased a ball he does not own. A shop whose purchases do
 * not change anything is the one thing a shop must not be, and this was the
 * only item where that was true, which is exactly why nobody caught it.
 *
 * The precedence is now a pure function with the rule written down, and these
 * are the cases that matter. The old code passes every test below except the
 * park ones, which is the point.
 */

declare const require: (m: string) => any;
declare const __dirname: string;
const { readFileSync } = require('fs') as { readFileSync: (p: string, e: string) => string };
const { join } = require('path') as { join: (...p: string[]) => string };

import { playLabelFor, playRoutineFor } from '../src/game/play';
import { LOCATION_ORDER } from '../src/world/locations';

/** BarklyRoom source, comments stripped so prose cannot satisfy an assertion. */
const room = readFileSync(join(__dirname, '..', 'src', 'ui', 'BarklyRoom.tsx'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ');

describe('a toy in his mouth beats the location', () => {
  for (const location of LOCATION_ORDER) {
    it(`the rope is a tug at the ${location}`, () => {
      expect(playRoutineFor('toy_rope', location)).toBe('tug');
      expect(playLabelFor(playRoutineFor('toy_rope', location), location, false)).toBe('tug');
    });

    it(`the ball is a ball at the ${location}`, () => {
      expect(playRoutineFor('toy_ball', location)).toBe('ball');
    });
  }

  it('the park does NOT override the rope — the original bug', () => {
    expect(playRoutineFor('toy_rope', 'park')).not.toBe('ball');
    expect(playLabelFor(playRoutineFor('toy_rope', 'park'), 'park', false)).not.toBe('fetch');
  });
});

describe('with nothing in his mouth, the place decides', () => {
  it('the beach is for chasing water', () => {
    expect(playRoutineFor(null, 'beach')).toBe('waves');
  });

  it('the park is still a throw, and still called fetch', () => {
    expect(playRoutineFor(null, 'park')).toBe('ball');
    expect(playLabelFor('ball', 'park', false)).toBe('fetch');
  });

  it('at home with nothing he improvises', () => {
    expect(playRoutineFor(null, 'home')).toBe('none');
    expect(playLabelFor('none', 'home', false)).toBe('play');
  });

  it('an unknown item id does not invent a routine', () => {
    expect(playRoutineFor('collar_red', 'home')).toBe('none');
  });
});

describe('the button says what is happening', () => {
  it('never shows a stale verb while the animation runs', () => {
    expect(playLabelFor('tug', 'park', true)).toBe('tugging…');
    expect(playLabelFor('waves', 'beach', true)).toBe('chasing…');
    expect(playLabelFor('ball', 'park', true)).toBe('fetching…');
  });
});

/**
 * The screen must render the prop from the SAME value it labels the button
 * with. The flying ball used to be gated on `fetching` alone, so a tug threw
 * a ball across the screen while the button said "tugging".
 */
describe('the screen reads one value', () => {

  it('the thrown prop is gated on the routine, not merely on "fetching"', () => {
    expect(room).toMatch(/fetching && routine === 'ball'/);
  });

  it('the button label and the handler come from the same routine', () => {
    expect(room).toMatch(/playRoutineFor\(barkly\.toy\?\.id, location\)/);
    expect(room).toMatch(/playLabelFor\(routine,/);
  });
});
