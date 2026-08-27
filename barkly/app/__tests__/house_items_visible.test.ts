/**
 * If you can buy it for the house, it has to be IN the house.
 *
 * `home_bed` is the first house item you can afford — level 2, 220 coins — and
 * it was drawn only while he was asleep. You bought it, the shop said "out",
 * and the room looked exactly the same; the only way to see the thing you paid
 * for was to put him to bed. The rug and the window had been wired into the
 * scene and the bed simply never was, and nothing anywhere would have told us.
 *
 * A screenshot test would be the thorough version. This is the cheap version
 * that would have caught it: every purchasable house item must be referenced
 * by the scene that draws the house.
 */

declare const require: (m: string) => any;
declare const __dirname: string;
const { readFileSync } = require('fs') as { readFileSync: (p: string, enc: string) => string };
const { join } = require('path') as { join: (...p: string[]) => string };

import { STORE } from '../src/game/progression';

/**
 * Comments do not count.
 *
 * The first version of this test searched the raw file and passed with the
 * bug reintroduced, because the id appeared in the doc comment ABOVE the
 * component explaining the bug. A test that matches its own prose is worse
 * than no test: it reports coverage it does not have.
 */
function code(path: string[]): string {
  return readFileSync(join(__dirname, '..', ...path), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ');
}

const SCENES = code(['src', 'ui', 'scenes', 'Scenes.tsx']);
const ROOM = code(['src', 'ui', 'BarklyRoom.tsx']);

describe('everything you can buy is visible', () => {
  const houseItems = STORE.filter((item) => item.slot === 'home');

  it('there are house items to check', () => {
    expect(houseItems.length).toBeGreaterThan(0);
  });

  for (const item of houseItems) {
    it(`${item.id} (${item.name}) is drawn in the room`, () => {
      expect(SCENES.includes(item.id)).toBe(true);
    });
  }

  it('wearables and toys reach the renderer too', () => {
    // Collars tint the sprite; a toy is a prop beside him. Both go through the
    // controller rather than by id, so this checks the wiring exists at all.
    expect(ROOM).toMatch(/collarColor/);
    expect(ROOM).toMatch(/barkly\.toy/);
  });

  it('every store item has an icon and a blurb, so no row is a blank', () => {
    for (const item of STORE) {
      expect(item.icon.length).toBeGreaterThan(0);
      expect(item.blurb.length).toBeGreaterThan(4);
      expect(item.name.length).toBeGreaterThan(2);
    }
  });

  it('no two store items share an id', () => {
    expect(new Set(STORE.map((i) => i.id)).size).toBe(STORE.length);
  });
});
