#!/usr/bin/env node
/**
 * Does the published artifact actually make the right noise?
 *
 * The banked voice fails in exactly one way, and it fails LOUDLY-QUIETLY: the
 * recordings are in the file, the lookup is correct, and the browser cannot
 * play them because the audio never became a `data:` URI on the way through the
 * bundler. The page looks fine. The dog talks. He talks in the browser's
 * screen-reader narrator, which is the exact thing this feature exists to stop,
 * and no test in the repo can tell the difference — every unit test here mocks
 * the player.
 *
 * So this drives the real artifact in a real browser, taps a control that makes
 * him say a fixed line, and asserts on what the audio element was handed:
 *
 *     node scripts/voice-check.mjs [--artifact barkly-artifact.html]
 *
 * A `data:audio/mpeg` src is the pass. An `/assets/...mp3` src means the
 * inliner missed it and the artifact is silent for everyone who opens it. No
 * audio element at all means he fell through to the narrator.
 */

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { assertFreshArtifact } from './fresh-artifact.mjs';

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

/** Same browser the other UI checks use — the sandbox ships one, pinned. */
function browserOptions() {
  // Headless Chromium blocks audio until the page has been clicked. His voice
  // only ever follows a tap, so the gesture is real in the app; here the policy
  // would just make the check flaky.
  const args = ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'];
  for (const candidate of [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium']) {
    if (candidate && existsSync(candidate)) return { executablePath: candidate, args };
  }
  return { args };
}

const browser = await chromium.launch(browserOptions());
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });

// Record what every audio element is ASKED to play, before the app loads.
await ctx.addInitScript(`
  window.__PLAYED = [];
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    try { window.__PLAYED.push(String(this.currentSrc || this.src || '').slice(0, 64)); } catch {}
    return play.apply(this, arguments);
  };
  const speak = window.speechSynthesis && window.speechSynthesis.speak;
  if (speak) {
    window.__SPOKE = [];
    window.speechSynthesis.speak = function (u) {
      try { window.__SPOKE.push(String(u.text).slice(0, 60)); } catch {}
      return speak.apply(window.speechSynthesis, arguments);
    };
  }
`);

const page = await ctx.newPage();
await page.goto(`file://${html}`);
await page.waitForTimeout(2600);

for (let i = 0; i < 8; i += 1) {
  const input = page.locator('input:visible').first();
  if (await input.count()) {
    const ph = (await input.getAttribute('placeholder')) || '';
    if (/name|call/i.test(ph)) await input.fill('Caleb');
  }
  const next = page.getByRole('button').filter({ hasText: /^(hi|tell him|next|okay|skip)$/i }).first();
  if ((await next.count()) && (await next.isEnabled())) {
    await next.click();
    await page.waitForTimeout(700);
  } else break;
}
await page.waitForTimeout(1500);

if (!(await page.locator('[data-testid="dialogue-panel"]').first().count())) {
  console.error('never reached the room — onboarding did not complete, so this check proved nothing.');
  await browser.close();
  process.exit(1);
}

/**
 * Play a short session rather than firing one control.
 *
 * A single tap proves the plumbing works. What we actually want to know is the
 * SPLIT — how much of a real minute with him is his own voice and how much is
 * the browser's narrator — because that is the number to quote, and quoting a
 * hoped-for one is how a feature gets called finished while it is half working.
 */
const fed = page.locator('[data-testid="kit-feed"]').first();
if (!(await fed.count())) {
  console.error('no feed control on screen — the kit changed and this check needs updating.');
  await browser.close();
  process.exit(1);
}

const tap = async (testid) => {
  const control = page.locator(`[data-testid="${testid}"]`).first();
  if (!(await control.count()) || !(await control.isEnabled())) return;
  await control.click();
  await page.waitForTimeout(1200);
  // Feeding opens a picker; take whatever it offers.
  const choice = page.getByRole('button').filter({ hasText: /biscuit|treat|dinner|food|kibble/i }).first();
  if (await choice.count()) {
    await choice.click();
    await page.waitForTimeout(1200);
  }
  await page.waitForTimeout(3200);
};
const type = async (text) => {
  const input = page.locator('input:visible').first();
  if (!(await input.count())) return;
  await input.fill(text);
  await input.press('Enter');
  await page.waitForTimeout(5000);
};

await tap('kit-feed');
await tap('kit-play');
await type('hello barkly');
await type('do you like squirrels');
await type('what is a skateboard');
for (const where of [/park/i, /town/i, /home/i]) {
  const t = page.getByRole('tab').filter({ hasText: where }).first();
  if (await t.count()) {
    await t.click();
    await page.waitForTimeout(4500);
  }
}
await tap('kit-sleep');
await page.waitForTimeout(8000); // let an idle thought surface

const played = await page.evaluate('window.__PLAYED || []');
const spoke = await page.evaluate('window.__SPOKE || []');
await browser.close();

const banked = played.filter((s) => s.startsWith('data:audio'));
const broken = played.filter((s) => !s.startsWith('data:audio') && s);

const total = banked.length + spoke.length;
console.log(`his own voice:  ${banked.length}/${total} lines` + (total ? ` (${Math.round((banked.length / total) * 100)}%)` : ''));
console.log(`the narrator:   ${spoke.length}/${total} lines`);
if (broken.length) console.log(`not inlined:   ${broken.join('\n               ')}`);
for (const line of spoke) console.log(`  narrator: ${line}`);

if (banked.length === 0) {
  console.error(
    '\nFAIL: he spoke without playing a banked recording.\n' +
      (broken.length
        ? 'The audio is in the bundle but not as a data: URI — scripts/build-artifact.mjs\n' +
          'did not inline it, so the page is asking for a file that is not there.'
        : 'No audio element was used at all: the lookup missed and he fell through to\n' +
          'the device narrator. Check that voiceBank.ts is keyed on the POST-dialect text.'),
  );
  process.exit(1);
}
console.log('\nOK: the artifact plays his real voice.');
