#!/usr/bin/env node
/**
 * Prove the player-facing build cannot reach the playtester — in a browser,
 * because that is the only place the answer is true or false.
 *
 * The first version of this grepped the HTML for the menu's title and failed
 * immediately, correctly: Metro bundles `PlaytestSheet` into BOTH builds. The
 * component's CODE ships either way. What differs is a build-time flag that
 * decides whether anything ever renders it, and no amount of string matching
 * on a minified bundle can tell you which way that went.
 *
 *     node scripts/no-playtest-check.mjs <player.html> <playtest.html>
 *
 * So: open each build, get past onboarding, and look for the badge. Then try to
 * talk the player build into showing it with ?playtest=1, which is the exact
 * thing a curious person types. Both directions are checked, because "not
 * found" is also what a broken selector looks like.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const [player, playtest] = process.argv.slice(2);
if (!player || !playtest) {
  console.error('usage: no-playtest-check.mjs <player.html> <playtest.html>');
  process.exit(2);
}
for (const f of [player, playtest]) {
  if (!existsSync(f)) {
    console.error(`missing build: ${f}`);
    process.exit(2);
  }
}

function browserOptions() {
  const args = ['--no-sandbox'];
  for (const candidate of [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium']) {
    if (candidate && existsSync(candidate)) return { executablePath: candidate, args };
  }
  return { args };
}

const browser = await chromium.launch(browserOptions());

/** Open a build, finish onboarding, and report whether the badge is there. */
async function badgeVisible(file, query = '') {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`file://${resolve(file)}${query}`);
  await page.waitForTimeout(2400);
  for (let i = 0; i < 8; i += 1) {
    const input = page.locator('input:visible').first();
    if (await input.count()) {
      const ph = (await input.getAttribute('placeholder')) || '';
      if (/name|call/i.test(ph)) await input.fill('Tester');
    }
    const next = page.getByRole('button').filter({ hasText: /^(hi|tell him|next|okay|skip)$/i }).first();
    if ((await next.count()) && (await next.isEnabled())) {
      await next.click();
      await page.waitForTimeout(600);
    } else break;
  }
  await page.waitForTimeout(1200);
  const reached = await page.locator('[data-testid="dialogue-panel"]').first().count();
  const badge = await page.locator('[data-testid="playtest-badge"]').count();
  await ctx.close();
  return { reached: reached > 0, badge: badge > 0 };
}

const problems = [];

const plain = await badgeVisible(player);
if (!plain.reached) problems.push(`${player}: never reached the room, so this proved nothing`);
if (plain.badge) problems.push(`${player}: shows the PLAYTEST badge — the player build must not`);

const coaxed = await badgeVisible(player, '?playtest=1');
if (coaxed.badge) problems.push(`${player}: ?playtest=1 unlocked the playtester on a player build`);

const armed = await badgeVisible(playtest);
if (!armed.reached) problems.push(`${playtest}: never reached the room, so this proved nothing`);
if (!armed.badge) problems.push(`${playtest}: no PLAYTEST badge — the build flag did not take`);

await browser.close();

if (problems.length) {
  console.error(problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}
console.log('player build: no playtester, and ?playtest=1 does not summon one.');
console.log('playtest build: badge present.');
