#!/usr/bin/env node
/** Draw a review-only geometry overlay on the real app without changing app code. */
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const html = resolve(arg('--html', 'art-toolbox.html'));
const outDir = resolve(arg('--out', 'art-review/layout-debug'));
if (!existsSync(html)) throw new Error(`missing ${html}`);
await mkdir(outDir, { recursive: true });

const TARGETS = [
  ['Barkly', '[data-testid="barkly-sprite"]', '#ff4b4b'],
  ['Food', '[data-testid="kit-feed"]', '#ffcc33'],
  ['Play', '[data-testid="kit-play"]', '#ffcc33'],
  ['Sleep', '[data-testid="kit-sleep"]', '#ffcc33'],
  ['Dialogue', '[data-testid="dialogue-panel"]', '#4cd8ff'],
  ['Settings', '[aria-label="Settings"]', '#7dff87'],
  ['Park tab', '[aria-label="Park"]', '#7dff87'],
];

async function enterApp(page) {
  await page.goto('file://' + html);
  await page.waitForTimeout(1600);
  for (let i = 0; i < 8; i += 1) {
    const input = page.locator('input:visible').first();
    if (await input.count()) {
      const ph = (await input.getAttribute('placeholder')) || '';
      if (/name|call/i.test(ph)) await input.fill('Layout Review');
    }
    const next = page.getByRole('button').filter({ hasText: /^(hi|tell him|next|okay|skip)$/i }).first();
    if ((await next.count()) && (await next.isEnabled())) {
      await next.click();
      await page.waitForTimeout(500);
    } else break;
  }
  await page.waitForSelector('[data-testid="barkly-sprite"]', { timeout: 20_000 });
  await page.waitForTimeout(900);
}

const browser = await chromium.launch({ args: ['--no-sandbox'] });
for (const viewport of [
  { name: 'phone-390x844', width: 390, height: 844 },
  { name: 'short-phone-360x640', width: 360, height: 640 },
  { name: 'phone-landscape-667x375', width: 667, height: 375 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
]) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await enterApp(page);

  const boxes = [];
  for (const [name, selector, color] of TARGETS) {
    const el = page.locator(selector).first();
    if (!(await el.count())) continue;
    const box = await el.boundingBox();
    if (box) boxes.push({ name, color, ...box });
  }

  await page.evaluate((payload) => {
    const root = document.createElement('div');
    root.setAttribute('data-art-debug-overlay', 'true');
    root.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;font:10px system-ui,sans-serif';
    for (const b of payload.boxes) {
      const el = document.createElement('div');
      el.style.cssText = `position:absolute;left:${b.x}px;top:${b.y}px;width:${b.width}px;height:${b.height}px;border:2px solid ${b.color};background:${b.color}12;box-sizing:border-box`;
      const tag = document.createElement('span');
      tag.textContent = `${b.name} ${Math.round(b.width)}×${Math.round(b.height)}`;
      tag.style.cssText = `position:absolute;left:0;top:0;background:${b.color};color:#15110e;padding:2px 4px;font-weight:800;white-space:nowrap`;
      el.appendChild(tag);
      root.appendChild(el);
    }
    const topSafe = document.createElement('div');
    topSafe.style.cssText = `position:absolute;left:0;right:0;top:0;height:${Math.round(payload.height * 0.30)}px;border-bottom:1px dashed #ff64d7;background:#ff64d708`;
    const safeTag = document.createElement('span');
    safeTag.textContent = 'upper-stage clear-line reference';
    safeTag.style.cssText = 'position:absolute;right:4px;bottom:2px;color:#ff64d7;background:#1b1511cc;padding:2px 4px';
    topSafe.appendChild(safeTag);
    root.appendChild(topSafe);
    document.body.appendChild(root);
  }, { boxes, height: viewport.height });

  await page.screenshot({ path: resolve(outDir, `${viewport.name}.png`), fullPage: false });
  await ctx.close();
}
await browser.close();
console.log(`layout debug screenshots written to ${outDir}`);
