/**
 * REFUSE TO TEST A STALE ARTIFACT.
 *
 * Every harness here SERVES a pre-built file; none of them builds one. So a run
 * straight after an edit tests the LAST build and passes, and a pass is exactly
 * what you were hoping for — which is why this bites silently.
 *
 * It bit twice in one session. `art-lab.mjs` grew this check first, and the
 * lesson was not carried across: `overlap-check`, `a11y-check` and
 * `voice-check` all default to `barkly-artifact.html`, which `npm run
 * build:pages` does NOT write. A main-screen HUD rewrite was reported as
 * passing 13 viewports and the full a11y sweep while both harnesses were
 * looking at a build made before the rewrite existed.
 *
 * So the guard lives in ONE place now and every harness calls it.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

function newestUnder(dir) {
  let newest = 0;
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const full = join(d, e.name);
      if (e.isDirectory()) walk(full);
      else newest = Math.max(newest, statSync(full).mtimeMs);
    }
  };
  if (existsSync(dir)) walk(dir);
  return newest;
}

/**
 * @param {string} htmlPath the artifact about to be served
 * @param {string} buildHint the command that rebuilds THIS artifact
 * @param {string[]} argv process.argv, so `--stale-ok` can override
 */
export function assertFreshArtifact(htmlPath, buildHint, argv = process.argv) {
  if (!existsSync(htmlPath)) {
    console.error(`no such artifact: ${htmlPath}`);
    console.error(`Build it:  ${buildHint}`);
    process.exit(2);
  }
  const builtAt = statSync(htmlPath).mtimeMs;
  const sourceAt = Math.max(newestUnder(resolve('src')), newestUnder(resolve('assets')));
  if (sourceAt <= builtAt) return;
  const mins = ((sourceAt - builtAt) / 60000).toFixed(1);
  if (argv.includes('--stale-ok')) {
    console.warn(`--stale-ok: testing a build ${mins} min older than the sources.`);
    return;
  }
  console.error(`${basename(htmlPath)} is ${mins} min older than the newest file in src/ or assets/.`);
  console.error(`This harness SERVES that file, it does not build it, so it would pass on old code.`);
  console.error(`Build it:  ${buildHint}`);
  console.error('Or pass --stale-ok to test this build on purpose.');
  process.exit(2);
}
