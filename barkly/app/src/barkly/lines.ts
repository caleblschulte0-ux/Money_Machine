/**
 * Scripted in-character lines for moments that don't need a model call:
 * feeding, refusing food, fetch, being too tired. These run instantly and for
 * free, and — importantly — they go through the SAME speaking lifecycle as AI
 * replies (see useBarkly's speak()), so his body is never doing one thing
 * while audio does another.
 *
 * ON POOL SIZE, corrected 2026-09-07. This header used to say the pools were
 * "deliberately small" because a line better said by the model should come from
 * the model. True in principle, and it was not what the code did: feed and play
 * NEVER call the model. `speak(pickLine(...))` is the only path for both, so
 * for the two buttons that live on the dock and get pressed more than anything
 * else in the game, the pool was the entire experience.
 *
 * Counted across every named pool in the app, the everyday ones were the
 * thinnest content in Barkly and the rare ones the richest: feed 4, play 3,
 * tug 3, tired 3, waking up 2 -- against 18 idle thoughts, 22 conversation
 * topics, 27 treasures and a 15-rung rivalry ladder. So a child pressing play
 * three times in one sitting heard a repeat, while the rivalry beat they meet
 * once a week had fifteen variations waiting.
 *
 * These are now 8 to 12 each. Still finite, still instant, still free -- but
 * sized for how often they are actually heard rather than for how interesting
 * they were to write.
 */

export const FEED_LINES = [
  'Finally. I was about to file a complaint.',
  'Food. My favorite thing that is not you. Close second though.',
  'You remembered! I mean — obviously you remembered. Anyway.',
  'This is the best thing to happen all day. The bar is low.',
  'I was not begging. I was standing hopefully. Different thing.',
  'Straight down. No notes. Do it again.',
  'I would like the record to show that I waited. Briefly.',
  'Ah. The good bowl. I can tell. I have a system.',
  'You are officially my favorite. This is binding.',
  'I will eat this in one motion and then act shocked that it is gone.',
  'Do not watch me eat. ...Okay. Watch a little.',
  'I had given up hope. Two minutes ago. It was a dark time.',
];

export const FULL_LINES = [
  "I'm full. I have standards. Not many, but this is one.",
  'No thanks. Ask me again in an hour and watch me forget I said that.',
  'Look at me. Does this look like a dog with room?',
  'Put it down. I will get to it. It is on my list.',
  'I am pacing myself. It is a new thing I am trying.',
  'Not now. I am still digesting the last one. Emotionally.',
  'Save it. I like having something to look forward to.',
  'A pass. Write that down, nobody will believe you.',
];

export const PLAY_LINES = [
  "Okay okay okay yes — throw it, throw it, THROW IT.",
  "I'll play. Not because I'm excited. I'm just being polite. THROW IT.",
  'Zoomies engaged. This was your idea, remember that.',
  'Say the word and I become a problem. Say the word.',
  'I have energy and no plan. My favorite combination.',
  'Fine. But I am going to be very good at this.',
  'Nothing in my mouth and still ready. That is professionalism.',
  'I will chase anything. Standards are for later.',
  'Watch this. I have not decided what yet. Watch anyway.',
  'Move over. I need somewhere to point all of this.',
];

/** With a ball. He has exactly one plan and it is a good plan. */
export const BALL_LINES = [
  'Throw it. Throw it throw it throw it. THROW IT.',
  "The ball. My ball. Send it. I'll be right back.",
  'Ball. Air. Me. In that order. Go.',
  'I have located the ball. Obviously. Now do your part.',
  'Further than that. I can go further than that.',
  'Fake me out and I will remember it forever. Try me.',
  'This is the good one. Do not ask me why. It just is.',
  'Send it into orbit. I will be back before you miss me.',
  'One throw. That is all I am asking. Then one more.',
];

/** With a rope. This is not a game to him, it is a dispute. */
export const TUG_LINES = [
  "It's my rope. Pull. Go on. See what happens.",
  'Grip it. I have been training. In my head. Constantly.',
  "You're going to lose this and I want you to know that now.",
  'This is not a game. This is a dispute over property.',
  'Harder. I am insulted. Harder.',
  'I have the low center of gravity here. Think about that.',
  'Let go and I win. Do not let go and I still win.',
  'I have never lost this. I do not count the times I lost this.',
  'Both ends of this rope are mine. That is just geometry.',
];

export const TIRED_LINES = [
  "No. Nap. We can do the running thing later.",
  "I've got maybe four percent battery. Ask the couch.",
  'Counter-offer: we both lie down.',
  'My legs have filed for time off. I approved it.',
  'Ask my morning self. He was thrilled about everything.',
  'I am going to lie here and be extremely good at it.',
  'That is a tomorrow activity. Tomorrow me is very fast.',
  'I have done enough today. Ask anyone. Do not ask anyone.',
  'One more nap and I am a completely different animal.',
];

export const WAKE_LINES = [
  'I was NOT asleep. I was resting my whole face.',
  "Five more minutes. ...Fine. But I'm remembering this.",
  'I was awake the entire time. Ask my eyes. Do not ask my eyes.',
  'Something happened. Was it important? Was it food?',
  'I have been up for hours. In dreams. Which count.',
  'Give me a second. I have to remember what a dog is.',
  'Right. Yes. I am here. Where is here.',
  'I was guarding the inside of my eyelids. Nothing got through.',
];

/** Deterministic-ish pick so tests can pin a line by seed. */
export function pickLine(pool: string[], seed = Math.floor(Math.random() * 1000)): string {
  return pool[Math.abs(seed) % pool.length];
}
