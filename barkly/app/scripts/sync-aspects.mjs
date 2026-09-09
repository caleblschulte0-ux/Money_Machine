/**
 * RE-STATE EVERY ASPECT LOCK FROM THE PNG IT LOCKS.
 *
 * The app never types a prop's HEIGHT -- it types a width and divides by the
 * render's aspect, because a typed height cannot be checked against anything
 * and one of them was already wrong when that rule was written (the dig site
 * shipped 22% squashed). The aspects are therefore literals, and
 * `scene_surfaces.test.ts` / `item_renders.test.ts` hold each one against its
 * file.
 *
 * That was cheap while renders were stable. It is not any more: the geometry
 * pass gave every prop a lean and a taper and the contour pass pads every one
 * of them, so a render legitimately moves a few pixels and a dozen literals go
 * stale at once. Hand-editing a dozen numbers after every render is how one
 * gets missed -- and it did: a commit went out with these red because the test
 * summary scrolled past.
 *
 * This does not weaken the lock. The tests still FAIL until this is run, so
 * the shape change is still announced; this just makes answering it a command
 * instead of a chore, and prints what moved so the diff is read.
 *
 *   node scripts/sync-aspects.mjs           # rewrite the literals
 *   node scripts/sync-aspects.mjs --check   # list what is stale, change nothing
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';

const ROOT = resolve(process.cwd());
const check = process.argv.includes('--check');

function pngSize(path) {
  const buf = readFileSync(path);
  return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (entry.endsWith('.png')) out.push(path);
  }
  return out;
}

const assets = walk(join(ROOT, 'assets'));

/**
 * The asset a constant locks. `CLUMP_ASPECT` locks `grass_clump.png` and
 * `FLOWERS_ASPECT` locks `wildflowers.png`, so the match is a SUFFIX -- and it
 * has to be unambiguous or the tool refuses rather than guessing.
 */
function assetFor(constant, sourceFile) {
  const stem = constant.replace(/_ASPECT$/, '').toLowerCase();
  const src = readFileSync(sourceFile, 'utf8');
  const required = [...src.matchAll(/require\('([^']+\.png)'\)/g)].map((m) => basename(m[1], '.png'));
  const named = required.filter((f) => f === stem || f.endsWith(`_${stem}`) || f.endsWith(stem));
  // An exact stem beats a suffix: `paving` locks paving.png, and
  // `near_paving.png` also ends in "paving". Without this the tool called it
  // ambiguous and left the one lock a rendered course actually needed.
  const exact = named.filter((f) => f === stem);
  const unique = [...new Set(exact.length ? exact : named)];
  if (unique.length !== 1) return null;
  const hits = assets.filter((p) => basename(p, '.png') === unique[0]);
  return hits.length === 1 ? hits[0] : null;
}

const SOURCES = [
  'src/ui/scenes/OutdoorRenderedScenes.tsx',
  'src/ui/scenes/HomeRenderedScene.tsx',
  'src/ui/StageProps.tsx',
  'src/ui/BarklyKit.tsx',
  'src/ui/ItemIcon.tsx',
];

let moved = 0;
let unresolved = 0;
for (const rel of SOURCES) {
  const file = join(ROOT, rel);
  let src;
  try { src = readFileSync(file, 'utf8'); } catch { continue; }
  let next = src;

  // `const NAME_ASPECT = W / H;`
  for (const m of src.matchAll(/const (\w+_ASPECT) = (\d+) \/ (\d+);/g)) {
    const asset = assetFor(m[1], file);
    if (!asset) { unresolved += 1; console.log(`  ? ${rel} ${m[1]} -- no single asset matches, left alone`); continue; }
    const [w, h] = pngSize(asset);
    if (Number(m[2]) === w && Number(m[3]) === h) continue;
    moved += 1;
    console.log(`  ${m[1]}  ${m[2]}/${m[3]} -> ${w}/${h}  (${basename(asset)})`);
    next = next.replace(m[0], `const ${m[1]} = ${w} / ${h};`);
  }

  // `require('....png'), ... aspect: W / H`
  for (const m of src.matchAll(/require\('([^']+\/(\w+)\.png)'\),[\s\S]{0,240}?aspect: (\d+) \/ (\d+)/g)) {
    const hits = assets.filter((p) => basename(p, '.png') === m[2]);
    if (hits.length !== 1) { unresolved += 1; continue; }
    const [w, h] = pngSize(hits[0]);
    if (Number(m[3]) === w && Number(m[4]) === h) continue;
    moved += 1;
    console.log(`  ${m[2]} aspect  ${m[3]}/${m[4]} -> ${w}/${h}`);
    next = next.replace(m[0], m[0].replace(`aspect: ${m[3]} / ${m[4]}`, `aspect: ${w} / ${h}`));
  }

  if (next !== src && !check) writeFileSync(file, next);
}

if (moved === 0) console.log('every aspect lock already states its render.');
else if (check) console.log(`\n${moved} lock(s) stale -- run node scripts/sync-aspects.mjs`);
else console.log(`\n${moved} lock(s) re-stated from their renders.`);
process.exit(check && moved ? 1 : 0);
