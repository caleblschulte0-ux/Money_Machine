#!/usr/bin/env node
/**
 * App Store screenshots, at the exact pixel sizes App Store Connect accepts,
 * rendered from the web build's playtest slots.
 *
 *   6.7"  1290 x 2796   (iPhone 15 Pro Max class)  = 430 x 932 @3x
 *   6.1"  1179 x 2556   (iPhone 15 Pro class)      = 393 x 852 @3x
 *
 * These are the app's REAL screens -- same code, same saves -- at store pixel
 * sizes. They are not device captures: no status bar, no notch, and the web
 * build runs the offline Barkly. Not committed: twelve frames are ~23MB and
 * the repo keeps media out of git (store/screenshots/ is ignored) -- run this
 * and upload the output. They are the honest starting set; replace
 * them with TestFlight captures once a physical pass exists (see
 * docs/APP_STORE_RELEASE.md). Each frame is chosen to show the product's
 * claim, not the menu: he remembers, he was taught, the park has politics,
 * the Pack Book is yours.
 *
 *   node scripts/store-screenshots.mjs http://localhost:8099/playtest/ [--out ../store/screenshots]
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { walkOnboarding } from './onboard.mjs';

const url = process.argv[2] || 'http://localhost:8099/playtest/';
const outArg = process.argv.indexOf('--out');
const OUT = outArg >= 0 ? process.argv[outArg + 1] : '../store/screenshots';
mkdirSync(OUT, { recursive: true });

const SIZES = [
  { tag: '6.7in', width: 430, height: 932 },
  { tag: '6.1in', width: 393, height: 852 },
];

const opts = { args: ['--no-sandbox'] };
if (existsSync('/opt/pw-browsers/chromium')) opts.executablePath = '/opt/pw-browsers/chromium';
const browser = await chromium.launch(opts);

for (const size of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 3 });
  /*
   * DAYTIME, PINNED. The world reads the device clock -- sky, light, his
   * sleepiness -- so a run in the evening rendered every frame as night, dark
   * purple, which is nobody's first impression of the app. Same pin
   * scene-shot.mjs uses.
   */
  await ctx.addInitScript(() => { Date.prototype.getHours = function () { return 14; }; });
  const page = await ctx.newPage();
  const settle = (ms = 900) => page.waitForTimeout(ms);
  const byId = (id) => page.locator(`[data-testid="${id}"]`).first();
  const shot = (n) => page.screenshot({ path: `${OUT}/${size.tag}-${n}.png` });
  const dismiss = async () => {
    for (let i = 0; i < 4; i++) {
      const c = page.getByRole('button', { name: /^(Close|done|back|not now|Leave this encounter|Close settings|Close encounter|✕)/i }).first();
      if (await c.count()) { await c.click({ timeout: 2000 }).catch(() => {}); await settle(350); } else break;
    }
    await page.keyboard.press('Escape').catch(() => {}); await settle(300);
  };
  /*
   * TAP THROUGH A BACKDROP. After a typed exchange the composer leaves a
   * full-screen backdrop up for a beat, and a normal click on a tab under it
   * times out. A person taps once (the backdrop closes) and taps again; so
   * does this -- a raw mouse click at the target's centre lands on whatever is
   * on top, then the real click is retried.
   */
  const tap = async (locator) => {
    for (let i = 0; i < 5; i++) {
      try { await locator.click({ timeout: 2500 }); return; } catch {
        const box = await locator.boundingBox().catch(() => null);
        if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await page.keyboard.press('Escape').catch(() => {});
        await settle(700);
      }
    }
    throw new Error('could not reach control through the backdrop');
  };
  const load = async (id) => {
    await dismiss();
    await tap(page.getByRole('button', { name: 'Settings' }).first()); await settle(500);
    await tap(page.getByRole('button', { name: 'Playtest saves' }).first()); await settle(700);
    await byId(`playtest-${id}`).click({ timeout: 8000 });
    await page.waitForSelector('[data-testid="conversation-dock"]', { timeout: 25000 }).catch(() => {});
    await settle(1500);
  };
  const say = async (text, wait = 2600) => {
    const t = page.getByRole('button', { name: 'Type to Barkly' }).first();
    await tap(t); await settle(400);
    const inp = page.getByRole('textbox').first(); await inp.fill(text); await page.keyboard.press('Enter'); await settle(wait);
  };

  await page.goto(url, { waitUntil: 'networkidle' }); await settle(1200);
  await walkOnboarding(page).catch(() => {}); await settle(1000);

  // 1. Home, a long-term Barkly -- the room is his and he is the subject.
  await load('longterm'); await shot('1-home');
  // 2. He remembers: the product's central claim, in his mouth.
  await say('do you remember what we did?', 3200); await shot('2-remembers');
  await dismiss();
  // 3. The park, with the recurring dogs.
  await tap(page.getByRole('tab').filter({ hasText: /park/i }).first()); await settle(1600); await shot('3-park');
  // 4. An encounter with a choice.
  const npc = page.getByRole('button', { name: /^Talk to /i }).first();
  if (await npc.count()) { await tap(npc); await settle(1500); await shot('4-encounter'); await dismiss(); }
  // 5. The Pack Book -- "what kind of Barkly did you make".
  await tap(page.getByRole('button', { name: /pack/i }).first()); await settle(1000); await shot('5-pack-book'); await dismiss();
  // 6. Taught: Trick Dog performs a cue.
  await load('trickdog'); await say('showtime', 3000); await shot('6-taught');
  await ctx.close();
  console.log(`${size.tag}: 6 frames at ${size.width * 3}x${size.height * 3}`);
}
await browser.close();
