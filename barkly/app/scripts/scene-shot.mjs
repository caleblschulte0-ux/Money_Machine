/**
 * Photograph one location, at one hour, and REFUSE to photograph the wrong one.
 *
 * The Beach is level-locked on a fresh profile. A capture script that just
 * clicks the tab and screenshots therefore returns a picture of Home, silently,
 * and it looks like a perfectly good screenshot. This repo has been bitten by
 * that twice: once photographing the Park under two different names, and once
 * measuring Home's tonal range and reporting it as the Beach's improvement.
 *
 * So this loads the developed playtest save, then verifies the scene actually
 * on screen is the one that was asked for, and exits non-zero if it is not.
 *
 *   node scripts/scene-shot.mjs beach out.png 14
 *
 * Needs a playtest build (`npm run build:pages`) -- the menu it drives only
 * exists when EXPO_PUBLIC_BARKLY_PLAYTEST=always.
 */
import { chromium } from 'playwright';
import { browserOptions } from './lib/browser.mjs';

const place = process.argv[2] || 'home';
const out = process.argv[3] || `/tmp/${place}.png`;
const hour = Number(process.argv[4] || 14);
const [vw, vh] = (process.argv[5] || '390x844').split('x').map(Number);

const browser = await chromium.launch(browserOptions());
const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: 2 });
await page.addInitScript(`(() => {
  localStorage.setItem('barkly/profile/default/onboarding-v1', 'done');
  Date.prototype.getHours = function () { return ${hour}; };
})()`);
await page.goto(`file://${process.cwd()}/dist/playtest/index.html`);
await page.waitForTimeout(6500);

/*
 * Load the developed save, then CHECK, and only then stop trying.
 *
 * A first version broke out of this loop as soon as the tab existed -- but a
 * locked tab is still rendered, so it never loaded the save at all and went
 * straight on to photograph Home. The condition has to be "the scene I asked
 * for is on screen", never "a tab with that name exists".
 */
async function loadDevelopedSave() {
  try {
    const gear = page.getByLabel('Settings').first();
    if (!(await gear.count())) return;
    await gear.click({ timeout: 6000 });
    await page.waitForTimeout(520);
    const entry = page.locator('[data-testid="playtest-settings"]').first();
    if (!(await entry.count())) return;
    await entry.click({ timeout: 6000 });
    await page.waitForTimeout(650);
    const slot = page.locator('[data-testid="playtest-longterm"]').first();
    if (!(await slot.count())) return;
    await slot.click({ force: true, timeout: 6000 });
    await page.waitForSelector('[data-testid="dialogue-panel"]', { timeout: 20000 }).catch(() => {});
  } catch { /* reported by the verification below */ }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(900);
}

async function showTarget() {
  if (place !== 'home') {
    const tab = page.getByRole('tab', { name: new RegExp(place, 'i') }).first();
    if (!(await tab.count())) return false;
    await tab.click({ timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(2600);
  }
  return (await page.locator(`[data-testid="world-scene-${place}"]`).count()) > 0;
}

let onTarget = await showTarget();
for (let attempt = 1; attempt <= 3 && !onTarget; attempt += 1) {
  await loadDevelopedSave();
  onTarget = await showTarget();
}

// The check that matters: is the scene on screen the one that was asked for?
if (!onTarget) {
  const actual = await page.evaluate(() => {
    const el = document.querySelector('[data-testid^="world-scene-"]');
    return el ? el.getAttribute('data-testid') : 'none';
  });
  console.error(`FAIL: asked for "${place}", the app is showing "${actual}". Refusing to save a mislabelled capture.`);
  await browser.close();
  process.exit(2);
}

await page.screenshot({ path: out });
console.log(`${place} @${hour}h -> ${out}`);
await browser.close();
