/**
 * Content-addressed cache for synthesized speech.
 *
 * Barkly repeats himself a lot on purpose — greetings, feed lines, thoughts,
 * "no. nap." — and every repeat is a paid synthesis and a network round trip
 * a child has to wait through. Cached by a hash of (voice, text), a repeated
 * line plays instantly and costs nothing.
 *
 * Deliberately in-memory and bounded. A persistent on-disk cache would be
 * better still, but it needs expo-file-system and a size/eviction policy on a
 * child's device; this is the seam it goes behind when it earns it, and until
 * then the file says so instead of pretending.
 */

export interface CachedClip {
  /** A URI a player can take: blob: on web, data: elsewhere. */
  uri: string;
  bytes: number;
  at: number;
}

/** Small: a session's worth of repeated lines, not a library. */
const MAX_ENTRIES = 24;
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;

/** FNV-1a — short, stable, and not a security boundary. */
export function clipKey(voice: string, text: string): string {
  let h = 0x811c9dc5;
  const s = `${voice}::${text.trim().toLowerCase()}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${h.toString(36)}-${s.length.toString(36)}`;
}

export function createVoiceCache(
  { maxEntries = MAX_ENTRIES, maxBytes = MAX_TOTAL_BYTES } = {},
) {
  const entries = new Map<string, CachedClip>();
  let total = 0;

  const evictUntilFits = (incoming: number) => {
    while (entries.size >= maxEntries || total + incoming > maxBytes) {
      // Map preserves insertion order, and `get` re-inserts on hit, so the
      // first key is the least recently used.
      const oldest = entries.keys().next();
      if (oldest.done) break;
      const clip = entries.get(oldest.value);
      entries.delete(oldest.value);
      total -= clip?.bytes ?? 0;
      release(clip);
    }
  };

  return {
    get(key: string): CachedClip | undefined {
      const hit = entries.get(key);
      if (!hit) return undefined;
      entries.delete(key); // reinsert so it becomes most-recently-used
      entries.set(key, hit);
      return hit;
    },

    put(key: string, clip: CachedClip): void {
      if (entries.has(key)) return;
      if (clip.bytes > maxBytes) return; // one clip must not evict everything
      evictUntilFits(clip.bytes);
      entries.set(key, clip);
      total += clip.bytes;
    },

    clear(): void {
      for (const clip of entries.values()) release(clip);
      entries.clear();
      total = 0;
    },

    get size(): number {
      return entries.size;
    },
    get bytes(): number {
      return total;
    },
  };
}

/** Blob URLs are a real leak if they are never revoked. Data URIs are not. */
function release(clip?: CachedClip): void {
  if (!clip?.uri.startsWith('blob:')) return;
  try {
    (globalThis as { URL?: { revokeObjectURL?: (u: string) => void } }).URL?.revokeObjectURL?.(
      clip.uri,
    );
  } catch {
    /* nothing to release */
  }
}

export type VoiceCache = ReturnType<typeof createVoiceCache>;
