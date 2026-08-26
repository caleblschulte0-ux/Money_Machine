import { KeyValueStore } from './types';

/** Ephemeral store for tests and non-RN environments. */
export function createInMemoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    async get(key) { return map.has(key) ? map.get(key)! : null; },
    async set(key, value) { map.set(key, value); },
    async remove(key) { map.delete(key); },
  };
}
