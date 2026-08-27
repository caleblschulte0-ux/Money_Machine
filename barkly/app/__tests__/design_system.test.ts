/**
 * The design system, enforced.
 *
 * The app got the feedback "this still feels like AI vibe-code HTML", and the
 * measurement backed it up exactly. Across src/ui there were THREE different
 * "ink" browns, THREE "soft" greys, two golds, two card whites, 30 distinct
 * font sizes, 25 corner radii, 223 hex values and 18 hand-rolled shadows —
 * eleven files each declaring `const INK = ...` slightly differently.
 *
 * Nobody chose three inks. Three files were written separately and never
 * compared, and the result is the specific look of software assembled rather
 * than designed: you cannot point at the bug, it just reads cheap.
 *
 * A one-time cleanup fixes it once. These tests are what stop the fifteenth
 * screen from arriving with a fourth brown.
 */

declare const require: (m: string) => any;
declare const __dirname: string;
const { readdirSync, readFileSync, statSync } = require('fs') as {
  readdirSync: (p: string) => string[];
  readFileSync: (p: string, enc: string) => string;
  statSync: (p: string) => { isDirectory(): boolean };
};
const { join } = require('path') as { join: (...p: string[]) => string };

import { RADII, TYPE_SIZES } from '../src/ui/theme';

const UI = join(__dirname, '..', 'src', 'ui');

/**
 * Files that legitimately hold raw colour: the theme itself, and ART.
 *
 * A mascot's fur and a park's grass are not chrome — tokenising them would be
 * actively wrong (his coat is not "the coins colour" just because the hex
 * matched). They keep their own sampled palettes, on purpose, and are named
 * here so the exemption is a decision rather than an oversight.
 */
const ART = new Set(['theme.ts', 'artPalette.ts', 'BarklyView.tsx', 'StageProps.tsx', 'Scenes.tsx']);

function uiFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) uiFiles(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const chrome = uiFiles(UI).filter((f) => !ART.has(f.split('/').pop()!));

/** Strip comments: a hex quoted in prose is documentation, not styling. */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ');
}

describe('one palette', () => {
  it('there are chrome files to check', () => {
    expect(chrome.length).toBeGreaterThan(8);
  });

  for (const file of chrome) {
    const short = file.slice(file.indexOf('src/'));

    it(`${short}: declares no palette of its own`, () => {
      // This is the exact shape the drift took: `const INK = '#3E332A';`
      const own = code(file).match(/const\s+(INK|INK_SOFT|SOFT|CARD|PAPER|GOLD|LINE|WELL|BG)\s*=/g);
      expect(own ?? []).toEqual([]);
    });

    it(`${short}: uses tokens, not raw hex`, () => {
      const raw = [...new Set(code(file).match(/#[0-9A-Fa-f]{6}\b/g) ?? [])];
      expect(raw).toEqual([]);
    });
  }
});

describe('one type scale', () => {
  for (const file of chrome) {
    const short = file.slice(file.indexOf('src/'));
    it(`${short}: every font size is on the scale`, () => {
      const sizes = [...(code(file).matchAll(/fontSize: ([0-9.]+)/g))].map((m) => Number(m[1]));
      const off = [...new Set(sizes.filter((s) => !TYPE_SIZES.includes(s)))];
      expect(off).toEqual([]);
    });
  }

  it('the scale itself stays small — eight steps plus three glyph sizes', () => {
    expect(TYPE_SIZES.length).toBeLessThanOrEqual(11);
  });
});

describe('one set of corners', () => {
  for (const file of chrome) {
    const short = file.slice(file.indexOf('src/'));
    it(`${short}: every radius is on the scale`, () => {
      const radii = [...(code(file).matchAll(/borderRadius: ([0-9.]+)/g))].map((m) => Number(m[1]));
      const off = [...new Set(radii.filter((r) => !RADII.includes(r)))];
      expect(off).toEqual([]);
    });
  }
});

describe('one elevation ramp', () => {
  for (const file of chrome) {
    const short = file.slice(file.indexOf('src/'));
    it(`${short}: no hand-rolled shadows`, () => {
      // Every shadow comes from theme.elevation, which is the only place that
      // knows React Native Web ignores the native shadow props.
      expect(code(file)).not.toMatch(/shadowColor|shadowOffset|boxShadow/);
    });
  }
});
