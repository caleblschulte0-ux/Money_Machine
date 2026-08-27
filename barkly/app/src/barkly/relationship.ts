/**
 * Relationship DNA — a readable identity derived from what this person and
 * this Barkly have actually done together. Nothing here is randomly assigned.
 */

import { CharacterState, friendshipStage, rivalryStage } from './character';
import { sanitize } from './facts';
import { MemoryState } from './memory';
import { BarklyStats } from './types';

export type BondTraitId = 'confidant' | 'trainer' | 'adventurer' | 'collector' | 'socialite' | 'velcro';

export interface BondTrait {
  id: BondTraitId;
  label: string;
  score: number;
  detail: string;
}

export interface BondStage {
  level: 1 | 2 | 3 | 4 | 5;
  label: string;
  blurb: string;
  score: number;
  progress: number;
  nextAt?: number;
}

export interface RelationshipRitual {
  id: string;
  title: string;
  cue: string;
  detail: string;
  times: number;
  signature: boolean;
}

export interface RelationshipLore {
  id: string;
  title: string;
  detail: string;
  kind: 'friendship' | 'rivalry' | 'treasure' | 'obsession';
  strength: number;
}

export interface CoreMemory {
  id: string;
  what: string;
  where?: string;
  weight: number;
}

export interface RelationshipProfile {
  stage: BondStage;
  archetype: string;
  tagline: string;
  traits: BondTrait[];
  rituals: RelationshipRitual[];
  coreMemories: CoreMemory[];
  lore: RelationshipLore[];
}

interface RelationshipInput {
  memory: MemoryState;
  stats: BarklyStats;
  stashCount?: number;
  character?: CharacterState;
}

const STAGES: Array<Omit<BondStage, 'score' | 'progress' | 'nextAt'> & { at: number }> = [
  { at: 0, level: 1, label: 'Just Met', blurb: 'He knows the room. He is still figuring you out.' },
  { at: 24, level: 2, label: 'Buddies', blurb: 'You have history now. He has started keeping receipts.' },
  { at: 58, level: 3, label: 'Packmates', blurb: 'This is officially a two-creature operation.' },
  { at: 105, level: 4, label: 'Best Friends', blurb: 'He has opinions about your life because apparently he lives here too.' },
  { at: 175, level: 5, label: 'Basically Family', blurb: 'At this point you share lore, rituals and a concerning amount of history.' },
];

/** A trait must earn this much evidence before Barkly gets labeled with it. */
export const TRAIT_EMERGENCE_SCORE = 20;

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function socialEncounters(character?: CharacterState): number {
  return Object.values(character?.socialBonds ?? {}).reduce((sum, bond) => sum + bond.encounters, 0);
}

function makeStage(score: number): BondStage {
  let index = 0;
  for (let i = 1; i < STAGES.length; i++) if (score >= STAGES[i].at) index = i;
  const current = STAGES[index];
  const next = STAGES[index + 1];
  const progress = next ? Math.max(0, Math.min(1, (score - current.at) / (next.at - current.at))) : 1;
  return { level: current.level, label: current.label, blurb: current.blurb, score, progress, nextAt: next?.at };
}

function allTraitScores(input: RelationshipInput): BondTrait[] {
  const { memory, stats, character } = input;
  const stash = input.stashCount ?? 0;
  const triggers = memory.trainingRules.reduce((sum, rule) => sum + rule.timesTriggered, 0);
  const social = socialEncounters(character);
  const treasures = character?.treasuresFound ?? stash;

  return [
    {
      id: 'confidant' as const,
      label: 'Knows your lore',
      score: clamp(memory.facts.length * 7 + memory.experiences.length * 5 + Math.min(memory.turns.length, 12) * 2 + memory.openThreads.length * 5),
      detail: 'Built by talking, remembering people, promises, favorites and unfinished stories.',
    },
    {
      id: 'trainer' as const,
      label: 'Actually trained',
      score: clamp(memory.trainingRules.length * 20 + triggers * 5),
      detail: 'Built by teaching Barkly your own cues and turning them into running bits.',
    },
    {
      id: 'adventurer' as const,
      label: 'Adventure-brained',
      score: clamp(stash * 10 + treasures * 5 + memory.experiences.filter((e) => Boolean(e.where)).length * 3),
      detail: 'Built by going places, digging things up and making memories outside the living room.',
    },
    {
      id: 'collector' as const,
      label: 'Treasure goblin',
      score: clamp(stash * 15 + (character?.favoriteTreasure ? 18 : 0)),
      detail: 'Built by treating random dirt objects as priceless artifacts.',
    },
    {
      id: 'socialite' as const,
      label: 'Dog-park politician',
      score: clamp(social * 11 + (character?.favoriteFriend ? 12 : 0) + (character?.grievance ? 8 : 0)),
      detail: 'Built by friendships, gossip, rivalries and repeatedly going back to the same dogs.',
    },
    {
      id: 'velcro' as const,
      label: 'Velcro dog',
      score: clamp(Math.max(0, stats.affection - 45) * 1.7 + memory.experiences.length * 2),
      detail: 'Built by showing up enough that Barkly has decided personal space is mostly theoretical.',
    },
  ].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

const ARCHETYPES: Record<string, [string, string]> = {
  'confidant+trainer': ['Coach & Confidant', 'You taught him tricks. He learned your business too.'],
  'adventurer+trainer': ['Adventure Academy', 'Part best friend, part field exercise, zero adult supervision.'],
  'collector+trainer': ['Treasure School', 'You have trained a dog who now believes junk has provenance.'],
  'socialite+trainer': ['Certified Menaces', 'He has commands, friends, enemies and absolutely no discretion.'],
  'trainer+velcro': ['Velcro Apprentice', 'He follows directions mostly because the directions came from you.'],
  'adventurer+confidant': ['Road-Dog Duo', 'He knows your lore and would still rather hear it outside.'],
  'collector+confidant': ['Lore Hoarders', 'Facts, rocks, promises — apparently all of it belongs in the collection.'],
  'confidant+socialite': ['Neighborhood Gossips', 'Your life, the dog park, everybody else’s nonsense: all remembered.'],
  'confidant+velcro': ['Two-Person Pack', 'He knows too much about you to pretend this is casual anymore.'],
  'adventurer+collector': ['Dirt-Digging Legends', 'The world is large and most of it probably contains something to steal.'],
  'adventurer+socialite': ['Park Regulars', 'You go places and somehow acquire recurring characters everywhere.'],
  'adventurer+velcro': ['Shadow Explorer', 'Wherever you go, apparently he goes too.'],
  'collector+socialite': ['Local Eccentrics', 'Known around town. Frequently carrying something found in dirt.'],
  'collector+velcro': ['Possessive Weirdos', 'He keeps his treasures close and you closer.'],
  'socialite+velcro': ['Everybody Knows Us', 'He is attached to you and somehow also has a whole social calendar.'],
};

function archetypeFor(traits: BondTrait[]): [string, string] {
  const top = traits.slice(0, 2).map((trait) => trait.id).sort();
  if (top.length < 2) return ['Fresh Pack', 'The weird specific version of your Barkly has barely started forming.'];
  return ARCHETYPES[top.join('+')] ?? ['One-of-One Barkly', 'The way you use Barkly is already pushing him into his own personality.'];
}

function rituals(memory: MemoryState): RelationshipRitual[] {
  return memory.trainingRules
    .filter((rule) => rule.timesTriggered >= 2)
    .sort((a, b) => b.timesTriggered - a.timesTriggered || b.updatedAt - a.updatedAt)
    .slice(0, 6)
    .map((rule) => ({
      id: rule.id,
      title: rule.timesTriggered >= 6 ? `The “${sanitize(rule.cue, 48)}” tradition` : `The “${sanitize(rule.cue, 48)}” thing`,
      cue: sanitize(rule.cue, 64),
      detail: `${sanitize(rule.instruction, 150)} · ${rule.timesTriggered} times`,
      times: rule.timesTriggered,
      signature: rule.timesTriggered >= 6,
    }));
}

function coreMemories(memory: MemoryState): CoreMemory[] {
  return [...memory.experiences]
    .sort((a, b) => {
      const aw = a.importance * 10 + a.referenceCount * 2 + (a.withWhom?.length ?? 0);
      const bw = b.importance * 10 + b.referenceCount * 2 + (b.withWhom?.length ?? 0);
      return bw - aw || b.at - a.at;
    })
    .slice(0, 4)
    .map((experience) => ({
      id: experience.id,
      what: sanitize(experience.what, 180),
      where: experience.where ? sanitize(experience.where, 80) : undefined,
      weight: experience.importance * 10 + experience.referenceCount * 2,
    }));
}

function loreFrom(character?: CharacterState): RelationshipLore[] {
  if (!character) return [];
  const lore: RelationshipLore[] = [];
  for (const [who, bond] of Object.entries(character.socialBonds ?? {})) {
    const stage = bond.kind === 'friend' ? friendshipStage(bond.encounters) : rivalryStage(bond.encounters);
    lore.push({
      id: `${bond.kind}-${who}`,
      title: `${who}: ${stage.label}`,
      detail: bond.kind === 'friend'
        ? `${bond.encounters} run-in${bond.encounters === 1 ? '' : 's'} together. ${stage.blurb}`
        : `${bond.encounters} incident${bond.encounters === 1 ? '' : 's'}. ${stage.blurb}`,
      kind: bond.kind === 'friend' ? 'friendship' : 'rivalry',
      strength: bond.encounters,
    });
  }
  if (character.favoriteTreasure) {
    lore.push({
      id: 'favorite-treasure',
      title: 'Sacred Object',
      detail: `${sanitize(character.favoriteTreasure, 100)} is currently treated as museum-grade property.`,
      kind: 'treasure',
      strength: Math.max(1, character.treasuresFound ?? 1),
    });
  }
  if (character.obsession) {
    lore.push({
      id: 'current-obsession',
      title: 'Current fixation',
      detail: `Barkly cannot stop thinking about ${sanitize(character.obsession.topic, 100)} right now.`,
      kind: 'obsession',
      strength: 1,
    });
  }
  return lore.sort((a, b) => b.strength - a.strength).slice(0, 6);
}

export function buildRelationshipProfile(input: RelationshipInput): RelationshipProfile {
  const emergedTraits = allTraitScores(input).filter((trait) => trait.score >= TRAIT_EMERGENCE_SCORE).slice(0, 3);
  const ritualRows = rituals(input.memory);
  const social = socialEncounters(input.character);
  const triggers = input.memory.trainingRules.reduce((sum, rule) => sum + rule.timesTriggered, 0);
  const score = Math.round(
    input.memory.facts.length * 3 +
    input.memory.experiences.length * 5 +
    input.memory.trainingRules.length * 8 +
    triggers * 2 +
    (input.stashCount ?? 0) * 4 +
    social * 3 +
    ritualRows.length * 7 +
    Math.max(0, input.stats.affection - 50) * 0.8,
  );
  const [archetype, tagline] = archetypeFor(emergedTraits);
  return {
    stage: makeStage(score),
    archetype,
    tagline,
    traits: emergedTraits,
    rituals: ritualRows,
    coreMemories: coreMemories(input.memory),
    lore: loreFrom(input.character),
  };
}

export function describeRelationship(profile: RelationshipProfile): string[] {
  const lines = [
    `Relationship stage: ${profile.stage.label}.`,
    `This particular Barkly has become: ${profile.archetype}. ${profile.tagline}`,
  ];
  if (profile.traits.length > 0) lines.push(`Emergent traits: ${profile.traits.map((trait) => trait.label).join(', ')}.`);
  if (profile.rituals.length > 0) {
    lines.push(`Private rituals: ${profile.rituals.slice(0, 3).map((ritual) => `${ritual.title} (${ritual.detail})`).join('; ')}.`);
  }
  if (profile.lore.length > 0) {
    lines.push(`Shared lore: ${profile.lore.slice(0, 3).map((lore) => `${lore.title} — ${lore.detail}`).join('; ')}.`);
  }
  lines.push('Use this as relationship texture: callbacks, opinions and running bits are good. Do not recite scores or labels like a dashboard.');
  return lines;
}
