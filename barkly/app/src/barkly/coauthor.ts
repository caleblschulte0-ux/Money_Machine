/**
 * Barkly co-authorship engine.
 *
 * Up to now the player authors Barkly: teaches cues, chooses places, creates
 * relationships. The product becomes stranger and more personal when Barkly
 * starts proposing canon back — naming a treasured object, claiming a place,
 * turning a repeated cue into a tradition, or giving a recurring dog a private
 * nickname. The player may accept or reject it. Either answer becomes history.
 *
 * This is not model improv stored as truth. Proposals are earned from durable
 * evidence and have stable ids, so Barkly cannot ask the same identity question
 * every session.
 */

import { CharacterState, bondFor } from './character';
import { deriveBarklyIdentity } from './identity';
import { MemoryState } from './memory';
import { BarklyStats } from './types';
import { sanitize } from './facts';

export type CanonKind = 'object-name' | 'territory' | 'signature' | 'dog-nickname';

export interface BarklyCanon {
  id: string;
  kind: CanonKind;
  subject: string;
  value: string;
  acceptedAt: number;
  line: string;
}

export interface CoauthorState {
  canon: BarklyCanon[];
  rejected: Record<string, number>;
  lastProposalAt: number;
}

export interface BarklyProposal {
  id: string;
  kind: CanonKind;
  subject: string;
  proposedValue: string;
  ask: string;
  acceptLine: string;
  rejectLine: string;
  priority: number;
}

interface ProposalContext {
  character: CharacterState;
  memory: MemoryState;
  stats: BarklyStats;
  state?: CoauthorState;
  now: number;
}

const HOUR = 3_600_000;
export const PROPOSAL_COOLDOWN_MS = 6 * HOUR;

export function freshCoauthorState(): CoauthorState {
  return { canon: [], rejected: {}, lastProposalAt: 0 };
}

const slug = (s: string) => sanitize(s, 80).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function alreadyAnswered(state: CoauthorState, id: string): boolean {
  return state.canon.some((entry) => entry.id === id) || state.rejected[id] !== undefined;
}

/*
 * Treasures are written as jokes, not as nouns: "a sock (previously owned)",
 * "a map? or trash? unclear", "someone's frisbee (finders keepers)". Naming
 * one used to title-case the whole joke and cut it at 32 characters, so 20 of
 * the 24 treasures in the game produced things like "The A Sock (Previously
 * Owned)" and "The Someone'S Frisbee (Finders Keep…" -- mid-word, with the
 * ellipsis, in the one beat where Barkly is the author. A name he made up has
 * to read like a name.
 */
const ARTICLE = /^(?:an?|the|one|half|exactly|piece of|length of)\s+/i;
/** Never capitalised mid-name: "The Piece of Sea Glass", not "Piece Of". */
const SMALL_WORDS = new Set(['a', 'an', 'the', 'of', 'and', 'that', 'with']);

function treasureCore(name: string): string {
  let core = sanitize(name, 80)
    // The aside is the joke, not the thing: "(previously owned)".
    .replace(/\s*\([^)]*\)/g, '')
    // Everything after the first break is commentary: ", allegedly".
    .split(/[?,;]/)[0]
    // ...as is everything after a relative clause: "that lost its person".
    .replace(/\s+(?:that|which|with|shaped like)\s+.*$/i, '')
    .trim();
  // "exactly one flip-flop" needs two passes, "a piece of sea glass" needs one.
  for (let i = 0; i < 3; i += 1) core = core.replace(ARTICLE, '').trim();
  return core;
}

function titleCase(core: string): string {
  return core
    .split(/\s+/)
    .map((word, i) =>
      i > 0 && SMALL_WORDS.has(word.toLowerCase())
        ? word.toLowerCase()
        // The boundary is the start of the word or a hyphen, so "flip-flop"
        // becomes "Flip-Flop" and "someone's" does not become "Someone'S".
        : word.replace(/(^|-)([a-z])/g, (_m, edge, c) => edge + c.toUpperCase()),
    )
    .join(' ');
}

function treasureNickname(name: string): string {
  const core = treasureCore(name);
  const lower = core.toLowerCase();
  if (lower.includes('rock')) return 'The Good Rock';
  if (lower.includes('stick')) return 'Executive Stick';
  if (lower.includes('duck')) return 'The Duck';
  if (lower.includes('ball')) return 'The Orb';
  return core ? `The ${titleCase(core)}` : 'The Artifact';
}

function dogNickname(name: string, rival: boolean): string {
  const clean = sanitize(name, 32);
  if (rival) return `${clean} the Problem`;
  return `Cousin ${clean}`;
}

function candidates(ctx: ProposalContext): BarklyProposal[] {
  const state = ctx.state ?? freshCoauthorState();
  const identity = deriveBarklyIdentity({ memory: ctx.memory, character: ctx.character, stats: ctx.stats });
  const out: BarklyProposal[] = [];
  const treasure = ctx.character.favoriteTreasure;

  if (treasure) {
    const affinity = Object.entries(ctx.character.treasureAffinities ?? {})
      .find(([name]) => name.toLowerCase() === treasure.toLowerCase())?.[1];
    if ((affinity?.score ?? 0) >= 5) {
      const id = `name-treasure-${slug(treasure)}`;
      const proposedValue = treasureNickname(treasure);
      if (!alreadyAnswered(state, id)) out.push({
        id, kind: 'object-name', subject: treasure, proposedValue, priority: 90,
        ask: `Okay, ${sanitize(treasure, 60)} has been here long enough. I think its real name is “${proposedValue}.” Are we making that official?`,
        // The name is NOT repeated here on purpose. Interpolating it made the
        // line unrecordable, so the moment Barkly finally gets to name
        // something came back in the browser's narrator -- and the player just
        // tapped a button with the name printed on it, so he is not telling
        // them anything they cannot see. A recorded voice beats a redundant
        // one. Same for the nickname line below.
        acceptLine: `Good. That's the real name. Put it in the records.`,
        rejectLine: `Fine. Terrible branding decision, but fine.`,
      });
    }
  }

  const favoritePlace = identity.preferences.find((p) => p.kind === 'place' && p.strength >= 55);
  if (favoritePlace) {
    const id = `claim-${slug(favoritePlace.subject)}`;
    if (!alreadyAnswered(state, id)) out.push({
      id, kind: 'territory', subject: favoritePlace.subject, proposedValue: 'Barkly territory', priority: 70,
      ask: `We go to ${favoritePlace.subject} constantly. I think part of it is mine now. Can we agree on that?`,
      acceptLine: 'Correct. I will notify absolutely nobody with authority.',
      rejectLine: 'Property law remains my greatest enemy.',
    });
  }

  const ritual = [...ctx.memory.trainingRules]
    .filter((rule) => rule.timesTriggered >= 8)
    .sort((a, b) => b.timesTriggered - a.timesTriggered)[0];
  if (ritual) {
    const id = `signature-${ritual.id}`;
    if (!alreadyAnswered(state, id)) out.push({
      id, kind: 'signature', subject: ritual.cue, proposedValue: `Barkly's “${sanitize(ritual.cue, 44)}”`, priority: 82,
      ask: `We have done “${sanitize(ritual.cue, 50)}” ${ritual.timesTriggered} times. That is not training anymore. That's our thing. Official?`,
      acceptLine: 'Knew it. Tradition established.',
      // Never name a count here: the ask above quotes the real number, and this
      // line was hard-coded to "Eight" while the ask said nine.
      rejectLine: 'Wow. All that service and no recognition. Brutal workplace.',
    });
  }

  for (const name of ['Biscuit', 'Duke', 'Pepper']) {
    const bond = bondFor(ctx.character, name);
    if (!bond || bond.encounters < 6) continue;
    const id = `nickname-${slug(name)}-${bond.kind}`;
    if (alreadyAnswered(state, id)) continue;
    const proposedValue = dogNickname(name, bond.kind === 'rival');
    out.push({
      id, kind: 'dog-nickname', subject: name, proposedValue, priority: 60 + Math.min(20, bond.encounters),
      ask: bond.kind === 'rival'
        ? `I have decided ${name}'s full legal name is “${proposedValue}.” Objections?`
        : `${name} is around enough that I think “${proposedValue}” is fair. We using it?`,
      acceptLine: `Excellent. That's the official name now. They'll adjust.`,
      rejectLine: 'Rejected by committee. I will workshop it privately.',
    });
  }
  return out;
}

/** One earned proposal at a time. Silence is a feature; Barkly should not constantly ask for canon votes. */
export function deriveBarklyProposal(ctx: ProposalContext): BarklyProposal | null {
  const state = ctx.state ?? freshCoauthorState();
  if (state.lastProposalAt > 0 && ctx.now - state.lastProposalAt < PROPOSAL_COOLDOWN_MS) return null;
  return candidates(ctx).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))[0] ?? null;
}

export function resolveBarklyProposal(
  state: CoauthorState,
  proposal: BarklyProposal,
  accepted: boolean,
  now: number,
): { state: CoauthorState; line: string; canon?: BarklyCanon } {
  if (alreadyAnswered(state, proposal.id)) {
    return { state, line: accepted ? proposal.acceptLine : proposal.rejectLine };
  }
  if (!accepted) {
    return {
      state: { ...state, rejected: { ...state.rejected, [proposal.id]: now }, lastProposalAt: now },
      line: proposal.rejectLine,
    };
  }
  const canon: BarklyCanon = {
    id: proposal.id,
    kind: proposal.kind,
    subject: proposal.subject,
    value: proposal.proposedValue,
    acceptedAt: now,
    line: proposal.acceptLine,
  };
  return {
    state: { ...state, canon: [canon, ...state.canon].slice(0, 24), lastProposalAt: now },
    line: proposal.acceptLine,
    canon,
  };
}

export function coauthorPromptTexture(state: CoauthorState): string[] {
  if (state.canon.length === 0) return [];
  return [
    `Things you proposed and your person accepted as shared canon: ${state.canon.slice(0, 8).map((c) => `${c.subject} => ${c.value}`).join('; ')}.`,
    'These are private relationship language. Use them naturally and consistently; never explain that they came from a feature.',
  ];
}
