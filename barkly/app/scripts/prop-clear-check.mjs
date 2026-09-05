/**
 * NOTHING STANDS ON HIS FACE.
 *
 * `overlap-check.mjs` protects Barkly from the UI -- banners, docks, sheets.
 * Nothing protected him from the SCENE, and the home room shipped with a floor
 * lamp whose shade sat on his skull: the lamp had been positioned entirely by
 * reasoning about the couch behind it, and the biggest object on the screen was
 * never part of that arithmetic. Measured at 390x844, the lamp occupied
 * x 143..224 and Barkly x 131..257 -- the prop was inside his silhouette.
 *
 * The rule is the art rule, not "no overlap": furniture SHOULD pass behind him,
 * because overlap is how a flat scene gets depth -- the couch arm crossing his
 * left ear is the good version. What is never allowed is a prop across the
 * middle of his face. So this measures the central column of his head and fails
 * when a scene prop covers a meaningful slice of it.
 */
import { chromium } from 'playwright';
import { existsSync, statSync, readdirSync } from 'fs';
import { join } from 'path';

const ART = `file://${process.cwd()}/dist/playtest/index.html`;
const VIEWPORTS = [[360, 568], [360, 780], [390, 844], [430, 932]];
const PLACES = ['home', 'park', 'town', 'beach'];

/** The band that must stay clear: middle 50% of his width, top 55% of his height. */
const FACE_X = 0.25;
const FACE_TOP = 0.55;
/*
 * WHAT SEPARATES "BEHIND HIM" FROM "ON HIM".
 *
 * A first version of this failed on the couch, the park trees and the whole
 * town storefront -- all things that look RIGHT crossing him, because they
 * enter from off-screen and read as the room he is standing in. The lamp
 * looked wrong for a different reason: its entire width lived inside his
 * silhouette, so there was nowhere for the eye to place it except on his head.
 *
 * So a prop is a cover-up when it is (a) small enough to be a prop rather than
 * scenery, and (b) mostly INSIDE his span rather than passing through it.
 */
const PROP_MAX_WIDTH = 1.4;   // x sprite width; wider than this is scenery
const PROP_CONTAINED = 0.7;   // this much of the prop sits inside his silhouette
/*
 * ...and it has to be SEEN. A prop wholly within his outline and no taller
 * than he is, is simply behind him -- the park has hedge pieces exactly there
 * and not one pixel of them reaches the player. What made the lamp a defect is
 * that it rose PAST his head, so the shade cleared his skull and read as
 * growing out of it. That is the condition: it pokes out above him.
 */

function newestSourceMs(dir) {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    newest = Math.max(newest, entry.isDirectory() ? newestSourceMs(full) : statSync(full).mtimeMs);
  }
  return newest;
}

const artifact = `${process.cwd()}/dist/playtest/index.html`;
if (!existsSync(artifact)) {
  console.error('FAIL: no built artifact. Run `npm run build:pages` first.');
  process.exit(2);
}
if (statSync(artifact).mtimeMs < newestSourceMs(`${process.cwd()}/src`)) {
  console.error('FAIL: the artifact is older than src/. Rebuild before measuring.');
  process.exit(2);
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const failures = [];
let checked = 0;

for (const [w, h] of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.addInitScript(() => localStorage.setItem('barkly/profile/default/onboarding-v1', 'done'));
  await page.goto(ART);
  await page.waitForTimeout(6500);

  for (const place of PLACES) {
    if (place !== 'home') {
      const tab = page.getByRole('tab', { name: new RegExp(place, 'i') }).first();
      if (!(await tab.count()) || !(await tab.isVisible().catch(() => false))) continue;
      await tab.click().catch(() => {});
      await page.waitForTimeout(2600);
    }
    const result = await page.evaluate(({ place, FACE_X, FACE_TOP, PROP_MAX_WIDTH, PROP_CONTAINED }) => {
      const sprite = document.querySelector('[data-testid="barkly-sprite"]');
      const scene = document.querySelector(`[data-testid="world-scene-${place}"]`);
      if (!sprite || !scene) return null;
      /*
       * The PRESSABLE is wider than the dog -- it carries his tap target, and
       * measured 258px around a 126px rig. Sizing the face column off it made
       * the column twice as wide as his head and let a 252px storefront
       * through as "prop-sized". `overlap-check.mjs` warns about this exact
       * difference in its own header; use the drawn art.
       */
      let s = sprite.getBoundingClientRect();
      let widest = 0;
      for (const img of sprite.querySelectorAll('img')) {
        const r = img.getBoundingClientRect();
        if (r.width > widest && r.width >= 20) { widest = r.width; s = r; }
      }
      if (s.width < 20) return null;
      const face = {
        x0: s.x + s.width * FACE_X,
        x1: s.x + s.width * (1 - FACE_X),
        y0: s.y,
        y1: s.y + s.height * FACE_TOP,
      };
      const props = [];
      for (const img of scene.querySelectorAll('img')) {
        if (sprite.contains(img)) continue;
        const r = img.getBoundingClientRect();
        if (r.width < 10 || r.height < 10) continue;
        // Does it reach the face band at all?
        const oy = Math.max(0, Math.min(face.y1, r.bottom) - Math.max(face.y0, r.top));
        if (oy <= 0) continue;
        // Scenery is allowed to cross him; it is what makes the room a room.
        if (r.width > s.width * PROP_MAX_WIDTH) continue;
        // How much of THIS PROP hides inside his silhouette.
        const inside = Math.max(0, Math.min(s.right, r.right) - Math.max(s.left, r.left));
        const contained = inside / r.width;
        const ox = Math.max(0, Math.min(face.x1, r.right) - Math.max(face.x0, r.left));
        const risesAboveHim = r.top < s.top;
        if (ox > 0 && contained >= PROP_CONTAINED && risesAboveHim) {
          props.push({
            cover: ox / (face.x1 - face.x0),
            contained,
            box: `x ${Math.round(r.left)}..${Math.round(r.right)} y ${Math.round(r.top)}..${Math.round(r.bottom)} (${Math.round(contained * 100)}% inside him)`,
          });
        }
      }
      return { face: `x ${Math.round(face.x0)}..${Math.round(face.x1)} y ${Math.round(face.y0)}..${Math.round(face.y1)}`, props };
    }, { place, FACE_X, FACE_TOP, PROP_MAX_WIDTH, PROP_CONTAINED });

    if (!result) continue;
    checked += 1;
    const worst = result.props.sort((a, b) => b.cover - a.cover)[0];
    const pct = worst ? Math.round(worst.cover * 100) : 0;
    console.log(`  ${String(w).padStart(3)}x${String(h).padEnd(3)} ${place.padEnd(5)} face ${result.face}  ${worst ? `PROP ON HIS FACE (${pct}%)` : 'clear'}`);
    if (worst) failures.push(`${w}x${h} ${place}: a prop covers ${pct}% of his face column — ${worst.box}`);
  }
  await page.close();
}
await browser.close();

if (checked === 0) {
  console.error('\nFAIL: measured nothing — the sprite or scene testIDs did not resolve.');
  process.exit(2);
}
if (failures.length) {
  console.error(`\nFAIL: ${failures.length} scene(s) put furniture across his face.`);
  for (const f of failures) console.error(`  ${f}`);
  console.error(`\nProps may pass BEHIND him -- that is depth. They may not cross the middle`);
  console.error(`of his head. Move the prop out of the centre column, not the dog.`);
  process.exit(1);
}
console.log(`\nPASS — ${checked} scene/viewport pairs, nothing standing on his face.`);
