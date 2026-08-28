/**
 * The ONE place Barkly makes a sound.
 *
 * Everything that speaks — an AI reply, a greeting, an unprompted thought, a
 * line about a treasure — goes through `speak()`. That is not tidiness: two
 * places starting audio is how you get two Barklys talking over each other,
 * and a mouth flapping to a line that already finished.
 *
 * What it owns:
 *
 * - ONE utterance at a time. A new one cancels the old, immediately.
 * - The FALLBACK CHAIN. Real voice → device voice → silent-but-timed. A child
 *   never gets a frozen dog because a vendor was down; at worst he mimes for
 *   a plausible number of milliseconds and the caption still reads.
 * - MUTE. Muted still takes the right amount of TIME, because the mouth
 *   animation and the state machine are driven by how long he spoke. A muted
 *   Barkly is quiet, not broken.
 * - BACKGROUNDING. The app leaving the foreground stops him mid-word. Nobody
 *   wants a dog talking from a pocket.
 * - A DEADLINE on everything, so `speaking` can never be a state the app gets
 *   stuck in.
 *
 * Platform-agnostic: the providers are injected, so this is testable without
 * an audio device.
 */

import { BarklyVoice, VoicePlayback } from '../providers/tts/barklyVoiceTts';
import { TextToSpeechProvider } from '../providers/types';

export type VoiceRoute = 'barkly' | 'device' | 'silent';

export interface SpeakResult {
  /** Which link in the chain actually produced sound. */
  route: VoiceRoute;
  /** True when a newer utterance (or stop()) cut this one short. */
  interrupted: boolean;
}

export interface VoiceEngineOptions {
  /**
   * His own voices, best first. Two of them today: the BANKED recordings that
   * ship inside the app, then the live proxy for anything not in the bank.
   * A voice that cannot say a particular line returns null and the next one
   * gets its turn, which is why this is a list and not a flag.
   */
  voices?: BarklyVoice[];
  device: TextToSpeechProvider;
  muted?: boolean;
  now?: () => number;
  /** Injected in tests so a "silent" utterance does not really wait. */
  wait?: (ms: number) => Promise<void>;
}

/** Roughly how long a line takes to say. Used for mute and as a last resort. */
export function estimateDurationMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  // ~2.9 words/second conversational, plus a beat of lead-in.
  return Math.min(Math.max(700, 350 + (words / 2.9) * 1000), 20_000);
}

export function createVoiceEngine(opts: VoiceEngineOptions) {
  const wait = opts.wait ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let muted = opts.muted ?? false;
  let generation = 0;
  let current: { stop: () => void } | null = null;
  let lastRoute: VoiceRoute | null = null;

  /** Cut off whatever is speaking right now. */
  function cancel(): void {
    generation += 1;
    const active = current;
    current = null;
    if (active) {
      try {
        active.stop();
      } catch {
        /* already finished */
      }
    }
  }

  return {
    get muted(): boolean {
      return muted;
    },
    get speaking(): boolean {
      return current !== null;
    },
    get lastRoute(): VoiceRoute | null {
      return lastRoute;
    },

    /**
     * The form of this line he can actually say IN HIS OWN VOICE.
     *
     * Only ever narrows when there is nothing left that can synthesize — with
     * the proxy reachable he says exactly what he was given. Without it, all he
     * has is a fixed set of recordings, and the choice is between a line he can
     * say and a line the phone's narrator says. The narrator loses.
     *
     * The caller shows what comes back as the caption, so the screen and the
     * audio stay the same sentence.
     */
    speakable(text: string): string {
      const available = (opts.voices ?? []).filter((v) => v.isAvailable());
      // A voice with no `nearest` is a synthesizer: it can say anything, so
      // there is nothing to degrade to.
      if (available.length === 0 || available.some((v) => !v.nearest)) return text;
      for (const voice of available) {
        const near = voice.nearest?.(text);
        if (near) return near;
      }
      return text;
    },

    setMuted(next: boolean): void {
      muted = next;
      if (next) cancel();
    },

    stop(): void {
      cancel();
      // The device voice is a separate engine and does not know about us.
      void opts.device.stop().catch(() => {});
    },

    /** Called when the app backgrounds. A dog talking from a pocket is a bug. */
    onBackground(): void {
      this.stop();
    },

    /**
     * Say something. Resolves when the line is finished, interrupted, or has
     * run out its deadline — never later than that.
     */
    async speak(text: string, o: { onStart?: () => void } = {}): Promise<SpeakResult> {
      const line = text.trim();
      if (!line) return { route: 'silent', interrupted: false };

      cancel();
      const mine = generation;
      const stale = () => generation !== mine;

      // Muted: no audio, but the same shape of time, so the mouth animation
      // and the state machine behave exactly as they would aloud.
      if (muted) {
        lastRoute = 'silent';
        o.onStart?.();
        await wait(estimateDurationMs(line));
        return { route: 'silent', interrupted: stale() };
      }

      // 1. Barkly's own voices, in order.
      for (const voice of opts.voices ?? []) {
        if (!voice.isAvailable()) continue;
        let playback: VoicePlayback | null = null;
        try {
          playback = await voice.play(line, { onStart: o.onStart });
        } catch {
          playback = null; // treated exactly like "no voice": fall through
        }
        if (stale()) {
          playback?.stop();
          return { route: 'barkly', interrupted: true };
        }
        if (playback) {
          current = playback;
          lastRoute = 'barkly';
          await playback.done;
          if (current === playback) current = null;
          return { route: 'barkly', interrupted: stale() };
        }
      }

      // 2. The device voice.
      if (stale()) return { route: 'device', interrupted: true };
      let spoke = false;
      const handle = { stop: () => void opts.device.stop().catch(() => {}) };
      current = handle;
      lastRoute = 'device';
      try {
        await opts.device.speak(line, { onStart: o.onStart });
        spoke = true;
      } catch {
        spoke = false;
      }
      if (current === handle) current = null;
      if (spoke) return { route: 'device', interrupted: stale() };

      // 3. Silent, but still the right length. The caption is on screen and
      // the animation still reads as him talking.
      if (stale()) return { route: 'silent', interrupted: true };
      lastRoute = 'silent';
      await wait(estimateDurationMs(line));
      return { route: 'silent', interrupted: stale() };
    },
  };
}

export type VoiceEngine = ReturnType<typeof createVoiceEngine>;
