#!/usr/bin/env node
/**
 * "Pretend everything that could ever pop up on the screen popped up at once."
 *
 * That was the brief, and this is it as a check you can run. It opens the
 * built web artifact, turns on the Settings → Developer → "Everything at once"
 * switch, and measures the on-screen box of every overlay. Any two that
 * intersect is a failure, with the offending pair and the overlap in pixels.
 *
 *     node scripts/overlap-check.mjs [--html path] [--sizes 390x844,414x896]
 *
 * Run it at several screen sizes: a layout that only holds on a big phone is
 * not a layout. The numbers it is checking live in src/ui/layout.ts.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Playwright may be a devDependency here or installed globally on the machine.
 * ESM ignores NODE_PATH, so a bare import of the global one throws — try the
 * three real places rather than failing with a module-not-found that looks
 * like the CHECK is broken when only the install location moved.
 */
async function loadChromium() {
  for (const m of ['playwright', 'playwright-core', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
    try {
      return (await import(m)).chromium;
    } catch {}
  }
  console.error('playwright is not installed — run `npm ci` (it is a devDependency).');
  process.exit(2);
}
const chromium = await loadChromium();

/**
 * Where the browser is.
 *
 * Playwright downloads its own Chromium; some environments (this repo's
 * sandbox, some CI images) provide one instead and set PLAYWRIGHT_BROWSERS_PATH.
 * Hardcoding a path meant this script only ran in the one place it was
 * written, which for a check is the same as not running.
 */
function browserOptions() {
  const args = ['--no-sandbox'];
  for (const candidate of [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium']) {
    if (candidate && existsSync(candidate)) return { executablePath: candidate, args };
  }
  return { args };
}

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const html = resolve(arg('--html', 'barkly-artifact.html'));
if (!existsSync(html)) {
  console.error(`no such file: ${html}\nBuild it first: node scripts/build-artifact.mjs`);
  process.exit(2);
}
/**
 * The spread, not a device list. 360x640 is the short-phone floor still in
 * circulation, 375x667 is the iPhone SE, 390x844 the mid-range, 412x915 a
 * wide tall Android, 430x932 the biggest current phone. The point of testing
 * the ENDS is that anything fluid between them holds everywhere in between;
 * anything pinned to one device breaks at one of the ends and gets caught.
 */
const sizes = arg('--sizes', '360x640,375x667,390x844,412x915,430x932')
  .split(',')
  .map((s) => {
    const [w, h] = s.split('x').map(Number);
    return { width: w, height: h };
  });

/**
 * The overlays, by accessible name or text. Anything that can be on screen at
 * the same time as anything else belongs here — that is the whole point.
 */
const TARGETS = [
  // Header internals, not just the header as a block: the coin count printing
  // through "Lv 1" at 360px was invisible to a whole-header measurement.
  ['coin-pill', '[aria-label^="Shop."]'],
  ['pack', '[aria-label^="Pack Book"]'],

  ['settings', '[aria-label="Settings"]'],
  ['tabs', '[aria-label="Park"]'],
  ['plan', '[aria-label^="Barkly\'s plan"]'],
  ['notice', '[aria-label*="official rival"]'],
  ['dialogue', '[data-testid="dialogue-panel"]'],
  ['state-chip', 'text=/^listening$/'],
  ['input', 'input'],
  // His things, on the floor in front of him. These replaced the PLAY | FEED |
  // SLEEP row; the middle one landed between his front paws on the first cut,
  // which is why they are measured against the dog below.
  ['kit-feed', '[data-testid="kit-feed"]'],
  ['kit-play', '[data-testid="kit-play"]'],
  ['kit-sleep', '[data-testid="kit-sleep"]'],
];

/**
 * The rule that is not a heuristic: HIS FACE IS NEVER COVERED.
 *
 * The old layout floated his speech over his head and relied on measurement to
 * keep it off him. Now the stage and the dialogue band are disjoint by
 * construction — so this pair is checked explicitly, at every size, and a
 * single pixel of intersection fails. If a future change floats something over
 * the stage again, this is what says so.
 */
const NEVER_OVER_THE_DOG = ['dialogue', 'notice', 'input'];

/**
 * His things are FOREGROUND, and foreground is allowed to overlap him.
 *
 * The shelf sits nearer the camera than he does, so it legitimately covers the
 * bottom of his bounding box — most of which is the transparent padding under
 * a contain-fitted sprite anyway. Forbidding that outright would forbid depth.
 *
 * What is never allowed is a bowl reaching his FACE. So the rule for these is
 * the top of the object must stay below the dog's midline: they may sit around
 * his paws, they may not climb his body. That is the honest version of "speech
 * must never cover anyone's face" applied to something that is meant to be in
 * front of him.
 */
const BELOW_HIS_MIDLINE = ['kit-feed', 'kit-play', 'kit-sleep'];


/**
 * Every target must be found. A green run with the speech bubble missing is
 * not a green run — it is a broken selector, and that is exactly how a layout
 * check quietly stops checking anything.
 */

const overlap = (a, b) => {
  const x = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const y = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return x > 0 && y > 0 ? { x: Math.round(x), y: Math.round(y) } : null;
};

const browser = await chromium.launch(browserOptions());
let failures = 0;

for (const size of sizes) {
  const ctx = await browser.newContext({ viewport: size });
  const page = await ctx.newPage();
  await page.goto('file://' + html);
  await page.waitForTimeout(2600);

  // Through onboarding.
  for (let i = 0; i < 6; i++) {
    const input = page.locator('input:visible').first();
    if (await input.count()) {
      const ph = (await input.getAttribute('placeholder')) || '';
      if (/name|call/i.test(ph)) await input.fill('Caleb');
    }
    const btn = page.getByRole('button').filter({ hasText: /^(hi|tell him|next|okay|skip)$/i }).first();
    if ((await btn.count()) && (await btn.isEnabled())) {
      await btn.click();
      await page.waitForTimeout(800);
    } else break;
  }
  await page.waitForTimeout(1200);

  // Settings → Everything at once.
  await page.getByLabel('Settings').first().click();
  await page.waitForTimeout(700);
  const toggle = page.getByLabel(/Everything at once/i).first();
  if (!(await toggle.count())) {
    console.error(`${size.width}x${size.height}: no "Everything at once" switch — is the dev section hidden?`);
    failures++;
    await ctx.close();
    continue;
  }
  await toggle.click();
  await page.waitForTimeout(400);
  const close = page.getByText('✕', { exact: true }).first();
  if (await close.count()) await close.click();
  // Park, so the NPC bubbles are in play too.
  const park = page.getByText('park', { exact: true }).first();
  if (await park.count()) await park.click();
  await page.waitForTimeout(1600);

  // Measured separately: he is not an "overlay", he is what the overlays must
  // stay off. The stage is his and the check below proves it.
  const dogEl = page.locator('[data-testid="barkly-sprite"]').first();
  const dog = (await dogEl.count()) ? await dogEl.boundingBox() : null;
  if (!dog) {
    failures++;
    console.log('  MISSING: barkly-sprite — cannot check that his face stays clear');
  }

  const boxes = [];
  for (const [name, sel] of TARGETS) {
    const el = page.locator(sel).first();
    const box = (await el.count()) ? await el.boundingBox() : null;
    if (!box) {
      failures++;
      console.log(`  MISSING: ${name} — selector found nothing (${sel})`);
      continue;
    }
    boxes.push({ name, ...box });
  }

  await page.screenshot({ path: `overlap-${size.width}x${size.height}.png` });

  console.log(`\n${size.width}x${size.height} — ${boxes.length} overlays measured`);
  let clashes = 0;
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const hit = overlap(boxes[i], boxes[j]);
      if (hit) {
        clashes++;
        failures++;
        console.log(`  COLLIDES: ${boxes[i].name} × ${boxes[j].name}  (${hit.x}px × ${hit.y}px)`);
      }
    }
  }
  // His things may be in front of him, but never up at his face.
  if (dog) {
    const midline = dog.y + dog.height * 0.5;
    for (const b of boxes.filter((x) => BELOW_HIS_MIDLINE.includes(x.name))) {
      if (b.y < midline) {
        failures++;
        console.log(
          `  CLIMBING HIM: ${b.name} top is ${Math.round(midline - b.y)}px above the dog's midline`,
        );
      }
    }
  }

  // The rule: nothing lands on him.
  if (dog) {
    for (const b of boxes.filter((x) => NEVER_OVER_THE_DOG.includes(x.name))) {
      const hit = overlap(b, dog);
      if (hit) {
        failures++;
        console.log(`  ON HIS FACE: ${b.name} covers the dog (${hit.x}px × ${hit.y}px)`);
      }
    }
  }

  // Nothing may run off the bottom or the top either.
  for (const b of boxes) {
    if (b.y < 0 || b.y + b.height > size.height) {
      failures++;
      console.log(`  OFF SCREEN: ${b.name} at y=${Math.round(b.y)} h=${Math.round(b.height)}`);
    }
  }
  if (clashes === 0) console.log('  no collisions');
  await ctx.close();
}

await browser.close();
console.log(failures === 0 ? '\nPASS — everything fits.' : `\nFAIL — ${failures} problem(s).`);
process.exit(failures === 0 ? 0 : 1);
