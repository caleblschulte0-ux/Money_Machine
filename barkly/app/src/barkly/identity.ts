/**
 * Barkly Identity Engine
 *
 * Relationship scores answer "how close are we?". This answers the more
 * important product question: "what did MY Barkly become?"
 *
 * Nothing here is randomly assigned. Preferences, opinions and personality
 * axes are derived from durable evidence the player created: repeated places,
 * recurring dogs, treasures he kept caring about and private routines that
 * became traditions. The same starting dog can therefore grow into visibly
 * different characters without a personality picker.
 */

import { CharacterState, friendshipStage, rivalryStage } from './character';
import { sanitize } from './facts';
import { MemoryState } from './memory';
import { BarklyStats } from './types';

export type PreferenceKind = 'place' | 'treasure' | 'friend' | 'rival' | 'ritual';

export interface FormedPreference {
  id: string;
  kind: PreferenceKind;
  subject: string;
  strength: number;
  evidence: number;
  line: string;
}

export interface PersonalityAxis {
  id: 'attached' | 'social' | 'collector' | 'trained' | 'adventurous' | 'dramatic';
  label: string;
  score: number;
  line: string;
}

export interface BarklyOpinion {
  id: string;
  subject: string;
  stance: 'loves' | 'likes' | 'suspicious' | 'feuding' | 'claims';
  line: string;
  strength: number;
}

export interface BarklyIdentity {
  /** One sentence suitable for prompt texture or a scrapbook caption. */
  summary: string;
  preferences: FormedPreference[];
  axes: PersonalityAxis[];
  opinions: BarklyOpinion[];
  /** Human-readable receipts explaining why this identity exists. */
  receipts: string[];
}

interface IdentityInput {
  memory: MemoryState;
  character?: CharacterState;
  stats: BarklyStats;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const key = (s: string) => sanitize(s, 80).trim().toLowerCase();

function placePreferences(memory: MemoryState): FormedPreference[] {
  const counts = new Map<string, { display: string; score: number; evidence: number }>();
  for (const exp of memory.experiences) {
    if (!exp.where) continue;
    const display = sanitize(exp.where, 80);
    if (!display) continue;
    const k = key(display);
    const prev = counts.get(k) ?? { display, score: 0, evidence: 0 };
    prev.evidence += 1;
    prev.score += 8 + exp.importance * 7 + Math.min(4, exp.referenceCount) * 2;
    counts.set(k, prev);
  }
  return [...counts.values()]
    .filter((row) => row.evidence >= 2)
    .map((row) => ({
      id: `place-${key(row.display).replace(/[^a-z0-9]+/g, '-')}`,
      kind: 'place' as const,
      subject: row.display,
      strength: clamp(row.score),
      evidence: row.evidence,
      line: row.evidence >= 5
        ? `${row.display} has basically become Barkly territory.`
        : `Barkly has started treating ${row.display} like one of his places.`,
    }));
}

function treasurePreferences(character?: CharacterState): FormedPreference[] {
  const rows = Object.entries(character?.treasureAffinities ?? {});
  return rows
    .filter(([, affinity]) => affinity.score >= 2)
    .map(([name, affinity]) => ({
      id: `treasure-${key(name).replace(/[^a-z0-9]+/g, '-')}`,
      kind: 'treasure' as const,
      subject: sanitize(name, 90),
      strength: clamp(affinity.score * 18 + Math.min(4, affinity.discoveries) * 5),
      evidence: Math.max(1, affinity.discoveries),
      line: character?.favoriteTreasure && key(character.favoriteTreasure) === key(name)
        ? `${sanitize(name, 90)} is not junk. Barkly has made this very clear.`
        : `${sanitize(name, 90)} has survived long enough to become part of the collection.`,
    }));
}

function socialPreferences(character?: CharacterState): FormedPreference[] {
  return Object.entries(character?.socialBonds ?? {})
    .filter(([, bond]) => bond.encounters >= 3)
    .map(([who, bond]) => {
      const stage = bond.kind === 'friend' ? friendshipStage(bond.encounters) : rivalryStage(bond.encounters);
      return {
        id: `${bond.kind}-${key(who).replace(/[^a-z0-9]+/g, '-')}`,
        kind: bond.kind as 'friend' | 'rival',
        subject: sanitize(who, 60),
        strength: clamp(bond.encounters * 8),
        evidence: bond.encounters,
        line: bond.kind === 'friend'
          ? `${sanitize(who, 60)} is a ${stage.label}; Barkly expects them to be part of the world now.`
          : `${sanitize(who, 60)} is a ${stage.label}; Barkly is keeping receipts.`,
      };
    });
}

function ritualPreferences(memory: MemoryState): FormedPreference[] {
  return memory.trainingRules
    .filter((rule) => rule.timesTriggered >= 3)
    .map((rule) => ({
      id: `ritual-${rule.id}`,
      kind: 'ritual' as const,
      subject: sanitize(rule.cue, 60),
      strength: clamp(25 + rule.timesTriggered * 9),
      evidence: rule.timesTriggered,
      line: rule.timesTriggered >= 6
        ? `“${sanitize(rule.cue, 60)}” is no longer a trick. It is a tradition.`
        : `Barkly recognizes “${sanitize(rule.cue, 60)}” as one of your recurring bits.`,
    }));
}

function axesFor(input: IdentityInput, preferences: FormedPreference[]): PersonalityAxis[] {
  const { character, memory, stats } = input;
  const social = Object.values(character?.socialBonds ?? {}).reduce((sum, bond) => sum + bond.encounters, 0);
  const rivals = Object.values(character?.socialBonds ?? {}).filter((bond) => bond.kind === 'rival').reduce((sum, bond) => sum + bond.encounters, 0);
  const triggers = memory.trainingRules.reduce((sum, rule) => sum + rule.timesTriggered, 0);
  const places = preferences.filter((p) => p.kind === 'place').reduce((sum, p) => sum + p.evidence, 0);
  const treasures = character?.treasuresFound ?? 0;

  const rows: PersonalityAxis[] = [
    { id: 'attached', label: 'Attached', score: clamp((stats.affection - 35) * 1.45 + memory.experiences.length * 2), line: 'How much Barkly treats you as his person rather than the person with the food.' },
    { id: 'social', label: 'Social', score: clamp(social * 7), line: 'How much his recurring dog relationships define his life.' },
    { id: 'collector', label: 'Collector', score: clamp(treasures * 9 + (character?.favoriteTreasure ? 18 : 0)), line: 'How seriously he takes ownership of objectively questionable objects.' },
    { id: 'trained', label: 'Trained-ish', score: clamp(memory.trainingRules.length * 16 + triggers * 5), line: 'How much private language and learned behavior exists between you.' },
    { id: 'adventurous', label: 'Adventurous', score: clamp(places * 8 + memory.experiences.filter((e) => Boolean(e.where)).length * 3), line: 'How much his identity was built by going places instead of sitting in the room.' },
    { id: 'dramatic', label: 'Dramatic', score: clamp(rivals * 9 + (character?.grievance ? 22 : 0) + (character?.obsession ? 10 : 0)), line: 'How likely Barkly is to turn a normal event into ongoing lore.' },
  ];
  return rows.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

function opinionsFor(preferences: FormedPreference[]): BarklyOpinion[] {
  return preferences
    .filter((p) => p.strength >= 35)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 8)
    .map((p) => {
      const stance: BarklyOpinion['stance'] =
        p.kind === 'rival' ? 'feuding' :
        p.kind === 'place' ? 'claims' :
        p.strength >= 70 ? 'loves' : 'likes';
      const line =
        p.kind === 'rival' ? `${p.subject}? Barkly has a file on that situation.` :
        p.kind === 'place' ? `${p.subject} is, according to Barkly, partly his.` :
        p.kind === 'treasure' ? `${p.subject} has been promoted from debris to property.` :
        p.kind === 'ritual' ? `“${p.subject}” is one of the things you two do now.` :
        `${p.subject} is part of Barkly's actual social life.`;
      return { id: `opinion-${p.id}`, subject: p.subject, stance, line, strength: p.strength };
    });
}

export function deriveBarklyIdentity(input: IdentityInput): BarklyIdentity {
  const preferences = [
    ...placePreferences(input.memory),
    ...treasurePreferences(input.character),
    ...socialPreferences(input.character),
    ...ritualPreferences(input.memory),
  ].sort((a, b) => b.strength - a.strength || b.evidence - a.evidence || a.id.localeCompare(b.id));

  const axes = axesFor(input, preferences);
  const opinions = opinionsFor(preferences);
  const top = axes.filter((axis) => axis.score >= 28).slice(0, 3);
  const strongest = preferences[0];
  const summary = top.length === 0
    ? 'This Barkly is still mostly potential. The specific weirdness has not formed yet.'
    : `This Barkly has become ${top.map((axis) => axis.label.toLowerCase()).join(', ')}${strongest ? `, with a very real thing about ${strongest.subject}` : ''}.`;

  const receipts = preferences.slice(0, 6).map((p) => `${p.line} (${p.evidence} receipts)`);
  return { summary, preferences: preferences.slice(0, 12), axes, opinions, receipts };
}

export function describeIdentity(identity: BarklyIdentity): string[] {
  const lines = [`Formed identity: ${identity.summary}`];
  if (identity.opinions.length > 0) {
    lines.push(`Barkly's own opinions: ${identity.opinions.slice(0, 5).map((o) => o.line).join(' ')}`);
  }
  if (identity.receipts.length > 0) {
    lines.push(`Identity receipts: ${identity.receipts.slice(0, 4).join('; ')}.`);
  }
  lines.push('Treat these as behavior and callbacks, not badges. He may act on an opinion without announcing the underlying score.');
  return lines;
}
