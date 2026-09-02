#!/usr/bin/env node
/**
 * Build the single-file web artifact.
 *
 * `expo export -p web` produces a directory: an index.html, a JS bundle, and a
 * tree of hashed image assets. That is fine for a static host and useless for
 * a published artifact page, which has to be ONE self-contained file with no
 * outbound requests.
 *
 * So this walks the export, turns every image into a data: URI, rewrites the
 * bundle's references to point at them, and inlines the bundle into the HTML.
 *
 * This used to be done by hand in a scratch directory every round, which is
 * exactly the thing that quietly stops matching the code. Now it is a script
 * with a checked-in home:
 *
 *     node scripts/build-artifact.mjs [--out barkly.html]
 *
 * HONEST LIMIT, and it is worth restating every time: the artifact runs the
 * SCRIPTED brain. A published page cannot reach the proxy on your laptop, so
 * the Claude CLI brain is not in it, and neither is live synthesis.
 *
 * His VOICE is half in it. Every line he says from a fixed pool — greetings,
 * feed and play reactions, idle thoughts, mishaps, level-ups — is a real
 * recording of the real voice, bundled here as audio data. Anything he
 * composes out of your own words is not, and falls back to the browser's
 * narrator. So the demo is deliberately mixed, and it is worth saying which
 * half somebody is hearing rather than letting them wonder.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  // His voice. ~150 short recordings of his fixed lines, which is the only way
  // a published artifact can sound like him at all — there is no proxy for a
  // web page to reach. See scripts/voice-bank.mjs.
  '.mp3': 'audio/mpeg',
};

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const outPath = resolve(arg('--out', join(APP, 'barkly-artifact.html')));
const keep = process.argv.includes('--keep');
const exportDir = mkdtempSync(join(tmpdir(), 'barkly-export-'));

try {
  console.log('exporting web bundle…');
  execFileSync('npx', ['expo', 'export', '-p', 'web', '--output-dir', exportDir, '--clear'], {
    cwd: APP,
    stdio: 'inherit',
    env: { ...process.env, EXPO_NO_TELEMETRY: '1' },
  });

  const indexPath = join(exportDir, 'index.html');
  if (!existsSync(indexPath)) throw new Error(`no index.html in ${exportDir}`);
  let html = readFileSync(indexPath, 'utf8');

  // Every asset, keyed by the absolute URL path the bundle uses.
  const assets = new Map();
  const assetRoot = join(exportDir, 'assets');
  if (existsSync(assetRoot)) {
    for (const file of walk(assetRoot)) {
      const ext = extname(file).toLowerCase();
      const mime = MIME[ext];
      if (!mime) continue;
      const url = '/' + relative(exportDir, file).split('\\').join('/');
      assets.set(url, `data:${mime};base64,${readFileSync(file).toString('base64')}`);
    }
  }
  console.log(`inlining ${assets.size} asset${assets.size === 1 ? '' : 's'}…`);

  // The bundle. Expo emits one entry script plus optional chunks; take them in
  // the order the HTML lists them so evaluation order is preserved.
  const scriptSrcs = [...html.matchAll(/<script[^>]+src="([^"]+)"[^>]*>\s*<\/script>/g)];
  if (scriptSrcs.length === 0) throw new Error('no <script src> in the exported index.html');

  let inlined = 0;
  for (const [tag, src] of scriptSrcs) {
    const file = join(exportDir, src.replace(/^\//, ''));
    if (!existsSync(file)) throw new Error(`bundle referenced but missing: ${src}`);
    let code = readFileSync(file, 'utf8');
    for (const [url, data] of assets) code = code.split(JSON.stringify(url).slice(1, -1)).join(data);
    // A closing tag inside a string would end the script element early.
    code = code.split('</script>').join('<\\/script>');
    // A FUNCTION replacement, deliberately: String.replace treats `$&`, `$'`
    // and friends as substitution patterns, and a minified bundle is full of
    // them. Passing the code as a string silently corrupts it into a parse
    // error that only shows up as a blank page.
    html = html.replace(tag, () => `<script>\n${code}\n</script>`);
    inlined++;
  }

  // Any remaining direct references (favicon, <link>, inline styles).
  for (const [url, data] of assets) html = html.split(url).join(data);
  html = html.replace(/<link[^>]+rel="(icon|shortcut icon)"[^>]*>/g, '');

  /*
   * MAKE IT OPEN LIKE AN APP.
   *
   * Added on real-device evidence: on an iPhone this ran as a Safari tab, so
   * the browser's bottom URL bar ate roughly 90px of the height the layout
   * had already committed to, and the whole composition was squeezed. These
   * tags let "Add to Home Screen" launch it standalone -- no address bar, no
   * toolbar, full height.
   *
   * `viewport-fit=cover` is the load-bearing one. Without it the CSS
   * env(safe-area-inset-*) values are ZERO, which means useSafeAreaInsets --
   * which drives groundY, the chrome padding and the bottom gap -- has been
   * getting nothing to work with, and the layout was reserving space for a
   * notch it could not measure.
   */
  const APP_HEAD = [
    '<meta name="mobile-web-app-capable" content="yes" />',
    '<meta name="apple-mobile-web-app-capable" content="yes" />',
    /*
     * NOT black-translucent. That runs the app UNDER the iOS status bar and
     * relies on safe-area insets to push the chrome clear -- and on web those
     * insets come back ZERO, so contentTop falls through to its 12px default
     * and the clock, signal and battery print straight on top of the coin
     * pill and the Pack button. Confirmed on device.
     *
     * `default` makes iOS reserve the status bar itself and start the web view
     * below it, which needs no env() support to be correct.
     */
    '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
    '<meta name="apple-mobile-web-app-title" content="Barkly" />',
    '<meta name="theme-color" content="#F6D96B" />',
  ].join('\n    ');
  html = html.replace(
    /<meta name="viewport"[^>]*>/,
    `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, shrink-to-fit=no" />\n    ${APP_HEAD}`,
  );

  // --out may name a directory that does not exist yet: the Pages deploy writes
  // dist/index.html and dist/playtest/index.html, and only one of those has a
  // parent already.
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, html);
  const kb = Math.round(Buffer.byteLength(html) / 1024);
  console.log(`wrote ${outPath} (${kb} KB, ${inlined} script${inlined === 1 ? '' : 's'} inlined)`);
  if (kb > 16 * 1024) console.warn('WARNING: over the 16MB artifact limit.');

  // A self-contained page must not reach out. Catch it here rather than
  // discovering it as a blank page behind a CSP.
  const outbound = html.match(/(src|href)="https?:\/\/(?!fonts\.(googleapis|gstatic)\.com)[^"]+"/g);
  if (outbound) {
    console.warn(`WARNING: ${outbound.length} outbound reference(s) survived:`);
    for (const hit of outbound.slice(0, 5)) console.warn('  ' + hit);
  }
} finally {
  if (!keep) rmSync(exportDir, { recursive: true, force: true });
  else console.log(`export kept at ${exportDir}`);
}
