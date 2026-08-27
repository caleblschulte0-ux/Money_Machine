/**
 * Barkly's character engine — the layer that makes him a specific dog rather
 * than a prompt.
 *
 * Two jobs:
 *
 * 1. CONTINUITY. Persistent character state that drifts on its own: a current
 *    favorite treasure, a temporary obsession, a grievance against Duke, a
 *    preferred friend. Two users' Barklys diverge over time because these are
 *    seeded by what actually happened to each of them.
 *
 * 2. INITIATIVE. He cannot feel alive if the user is always the one pressing
 *    buttons. `pickInitiative()` decides when Barkly should speak first and
 *    about what, derived from his drives, his memory and where he is — never
 *    from a random popup table.
 *
 * Pure and platform-agnostic: no storage, no React, clock passed in. The hook
 * owns persistence and the speaking.
 */

import { Experience, Fact } from './facts';
import { BarklySnapshot } from './types';

export interface CharacterState {
  /** Treasure id he is currently proudest of. */
  favoriteTreasure?: string;
  /** A thing he cannot stop thinking about right now, and when it started. */
  obsession?: { topic: string; since: number };
  /** His current beef with the rival. */
  grievance?: { who: string; what: string; since: number };
  /** Which friend he currently prefers. */
  favoriteFriend?: string;
  /** Cooldown bookkeeping so he initiates without nagging. */
  lastInitiativeAt: number;
  /** Kinds he has recently used, newest first — avoids repeating himself. */
  recentInitiatives: string[];
}

export function freshCharacter(): CharacterState {
  return { lastInitiativeAt: 0, recentInitiatives: [] };
}

/** Obsessions are temporary by nature. */
const OBSESSION_TTL_MS = 3 * 86_400_000; // three days
const GRIEVANCE_TTL_MS = 5 * 86_400_000;

/** Drop anything that has naturally run its course. */
export function expireCharacter(c: CharacterState, now: number): CharacterState {
  const out: CharacterState = { ...c };
  if (out.obsession && now - out.obsession.since > OBSESSION_TTL_MS) delete out.obsession;
  if (out.grievance && now - out.grievance.since > GRIEVANCE_TTL_MS) delete out.grievance;
  return out;
}

// ------------------------------------------------------------- initiative

export type InitiativeKind =
  | 'promise'      // "You said we'd play yesterday."
  | 'hungry'       // "I'm hungry."
  | 'treasure'     // "I found something."
  | 'friend'       // "Biscuit was here earlier."
  | 'grievance'    // "Duke said something stupid again."
  | 'callback'     // "Do you still like that blue car you told me about?"
  | 'tired'        // "No. Nap."
  | 'affection';   // he just wants you

export interface Initiative {
  kind: InitiativeKind;
  /** What he says, already in his voice. */
  line: string;
  /** Higher wins when several fire at once. */
  priority: number;
}

export interface InitiativeContext {
  snapshot: BarklySnapshot;
  facts: Fact[];
  experiences: Experience[];
  openThreads: string[];
  character: CharacterState;
  location: string;
  /** Names of dogs present. */
  npcsPresent: string[];
  now: number;
  /** Deterministic in tests; Math.random in the app. */
  rng?: () => number;
}

/** Minimum gap between unprompted lines. He is a dog, not a notification. */
export const INITIATIVE_COOLDOWN_MS = 100_000;

function personName(facts: Fact[]): string | undefined {
  return facts.find((f) => f.subject === 'person' && f.key === 'name')?.value;
}

/**
 * Decide whether Barkly should say something unprompted, and what.
 * Returns null far more often than not — restraint is the whole point.
 */
export function pickInitiative(ctx: InitiativeContext): Initiative | null {
  const { snapshot, facts, experiences, character, now } = ctx;
  const rng = ctx.rng ?? Math.random;

  // Never interrupt, never nag.
  if (now - character.lastInitiativeAt < INITIATIVE_COOLDOWN_MS) return null;

  const name = personName(facts);
  const you = name ? `${name}` : 'hey';
  const candidates: Initiative[] = [];

  // A promise he is still owed is the strongest thing he can raise.
  const PROMISE_RE = /\b(?:promis\w*|i(?:'ll| will)|we(?:'ll| will| would)|tomorrow|later)\b/i;
  const promise = experiences.find((e) => PROMISE_RE.test(e.what));
  if (promise) {
    const days = Math.floor((now - promise.at) / 86_400_000);
    candidates.push({
      kind: 'promise',
      priority: 100,
      line:
        days >= 1
          ? `${name ? name + '. ' : ''}You said we'd play. That was ${days === 1 ? 'yesterday' : days + ' days ago'}. I remember things, dude.`
          : `You said something earlier about playing. I'm just leaving that there.`,
    });
  }

  // Physical needs come next — they are honest and specific.
  if (snapshot.stats.hunger > 78) {
    candidates.push({
      kind: 'hungry',
      priority: 90,
      line: rng() < 0.5 ? "I'm hungry. This is your problem now." : `${you}. Food situation. Thoughts?`,
    });
  }
  if (snapshot.stats.energy < 18) {
    candidates.push({
      kind: 'tired',
      priority: 70,
      line: 'No. Nap. I have made my decision.',
    });
  }

  // Things he owns and cares about.
  if (character.favoriteTreasure) {
    candidates.push({
      kind: 'treasure',
      priority: 60,
      line: `I've been thinking about ${character.favoriteTreasure}. Still the best thing I own.`,
    });
  }

  // The social world.
  if (character.grievance) {
    candidates.push({
      kind: 'grievance',
      priority: 65,
      line: `${character.grievance.who} ${character.grievance.what}. I'm not over it.`,
    });
  }
  if (ctx.npcsPresent.length > 0 && rng() < 0.5) {
    candidates.push({
      kind: 'friend',
      priority: 50,
      line: `${ctx.npcsPresent[0]} is right there. Should I say something? I'm going to say something.`,
    });
  }

  // Callbacks to things he was told — the "he remembers me" moment.
  const preference = facts.find(
    (f) => f.category === 'preference' && now - f.updatedAt > 6 * 3_600_000,
  );
  if (preference) {
    candidates.push({
      kind: 'callback',
      priority: 80,
      line: `Do you still like ${preference.value}? You told me about it. I kept it.`,
    });
  }

  // Pure attachment, when the bond is strong and nothing else is pressing.
  if (snapshot.stats.affection > 70 && candidates.length === 0 && rng() < 0.35) {
    candidates.push({
      kind: 'affection',
      priority: 20,
      line: name ? `${name}. Nothing. Just checking you're still there.` : "Just checking you're still there.",
    });
  }

  if (candidates.length === 0) return null;

  // Prefer high priority, but avoid repeating a kind he just used.
  const fresh = candidates.filter((c) => !character.recentInitiatives.slice(0, 2).includes(c.kind));
  const pool = fresh.length > 0 ? fresh : candidates;
  pool.sort((a, b) => b.priority - a.priority);
  return pool[0];
}

/** Record that he took the initiative, for cooldown and repetition control. */
export function noteInitiative(
  c: CharacterState,
  kind: InitiativeKind,
  now: number,
): CharacterState {
  return {
    ...c,
    lastInitiativeAt: now,
    recentInitiatives: [kind, ...c.recentInitiatives].slice(0, 4),
  };
}

// -------------------------------------------------------- character drift

/** A new treasure becomes his favorite — dogs are like that. */
export function withTreasure(c: CharacterState, treasureName: string, now: number): CharacterState {
  return {
    ...c,
    favoriteTreasure: treasureName,
    obsession: { topic: treasureName, since: now },
  };
}

/** A rival encounter leaves a grievance he will bring up later. */
export function withGrievance(
  c: CharacterState,
  who: string,
  what: string,
  now: number,
): CharacterState {
  return { ...c, grievance: { who, what, since: now } };
}

/** Time with a friend shifts who he prefers. */
export function withFriend(c: CharacterState, who: string): CharacterState {
  return { ...c, favoriteFriend: who };
}

/**
 * One line describing who Barkly currently is, for the system prompt. This is
 * what stops the model inventing a fresh personality every turn.
 */
export function describeCharacter(c: CharacterState): string {
  const bits: string[] = [];
  if (c.favoriteTreasure) bits.push(`your current favorite possession is ${c.favoriteTreasure}`);
  if (c.obsession) bits.push(`you are a bit obsessed with ${c.obsession.topic} right now`);
  if (c.grievance) bits.push(`you have a running grievance: ${c.grievance.who} ${c.grievance.what}`);
  if (c.favoriteFriend) bits.push(`your favorite dog to see lately is ${c.favoriteFriend}`);
  if (bits.length === 0) return '';
  return `Right now, specifically: ${bits.join('; ')}.`;
}
