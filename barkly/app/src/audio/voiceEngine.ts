/**
 * The ONE place Barkly makes a sound.
 *
 * Everything that speaks goes through `speak()`: AI replies, greetings,
 * reactions and story lines. The engine owns interruption, fallback, mute and
 * timing, and now also publishes the active Barkly line so the dialogue rail
 * can stage an NPC's unvoiced response AFTER Barkly has finished.
 */

import { BarklyVoice, VoicePlayback } from '../providers/tts/barklyVoiceTts';
import { TextToSpeechProvider } from '../providers/types';
import { beginVoiceActivity, clearVoiceActivity, endVoiceActivity } from './voiceActivity';

export type VoiceRoute = 'barkly' | 'device' | 'silent';

export interface SpeakResult {
  route: VoiceRoute;
  interrupted: boolean;
}

export interface VoiceEngineOptions {
  voices?: BarklyVoice[];
  device: TextToSpeechProvider;
  muted?: boolean;
  now?: () => number;
  wait?: (ms: number) => Promise<void>;
}

export function estimateDurationMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(Math.max(700, 350 + (words / 2.9) * 1000), 20_000);
}

export function createVoiceEngine(opts: VoiceEngineOptions) {
  const wait = opts.wait ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let muted = opts.muted ?? false;
  let generation = 0;
  let current: { stop: () => void } | null = null;
  let lastRoute: VoiceRoute | null = null;
  let activityToken: number | null = null;

  function endActivity() {
    if (activityToken === null) return;
    endVoiceActivity(activityToken);
    activityToken = null;
  }

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
    endActivity();
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

    speakable(text: string): string {
      const available = (opts.voices ?? []).filter((v) => v.isAvailable());
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
      clearVoiceActivity();
      void opts.device.stop().catch(() => {});
    },

    onBackground(): void {
      this.stop();
    },

    async speak(text: string, o: { onStart?: () => void } = {}): Promise<SpeakResult> {
      const line = text.trim();
      if (!line) return { route: 'silent', interrupted: false };

      cancel();
      const mine = generation;
      const stale = () => generation !== mine;
      activityToken = beginVoiceActivity(line);

      const finish = (result: SpeakResult): SpeakResult => {
        endActivity();
        return result;
      };

      if (muted) {
        lastRoute = 'silent';
        o.onStart?.();
        await wait(estimateDurationMs(line));
        return finish({ route: 'silent', interrupted: stale() });
      }

      for (const voice of opts.voices ?? []) {
        if (!voice.isAvailable()) continue;
        let playback: VoicePlayback | null = null;
        try {
          playback = await voice.play(line, { onStart: o.onStart });
        } catch {
          playback = null;
        }
        if (stale()) {
          playback?.stop();
          return finish({ route: 'barkly', interrupted: true });
        }
        if (playback) {
          current = playback;
          lastRoute = 'barkly';
          await playback.done;
          if (current === playback) current = null;
          return finish({ route: 'barkly', interrupted: stale() });
        }
      }

      if (stale()) return finish({ route: 'device', interrupted: true });
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
      if (spoke) return finish({ route: 'device', interrupted: stale() });

      if (stale()) return finish({ route: 'silent', interrupted: true });
      lastRoute = 'silent';
      await wait(estimateDurationMs(line));
      return finish({ route: 'silent', interrupted: stale() });
    },
  };
}

export type VoiceEngine = ReturnType<typeof createVoiceEngine>;
