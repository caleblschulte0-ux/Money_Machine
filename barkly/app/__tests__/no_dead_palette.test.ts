/**
 * A colour nothing paints with.
 *
 * `no_dead_styles` made a stylesheet entry with no reference a test failure,
 * for the reason that a file half design and half sediment is a file the next
 * person copies the wrong half of. The palette is the same problem one level
 * down and had no guard: four tokens (`violetShine`, `violetNightLight`,
 * `mintLight`, `windowSillDay`) were sitting in `artPalette.ts` with no
 * consumer anywhere in the app, which is how a palette stops being the answer
 * to "what colour is this thing" and becomes a list of colours someone once
 * considered.
 *
 * A token used only by the palette itself still counts as used, so a derived
 * ramp is fine. Only `src/` counts as a consumer: a colour referenced solely
 * from a test is not a colour anything paints with -- and scanning the tests
 * would have made THIS file, which names the four dead tokens above, keep them
 * all alive.
 */

declare const require: (m: string) => any;
declare const __dirname: string;
const { readdirSync, readFileSync, statSync } = require('fs') as {
  readdirSync: (p: string) => string[];
  readFileSync: (p: string, enc: string) => string;
  statSync: (p: string) => { isDirectory(): boolean };
};
const { join } = require('path') as { join: (...p: string[]) => string };

const ROOT = join(__dirname, '..');
const PALETTE = join(ROOT, 'src', 'ui', 'scenes', 'artPalette.ts');

function files(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files(full, out);
    else if (/\.tsx?$/.test(entry) && full !== PALETTE) out.push(full);
  }
  return out;
}

describe('no dead palette tokens', () => {
  it('every colour in artPalette.ts is painted with somewhere', () => {
    const palette = readFileSync(PALETTE, 'utf8');
    const tokens = [...palette.matchAll(/^ {2}([a-zA-Z][a-zA-Z0-9]*): '#/gm)].map((m) => m[1]);
    expect(tokens.length).toBeGreaterThan(100);

    const consumers = files(join(ROOT, 'src'))
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');

    // A token referenced only from inside the palette (a derived ramp) is
    // still a live colour; anything with no reader outside it is not.
    const selfUse = (name: string) =>
      new RegExp(`(?<!^ {2})\\b${name}\\b`, 'm').test(palette.replace(new RegExp(`^ {2}${name}:`, 'gm'), '  _:'));
    const dead = tokens.filter((t) => !new RegExp(`\\b${t}\\b`).test(consumers) && !selfUse(t));
    expect(dead).toEqual([]);
  });
});
