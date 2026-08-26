/**
 * On-device text-to-speech via expo-speech. Free, offline, works in Expo Go —
 * the reliable MVP default. Pitch/rate are tuned to be small-dog-ish without
 * being grating; the real recorded-quality Barkly voice arrives via the
 * ElevenLabs adapter later.
 */

import * as Speech from 'expo-speech';
import { TextToSpeechProvider } from '../types';

export function createExpoSpeechTts(): TextToSpeechProvider {
  return {
    name: 'expo-speech',

    async isAvailable() {
      return true;
    },

    speak(text, opts) {
      return new Promise<void>((resolve) => {
        if (!text.trim()) {
          resolve();
          return;
        }
        // Some environments (headless browsers, muted webviews) never fire
        // speech events. Resolve on a reading-time estimate as a backstop so
        // the UI can never get stuck in "speaking".
        const fallback = setTimeout(resolve, Math.min(1500 + text.length * 80, 15000));
        const done = () => {
          clearTimeout(fallback);
          resolve();
        };
        try {
          Speech.speak(text, {
            pitch: 1.25,
            rate: 1.05,
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
