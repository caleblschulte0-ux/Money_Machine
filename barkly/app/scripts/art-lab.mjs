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

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const htmlPath = resolve(arg('--html', 'dist/playtest/index.html'));
const outDir = resolve(arg('--out', 'art-lab'));
const preset = arg('--preset', 'longterm');
if (!existsSync(htmlPath)) { console.error(`missing ${htmlPath}`); process.exit(2); }
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
  for (let i = 0; i < 10; i += 1) {
    const input = page.locator('input:visible').first();
    if (await input.count()) {
      const ph = (await input.getAttribute('placeholder')) || '';
      if (/name|call/i.test(ph)) await input.fill('Caleb');
    }
    const btn = page.getByRole('button').filter({ hasText: /^(hi|tell him|next|okay|skip)$/i }).first();
    if ((await btn.count()) && (await btn.isEnabled())) { await btn.click(); await page.waitForTimeout(520); }
    else break;
  }
  await page.waitForTimeout(1400);
  // Load a developed save so the world is furnished and the room has history.
  // Loading a developed save is a NICE-TO-HAVE for the art review: the world
  // art is identical either way, only the room's history props differ. It is
  // wrapped so a harness quirk in the save sheet can never block the capture,
  // which is the whole point of this tool.
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
          await page.waitForSelector('[data-testid="dialogue-panel"]', { timeout: 20000 }).catch(() => {});
        }
      }
    }
  } catch {
    console.warn('  (preset not loaded; capturing the default save)');
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
  if (await tab.count()) { await tab.click({ force: true }); await page.waitForTimeout(3000); }
}

const shots = [];
for (const [label, hour] of [['day', 14], ['night', 22]]) {
  const { ctx, page } = await newPage(hour);
  for (const loc of LOCATIONS) {
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
