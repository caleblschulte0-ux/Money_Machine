/*
 * EVERY DOG WHO IS THERE HAS SOMEWHERE TO STAND, AND NOBODY ELSE DOES.
 *
 * NPC_SPOTS used to be keyed on the dog alone -- one spot for Biscuit, used in
 * the park and on the beach. That held only while Barkly stood at x 0.50 in
 * every place. Now SCENE_CAMERA gives each location its own `shift` and the
 * others are placed around him per place, so the table is keyed on (place,
 * dog) and the component indexes it without a guard.
 *
 * Which makes completeness a contract, not a hope: a dog added to a location
 * with no spot would render at the origin, and a leftover spot for a dog who
 * is not there is dead data that reads as intent. Both directions below.
 */
declare const require: (m: string) => any;
declare const __dirname: string;
const { readFileSync } = require('fs') as { readFileSync: (p: string, enc: string) => string };
const { join } = require('path') as { join: (...p: string[]) => string };

import { LOCATIONS, LOCATION_ORDER } from '../src/world/locations';

const room = readFileSync(join(__dirname, '..', 'src', 'ui', 'BarklyRoom.tsx'), 'utf8');

/** The `{ ... }` that starts at or after `from`, brace-matched. */
function braceBlock(src: string, from: number): string {
  if (from < 0) return '';
  const open = src.indexOf('{', from);
  if (open === -1) return '';
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return '';
}

/** The object literal a given key is assigned, whatever sits between them. */
function blockFor(src: string, key: string): string {
  return braceBlock(src, src.indexOf(`${key}:`));
}

/**
 * The table as written, read from source: it is not exported, by design.
 * Brace-matched rather than line-matched -- the first version of this parser
 * keyed on newlines and reported the one-line town and beach entries as empty,
 * which is a test passing by not looking.
 */
const TABLE = braceBlock(room, room.indexOf('const NPC_SPOTS'));

function dogsAt(place: string): string[] {
  const block = blockFor(TABLE, place);
  if (!block) return [];
  return [...block.slice(1).matchAll(/(\w+):\s*\{/g)].map((m) => m[1]);
}

describe('NPC_SPOTS covers exactly the dogs who are there', () => {
  test.each(LOCATION_ORDER)('%s', (place) => {
    const expected = [...LOCATIONS[place].npcIds].sort();
    expect(dogsAt(place).sort()).toEqual(expected);
  });

  test('the crowd stands opposite him', () => {
    // The point of the per-place table. He is shifted left in the park and on
    // the beach and right in town (SCENE_CAMERA.shift), so the others take
    // the side he left. A spot on his own side is how he ended up standing
    // in Biscuit's shoulder the first time the shift went in.
    const world = readFileSync(join(__dirname, '..', 'src', 'ui', 'scenes', 'WorldScene.tsx'), 'utf8');
    const cam = world.slice(world.indexOf('export const SCENE_CAMERA'));
    for (const place of LOCATION_ORDER) {
      const ids = LOCATIONS[place].npcIds;
      if (ids.length === 0) continue;
      const shift = Number(cam.match(new RegExp(`${place}: \\{[^}]*shift: (-?[\\d.]+)`))![1]);
      const block = blockFor(TABLE, place);
      const side = shift < 0 ? 'right' : 'left';
      for (const id of ids) {
        expect(blockFor(block, id)).toContain(`${side}:`);
      }
    }
  });
});
