/**
 * `src/` and Blender must paint from ONE palette.
 *
 * `tools/blender/palette.py` says nothing outside it names a colour, and
 * `palette_source.test.ts` holds that -- for `tools/blender`. It stopped at the
 * language boundary, and on the far side `artPalette.ts` grew 236 hand-named
 * colours at mean saturation 0.526: the same disease, in a second file, for the
 * half of the picture the renderer does not draw.
 *
 * It stayed invisible while both halves happened to be equally loud. When the
 * world's field dropped to 0.26 the app's sky and ground haze became the
 * loudest thing on screen, and a character cannot stand out against a quiet
 * background if the glass in front of it is not.
 *
 * So the generated bridge has to be CURRENT, or it is just a third copy.
 */
import { TONE } from '../src/ui/scenes/worldPalette';

// Node globals, declared the way the sibling suites in this directory do it --
// the app is a React Native bundle, so @types/node is not in the typecheck.
declare const require: (m: string) => any;
declare const __dirname: string;
const { execFileSync } = require('child_process') as {
  execFileSync: (cmd: string, args: string[], opts: object) => unknown;
};
const { readFileSync } = require('fs') as {
  readFileSync: (p: string, enc: string) => string;
};
const { join } = require('path') as { join: (...p: string[]) => string };

const ROOT = join(__dirname, '..');

it('worldPalette.ts is current with tools/blender/palette.py', () => {
  // Exits non-zero and prints how to regenerate if palette.py has moved.
  execFileSync('python3', [join(ROOT, 'scripts/export-palette.py'), '--check'], {
    cwd: ROOT,
    stdio: 'pipe',
  });
});

it('every family carries all five steps, as real hex', () => {
  const families = Object.keys(TONE);
  expect(families.length).toBeGreaterThanOrEqual(17);
  for (const [name, steps] of Object.entries(TONE)) {
    for (const step of ['deep', 'shade', 'base', 'lit', 'pop'] as const) {
      expect(`${name}.${step}=${(steps as Record<string, string>)[step]}`).toMatch(
        /=#[0-9A-F]{6}$/,
      );
    }
  }
});

it('the scene colours in artPalette come from the palette, not from hex', () => {
  // The keys that paint the biggest areas of the screen. A hex literal here is
  // a second opinion about what colour the sky is, and this file has had one
  // before -- `groundDeepenDay` was '#2E1E3A', a purple, which is what gave
  // town a maroon floor under a warm palette.
  const src = readFileSync(join(ROOT, 'src/ui/scenes/artPalette.ts'), 'utf8');
  const mustBeDerived = [
    'skyDayZenith', 'skyDayA', 'skyDayB',
    'hazeDay', 'groundHazeDay', 'groundDeepenDay',
    'shadow', 'cream',
  ];
  for (const key of mustBeDerived) {
    const line = src.split('\n').find((l: string) => l.trim().startsWith(`${key}:`));
    expect(`${key} -> ${line?.trim()}`).toContain('TONE.');
  }
});
