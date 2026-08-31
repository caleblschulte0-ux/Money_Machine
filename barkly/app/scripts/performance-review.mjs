#!/usr/bin/env node
/** Free, headless frame-pacing report for the actual Barkly build. */
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const html = resolve(arg('--html', 'art-toolbox.html'));
const outDir = resolve(arg('--out', 'art-review/performance'));
if (!existsSync(html)) throw new Error(`missing ${html}`);
await mkdir(outDir, { recursive: true });

async function enterApp(page) {
  await page.goto('file://' + html);
  await page.waitForTimeout(1800);
  for (let i = 0; i < 8; i += 1) {
    const input = page.locator('input:visible').first();
    if (await input.count()) {
      const ph = (await input.getAttribute('placeholder')) || '';
      if (/name|call/i.test(ph)) await input.fill('Perf Review');
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

async function sample(page, label, ms = 5000) {
  const data = await page.evaluate(async ({ label, ms }) => {
    const gaps = [];
    const longTasks = [];
    let observer;
    try {
      observer = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) longTasks.push({ duration: e.duration, start: e.startTime });
      });
      observer.observe({ entryTypes: ['longtask'] });
    } catch {}
    const started = performance.now();
    let previous = started;
    await new Promise((done) => {
      const tick = (now) => {
        gaps.push(now - previous);
        previous = now;
        if (now - started >= ms) done();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    observer?.disconnect();
    gaps.shift();
    gaps.sort((a, b) => a - b);
    const avgGap = gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length);
    const pct = (p) => gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * p))] || 0;
    return {
      label,
      frames: gaps.length,
      sampleMs: performance.now() - started,
      averageFps: Number((1000 / avgGap).toFixed(1)),
      p95FrameGapMs: Number(pct(0.95).toFixed(2)),
      p99FrameGapMs: Number(pct(0.99).toFixed(2)),
      framesOver32ms: gaps.filter((g) => g > 32).length,
      framesOver50ms: gaps.filter((g) => g > 50).length,
      longTaskCount: longTasks.length,
      maxLongTaskMs: Number(Math.max(0, ...longTasks.map((x) => x.duration)).toFixed(2)),
      jsHeapBytes: performance.memory?.usedJSHeapSize ?? null,
    };
  }, { label, ms });
  return data;
}

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const results = [];
for (const viewport of [{ name: 'phone', width: 390, height: 844 }, { name: 'tablet', width: 768, height: 1024 }]) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await enterApp(page);
  results.push({ viewport, ...(await sample(page, `${viewport.name}-home`)) });
  const park = page.getByRole('tab', { name: 'Park', exact: true }).first();
  if (await park.count()) {
    await park.click();
    await page.waitForTimeout(1200);
    results.push({ viewport, ...(await sample(page, `${viewport.name}-park`)) });
  }
  await ctx.close();
}
await browser.close();

const report = { generatedAt: new Date().toISOString(), note: 'Headless CI is a regression signal, not a physical-device FPS benchmark.', results };
await writeFile(resolve(outDir, 'performance.json'), JSON.stringify(report, null, 2) + '\n');
const lines = ['Barkly frame-pacing review', 'CI numbers are trend signals, not device guarantees.', ''];
for (const r of results) lines.push(`${r.label}: ${r.averageFps} avg fps · p95 ${r.p95FrameGapMs}ms · >32ms ${r.framesOver32ms} · long tasks ${r.longTaskCount}`);
await writeFile(resolve(outDir, 'performance.txt'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
