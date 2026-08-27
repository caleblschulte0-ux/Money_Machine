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

import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const html = resolve(arg('--html', 'barkly-artifact.html'));
if (!existsSync(html)) {
  console.error(`no such file: ${html}\nBuild it first: node scripts/build-artifact.mjs`);
  process.exit(2);
}
const sizes = arg('--sizes', '360x780,390x844,430x932')
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
  ['header', '[aria-label^="Shop."]'],
  ['tabs', '[aria-label="Park"]'],
  ['plan', '[aria-label^="Barkly\'s plan"]'],
  ['notice', '[aria-label*="official rival"]'],
  ['speech', 'text=/tallest bubble this app can produce/'],
  ['npc-bubble', 'text=/It might be THE stick/'],
  ['state-chip', 'text=/^listening$/'],
  ['input', 'input'],
  ['action-play', '[data-testid="play-action"]'],
];

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

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
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
