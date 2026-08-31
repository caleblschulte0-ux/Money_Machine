#!/usr/bin/env node

import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { chromium } from 'playwright';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const htmlPath = resolve(arg('--html', 'art-toolbox.html'));
const outDir = resolve(arg('--out', 'art-review'));
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
if (!address || typeof address === 'string') throw new Error('could not start art matrix server');
const url = `http://127.0.0.1:${address.port}/`;

const sizes = [
  { width: 360, height: 640, label: 'short-phone' },
  { width: 390, height: 844, label: 'iphone-portrait' },
  { width: 430, height: 932, label: 'large-phone' },
  { width: 667, height: 375, label: 'phone-landscape' },
  { width: 768, height: 1024, label: 'tablet-portrait' },
  { width: 1024, height: 768, label: 'tablet-landscape' },
];
const captures = [];
const settle = (page, ms = 800) => page.waitForTimeout(ms);

async function onboard(page) {
  for (let i = 0; i < 10; i += 1) {
    const input = page.locator('input:visible').first();
    if (await input.count()) {
      const ph = (await input.getAttribute('placeholder')) || '';
      if (/name|call/i.test(ph)) await input.fill('Art Review');
    }
    const next = page.getByRole('button').filter({ hasText: /^(hi|tell him|next|okay|skip)$/i }).first();
    if ((await next.count()) && (await next.isEnabled())) {
      await next.click();
      await settle(page, 450);
    } else break;
  }
  await page.waitForSelector('[data-testid="dialogue-panel"]', { timeout: 20_000 });
}

async function loadRichPreset(page) {
  const settings = page.getByLabel('Settings').first();
  if (!(await settings.count())) throw new Error('Settings missing while opening playtest saves');
  await settings.click();
  await settle(page, 350);
  const playtest = page.locator('[data-testid="playtest-settings"]').first();
  if (!(await playtest.count())) throw new Error('Playtest saves missing in Settings');
  await playtest.click();
  await settle(page, 450);
  const slot = page.locator('[data-testid="playtest-rich"]').first();
  if (!(await slot.count())) throw new Error('Rich Barkly playtest slot missing');
  await slot.click();
  await page.waitForSelector('[data-testid="dialogue-panel"]', { timeout: 25_000 });
  await settle(page, 900);
}

async function location(page, name) {
  const tab = page.getByRole('tab').filter({ hasText: new RegExp(`^${name}$`, 'i') }).first();
  if (!(await tab.count())) throw new Error(`${name} tab missing`);
  await tab.click();
  await settle(page, 1200);
}

async function shot(page, name, size, note) {
  await page.setViewportSize({ width: size.width, height: size.height });
  await settle(page, 650);
  const file = `${name.toLowerCase()}-${size.width}x${size.height}-${size.label}.png`;
  await page.screenshot({ path: resolve(outDir, file), fullPage: false, animations: 'allow' });
  captures.push({ file, title: `${name} · ${size.width}×${size.height}`, note });
  console.log(`captured ${file}`);
}

const browser = await chromium.launch({ args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Chicago' });
const page = await ctx.newPage();

try {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await settle(page, 1000);
  await onboard(page);
  await loadRichPreset(page);

  await location(page, 'Home');
  for (const size of sizes) {
    await shot(page, 'Home', size, 'Hero composition / HUD / care dock / conversation surface');
  }

  const canonical = sizes.find((x) => x.width === 390 && x.height === 844);
  if (!canonical) throw new Error('canonical phone size missing');
  for (const name of ['Park', 'Town', 'Beach']) {
    await page.setViewportSize({ width: canonical.width, height: canonical.height });
    await location(page, name);
    await shot(page, name, canonical, 'World depth / lighting / prop hierarchy');
  }

  const cards = captures.map(({ file, title, note }) => `
    <article>
      <a href="${file}"><img src="${file}" alt="${title}"></a>
      <h2>${title}</h2><p>${note}</p>
    </article>`).join('\n');
  const review = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Barkly art matrix</title><style>
    *{box-sizing:border-box}body{margin:0;padding:24px;background:#17120f;color:#fff7e8;font-family:system-ui,sans-serif}h1{margin:0 0 8px}header p{margin:0 0 24px;color:#cdbda8}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:22px}article{background:#2a211b;border:1px solid #49392e;border-radius:18px;padding:12px}img{display:block;width:100%;height:auto;border-radius:12px;background:#000}h2{font-size:16px;margin:10px 2px 4px}article p{font-size:13px;margin:0 2px 4px;color:#cdbda8}
  </style></head><body><header><h1>Barkly art review matrix</h1><p>Judge hierarchy, depth, material consistency, spacing, and premium game feel from the real rendered app—not JSX.</p></header><main class="grid">${cards}</main></body></html>`;
  await writeFile(resolve(outDir, 'index.html'), review);
  await writeFile(resolve(outDir, 'matrix.json'), JSON.stringify(captures, null, 2));
  console.log(`art matrix written to ${outDir}`);
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
