/**
 * Barkly's inner life — little thought-bubble observations that surface while
 * he idles. Location- and time-aware, scripted (no model call), in character.
 */

import { LocationId } from './locations';

const UNIVERSAL = [
  'i could be napping right now. i am always partially napping.',
  'my tail is following me again.',
  'what if treats… but bigger',
  'i smelled that smell again. investigating later.',
  'note to self: the vacuum knows what it did.',
];

const BY_LOCATION: Record<LocationId, string[]> = {
  home: [
    'the window shows outside. i own outside.',
    'someone walked past the house. logged it.',
    'my bed is exactly the right amount of bed.',
    'i can hear the fridge thinking about opening.',
  ],
  park: [
    'that squirrel is back. bold. very bold.',
    'the grass smells like EVERYONE was here.',
    'duke thinks this is his park. incorrect.',
    'somewhere out there is the perfect stick.',
    'this fence has never once caught me.',
  ],
  town: [
    'the bakery is doing crimes of smell again.',
    'pigeons: overconfident. always.',
    'that lamppost and i have an understanding.',
    'someone dropped a crumb here in 2019. i remember.',
  ],
  beach: [
    'the sea keeps coming at me. i keep letting it.',
    'sand gets in everything. i respect the commitment.',
    'that gull looked at me. we both know what happened.',
    'i dug a hole and the sea filled it in. rude.',
    'seaweed: a snack? a foe? research ongoing.',
  ],
};

const NIGHT = [
  'the moon is just a big treat nobody can reach.',
  'night smells different. better? different.',
];

/**
 * Things he thinks about a cue YOU taught him.
 *
 * This is where the taught trick earns its keep between uses: he brings it up
 * himself, unprompted, which is the difference between a pet that has a
 * feature and a pet with something on his mind. It lives in the THOUGHT pool
 * rather than in anything he says aloud because thoughts are display-only --
 * a spoken line would have to exist in the recorded voice bank, and a cue is
 * whatever word the player invented.
 */
const ABOUT_A_CUE = [
  (cue: string) => `i still know what “${cue}” means. just sayin'.`,
  (cue: string) => `been practisin' “${cue}”. in my head. lookin' the same.`,
  (cue: string) => `say “${cue}”. no reason.`,
];

/**
 * Things he thinks about YOU.
 *
 * Every thought in this file was about the world: squirrels, the vacuum, the
 * sea. None of them were about the person the whole product is about, even
 * though he is sitting on a file of things they told him. Catching him
 * thinking about your sister's name when nobody asked him to is the cheapest
 * and most convincing proof in the app that any of it went in -- it is not a
 * reply, so it cannot be a trick of the conversation.
 *
 * Display-only, like the cue thoughts and for the same reason: the recorded
 * voice bank matches whole lines and these carry the player's own words.
 *
 * Two of the three shapes use only the VALUE, because a value is a noun and a
 * key is not always one -- "their likes is swimming" is the sentence you get
 * from being clever about it. The key-shaped line handles `likes`/`dislikes`
 * explicitly and otherwise reads the key as a possession, which is what the
 * possessive facts ("my sister is Mia") actually are.
 */
const ABOUT_YOU: ((key: string, value: string) => string)[] = [
  (_k, v) => `${v}. i still think about ${v}.`,
  (_k, v) => `${v} came up once. i've thought about it more than they have.`,
  (k, v) =>
    k === 'likes' ? `they like ${v}. filed. permanent.`
      : k === 'dislikes' ? `they don't like ${v}. neither do i now. solidarity.`
        : `their ${k.replace(/_/g, ' ')} is ${v}. i keep that one near the front.`,
];

/**
 * `key = value` -> the two halves, or null.
 *
 * His own name is skipped: he says it constantly out loud already, and "Sam. i
 * still think about Sam." from a dog standing next to Sam is not endearing.
 * Long values are cut at a word so a thought stays a thought.
 */
function factParts(fact: string): { key: string; value: string } | null {
  const eq = fact.indexOf('=');
  if (eq < 0) return null;
  const key = fact.slice(0, eq).trim().toLowerCase();
  let value = fact.slice(eq + 1).trim();
  if (!key || !value || key === 'name') return null;
  if (value.length > 26) {
    const cut = value.slice(0, 26);
    const space = cut.lastIndexOf(' ');
    value = (space > 8 ? cut.slice(0, space) : cut).replace(/[.,;:]$/, '');
  }
  return { key, value };
}

/** Pick a thought; `seed` keeps tests deterministic. */
export function pickThought(
  location: LocationId,
  hour: number,
  seed: number,
  cues: string[] = [],
  facts: string[] = [],
): string {
  const pool = [...UNIVERSAL, ...BY_LOCATION[location], ...(hour >= 21 || hour < 6 ? NIGHT : [])];
  const n = Math.abs(seed);
  // A taught cue is rarer than the ambient pool on purpose: every third idle
  // thought being "say IRS" is nagging, not character.
  if (cues.length > 0 && n % 4 === 0) {
    const cue = cues[n % cues.length];
    return ABOUT_A_CUE[n % ABOUT_A_CUE.length](cue);
  }
  // And a thought about them is rarer still. It lands hardest when it is not
  // expected, and a dog who brings up your business every other minute is a
  // dog reciting a database.
  if (n % 5 === 2) {
    const usable = facts.map(factParts).filter((f): f is { key: string; value: string } => f !== null);
    if (usable.length > 0) {
      const f = usable[n % usable.length];
      return ABOUT_YOU[n % ABOUT_YOU.length](f.key, f.value);
    }
  }
  return pool[n % pool.length];
}
