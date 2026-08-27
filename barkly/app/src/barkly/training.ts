/**
 * Barkly's user-taught trick system.
 *
 * This is deliberately separate from ordinary memory. A fact like
 * "favorite_color = green" describes the person; a training rule changes
 * Barkly's future behavior when an explicit cue is heard.
 *
 * The important production property is that a learned cue can execute without
 * another model call. The model helps translate an explicit teaching moment
 * into a small, validated rule once; after that the app owns the behavior.
 */

import { sanitize } from './facts';
import { LearnedTrainingRule } from './types';

export interface TrainingRule extends LearnedTrainingRule {
  id: string;
  /** Canonical comparison form; never shown to the user. */
  normalizedCue: string;
  learnedAt: number;
  updatedAt: number;
  timesTriggered: number;
}

export const MAX_TRAINING_RULES = 24;

/**
 * The app only accepts model-proposed training after language that clearly
 * looks like an instruction to teach a reusable cue. This prevents a model
 * hallucination on ordinary chat from silently installing behavior.
 */
export function looksLikeTrainingInstruction(text: string): boolean {
  const clean = text.toLowerCase().replace(/\s+/g, ' ').trim();
  return [
    /\bwhen i say\b/,
    /\bwhenever i say\b/,
    /\bif i say\b/,
    /\bwhen you hear (?:me )?say\b/,
    /\bfrom now on\b.*\bwhen\b/,
    /\bi want you to\b.*\bwhen i say\b/,
    /\bi(?:'m| am) teaching you\b/,
    /\blearn this trick\b/,
  ].some((re) => re.test(clean));
}

/** Stable, conservative form used for both storage dedupe and cue matching. */
export function normalizeCue(input: string): string {
  return sanitize(input, 64)
    .toLowerCase()
    .replace(/[“”"'`]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hashCue(cue: string): string {
  // Small deterministic FNV-1a style hash; no crypto dependency in the brain.
  let h = 2166136261;
  for (let i = 0; i < cue.length; i++) {
    h ^= cue.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function cleanCandidate(candidate: LearnedTrainingRule, now: number): TrainingRule | null {
  const cue = sanitize(candidate.cue, 64).replace(/^[\s"'“”]+|[\s"'“”]+$/g, '');
  const normalizedCue = normalizeCue(cue);
  const instruction = sanitize(candidate.instruction, 220);
  const speech = sanitize(candidate.speech, 220);

  // One-character / empty cues are far too easy to trigger accidentally.
  if (normalizedCue.length < 2 || !instruction || !speech) return null;

  return {
    id: `training-${hashCue(normalizedCue)}`,
    cue,
    normalizedCue,
    instruction,
    speech,
    reaction: candidate.reaction,
    actions: Array.from(new Set(candidate.actions)).slice(0, 4),
    learnedAt: now,
    updatedAt: now,
    timesTriggered: 0,
  };
}

/**
 * Merge by normalized cue. Teaching the same cue again is a correction, not a
 * duplicate trick. Oldest rules fall off first when the bounded store fills.
 */
export function mergeTrainingRules(
  existing: TrainingRule[],
  candidates: LearnedTrainingRule[],
  now: number,
): { rules: TrainingRule[]; added: string[]; updated: string[] } {
  const rules = [...existing];
  const added: string[] = [];
  const updated: string[] = [];

  for (const candidate of candidates) {
    const next = cleanCandidate(candidate, now);
    if (!next) continue;
    const index = rules.findIndex((r) => r.normalizedCue === next.normalizedCue);
    if (index >= 0) {
      const previous = rules[index];
      rules[index] = {
        ...next,
        id: previous.id,
        learnedAt: previous.learnedAt,
        timesTriggered: previous.timesTriggered,
      };
      updated.push(previous.id);
    } else {
      rules.push(next);
      added.push(next.id);
    }
  }

  rules.sort((a, b) => a.learnedAt - b.learnedAt);
  return { rules: rules.slice(-MAX_TRAINING_RULES), added, updated };
}

function cueAppears(input: string, cue: string): boolean {
  if (input === cue) return true;
  // Token boundaries after normalization: "sit" must not fire on "situation".
  const padded = ` ${input} `;
  return padded.includes(` ${cue} `);
}

/**
 * Longest matching cue wins, so "intruder alert red" beats "intruder alert"
 * if the user deliberately taught both.
 */
export function matchTrainingRule(rules: TrainingRule[], userText: string): TrainingRule | undefined {
  const input = normalizeCue(userText);
  if (!input) return undefined;
  return [...rules]
    .filter((rule) => cueAppears(input, rule.normalizedCue))
    .sort((a, b) => b.normalizedCue.length - a.normalizedCue.length)[0];
}

export function noteTrainingTriggered(rules: TrainingRule[], id: string, now: number): TrainingRule[] {
  return rules.map((rule) =>
    rule.id === id
      ? { ...rule, timesTriggered: rule.timesTriggered + 1, updatedAt: Math.max(rule.updatedAt, now) }
      : rule,
  );
}
