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
import { displayName } from '../world/npcs';

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

/**
 * One spelling for one place.
 *
 * `where` arrived in three shapes -- 'park' from a preset, 'Park' from
 * LOCATIONS[...].name in live play, and one hand-written 'the beach' in the
 * wave-chasing reward. Grouping on the raw string filed them as three separate
 * places, each holding a fraction of the evidence, so a place he really does
 * live at could sit under the `evidence >= 2` bar forever while the save had
 * four visits to it.
 */
function placeLabel(where: string): string {
  const bare = sanitize(where, 80).trim().replace(/^the\s+/i, '');
  if (!bare) return '';
  return bare[0].toUpperCase() + bare.slice(1);
}

function placePreferences(memory: MemoryState): FormedPreference[] {
  const counts = new Map<string, { display: string; score: number; evidence: number }>();
  for (const exp of memory.experiences) {
    if (!exp.where) continue;
    const display = placeLabel(exp.where);
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
      /*
       * The bond KEY is not his name.
       *
       * A bond is stored under whichever spelling arrived first -- 'Duke' from
       * live play, 'duke' from a preset -- and this used it verbatim, so the
       * system prompt told the model his nemesis was called "duke" and his best
       * friend "biscuit". story.ts already had `displayName` for exactly this;
       * identity never called it.
       */
      const name = sanitize(displayName(who), 60);
      return {
        id: `${bond.kind}-${key(who).replace(/[^a-z0-9]+/g, '-')}`,
        kind: bond.kind as 'friend' | 'rival',
        subject: name,
        strength: clamp(bond.encounters * 8),
        evidence: bond.encounters,
        /*
         * "Duke is a generational feud." "Biscuit is a pack family."
         *
         * The top rung of each ladder is a name for the RELATIONSHIP, not for
         * the dog, so `${name} is a ${label}` was both ungrammatical and wrong
         * about who is what -- and it was wrong precisely for the long-term
         * player, since these are the rungs you only reach after months. Naming
         * the pair instead reads correctly at every rung on both ladders, and
         * drops the a/an problem ("a official rival") with it.
         */
        line: bond.kind === 'friend'
          ? `Barkly and ${name}: ${stage.label}. He expects them to be part of the world now.`
          : `Barkly and ${name}: ${stage.label}. He is keeping receipts.`,
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

const axis = (
  id: PersonalityAxis['id'],
  label: string,
  weight: number,
  line: string,
): { row: PersonalityAxis; weight: number } => ({
  row: { id, label, score: clamp(weight), line },
  weight,
});

function axesFor(input: IdentityInput, preferences: FormedPreference[]): PersonalityAxis[] {
  const { character, memory, stats } = input;
  const social = Object.values(character?.socialBonds ?? {}).reduce((sum, bond) => sum + bond.encounters, 0);
  const rivals = Object.values(character?.socialBonds ?? {}).filter((bond) => bond.kind === 'rival').reduce((sum, bond) => sum + bond.encounters, 0);
  const triggers = memory.trainingRules.reduce((sum, rule) => sum + rule.timesTriggered, 0);
  const places = preferences.filter((p) => p.kind === 'place').reduce((sum, p) => sum + p.evidence, 0);
  const treasures = character?.treasuresFound ?? 0;

  /*
   * RANK ON THE RAW SCORE, CLAMP ONLY FOR DISPLAY.
   *
   * Every axis was clamped to 100 before sorting, so a long-term save with four
   * maxed axes had a four-way tie broken by `a.id.localeCompare(b.id)` -- the
   * summary "collector, dramatic, social" was alphabetical order, not this
   * dog. Two players with completely different histories read the same
   * sentence, at exactly the point they have invested most. The raw score
   * keeps its resolution above the ceiling, so the strongest thing about a
   * Barkly is still the strongest thing about him at month six.
   */
  const raw: { row: PersonalityAxis; weight: number }[] = [
    axis('attached', 'Attached', (stats.affection - 35) * 1.45 + memory.experiences.length * 2, 'How much Barkly treats you as his person rather than the person with the food.'),
    axis('social', 'Social', social * 7, 'How much his recurring dog relationships define his life.'),
    axis('collector', 'Collector', treasures * 9 + (character?.favoriteTreasure ? 18 : 0), 'How seriously he takes ownership of objectively questionable objects.'),
    axis('trained', 'Trained-ish', memory.trainingRules.length * 16 + triggers * 5, 'How much private language and learned behavior exists between you.'),
    axis('adventurous', 'Adventurous', places * 8 + memory.experiences.filter((e) => Boolean(e.where)).length * 3, 'How much his identity was built by going places instead of sitting in the room.'),
    axis('dramatic', 'Dramatic', rivals * 9 + (character?.grievance ? 22 : 0) + (character?.obsession ? 10 : 0), 'How likely Barkly is to turn a normal event into ongoing lore.'),
  ];
  return raw
    .sort((a, b) => b.weight - a.weight || a.row.id.localeCompare(b.row.id))
    .map((entry) => entry.row);
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
