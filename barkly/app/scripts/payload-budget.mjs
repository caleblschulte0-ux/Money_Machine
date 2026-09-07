/**
 * WHAT IT COSTS TO SEE THE DOG, GUARDED.
 *
 * Adapted from ChatGPT's asset-audit.mjs on its unmerged art toolbox branch,
 * which walks the asset tree and reports dimensions, weight and suspicious
 * names. That part is kept nearly as written. What is added is the part that
 * would have caught the actual defect: AN AGGREGATE BUDGET.
 *
 * The published page used to inline every asset into one 15.68MB HTML file, so
 * a phone showed nothing for 26 seconds on a normal connection. The original
 * audit passed that build without complaint, because it warns per FILE at 1MB
 * and the payload was 66 innocent files. No individual asset was ever the
 * problem. The sum was.
 *
 * Two budgets, because they fail differently:
 *
 *   FIRST PAINT   index.html + the JS bundle. Nothing appears until this
 *                 arrives, so it is the number that decides whether someone
 *                 opening the link waits or plays. Roughly 1.2MB today.
 *   TOTAL         everything one build ships. Streams in behind the dog and
 *                 caches, so it is a slow-creep guard rather than a wall --
 *                 5.1MB of it is his ~350 voice recordings, which is a fair
 *                 price for him having a voice.
 *
 * Budgets are set with real headroom over today's numbers. A gate tuned to the
 * current byte count fails on the next honest asset and gets raised until it
 * means nothing.
 *
 *   node scripts/payload-budget.mjs [dist]
 */
import { readdir, stat, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const root = resolve(process.argv[2] || 'dist');
if (!existsSync(root)) {
  console.error(`missing ${root} -- run \`npm run build:pages\` first`);
  process.exit(2);
}

const FIRST_PAINT_BUDGET = 2.5 * 1024 * 1024;
const TOTAL_BUDGET = 16 * 1024 * 1024;
/** ChatGPT's per-file thresholds, unchanged: clear production mistakes only. */
const FILE_WARN = 1_000_000;
const FILE_FAIL = 2_500_000;
const DIM_WARN = 2048;
const DIM_FAIL = 4096;

function pngInfo(buf) {
  if (buf.length < 26 || buf.toString('ascii', 1, 4) !== 'PNG') return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else out.push(full);
  }
  return out;
}

// One build only. dist/ holds the player site AND dist/playtest/, a second copy
// of everything; summing both would double every number and mean nothing.
const all = await walk(root);
const build = all.filter((f) => !relative(root, f).startsWith('playtest'));

let firstPaint = 0;
let total = 0;
const problems = [];

for (const file of build) {
  const rel = relative(root, file);
  const { size } = await stat(file);
  total += size;
  if (rel === 'index.html' || rel.startsWith('_expo')) firstPaint += size;

  if (/\s/.test(rel)) problems.push(`space in name: ${rel}`);
  if (size > FILE_FAIL) problems.push(`FAIL ${rel} is ${(size / 1048576).toFixed(1)}MB (>2.5MB)`);
  else if (size > FILE_WARN) console.log(`  warn: ${rel} is ${(size / 1048576).toFixed(1)}MB`);

  if (extname(file).toLowerCase() === '.png') {
    const meta = pngInfo(await readFile(file));
    if (meta) {
      const big = Math.max(meta.width, meta.height);
      if (big > DIM_FAIL) problems.push(`FAIL ${rel} is ${meta.width}x${meta.height} (>4096px)`);
      else if (big > DIM_WARN) console.log(`  warn: ${rel} is ${meta.width}x${meta.height}`);
    }
  }
}

const mb = (n) => `${(n / 1048576).toFixed(2)}MB`;
console.log(`\n  first paint  ${mb(firstPaint)}  (budget ${mb(FIRST_PAINT_BUDGET)})`);
console.log(`  total        ${mb(total)}  (budget ${mb(TOTAL_BUDGET)})`);

if (firstPaint > FIRST_PAINT_BUDGET) {
  problems.push(`FAIL first paint is ${mb(firstPaint)}, over the ${mb(FIRST_PAINT_BUDGET)} budget.\n` +
    '      Nothing renders until this arrives. Something is being imported eagerly that should not be.');
}
if (total > TOTAL_BUDGET) {
  problems.push(`FAIL total payload is ${mb(total)}, over the ${mb(TOTAL_BUDGET)} budget.`);
}

if (problems.length) {
  console.error('\n' + problems.map((p) => `  ${p}`).join('\n'));
  console.error('\nFAIL — the payload budget is the difference between opening the game and closing the tab.');
  process.exit(1);
}
console.log('\nPASS — the dog arrives before the rest of the world does.');
