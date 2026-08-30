#!/usr/bin/env node
/**
 * Prove the player-facing build cannot reach the playtester — in a browser,
 * because that is the only place the answer is true or false.
 *
 * Metro bundles `PlaytestSheet` into BOTH builds. The component's CODE ships
 * either way. What differs is a build-time flag that decides whether the
 * Settings entry can render, so string matching a minified bundle cannot prove
 * the production surface is actually reachable.
 *
 *     node scripts/no-playtest-check.mjs <player.html> <playtest.html>
 *
 * Open each build, finish onboarding, open Settings, and look for the
 * accessible "Playtest saves" entry. Then try to coax the player build into
 * exposing it with ?playtest=1. Both directions are checked so a broken
 * selector cannot masquerade as a successful production lockout.
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

/** Open a build, finish onboarding, then report whether Playtest saves exists. */
async function playtestEntryVisible(file, query = '') {
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
  const reached = await page.locator('[data-testid="conversation-dock"]').first().count();

  let entry = false;
  const settings = page.getByRole('button', { name: 'Settings' }).first();
  if (await settings.count()) {
    await settings.click();
    await page.waitForTimeout(500);
    entry = (await page.getByRole('button', { name: 'Playtest saves' }).count()) > 0;
  }

  await ctx.close();
  return { reached, entry };
}

const problems = [];

const plain = await playtestEntryVisible(player);
if (!plain.reached) problems.push(`${player}: never reached the room, so this proved nothing`);
if (plain.entry) problems.push(`${player}: exposes Playtest saves — the player build must not`);

const coaxed = await playtestEntryVisible(player, '?playtest=1');
if (coaxed.entry) problems.push(`${player}: ?playtest=1 unlocked the playtester on a player build`);

const armed = await playtestEntryVisible(playtest);
if (!armed.reached) problems.push(`${playtest}: never reached the room, so this proved nothing`);
if (!armed.entry) problems.push(`${playtest}: no Playtest saves entry — the build flag did not take`);

await browser.close();

if (problems.length) {
  console.error(problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}
console.log('player build: no playtester, and ?playtest=1 does not summon one.');
console.log('playtest build: Playtest saves is reachable from Settings.');