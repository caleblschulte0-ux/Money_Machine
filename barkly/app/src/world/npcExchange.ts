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
 *    Greet Duke twice and Biscuit opens on his third line for no reason a
 *    player could ever discover.
 * 2. THE REPLY WAS WELDED TO THE GREETING. Line i always drew reply i, so
 *    three greetings meant three fixed scripts, forever, in order. Drawing
 *    them independently turns 3 + 3 lines into 9 exchanges, and the pools
 *    below are now 6 + 6, which is 36.
 * 3. STRICT ROTATION. `i++ % n` is a cycle, and a cycle is the one pattern a
 *    player notices fastest. Picking at random while refusing the last one
 *    used reads as variety instead.
 *
 * Pure: state in, state out, injectable randomness.
 */

import { Npc, NpcId, NpcStagePool } from './npcs';

/** Last index used per dog, per pool. Nothing else needs to persist. */
export interface ExchangeMemory {
  line: Partial<Record<NpcId, number>>;
  reply: Partial<Record<NpcId, number>>;
}

/**
 * The pool the CURRENT relationship earns: the highest stage at or below the
 * bond's encounter count, or the base (acquaintance) pool below the first
 * stage. This is the seam that was missing — pickExchange drew from one flat
 * pool per dog, so "Biscuit Best Friend" (34 hangouts) and a fresh save got
 * the same introductions, and a nemesis Duke opened with small talk. The
 * thresholds are the escalation ladder's rungs; keeping them on the data
 * (each stage's `at`) rather than hardcoded here means a new rung is a data
 * change, not a logic change.
 */
export function poolFor(npc: Npc, encounters: number): Pick<NpcStagePool, 'lines' | 'barklyLines'> {
  let best: NpcStagePool | undefined;
  for (const stage of npc.stages ?? []) {
    if (encounters >= stage.at && (!best || stage.at > best.at)) best = stage;
  }
  return best ?? { lines: npc.lines, barklyLines: npc.barklyLines };
}

export function freshExchangeMemory(): ExchangeMemory {
  return { line: {}, reply: {} };
}

/**
 * Pick an index that is not `last`. With a pool of one there is nothing to
 * avoid, so it returns 0 rather than looping forever.
 */
export function pickFresh(poolSize: number, last: number | undefined, rng: () => number): number {
  if (poolSize <= 1) return 0;
  const choices = [];
  for (let i = 0; i < poolSize; i++) if (i !== last) choices.push(i);
  return choices[Math.min(choices.length - 1, Math.floor(rng() * choices.length))];
}

export interface Exchange {
  npcLine: string;
  barklyLine: string;
  memory: ExchangeMemory;
}

/**
 * `encounters` is the current bond count for this dog (0 for a stranger) and
 * selects the stage pool — see poolFor. The remembered index carries across a
 * stage change; pickFresh only uses it as "not this one", so at worst the
 * first line after a promotion avoids an arbitrary slot.
 */
export function pickExchange(
  npc: Npc,
  memory: ExchangeMemory,
  encounters = 0,
  rng: () => number = Math.random,
): Exchange {
  const pool = poolFor(npc, encounters);
  const lineIndex = pickFresh(pool.lines.length, memory.line[npc.id], rng);
  const replyIndex = pickFresh(pool.barklyLines.length, memory.reply[npc.id], rng);
  return {
    npcLine: pool.lines[lineIndex],
    barklyLine: pool.barklyLines[replyIndex],
    memory: {
      line: { ...memory.line, [npc.id]: lineIndex },
      reply: { ...memory.reply, [npc.id]: replyIndex },
    },
  };
}
