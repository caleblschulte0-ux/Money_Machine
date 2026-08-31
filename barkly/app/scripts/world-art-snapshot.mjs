#!/usr/bin/env node
/**
 * Render-review harness for the Barkly world overhaul.
 *
 * This is deliberately NOT a deployment test. It builds a local playtest page,
 * loads a mature save with every location available, visits each world at a
 * real phone viewport and writes screenshots for human/vision review.
 *
 * The point is to stop judging environment art from JSX. A scene can have the
 * right components and still look cheap once the real dog, HUD and safe areas
 * are composited over it. These are the pixels we review before the build is
 * ever allowed near the live Barkly branch.
 */

import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { chromium } from 'playwright';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const htmlPath = resolve(arg('--html', 'world-artifact.html'));
const outDir = resolve(arg('--out', 'world-art'));
if (!existsSync(htmlPath)) {
  console.error(`missing ${htmlPath}. Build the playtest artifact first.`);
  process.exit(2);
}
await mkdir(outDir, { recursive: true });

const html = await readFile(htmlPath);
const server = createServer((req, res) => {
  if (req.url === '/' || req.url === `/${basename(htmlPath)}`) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(html);
    return;
  }
  res.writeHead(404);
  res.end('not found');
});
await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('could not start local art-review server');
const url = `http://127.0.0.1:${address.port}/`;

const browser = await chromium.launch({ args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: 'America/Chicago' });
const page = await ctx.newPage();
const settle = (ms = 900) => page.waitForTimeout(ms);

async function onboard() {
  for (let i = 0; i < 10; i += 1) {
    const input = page.locator('input:visible').first();
    if (await input.count()) {
      const ph = (await input.getAttribute('placeholder')) || '';
      if (/name|call/i.test(ph)) await input.fill('Art Review');
    }
    const next = page.getByRole('button').filter({ hasText: /^(hi|tell him|next|okay|skip)$/i }).first();
    if ((await next.count()) && (await next.isEnabled())) {
      await next.click();
      await settle(550);
    } else break;
  }
  await page.waitForSelector('[data-testid="dialogue-panel"]', { timeout: 20_000 });
  await settle(1000);
}

async function loadRichPreset() {
  const badge = page.locator('[data-testid="playtest-badge"]').first();
  if (await badge.count()) {
    await badge.click();
  } else {
    // Current responsive builds keep test tooling inside Settings so the
    // actual world composition is not paying for a permanent dev badge.
    const settings = page.getByLabel('Settings').first();
    if (!(await settings.count())) throw new Error('Settings missing while opening playtest saves');
    await settings.click();
    await settle(500);
    const playtest = page.locator('[data-testid="playtest-settings"]').first();
    if (!(await playtest.count())) {
      throw new Error('Playtest saves missing in Settings — snapshot build must set EXPO_PUBLIC_BARKLY_PLAYTEST=always');
    }
    await playtest.click();
  }
  await settle(650);
  const slot = page.locator('[data-testid="playtest-rich"]').first();
  if (!(await slot.count())) throw new Error('Rich Barkly playtest slot missing');
  await Promise.all([
    page.waitForLoadState('domcontentloaded').catch(() => {}),
    slot.click(),
  ]);
  await page.waitForSelector('[data-testid="dialogue-panel"]', { timeout: 25_000 });
  await settle(1400);
}

async function capture(name) {
  const tab = page.getByRole('tab').filter({ hasText: new RegExp(`^${name}$`, 'i') }).first();
  if (!(await tab.count())) throw new Error(`${name} tab missing`);
  await tab.click();
  await settle(2200);
  // Wait an extra beat so the local ambient loops are visible rather than all
  // being sampled at their zero frame.
  await settle(650);
  const file = resolve(outDir, `${name.toLowerCase()}-390x844@2x.png`);
  await page.screenshot({ path: file, fullPage: false, animations: 'allow' });
  console.log(`captured ${name}: ${file}`);
}

try {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await settle(1800);
  await onboard();
  await loadRichPreset();
  for (const name of ['Home', 'Park', 'Town', 'Beach']) await capture(name);
  console.log(`world-art snapshots written to ${outDir}`);
} finally {
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}
