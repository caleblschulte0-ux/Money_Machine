/**
 * Barkly's user-taught trick system.
 *
 * A learned cue can execute without another model call. More importantly, a
 * learned cue can now be a ROUTINE: ordered beats such as spin -> sit -> play
 * dead. That is deliberately device-agnostic choreography so the exact same
 * learned routine can later drive a physical Barkly.
 */

import { sanitize } from './facts';
import { BodyAction, LearnedTrainingRule, ReactionState, RoutineBeat } from './types';

export interface TrainingRule extends LearnedTrainingRule {
  id: string;
  normalizedCue: string;
  learnedAt: number;
  updatedAt: number;
  timesTriggered: number;
}

export const MAX_TRAINING_RULES = 24;
export const MAX_ROUTINE_BEATS = 4;

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
    /\blearn this routine\b/,
  ].some((re) => re.test(clean));
}

export function normalizeCue(input: string): string {
  return sanitize(input, 64)
    .toLowerCase()
    .replace(/[“”"'`]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Offline teaching path. Simple instructions become one trick; compound
 * instructions become ordered choreography when EVERY beat is representable.
 * If even one beat is unknown, return null and let the real brain interpret it
 * instead of pretending Barkly learned something he cannot perform.
 */
/**
 * The word that starts an instruction, anchored.
 *
 * This is the same vocabulary `inferLocalPerformance` recognises, but it must
 * match at the START of the remainder rather than anywhere inside it -- that
 * anchoring is what lets a split be VALIDATED instead of guessed. Searching
 * loosely would let "when I say good boy sit down" split at "good", because
 * "boy sit down" contains "sit" somewhere.
 */
const ACTION_OPENER =
  /^(?:play dead|pretend|lie down|go to sleep|fall asleep|be (?:terrified|scared|afraid)|panic|freak out|spin|dance|zoom|run|jump|hop|wag|tilt|cock|do a head tilt|head tilt|look|perk|raise|blink|sit)\b/i;

/** Strip the connective a child puts between the cue and the action. */
function actionPart(words: string[]): string {
  let tail = words;
  while (tail.length > 0 && /^(?:you|then|please|and)$/i.test(tail[0])) tail = tail.slice(1);
  return tail.join(' ').trim();
}

/**
 * WHERE THE CUE ENDS AND THE TRICK BEGINS.
 *
 * The old pattern required a comma or the word "then" as the boundary, so the
 * flagship feature of this app failed on the phrasing a child is most likely
 * to type. Measured across twenty realistic phrasings, EVERY comma-less one
 * was refused:
 *
 *   "when I say spin, you spin around"   learned
 *   "when i say spin you spin around"    nothing, and no explanation
 *
 * `looksLikeTrainingInstruction` returned true for the second, so it did not
 * even fall through as ordinary conversation cleanly -- the offline brain
 * answered a question about the word "around", and the trick was silently
 * never learned.
 *
 * The same alternation caused a second bug in a case that "worked":
 * "when i say showtime you spin then sit then play dead" split at the FIRST
 * "then", giving the cue "showtime you spin" and a two-beat routine out of
 * three.
 *
 * So the boundary is now found rather than demanded, in order of how explicit
 * the author was: quotes, then a comma, then the first split whose remainder
 * actually begins an action Barkly can perform. "then" is no longer a
 * top-level separator at all -- it is routine punctuation, which is what it
 * was doing wrong above.
 */
function splitTeaching(clean: string): { cue: string; instruction: string } | null {
  // Not anchored: "from now on, when I say X ..." is a real thing people type.
  const opener = clean.match(/(?:when|whenever|if)\s+i\s+say\s+(.+)$/i)
    ?? clean.match(/when\s+you\s+hear\s+(?:me\s+)?say\s+(.+)$/i);
  if (!opener) return null;
  const rest = opener[1].trim();

  // 1. Quotes are the author saying exactly where the cue ends.
  const quoted = rest.match(/^["“'](.{2,64}?)["”']\s*[,:]?\s*(.{2,280})$/);
  if (quoted) return { cue: quoted[1], instruction: actionPart(quoted[2].split(/\s+/)) };

  // 2. A comma is the same statement, less formally.
  const comma = rest.indexOf(',');
  if (comma > 1) {
    return {
      cue: rest.slice(0, comma),
      instruction: actionPart(rest.slice(comma + 1).trim().split(/\s+/)),
    };
  }

  // 3. No punctuation at all. Take the shortest cue whose remainder actually
  //    starts with something he can do; a split that leaves an unperformable
  //    remainder is not a split, it is a guess.
  const words = rest.split(/\s+/);
  for (let n = 1; n < Math.min(5, words.length); n += 1) {
    const instruction = actionPart(words.slice(n));
    if (instruction && ACTION_OPENER.test(instruction)) {
      return { cue: words.slice(0, n).join(' '), instruction };
    }
  }
  return null;
}

export function parseLocalTrainingInstruction(text: string): LearnedTrainingRule | null {
  const clean = sanitize(text, 420).trim();
  const split = splitTeaching(clean);
  if (!split) return null;

  const cue = sanitize(split.cue, 64).replace(/^[\s"'“”]+|[\s"'“”,.!?]+$/g, '').trim();
  const instruction = sanitize(split.instruction, 280).replace(/[.!?]+$/g, '').trim();
  if (normalizeCue(cue).length < 2 || !instruction) return null;

  const parts = splitRoutine(instruction);
  if (parts.length > 1) {
    if (parts.length > MAX_ROUTINE_BEATS) return null;
    const beats: RoutineBeat[] = [];
    for (const part of parts) {
      const performance = inferLocalPerformance(part);
      if (!performance) return null;
      beats.push(performance);
    }
    return {
      cue,
      instruction,
      speech: 'Showtime. You made me learn choreography.',
      reaction: 'excited',
      actions: beats[0].actions,
      routine: beats,
    };
  }

  const performance = inferLocalPerformance(instruction);
  if (!performance) return null;
  return { cue, instruction, ...performance };
}

function splitRoutine(instruction: string): string[] {
  // Explicit sequence words first; commas and a plain "and" are accepted only
  // when they actually produce multiple short representable beats downstream.
  const strong = instruction
    .split(/\s*(?:,?\s+and then\s+|,?\s+then\s+|,?\s+after that\s+|,?\s+followed by\s+)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
  if (strong.length > 1) {
    // A first clause like "spin, sit" can still contain comma-separated beats.
    return strong.flatMap((part) => part.split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean));
  }

  const comma = instruction.split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean);
  if (comma.length > 1) return comma;

  const plainAnd = instruction.split(/\s+and\s+/i).map((s) => s.trim()).filter(Boolean);
  return plainAnd.length > 1 ? plainAnd : [instruction];
}

/**
 * What he says when a "play dead" cue fires.
 *
 * A named export because THREE things have to be the same sentence: the rule
 * this file builds, the caption `ui/Onboarding` draws while he performs it,
 * and the recording the voice bank looks up. It was written out twice, and the
 * copy in the UI was invisible to the voice harvester -- so the payoff beat of
 * the whole meeting, the one where the word they invented makes a dog fall
 * over, came out of the browser's screen-reader.
 *
 * `scripts/voice-bank.mjs` scopes this file to specific names; this one is on
 * that list.
 */
export const PLAY_DEAD_LINE = 'I have tragically passed away.';

export function inferLocalPerformance(instruction: string): RoutineBeat | null {
  let reaction: ReactionState | undefined;
  let actions: BodyAction[] = [];
  let speech = 'Right. I remember this one.';

  if (/\b(?:play dead|pretend (?:you(?:'re| are)|to be) dead|lie down|go to sleep|fall asleep)\b/i.test(instruction)) {
    actions = ['SLEEP'];
    reaction = 'sleepy';
    speech = PLAY_DEAD_LINE;
  } else if (/\b(?:terrified|scared|afraid|panic|freak out)\b/i.test(instruction)) {
    actions = ['LOOK_LEFT', 'LOOK_RIGHT', 'EAR_PERK'];
    reaction = 'excited';
    speech = 'NOPE. Absolutely not. You deal with it.';
  } else if (/\b(?:spin|dance|zoom|run around|run in circles|jump|hop)\b/i.test(instruction)) {
    actions = ['EXCITED', 'TAIL_WAG'];
    reaction = 'excited';
    speech = 'This was your idea.';
  } else if (/\bwag\b/i.test(instruction)) {
    actions = ['TAIL_WAG'];
    reaction = 'happy';
    speech = 'Look at that. Trained.';
  } else if (/\b(?:tilt|cock)\b.*\bhead\b|\bhead tilt\b/i.test(instruction)) {
    actions = ['HEAD_TILT'];
    reaction = 'happy';
    speech = 'Like this?';
  } else if (/\blook left\b/i.test(instruction)) {
    actions = ['LOOK_LEFT'];
    speech = 'Left. Suspicious.';
  } else if (/\blook right\b/i.test(instruction)) {
    actions = ['LOOK_RIGHT'];
    speech = 'Right. Also suspicious.';
  } else if (/\b(?:perk|raise)\b.*\bears?\b/i.test(instruction)) {
    actions = ['EAR_PERK'];
    reaction = 'happy';
    speech = 'Ears online.';
  } else if (/\bblink\b/i.test(instruction)) {
    actions = ['BLINK'];
    speech = 'Blink. Nailed it.';
  } else if (/\bsit\b/i.test(instruction)) {
    actions = ['SIT'];
    speech = 'Fine. Sitting.';
  } else {
    return null;
  }

  return { speech, reaction, actions };
}

function hashCue(cue: string): string {
  let h = 2166136261;
  for (let i = 0; i < cue.length; i++) {
    h ^= cue.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function cleanRoutine(routine: RoutineBeat[] | undefined): RoutineBeat[] | undefined {
  if (!Array.isArray(routine) || routine.length < 2) return undefined;
  const cleaned = routine.slice(0, MAX_ROUTINE_BEATS).map((beat) => ({
    speech: sanitize(beat.speech, 140),
    reaction: beat.reaction,
    actions: Array.from(new Set(beat.actions ?? [])).slice(0, 4),
  })).filter((beat) => beat.speech && beat.actions.length > 0);
  return cleaned.length >= 2 ? cleaned : undefined;
}

function cleanCandidate(candidate: LearnedTrainingRule, now: number): TrainingRule | null {
  const cue = sanitize(candidate.cue, 64).replace(/^[\s"'“”]+|[\s"'“”]+$/g, '');
  const normalizedCue = normalizeCue(cue);
  const instruction = sanitize(candidate.instruction, 280);
  const speech = sanitize(candidate.speech, 220);
  if (normalizedCue.length < 2 || !instruction || !speech) return null;

  const routine = cleanRoutine(candidate.routine);
  return {
    id: `training-${hashCue(normalizedCue)}`,
    cue,
    normalizedCue,
    instruction,
    speech,
    reaction: candidate.reaction,
    actions: Array.from(new Set(candidate.actions)).slice(0, 4),
    routine,
    learnedAt: now,
    updatedAt: now,
    timesTriggered: 0,
  };
}

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
  return ` ${input} `.includes(` ${cue} `);
}

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
