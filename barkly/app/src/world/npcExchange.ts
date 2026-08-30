/**
 * Who says what when Barkly greets another dog.
 *
 * This replaces three lines of code that were doing more damage than their
 * size suggested:
 *
 *     const i = npcLineCounter.current++ % npc.lines.length;
 *     setNpcBubble({ id, line: npc.lines[i] });
 *     speak(npc.barklyLines[i], ...)
 *
 * Three separate problems in one index.
 *
 * 1. ONE COUNTER FOR ALL THREE DOGS. `npcLineCounter` was a single ref, so
 *    which line Biscuit said depended on how many times you had tapped Duke.
 * 2. THE REPLY WAS WELDED TO THE GREETING. Drawing the two halves independently
 *    turns a small pool into many more believable exchanges.
 * 3. STRICT ROTATION. A visible cycle feels authored almost immediately.
 *
 * The current picker also keeps a tiny per-dog history window. Avoiding only
 * the immediately previous line was still noticeably repetitive with six-line
 * pools: A, B, A is technically "fresh" and still feels like a loop. Keeping
 * the last two slots out of the draw makes repeated taps feel much less canned
 * without requiring persisted state or changing the NPC data format.
 *
 * Pure: state in, state out, injectable randomness.
 */

import { Npc, NpcId, NpcStagePool } from './npcs';

/** Last index plus a short recent-history window per dog, per pool. */
export interface ExchangeMemory {
  /** Kept for compatibility with existing tests/callers and stage transitions. */
  line: Partial<Record<NpcId, number>>;
  reply: Partial<Record<NpcId, number>>;
  /** Two-slot anti-repeat history. Old memory objects may omit these. */
  recentLine?: Partial<Record<NpcId, number[]>>;
  recentReply?: Partial<Record<NpcId, number[]>>;
}

/**
 * The pool the CURRENT relationship earns: the highest stage at or below the
 * bond's encounter count, or the base (acquaintance) pool below the first
 * stage. The thresholds live on data so adding a rung does not require a
 * second copy of the escalation ladder here.
 */
export function poolFor(npc: Npc, encounters: number): Pick<NpcStagePool, 'lines' | 'barklyLines'> {
  let best: NpcStagePool | undefined;
  for (const stage of npc.stages ?? []) {
    if (encounters >= stage.at && (!best || stage.at > best.at)) best = stage;
  }
  return best ?? { lines: npc.lines, barklyLines: npc.barklyLines };
}

export function freshExchangeMemory(): ExchangeMemory {
  return { line: {}, reply: {}, recentLine: {}, recentReply: {} };
}

/**
 * Pick an index that is not `last`. Kept exported because tests and any future
 * callers rely on the simple primitive. With a pool of one it returns 0 rather
 * than looping forever.
 */
export function pickFresh(poolSize: number, last: number | undefined, rng: () => number): number {
  if (poolSize <= 1) return 0;
  const choices = [];
  for (let i = 0; i < poolSize; i++) if (i !== last) choices.push(i);
  return choices[Math.min(choices.length - 1, Math.floor(rng() * choices.length))];
}

/** Prefer anything outside the recent window; gracefully relax for tiny pools. */
function pickFreshWindow(poolSize: number, recent: number[], rng: () => number): number {
  if (poolSize <= 1) return 0;
  const blocked = new Set(recent.slice(-2));
  const choices: number[] = [];
  for (let i = 0; i < poolSize; i++) if (!blocked.has(i)) choices.push(i);
  if (choices.length === 0) return pickFresh(poolSize, recent.at(-1), rng);
  return choices[Math.min(choices.length - 1, Math.floor(rng() * choices.length))];
}

function remember(history: number[] | undefined, next: number): number[] {
  return [...(history ?? []), next].slice(-2);
}

/**
 * A readable NPC caption should not vanish on the same fixed clock regardless
 * of length. The controller can use this metadata when staging the NPC half of
 * the exchange after Barkly finishes speaking. It is deliberately capped so a
 * bubble never squats on the scene forever, while short quips still get a
 * comfortable minimum dwell.
 */
export function npcReadMs(line: string): number {
  const words = line.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(4200, Math.min(9000, 2200 + words * 285));
}

export interface Exchange {
  npcLine: string;
  barklyLine: string;
  /** Suggested dwell for the unvoiced NPC caption. */
  npcReadMs: number;
  memory: ExchangeMemory;
}

/**
 * `encounters` is the current bond count for this dog (0 for a stranger) and
 * selects the stage pool — see poolFor. Histories are intentionally local to
 * the session: relationship history chooses WHAT pool this dog speaks from;
 * this memory only prevents the presentation from sounding mechanically
 * repetitive while the player is hanging out right now.
 */
export function pickExchange(
  npc: Npc,
  memory: ExchangeMemory,
  encounters = 0,
  rng: () => number = Math.random,
): Exchange {
  const pool = poolFor(npc, encounters);
  const priorLines = memory.recentLine?.[npc.id] ?? (memory.line[npc.id] === undefined ? [] : [memory.line[npc.id]!]);
  const priorReplies = memory.recentReply?.[npc.id] ?? (memory.reply[npc.id] === undefined ? [] : [memory.reply[npc.id]!]);
  const lineIndex = pickFreshWindow(pool.lines.length, priorLines, rng);
  const replyIndex = pickFreshWindow(pool.barklyLines.length, priorReplies, rng);
  const npcLine = pool.lines[lineIndex];
  return {
    npcLine,
    barklyLine: pool.barklyLines[replyIndex],
    npcReadMs: npcReadMs(npcLine),
    memory: {
      line: { ...memory.line, [npc.id]: lineIndex },
      reply: { ...memory.reply, [npc.id]: replyIndex },
      recentLine: { ...memory.recentLine, [npc.id]: remember(priorLines, lineIndex) },
      recentReply: { ...memory.recentReply, [npc.id]: remember(priorReplies, replyIndex) },
    },
  };
}
