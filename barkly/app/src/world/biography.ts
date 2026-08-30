/**
 * Home-as-biography model.
 *
 * The room should stop being a static background with purchased furniture and
 * become a physical record of this Barkly's life. This module converts durable
 * history into a small, curated set of stage props. It deliberately caps the
 * room so "more history" means richer specificity, not visual clutter.
 */

import { CharacterState, friendshipStage, rivalryStage } from '../barkly/character';
import { MemoryState } from '../barkly/memory';
import { deriveStoryArc } from '../barkly/story';
import { sanitize } from '../barkly/facts';

export type BiographyPropKind = 'treasure' | 'photo' | 'rival-dossier' | 'ritual-token' | 'saga-souvenir';
export type BiographySlot = 'shelf-left' | 'shelf-right' | 'wall-left' | 'wall-right' | 'floor-keepsake';

export interface BiographyProp {
  id: string;
  kind: BiographyPropKind;
  slot: BiographySlot;
  title: string;
  caption: string;
  /** 1-100; strongest history wins when multiple props compete for a slot. */
  weight: number;
  /** Renderer hint. It is intentionally semantic, not an asset path. */
  visual: 'found-object' | 'polaroid' | 'scribbled-photo' | 'handmade-award' | 'souvenir-card';
}

interface BiographyInput {
  character: CharacterState;
  memory: MemoryState;
}

const clean = (s: string, max = 100) => sanitize(s, max);

function topBond(character: CharacterState, kind: 'friend' | 'rival') {
  return Object.entries(character.socialBonds ?? {})
    .filter(([, bond]) => bond.kind === kind && bond.encounters >= 3)
    .sort((a, b) => b[1].encounters - a[1].encounters || a[0].localeCompare(b[0]))[0];
}

function topRitual(memory: MemoryState) {
  return [...memory.trainingRules]
    .filter((rule) => rule.timesTriggered >= 4)
    .sort((a, b) => b.timesTriggered - a.timesTriggered || b.updatedAt - a.updatedAt)[0];
}

/** Curated props, max five. Every prop is a receipt for something that happened. */
export function deriveHomeBiography(input: BiographyInput): BiographyProp[] {
  const { character, memory } = input;
  const candidates: BiographyProp[] = [];
  const favorite = character.favoriteTreasure;
  if (favorite) {
    const affinity = Object.entries(character.treasureAffinities ?? {})
      .find(([name]) => name.toLowerCase() === favorite.toLowerCase())?.[1];
    candidates.push({
      id: 'favorite-treasure-display', kind: 'treasure', slot: 'shelf-left',
      title: clean(favorite, 70),
      caption: `Barkly's current museum centerpiece. ${affinity?.score ?? 1} attachment points and counting.`,
      weight: Math.min(100, 35 + (affinity?.score ?? 1) * 10),
      visual: 'found-object',
    });
  }

  const friend = topBond(character, 'friend');
  if (friend) {
    const [who, bond] = friend;
    candidates.push({
      id: `friend-photo-${who.toLowerCase()}`, kind: 'photo', slot: 'wall-left',
      title: `${clean(who, 50)} + Barkly`,
      caption: `${friendshipStage(bond.encounters).label}. ${bond.encounters} shared run-ins made this wall-worthy.`,
      weight: Math.min(100, 30 + bond.encounters * 6),
      visual: 'polaroid',
    });
  }

  const rival = topBond(character, 'rival');
  if (rival) {
    const [who, bond] = rival;
    candidates.push({
      id: `rival-file-${who.toLowerCase()}`, kind: 'rival-dossier', slot: 'wall-right',
      title: `THE ${clean(who, 50)} FILE`,
      caption: `${rivalryStage(bond.encounters).label}. Barkly has chosen documentation over forgiveness.`,
      weight: Math.min(100, 28 + bond.encounters * 6),
      visual: 'scribbled-photo',
    });
  }

  const ritual = topRitual(memory);
  if (ritual) {
    candidates.push({
      id: `ritual-award-${ritual.id}`, kind: 'ritual-token', slot: 'shelf-right',
      title: `“${clean(ritual.cue, 48)}”`,
      caption: ritual.timesTriggered >= 6
        ? `A private bit performed ${ritual.timesTriggered} times. At this point it has tenure.`
        : `A routine repeated enough to earn physical evidence.`,
      weight: Math.min(100, 25 + ritual.timesTriggered * 7),
      visual: 'handmade-award',
    });
  }

  const story = deriveStoryArc({ character, memory });
  if (story && story.intensity >= 2) {
    candidates.push({
      id: `saga-${story.id}`, kind: 'saga-souvenir', slot: 'floor-keepsake',
      title: clean(story.title, 70),
      caption: clean(story.chapter, 100),
      weight: 35 + story.intensity * 12,
      visual: 'souvenir-card',
    });
  }

  // Slots are intentionally stable. If future systems produce competing props,
  // strongest history gets the physical space instead of piling cards forever.
  const bySlot = new Map<BiographySlot, BiographyProp>();
  for (const prop of candidates.sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id))) {
    const current = bySlot.get(prop.slot);
    if (!current || prop.weight > current.weight) bySlot.set(prop.slot, prop);
  }
  const slotOrder: BiographySlot[] = ['wall-left', 'wall-right', 'shelf-left', 'shelf-right', 'floor-keepsake'];
  return slotOrder.map((slot) => bySlot.get(slot)).filter((p): p is BiographyProp => Boolean(p));
}

export function biographyPromptTexture(props: BiographyProp[]): string {
  if (props.length === 0) return '';
  return `Your home visibly remembers your life: ${props.map((p) => `${p.title} — ${p.caption}`).join('; ')}. You may naturally notice or refer to these objects.`;
}
