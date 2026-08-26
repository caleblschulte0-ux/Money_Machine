/**
 * Storage abstraction. Memory logic depends on this interface only, so the
 * backing store can move from on-device AsyncStorage to a synced backend
 * without touching brain code.
 */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/**
 * All Barkly data is namespaced per profile so parental controls /
 * multi-child support can be added later without a data migration.
 */
export const DEFAULT_PROFILE = 'default';

export function profileKey(profile: string, key: string): string {
  return `barkly/profile/${profile}/${key}`;
}
