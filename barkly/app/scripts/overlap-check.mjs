#!/usr/bin/env node
/**
 * Phone composition check.
 *
 * DOM boxes alone were not enough: Barkly's rig can visually extend beyond
 * the pressable box, so a banner could literally sit across his ears while the
 * old checker printed PASS. This check now covers compressed Safari-like
 * viewports and also protects an upper-stage clear zone on short phones.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

async function loadChromium() {
  for (const m of ['playwright', 'playwright-core', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
    try {
      return (await import(m)).chromium;
    } catch {}
  }
  console.error('playwright is not installed — run `npm ci`.');
  process.exit(2);
}
const chromium = await loadChromium();

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
 * Include installed-app shapes AND compressed browser viewports. The 568/600
 * heights intentionally mimic a phone after browser chrome/keyboard pressure;
 * a phone-first game does not get to require a perfect full-screen viewport.
 */
const sizes = arg(
  '--sizes',
  '360x568,360x640,390x844,430x932,667x375,844x390,768x1024,1024x768,820x1180,1180x820,1366x1024',
)
  .split(',')
  .map((s) => {
    const [w, h] = s.split('x').map(Number);
    return { width: w, height: h };
  });

const TARGETS = [
  ['coin-pill', '[aria-label^="Shop."]'],
  ['pack', '[aria-label^="Pack Book"]'],
  ['settings', '[aria-label="Settings"]'],
  ['tabs', '[aria-label="Park"]'],
  ['plan', '[aria-label^="Barkly\'s plan"]'],
  ['notice', '[aria-label*="official rival"]'],
  ['dialogue', '[data-testid="dialogue-panel"]'],
  ['state-chip', 'text=/^listening$/'],
  ['kit-feed', '[data-testid="kit-feed"]'],
  ['kit-play', '[data-testid="kit-play"]'],
  ['kit-sleep', '[data-testid="kit-sleep"]'],
];

const NEVER_OVER_THE_DOG = ['dialogue', 'notice'];
const BELOW_HIS_MIDLINE = ['kit-feed', 'kit-play', 'kit-sleep'];
const KIT_NAMES = ['kit-feed', 'kit-play', 'kit-sleep'];
const MIN_STAGE_GAP = 8;
const MIN_EDGE_GUTTER = 10;

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

  await page.getByLabel('Settings').first().click();
  await page.waitForTimeout(700);
  const toggle = page.getByLabel(/Everything at once/i).first();
  if (!(await toggle.count())) {
    console.error(`${size.width}x${size.height}: no Everything-at-once switch`);
    failures++;
    await ctx.close();
    continue;
  }
  await toggle.click();
  await page.waitForTimeout(400);
  const close = page.getByText('✕', { exact: true }).first();
  if (await close.count()) await close.click();
  const park = page.getByRole('tab', { name: 'Park', exact: true }).first();
  if (await park.count()) await park.click();
  await page.waitForTimeout(1600);

  const dogEl = page.locator('[data-testid="barkly-sprite"]').first();
  const dog = (await dogEl.count()) ? await dogEl.boundingBox() : null;
  if (!dog) {
    failures++;
    console.log('  MISSING: barkly-sprite');
  }

  const boxes = [];
  for (const [name, sel] of TARGETS) {
    const el = page.locator(sel).first();
    const box = (await el.count()) ? await el.boundingBox() : null;
    if (!box) {
      failures++;
      console.log(`  MISSING: ${name} (${sel})`);
      continue;
    }
    boxes.push({ name, ...box });
  }

  await page.screenshot({ path: `overlap-${size.width}x${size.height}.png`, fullPage: false });

  console.log(`\n${size.width}x${size.height} — ${boxes.length} overlays measured`);
  let clashes = 0;
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const hit = overlap(boxes[i], boxes[j]);
      if (hit) {
        clashes++;
        failures++;
        console.log(`  COLLIDES: ${boxes[i].name} × ${boxes[j].name} (${hit.x}px × ${hit.y}px)`);
      }
    }
  }

  const kitBoxes = boxes.filter((b) => KIT_NAMES.includes(b.name));
  const kitTop = kitBoxes.length ? Math.min(...kitBoxes.map((b) => b.y)) : null;
  const stateChip = boxes.find((b) => b.name === 'state-chip');

  if (dog && kitTop !== null && size.height >= size.width) {
    const dogBottom = dog.y + dog.height;
    const gap = kitTop - dogBottom;
    if (gap < MIN_STAGE_GAP) {
      failures++;
      console.log(`  DOG/DOCK CROWDING: only ${Math.round(gap)}px between Barkly and care dock; need ${MIN_STAGE_GAP}px`);
    }
  }

  if (stateChip && kitTop !== null && size.height >= size.width) {
    const chipBottom = stateChip.y + stateChip.height;
    const gap = kitTop - chipBottom;
    if (gap < MIN_STAGE_GAP) {
      failures++;
      console.log(`  CHIP/DOCK CROWDING: only ${Math.round(gap)}px between state chip and care dock; need ${MIN_STAGE_GAP}px`);
    }
  }

  if (kitBoxes.length && size.height >= size.width) {
    const left = Math.min(...kitBoxes.map((b) => b.x));
    const right = Math.max(...kitBoxes.map((b) => b.x + b.width));
    if (left < MIN_EDGE_GUTTER || size.width - right < MIN_EDGE_GUTTER) {
      failures++;
      console.log(`  DOCK EDGE CROWDING: care controls must keep ${MIN_EDGE_GUTTER}px side gutters`);
    }
  }

  if (dog) {
    const midline = dog.y + dog.height * 0.5;
    for (const b of boxes.filter((x) => BELOW_HIS_MIDLINE.includes(x.name))) {
      if (b.y < midline) {
        failures++;
        console.log(`  CLIMBING HIM: ${b.name} is ${Math.round(midline - b.y)}px above dog midline`);
      }
    }

    for (const b of boxes.filter((x) => NEVER_OVER_THE_DOG.includes(x.name))) {
      const hit = overlap(b, dog);
      if (hit) {
        failures++;
        console.log(`  ON HIS FACE: ${b.name} covers dog (${hit.x}px × ${hit.y}px)`);
      }
    }
  }

  /**
   * VISUAL rather than DOM geometry. On a compressed phone, the top 30% is
   * chrome/sky and must stay clear enough that transient banners never drift
   * into Barkly's ears even if the rig's visible pixels overflow its wrapper.
   */
  const notice = boxes.find((b) => b.name === 'notice');
  if (notice && size.height <= 720 && size.height >= size.width) {
    const clearLine = size.height * 0.30;
    const noticeBottom = notice.y + notice.height;
    if (noticeBottom > clearLine) {
      failures++;
      console.log(
        `  VISUAL CROWDING: notice ends at ${Math.round(noticeBottom)}px; short-phone clear line is ${Math.round(clearLine)}px`,
      );
    }
  }

  for (const b of boxes) {
    if (b.y < 0 || b.y + b.height > size.height) {
      failures++;
      console.log(`  OFF SCREEN: ${b.name} at y=${Math.round(b.y)} h=${Math.round(b.height)}`);
    }
  }

  if (clashes === 0) console.log('  no box collisions');
  await ctx.close();
}

await browser.close();
console.log(failures === 0 ? '\nPASS — phone composition holds.' : `\nFAIL — ${failures} phone-layout problem(s).`);
process.exit(failures === 0 ? 0 : 1);
