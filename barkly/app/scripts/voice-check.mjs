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
import { walkOnboarding } from './onboard.mjs';

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

// Slowly, so each beat actually gets to SPEAK before the next click. At the
// default 700ms settle the walker outran the audio and this check saw one
// line out of six -- a sample of one, which is the failure it was written to
// stop happening somewhere else.
await walkOnboarding(page, { settle: 2400 });

/*
 * ONBOARDING IS MEASURED ON ITS OWN, AND ITS BAR IS ZERO.
 *
 * Every line in the meeting is fixed, so every one of them can be recorded --
 * unlike a conversation, where the composer quotes the word you typed and some
 * lines are unbankable by construction. It is also the beat that most needs his
 * voice, and it is where the narrator kept turning up: a line reading
 * `${name}. Okay. ${name}. I'll remember that` has the name in the MIDDLE, the
 * harvester skips any literal with a substitution in it, and so the sentence
 * where he first says your name back to you was the screen reader. A previous
 * pass reported "0 lines to the narrator" through the whole meeting from a
 * harness that also reported 3/3 at 100%. This one reads the counter.
 */
const metSpoke = await page.evaluate('window.__SPOKE || []');
const metPlayed = await page.evaluate('(window.__PLAYED || []).length');
if (metSpoke.length) {
  console.error(`\nFAIL: ${metSpoke.length} line(s) of ONBOARDING came out in the browser narrator:`);
  for (const line of metSpoke) console.error(`  ${line}`);
  console.error(
    '\nEvery line in the meeting is fixed and every one of them can be banked.\n' +
      'A line with a substitution in the MIDDLE cannot: pull the fixed half out\n' +
      'into its own constant and put the name at the front, where\n' +
      'voiceEngine.speakable can split it off. See onboarding.DELIGHT_BODY.',
  );
  await browser.close();
  process.exit(1);
}
/*
 * And it has to have HEARD something. "0 narrated" is trivially true of a
 * walker that clicked through faster than the audio could start.
 */
const MEETING_FLOOR = 4;
if (metPlayed < MEETING_FLOOR) {
  console.error(
    `\nFAIL: only ${metPlayed} line(s) played during the meeting, expected at least ${MEETING_FLOOR}.` +
      '\nEither the walker is outrunning the audio (raise its settle) or beats that' +
      '\nused to speak have stopped speaking.',
  );
  await browser.close();
  process.exit(1);
}
console.log(`the meeting: ${metPlayed} lines, all in his own voice`);

// WAIT for it. `walkOnboarding` returns the instant the room's Pack Book
// button exists, which is a frame or two before the conversation dock under it
// has mounted -- so asking straight away raced, and the check aborted saying it
// had proved nothing on a build where onboarding had in fact completed.
await page
  .locator('[data-testid="dialogue-panel"]')
  .first()
  .waitFor({ state: 'attached', timeout: 8000 })
  .catch(() => {});
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
/*
 * OPEN THE COMPOSER FIRST. It closes after every send, so a `type()` that only
 * looked for a visible input found one on the first call and silently returned
 * on every call after it -- this check typed five things, measured three
 * utterances, and printed "3/3 lines (100%)". A gate that reports a perfect
 * score off a sample of three is worse than no gate: it is a green light with
 * nothing behind it.
 */
const type = async (text) => {
  const open = page.getByRole('button', { name: /Type to Barkly/i }).first();
  if (await open.count()) {
    await open.click().catch(() => {});
    await page.waitForTimeout(600);
  }
  const input = page.locator('input:visible').first();
  if (!(await input.count())) {
    console.error(`could not open the composer to say "${text}" — this check is not walking the app.`);
    process.exitCode = 1;
    return;
  }
  await input.fill(text);
  await input.press('Enter');
  await page.waitForTimeout(5000);
};

await tap('kit-feed');
await tap('kit-play');
await type('hello barkly');
await type('do you like squirrels');
await type('what is a skateboard');
/*
 * The OFFLINE brain's own answers, which are the ones a stranger hears.
 *
 * Every question below lands in `scripted.answerQuestion` -- a different code
 * path from the composed replies above, and one that was entirely missing from
 * the voice bank's source list, so all of it came out in the browser narrator
 * while this check reported 3/3. The check has to walk the paths, not a path.
 */
await type("what's your name");
await type('are you a robot');
await type('what should we do');
await type('sit');
await type('are you hungry');
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

/*
 * A FLOOR, not just "did any recording play".
 *
 * The pass condition used to be "at least one banked clip", and this check
 * reported "3/3 lines (100%)" on a session where it had only managed to say
 * three things -- while an entire brain file was missing from the bank's
 * source list and every one of its answers went to the narrator. One clip is
 * not a voice; a share is.
 *
 * It is not 100% and cannot be. Some lines weld the player's own words into
 * the middle of a sentence -- the composer echoes the word you typed, by
 * design, and the bank matches whole recordings -- so those can never be
 * recorded for anybody. Measured on this session: 8 of 11, with the three
 * narrated ones all of that shape. 60% is the floor because which lines a
 * session lands on is partly random; the point is to catch a whole path
 * falling out of the bank, which is what happened.
 */
const FLOOR = 0.6;
if (total > 0 && banked.length / total < FLOOR) {
  console.error(
    `\nFAIL: only ${banked.length} of ${total} lines were his own voice (floor is ${Math.round(FLOOR * 100)}%).\n` +
      'Either a source file holding his fixed lines is missing from SOURCES in\n' +
      'scripts/voice-bank.mjs, or lines that used to be fixed now interpolate\n' +
      'player text and can no longer be banked. The narrator lines are listed above.',
  );
  process.exit(1);
}

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
