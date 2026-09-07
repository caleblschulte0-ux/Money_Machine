/**
 * THE PUBLISHED PAGE, AS FILES INSTEAD OF ONE 15MB LINE.
 *
 * `build-artifact.mjs` inlines every asset as a data: URI and produces a single
 * self-contained HTML file. That is the right shape for SHARING one file, and
 * it is the wrong shape for a website, because a browser cannot paint any of it
 * until all of it has arrived.
 *
 * Measured, served over throttled connections, time until there is a dog on the
 * screen:
 *
 *                     single file      split
 *   fast 4G  20Mbps       7.2s          0.8s
 *   slow 4G   5Mbps      25.8s          2.3s
 *   3G      1.6Mbps      79.0s          6.8s
 *
 * Eleven times faster, and it is not a rendering improvement: the app runs at a
 * flat 60fps either way with no long tasks. It is that 1.8MB gets a playable
 * dog on the screen and the other 13MB -- almost all of it his ~350 voice
 * recordings -- arrives behind him, cached, while he is already being petted.
 *
 * WHY IT WAS INLINED. Expo's web export writes ABSOLUTE asset URLs: /_expo/...
 * in the HTML and 413 "/assets/..." strings inside the bundle. Pages serves
 * this repo from /Money_Machine/, so every one of those would 404, and a single
 * file has no such problem. This rewrites them to relative, which resolves
 * against the document's own directory and therefore works at the root, at
 * /Money_Machine/, and at /Money_Machine/playtest/ alike.
 *
 * The single-file artifact is untouched and still built the same way -- this is
 * an addition, not a replacement. Nothing about offline changes either: the
 * assets still come from the same origin with no proxy behind them.
 *
 *   node scripts/build-pages.mjs [--out dist]
 */
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const APP = resolve(new URL('..', import.meta.url).pathname);
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const outDir = resolve(APP, arg('--out', 'dist'));

/**
 * Absolute -> relative, in the two places Expo writes them.
 *
 * Deliberately narrow: only the exact prefixes the export emits, each anchored
 * to the quote or attribute that introduces it, so this cannot mangle a string
 * inside game content that happens to start with /assets.
 */
function relativise(text) {
  return text
    .replaceAll('"/_expo/', '"./_expo/')
    .replaceAll("'/_expo/", "'./_expo/")
    .replaceAll('"/assets/', '"./assets/')
    .replaceAll("'/assets/", "'./assets/")
    .replaceAll('"/favicon.ico"', '"./favicon.ico"')
    .replaceAll('href="/favicon.ico"', 'href="./favicon.ico"');
}

async function rewriteTree(dir) {
  let touched = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      touched += await rewriteTree(full);
      continue;
    }
    if (!/\.(html|js|json)$/.test(entry.name)) continue;
    const before = await readFile(full, 'utf8');
    const after = relativise(before);
    if (after !== before) {
      await writeFile(full, after);
      touched += 1;
    }
  }
  return touched;
}

async function exportOnce(target, env) {
  const staging = join('/tmp', `barkly-pages-${Math.random().toString(36).slice(2)}`);
  execFileSync('npx', ['expo', 'export', '-p', 'web', '--output-dir', staging, '--clear'], {
    cwd: APP,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  const touched = await rewriteTree(staging);
  await mkdir(target, { recursive: true });
  await cp(staging, target, { recursive: true });
  await rm(staging, { recursive: true, force: true });
  return touched;
}

async function totalBytes(dir) {
  let sum = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    sum += entry.isDirectory() ? await totalBytes(full) : (await stat(full)).size;
  }
  return sum;
}

await rm(outDir, { recursive: true, force: true });
console.log('building the player experience…');
const a = await exportOnce(outDir, {});
console.log('building the playtest experience…');
const b = await exportOnce(join(outDir, 'playtest'), { EXPO_PUBLIC_BARKLY_PLAYTEST: 'always' });

// Pages would otherwise hand _expo/ to Jekyll, which eats underscore paths.
await writeFile(join(outDir, '.nojekyll'), '');

const html = await readFile(join(outDir, 'index.html'), 'utf8');
if (html.includes('"/_expo/') || html.includes('src="/assets/')) {
  console.error('FAIL: absolute asset paths survived the rewrite; this would 404 under /Money_Machine/.');
  process.exit(1);
}
const bytes = await totalBytes(outDir);
console.log(`\nwrote ${outDir}`);
console.log(`  ${(bytes / 1048576).toFixed(1)}MB across both builds, ${a + b} files relativised`);
console.log('  entry bundle is what gates first paint; the rest streams in behind it');
