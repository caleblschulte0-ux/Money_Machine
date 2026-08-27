/**
 * Barkly's real voice: synthesized server-side, cached, played through
 * expo-audio.
 *
 * The app sends TEXT and gets AUDIO. It never holds the vendor key, and it
 * never names the voice — which voice is Barkly is a product decision that
 * lives in the proxy's config, so a modified build cannot make him someone
 * else. (See ../../server/lib/voice.mjs.)
 *
 * Every failure path here ends in `false` rather than an exception: the voice
 * engine above falls through to the device voice, and a child hears Barkly in
 * a worse voice rather than hearing nothing at all.
 */

import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';
import { clipKey, createVoiceCache, VoiceCache } from '../../audio/voiceCache';

export interface BarklyVoiceConfig {
  /** The proxy base URL. Without it there is no voice — by design. */
  baseURL?: string;
  appToken?: string;
  deviceId?: string;
  timeoutMs?: number;
  cache?: VoiceCache;
  /** Injected in tests. */
  fetchImpl?: typeof fetch;
}

export interface VoicePlayback {
  /** Resolves when playback finishes, is interrupted, or fails. */
  done: Promise<void>;
  stop(): void;
}

export interface BarklyVoice {
  readonly name: string;
  isAvailable(): boolean;
  /** null when this line could not be synthesized — caller falls back. */
  play(text: string, opts?: { onStart?: () => void }): Promise<VoicePlayback | null>;
  warm(text: string): Promise<void>;
  clearCache(): void;
}

const DEFAULT_TIMEOUT_MS = 8000;

/** Audio session: duck other audio, keep working on silent, never background. */
export async function configureAudioSession(): Promise<void> {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      // Barkly is a short interjection over whatever else is playing, not a
      // media session that should pause someone's music.
      interruptionMode: 'duckOthers',
      shouldPlayInBackground: false,
      allowsRecording: false,
    });
  } catch {
    // An older runtime or the web shim: defaults are acceptable.
  }
}

function toUri(bytes: ArrayBuffer): string | null {
  // Web has blob URLs; native players want a URI they can open. A base64 data
  // URI works for both and needs no filesystem permission.
  try {
    const makeUrl = (globalThis as { URL?: { createObjectURL?: (b: Blob) => string } }).URL
      ?.createObjectURL;
    if (Platform.OS === 'web' && typeof Blob !== 'undefined' && makeUrl) {
      return makeUrl(new Blob([bytes], { type: 'audio/mpeg' }));
    }
  } catch {
    /* fall through to data URI */
  }
  try {
    const view = new Uint8Array(bytes);
    let binary = '';
    const CHUNK = 0x8000; // avoid blowing the argument limit on long clips
    for (let i = 0; i < view.length; i += CHUNK) {
      binary += String.fromCharCode(...view.subarray(i, i + CHUNK));
    }
    const b64 = typeof btoa === 'function' ? btoa(binary) : null;
    return b64 ? `data:audio/mpeg;base64,${b64}` : null;
  } catch {
    return null;
  }
}

export function createBarklyVoice(config: BarklyVoiceConfig): BarklyVoice {
  const cache = config.cache ?? createVoiceCache();
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const doFetch = config.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const available = Boolean(config.baseURL);
  const endpoint = `${(config.baseURL || '').replace(/\/+$/, '')}/v1/voice`;
  const voiceTag = config.baseURL || 'unconfigured';

  async function synthesize(text: string): Promise<string | null> {
    const key = clipKey(voiceTag, text);
    const hit = cache.get(key);
    if (hit) return hit.uri;
    if (!available) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (config.appToken) headers['x-barkly-app-token'] = config.appToken;
      if (config.deviceId) headers['x-barkly-device'] = config.deviceId;

      const res = await doFetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
      // Includes 503 "no voice configured" — a normal state, not an error.
      if (!res.ok) return null;

      const bytes = await res.arrayBuffer();
      if (bytes.byteLength === 0) return null;
      const uri = toUri(bytes);
      if (!uri) return null;
      cache.put(key, { uri, bytes: bytes.byteLength, at: Date.now() });
      return uri;
    } catch {
      return null; // offline, aborted, malformed — all mean "use the device voice"
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    name: `barkly-voice${available ? '' : ' (unconfigured)'}`,
    isAvailable: () => available,

    async warm(text: string): Promise<void> {
      await synthesize(text);
    },

    clearCache: () => cache.clear(),

    async play(text, opts): Promise<VoicePlayback | null> {
      const uri = await synthesize(text);
      if (!uri) return null;

      let player: ReturnType<typeof createAudioPlayer>;
      try {
        player = createAudioPlayer(uri);
      } catch {
        return null;
      }

      let settled = false;
      let finish: () => void = () => {};
      const done = new Promise<void>((resolve) => {
        finish = () => {
          if (settled) return;
          settled = true;
          try {
            player.remove();
          } catch {
            /* already gone */
          }
          resolve();
        };
      });

      // Three ways this ends, and all of them must end it: the clip finishes,
      // something goes wrong, or the estimate expires. A stuck player would
      // leave Barkly frozen mid-sentence, which is worse than a clipped line.
      let guard: ReturnType<typeof setTimeout> | undefined;
      try {
        player.addListener('playbackStatusUpdate', (status) => {
          if (status.didJustFinish) finish();
        });
        player.play();
        opts?.onStart?.();
        guard = setTimeout(finish, Math.min(2000 + text.length * 90, 20_000));
      } catch {
        finish();
      }

      return {
        done: done.finally(() => guard && clearTimeout(guard)),
        stop: () => {
          try {
            player.pause();
          } catch {
            /* already stopped */
          }
          finish();
        },
      };
    },
  };
}
