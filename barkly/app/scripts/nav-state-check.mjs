#!/usr/bin/env node
/**
 * Does the selected TAB agree with the shown SCENE and with the ACCESSIBILITY
 * TREE, at every step of a full location loop -- not just "did the screen
 * change when clicked"?
 *
 * A ChatGPT doctor pass (2026-09-03, against the deployed 2b13d79 build)
 * reported that navigating Town -> Beach left Town visually selected while
 * the scene had actually moved to Beach. Rapid-fire and double-click stress
 * testing against that exact commit could not reproduce a VISUAL mismatch --
 * the tab's own background colour always agreed with `location` -- so this
 * is not a repro of that half of the finding, and no fix was made for a bug
 * that does not reproduce (see rule zero: don't invent fixes for phantoms).
 *
 * But the same investigation found a REAL bug in the same family: every tab
 * shipped with no `aria-selected` in the DOM at all, in any state, because
 * `accessibilityState.selected` does not reach react-native-web's prop
 * translator -- it reads a flat `aria-selected` prop instead. A screen
 * reader had no way to tell which location was current even though the
 * paint was always right. `ui/ToyHud.tsx` now sets `aria-selected` directly.
 *
 * This check is the standing regression test for BOTH halves of that claim,
 * so a real recurrence -- of either kind -- fails loud instead of needing a
 * human to eyeball a screenshot again:
 *
 *     node scripts/nav-state-check.mjs [--artifact barkly-artifact.html]
 */

import { existsSync } from 'node:fs';
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
assertFreshArtifact(html, 'npm run build:web');
if (!existsSync(html)) {
  console.error(`no artifact at ${html} — run \`npm run build:web\` first`);
  process.exit(2);
}

function browserOptions() {
  const args = ['--no-sandbox'];
  for (const candidate of [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium']) {
    if (candidate && existsSync(candidate)) return { executablePath: candidate, args };
  }
  return { args };
}

const browser = await chromium.launch(browserOptions());
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
await page.goto(`file://${html}`);
await page.waitForTimeout(2600);

await walkOnboarding(page);

if (!(await page.locator('[data-testid="dialogue-panel"]').first().count())) {
  console.error('never reached the room — onboarding did not complete, so this check proved nothing.');
  await browser.close();
  process.exit(1);
}

/*
 * Beach is level-gated (see game/progression.AREA_UNLOCKS) and a fresh save
 * starts below it, so its tab never carries the bare "Beach" accessibility
 * label this check looks for -- a locked tab's label is a sentence, on
 * purpose, so a screen reader hears why it won't move. Load the same
 * fully-unlocked `longterm` playtest save the rest of the visual harnesses
 * use, so this check exercises the real location loop rather than stopping
 * at Town.
 */
for (let attempt = 1; attempt <= 3; attempt += 1) {
  try {
    const gear = page.getByLabel('Settings').first();
    await gear.click({ timeout: 6000 });
    await page.waitForTimeout(500);
    const entry = page.locator('[data-testid="playtest-settings"]').first();
    if (await entry.count()) {
      await entry.click({ timeout: 6000 });
      await page.waitForTimeout(600);
      const slot = page.locator('[data-testid="playtest-longterm"]').first();
      if (await slot.count()) {
        await slot.click({ force: true, timeout: 6000 });
        await page.waitForSelector('[data-testid="dialogue-panel"]', { timeout: 20000 }).catch(() => {});
        break;
      }
    }
  } catch { /* retried below */ }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(500);
}
await page.keyboard.press('Escape').catch(() => {});
await page.waitForTimeout(1000);

const LOCATIONS = [
  { name: 'Home', scene: 'world-scene-home' },
  { name: 'Park', scene: 'world-scene-park' },
  { name: 'Town', scene: 'world-scene-town' },
  { name: 'Beach', scene: 'world-scene-beach' },
  // back to Town, then Home: the reported bug was specifically a SECOND move
  { name: 'Town', scene: 'world-scene-town' },
  { name: 'Home', scene: 'world-scene-home' },
];

let failures = 0;

for (const { name, scene } of LOCATIONS) {
  const tab = page.getByRole('tab', { name, exact: true }).first();
  if (!(await tab.count())) {
    console.error(`no tab named "${name}" — the destination tray changed and this check needs updating.`);
    failures++;
    continue;
  }
  await tab.click();
  await page.waitForTimeout(1400);

  const tabs = page.getByRole('tab');
  const n = await tabs.count();
  const selected = [];
  for (let i = 0; i < n; i++) {
    const t = tabs.nth(i);
    const label = await t.getAttribute('aria-label');
    const ariaSelected = await t.getAttribute('aria-selected');
    if (ariaSelected === 'true') selected.push(label);
    else if (ariaSelected !== 'false') {
      console.error(`${name}: tab "${label}" has no aria-selected attribute at all — the a11y regression is back.`);
      failures++;
    }
  }
  if (selected.length !== 1) {
    console.error(`${name}: expected exactly one tab marked aria-selected, got [${selected.join(', ')}]`);
    failures++;
  } else if (selected[0] !== name) {
    console.error(`${name}: tab "${selected[0]}" is aria-selected instead — the stale-selection bug is real.`);
    failures++;
  }

  const sceneVisible = await page.locator(`[data-testid="${scene}"]`).first().count();
  if (!sceneVisible) {
    console.error(`${name}: expected scene "${scene}" is not on screen — tab and world disagree on location.`);
    failures++;
  }

  console.log(`${name}: aria-selected=[${selected.join(', ')}]  scene=${scene}  ${failures === 0 ? 'ok' : ''}`);
}

await browser.close();

if (failures > 0) {
  console.error(`\nFAIL — ${failures} navigation-state mismatch${failures === 1 ? '' : 'es'}.`);
  process.exit(1);
}
console.log('\nPASS — every step of the location loop agrees: one tab selected, the right scene shown, aria-selected on the DOM.');
