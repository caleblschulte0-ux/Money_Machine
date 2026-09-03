#!/usr/bin/env node
/**
 * The art lab: see the whole game at once, in motion, with numbers.
 *
 * Reviewing this app one still screenshot at a time is why cross-scene
 * problems kept surviving review -- a washed-out palette or a chrome element
 * that only reads wrong NEXT TO another scene is invisible when you look at
 * one frame in isolation. This captures every location in day and night, at
 * real device metrics, plus a motion strip, and reports palette numbers so
 * "looks washed out" becomes a measurement instead of an opinion.
 *
 * Output goes to <out>/frames (raw) and is tiled by scripts/art-lab-sheet.py.
 */
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { chromium } from 'playwright';
import { assertFreshArtifact } from './fresh-artifact.mjs';
import { walkOnboarding } from './onboard.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const htmlPath = resolve(arg('--html', 'dist/playtest/index.html'));
const outDir = resolve(arg('--out', 'art-lab'));
const preset = arg('--preset', 'longterm');
if (!existsSync(htmlPath)) { console.error(`missing ${htmlPath}`); process.exit(2); }

assertFreshArtifact(htmlPath, 'npm run build:pages');

await mkdir(`${outDir}/frames`, { recursive: true });

const html = await readFile(htmlPath);
const server = createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(html);
}).listen(0);
const url = `http://127.0.0.1:${server.address().port}/`;

const launch = { args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] };
for (const c of [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium']) {
  if (c && existsSync(c)) { launch.executablePath = c; break; }
}
const browser = await chromium.launch(launch);

/*
 * iPhone 13 logical metrics at 3x. Playwright's full mobile emulation changes
 * hit-testing enough to break the settings scrim, and the proven harnesses in
 * scripts/ do not use it either -- the value here is the pixel density and the
 * handset aspect, not the touch emulation.
 */
const RIG = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 };
const LOCATIONS = ['home', 'park', 'town', 'beach'];

async function newPage(hour) {
  const ctx = await browser.newContext({ ...RIG, timezoneId: 'America/Chicago' });
  await ctx.addInitScript(`Date.prototype.getHours = function () { return ${hour}; };`);
  const page = await ctx.newPage();
  await page.goto(url);
  await page.waitForTimeout(3200);
  await walkOnboarding(page, { settle: 620 });
  /*
   * LOADING THE SAVE IS REQUIRED, AND IT IS VERIFIED.
   *
   * This was wrapped in a try/catch and documented as a NICE-TO-HAVE, on the
   * stated grounds that "the world art is identical either way, only the
   * room's history props differ". That is not true in either direction. A
   * default save is level 1, so Beach and Town are LOCKED -- the run dies four
   * frames in with "no tab for beach" -- and Home renders without its rug,
   * bed or shelf, which is most of the room. A silent fallback to the default
   * save is therefore a silent capture of a different game.
   *
   * So: three attempts, then verify against the world rather than against the
   * click, and fail the run loudly if the save is not in.
   */
  const unlocked = async () => {
    const labels = await page.getByRole('tab').evaluateAll((els) =>
      els.map((e) => e.getAttribute('aria-label') || e.textContent || ''),
    );
    return labels.length >= 4 && !labels.some((l) => /locked/i.test(l));
  };
  let loaded = false;
  /*
   * Retry until the save is IN, not until everything is unlocked: on any
   * preset that legitimately keeps a place locked, the unlock test can never
   * become true, so this loop used to run its full three attempts -- three
   * Settings -> Playtest -> slot round trips -- for every band, every time.
   */
  const settled = async () => (preset === 'longterm' ? await unlocked() : loaded);
  for (let attempt = 1; attempt <= 3 && !(await settled()); attempt += 1) {
    try {
      const gear = page.getByLabel('Settings').first();
      if (await gear.count()) {
        await gear.click({ timeout: 6000 });
        await page.waitForTimeout(520);
        const entry = page.locator('[data-testid="playtest-settings"]').first();
        if (await entry.count()) {
          await entry.click({ timeout: 6000 });
          await page.waitForTimeout(650);
          const slot = page.locator(`[data-testid="playtest-${preset}"]`).first();
          if (await slot.count()) {
            await slot.click({ force: true, timeout: 6000 });
            loaded = true;
            await page.waitForSelector('[data-testid="dialogue-panel"]', { timeout: 20000 }).catch(() => {});
          }
        }
      }
    } catch {
      /* retried below */
    }
    await page.waitForTimeout(900);
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(400);
  }
  /*
   * A LOCKED PLACE IS ONLY A BUG ON A SAVE THAT SHOULD HAVE UNLOCKED IT.
   *
   * The unlock check was written for `longterm` and hard-coded its assumption,
   * so every other preset was unreachable -- which is why the only save this
   * lab has ever photographed is a level-8 furnished one, and the FRESH start
   * every new player actually sees has never once been on a contact sheet.
   *
   * So: `longterm` still has to come back fully unlocked (there, a locked tab
   * really does mean the save did not load). Any other preset only has to have
   * been LOADED -- the playtest menu found and its slot clicked -- and the
   * locations it legitimately cannot reach are skipped by `goTo`'s caller
   * rather than failing the run.
   */
  const everythingOpen = await unlocked();
  if (preset === 'longterm' ? !everythingOpen : !loaded) {
    const labels = await page.getByRole('tab').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    console.error(`could not load the "${preset}" playtest save; tabs read: ${JSON.stringify(labels)}`);
    console.error('Most likely the artifact has no playtest menu: build it with');
    console.error('  npm run build:pages   (sets EXPO_PUBLIC_BARKLY_PLAYTEST=always for dist/playtest)');
    process.exit(3);
  }
  // Whatever happened above, get back to the world. A sheet left open covers
  // the location tabs and every capture after it would be of a modal.
  for (const label of [/^done$/i, /^close$/i, /^back$/i, /^not now$/i]) {
    const b = page.getByRole('button').filter({ hasText: label }).first();
    if (await b.count()) { await b.click({ force: true }).catch(() => {}); await page.waitForTimeout(320); }
  }
  const closeGlyph = page.getByText('✕', { exact: true }).first();
  if (await closeGlyph.count()) { await closeGlyph.click({ force: true }).catch(() => {}); await page.waitForTimeout(320); }
  await page.waitForTimeout(2400);
  return { ctx, page };
}

async function goTo(page, loc) {
  const tab = page.getByRole('tab', { name: new RegExp(`^${loc}$`, 'i') }).first();
  /*
   * WAIT for the tab, and say what WAS there if it never arrives.
   *
   * `if (!(await tab.count())) throw new Error('no tab for beach')` is a
   * single instantaneous poll on a React app that re-renders the whole place
   * bar on every location change, so it flakes -- it took down a full 16-frame
   * run on the fourth capture -- and when it does fire the message names the
   * one thing that was missing and nothing about what the harness could see,
   * which is the least useful half of the information.
   */
  await tab.waitFor({ state: 'attached', timeout: 8000 }).catch(() => {});
  if (!(await tab.count())) {
    const seen = await page.getByRole('tab').allTextContents();
    throw new Error(`no tab for ${loc}; tabs present: ${seen.length ? seen.join(', ') : '(none)'}`);
  }
  /*
   * VERIFY against the SCENE, not the click. A locked tab, or a click that
   * lands on a scrim, fails silently and the next screenshot is just the
   * previous location again -- which is how two "different" scenes ended up
   * with byte-identical palette stats and sent me chasing a Town problem I
   * was never actually measuring. Every scene renders its own testID, so ask
   * the world what it is rather than trusting the button.
   */
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await tab.click({ force: true });
    await page.waitForTimeout(1400);
    if (await page.locator(`[data-testid="world-scene-${loc}"]`).count()) {
      await page.waitForTimeout(2000);
      return;
    }
  }
  throw new Error(`could not switch to ${loc} — it is probably locked in this save`);
}

/*
 * ALL FOUR LIGHT BANDS, not two.
 *
 * This captured only day and night, so morning (06:00-10:00) and evening
 * (17:00-21:00) -- a third of every real day -- were never once reviewed. They
 * were shipping a sunrise or sunset SKY under flat noon LIGHT, and nothing in
 * the harness could see it. `--bands day,night` narrows the run when you only
 * want a quick check.
 */
const ALL_BANDS = [['morning', 8], ['day', 14], ['evening', 19], ['night', 22]];
const wanted = arg('--bands', '').split(',').map((b) => b.trim()).filter(Boolean);
// A typo must not silently capture nothing. `--bands nigth` used to leave
// BANDS empty, render zero frames, and exit 0 -- a run that looks like it
// worked and measured a directory that is still yesterday's.
const unknown = wanted.filter((b) => !ALL_BANDS.some(([name]) => name === b));
if (unknown.length) {
  console.error(`unknown --bands value(s): ${unknown.join(', ')}`);
  console.error(`known bands: ${ALL_BANDS.map(([n]) => n).join(', ')}`);
  process.exit(2);
}
const BANDS = wanted.length ? ALL_BANDS.filter(([b]) => wanted.includes(b)) : ALL_BANDS;

/*
 * `--locations town` narrows the other axis. A full run is 16 frames and takes
 * the best part of an hour, most of which is four onboarding + save-load
 * sequences; iterating on ONE scene should not cost that. Same typo rule as
 * --bands: an unknown name exits rather than quietly capturing nothing.
 */
const wantedLocs = arg('--locations', '').split(',').map((l) => l.trim()).filter(Boolean);
const unknownLocs = wantedLocs.filter((l) => !LOCATIONS.includes(l));
if (unknownLocs.length) {
  console.error(`unknown --locations value(s): ${unknownLocs.join(', ')}`);
  console.error(`known locations: ${LOCATIONS.join(', ')}`);
  process.exit(2);
}
const PLACES = wantedLocs.length ? LOCATIONS.filter((l) => wantedLocs.includes(l)) : LOCATIONS;

const shots = [];
for (const [label, hour] of BANDS) {
  const { ctx, page } = await newPage(hour);
  for (const loc of PLACES) {
    const tabLabel = await page
      .getByRole('tab')
      .evaluateAll((els, want) => {
        const hit = els.find((e) => (e.getAttribute('aria-label') || '').toLowerCase().startsWith(want));
        return hit ? hit.getAttribute('aria-label') : null;
      }, loc);
    if (tabLabel && /locked/i.test(tabLabel)) {
      console.log(`skipped ${loc} ${label} — locked on the "${preset}" save`);
      continue;
    }
    await goTo(page, loc);
    const file = `${outDir}/frames/${loc}-${label}.png`;
    await page.screenshot({ path: file });
    shots.push({ loc, label, file });
    console.log('captured', loc, label);
  }
  await ctx.close();
}

// Motion: the same scene sampled over time. Stills cannot show idle drift,
// ear flicks or gesture decay, so none of it has ever actually been reviewed.
{
  const { ctx, page } = await newPage(14);
  await goTo(page, 'park');
  for (let i = 0; i < 8; i += 1) {
    await page.screenshot({ path: `${outDir}/frames/motion-${String(i).padStart(2, '0')}.png` });
    await page.waitForTimeout(420);
  }
  console.log('captured motion strip (8 frames)');
  await ctx.close();
}

await writeFile(`${outDir}/frames/index.json`, JSON.stringify(shots, null, 2));
await browser.close();
server.close();
console.log(`\nframes in ${outDir}/frames`);
