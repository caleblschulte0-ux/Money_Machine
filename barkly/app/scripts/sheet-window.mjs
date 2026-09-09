/**
 * DOES THE DOG SURVIVE AN OPEN SHEET?
 *
 * The art review's finding, in one sentence: "open the food sheet or the Plan
 * and the character is gone; you are reading a well-formatted document." This
 * measures whether that is still true, in a browser, on three screen sizes.
 *
 * For each sheet it opens, it reads two rectangles -- the sprite wrapper and
 * the panel tagged `sheet-panel` -- and reports how much of him is above the
 * panel's top edge. It fails when a sheet hides more than it should, because
 * the whole point of the sheet stage is a number a future change cannot quietly
 * walk back. It does NOT check the framing looks good; that is a screenshot's
 * job and mine.
 *
 * A sheet that cannot be opened is a FAILURE, not a skip. The first version of
 * this script printed "plan: no opener" and exited 0, which is the same class
 * of bug as PROP_ONLY matching nothing and reporting success.
 *
 *   node scripts/sheet-window.mjs [--fail]
 */
import { chromium } from 'playwright';
import { browserOptions } from './lib/browser.mjs';
import { assertFreshArtifact } from './fresh-artifact.mjs';

const ARTIFACT = 'file:///home/user/Money_Machine/barkly/app/barkly-artifact.html';
const SIZES = [
  { name: '390x844', width: 390, height: 844 },
  { name: '360x568', width: 360, height: 568 },
  { name: '430x932', width: 430, height: 932 },
];
/** name -> the accessible name of the control that opens it. */
const SHEETS = [
  ['food', /food|bowl|dinner|feed/i],
  ['plan', /plan/i],
  ['pack', /pack/i],
  ['settings', /settings/i],
];
/** Below this share of him showing over the panel, the sheet has eaten the dog. */
const FLOOR = 0.55;

assertFreshArtifact('barkly-artifact.html');

const fail = process.argv.includes('--fail');
const browser = await chromium.launch(browserOptions());
const rows = [];

for (const size of SIZES) {
  const page = await browser.newPage({
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: 2,
  });
  await page.addInitScript(() =>
    localStorage.setItem('barkly/profile/default/onboarding-v1', 'done'),
  );
  await page.goto(ARTIFACT);
  await page.waitForSelector('[data-testid="barkly-sprite"]', { timeout: 30000 });
  await page.waitForTimeout(2500);

  for (const [name, opener] of SHEETS) {
    const button = page.getByRole('button', { name: opener }).first();
    if (!(await button.count())) {
      rows.push({ size: size.name, sheet: name, error: 'no opener' });
      continue;
    }
    await button.click();
    // The panel slides and the room pans; 900ms clears both.
    await page.waitForTimeout(900);
    const measured = await page.evaluate(() => {
      const box = (sel) => {
        const el = document.querySelector(sel);
        const host = el?.closest(`[data-testid="${el?.getAttribute('data-testid') ?? ''}"]`) ?? el;
        return host ? host.getBoundingClientRect() : null;
      };
      const dog = box('[data-testid="barkly-sprite"]');
      const panel = box('[data-testid="sheet-panel"]');
      if (!dog || !panel) return null;
      return {
        dog: { top: dog.top, bottom: dog.bottom, height: dog.height },
        panelTop: panel.top,
        viewport: window.innerHeight,
      };
    });
    if (!measured) {
      rows.push({ size: size.name, sheet: name, error: 'no panel on screen' });
    } else {
      const { dog, panelTop, viewport } = measured;
      const clear = Math.min(dog.bottom, panelTop, viewport) - Math.max(dog.top, 0);
      rows.push({
        size: size.name,
        sheet: name,
        share: dog.height > 0 ? clear / dog.height : 0,
        head: Math.round(dog.top),
        panelTop: Math.round(panelTop),
        panelShare: (viewport - panelTop) / viewport,
      });
    }
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(700);
  }
  await page.close();
}
await browser.close();

let bad = 0;
for (const row of rows) {
  if (row.error) {
    bad += 1;
    console.log(`${row.size} ${row.sheet.padEnd(9)} FAIL  ${row.error}`);
    continue;
  }
  const ok = row.share >= FLOOR && row.head >= 0;
  if (!ok) bad += 1;
  console.log(
    `${row.size} ${row.sheet.padEnd(9)} ${(row.share * 100).toFixed(0).padStart(3)}% of him clear` +
      `  head y=${row.head}  panel top=${row.panelTop} (${(row.panelShare * 100).toFixed(0)}% of screen)` +
      `  ${ok ? '' : '<- EATEN'}`,
  );
}

console.log(`\n${rows.length - bad}/${rows.length} sheets leave the dog on screen (floor ${FLOOR * 100}%).`);
if (bad && fail) process.exit(1);
