/**
 * Barkly's character engine — the layer that makes him a specific dog rather
 * than a prompt.
 *
 * CONTINUITY is durable here. Barkly does not merely know that Biscuit exists:
 * repeated encounters can turn Biscuit into a best friend. Duke can graduate
 * from irritating dog to actual nemesis. Treasure hunting becomes part of who
 * this Barkly is. Two users therefore grow measurably different Barklys.
 *
 * INITIATIVE lives here too: he starts conversations from his drives, memory
 * and accumulated lore instead of behaving like a chatbot waiting for input.
 */

import { applyContact, ContactOptions, Promotion, rungAt } from './escalation';
import { Experience, Fact } from './facts';
import { BarklySnapshot } from './types';

export interface SocialBond {
  kind: 'friend' | 'rival';
  encounters: number;
  firstSeenAt: number;
  lastSeenAt: number;
}

export interface SocialStage {
  label: string;
  blurb: string;
}

export interface CharacterState {
  /** Treasure he is currently proudest of. */
  favoriteTreasure?: string;
  /** Total discoveries: treasure hunting becomes a character trait over time. */
  treasuresFound?: number;
  /** A thing he cannot stop thinking about right now, and when it started. */
  obsession?: { topic: string; since: number };
  /** His current beef with a rival. */
  grievance?: { who: string; what: string; since: number };
  /** Which friend he currently prefers. */
  favoriteFriend?: string;
  /** Durable relationship history with recurring dogs. */
  socialBonds?: Record<string, SocialBond>;
  /** How many authored choice moments have resolved with each recurring dog. */
  socialChoices?: Record<string, number>;
  /** Cooldown bookkeeping so he initiates without nagging. */
  lastInitiativeAt: number;
  /** Kinds he has recently used, newest first — avoids repeating himself. */
  recentInitiatives: string[];
}

export function freshCharacter(): CharacterState {
  return {
    treasuresFound: 0,
    socialBonds: {},
    socialChoices: {},
    lastInitiativeAt: 0,
    recentInitiatives: [],
  };
}

/** Obsessions are temporary by nature; relationship history is not. */
const OBSESSION_TTL_MS = 3 * 86_400_000;
const GRIEVANCE_TTL_MS = 5 * 86_400_000;

export function expireCharacter(c: CharacterState, now: number): CharacterState {
  const out: CharacterState = {
    ...c,
    treasuresFound: c.treasuresFound ?? 0,
    socialBonds: c.socialBonds ?? {},
    socialChoices: c.socialChoices ?? {},
    recentInitiatives: c.recentInitiatives ?? [],
    lastInitiativeAt: c.lastInitiativeAt ?? 0,
  };
  if (out.obsession && now - out.obsession.since > OBSESSION_TTL_MS) delete out.obsession;
  if (out.grievance && now - out.grievance.since > GRIEVANCE_TTL_MS) delete out.grievance;
  return out;
}

/**
 * The two ladders live in ./escalation, which owns the thresholds, the
 * promotion moments and the rule that casual taps cannot promote anybody.
 * These stay as the names the rest of the app already calls.
 */
export function friendshipStage(encounters: number): SocialStage {
  return rungAt('friend', encounters);
}

export function rivalryStage(encounters: number): SocialStage {
  return rungAt('rival', encounters);
}

/**
 * Bond lookups are CASE-INSENSITIVE, through these helpers and nowhere else.
 *
 * The bug this closes was found on the "Duke Nemesis" saved life: presets
 * store bonds under the NPC id ('duke'), while the running app writes and
 * reads them under the display name ('Duke'). Every direct
 * `socialBonds?.[npc.name]` lookup therefore saw ZERO encounters on a loaded
 * save — so a dog with 18 recorded incidents got the stranger dialogue, the
 * choice-moment gate never opened, and weeks of history sat in the Pack Book
 * driving nothing. Matching by key text instead of key identity means both
 * spellings of the same dog are the same dog.
 */
const sameDog = (a: string, b: string): boolean =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

export function bondFor(c: CharacterState, who: string): SocialBond | undefined {
  const bonds = c.socialBonds ?? {};
  const key = Object.keys(bonds).find((k) => sameDog(k, who));
  return key === undefined ? undefined : bonds[key];
}

export function bondEncounters(c: CharacterState, who: string): number {
  return bondFor(c, who)?.encounters ?? 0;
}

export function choicesFor(c: CharacterState, who: string): number {
  const choices = c.socialChoices ?? {};
  const key = Object.keys(choices).find((k) => sameDog(k, who));
  return key === undefined ? 0 : choices[key];
}

function socialCount(c: CharacterState, who: string): number {
  return bondEncounters(c, who);
}

// ------------------------------------------------------------- initiative

export type InitiativeKind =
  | 'promise'
  | 'hungry'
  | 'treasure'
  | 'friend'
  | 'grievance'
  | 'callback'
  | 'tired'
  | 'affection';

export interface Initiative {
  kind: InitiativeKind;
  line: string;
  priority: number;
}

export interface InitiativeContext {
  snapshot: BarklySnapshot;
  facts: Fact[];
  experiences: Experience[];
  openThreads: string[];
  character: CharacterState;
  location: string;
  npcsPresent: string[];
  now: number;
  rng?: () => number;
}

/** Minimum gap between unprompted lines. He is a dog, not a notification. */
export const INITIATIVE_COOLDOWN_MS = 100_000;

function personName(facts: Fact[]): string | undefined {
  return facts.find((f) => f.subject === 'person' && f.key === 'name')?.value;
}

export function pickInitiative(ctx: InitiativeContext): Initiative | null {
  const { snapshot, facts, experiences, character, now } = ctx;
  const rng = ctx.rng ?? Math.random;

  if (now - character.lastInitiativeAt < INITIATIVE_COOLDOWN_MS) return null;

  const name = personName(facts);
  const you = name ? `${name}` : 'hey';
  const candidates: Initiative[] = [];

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

  if (snapshot.stats.hunger > 78) {
    candidates.push({
      kind: 'hungry',
      priority: 90,
      line: rng() < 0.5 ? "I'm hungry. This is your problem now." : `${you}. Food situation. Thoughts?`,
    });
  }
  if (snapshot.stats.energy < 18) {
    candidates.push({ kind: 'tired', priority: 70, line: 'No. Nap. I have made my decision.' });
  }

  if (character.favoriteTreasure) {
    const found = character.treasuresFound ?? 1;
    candidates.push({
      kind: 'treasure',
      priority: found >= 5 ? 68 : 60,
      line:
        found >= 5
          ? `We have found ${found} treasures now. That's a collection. I don't care what you say.`
          : `I've been thinking about ${character.favoriteTreasure}. Still the best thing I own.`,
    });
  }

  if (character.grievance) {
    const count = socialCount(character, character.grievance.who);
    const stage = rivalryStage(count);
    candidates.push({
      kind: 'grievance',
      priority: count >= 3 ? 74 : 65,
      line:
        count >= 3
          ? `${character.grievance.who} is now my ${stage.label}. Their choices led us here.`
          : `${character.grievance.who} ${character.grievance.what}. I'm not over it.`,
    });
  }

  if (ctx.npcsPresent.length > 0 && rng() < 0.5) {
    const present = ctx.npcsPresent
      .map((who) => ({ who, bond: bondFor(character, who) }))
      .sort((a, b) => (b.bond?.encounters ?? 0) - (a.bond?.encounters ?? 0))[0];
    const count = present.bond?.encounters ?? 0;
    candidates.push({
      kind: 'friend',
      priority: count >= 3 ? 58 : 50,
      line:
        present.bond?.kind === 'friend' && count >= 3
          ? `${present.who} is here. That's my ${friendshipStage(count).label}, so obviously we have business.`
          : `${present.who} is right there. Should I say something? I'm going to say something.`,
    });
  }

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

  if (snapshot.stats.affection > 70 && candidates.length === 0 && rng() < 0.35) {
    candidates.push({
      kind: 'affection',
      priority: 20,
      line: name ? `${name}. Nothing. Just checking you're still there.` : "Just checking you're still there.",
    });
  }

  if (candidates.length === 0) return null;
  const fresh = candidates.filter((candidate) => !character.recentInitiatives.slice(0, 2).includes(candidate.kind));
  const pool = fresh.length > 0 ? fresh : candidates;
  pool.sort((a, b) => b.priority - a.priority);
  return pool[0];
}

export function noteInitiative(
  c: CharacterState,
  kind: InitiativeKind,
  now: number,
): CharacterState {
  return {
    ...c,
    lastInitiativeAt: now,
    recentInitiatives: [kind, ...(c.recentInitiatives ?? [])].slice(0, 4),
  };
}

// -------------------------------------------------------- character drift

export function withTreasure(c: CharacterState, treasureName: string, now: number): CharacterState {
  return {
    ...c,
    treasuresFound: (c.treasuresFound ?? 0) + 1,
    favoriteTreasure: treasureName,
    obsession: { topic: treasureName, since: now },
  };
}

/**
 * Choice-driven encounters can strengthen OR cool a relationship. This is the
 * difference between a history counter and player agency: escalating Duke is
 * a choice, not an inevitability. Negative deltas never erase first-seen history.
 */
export interface ContactOutcome {
  character: CharacterState;
  /** Set only when this contact crossed a rung. The UI announces it. */
  promotion: Promotion | null;
  /** True when a casual tap was held one short of the next rung. */
  held: boolean;
}

/**
 * One contact with a recurring dog, applied through the escalation ladder.
 *
 * `promotes: false` is a casual tap: it builds pressure and stops at the edge
 * of the next rung. `promotes: true` is something the player played through —
 * an encounter choice, a settled duel — and is the only thing that can move
 * a relationship to a new stage. See ./escalation for why.
 */
export function contactSocialBond(
  c: CharacterState,
  who: string,
  kind: SocialBond['kind'],
  opts: ContactOptions,
  now: number,
): ContactOutcome {
  const bonds = { ...(c.socialBonds ?? {}) };
  // Reuse whatever spelling the bond is already stored under ('duke' from a
  // preset, 'Duke' from live play) — writing under a second casing would fork
  // one relationship into two half-histories.
  const existingKey = Object.keys(bonds).find((k) => sameDog(k, who)) ?? who;
  const previous = bonds[existingKey];
  const result = applyContact(who, kind, previous?.encounters ?? 0, opts);
  bonds[existingKey] = {
    kind,
    encounters: result.encounters,
    firstSeenAt: previous?.firstSeenAt ?? now,
    lastSeenAt: now,
  };
  return {
    character: { ...c, socialBonds: bonds },
    promotion: result.promotion,
    held: result.held,
  };
}

export function adjustSocialBond(
  c: CharacterState,
  who: string,
  kind: SocialBond['kind'],
  delta: number,
  now: number,
): CharacterState {
  return contactSocialBond(c, who, kind, { promotes: true, delta }, now).character;
}

/** Mark one authored choice chapter complete so it cannot immediately repeat. */
export function noteSocialChoice(c: CharacterState, who: string): CharacterState {
  const choices = { ...(c.socialChoices ?? {}) };
  // Same casing rule as bonds: continue the count under its existing key.
  const key = Object.keys(choices).find((k) => sameDog(k, who)) ?? who;
  return {
    ...c,
    socialChoices: { ...choices, [key]: (choices[key] ?? 0) + 1 },
  };
}

/**
 * A casual run-in. Deliberately NON-promoting: tapping a dog over and over
 * must never manufacture a nemesis on its own. It walks the relationship up
 * to the edge of the next rung, where the encounter system takes over.
 */
function recordSocial(
  c: CharacterState,
  who: string,
  kind: SocialBond['kind'],
  now: number,
): Record<string, SocialBond> {
  return contactSocialBond(c, who, kind, { promotes: false, delta: 1 }, now).character.socialBonds ?? {};
}

export function withGrievance(
  c: CharacterState,
  who: string,
  what: string,
  now: number,
): CharacterState {
  return {
    ...c,
    grievance: { who, what, since: now },
    socialBonds: recordSocial(c, who, 'rival', now),
  };
}

export function withFriend(c: CharacterState, who: string, now: number): CharacterState {
  return {
    ...c,
    favoriteFriend: who,
    socialBonds: recordSocial(c, who, 'friend', now),
  };
}

/**
 * Prompt texture for who this Barkly has become. Relationship labels are not
 * game badges; they are continuity anchors the model can naturally reference.
 */
export function describeCharacter(c: CharacterState): string {
  const bits: string[] = [];
  if (c.favoriteTreasure) bits.push(`your current favorite possession is ${c.favoriteTreasure}`);
  if ((c.treasuresFound ?? 0) >= 4) bits.push(`you have become a serious treasure collector after ${c.treasuresFound} finds`);
  if (c.obsession) bits.push(`you are a bit obsessed with ${c.obsession.topic} right now`);
  if (c.grievance) {
    const count = socialCount(c, c.grievance.who);
    bits.push(
      count >= 3
        ? `${c.grievance.who} has become your ${rivalryStage(count).label} after ${count} incidents`
        : `you have a running grievance: ${c.grievance.who} ${c.grievance.what}`,
    );
  }
  if (c.favoriteFriend) {
    const count = socialCount(c, c.favoriteFriend);
    bits.push(
      count >= 3
        ? `${c.favoriteFriend} is your ${friendshipStage(count).label} after ${count} hangouts`
        : `your favorite dog to see lately is ${c.favoriteFriend}`,
    );
  }
  if (bits.length === 0) return '';
  return `Right now, specifically: ${bits.join('; ')}.`;
}
