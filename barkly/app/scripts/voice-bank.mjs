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
 * Where his fixed lines live.
 *
 * An allowlist, not a sweep, because `src/ui/` is full of button labels and
 * store blurbs and a sweep would spend a hundred kilobytes recording a voice
 * saying "Buy". But the FIRST version of this list was seven files chosen by
 * hand, and driving the real artifact through a real session found him falling
 * back to the browser narrator for lines like "Plan complete. Disturbingly
 * productive." — a fixed string, in a file nobody thought to list. Guessing
 * which files hold his voice does not work; the brain and the world are the
 * places his words come from, so take them whole and let `isSpeech` filter.
 *
 * Over-recording is cheap: a line nobody looks up costs 15 KB and sits there.
 * Under-recording is the browser narrator interrupting him mid-conversation.
 */
const SOURCES = [
  { file: 'src/barkly/lines.ts', tag: 'reactions' },
  { file: 'src/barkly/mishaps.ts', tag: 'mishaps' },
  { file: 'src/barkly/greetings.ts', tag: 'greetings' },
  { file: 'src/barkly/onboarding.ts', tag: 'onboarding' },
  { file: 'src/barkly/compose.ts', tag: 'talk' },
  /*
   * THE OFFLINE BRAIN, which is the only brain the published web build has.
   *
   * This list's own comment says guessing which files hold his voice does not
   * work -- and then this file was missing from it, so every fixed answer the
   * scripted provider gives went to the browser narrator: "Barkly. It's on the
   * tag. Keep up.", "I'm a dog. You're the one talking to a dog.", and the
   * whole answerQuestion set, which is the most on-thesis thing he says.
   * `isSpeech` drops the template shapes on its own, so the lines that CAN be
   * banked are, and the ones with the player's name in them stay out.
   */
  { file: 'src/providers/dialogue/scripted.ts', tag: 'offline' },
  { file: 'src/world/thoughts.ts', tag: 'thoughts' },
  { file: 'src/hooks/useBarkly.ts', tag: 'hook' },
  // Scoped to the property that is actually SPOKEN. These files also hold
  // journal entries, badge labels and %s headlines — text that is read, not
  // said. A sweep recorded 114 of them out of encounters.ts alone, 1.3 MB of a
  // voice narrating a scrapbook nobody will ever hear it narrate.
  { file: 'src/world/npcs.ts', tag: 'npcs', only: ['barklyLines'] },
  { file: 'src/barkly/escalation.ts', tag: 'escalation', only: ['line'] },
  // `inferLocalPerformance` is where the taught tricks get their voices, and
  // it assigns to a local `speech` rather than declaring one, so the scope
  // never reached inside it: every trick except "play dead" was performed in
  // the browser's screen reader. Found by the scope audit in `check`.
  { file: 'src/barkly/training.ts', tag: 'training', only: ['speech', 'PLAY_DEAD_LINE', 'inferLocalPerformance'] },
  // `only: ['line']` matched a local `const line = roundLine(...)` whose
  // initializer is a CALL, so it collected nothing and the duel -- the loudest
  // beat in the app -- was entirely narrated. The literals live inside the two
  // functions that build those strings.
  { file: 'src/game/contest.ts', tag: 'contest', only: ['line', 'roundLine', 'verdictLine'] },
  // The two name-fronted initiative bodies live at module scope, outside
  // `pickInitiative`, so the scope has to name them -- the same trap that hid
  // `training.PLAY_DEAD_LINE`. A body extracted for the bank's benefit and
  // then left outside the bank's reach is the joke telling itself twice.
  { file: 'src/barkly/character.ts', tag: 'initiative', only: ['pickInitiative', 'FOOD_SITUATION', 'STILL_THERE'] },
  // `buy` and `buyLine` are what he SAYS about the shop — "Mine. That's mine
  // now. Don't touch it." — as opposed to the item names and blurbs around
  // them, which are read. Same audit, same day.
  { file: 'src/game/progression.ts', tag: 'progression', only: ['levelUpLine', 'AREA_UNLOCKS', 'buy', 'buyLine'] },
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
  // A shape, not a line: something is substituted into it at runtime, so no
  // recording can ever match what he actually says.
  if (/%s|\$\{/.test(text)) return false;
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

  /*
   * SAVE AND RESTORE, rather than switch off on the way out.
   *
   * `if (entering) scoped = false` after the children looks harmless and is
   * not: a NESTED name from the `only` list turns the scope off for everything
   * that follows it in the ENCLOSING one. `training.ts` is scoped to `speech`
   * and `inferLocalPerformance`; the function opens with
   * `let speech = 'Right. I remember this one.'`, which is itself an entering
   * node, and leaving it closed the scope for the rest of the function — so
   * eight more lines he says while performing a taught trick were invisible to
   * the bank no matter what was added to the list. Every trick except "play
   * dead" was performed in the browser's screen reader.
   */
  const walk = (node) => {
    const name = nameOf(node);
    const entering = only && name && only.includes(name);
    const outer = scoped;
    if (entering) scoped = true;

    if (scoped && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) {
      if (isSpeech(node.text)) found.push(node.text);
    }
    ts.forEachChild(node, walk);

    scoped = outer;
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
  return have === entries.length && scopeAudit();
}

/**
 * SPEECH THE HARVESTER CANNOT SEE.
 *
 * Three separate lines went out in the browser's screen reader this week and
 * every one was the same shape: a FIXED string the bank could have held, in a
 * file that IS on the SOURCES list, sitting somewhere the file's `only` scope
 * does not reach.
 *
 *   training.PLAY_DEAD_LINE     module scope; the file is scoped to `speech`
 *   character.FOOD_SITUATION    module scope; scoped to `pickInitiative`
 *   contest roundLine/verdict   scoped to `line`, which matched a local
 *                               `const line = roundLine(...)` — a call, not a
 *                               literal — and collected nothing at all
 *
 * The scopes are right: these files also hold journal entries, badge labels
 * and NPC lines that are deliberately never voiced, and a sweep of everything
 * once recorded 114 scrapbook entries out of one file. So this cannot be "no
 * speech outside the scope, ever". What it CAN be is a ratchet: the number of
 * speech-shaped literals the scope excludes is written down, and this fails
 * when it GROWS — which is exactly the moment somebody adds a spoken line
 * where the bank will never find it.
 *
 * Raising a baseline is a deliberate act with a reason, the same as any other
 * number in this repo. Lowering one happens on its own.
 */
function scopeAudit() {
  const BASELINE_PATH = join(BANK_DIR, 'scope-baseline.json');
  const baseline = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : {};
  const counts = {};
  let grew = false;
  for (const { file, only } of SOURCES) {
    if (!only) continue;
    const full = join(APP, file);
    if (!existsSync(full)) continue;
    const all = literalsIn(full, undefined);
    const seen = new Set(literalsIn(full, only));
    const hidden = all.filter((l) => !seen.has(l));
    counts[file] = hidden.length;
    const was = baseline[file];
    if (was === undefined) {
      console.log(`  scope: ${file} — ${hidden.length} line(s) the bank cannot see (no baseline yet)`);
      grew = true;
    } else if (hidden.length > was) {
      console.error(`\nFAIL: ${file} now hides ${hidden.length} speech-shaped line(s) from the voice bank, was ${was}.`);
      for (const l of hidden.slice(0, 8)) console.error(`   "${l.slice(0, 72)}"`);
      console.error('If one of those is something he SAYS, pull it into a named constant and add');
      console.error(`that name to this file's \`only\` list. If none of them are, update`);
      console.error(`${relativeToApp(BASELINE_PATH)} and say why in the commit.`);
      grew = true;
    }
  }
  if (!existsSync(BASELINE_PATH) || process.argv.includes('--write-baseline')) {
    writeFileSync(BASELINE_PATH, `${JSON.stringify(counts, null, 2)}\n`);
    console.log(`wrote ${relativeToApp(BASELINE_PATH)}`);
    return true;
  }
  if (!grew) {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(`scope audit clean: ${total} excluded line(s), none new`);
  }
  return !grew;
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
