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

/** Pick a thought; `seed` keeps tests deterministic. */
export function pickThought(location: LocationId, hour: number, seed: number): string {
  const pool = [...UNIVERSAL, ...BY_LOCATION[location], ...(hour >= 21 || hour < 6 ? NIGHT : [])];
  return pool[Math.abs(seed) % pool.length];
}
