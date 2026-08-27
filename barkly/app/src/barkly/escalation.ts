/**
 * Escalation — how a relationship actually moves.
 *
 * There was a ladder here already: three run-ins made Duke an "official
 * rival", six made him a "nemesis". Two things were wrong with it, and both
 * are the same complaint — it did not make sense and it was not fluid.
 *
 * 1. IT HAPPENED OFF SCREEN. The stage only ever appeared as a word inside an
 *    eyebrow on a modal you might never open. Barkly acquired a nemesis and
 *    nobody told you. An escalation nobody witnesses is a counter, not a
 *    story.
 *
 * 2. IT ESCALATED ON TAPS. Every casual tap on Duke incremented the same
 *    number that decided the stage, so you could tap your way to a
 *    generational feud without a single thing happening between them. That is
 *    the opposite of earned.
 *
 * So the rule here is: TAPS BUILD PRESSURE, MOMENTS PROMOTE. Casual contact
 * moves the relationship right up to the edge of the next rung and stops
 * there. Only something you actually played — a choice in an encounter, a
 * duel that had a winner — can cross the line. That way every promotion lands
 * on a beat the player was present for, and the meter tells them it is coming.
 *
 * Pure and platform-agnostic: no React, no storage, no clock of its own.
 */

import type { SocialBond, SocialStage } from './character';

export type BondKind = SocialBond['kind'];

export interface Rung extends SocialStage {
  /** Encounters required to stand on this rung. */
  at: number;
  /** The banner when it is crossed. `%s` is the dog's name. */
  headline: string;
  /** What Barkly says about it, out loud, at the moment it happens. */
  line: string;
}

/**
 * The rungs. Thresholds are unchanged (0/3/6/12) — the ladder was never the
 * problem, being invisible was.
 */
export const RIVAL_LADDER: Rung[] = [
  {
    at: 0,
    label: 'annoying dog',
    blurb: 'One more incident and Barkly is going to start a file.',
    headline: '%s is on the list',
    line: 'I am not saying he is a problem. I am saying I have started noticing.',
  },
  {
    at: 3,
    label: 'official rival',
    blurb: 'The beef has continuity now. There are receipts.',
    headline: '%s is now an official rival',
    line: 'That settles it. He is official now. I will be keeping records.',
  },
  {
    at: 6,
    label: 'nemesis',
    blurb: 'This has moved beyond irritation into personal mythology.',
    headline: '%s is now a nemesis',
    line: 'We have passed rival. This is a nemesis situation. I am honestly thrilled.',
  },
  {
    at: 12,
    label: 'generational feud',
    blurb: 'Nobody remembers how this started. Barkly absolutely remembers every incident.',
    headline: '%s: this is now a generational feud',
    line: 'Our grandchildren will inherit this. I hope they are ready.',
  },
];

export const FRIEND_LADDER: Rung[] = [
  {
    at: 0,
    label: 'park acquaintance',
    blurb: 'They know each other. Barkly is still deciding how embarrassing to be.',
    headline: '%s is a familiar face',
    line: 'I know that dog. Not well. But I know that dog.',
  },
  {
    at: 3,
    label: 'actual buddy',
    blurb: 'Barkly expects to see them again and acts like it.',
    headline: '%s is an actual buddy now',
    line: 'Okay. That is a friend. I am admitting it out loud, once.',
  },
  {
    at: 6,
    label: 'best friend',
    blurb: 'This is now a real recurring friendship with its own history.',
    headline: '%s is now his best friend',
    line: 'Best friend. Do not make it weird. It is already a little weird.',
  },
  {
    at: 12,
    label: 'pack family',
    blurb: 'At this point Barkly treats them like they came with the house.',
    headline: '%s is pack family',
    line: 'That one is family now. They came with the house. I do not make the rules.',
  },
];

export function ladderFor(kind: BondKind): Rung[] {
  return kind === 'friend' ? FRIEND_LADDER : RIVAL_LADDER;
}

/** Index of the rung a given count stands on. */
export function rungIndex(kind: BondKind, encounters: number): number {
  const ladder = ladderFor(kind);
  let index = 0;
  for (let i = 0; i < ladder.length; i++) if (encounters >= ladder[i].at) index = i;
  return index;
}

export function rungAt(kind: BondKind, encounters: number): Rung {
  return ladderFor(kind)[rungIndex(kind, encounters)];
}

export interface LadderProgress {
  kind: BondKind;
  encounters: number;
  stage: Rung;
  index: number;
  total: number;
  /** Label of the rung above, if there is one. */
  nextLabel?: string;
  /** How many more encounters until the next rung. 0 when maxed. */
  remaining: number;
  /** 0..1 through the current rung. 1 when maxed out. */
  fraction: number;
  /** Human line for a meter: "2 more incidents to nemesis". */
  hint: string;
}

/**
 * Continuous progress, which is what "more fluid" means in practice: the
 * player should be able to see the next rung coming instead of being
 * surprised by a label change.
 */
export function ladderProgress(kind: BondKind, encounters: number): LadderProgress {
  const ladder = ladderFor(kind);
  const index = rungIndex(kind, encounters);
  const stage = ladder[index];
  const next = ladder[index + 1];
  const noun = kind === 'rival' ? 'incident' : 'hangout';

  if (!next) {
    return {
      kind,
      encounters,
      stage,
      index,
      total: ladder.length,
      remaining: 0,
      fraction: 1,
      hint: 'This is as far as the ladder goes. It continues anyway.',
    };
  }

  const span = next.at - stage.at;
  const into = Math.max(0, encounters - stage.at);
  const remaining = Math.max(0, next.at - encounters);
  return {
    kind,
    encounters,
    stage,
    index,
    total: ladder.length,
    nextLabel: next.label,
    remaining,
    fraction: span <= 0 ? 1 : Math.min(1, into / span),
    hint:
      remaining === 0
        ? `Ready to become ${next.label}.`
        : `${remaining} more ${noun}${remaining === 1 ? '' : 's'} to ${next.label}.`,
  };
}

export interface Promotion {
  who: string;
  kind: BondKind;
  /** Fully rendered, name substituted. */
  headline: string;
  line: string;
  fromLabel: string;
  toLabel: string;
}

/** A stage change, if the count crossed a rung. Null is the common case. */
export function promotionBetween(
  who: string,
  kind: BondKind,
  before: number,
  after: number,
): Promotion | null {
  const from = rungIndex(kind, before);
  const to = rungIndex(kind, after);
  if (to <= from) return null;
  const rung = ladderFor(kind)[to];
  return {
    who,
    kind,
    headline: rung.headline.replace('%s', who),
    line: rung.line,
    fromLabel: ladderFor(kind)[from].label,
    toLabel: rung.label,
  };
}

/**
 * The ceiling casual contact may reach: one short of the next rung. Passed a
 * count already at or past the top rung, there is nothing to hold back.
 */
export function pressureCeiling(kind: BondKind, encounters: number): number {
  const ladder = ladderFor(kind);
  const next = ladder[rungIndex(kind, encounters) + 1];
  return next ? next.at - 1 : Number.POSITIVE_INFINITY;
}

export interface ContactOptions {
  /**
   * True for something the player actually played through — an encounter
   * choice, a settled duel. False for a casual tap, which builds pressure but
   * never promotes.
   */
  promotes: boolean;
  delta?: number;
}

export interface ContactResult {
  encounters: number;
  promotion: Promotion | null;
  /** True when a casual tap was held at the edge of the next rung. */
  held: boolean;
}

/**
 * Apply one contact to a count. This is the whole rule in one function so
 * that nothing else has to remember it.
 */
export function applyContact(
  who: string,
  kind: BondKind,
  encounters: number,
  opts: ContactOptions,
): ContactResult {
  const delta = Math.trunc(opts.delta ?? 1);
  const raw = Math.max(0, encounters + delta);

  if (opts.promotes || delta <= 0) {
    return { encounters: raw, promotion: promotionBetween(who, kind, encounters, raw), held: false };
  }

  const ceiling = pressureCeiling(kind, encounters);
  const capped = Math.min(raw, ceiling);
  return { encounters: capped, promotion: null, held: capped < raw };
}
