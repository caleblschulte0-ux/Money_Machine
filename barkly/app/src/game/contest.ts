/**
 * The contest — what happens when "Challenge him" means something.
 *
 * Choosing to challenge Duke used to print two lines and increment a counter,
 * which is not a challenge, it is an announcement. This is the actual duel:
 * three rounds of a timing test, best of three, and the result feeds the
 * rivalry rather than a fixed script deciding it in advance.
 *
 * Design rules:
 *
 * - IT MUST BE POSSIBLE TO LOSE. A rivalry where you always win is not a
 *   rivalry. Duke plays too, and he is genuinely decent.
 * - IT MUST BE READABLE IN ONE GLANCE. A marker sweeps a track, a zone is the
 *   target, you tap. No instructions screen.
 * - IT MUST GET HARDER. Each round the marker moves faster and the zone
 *   narrows, so round three is a real moment rather than a third round one.
 * - NO TWITCH FLOOR. Even round three's zone is wide enough for a child; the
 *   difficulty is in the speed, not in demanding pixel accuracy.
 *
 * Pure and platform-agnostic: no React, no timers, no randomness that the
 * caller cannot control. The sheet owns the animation; this owns the rules.
 */

export type ContestKind = 'fetch' | 'race' | 'dig';

export interface ContestRules {
  kind: ContestKind;
  /** Who Barkly is up against. */
  opponent: string;
  /**
   * How to refer to them without their name.
   *
   * `roundLine` below used to hardcode "He", so losing a race to Pepper — who
   * is established as "she" in every authored line about her — produced
   * "Pepper got that one. He is going to talk about it." The pronoun lives on
   * the NPC record now (`world/npcs.Npc.pronouns`) and rides in here with the
   * name it belongs to.
   *
   * Optional so a contest already in flight in an older save still resolves;
   * a missing one falls back to they/them, which is wrong for nobody.
   */
  opponentPronouns?: { subject: string; object: string; possessive: string };
  rounds: number;
}

export interface RoundSpec {
  /** 0..1 along the track, the centre of the target. */
  target: number;
  /** Half-width of the target, in track units. Shrinks with each round. */
  halfWidth: number;
  /** How long one full sweep takes, ms. Shorter each round. */
  sweepMs: number;
}

export interface ContestState {
  rules: ContestRules;
  round: number;
  /** Rounds won by each side. */
  you: number;
  them: number;
  /** One line per finished round, newest last. */
  log: string[];
  done: boolean;
  won?: boolean;
}

/** Zone half-widths per round. Generous on purpose: speed is the difficulty. */
const HALF_WIDTHS = [0.16, 0.13, 0.11];
const SWEEP_MS = [1500, 1150, 900];

export const CONTEST_ROUNDS = 3;

export function roundSpec(round: number, rng: () => number = Math.random): RoundSpec {
  const i = Math.min(round, HALF_WIDTHS.length - 1);
  const halfWidth = HALF_WIDTHS[i];
  // Keep the zone fully on the track so it is never half off the end.
  const target = halfWidth + rng() * (1 - 2 * halfWidth);
  return { target, halfWidth, sweepMs: SWEEP_MS[i] };
}

export function freshContest(rules: ContestRules): ContestState {
  return { rules, round: 0, you: 0, them: 0, log: [], done: false };
}

/**
 * Did the tap land in the zone?
 *
 * The epsilon is not decoration: target + halfWidth is a floating-point sum,
 * so a tap exactly on the boundary compares as very slightly outside it and
 * reads to the player as a stolen hit.
 */
export function isHit(position: number, spec: RoundSpec): boolean {
  return Math.abs(position - spec.target) <= spec.halfWidth + 1e-9;
}

/**
 * How close to the middle, 0..1. Used only for flavour — a scraped edge reads
 * differently from dead centre, and saying so is most of the fun.
 */
export function accuracy(position: number, spec: RoundSpec): number {
  const off = Math.abs(position - spec.target) / spec.halfWidth;
  return Math.max(0, 1 - off);
}

/**
 * The opponent's attempt. Deliberately good but beatable: he hits about 60%
 * of the time and gets slightly better as the contest goes on, so winning
 * feels earned and losing feels fair.
 */
export function opponentHits(round: number, rng: () => number = Math.random): boolean {
  return rng() < 0.55 + round * 0.05;
}

function roundLine(
  kind: ContestKind,
  youHit: boolean,
  themHit: boolean,
  opponent: string,
  acc: number,
  subject = 'they',
): string {
  const They = subject.charAt(0).toUpperCase() + subject.slice(1);
  const are = subject === 'they' ? 'are' : 'is';
  if (youHit && !themHit) {
    return acc > 0.75 ? `Dead centre. ${opponent} watched it happen.` : `Got there first. Barely. Counts.`;
  }
  if (!youHit && themHit) return `${opponent} got that one. ${They} ${are} going to talk about it.`;
  if (youHit && themHit) return `Both of you. Nobody is admitting it was close.`;
  return `Neither of you. Deeply embarrassing for everyone.`;
}

export interface RoundResult {
  state: ContestState;
  youHit: boolean;
  themHit: boolean;
  line: string;
}

/** Resolve one round from a tap position. */
export function playRound(
  state: ContestState,
  position: number,
  spec: RoundSpec,
  rng: () => number = Math.random,
): RoundResult {
  if (state.done) return { state, youHit: false, themHit: false, line: '' };

  const youHit = isHit(position, spec);
  const themHit = opponentHits(state.round, rng);
  const line = roundLine(
    state.rules.kind,
    youHit,
    themHit,
    state.rules.opponent,
    accuracy(position, spec),
    state.rules.opponentPronouns?.subject,
  );

  const you = state.you + (youHit && !themHit ? 1 : 0);
  const them = state.them + (themHit && !youHit ? 1 : 0);
  const round = state.round + 1;
  const finished = round >= state.rules.rounds;

  return {
    state: {
      ...state,
      round,
      you,
      them,
      log: [...state.log, line],
      done: finished,
      // A draw goes to the challenger, so a contest always has an answer.
      won: finished ? you >= them : undefined,
    },
    youHit,
    themHit,
    line,
  };
}

/** What Barkly says when it is over. Winning is not gracious. */
export function verdictLine(state: ContestState): string {
  if (!state.done) return '';
  const them = state.rules.opponent;
  if (state.won) {
    if (state.them === 0) return `Swept it. ${them} has gone very quiet. I love it here.`;
    return `Won it. ${them} says it was the light. It was not the light.`;
  }
  return `${them} won. I want it on record that the wind was involved.`;
}

/** Coins are for showing up; the win is the actual prize. */
export function contestReward(state: ContestState): { coins: number; xp: number } {
  if (!state.done) return { coins: 0, xp: 0 };
  return state.won ? { coins: 25, xp: 40 } : { coins: 8, xp: 15 };
}
