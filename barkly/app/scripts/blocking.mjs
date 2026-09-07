/**
 * WHERE EVERYTHING IN A SCENE ACTUALLY STANDS.
 *
 * Written because a park bench spent an unknown number of releases drawn
 * straight through a tree trunk, and no tool in the repo could have told you.
 * `overlap-check` measures UI boxes, `prop-clear-check` measures props against
 * Barkly's face, `art-lab-sheet` measures colour and `dead-space` measures how
 * much of the picture is empty -- and a prop sitting inside another prop is
 * invisible to all four.
 *
 * It prints every scene image's box sorted by GROUND LINE, which is the order
 * they should be painted in: on a flat ground plane, whatever's feet are lower
 * down the screen is nearer the viewer and covers what is behind it. Reading
 * the list top to bottom is reading the scene back to front, so a prop in the
 * wrong tier is obvious, and two props sharing an x-range at the same baseline
 * are about to fight.
 *
 *   node scripts/blocking.mjs park
 *
 * Reports rather than fails: composition is a judgement, and a tool that
 * refused overlap would forbid the thing that creates depth in the first place.
 */
import { chromium } from 'playwright';

const place = process.argv[2] || 'park';
const [w, h] = (process.argv[3] || '390x844').split('x').map(Number);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: w, height: h } });
await page.addInitScript(() => localStorage.setItem('barkly/profile/default/onboarding-v1', 'done'));
await page.goto(`file://${process.cwd()}/dist/playtest/index.html`);
await page.waitForTimeout(6500);

/*
 * Load the developed save first, or the Beach is not there to measure.
 *
 * A fresh profile has it level-locked, and the first version of this tool
 * simply reported "no scene for beach" -- which reads as a broken selector
 * rather than as a locked tab, and is exactly how an earlier session ended up
 * photographing the Park twice under two different names. Same route the art
 * lab takes: the playtest menu, which only exists in a build made with
 * EXPO_PUBLIC_BARKLY_PLAYTEST=always, i.e. `npm run build:pages`.
 */
try {
  const gear = page.getByLabel('Settings').first();
  if (await gear.count()) {
    await gear.click({ timeout: 6000 });
    await page.waitForTimeout(520);
    const entry = page.locator('[data-testid="playtest-settings"]').first();
    if (await entry.count()) {
      await entry.click({ timeout: 6000 });
      await page.waitForTimeout(650);
      const slot = page.locator('[data-testid="playtest-longterm"]').first();
      if (await slot.count()) {
        await slot.click({ force: true, timeout: 6000 });
        await page.waitForSelector('[data-testid="dialogue-panel"]', { timeout: 20000 }).catch(() => {});
      }
    }
  }
} catch { /* a locked place is reported below, not thrown */ }
await page.keyboard.press('Escape').catch(() => {});
await page.waitForTimeout(900);

if (place !== 'home') {
  const tab = page.getByRole('tab', { name: new RegExp(place, 'i') }).first();
  if (!(await tab.count())) {
    console.error(`no "${place}" tab -- is it still locked on this save?`);
    process.exit(1);
  }
  await tab.click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(2600);
}

const out = await page.evaluate((place) => {
  const scene = document.querySelector(`[data-testid="world-scene-${place}"]`);
  const sprite = document.querySelector('[data-testid="barkly-sprite"]');
  if (!scene) return null;
  const rows = [];
  for (const img of scene.querySelectorAll('img')) {
    if (sprite && sprite.contains(img)) continue;
    const r = img.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;
    rows.push({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), base: Math.round(r.bottom) });
  }
  let s = null;
  if (sprite) {
    let widest = 0;
    for (const img of sprite.querySelectorAll('img')) {
      const r = img.getBoundingClientRect();
      if (r.width > widest && r.width >= 20) { widest = r.width; s = r; }
    }
  }
  /*
   * Badges and controls are information; scenery must not be placed over them.
   *
   * Only the ones INSIDE the world, though. The HUD and the location tabs are
   * chrome and chrome paints over the world by design -- a first version
   * flagged the HOME and PARK tabs as buried under a tree, which is true of
   * their coordinates and false of the screen. Everything above the tab row is
   * a different surface, so the scan starts below it.
   */
  let chromeBottom = 0;
  for (const tab of document.querySelectorAll('[role="tab"]')) {
    chromeBottom = Math.max(chromeBottom, tab.getBoundingClientRect().bottom);
  }
  const labels = [];
  for (const el of document.querySelectorAll('div,span')) {
    const t = (el.textContent || '').trim();
    if (!/^[A-Z]{3,9}$/.test(t) || el.children.length) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 12 || r.width > 140 || r.top < chromeBottom) continue;
    labels.push({ t, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) });
  }
  return { rows, labels, sprite: s ? { x: Math.round(s.x), y: Math.round(s.y), w: Math.round(s.width), h: Math.round(s.height), base: Math.round(s.bottom) } : null };
}, place);

if (!out) {
  console.error(`no scene for "${place}"`);
  process.exit(1);
}

console.log(`${place.toUpperCase()} at ${w}x${h} -- back to front`);
if (out.sprite) console.log(`  barkly           x ${out.sprite.x}..${out.sprite.x + out.sprite.w}  y ${out.sprite.y}..${out.sprite.y + out.sprite.h}  base ${out.sprite.base}`);
out.rows.sort((a, b) => a.base - b.base);
for (const r of out.rows) {
  console.log(`  x ${String(r.x).padStart(5)}..${String(r.x + r.w).padStart(4)}  y ${String(r.y).padStart(4)}..${String(r.y + r.h).padStart(4)}  base ${String(r.base).padStart(4)}  ${r.w}x${r.h}`);
}
/*
 * THE BENCH-IN-THE-TREE SHAPE.
 *
 * Overlap on its own is not the defect -- overlap is what creates depth, and a
 * rule against it would forbid the good version. What went wrong in the park is
 * narrower: a small prop sat almost entirely inside a big one's footprint while
 * standing at effectively the SAME distance, so there was nowhere for the eye to
 * put it except inside the trunk. Tuned against the real case (a 123px bench
 * 100% inside a 218px tree, 40px of baseline between them, on a 311px tree) and
 * checked against every currently-placed prop, which it leaves alone.
 */
const CONTAINED = 0.6;
const SAME_DISTANCE = 0.25;
/*
 * ...AND BOTH HAVE TO BE PROPS.
 *
 * A planter standing in front of a storefront is not the defect -- it is the
 * whole point of a storefront. Pointed at Town, a first version flagged three
 * of those (a planter and two lamps against 310px shopfronts) alongside the two
 * real ones, and a check that cries about correct composition gets ignored on
 * the day it is right. Same distinction prop-clear-check draws with
 * PROP_MAX_WIDTH: past a certain size difference the big one is SCENERY, and
 * things stand in front of scenery.
 *
 * 2.5 is measured, not picked: it clears Town's planter-on-shopfront at 3.3 and
 * its lamp-on-shopfront at 3.6, and keeps the two cases that are real -- the
 * park bench in the tree at 1.8 and the beach palm in the lifeguard tower
 * at 1.1.
 */
const SCENERY_RATIO = 2.5;
for (let i = 0; i < out.rows.length; i += 1) {
  for (let j = i + 1; j < out.rows.length; j += 1) {
    const [small, big] = out.rows[i].w <= out.rows[j].w ? [out.rows[i], out.rows[j]] : [out.rows[j], out.rows[i]];
    const ox = Math.min(small.x + small.w, big.x + big.w) - Math.max(small.x, big.x);
    if (ox < small.w * CONTAINED) continue;
    if (big.w > small.w * SCENERY_RATIO) continue;
    if (Math.abs(small.base - big.base) >= big.h * SAME_DISTANCE) continue;
    console.log(`  ! ${small.w}x${small.h} at base ${small.base} sits ${Math.round((ox / small.w) * 100)}% inside ${big.w}x${big.h} at base ${big.base} -- same distance, same place`);
  }
}
if (out.labels.length) {
  console.log('  labels (scenery must not cover these):');
  for (const l of out.labels) {
    const hits = out.rows.filter((r) =>
      Math.min(r.x + r.w, l.x + l.w) - Math.max(r.x, l.x) > 0 &&
      Math.min(r.y + r.h, l.y + l.h) - Math.max(r.y, l.y) > 0);
    const flag = hits.length ? `  ! covered by ${hits.length} prop(s)` : '';
    console.log(`    ${l.t.padEnd(9)} x ${l.x}..${l.x + l.w}  y ${l.y}..${l.y + l.h}${flag}`);
  }
}
await browser.close();
