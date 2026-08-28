#!/usr/bin/env node
/**
 * Barkly's BANKED VOICE: which of his lines get pre-recorded, and how the
 * recordings find their way back to the app.
 *
 * The problem this exists to solve is specific. His real voice is synthesized
 * by `barkly/server` — which means it needs a machine running that server, and
 * a published web artifact cannot reach one. So everybody who has ever opened
 * the demo has heard the DEVICE voice: the phone's built-in screen-reader
 * narrator, which sounds like a bus announcement and is not remotely the small,
 * warm, Bronx-inflected dog we cast.
 *
 * Barkly repeats himself on purpose, though. Most of what you actually hear in
 * a session is drawn from fixed pools — greetings, feed and play reactions,
 * idle thoughts, mishaps, level-ups. Those lines are known at build time. So we
 * render them ONCE, here, with the real voice and the real warmth pass, and
 * ship the audio inside the app. No server, no network, no key.
 *
 * Three stages, deliberately separate so the slow, networked one is the only
 * one you have to re-run rarely:
 *
 *     node scripts/voice-bank.mjs harvest     # source  -> voice-bank/lines.json
 *     python3 scripts/render-voice-bank.py    # lines   -> assets/voice/*.mp3
 *     node scripts/voice-bank.mjs link        # audio   -> src/audio/voiceBank.ts
 *     node scripts/voice-bank.mjs check       # what is banked, what is not
 *
 * THE ONE RULE THAT MAKES OR BREAKS IT: the bank is keyed on the text AFTER
 * `bronx()`. The dialect layer runs at the speaking funnel, so by the time the
 * voice engine sees a line it says "Dere ya are" and not "There you are". Key
 * the bank on the source spelling and every single lookup misses, silently,
 * and you get a 2MB app that still sounds like a bus announcement.
 *
 * WHAT IS DELIBERATELY NOT BANKED. Anything with a substitution in it — his
 * conversational replies weave in your own words, and your name, and the name
 * of a treasure he just dug up. Those are infinite and they fall through to the
 * device voice. `check` prints the real coverage rather than a number somebody
 * hoped for.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BANK_DIR = join(APP, 'voice-bank');
const AUDIO_DIR = join(APP, 'assets', 'voice');
const LINES_JSON = join(BANK_DIR, 'lines.json');
const GENERATED_TS = join(APP, 'src', 'audio', 'voiceBank.ts');

/**
 * Where his fixed lines live. An allowlist, not a sweep: a sweep would pick up
 * button labels, store blurbs and error copy, and spend a hundred kilobytes
 * each recording a voice saying "Buy".
 */
const SOURCES = [
  { file: 'src/barkly/lines.ts', tag: 'reactions' },
  { file: 'src/barkly/mishaps.ts', tag: 'mishaps' },
  { file: 'src/barkly/greetings.ts', tag: 'greetings' },
  { file: 'src/world/thoughts.ts', tag: 'thoughts' },
  { file: 'src/world/npcs.ts', tag: 'npcs', only: ['barklyLines'] },
  { file: 'src/barkly/compose.ts', tag: 'talk' },
  { file: 'src/game/progression.ts', tag: 'progression', only: ['levelUpLine', 'AREA_UNLOCKS'] },
];

/* ------------------------------------------------------------------ harvest */

/** Does this literal read like something a dog says out loud? */
function isSpeech(text) {
  if (text.length < 10 || text.length > 220) return false;
  if (!/\s/.test(text)) return false;                 // one word is a key, not a line
  if (!/[aeiouAEIOU]/.test(text)) return false;
  if (/^[a-z]+([A-Z][a-z]*)+$/.test(text)) return false;  // camelCase identifier
  if (/^[\w.-]+\/[\w./-]+$/.test(text)) return false;     // a path
  if (/^https?:/.test(text)) return false;
  if (/^[#.][\w-]/.test(text)) return false;              // a selector
  if (/\{|\}|<\/|=>/.test(text)) return false;            // markup or code
  // Two real words minimum. "TAIL_WAG" and "toy rope" both have a separator;
  // only one of them is English.
  const words = text.split(/\s+/).filter((w) => /[a-z]{2}/i.test(w));
  return words.length >= 3;
}

/**
 * Pull every literal with NO substitution out of a module.
 *
 * A template with a `${}` in it is a SHAPE, not a line — its output depends on
 * your name or the word you just typed, and there is no recording that covers
 * every value. Those are exactly the ones the device voice keeps.
 */
function literalsIn(sourcePath, only) {
  const code = readFileSync(sourcePath, 'utf8');
  const sf = ts.createSourceFile(sourcePath, code, ts.ScriptTarget.Latest, true);
  const found = [];
  let scoped = !only;   // when `only` is set, collect only inside those names

  const nameOf = (node) => {
    if (ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isPropertyAssignment(node)) {
      return node.name && ts.isIdentifier(node.name) ? node.name.text : undefined;
    }
    return undefined;
  };

  const walk = (node) => {
    const name = nameOf(node);
    const entering = only && name && only.includes(name);
    if (entering) scoped = true;

    if (scoped && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) {
      if (isSpeech(node.text)) found.push(node.text);
    }
    ts.forEachChild(node, walk);

    if (entering) scoped = false;
  };
  walk(sf);
  return found;
}

/** Load `bronx()` without a bundler: transpile the one file and run it. */
async function loadBronx() {
  const src = readFileSync(join(APP, 'src/barkly/dialect.ts'), 'utf8');
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
  return mod.bronx;
}

/** Stable, short, filesystem-safe. Content-addressed so a reword is a new file. */
export function bankKey(spoken) {
  return createHash('sha256').update(spoken).digest('hex').slice(0, 16);
}

async function harvest() {
  const bronx = await loadBronx();
  const byKey = new Map();
  let raw = 0;

  for (const { file, tag, only } of SOURCES) {
    const full = join(APP, file);
    if (!existsSync(full)) {
      console.warn(`  ! ${file} is gone — the harvest list is stale`);
      continue;
    }
    const lines = literalsIn(full, only);
    raw += lines.length;
    let added = 0;
    for (const source of lines) {
      // THE rule: bank what he will actually say, not what is written down.
      const spoken = bronx(source);
      const key = bankKey(spoken);
      if (byKey.has(key)) continue;
      byKey.set(key, { key, spoken, source, tag });
      added += 1;
    }
    console.log(`  ${tag.padEnd(12)} ${String(added).padStart(4)} lines  (${file})`);
  }

  const entries = [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
  mkdirSync(BANK_DIR, { recursive: true });
  writeFileSync(LINES_JSON, `${JSON.stringify({ generated: 'scripts/voice-bank.mjs harvest', entries }, null, 2)}\n`);
  console.log(`\n${entries.length} distinct lines (${raw} literals scanned) -> ${relativeToApp(LINES_JSON)}`);
  console.log('next: python3 scripts/render-voice-bank.py');
}

/* --------------------------------------------------------------------- link */

function relativeToApp(p) {
  return p.startsWith(APP) ? p.slice(APP.length + 1) : p;
}

function readEntries() {
  if (!existsSync(LINES_JSON)) {
    throw new Error(`no ${relativeToApp(LINES_JSON)} — run \`node scripts/voice-bank.mjs harvest\` first`);
  }
  return JSON.parse(readFileSync(LINES_JSON, 'utf8')).entries;
}

/**
 * Write the module the app imports.
 *
 * `require()` of an mp3, not a base64 string in a TypeScript file. Metro treats
 * it as an asset, the native builds get a real file on disk instead of a
 * multi-megabyte string literal to parse at startup, and the artifact builder
 * inlines it as a data: URI the same way it already does every png.
 */
function link() {
  const entries = readEntries();
  const have = entries.filter((e) => existsSync(join(AUDIO_DIR, `${e.key}.mp3`)));
  const missing = entries.length - have.length;

  let bytes = 0;
  for (const e of have) bytes += statSync(join(AUDIO_DIR, `${e.key}.mp3`)).size;

  // KEYED ON THE LINE ITSELF, not on a hash of it. The filename is
  // content-addressed so a reword becomes a new recording, but the app looks
  // up by the exact string the voice engine is handed — no hash function to
  // keep in step across a build script, a Python renderer and a React Native
  // bundle, and a bank you can read and grep.
  const rows = have
    .map((e) => `  ${JSON.stringify(e.spoken)}: require('../../assets/voice/${e.key}.mp3'),`)
    .join('\n');

  writeFileSync(
    GENERATED_TS,
    `/**
 * GENERATED by scripts/voice-bank.mjs — do not edit by hand.
 *
 * ${have.length} of Barkly's fixed lines, pre-recorded in his real voice so the
 * app sounds like him with no server, no network and no key. Keyed by the line
 * AFTER the dialect layer has run over it, which is the exact text the voice
 * engine is handed. See scripts/voice-bank.mjs for the whole story.
 *
 * Total audio: ${(bytes / 1024 / 1024).toFixed(2)} MB.
 */

export const BANKED_LINE_COUNT = ${have.length};

/** the line as he says it -> the module id of its recording. */
export const VOICE_BANK: Record<string, number> = {
${rows}
};
`,
  );
  console.log(`linked ${have.length} clips (${(bytes / 1024 / 1024).toFixed(2)} MB) -> ${relativeToApp(GENERATED_TS)}`);
  if (missing) console.warn(`${missing} line(s) have no audio yet — run scripts/render-voice-bank.py`);
}

/* -------------------------------------------------------------------- check */

function check() {
  const entries = readEntries();
  const onDisk = new Set(
    existsSync(AUDIO_DIR) ? readdirSync(AUDIO_DIR).filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4)) : [],
  );
  const byTag = new Map();
  for (const e of entries) {
    const row = byTag.get(e.tag) ?? { have: 0, want: 0 };
    row.want += 1;
    if (onDisk.has(e.key)) row.have += 1;
    byTag.set(e.tag, row);
  }
  let have = 0;
  for (const [tag, row] of byTag) {
    console.log(`  ${tag.padEnd(12)} ${String(row.have).padStart(4)}/${String(row.want).padEnd(4)}`);
    have += row.have;
  }
  console.log(`\n${have}/${entries.length} lines banked`);

  const orphans = [...onDisk].filter((k) => !entries.some((e) => e.key === k));
  if (orphans.length) {
    console.log(`${orphans.length} orphaned clip(s) — lines that were reworded since they were recorded`);
    if (process.argv.includes('--prune')) {
      for (const k of orphans) rmSync(join(AUDIO_DIR, `${k}.mp3`));
      console.log('pruned');
    } else {
      console.log('  re-run with --prune to delete them');
    }
  }
  return have === entries.length;
}

/* --------------------------------------------------------------------- main */

const mode = process.argv[2] ?? 'check';
try {
  if (mode === 'harvest') await harvest();
  else if (mode === 'link') link();
  else if (mode === 'check') check();
  else {
    console.error(`usage: voice-bank.mjs harvest|link|check`);
    process.exit(2);
  }
} catch (err) {
  console.error(String(err.message ?? err));
  process.exit(1);
}
