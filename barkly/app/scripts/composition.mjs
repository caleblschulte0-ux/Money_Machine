/*
 * WHAT EACH PLACE FEELS LIKE, as numbers.
 *
 * `dead-space.py` measures how much DETAIL a scene carries and says all four
 * are fine -- 3-7% dead, 66-84% detail. Stand them side by side and they still
 * feel like one scene with four wallpapers, so detail density is not what is
 * wrong and not what to measure.
 *
 * What differs between a place you are IN and a backdrop you stand in FRONT of
 * is composition, and these are the parts of it that can be counted:
 *
 *   DOG SHARE   how much of the frame the character occupies, and where he
 *               sits in it. If this is identical everywhere, every location is
 *               framed identically and no amount of new art will change that.
 *   SYMMETRY    the horizontal centre of mass of everything that is not him.
 *               0.5 is a mirror, which reads as a stage set rather than a
 *               place that carries on past the edges of the screen.
 *   SPREAD      how far the scene's content reaches up and down the frame,
 *               and how much of it is bunched into one horizontal band.
 *   FOREGROUND  is there anything at all NEARER than the dog -- below his feet
 *               line, or cropped by the bottom edge. A picture with nothing in
 *               front of the subject has no near plane, and depth is the
 *               relationship between planes.
 *
 * It reports, it does not judge. There is no floor to pass: the numbers exist
 * so a composition change can be argued from evidence and checked afterwards.
 */
import { chromium } from 'playwright';
import { browserOptions } from './lib/browser.mjs';
import { assertFreshArtifact } from './fresh-artifact.mjs';
import { loadDevelopedSave, reachPlace } from './lib/playtest-save.mjs';

const [w, h] = (process.argv[3] || '390x844').split('x').map(Number);
const PLACES = ['home', 'park', 'town', 'beach'];

/*
 * Measuring last build's composition and reporting it as this one's is exactly
 * the failure this tool was written to catch elsewhere. Two whole measurement
 * passes in one session were read off stale renders, and both times the
 * honest-looking answer was "nothing changed".
 */
assertFreshArtifact(`${process.cwd()}/dist/playtest/index.html`, 'npm run build:pages');

const browser = await chromium.launch(browserOptions());
const page = await browser.newPage({ viewport: { width: w, height: h } });
await page.addInitScript(() => localStorage.setItem('barkly/profile/default/onboarding-v1', 'done'));
await page.goto(`file://${process.cwd()}/dist/playtest/index.html`);
await page.waitForTimeout(6500);

await loadDevelopedSave(page);

const rows = [];
for (const place of PLACES) {
  /*
   * A LOCKED TAB IS STILL A TAB.
   *
   * Beach is locked at level 1: its tab renders, it takes the click, and he
   * says he cannot go -- leaving you standing in Town. This used to click and
   * then measure whatever was on screen, and on 2026-09-09 it printed a beach
   * row that was town's numbers to the decimal (29 props, massX 0.47, reach
   * 0.41-1.08 on both lines) and exited 0. Two of the four places in a
   * composition report were the same place. `reachPlace` lives in
   * scripts/lib/playtest-save.mjs, shared with blocking.mjs, and returns true
   * only when the scene itself is on screen.
   */
  if (!(await reachPlace(page, place))) {
    console.error(`  ${place}: could not open it -- refusing to report another place's numbers as this one's`);
    await browser.close();
    process.exit(2);
  }
  await page.waitForTimeout(1400);

  const m = await page.evaluate(({ w, h }) => {
    const boxes = [];
    let dog = null;
    for (const el of document.querySelectorAll('img')) {
      const r = el.getBoundingClientRect();
      if (r.width < 6 || r.height < 6) continue;
      // Ignore the fixed chrome: tabs, the coin bar and the care tray.
      if (r.top < h * 0.19 || r.top > h * 0.90) continue;
      const src = el.getAttribute('src') || '';
      const box = { x: r.left, y: r.top, w: r.width, h: r.height, src };
      // The hero: the biggest thing whose art comes out of the barkly folder.
      if (/barkly|renders|rig/i.test(src) && (!dog || r.width * r.height > dog.w * dog.h)) dog = box;
      boxes.push(box);
    }
    return { boxes, dog, w, h };
  }, { w, h });

  if (!m.dog) { console.log(`  ${place}: no character found`); continue; }
  const d = m.dog;
  const others = m.boxes.filter((b) => b !== m.dog && !(b.x === d.x && b.y === d.y));
  const area = (b) => b.w * b.h;
  const mass = others.reduce((s, b) => s + area(b), 0) || 1;
  const cx = others.reduce((s, b) => s + (b.x + b.w / 2) * area(b), 0) / mass / w;
  const feet = d.y + d.h;
  const near = others.filter((b) => b.y + b.h > feet);
  const tops = others.map((b) => b.y / h);
  const bots = others.map((b) => (b.y + b.h) / h);

  rows.push({
    place,
    share: (d.w * d.h) / (w * h),
    dogX: (d.x + d.w / 2) / w,
    dogTop: d.y / h,
    feet: feet / h,
    props: others.length,
    cx,
    reachTop: tops.length ? Math.min(...tops) : 1,
    reachBottom: bots.length ? Math.max(...bots) : 0,
    near: near.length,
  });
}
await browser.close();

console.log('place   dog%  dogX  head  feet | props  massX  reach(top-bot)  in-front');
for (const r of rows) {
  console.log(
    `${r.place.padEnd(6)} ${(r.share * 100).toFixed(1).padStart(4)}% ` +
    `${r.dogX.toFixed(2)}  ${r.dogTop.toFixed(2)}  ${r.feet.toFixed(2)} |` +
    `${String(r.props).padStart(5)}   ${r.cx.toFixed(2)}   ` +
    `${r.reachTop.toFixed(2)}-${r.reachBottom.toFixed(2)}      ${r.near}`,
  );
}
