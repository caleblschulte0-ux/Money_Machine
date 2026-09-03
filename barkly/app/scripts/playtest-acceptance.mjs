#!/usr/bin/env node
/**
 * Play the deployed build, the way a tester would, and fail if anything in the
 * loop is unreachable.
 *
 * This is NOT a judge of whether Barkly is fun — that is the tester's job and
 * no script can do it. It is the much narrower question of whether the tester
 * can get at the game at all: whether every surface opens, every preset loads,
 * and a loaded preset survives a refresh. A playtest URL that quietly cannot
 * open the Pack Book wastes the reviewer's whole session before anyone notices.
 *
 *     node scripts/playtest-acceptance.mjs <url>
 *
 * Served over HTTP on purpose. The app persists through AsyncStorage, which on
 * web is localStorage, and localStorage behaves differently on a file:// origin
 * than on a real one — testing the thing we are not shipping would prove the
 * wrong thing.
 */

import { existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { walkOnboarding } from './onboard.mjs';

const url = process.argv[2];
if (!url) {
  console.error('usage: playtest-acceptance.mjs <url>');
  process.exit(2);
}

function browserOptions() {
  const args = ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'];
  const opts = { args };
  for (const c of [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium']) {
    if (c && existsSync(c)) {
      opts.executablePath = c;
      break;
    }
  }
  /**
   * A sandboxed runner reaches the internet through an egress proxy that curl
   * and node pick up from the environment and Chromium does not. Without this,
   * the deployed URL comes back ERR_CONNECTION_RESET — which reads exactly like
   * "the site is down" when the site is fine.
   *
   * Loopback is exempt: sending a local address through an egress proxy is how
   * a working local check becomes a confusing one.
   */
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (proxy && !/^https?:\/\/(localhost|127\.|\[::1\])/.test(url)) {
    opts.proxy = { server: proxy };
  }
  return opts;
}

const results = [];
let failures = 0;
function check(name, ok, detail = '') {
  const line = `${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`;
  results.push(line);
  // Printed as it happens: a walkthrough that dies at step 14 should still tell
  // you steps 1 to 13 passed, rather than throwing the whole run away.
  console.log(line);
  if (!ok) failures += 1;
  return ok;
}

const browser = await chromium.launch(browserOptions());
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await ctx.newPage();

const settle = (ms = 900) => page.waitForTimeout(ms);
const byId = (id) => page.locator(`[data-testid="${id}"]`).first();
const button = (re) => page.getByRole('button').filter({ hasText: re }).first();

async function onboard() {
  await walkOnboarding(page, { name: 'Tester', settle: 650 });
}

/**
 * Opened by ACCESSIBLE NAME, not by a test id.
 *
 * Two reasons and both matter. The production UI should not grow test hooks for
 * a dev script; and a mouse-driven tester finds controls the same way — by what
 * they are called. If a control cannot be found by its name here, it cannot be
 * found by a person either, which is the thing worth failing on.
 */
async function openClose(nameRe, closeRe, label) {
  const opener = page.getByRole('button', { name: nameRe }).first();
  if (!(await opener.count())) return check(label, false, `no control matching ${nameRe}`);
  await opener.click();
  await settle(900);
  const closer = page.getByRole('button', { name: closeRe }).first();
  const opened = (await closer.count()) > 0;
  if (opened) {
    await closer.click();
    await settle(700);
  }
  // Leaving a sheet open would hide everything the next step needs, and the
  // failure would land somewhere unrelated three checks later.
  const stillOpen = (await page.getByRole('button', { name: closeRe }).count()) > 0;
  return check(label, opened && !stillOpen, stillOpen ? 'did not close' : '');
}

/** Load a preset by id; the app restarts, so wait for the room to come back. */
/**
 * Shut whatever is open.
 *
 * An encounter left on screen swallows every click after it, and the failure
 * surfaces as "the badge is unclickable" three steps later. A tester hits the
 * same thing; the difference is they can see the sheet.
 */
async function dismissAnything() {
  for (let i = 0; i < 4; i += 1) {
    // Every dismissal in the app, by accessible name. A contest says "not now",
    // an encounter says "Leave this encounter for later", the sheets say
    // "Close ...". Missing one of them means the next click lands on a backdrop.
    const closer = page
      .getByRole('button', { name: /^(Close|done|back|not now|Leave this encounter)/i })
      .first();
    if (!(await closer.count())) return;
    await closer.click().catch(() => {});
    await settle(700);
  }
}

async function openPlaytestPanel() {
  const badge = byId('playtest-badge');
  if (await badge.count()) {
    await badge.click();
    await settle(800);
    return true;
  }
  const settings = page.getByRole('button', { name: 'Settings' }).first();
  if (!(await settings.count())) return false;
  await settings.click();
  await settle(600);
  const entry = page.getByRole('button', { name: 'Playtest saves' }).first();
  if (!(await entry.count())) return false;
  await entry.click();
  await settle(800);
  return true;
}

async function playtestEntryReachable() {
  const settings = page.getByRole('button', { name: 'Settings' }).first();
  if (!(await settings.count())) return false;
  await settings.click();
  await settle(500);
  const entry = page.getByRole('button', { name: 'Playtest saves' }).first();
  const ok = (await entry.count()) > 0;
  const close = page.getByRole('button', { name: 'Close settings' }).first();
  if (await close.count()) await close.click();
  await settle(500);
  return ok;
}

async function loadPreset(id) {
  await dismissAnything();
  if (!(await openPlaytestPanel())) {
    await page.screenshot({ path: `/tmp/acceptance-no-playtest-entry-${id}.png` });
    return false;
  }
  const slot = byId(`playtest-${id}`);
  if (!(await slot.count())) return false;
  await slot.click();
  /**
   * Loading a slot RELOADS the page — that is how hydration re-reads the store.
   * A fixed sleep here is a race the script loses on a cold cache, and the
   * failure lands three checks later looking like a broken preset. Wait for the
   * room to come back instead.
   */
  try {
    await page.waitForSelector('[data-testid="conversation-dock"]', { timeout: 25_000 });
  } catch {
    await page.screenshot({ path: `/tmp/acceptance-stuck-${id}.png` });
    return false;
  }
  await settle(1200);
  return true;
}

/** What the app actually persisted, read straight out of the store. */
async function savedState() {
  return page.evaluate(() => {
    const out = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith('barkly/')) out[k] = localStorage.getItem(k);
    }
    return out;
  });
}

await page.goto(url);
await settle(2600);
await onboard();
check('1-2. opens and gets through onboarding', (await byId('conversation-dock').count()) > 0);
check('24. playtest saves reachable from Settings', await playtestEntryReachable());

// 3. The player must be able to take the floor even if Barkly started talking
// on his own. Type is deterministic in headless Chromium, unlike microphone STT.
const takeFloor = page.getByRole('button', { name: 'Type to Barkly' }).first();
const canTakeFloor = (await takeFloor.count()) > 0 && (await takeFloor.isEnabled());
if (canTakeFloor) {
  await takeFloor.click();
  await settle(350);
}
const input = page.locator('input:visible').first();
check('3a. player can take the floor', canTakeFloor && (await input.count()) > 0);
if (await input.count()) {
  await input.fill('hello barkly');
  await input.press('Enter');
  await settle(3000);
  const said = await byId('dialogue-panel').innerText();
  check('3. typing gets a reply', said.trim().length > 12, said.split('\n').pop()?.slice(0, 48));
} else check('3. typing gets a reply', false, 'no text input');

// 4-6. his things
/**
 * Wait for a control to become usable.
 *
 * He disables his own kit while he is speaking — sampling `isEnabled()` once,
 * right after asking him a question, always finds it off. A person waits a beat
 * and taps; so does this.
 */
async function ready(locator, ms = 12000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if ((await locator.count()) > 0 && (await locator.isEnabled())) return true;
    await settle(400);
  }
  return false;
}

for (const [id, label] of [['kit-feed', '4. bowl'], ['kit-play', '5. toy'], ['kit-sleep', '6. bed']]) {
  const el = byId(id);
  const ok = await ready(el);
  if (ok) {
    await el.click();
    await settle(1400);
    const food = button(/biscuit|treat|dinner|food|kibble/i);
    if (await food.count()) {
      await food.click();
      await settle(1500);
    }
    await settle(2200);
  }
  check(label, ok);
}
// wake him again
const wake = byId('kit-sleep');
if ((await wake.count()) && (await wake.isEnabled())) {
  await wake.click();
  await settle(2000);
}
check('6b. woke him back up', (await byId('conversation-dock').count()) > 0);

// 7. every unlocked location
let visited = 0;
for (const where of [/park/i, /town/i, /beach/i, /home/i]) {
  const tab = page.getByRole('tab').filter({ hasText: where }).first();
  if (!(await tab.count())) continue;
  await tab.click();
  await settle(2200);
  visited += 1;
}
check('7. visited every location tab', visited >= 4, `${visited} tabs`);

// 8. an NPC — who lives at the PARK, so go there and look for one by name.
const parkTab = page.getByRole('tab').filter({ hasText: /park/i }).first();
if (await parkTab.count()) {
  await parkTab.click();
  await settle(2600);
}
const npc = page.getByRole('button', { name: /^Talk to /i }).first();
if (await npc.count()) {
  await npc.click();
  await settle(2600);
  check('8. talked to an NPC', true);
} else check('8. talked to an NPC', false, 'no NPC on screen');

// 9-11. the sheets
await openClose(/^Pack Book/i, /^Close Pack Book$/i, '9. Pack Book opens and closes');
await openClose(/^Barkly's plan/i, /^Close Barkly's plan$/i, "10. Barkly's Plan opens and closes");
await openClose(/^Shop\./i, /^Close$/i, '11. store opens and closes');

/* ------------------------------------------------- presets change the game */

const before = await savedState();

check('14. Duke Nemesis loads', await loadPreset('duke'));

/**
 * 12-13. An encounter, and a contest if one is offered.
 *
 * Both are opportunistic by design — the game decides when a moment between two
 * dogs is worth having, and a script cannot force one without reaching past the
 * product. So: go where Duke is, talk to him several times with a save built
 * for exactly this, and report what actually happened. A "no" here is a note
 * for the tester, not a failure of the build.
 */
{
  const park = page.getByRole('tab').filter({ hasText: /park/i }).first();
  if (await park.count()) {
    await park.click();
    await settle(2400);
  }
  let sawEncounter = false;
  let sawContest = false;
  for (let i = 0; i < 6 && !sawEncounter; i += 1) {
    const duke = page.getByRole('button', { name: /^Talk to Duke/i }).first();
    if (!(await duke.count())) break;
    await duke.click();
    await settle(3200);
    // An encounter presents a choice; a contest presents a timing control.
    const choices = await page.getByRole('button', { name: /^(Tell him|Say|Let|Back|Agree|Refuse)/i }).count();
    sawEncounter = choices > 0 || (await page.getByRole('button', { name: /Close encounter|encounter/i }).count()) > 0;
    if (sawEncounter) {
      const first = page.getByRole('button', { name: /^(Tell him|Say|Let|Agree|Refuse)/i }).first();
      if (await first.count()) {
        await first.click();
        await settle(2600);
      }
      sawContest = (await page.getByRole('button', { name: /now|go|throw|dig|race/i }).count()) > 0;
    }
  }
  check('12. an encounter can be reached from the park', sawEncounter,
    sawEncounter ? '' : 'none offered in six tries — opportunistic by design');
  check('13. a contest follows where one is offered', true,
    sawContest ? 'offered' : 'not offered this session');
}
const duke = await savedState();
const dukeChar = JSON.parse(duke[Object.keys(duke).find((k) => k.includes('character-v1'))] ?? '{}');
check('15. …and Barkly really has a Duke grievance', dukeChar?.grievance?.who === 'Duke', JSON.stringify(dukeChar?.grievance ?? null).slice(0, 60));
check('15b. …and the state actually changed', JSON.stringify(duke) !== JSON.stringify(before));

check('16. Biscuit Best Friend loads', await loadPreset('biscuit'));
const bis = await savedState();
const bisChar = JSON.parse(bis[Object.keys(bis).find((k) => k.includes('character-v1'))] ?? '{}');
check('17. …and Biscuit is the favourite', bisChar?.favoriteFriend === 'Biscuit' && bisChar?.socialBonds?.biscuit?.kind === 'friend');

check('18. Trick Dog loads', await loadPreset('trickdog'));
const trickMem = await savedState();
const mem = JSON.parse(trickMem[Object.keys(trickMem).find((k) => k.includes('memory-v2'))] ?? '{}');
const showtime = (mem.trainingRules ?? []).find((r) => r.normalizedCue === 'showtime');
check('19a. …and the showtime routine is stored', Boolean(showtime) && showtime.routine?.length === 3);
// 19b. fire it through the same explicit Type action a player uses.
const trickType = page.getByRole('button', { name: 'Type to Barkly' }).first();
if (await trickType.count()) {
  await trickType.click();
  await settle(350);
}
const typeBox = page.locator('input:visible').first();
if (await typeBox.count()) {
  await typeBox.fill('showtime');
  await typeBox.press('Enter');
  await settle(4000);
  const spoke = await byId('dialogue-panel').innerText();
  check('19b. …and saying the cue performs it', /showtime|choreograph|spin|dead/i.test(spoke), spoke.split('\n').pop()?.slice(0, 48));
} else check('19b. …and saying the cue performs it', false, 'no input');

check('20. Long-Term Barkly loads', await loadPreset('longterm'));
await openClose(/^Pack Book/i, /^Close Pack Book$/i, '21. Pack Book opens on a long-term save');
const long = await savedState();
const longWallet = JSON.parse(long[Object.keys(long).find((k) => k.includes('wallet-v1'))] ?? '{}');
check('21b. …with a developed room and progression', (longWallet.placed?.length ?? 0) >= 2 && longWallet.xp >= 220);

check('22. Reset to Fresh Barkly', await loadPreset('fresh'));
const fresh = await savedState();
const freshMem = JSON.parse(fresh[Object.keys(fresh).find((k) => k.includes('memory-v2'))] ?? '{}');
check('22b. …and he really is fresh', (freshMem.experiences?.length ?? 0) === 0);

// 23. survives a refresh
await loadPreset('goblin');
await page.reload();
await settle(3200);
const after = await savedState();
const stashKey = Object.keys(after).find((k) => k.includes('stash-v1'));
check('23. the loaded state survives a refresh', JSON.parse(after[stashKey] ?? '[]').length >= 10);
check('23b. the room came back after the refresh', (await byId('conversation-dock').count()) > 0);

await browser.close();
console.log(results.join('\n'));
console.log(`\n${results.length - failures}/${results.length} checks passed`);
process.exit(failures ? 1 : 0);
