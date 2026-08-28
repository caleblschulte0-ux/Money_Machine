/**
 * Every key Barkly persists, in one place.
 *
 * They used to be private constants inside `useBarkly`, which was fine while it
 * was the only thing that wrote them. The playtester loads whole saved lives
 * into the store, and a preset that writes `wallet-v1` while the app reads
 * `wallet-v2` would look exactly like a preset that does nothing — so both
 * sides now read the same list, and `__tests__/playtest.test.ts` checks that
 * the modules owning the other two agree with it.
 */

import { DEFAULT_PROFILE, profileKey } from './types';

export const SNAPSHOT_KEY = profileKey(DEFAULT_PROFILE, 'snapshot-v1');
export const LOCATION_KEY = profileKey(DEFAULT_PROFILE, 'location-v1');
export const CHARACTER_KEY = profileKey(DEFAULT_PROFILE, 'character-v1');
export const MUTE_KEY = profileKey(DEFAULT_PROFILE, 'mute-v1');
export const ONBOARDING_KEY = profileKey(DEFAULT_PROFILE, 'onboarding-v1');
export const WALLET_KEY = profileKey(DEFAULT_PROFILE, 'wallet-v1');
export const VOICE_KEY = profileKey(DEFAULT_PROFILE, 'voice-v1');
export const DEV_KEY = profileKey(DEFAULT_PROFILE, 'dev-v1');
export const ADVENTURE_KEY = profileKey(DEFAULT_PROFILE, 'adventure-v1');
/** Owned by barkly/memory.ts and world/stash.ts; listed so a save is complete. */
export const MEMORY_KEY = profileKey(DEFAULT_PROFILE, 'memory-v2');
export const MEMORY_LEGACY_KEY = profileKey(DEFAULT_PROFILE, 'memory-v1');
export const STASH_KEY = profileKey(DEFAULT_PROFILE, 'stash-v1');

/**
 * A whole Barkly, as it sits on disk. Anything not listed here is not part of
 * who he is, and anything here that a preset omits is CLEARED — a preset that
 * left a key behind would inherit a stranger's memories.
 */
export const ALL_SAVE_KEYS = [
  SNAPSHOT_KEY,
  LOCATION_KEY,
  CHARACTER_KEY,
  ONBOARDING_KEY,
  WALLET_KEY,
  ADVENTURE_KEY,
  MEMORY_KEY,
  MEMORY_LEGACY_KEY,
  STASH_KEY,
] as const;

/**
 * The onboarding key holds a BARE STRING, not JSON — `'done'` or nothing.
 *
 * Exported because a preset that wrote `{"step":"done"}` here looked completely
 * correct and sent every loaded save straight back to the welcome screen. The
 * value is now a shared constant rather than a literal typed out in two places.
 */
export const ONBOARDING_DONE = 'done';

/** Settings that belong to the DEVICE, not to a saved Barkly. Never overwritten. */
export const DEVICE_KEYS = [MUTE_KEY, VOICE_KEY, DEV_KEY] as const;
