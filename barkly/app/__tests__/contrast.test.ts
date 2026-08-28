/**
 * Text you can actually read.
 *
 * A browser audit of the built app found FORTY-ONE text elements below the
 * WCAG AA threshold, several badly: the "talk" button at 2.18:1, the speaker
 * name on the dialogue panel at 2.77:1, every shop price at 2.38:1, and the
 * location tabs at 4.10:1 against a 4.5 requirement.
 *
 * They were not forty-one mistakes. They were three tokens — `inkSoft`,
 * `inkFaint` and `gold` — used everywhere, none of which had ever been
 * measured. `theme.ts` said of `inkFaint`: "Tertiary: hints, counts, disabled
 * text. Still passes on paper." It measured 2.69:1 on paper. A comment
 * asserting a number nobody computed is worse than no comment, because the
 * next person reads it and stops checking.
 *
 * So the ramp is fixed AND the claim is now a test. This is the file that
 * makes the docstrings in theme.ts true.
 *
 * Two rules:
 *   1. every token used as text clears 4.5:1 on every surface it can sit on;
 *   2. `inkFaint` and `gold` are NOT text colours — they are a hairline and a
 *      surface — and the source is scanned to keep them out of `color:`.
 *
 * (This app is for children. "Readable enough for an adult with good light"
 * is the weakest possible place to make that argument.)
 */

declare const require: (m: string) => any;
declare const __dirname: string;
const { readdirSync, readFileSync, statSync } = require('fs') as {
  readdirSync: (p: string) => string[];
  readFileSync: (p: string, enc: string) => string;
  statSync: (p: string) => { isDirectory(): boolean };
};
const { join } = require('path') as { join: (...p: string[]) => string };

import { color } from '../src/ui/theme';

/** Relative luminance, per WCAG 2.1. */
function luminance(hex: string): number {
  const n = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Every background text is ever set on, lightest to darkest. */
const SURFACES = {
  card: color.card,
  paper: color.paper,
  well: color.well,
  fill: color.fill,
  goldWell: color.goldWell,
  dangerWell: color.dangerWell,
  warmWell: color.warmWell,
  goodWell: color.goodWell,
};

/** Tokens that carry TEXT, and therefore have to be legible. */
const TEXT_TOKENS = {
  ink: color.ink,
  inkMid: color.inkMid,
  inkSoft: color.inkSoft,
  goldInk: color.goldInk,
};

const AA = 4.5;

describe('every text colour clears WCAG AA on every surface', () => {
  for (const [token, value] of Object.entries(TEXT_TOKENS)) {
    for (const [surface, bg] of Object.entries(SURFACES)) {
      it(`${token} on ${surface}`, () => {
        const ratio = contrast(value, bg);
        // The message carries the number, so a failure says what to fix.
        expect({ token, surface, ratio: Number(ratio.toFixed(2)) }).toEqual({
          token,
          surface,
          ratio: expect.any(Number),
        });
        expect(ratio).toBeGreaterThanOrEqual(AA);
      });
    }
  }
});

/**
 * The app has DARK surfaces too, and the first version of this file forgot
 * them — which is how the Pack Book shipped its stage blurb in `inkSoft` on
 * an `ink` card at 2.07:1 while every test here passed. A contrast suite that
 * only checks one direction gives exactly the false confidence the theme
 * comment used to give.
 */
const DARK_SURFACES = {
  ink: color.ink,
  inkMid: color.inkMid,
  brand: color.brand,
  danger: color.danger,
};

/**
 * Which light token may sit on which dark surface.
 *
 * Not a cross-product: `goldSoft` on `brand` is 3.35:1 and `fill` on `brand`
 * is 4.39, and neither pair exists in the app. Asserting every combination
 * would fail on two arrangements nobody has made — a test shaped by
 * arithmetic rather than by the design, which then gets relaxed and stops
 * meaning anything. This is the contract the screens actually keep: the three
 * near-whites go anywhere dark; the two tinted lights are for `ink` only.
 */
const REVERSED_TOKENS: Record<string, { value: string; on: (keyof typeof DARK_SURFACES)[] }> = {
  inkOn: { value: color.inkOn, on: ['ink', 'inkMid', 'brand', 'danger'] },
  paper: { value: color.paper, on: ['ink', 'inkMid', 'brand', 'danger'] },
  card: { value: color.card, on: ['ink', 'inkMid', 'brand', 'danger'] },
  fill: { value: color.fill, on: ['ink', 'inkMid', 'danger'] },
  goldSoft: { value: color.goldSoft, on: ['ink'] },
};

describe('reversed text clears AA too', () => {
  for (const [token, spec] of Object.entries(REVERSED_TOKENS)) {
    for (const surface of spec.on) {
      it(`${token} on ${surface}`, () => {
        expect(contrast(spec.value, DARK_SURFACES[surface])).toBeGreaterThanOrEqual(AA);
      });
    }
  }
});

describe('the ink ramp is a ramp', () => {
  it('each step is meaningfully lighter than the one above it', () => {
    const steps = [color.ink, color.inkMid, color.inkSoft].map((c) => contrast(c, color.card));
    for (let i = 1; i < steps.length; i += 1) {
      expect(steps[i]).toBeLessThan(steps[i - 1]);
      // Two tokens a hair apart is a redundant step pretending to be a
      // hierarchy — the reason this is three weights and not four.
      expect(steps[i - 1] - steps[i]).toBeGreaterThan(1);
    }
  });
});

/**
 * The two tokens that are surfaces and hairlines, not text.
 *
 * Keeping them out of `color:` is what stops the ramp being quietly undone by
 * the next screen that wants something "a bit lighter" — the exact way the
 * forty-one failures accumulated in the first place.
 */
describe('non-text tokens stay out of text', () => {
  const UI = join(__dirname, '..', 'src', 'ui');
  function files(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) files(full, out);
      else if (/\.tsx?$/.test(entry) && !full.endsWith('theme.ts')) out.push(full);
    }
    return out;
  }

  for (const file of files(UI)) {
    const short = file.slice(file.indexOf('src/'));
    it(`${short}: no inkFaint or bare gold as a text colour`, () => {
      const src = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/.*$/gm, '$1 ');
      expect(src).not.toMatch(/color: color\.inkFaint/);
      expect(src).not.toMatch(/color: color\.gold(?![A-Za-z])/);
    });
  }
});
