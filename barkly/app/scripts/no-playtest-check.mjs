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
import { walkOnboarding } from './onboard.mjs';
import { browserOptions } from './lib/browser.mjs';
import { assertFreshArtifact } from './fresh-artifact.mjs';

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



/*
 * THIS ONE ESPECIALLY MUST NOT PASS ON A STALE BUILD.
 *
 * Every other gate reading an old artifact reports last build's art. This one
 * reports last build's SECURITY: it is the check that the player build has no
 * route to the playtest menu, and a stale pass would sign off a build nobody
 * has actually inspected. Six of the eight browser gates already assert this
 * and the two that did not were this and composition.mjs.
 */
for (const path of [player, playtest]) assertFreshArtifact(path, 'npm run build:pages');

const browser = await chromium.launch(browserOptions());

/** Open a build, finish onboarding, then report whether Playtest saves exists. */
async function playtestEntryVisible(file, query = '') {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`file://${resolve(file)}${query}`);
  await page.waitForTimeout(2400);
  await walkOnboarding(page, { name: 'Tester', settle: 650 });
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