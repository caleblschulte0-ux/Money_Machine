/**
 * Walking somewhere else has to leave the old place behind.
 *
 * `goTo` cleared the NPC's line, the open encounter and the last exchange —
 * but not his thought, which lingers for 5.2 seconds. Tap "park" while he is
 * mid-thought at home and he stands on the grass thinking "the window shows
 * outside": a location-aware line delivered in the wrong location. Nothing
 * errors; the character just stops knowing where he is, which is the exact
 * failure this whole app is trying not to have.
 *
 * The bug is one missing line among four that look identical, so the guard is
 * a list of what "belongs to a place" and an assertion that travel drops all
 * of it. A fifth piece of place-bound state added later fails here until it is
 * added to `goTo` too.
 */

declare const require: (m: string) => any;
declare const __dirname: string;
const { readFileSync } = require('fs') as { readFileSync: (p: string, enc: string) => string };
const { join } = require('path') as { join: (...p: string[]) => string };

const src = readFileSync(join(__dirname, '..', 'src', 'hooks', 'useBarkly.ts'), 'utf8');

/** Everything that is true of WHERE he is, not of who he is. */
const PLACE_BOUND = ['setNpcBubble', 'setActiveEncounter', 'setLastExchange', 'setThought'];

describe('travel clears place-bound state', () => {
  const body = (() => {
    const at = src.indexOf('const goTo = useCallback(');
    expect(at).toBeGreaterThan(-1);
    // To the end of that callback: the next top-level `const … = useCallback(`.
    const next = src.indexOf('const ', src.indexOf('\n', at) + 1);
    const end = src.indexOf('useCallback(', next) > -1 ? src.indexOf('const npcTalk', at) : src.length;
    return src.slice(at, end > at ? end : src.length);
  })();

  for (const setter of PLACE_BOUND) {
    it(`goTo resets ${setter}`, () => {
      expect(body).toMatch(new RegExp(`${setter}\\(null\\)`));
    });
  }

  it('the refusal is not silent — a locked place gets an answer', () => {
    expect(body).toMatch(/lockedAreaLine/);
  });
});
