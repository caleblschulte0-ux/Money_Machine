/**
 * On-device text-to-speech via expo-speech. Free, offline, works in Expo Go —
 * the reliable MVP default. Pitch/rate are tuned to be small-dog-ish without
 * being grating; the real recorded-quality Barkley voice arrives via the
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
        Speech.speak(text, {
          pitch: 1.25,
          rate: 1.05,
          language: 'en-US',
          onStart: opts?.onStart,
          onDone: () => resolve(),
          onStopped: () => resolve(),
          onError: () => resolve(), // a silent Barkley beats a hung UI
        });
      });
    },

    async stop() {
      await Speech.stop();
    },
  };
}
