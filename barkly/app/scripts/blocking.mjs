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
 *   node scripts/blocking.mjs park          one scene, printed
 *   node scripts/blocking.mjs all --fail    every scene, non-zero on a defect
 *
 * It REPORTS by default, because composition is a judgement and a tool that
 * refused overlap would forbid the thing that creates depth in the first place.
 * `--fail` narrows that to the two things which are never a judgement call: a
 * prop standing inside another prop at the same distance, and scenery covering
 * a label the player has to read. Both shipped -- the bench in the tree, the
 * palm in the lifeguard tower, the fountain under the town lamp, the SIFT badge
 * under a dune -- and all four were invisible to every other check we run.
 */
import { chromium } from 'playwright';
import { assertFreshArtifact } from './fresh-artifact.mjs';

const arg = process.argv[2] || 'park';
const FAIL = process.argv.includes('--fail');
const sizeArg = process.argv.slice(3).find((a) => /^\d+x\d+$/.test(a));
const [w, h] = (sizeArg || '390x844').split('x').map(Number);
const PLACES = arg === 'all' ? ['home', 'park', 'town', 'beach'] : [arg];
let defects = 0;
// Same guard the rest of the battery uses: this SERVES the artifact, it does
// not build it, so on a stale one it would happily pass on old blocking.
assertFreshArtifact(`${process.cwd()}/dist/playtest/index.html`, 'npm run build:pages');

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
/*
 * Loading it ONCE and hoping is not enough.
 *
 * A single attempt worked when this tool measured one scene at a time and then
 * dropped the Beach on the very first all-scenes run -- the menu is a few
 * animated steps and any of them can be missed. A flaky save load reads as
 * "that scene does not exist", which is the same sentence a broken selector
 * produces, so it retries and then says plainly which places it could not
 * reach rather than quietly measuring three of four.
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
  } catch { /* reported below */ }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(900);
}

/*
 * "Reachable" has to mean THE SCENE APPEARED, never "a tab with that name
 * exists". A locked Beach tab is still rendered -- with a padlock on it -- so a
 * tab-count check passes on a save that cannot open the place, which is the
 * same mistake that had scene-shot.mjs photographing Home and calling it Beach.
 */
async function show(place) {
  if (place === 'home') return true;
  const tab = page.getByRole('tab', { name: new RegExp(place, 'i') }).first();
  if (!(await tab.count())) return false;
  await tab.click({ timeout: 6000 }).catch(() => {});
  await page.waitForSelector(`[data-testid="world-scene-${place}"]`, { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(1200);
  return (await page.locator(`[data-testid="world-scene-${place}"]`).count()) > 0;
}

await loadDevelopedSave();

for (const place of PLACES) {
  let open = await show(place);
  for (let attempt = 1; attempt <= 2 && !open; attempt += 1) {
    await loadDevelopedSave();
    open = await show(place);
  }
  if (!open) {
    console.error(`FAIL: could not open "${place}" -- the developed playtest save did not load, so it is still locked.`);
    await browser.close();
    process.exit(2);
  }

  const out = await page.evaluate((place) => {
    const scene = document.querySelector(`[data-testid="world-scene-${place}"]`);
    const sprite = document.querySelector('[data-testid="barkly-sprite"]');
    if (!scene) return null;
    const rows = [];
    /*
     * A COMPOSITE IS ONE PROP.
     *
     * Every image in the scene used to become its own candidate, and the rule
     * below -- a prop wholly inside another at the same distance is clutter --
     * is right about siblings and wrong about parts. Home's window is a frame
     * image with a landscape behind its glass; the landscape IS inside the
     * frame, deliberately, and the gate flagged it the moment that landscape
     * stopped being SVG and became a render.
     *
     * So anything marked `world-composite` contributes ONE box: the union of
     * its own images. The rule keeps all of its force between props, which is
     * where the clutter it exists to catch actually happens, and a prop built
     * out of several renders stops being read as several props.
     */
    const composites = [...scene.querySelectorAll('[data-testid="world-composite"]')];
    for (const group of composites) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const img of group.querySelectorAll('img')) {
        const r = img.getBoundingClientRect();
        if (r.width < 8 || r.height < 8) continue;
        x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y);
        x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
      }
      if (x0 === Infinity) continue;
      rows.push({ x: Math.round(x0), y: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0), base: Math.round(y1) });
    }
    for (const img of scene.querySelectorAll('img')) {
      if (sprite && sprite.contains(img)) continue;
      if (composites.some((g) => g.contains(img))) continue;
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
      defects += 1;
    }
  }
  if (out.labels.length) {
    console.log('  labels (scenery must not cover these):');
    for (const l of out.labels) {
      const hits = out.rows.filter((r) =>
        Math.min(r.x + r.w, l.x + l.w) - Math.max(r.x, l.x) > 0 &&
        Math.min(r.y + r.h, l.y + l.h) - Math.max(r.y, l.y) > 0);
      if (hits.length) defects += 1;
      const flag = hits.length ? `  ! covered by ${hits.length} prop(s)` : '';
      console.log(`    ${l.t.padEnd(9)} x ${l.x}..${l.x + l.w}  y ${l.y}..${l.y + l.h}${flag}`);
    }
  }
}

await browser.close();

if (FAIL) {
  if (defects) {
    console.error(`\nFAIL — ${defects} blocking defect(s) at ${w}x${h}. A prop inside another prop, or scenery over a label.`);
    process.exit(1);
  }
  console.log(`\nPASS — ${PLACES.length} scene(s) at ${w}x${h}, nothing standing inside anything else.`);
}
