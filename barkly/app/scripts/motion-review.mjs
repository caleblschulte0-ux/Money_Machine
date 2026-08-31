#!/usr/bin/env node

import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { chromium } from 'playwright';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const htmlPath = resolve(arg('--html', 'art-toolbox.html'));
const outDir = resolve(arg('--out', 'art-review/motion'));
if (!existsSync(htmlPath)) {
  console.error(`missing ${htmlPath}. Build a playtest artifact first.`);
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
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const address = server.address();
if (!address || typeof address === 'string') throw new Error('could not start motion-review server');
const url = `http://127.0.0.1:${address.port}/`;

const browser = await chromium.launch({ args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  timezoneId: 'America/Chicago',
  recordVideo: { dir: outDir, size: { width: 390, height: 844 } },
});
const page = await ctx.newPage();
const settle = (ms = 700) => page.waitForTimeout(ms);

async function onboard() {
  for (let i = 0; i < 10; i += 1) {
    const input = page.locator('input:visible').first();
    if (await input.count()) {
      const ph = (await input.getAttribute('placeholder')) || '';
      if (/name|call/i.test(ph)) await input.fill('Motion Review');
    }
    const next = page.getByRole('button').filter({ hasText: /^(hi|tell him|next|okay|skip)$/i }).first();
    if ((await next.count()) && (await next.isEnabled())) {
      await next.click();
      await settle(400);
    } else break;
  }
  await page.waitForSelector('[data-testid="dialogue-panel"]', { timeout: 20_000 });
}

async function loadRichPreset() {
  const settings = page.getByLabel('Settings').first();
  await settings.click();
  await settle(300);
  const playtest = page.locator('[data-testid="playtest-settings"]').first();
  if (!(await playtest.count())) throw new Error('Playtest saves missing in Settings');
  await playtest.click();
  await settle(400);
  const slot = page.locator('[data-testid="playtest-rich"]').first();
  if (!(await slot.count())) throw new Error('Rich Barkly playtest slot missing');
  await slot.click();
  await page.waitForSelector('[data-testid="dialogue-panel"]', { timeout: 25_000 });
  await settle(1000);
}

async function go(name) {
  const tab = page.getByRole('tab').filter({ hasText: new RegExp(`^${name}$`, 'i') }).first();
  if (!(await tab.count())) throw new Error(`${name} tab missing`);
  await tab.click();
  await settle(2200);
}

try {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await settle(900);
  await onboard();
  await loadRichPreset();
  await go('Home');
  await settle(2200); // ambient idle sample
  await go('Park');
  await settle(1800);
  await go('Town');
  await settle(1800);
  await go('Home');
  await settle(2200);
} finally {
  await ctx.close();
  await browser.close();
  await new Promise((done) => server.close(done));
}
console.log(`motion review recorded to ${outDir}`);
