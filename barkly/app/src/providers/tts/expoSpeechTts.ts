/**
 * The device voice — the fallback link in the chain, and the ONLY voice in the
 * published web demo, because a static page cannot reach the proxy that does
 * real neural TTS.
 *
 * So the default matters. Left alone, the platform hands you whatever voice is
 * first in its list, which on most machines is the flat robotic one, and that
 * is what "fix the voices" is about.
 *
 * What this does instead:
 *
 * - PICKS DELIBERATELY. It scores the installed voices and takes the best
 *   English one, strongly preferring the modern neural voices (Google/
 *   Microsoft Natural, Apple's premium set) over the legacy formant voices
 *   that make him sound like a 1998 screen reader.
 * - PITCHES HIM UP. Barkly is a small dog. A normal adult narrator voice at
 *   +25% pitch and slightly fast reads as small and impatient, which is the
 *   character.
 * - PICKS ONCE. Enumerating voices is async and on web the list is often
 *   empty until the engine warms up, so the choice is made lazily, cached,
 *   and retried until the list appears rather than latching onto nothing.
 *
 * The real voice is server-side (barkly/server/tts/say.py). This is what you
 * get without it.
 */

import * as Speech from 'expo-speech';
import { TextToSpeechProvider } from '../types';

/** Barkly is small: up in pitch, a touch fast, never a narrator. */
const PITCH = 1.32;
const RATE = 1.06;

/** Voices that sound like a person. Higher is better. */
function scoreVoice(v: Speech.Voice): number {
  const name = `${v.name ?? ''} ${v.identifier ?? ''}`.toLowerCase();
  const lang = (v.language ?? '').toLowerCase();
  if (!lang.startsWith('en')) return -1;

  let score = 0;
  // Modern neural families, in rough order of how human they sound.
  if (/natural/.test(name)) score += 60; // Microsoft * Natural
  if (/neural/.test(name)) score += 55;
  if (/premium|enhanced/.test(name)) score += 50; // Apple premium voices
  if (/google/.test(name)) score += 45;
  // Named Apple voices that are markedly better than the default.
  if (/\b(daniel|serena|arthur|oliver|jamie|matilda)\b/.test(name)) score += 25;
  // The legacy formant voices. These are the ones that sound like a robot.
  if (/\b(albert|zarvox|trinoids|bells|bad news|whisper|organ|cellos|bubbles|jester|superstar|wobble|rocko|shelley|sandy|grandma|grandpa|eddy|flo|reed|rishi)\b/.test(name)) {
    score -= 80;
  }
  if (/compact|espeak/.test(name)) score -= 60;
  // A male-ish voice pitched up lands closer to a small dog than a female
  // voice pitched up, which tends to go shrill.
  if (/\b(male|man|daniel|arthur|oliver|guy|ryan|christopher|brian)\b/.test(name)) score += 12;
  if (/en-gb|en_gb|united kingdom|\buk\b/.test(`${lang} ${name}`)) score += 8; // dry delivery suits him
  return score;
}

export function createExpoSpeechTts(): TextToSpeechProvider {
  let chosen: string | undefined;
  let settled = false;

  /**
   * Choose once, but do not latch onto an empty list: on web the voice list
   * is frequently empty for the first few hundred ms after load, and a
   * provider that decides "none" then is stuck with the default forever.
   */
  async function ensureVoice(): Promise<string | undefined> {
    if (settled) return chosen;
    try {
      // NEVER let voice discovery block speaking. On some web engines
      // getAvailableVoicesAsync() simply never settles, and awaiting it
      // straight would hang speak() forever — which strands the whole app in
      // "speaking", because that is what the UI waits on. Picking a nicer
      // voice is an improvement; being able to talk at all is the feature.
      const voices = await Promise.race([
        Speech.getAvailableVoicesAsync(),
        new Promise<Speech.Voice[]>((resolve) => setTimeout(() => resolve([]), 400)),
      ]);
      if (!voices || voices.length === 0) return undefined; // try again next time
      const best = voices
        .map((v) => ({ v, s: scoreVoice(v) }))
        .filter((x) => x.s >= 0)
        .sort((a, b) => b.s - a.s)[0];
      chosen = best?.v.identifier;
      settled = true;
    } catch {
      settled = true; // no voice API here; the platform default it is
    }
    return chosen;
  }

  return {
    name: 'device-voice',

    async isAvailable() {
      return true;
    },

    async speak(text, opts) {
      const line = text.trim();
      if (!line) return;
      const voice = await ensureVoice();

      return new Promise<void>((resolve) => {
        // Some environments (headless browsers, muted webviews) never fire
        // speech events. Resolve on a reading-time estimate as a backstop so
        // the UI can never get stuck in "speaking".
        const fallback = setTimeout(resolve, Math.min(1500 + line.length * 80, 15000));
        const done = () => {
          clearTimeout(fallback);
          resolve();
        };
        try {
          Speech.speak(line, {
            voice,
            pitch: PITCH,
            rate: RATE,
            language: 'en-US',
            onStart: opts?.onStart,
            onDone: done,
            onStopped: done,
            onError: done, // a silent Barkly beats a hung UI
          });
        } catch {
          done();
        }
      });
    },

    async stop() {
      await Speech.stop();
    },
  };
}
