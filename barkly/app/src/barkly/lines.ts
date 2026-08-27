/**
 * Scripted in-character lines for moments that don't need a model call:
 * feeding, refusing food, fetch, being too tired. These run instantly and for
 * free, and — importantly — they go through the SAME speaking lifecycle as AI
 * replies (see useBarkly's speak()), so his body is never doing one thing
 * while audio does another.
 *
 * Deliberately small pools. If a line would be better coming from the model,
 * it should come from the model.
 */

export const FEED_LINES = [
  'Finally. I was about to file a complaint.',
  'Food. My favorite thing that is not you. Close second though.',
  'You remembered! I mean — obviously you remembered. Anyway.',
  'This is the best thing to happen all day. The bar is low.',
];

export const FULL_LINES = [
  "I'm full. I have standards. Not many, but this is one.",
  'No thanks. Ask me again in an hour and watch me forget I said that.',
  'Look at me. Does this look like a dog with room?',
];

export const PLAY_LINES = [
  "Okay okay okay yes — throw it, throw it, THROW IT.",
  "I'll play. Not because I'm excited. I'm just being polite. THROW IT.",
  'Zoomies engaged. This was your idea, remember that.',
];

export const TIRED_LINES = [
  "No. Nap. We can do the running thing later.",
  "I've got maybe four percent battery. Ask the couch.",
  'Counter-offer: we both lie down.',
];

export const WAKE_LINES = [
  'I was NOT asleep. I was resting my whole face.',
  "Five more minutes. ...Fine. But I'm remembering this.",
];

/** Deterministic-ish pick so tests can pin a line by seed. */
export function pickLine(pool: string[], seed = Math.floor(Math.random() * 1000)): string {
  return pool[Math.abs(seed) % pool.length];
}
