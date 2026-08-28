/**
 * What "play" means right now.
 *
 * This lived inside BarklyRoom as a chain of ternaries that tested the
 * LOCATION first, and that ordering was the bug: at the park the button said
 * "fetch" and ran the ball chase no matter what Barkly was holding. Buy the
 * rope, give it to him, press the button — and he chased a ball he does not
 * own, while the shop happily reported the rope as "has it".
 *
 * The whole promise of a shop is that what you buy changes what happens. This
 * was the one purchase where it silently did not, so the decision is a pure
 * function now, with the precedence written down and tested:
 *
 *   1. A TOY IN HIS MOUTH WINS, everywhere. A rope is a tug at the beach, at
 *      the park, in the kitchen. It is his rope; the postcode does not vote.
 *   2. Otherwise the PLACE decides — the sea gets chased, the park gets a
 *      thrown something, and at home with nothing he improvises.
 *
 * The screen renders the button label, the animation and the prop from this
 * one value, so they cannot disagree about what he is doing.
 */

import { LocationId } from '../world/locations';

export type PlayRoutine = 'ball' | 'tug' | 'waves' | 'none';

/** Toys, by the routine they bring with them. */
const TOY_ROUTINE: Record<string, PlayRoutine> = {
  toy_ball: 'ball',
  toy_rope: 'tug',
};

export function playRoutineFor(toyId: string | null | undefined, location: LocationId): PlayRoutine {
  if (toyId && TOY_ROUTINE[toyId]) return TOY_ROUTINE[toyId];
  if (location === 'beach') return 'waves';
  if (location === 'park') return 'ball';
  return 'none';
}

/**
 * The word on the button.
 *
 * `fetch` survives as the park's word for throwing something, because that is
 * what people call it there — but only when the routine really is a throw.
 */
export function playLabelFor(
  routine: PlayRoutine,
  location: LocationId,
  busy: boolean,
): string {
  if (busy) {
    return routine === 'tug' ? 'tugging…' : routine === 'waves' ? 'chasing…' : 'fetching…';
  }
  if (routine === 'tug') return 'tug';
  if (routine === 'waves') return 'waves';
  if (routine === 'ball') return location === 'park' ? 'fetch' : 'throw';
  return 'play';
}
