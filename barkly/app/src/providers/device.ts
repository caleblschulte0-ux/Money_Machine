/**
 * A stable, anonymous per-install id.
 *
 * The backend needs SOMETHING to rate-limit and budget against, or one leaked
 * build drains the account and every child on a shared network gets throttled
 * together. This is that something, and it is deliberately the least
 * identifying thing that does the job:
 *
 * - random, generated on this device, never derived from hardware or account
 * - stored locally only, and cleared by "Forget Everything" like any other
 *   Barkly state
 * - hashed again on the server before it is written to a log
 *
 * It is not a user id. It cannot be joined to anything. It exists to answer
 * "is this the same install that just sent four hundred requests?"
 */

import { KeyValueStore } from '../storage/types';

export const DEVICE_KEY = 'barkly:device-id-v1';

let cached: string | null = null;

function randomId(): string {
  // Not crypto — this is a bucket key, not a secret.
  let out = '';
  for (let i = 0; i < 4; i++) out += Math.random().toString(36).slice(2, 10);
  return out.slice(0, 24);
}

/** Load (or create and persist) the id. Idempotent; safe to call on every boot. */
export async function loadDeviceId(store: KeyValueStore): Promise<string> {
  if (cached) return cached;
  try {
    const existing = await store.get(DEVICE_KEY);
    if (existing && existing.length >= 8) {
      cached = existing;
      return cached;
    }
  } catch {
    // Storage unavailable (private mode, corrupted store). A session-only id
    // is still better than none — the app must not fail to boot over this.
  }
  cached = randomId();
  try {
    await store.set(DEVICE_KEY, cached);
  } catch {
    /* session-only */
  }
  return cached;
}

/** Whatever we have right now, without waiting. Undefined before the first load. */
export function currentDeviceId(): string | undefined {
  return cached ?? undefined;
}

/** Used by "Forget Everything": a fresh install identity, same as a reinstall. */
export async function resetDeviceId(store: KeyValueStore): Promise<void> {
  cached = null;
  try {
    await store.remove(DEVICE_KEY);
  } catch {
    /* nothing to do */
  }
}
