/*
 * ONE PALETTE, AND IT IS THE ONLY PLACE A COLOUR COMES FROM.
 *
 * Measured 2026-09-09, before `tools/blender/palette.py` existed: the render
 * packs between them named **255 distinct colours in 274 uses**. Almost every
 * colour in the game had been chosen once, by hand, at the moment somebody
 * wrote that prop, and never seen beside the others -- saturation across the
 * world ran 0.04 to 0.98 and value ran 0.18 to 1.00. That is not an art style,
 * and it is why the four places did not look like one game. No amount of
 * texture, lighting or composition work reaches it, and three sessions of that
 * work proved it.
 *
 * Worse, the three packs lit their art with THREE DIFFERENT SUNS: the prop
 * pack at (1.00, 0.77, 0.58) key over a (0.58, 0.78, 1.00) fill, the park
 * plate at #FFE2B4 over #7FA8C8, the beach plate at #FFE9C4 over #8FC0DC --
 * for art that is composited into the same frame. Scenes lit by different
 * lights cannot match whatever colour anything is painted.
 *
 * Both are now one file. This test is what keeps them there: the next hex
 * typed into a render pack fails here, with this note attached, instead of
 * quietly becoming the 256th colour.
 */
declare const require: (m: string) => any;
declare const __dirname: string;
const { readdirSync, readFileSync } = require('fs') as {
  readdirSync: (p: string) => string[];
  readFileSync: (p: string, enc: string) => string;
};
const { join } = require('path') as { join: (...p: string[]) => string };

const DIR = join(__dirname, '..', 'tools', 'blender');
const packs = readdirSync(DIR).filter((f: string) => f.endsWith('.py') && f !== 'palette.py');

describe('the render packs state no colours of their own', () => {
  test('there are packs to check', () => {
    expect(packs.length).toBeGreaterThanOrEqual(3);
  });

  test.each(packs)('%s has no hex literal', (file: string) => {
    const src = readFileSync(join(DIR, file), 'utf8');
    const hexes = src.match(/["']#[0-9A-Fa-f]{6}["']/g) ?? [];
    expect(hexes).toEqual([]);
  });

  test.each(packs)('%s lights with the shared key and fill', (file: string) => {
    const src = readFileSync(join(DIR, file), 'utf8');
    const lamps = src.match(/\.data\.color\s*=\s*(.+)/g) ?? [];
    for (const line of lamps) {
      // Either the shared lamp, or a value threaded through from SCENES,
      // which is itself light_hex(). A literal tuple is a fourth sun.
      expect(line).toMatch(/light_rgb\(|light_hex\(|pack\.rgb\(/);
      expect(line).not.toMatch(/=\s*\(\s*[\d.]+\s*,/);
    }
  });

  test('every material takes a palette tone', () => {
    for (const file of packs) {
      const src = readFileSync(join(DIR, file), 'utf8');
      const calls = src.match(/material\(\s*f?"[^"]*"[^,]*,\s*([^,)]+)/g) ?? [];
      for (const call of calls) {
        const arg = call.slice(call.lastIndexOf(',') + 1).trim();
        // A tone, a variable holding one, or a colour threaded in as an
        // argument. Never a literal.
        expect(arg).not.toMatch(/^["']#/);
      }
    }
  });
});

describe('the palette itself', () => {
  const src = readFileSync(join(DIR, 'palette.py'), 'utf8');
  // The STEPS block only: FAMILIES entries are also three numbers in a tuple,
  // and the first version of this test matched both and counted twenty-two
  // steps. A test that reads the wrong block is a test that passes for the
  // wrong reason.
  const stepBlock = src.slice(src.indexOf('STEPS = {'), src.indexOf('}', src.indexOf('STEPS = {')));
  const steps = [...stepBlock.matchAll(/"(\w+)":\s*\(\s*([\d.]+),\s*([\d.]+),\s*(-?[\d.]+)\s*\)/g)];

  test('every family gets every step', () => {
    // The value structure repeating under every surface is the thing that
    // makes a world read as one game. A family that skipped a step would be
    // a surface lit differently from its neighbours.
    expect(steps.length).toBe(5);
    const values = steps.map((m) => Number(m[3]));
    expect(values).toEqual([...values].sort((a, b) => a - b)); // dark to light
  });

  test('the ramp reaches a real dark and a real highlight', () => {
    /*
     * THIS TEST USED TO ASSERT THE OPPOSITE and it was wrong.
     *
     * It required `Math.min(values) >= 0.3`, freezing in the belief that a
     * floor kept the world out of the mud. Measured against the reference art
     * the operator asked for -- a Brawl Stars loading screen -- that belief is
     * what was making everything look washed out:
     *
     *                      value p05   range   below 0.25   sat p95
     *     Brawl Stars         0.12      0.87      18.8%      0.91
     *     Barkly park         0.56      0.44       0.1%      0.67
     *
     * A picture with no darks has no contrast. The ramp has to REACH.
     */
    const values = steps.map((m) => Number(m[3]));
    expect(Math.min(...values)).toBeLessThanOrEqual(0.2);
    expect(Math.max(...values)).toBeGreaterThanOrEqual(0.95);
    // ...and the chroma has to reach too: theirs tops out at 0.91.
    const sats = steps.map((m) => Number(m[2]));
    expect(Math.max(...sats)).toBeGreaterThanOrEqual(0.9);
  });
});

describe('a surface still has grain', () => {
  /*
   * NO TWO MATERIALS IN ONE BUILDER MAY BE THE SAME TONE.
   *
   * This is the failure the palette introduced and it was worse than the
   * problem it fixed. Mapping 196 hand-picked colours onto the ramp by name,
   * "Paving slab", "Paving slab b" and "Paving slab c" all landed on
   * `paving.base` -- three tones that made a pavement read as slabs became one
   * flat wash. Same for the home floor's three boards, the beach headland's
   * four rocks, and the near grass. The town's street and the home's floor
   * came back from the re-render as empty planes, and the reason was not the
   * palette, it was three names that differ by one letter.
   *
   * Some of them were plain mistakes too: a bench's IRON took the wood family
   * because "bench" matched before "iron", a palm's TRUNK took foliage because
   * "palm" matched before "trunk", a lamp's BRASS took metal, a flower's STEM
   * took berry.
   */
  const dirFiles = readdirSync(DIR).filter((f: string) => f.endsWith('.py') && f !== 'palette.py');

  test.each(dirFiles)('%s gives its siblings different tones', (file: string) => {
    const src = readFileSync(join(DIR, file), 'utf8');
    const fns = [...src.matchAll(/^def (\w+)/gm)].map((m) => ({ at: m.index ?? 0, name: m[1] }));
    const owner = (pos: number) => {
      let name = '<module>';
      for (const f of fns) {
        if (f.at < pos) name = f.name;
        else break;
      }
      return name;
    };
    const seen = new Map<string, string[]>();
    for (const m of src.matchAll(/material\(\s*f?"([^"]+)"\s*,\s*tone\("(\w+)",\s*"(\w+)"\)/g)) {
      const key = `${owner(m.index ?? 0)}|${m[2]}.${m[3]}`;
      seen.set(key, [...(seen.get(key) ?? []), m[1]]);
    }
    const collapsed = [...seen.entries()]
      .filter(([, names]) => names.length > 1)
      // A distance ramp legitimately repeats its furthest step; anything that
      // is meant to read as one surface has to be named as one material.
      .filter(([key]) => !key.endsWith('.pop'))
      .map(([key, names]) => `${key}: ${names.join(', ')}`);
    expect(collapsed).toEqual([]);
  });
});
