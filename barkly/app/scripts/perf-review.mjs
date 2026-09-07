/**
 * WHAT IT COSTS TO OPEN BARKLY, AND WHAT IT COSTS TO WATCH HIM.
 *
 * The frame-pacing core of this is ChatGPT's, from the unmerged art toolbox
 * branch (chatgpt/barkly-art-toolbox-20260831, scripts/performance-review.mjs).
 * It was the one tool over there with no equivalent on this line, and its own
 * framing is the right one and is kept: headless numbers are a REGRESSION
 * SIGNAL, not a device benchmark. Nobody's phone is this machine.
 *
 * Three changes on adoption:
 *
 * 1. LOAD IS MEASURED, and it is the reason this exists. The original reported
 *    frames only, and the app's largest performance problem by far is not
 *    frames -- it is that the published page inlines every asset into a single
 *    HTML file, so there is nothing on screen until all of it has arrived. A
 *    frame-pacing report on a page that takes ten seconds to appear is
 *    measuring the wrong end of the experience.
 * 2. It loads the developed playtest save, the same way scene-shot.mjs does,
 *    instead of walking onboarding by matching button text with a regex. A
 *    locked Park tab is still rendered, so the original could sample "park"
 *    while showing Home -- the same trap that has caught this repo three times.
 * 3. Explicit browser path, because this environment pins Chromium.
 *
 *   node scripts/perf-review.mjs                  # dist/index.html, the real page
 *   node scripts/perf-review.mjs --html X --out Y
 *   node scripts/perf-review.mjs --site dist      # a split build, over 4G and 3G
 */
import { createServer } from 'node:http';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const html = resolve(arg('--html', 'dist/index.html'));
const outDir = resolve(arg('--out', 'art-review/performance'));
if (!existsSync(html)) {
  console.error(`missing ${html} -- run \`npm run build:pages\` first`);
  process.exit(2);
}
await mkdir(outDir, { recursive: true });

/** Cold load: how long until there is a dog on the screen. */
async function measureLoad(browser, viewport) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem('barkly/profile/default/onboarding-v1', 'done'));
  const started = Date.now();
  await page.goto(`file://${html}`);
  const domReady = Date.now() - started;
  let sprite = null;
  try {
    await page.waitForSelector('[data-testid="barkly-sprite"]', { timeout: 60_000 });
    sprite = Date.now() - started;
  } catch { /* reported as null */ }
  const paint = await page.evaluate(() =>
    performance.getEntriesByType('paint').reduce((acc, e) => ({ ...acc, [e.name]: Math.round(e.startTime) }), {}));
  await ctx.close();
  return { domReadyMs: domReady, spriteVisibleMs: sprite, ...paint };
}

async function loadDevelopedSave(page) {
  try {
    const gear = page.getByLabel('Settings').first();
    if (!(await gear.count())) return;
    await gear.click({ timeout: 6000 });
    await page.waitForTimeout(520);
    const entry = page.locator('[data-testid="playtest-settings"]').first();
    if (!(await entry.count())) return;
    await entry.click({ timeout: 6000 });
    await page.waitForTimeout(650);
    const slot = page.locator('[data-testid="playtest-longterm"]').first();
    if (!(await slot.count())) return;
    await slot.click({ force: true, timeout: 6000 });
    await page.waitForSelector('[data-testid="dialogue-panel"]', { timeout: 20_000 }).catch(() => {});
  } catch { /* verified by the caller */ }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(900);
}

/** ChatGPT's sampler, unchanged in substance: rAF gaps plus long tasks. */
async function sample(page, label, ms = 5000) {
  return page.evaluate(async ({ label, ms }) => {
    const gaps = [];
    const longTasks = [];
    let observer;
    try {
      observer = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) longTasks.push(e.duration);
      });
      observer.observe({ entryTypes: ['longtask'] });
    } catch { /* not every build reports long tasks */ }
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
    const avg = gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length);
    const pct = (p) => gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * p))] || 0;
    return {
      label,
      frames: gaps.length,
      averageFps: Number((1000 / avg).toFixed(1)),
      p95FrameGapMs: Number(pct(0.95).toFixed(2)),
      framesOver32ms: gaps.filter((g) => g > 32).length,
      framesOver50ms: gaps.filter((g) => g > 50).length,
      longTaskCount: longTasks.length,
      maxLongTaskMs: Number(Math.max(0, ...longTasks).toFixed(2)),
    };
  }, { label, ms });
}

/*
 * THE MEASUREMENT THAT ACTUALLY FOUND THE PROBLEM.
 *
 * A file:// load reports a 15MB page as taking 714ms, because there is no
 * transfer. That is why nothing here ever caught it. Served over an emulated
 * connection, the same page is 7.2s on fast 4G and 79s on 3G with a blank
 * screen throughout. Any performance tool for a thing people open on a phone
 * has to model the network or it is measuring the wrong machine.
 */
const PROFILES = [
  ['fast 4G (20Mbps)', (20 * 1024 * 1024) / 8, 40],
  ['slow 4G  (5Mbps)', (5 * 1024 * 1024) / 8, 100],
  ['3G     (1.6Mbps)', (1.6 * 1024 * 1024) / 8, 300],
];
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.png': 'image/png', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ico': 'image/x-icon', '.json': 'application/json', '.ttf': 'font/ttf' };

/** Serve `root` under the path Pages actually uses, so subpath bugs surface. */
async function serve(root, prefix) {
  let bytes = 0;
  const server = createServer(async (req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    if (!url.startsWith(prefix)) { res.writeHead(404); return res.end(''); }
    const target = join(root, normalize(url.slice(prefix.length)));
    try {
      const info = await stat(target);
      const file = info.isDirectory() ? join(target, 'index.html') : target;
      const body = await readFile(file);
      bytes += body.length;
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404); res.end(''); }
  });
  await new Promise((r) => server.listen(0, r));
  return { server, port: server.address().port, reset: () => { bytes = 0; }, transferred: () => bytes };
}

async function overNetwork(browser, root, prefix) {
  const host = await serve(root, prefix);
  const rows = [];
  for (const [name, bps, latency] of PROFILES) {
    host.reset();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.addInitScript(() => localStorage.setItem('barkly/profile/default/onboarding-v1', 'done'));
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, downloadThroughput: bps, uploadThroughput: bps, latency });
    const started = Date.now();
    await page.goto(`http://127.0.0.1:${host.port}${prefix}/`, { timeout: 240_000 }).catch(() => {});
    let dog = null;
    try { await page.waitForSelector('[data-testid="barkly-sprite"]', { timeout: 240_000 }); dog = Date.now() - started; } catch { /* never */ }
    rows.push({ profile: name, dogOnScreenMs: dog, transferredBytes: host.transferred() });
    await ctx.close();
  }
  host.server.close();
  return rows;
}

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const site = arg('--site', null);
/*
 * The SITE's weight, not the HTML file's.
 *
 * This reported "page: 0MB" the first time it ran against the split build --
 * it was measuring index.html, which is now 1KB of markup pointing at
 * everything else. A performance report claiming a game weighs nothing is
 * worse than no report, and it is the same mistake in a new place: measuring
 * the handle instead of the load.
 */
function dirBytes(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    total += entry.isDirectory() ? dirBytes(full) : statSync(full).size;
  }
  return total;
}
const pageDir = html.replace(/\/[^/]+$/, '');
const pageBytes = dirBytes(pageDir);
const load = await measureLoad(browser, { width: 390, height: 844 });

const results = [];
for (const viewport of [{ name: 'phone', width: 390, height: 844 }, { name: 'tablet', width: 768, height: 1024 }]) {
  const ctx = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem('barkly/profile/default/onboarding-v1', 'done'));
  await page.goto(`file://${html}`);
  await page.waitForSelector('[data-testid="barkly-sprite"]', { timeout: 60_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await loadDevelopedSave(page);
  results.push({ viewport: viewport.name, ...(await sample(page, `${viewport.name}-home`)) });
  const park = page.getByRole('tab', { name: /park/i }).first();
  if (await park.count()) {
    await park.click().catch(() => {});
    // The scene, not the tab: a locked tab still renders.
    const shown = await page.waitForSelector('[data-testid="world-scene-park"]', { timeout: 12_000 }).catch(() => null);
    if (shown) {
      await page.waitForTimeout(1200);
      results.push({ viewport: viewport.name, ...(await sample(page, `${viewport.name}-park`)) });
    }
  }
  await ctx.close();
}
const network = site ? await overNetwork(browser, resolve(site), '/Money_Machine') : [];
await browser.close();

const report = {
  generatedAt: new Date().toISOString(),
  note: 'Headless numbers are a regression signal, not a device benchmark.',
  page: { dir: pageDir, bytes: pageBytes, megabytes: Number((pageBytes / 1048576).toFixed(2)) },
  load,
  network,
  results,
};
await writeFile(resolve(outDir, 'performance.json'), JSON.stringify(report, null, 2) + '\n');

const lines = [
  'Barkly performance review',
  'Headless numbers are a regression signal, not a device benchmark.',
  '',
  `site: ${report.page.megabytes}MB served from ${pageDir.split('/').pop()}/`,
  `load: dom ${load.domReadyMs}ms · first paint ${load['first-contentful-paint'] ?? '?'}ms · dog on screen ${load.spriteVisibleMs ?? 'never'}ms`,
  '',
];
for (const r of results) {
  lines.push(`${r.label}: ${r.averageFps} avg fps · p95 gap ${r.p95FrameGapMs}ms · >32ms ${r.framesOver32ms} · long tasks ${r.longTaskCount}`);
}
if (network.length) {
  lines.push('', 'served at /Money_Machine/, dog on screen:');
  for (const n of network) {
    lines.push(`  ${n.profile}: ${n.dogOnScreenMs ? (n.dogOnScreenMs / 1000).toFixed(1) + 's' : 'never'} (${(n.transferredBytes / 1048576).toFixed(1)}MB by then)`);
  }
}
await writeFile(resolve(outDir, 'performance.txt'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
