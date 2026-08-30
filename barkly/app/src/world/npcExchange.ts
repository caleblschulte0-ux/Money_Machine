/**
 * Who says what when Barkly greets another dog.
 *
 * The exchange picker is deliberately pure: the UI/controller decides WHEN a
 * line gets the floor; this module decides WHAT gets said and how long an
 * unvoiced NPC line should remain readable once it appears.
 */

import { Npc, NpcId, NpcStagePool } from './npcs';

/** Last indices plus a tiny anti-repeat window, isolated per dog. */
export interface ExchangeMemory {
  line: Partial<Record<NpcId, number>>;
  reply: Partial<Record<NpcId, number>>;
  /** Optional for backwards compatibility with in-memory callers/tests. */
  recentLine?: Partial<Record<NpcId, number[]>>;
  recentReply?: Partial<Record<NpcId, number[]>>;
}

/**
 * The pool the CURRENT relationship earns: the highest stage at or below the
 * bond's encounter count, or the base (acquaintance) pool below the first
 * stage. The thresholds live on the NPC data so adding a relationship rung is
 * a data change, not a second hard-coded progression ladder.
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
 * Pick an index that is not `last`. With a pool of one there is nothing to
 * avoid, so it returns 0 rather than looping forever.
 */
export function pickFresh(poolSize: number, last: number | undefined, rng: () => number): number {
  if (poolSize <= 1) return 0;
  const choices: number[] = [];
  for (let i = 0; i < poolSize; i++) if (i !== last) choices.push(i);
  return choices[Math.min(choices.length - 1, Math.floor(rng() * choices.length))];
}

/**
 * Avoid the last two choices when the pool is large enough. A -> B -> A is not
 * technically an immediate repeat, but players notice that loop very quickly.
 * Tiny pools gracefully fall back to the one-slot rule instead of deadlocking.
 */
function pickFreshWindow(poolSize: number, recent: number[], rng: () => number): number {
  if (poolSize <= 1) return 0;
  const blocked = new Set(recent.slice(-2));
  const choices: number[] = [];
  for (let i = 0; i < poolSize; i++) if (!blocked.has(i)) choices.push(i);
  if (choices.length === 0) return pickFresh(poolSize, recent[recent.length - 1], rng);
  return choices[Math.min(choices.length - 1, Math.floor(rng() * choices.length))];
}

function remember(history: number[] | undefined, next: number): number[] {
  return [...(history ?? []), next].slice(-2);
}

/**
 * Suggested dwell for an UNVOICED NPC caption once it receives the floor.
 * Short quips still get a comfortable minimum; long lines scale with word
 * count but are capped so a stale bubble cannot dominate the scene forever.
 */
export function npcReadMs(line: string): number {
  const words = line.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(4200, Math.min(9000, 2200 + words * 285));
}

export interface Exchange {
  npcLine: string;
  barklyLine: string;
  /** Suggested dwell once the NPC half is shown after Barkly's voiced half. */
  npcReadMs: number;
  memory: ExchangeMemory;
}

/**
 * `encounters` selects the current relationship-stage pool. Session memory
 * only controls presentation variety; it never changes relationship state.
 */
export function pickExchange(
  npc: Npc,
  memory: ExchangeMemory,
  encounters = 0,
  rng: () => number = Math.random,
): Exchange {
  const pool = poolFor(npc, encounters);
  const priorLines = memory.recentLine?.[npc.id] ??
    (memory.line[npc.id] === undefined ? [] : [memory.line[npc.id] as number]);
  const priorReplies = memory.recentReply?.[npc.id] ??
    (memory.reply[npc.id] === undefined ? [] : [memory.reply[npc.id] as number]);

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
