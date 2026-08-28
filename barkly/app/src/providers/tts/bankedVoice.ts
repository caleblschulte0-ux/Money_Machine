/**
 * Barkly's voice, pre-recorded.
 *
 * Everything else in the voice chain needs something: the real voice needs the
 * proxy running on a machine you control, the device voice needs the phone's
 * narrator (which is a bus announcement wearing a dog costume). This one needs
 * nothing at all — the audio is inside the app.
 *
 * It only knows his FIXED lines: greetings, feed and play reactions, idle
 * thoughts, mishaps, the things he says to the other dogs, level-ups. That is
 * most of what you hear in an ordinary session, and all of what you hear before
 * you have typed anything. His conversational replies weave in your words and
 * your name, so they are infinite, so they are not here, so they fall through
 * to the next link in the chain. `scripts/voice-bank.mjs check` prints the real
 * split rather than a number somebody hoped for.
 *
 * Lookup is an exact string match on the line AFTER the dialect layer, because
 * that is the text the voice engine is handed. Keying it on the source spelling
 * would miss every time, silently, and leave a bank nobody could hear.
 */

import { createAudioPlayer } from 'expo-audio';
import { VOICE_BANK, BANKED_LINE_COUNT } from '../../audio/voiceBank';
import { estimateDurationMs } from '../../audio/voiceEngine';
import { splitLeadingName } from '../../barkly/dialect';
import type { BarklyVoice, VoicePlayback } from './barklyVoiceTts';

/**
 * How long to wait on a clip before assuming it is never going to finish.
 *
 * Tied to the LENGTH OF THE LINE rather than a flat number, because the failure
 * this catches is a clip that never loads at all — a stale asset, a build that
 * did not bundle the audio — and a flat 20 seconds would mean twenty seconds of
 * a dog standing there with his mouth open. Twice the time the line should take,
 * plus a beat, is generous to a slow device and still gets him unstuck fast.
 */
function deadlineFor(text: string): number {
  return estimateDurationMs(text) * 2 + 1500;
}

export interface BankedVoiceOptions {
  /** Injected in tests, and the seam a future on-disk cache would use. */
  bank?: Record<string, number | string>;
  createPlayer?: typeof createAudioPlayer;
}

/**
 * Normalise for lookup, not for speech.
 *
 * A line can pick up a trailing space or a stray non-breaking space on its way
 * through the app, and a bank that misses on whitespace looks exactly like a
 * bank that is not working at all.
 */
function lookupKey(text: string): string {
  return text.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * "Caleb. Dere ya are. I was about to start makin' decisions on my own."
 *
 * The BODY of that is recorded. The name in front of it is not, and never can
 * be — it is whatever a child typed at the welcome screen. Before this, the
 * whole line missed and he greeted you in the browser's narrator: his single
 * most characteristic line, in the one voice this feature exists to avoid.
 *
 * So when the name is the entire first sentence, offer the rest. The caller
 * shows the caption it gets back, so what is on screen is what he says — this
 * drops the name from BOTH, it does not desync them.
 */
function withoutLeadingName(text: string): string | null {
  const [name, rest] = splitLeadingName(text);
  return name ? rest : null;
}

export function createBankedVoice(opts: BankedVoiceOptions = {}): BarklyVoice {
  const bank = opts.bank ?? VOICE_BANK;
  const makePlayer = opts.createPlayer ?? createAudioPlayer;
  const size = Object.keys(bank).length;

  return {
    name: 'banked',

    /** An empty bank is not a broken voice, it is simply nothing to say yet. */
    isAvailable(): boolean {
      return size > 0;
    },

    nearest(text: string): string | null {
      if (bank[lookupKey(text)] !== undefined) return text;
      const stripped = withoutLeadingName(text);
      if (stripped && bank[lookupKey(stripped)] !== undefined) return stripped;
      return null;
    },

    async play(text: string, o: { onStart?: () => void } = {}): Promise<VoicePlayback | null> {
      const source = bank[lookupKey(text)];
      if (source === undefined) return null; // not a fixed line — next link

      let player: ReturnType<typeof createAudioPlayer>;
      try {
        player = makePlayer(source as never);
      } catch {
        return null;
      }

      let settle: () => void = () => {};
      const done = new Promise<void>((resolve) => {
        settle = resolve;
      });

      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(deadline);
        try {
          player.remove();
        } catch {
          /* already gone */
        }
        settle();
      };

      // Every path out is bounded. A clip that never reports finishing would
      // otherwise leave him stuck mid-sentence with his mouth open, and the
      // state machine waits on this promise.
      const deadline = setTimeout(finish, deadlineFor(text));

      try {
        player.addListener(
          'playbackStatusUpdate',
          (status: { didJustFinish?: boolean; isLoaded?: boolean; error?: unknown }) => {
            // A clip that reports an error is finished as far as he is
            // concerned: better a short silence than a long one.
            if (status?.didJustFinish || status?.error) finish();
          },
        );
        player.play();
        o.onStart?.();
      } catch {
        finish();
        return null;
      }

      return {
        done,
        stop() {
          try {
            player.pause();
          } catch {
            /* nothing to pause */
          }
          finish();
        },
      };
    },

    /** Nothing to warm: it is already on the device. */
    async warm(): Promise<void> {},
    clearCache(): void {},
  };
}

export { BANKED_LINE_COUNT };
