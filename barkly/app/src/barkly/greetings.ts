/**
 * Welcome-back lines for when Barkly's person reopens the app.
 * Scripted (no model call) so returning always lands instantly and free.
 * In-character per docs/CHARACTER.md; child-appropriate.
 *
 * The return moment used to be almost always empty, for two reasons that
 * compounded:
 *
 * - It only fired after SIX HOURS away. Close the app, make a sandwich, come
 *   back: nothing. The screen said "type something and say hi", as if he had
 *   never met you. For an app whose entire pitch is that he remembers you,
 *   the moment you open it is the one beat that has to land.
 * - It read the timestamp out of his saved snapshot — which was being
 *   destroyed on every launch by the persistence bug (see storage/hydration).
 *   So "hours away" was always ~0 and the six-hour line could never fire at
 *   all. The greeting existed and was unreachable.
 *
 * Now there is a band for every length of absence, starting at a couple of
 * minutes, and the timestamp it reads actually survives.
 */

export type AwayBand = 'blink' | 'short' | 'day' | 'long';

/** Which kind of return this is. Under ~2 minutes is not a return at all. */
export function awayBand(minutes: number): AwayBand | null {
  if (minutes < 2) return null; // a reload, not a return
  if (minutes < 45) return 'blink';
  if (minutes < 6 * 60) return 'short';
  if (minutes < 36 * 60) return 'day';
  return 'long';
}

type Line = (name: string) => string;

/**
 * THE NAMED LINES PUT THE NAME AT THE FRONT, AND THE REST IS A LITERAL.
 *
 * This is not a style choice, it is the only shape the recorded voice can
 * take. The bank matches WHOLE lines and the harvester skips any literal with
 * a substitution in it, so a greeting written as `Oh, ${n}'s back. I did not
 * move.` could never be recorded for anybody -- and measured, ALL TWELVE named
 * greetings were missing from the bank while all twelve anonymous ones were in
 * it. Every returning player who had told him their name (which is everyone,
 * the onboarding asks) heard the browser's screen reader on the first line of
 * every session. On the beat this file's own header calls "the one that has to
 * land".
 *
 * A name at the FRONT is free: `voiceEngine.speakable` splits it off with
 * `dialect.splitLeadingName` and plays the body, which is why the bodies below
 * are plain strings the harvester can see.
 */
const BODIES: Record<AwayBand, string[]> = {
  blink: [
    'I did not move. I want that on the record.',
    'That was quick. I had only just started missing you.',
    'I was mid-thought. It was not a good thought. Continue.',
  ],
  short: [
    'Finally. I have been extremely brave about it.',
    'There you are. I checked the door twice. Fine, four times.',
    'Nothing happened while you were out. I checked. Twice.',
  ],
  day: [
    "You're back. I counted the hours. It was a lot of hours.",
    'Oh NOW you show up. I guarded the room the whole time. You are welcome.',
    "I mean — hey. Whatever. I wasn't waiting by the door or anything.",
  ],
  long: [
    'I had genuinely started a new life. Then I heard the door.',
    'You were gone so long I forgot what you smelled like. Then I remembered instantly.',
    'I want you to know I was fine. I was NOT fine. But I was fine.',
  ],
};

const LINES: Record<AwayBand, { anon: Line[] }> = {
  blink: {
    anon: [
      () => `You're back already. I had plans. They were bad plans.`,
      () => `Oh good. I was about to start talking to the wall again.`,
      () => `Back so soon? Suspicious. I like it.`,
    ],
  },
  short: {
    anon: [
      () => `You're back. I was starting to think the squirrels got you.`,
      () => `Oh, hey. I did absolutely nothing productive while you were gone. It was great.`,
      () => `Finally. The wall and I ran out of things to talk about.`,
    ],
  },
  day: {
    anon: [
      () => `You were gone a WHILE. I handled it. Mostly.`,
      () => `A whole day. I aged. Emotionally. Look at me.`,
      () => `You're back. I had almost finished the speech I was going to give you.`,
    ],
  },
  long: {
    anon: [
      () => `That was a long one. I have a lot to tell you and none of it is important.`,
      () => `I had almost moved on. Almost. Sit down.`,
      () => `You were gone for ages. I have been holding one specific thought this whole time and now it's gone.`,
    ],
  },
};

/**
 * A greeting for a return, or null if they never really left.
 * `seed` keeps it varied without needing randomness in tests.
 */
export function returnGreeting(name: string | undefined, minutesAway: number, seed: number): string | null {
  const band = awayBand(minutesAway);
  if (!band) return null;
  const i = Math.abs(Math.trunc(seed));
  if (name) {
    const body = BODIES[band][i % BODIES[band].length];
    return `${name}. ${body}`;
  }
  const pool = LINES[band].anon;
  return pool[i % pool.length]('');
}

/**
 * Kept for the older call site and for tests: the 6-hours-plus greeting.
 * Prefer `returnGreeting`, which covers every length of absence.
 */
export function welcomeBack(name: string | undefined, seed: number): string {
  return returnGreeting(name, 8 * 60, seed) ?? '';
}

/**
 * Pull the player's name out of the stored facts.
 *
 * This matched `/name is (\w+)/` — a phrasing the app has never produced.
 * `describeFact` renders facts as `your person: name = Caleb`, so the pattern
 * missed every single time and every greeting silently fell back to the
 * no-name pool. The one thing the return moment is FOR is him knowing who you
 * are, and he has never once said it.
 *
 * Both shapes are accepted now: the real one, and the sentence phrasing in
 * case a summary or an older store still carries it.
 */
export function nameFromFacts(facts: string[]): string | undefined {
  for (const f of facts) {
    const m = f.match(/\bname\s*(?:=|is|:)\s*([A-Z][a-zA-Z'-]*)/);
    if (m) return m[1];
  }
  return undefined;
}
