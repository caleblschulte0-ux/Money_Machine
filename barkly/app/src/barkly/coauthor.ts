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

function treasureNickname(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('rock')) return 'The Good Rock';
  if (lower.includes('stick')) return 'Executive Stick';
  if (lower.includes('duck')) return 'The Duck';
  if (lower.includes('ball')) return 'The Orb';
  return `The ${sanitize(name, 32).replace(/\b\w/g, (m) => m.toUpperCase())}`;
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
        acceptLine: `Good. ${proposedValue}. Put it in the records.`,
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
      rejectLine: 'Wow. Eight performances and no tenure. Brutal workplace.',
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
      acceptLine: `Excellent. ${proposedValue} it is.`,
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
