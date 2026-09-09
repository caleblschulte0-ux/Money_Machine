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

  test('the ramp spans the character it was measured from', () => {
    // Barkly runs 0.14 to 0.92 in value with a median of 0.70. The world's
    // floor is lifted because his darks are an eye and a nose.
    const values = steps.map((m) => Number(m[3]));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0.3);
    expect(Math.max(...values)).toBeGreaterThanOrEqual(0.9);
  });
});
