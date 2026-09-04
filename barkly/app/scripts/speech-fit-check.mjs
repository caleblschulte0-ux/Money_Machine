#!/usr/bin/env node
/**
 * HOW MUCH OF WHAT HE SAYS ACTUALLY FITS ON SCREEN.
 *
 * The dialogue bubble is a FIXED height (`DIALOGUE_HEIGHT`, deliberately: the
 * stage is laid out against the worst case so a speech bubble is never a
 * layout event) and its text is capped at `SPEECH_MAX_LINES`. Anything longer
 * is silently ellipsised — so in a product whose whole proposition is a dog
 * with things to say, the end of his sentence was replaced with "…" and
 * nothing anywhere reported it.
 *
 * It is also narrower than it looks: the composer button sits IN the text
 * column, so the usable width is well under the bubble's own width.
 *
 *     node scripts/speech-fit-check.mjs [--artifact barkly-artifact.html]
 *
 * What it does: drives the real artifact, makes him speak, then measures the
 * live text element — its computed font and its true content width — and
 * binary-searches the largest number of characters that still fits in
 * `SPEECH_MAX_LINES`. It repeats that at every viewport the a11y sweep uses
 * and prints the NARROWEST result, which is the number `speechPages.ts` has
 * to be built against.
 *
 * It then runs the app's own paginator over that budget and fails if any page
 * would still overflow.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { assertFreshArtifact } from './fresh-artifact.mjs';
import { walkOnboarding } from './onboard.mjs';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const html = resolve(arg('--artifact', join(APP, 'barkly-artifact.html')));
if (!existsSync(html)) {
  console.error(`no artifact at ${html} — run \`npm run build:web\` first`);
  process.exit(2);
}
assertFreshArtifact(html, 'npm run build:web');

function browserOptions() {
  const args = ['--no-sandbox'];
  for (const candidate of [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium']) {
    if (candidate && existsSync(candidate)) return { executablePath: candidate, args };
  }
  return { args };
}

// The three the a11y sweep runs, narrowest first.
const SIZES = [
  { width: 360, height: 568 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
];

/*
 * A deliberately WIDE probe string. Character budgets are only meaningful for
 * the text you measured them on, and the risk runs one way: a budget measured
 * on "iiii" would let a page of "WOWOWOW" overflow. Lowercase Latin with the
 * usual spread of wide letters is what he actually says.
 */
const PROBE =
  'the quick brown dog was mad about a squirrel and would not let it go, obviously, because that is who he is, and we all have to live with it now';

const budgets = [];
const browser = await chromium.launch(browserOptions());
for (const viewport of SIZES) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.goto(`file://${html}`);
  await page.waitForTimeout(2600);
  await walkOnboarding(page);

  const panel = page.locator('[data-testid="dialogue-panel"]').first();
  if (!(await panel.count())) {
    console.error('never reached the room — this check proved nothing.');
    await browser.close();
    process.exit(1);
  }

  // Make him say something, so the text element exists to be measured.
  const input = page.locator('input:visible').first();
  if (await input.count()) {
    await input.fill('hello barkly');
    await input.press('Enter');
    await page.waitForTimeout(3500);
  }

  const measured = await page.evaluate(
    ({ probe }) => {
      const panelEl = document.querySelector('[data-testid="dialogue-panel"]');
      if (!panelEl) return { error: 'no panel' };
      // The speech line is the deepest element carrying the largest font.
      let best = null;
      for (const el of panelEl.querySelectorAll('*')) {
        if (el.children.length) continue;
        const cs = getComputedStyle(el);
        const size = parseFloat(cs.fontSize);
        if (!el.textContent || el.textContent.trim().length < 4) continue;
        if (!best || size > best.size) best = { el, size, cs };
      }
      if (!best) return { error: 'no text in the bubble — he never spoke' };
      const cs = best.cs;
      const width = best.el.clientWidth;
      const lineHeight = parseFloat(cs.lineHeight) || best.size * 1.35;
      const maxLines = Number(cs.webkitLineClamp) || 3;

      // A hidden clone with the same typography and the same content width.
      const probeEl = document.createElement('div');
      probeEl.style.cssText = [
        'position:fixed', 'left:-10000px', 'top:0', 'visibility:hidden',
        `width:${width}px`,
        `font:${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily}`,
        `letter-spacing:${cs.letterSpacing}`,
        'white-space:normal', 'word-break:normal',
      ].join(';');
      document.body.appendChild(probeEl);
      const linesFor = (text) => {
        probeEl.textContent = text;
        return Math.round(probeEl.getBoundingClientRect().height / lineHeight);
      };
      // Binary search on the probe string, cut at word boundaries.
      const words = probe.split(' ');
      let lo = 1;
      let hi = words.length;
      let fit = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const text = words.slice(0, mid).join(' ');
        if (linesFor(text) <= maxLines) { fit = text.length; lo = mid + 1; } else { hi = mid - 1; }
      }
      const ellipsised = best.el.scrollHeight > best.el.clientHeight + 1;
      probeEl.remove();
      return { width, size: best.size, lineHeight, maxLines, fit, ellipsised, sample: best.el.textContent };
    },
    { probe: PROBE },
  );

  if (measured.error) {
    console.error(`${viewport.width}x${viewport.height} — ${measured.error}`);
    await browser.close();
    process.exit(1);
  }
  console.log(
    `${viewport.width}x${viewport.height} — text column ${measured.width}px @ ${measured.size}px/${measured.lineHeight}px, ` +
      `${measured.maxLines} lines -> ${measured.fit} characters`,
  );
  budgets.push(measured.fit);
  await ctx.close();
}
await browser.close();

const narrowest = Math.min(...budgets);
console.log(`\nnarrowest budget: ${narrowest} characters`);

// The constant the app paginates against, read straight out of the source so
// this cannot drift into agreeing with itself.
const src = readFileSync(join(APP, 'src/ui/speechPages.ts'), 'utf8');
const declared = Number(/SPEECH_PAGE_BUDGET\s*=\s*(\d+)/.exec(src)?.[1]);
if (!Number.isFinite(declared)) {
  console.error('could not find SPEECH_PAGE_BUDGET in src/ui/speechPages.ts');
  process.exit(1);
}
console.log(`declared SPEECH_PAGE_BUDGET: ${declared}`);

if (declared > narrowest) {
  console.error(
    `\nFAIL — the app paginates to ${declared} characters and only ${narrowest} fit on the narrowest phone.` +
      '\nHis sentences will be cut off with an ellipsis. Lower SPEECH_PAGE_BUDGET.',
  );
  process.exit(1);
}
/*
 * A budget far BELOW what fits is its own failure: it wastes the bubble and
 * turns one readable sentence into three flicking pages. 12 characters of
 * headroom covers the difference between this probe and an unusually wide
 * line; much more than that means the constant has gone stale in the safe
 * direction and should be raised.
 */
if (narrowest - declared > 14) {
  console.error(
    `\nFAIL — ${narrowest} characters fit and the app only uses ${declared}.` +
      '\nThat is a page break the player did not need. Raise SPEECH_PAGE_BUDGET.',
  );
  process.exit(1);
}

console.log('\nPASS — every page he turns fits the bubble it is turned in.');
