/**
 * Loading a whole saved Barkly, safely, and putting the old one back.
 *
 * Two rules, and both exist because a playtester who cannot get his own dog
 * back will stop using the playtester:
 *
 *   YOUR SAVE IS COPIED FIRST. The first time a preset is loaded, whatever was
 *   in the store is written to a backup slot and left there. It is not
 *   overwritten by later preset loads — the backup is your REAL Barkly, not
 *   the preset you were on ten seconds ago.
 *
 *   DEVICE SETTINGS ARE NEVER TOUCHED. Mute, the chosen voice shape and the dev
 *   flag belong to the phone, not to a saved life. Loading a preset must not
 *   unmute a muted app in front of somebody.
 *
 * Presets are written straight into the key-value store the game hydrates from,
 * and then the app is restarted, because hydration happens once at launch. That
 * is the whole trick: no special "preset mode" exists at runtime, so every
 * downstream system reads a preset exactly the way it reads a real save. There
 * is nothing to keep in sync and nothing to get wrong later.
 */

import { KeyValueStore } from '../storage/types';
import { ALL_SAVE_KEYS } from '../storage/keys';
import { presetById, Save } from './presets';

const ACTIVE_KEY = 'barkly/playtest/active-v1';
const BACKUP_KEY = 'barkly/playtest/backup-v1';

export interface ActiveSlot {
  id: string;
  name: string;
  at: number;
}

export async function activeSlot(store: KeyValueStore): Promise<ActiveSlot | null> {
  try {
    const raw = await store.get(ACTIVE_KEY);
    return raw ? (JSON.parse(raw) as ActiveSlot) : null;
  } catch {
    return null;
  }
}

export async function hasBackup(store: KeyValueStore): Promise<boolean> {
  return Boolean(await store.get(BACKUP_KEY));
}

/** Read every save key into one object. Missing keys are simply absent. */
export async function readSave(store: KeyValueStore): Promise<Save> {
  const out: Save = {};
  for (const key of ALL_SAVE_KEYS) {
    const value = await store.get(key);
    if (value !== null && value !== undefined) out[key] = value;
  }
  return out;
}

/**
 * Write a save. Keys the save does not mention are REMOVED, not left alone:
 * a preset that inherited the previous dog's stash would be a different dog
 * every time depending on what you loaded before it.
 */
export async function writeSave(store: KeyValueStore, save: Save): Promise<void> {
  for (const key of ALL_SAVE_KEYS) {
    const value = save[key];
    if (value === undefined || value === '') await store.remove(key);
    else await store.set(key, value);
  }
}

export interface LoadResult {
  ok: boolean;
  /** True when this load is what created the backup of the tester's own save. */
  backedUp: boolean;
}

export async function loadPreset(
  store: KeyValueStore,
  id: string,
  now: number = Date.now(),
): Promise<LoadResult> {
  const preset = presetById(id);
  if (!preset) return { ok: false, backedUp: false };

  // Only the FIRST load backs up: after that the current state is a preset,
  // and copying it over the backup would lose the real save for good.
  let backedUp = false;
  if (!(await hasBackup(store))) {
    await store.set(BACKUP_KEY, JSON.stringify(await readSave(store)));
    backedUp = true;
  }

  await writeSave(store, preset.build(now));
  await store.set(ACTIVE_KEY, JSON.stringify({ id: preset.id, name: preset.name, at: now }));
  return { ok: true, backedUp };
}

/** Put the tester's own Barkly back and forget the playtest session. */
export async function restoreBackup(store: KeyValueStore): Promise<boolean> {
  const raw = await store.get(BACKUP_KEY);
  if (!raw) return false;
  try {
    await writeSave(store, JSON.parse(raw) as Save);
  } catch {
    return false;
  }
  await store.remove(BACKUP_KEY);
  await store.remove(ACTIVE_KEY);
  return true;
}

/**
 * Restart so hydration re-reads the store. Web only in practice, which is where
 * the playtesting happens; on a device the tester closes and reopens the app,
 * and the menu says so rather than pretending a button did it.
 */
export function canRestart(): boolean {
  const w = globalThis as { location?: { reload?: () => void } };
  return typeof w.location?.reload === 'function';
}

export function restart(): void {
  const w = globalThis as { location?: { reload?: () => void } };
  w.location?.reload?.();
}
