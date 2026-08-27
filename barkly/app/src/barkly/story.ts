/**
 * Barkly's emergent story engine.
 *
 * This is intentionally NOT a catalog of quests. It looks at history the user
 * actually caused — recurring friends/rivals, favorite treasure, taught
 * traditions — and names the story that is already happening.
 *
 * A future version can add choices and chapter persistence. This first layer
 * gives the product a crucial property today: world mechanics combine into
 * narrative instead of remaining disconnected buttons.
 */

import { CharacterState, friendshipStage, rivalryStage } from './character';
import { MemoryState } from './memory';
import { sanitize } from './facts';

export interface StoryArc {
  id: string;
  title: string;
  chapter: string;
  premise: string;
  nextHook: string;
  cast: string[];
  intensity: 1 | 2 | 3 | 4;
}

interface StoryInput {
  character?: CharacterState;
  memory: MemoryState;
}

function topBond(character: CharacterState | undefined, kind: 'friend' | 'rival') {
  return Object.entries(character?.socialBonds ?? {})
    .filter(([, bond]) => bond.kind === kind)
    .sort((a, b) => b[1].encounters - a[1].encounters)[0];
}

function signatureRitual(memory: MemoryState) {
  return [...memory.trainingRules]
    .filter((rule) => rule.timesTriggered >= 6)
    .sort((a, b) => b.timesTriggered - a.timesTriggered)[0];
}

/** Pick the strongest story implied by current history. No randomness. */
export function deriveStoryArc(input: StoryInput): StoryArc | undefined {
  const { character, memory } = input;
  const rival = topBond(character, 'rival');
  const friend = topBond(character, 'friend');
  const treasure = character?.favoriteTreasure;
  const ritual = signatureRitual(memory);

  // A rival + something Barkly loves is instantly a story machine.
  if (rival && rival[1].encounters >= 3 && treasure) {
    const [who, bond] = rival;
    const rivalry = rivalryStage(bond.encounters);
    const intensity: StoryArc['intensity'] = bond.encounters >= 12 ? 4 : bond.encounters >= 6 ? 3 : 2;
    return {
      id: `treasure-rival-${who.toLowerCase()}`,
      title: `The ${sanitize(who, 40)} Situation`,
      chapter: bond.encounters >= 12 ? 'Chapter IV · This Is Generational Now' : bond.encounters >= 6 ? 'Chapter III · Nemesis Era' : 'Chapter II · Bad Vibes Around the Treasure',
      premise: `${sanitize(who, 50)} is Barkly's ${rivalry.label}, and Barkly is extremely protective of ${sanitize(treasure, 80)}. This combination has become a whole thing.`,
      nextHook: `Next time ${sanitize(who, 40)} shows up, Barkly is absolutely watching the treasure situation.`,
      cast: [who],
      intensity,
    };
  }

  // A real friend and real rival creates social politics without authored quests.
  if (friend && rival && friend[1].encounters >= 3 && rival[1].encounters >= 3) {
    const [friendName, friendBond] = friend;
    const [rivalName, rivalBond] = rival;
    return {
      id: `park-politics-${friendName.toLowerCase()}-${rivalName.toLowerCase()}`,
      title: 'Dog Park Politics',
      chapter: rivalBond.encounters >= 6 ? 'Chapter III · Everybody Has Picked Sides' : 'Chapter II · The Park Has Factions',
      premise: `${sanitize(friendName, 50)} is Barkly's ${friendshipStage(friendBond.encounters).label}. ${sanitize(rivalName, 50)} is his ${rivalryStage(rivalBond.encounters).label}. Apparently the park has politics now.`,
      nextHook: `Seeing ${sanitize(friendName, 40)} and ${sanitize(rivalName, 40)} again should feel like returning to an ongoing soap opera.`,
      cast: [friendName, rivalName],
      intensity: rivalBond.encounters >= 6 ? 3 : 2,
    };
  }

  // A private ritual starts leaking into the public world.
  if (ritual && (friend || rival)) {
    const witness = friend?.[0] ?? rival?.[0] ?? 'the park';
    return {
      id: `ritual-spreads-${ritual.id}`,
      title: 'The Bit Has Escaped Containment',
      chapter: 'Chapter I · Other Dogs Have Seen It',
      premise: `The “${sanitize(ritual.cue, 50)}” routine has become a signature tradition. ${sanitize(witness, 50)} has now been around Barkly enough that this private joke can become part of his public reputation.`,
      nextHook: `Barkly should start having opinions about performing “${sanitize(ritual.cue, 50)}” in front of other dogs.`,
      cast: witness === 'the park' ? [] : [witness],
      intensity: 2,
    };
  }

  // Treasure collecting becomes its own saga after it stops being a one-off.
  if ((character?.treasuresFound ?? 0) >= 4 && treasure) {
    const count = character?.treasuresFound ?? 0;
    return {
      id: 'questionable-museum',
      title: 'The Museum of Questionable Objects',
      chapter: count >= 10 ? 'Chapter III · We Need More Shelves' : count >= 6 ? 'Chapter II · This Is Apparently a Collection' : 'Chapter I · The Exhibit Opens',
      premise: `Barkly has collected ${count} treasures and currently considers ${sanitize(treasure, 80)} the crown jewel.`,
      nextHook: 'Every new dig now has context: can anything dethrone the current favorite?',
      cast: [],
      intensity: count >= 10 ? 3 : count >= 6 ? 2 : 1,
    };
  }

  return undefined;
}

export function describeStory(arc: StoryArc): string {
  return `Current ongoing saga: ${arc.title} — ${arc.chapter}. ${arc.premise} Next beat: ${arc.nextHook}`;
}
