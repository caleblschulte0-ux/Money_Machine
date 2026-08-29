/**
 * What Barkly is looking at — and therefore what the app no longer has to say
 * out loud.
 *
 * Before his head could move independently of his body, "he is hungry" could
 * only be communicated by the interface: a chip, a badge, a bowl that pulsed.
 * The app was explaining the dog. A dog that can turn his head does not need
 * explaining — he stares at the bowl, then at you, then at the bowl. Everyone
 * who has ever been near a dog knows exactly what that means.
 *
 * So this is the small dictionary between the world and his neck. It is pure,
 * and it is deliberately coarse: directions, not coordinates. He does not know
 * where the bowl is in pixels and should not — he knows it is down and to his
 * left, which is all a look needs to read.
 *
 * THE GLANCE, not the stare. He looks at the thing and then back at you, on a
 * loop, and the looking-back is the half that carries the meaning. A dog that
 * simply faces his bowl is asleep on his feet; a dog that checks the bowl and
 * then checks YOU is asking.
 */

import { NpcId } from '../world/npcs';

export type Attending =
  | { at: 'you' }
  | { at: 'bowl' }
  | { at: 'toy' }
  | { at: 'bed' }
  | { at: 'npc'; id: NpcId };

export interface Look {
  x: number;
  y: number;
}

/**
 * Directions, in his own terms: -1 is his left, +1 his right, +y is down.
 *
 * The kit sits along the bottom of the stage in the order bowl, toy, bed, and
 * the other dogs stand at the far edges of the scene (see NPC_SPOTS). These
 * are those positions, rounded to something a neck can express.
 */
const WHERE: Record<string, Look> = {
  you: { x: 0, y: 0 },
  bowl: { x: -0.8, y: 0.75 },
  toy: { x: 0, y: 0.85 },
  bed: { x: 0.8, y: 0.75 },
  // Biscuit is the one on the left; Duke and Pepper hold the right-hand edge.
  biscuit: { x: -0.95, y: 0.15 },
  duke: { x: 0.95, y: 0.1 },
  pepper: { x: 0.9, y: 0.15 },
};

export function lookFor(a: Attending): Look {
  if (a.at === 'npc') return WHERE[a.id] ?? WHERE.you;
  return WHERE[a.at] ?? WHERE.you;
}

export interface AttentionInput {
  /** Which of his things he would like, if any. */
  wants: 'feed' | 'play' | 'sleep' | null;
  /** A meal is on stage. His eyes belong in the bowl, not on you. */
  eating?: boolean;
  /** Someone said something and he should be looking at them. */
  npcSpeaking: NpcId | null;
  /** He is mid-sentence. Talking to you means looking at you. */
  speaking: boolean;
  asleep: boolean;
}

/**
 * The one thing he is attending to right now, in priority order.
 *
 * SOMEONE TALKING WINS. Being addressed and not turning to look is the single
 * most lifeless thing a character can do, and it outranks his own appetite.
 * Then his own wants. Then you — which is the default, and the point: with
 * nothing else going on he is looking at his person.
 */
export function attentionFor(i: AttentionInput): Attending {
  if (i.asleep) return { at: 'bed' };
  // Above even being spoken to: a dog with food does not do eye contact.
  if (i.eating) return { at: 'bowl' };
  if (i.npcSpeaking) return { at: 'npc', id: i.npcSpeaking };
  if (i.speaking) return { at: 'you' };
  if (i.wants === 'feed') return { at: 'bowl' };
  if (i.wants === 'play') return { at: 'toy' };
  if (i.wants === 'sleep') return { at: 'bed' };
  return { at: 'you' };
}

/** How long he holds each half of a glance, in ms. */
export const GLANCE = { away: 1150, back: 2600 };
