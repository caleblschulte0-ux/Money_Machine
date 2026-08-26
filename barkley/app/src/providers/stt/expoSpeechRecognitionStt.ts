/**
 * On-device speech-to-text via expo-speech-recognition
 * (iOS SFSpeechRecognizer / Android SpeechRecognizer).
 *
 * No API key, no audio leaves the recognizer, capture runs strictly between
 * start() and stop() — which is exactly the child-safety posture we want.
 *
 * Requires a DEV BUILD (`npx expo run:ios|android`): the native module does
 * not exist inside Expo Go. We therefore lazy-require it and report
 * unavailable instead of crashing; the UI then falls back to typed input.
 */

import { SpeechToTextProvider, SttResult } from '../types';

type SpeechModule = typeof import('expo-speech-recognition').ExpoSpeechRecognitionModule;

function loadModule(): SpeechModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-speech-recognition') as typeof import('expo-speech-recognition');
    return mod.ExpoSpeechRecognitionModule ?? null;
  } catch {
    return null; // Expo Go / module not linked
  }
}

export function createExpoSpeechRecognitionStt(lang = 'en-US'): SpeechToTextProvider {
  const module = loadModule();

  let finalTranscript = '';
  let lastPartial = '';
  let subscriptions: Array<{ remove(): void }> = [];
  let endResolvers: Array<() => void> = [];

  const cleanup = () => {
    subscriptions.forEach((s) => s.remove());
    subscriptions = [];
  };

  const signalEnd = () => {
    endResolvers.forEach((r) => r());
    endResolvers = [];
  };

  return {
    name: 'expo-speech-recognition',

    async isAvailable() {
      if (!module) return false;
      try {
        return module.isRecognitionAvailable();
      } catch {
        return false;
      }
    },

    async requestPermissions() {
      if (!module) return false;
      const result = await module.requestPermissionsAsync();
      return result.granted;
    },

    async start(opts) {
      if (!module) throw new Error('Speech recognition native module unavailable');
      finalTranscript = '';
      lastPartial = '';
      cleanup();
      subscriptions.push(
        module.addListener('result', (event) => {
          const text = event.results?.[0]?.transcript ?? '';
          if (event.isFinal) finalTranscript = text;
          else {
            lastPartial = text;
            opts?.onPartial?.(text);
          }
        }),
        module.addListener('error', () => signalEnd()),
        module.addListener('end', () => signalEnd()),
      );
      module.start({ lang, interimResults: true, continuous: false, maxAlternatives: 1 });
    },

    async stop(): Promise<SttResult> {
      if (!module) return { transcript: '' };
      // Wait for the recognizer's own "end" so the final result can land.
      const ended = new Promise<void>((resolve) => {
        endResolvers.push(resolve);
        setTimeout(resolve, 5000); // never hang the UI on a wedged recognizer
      });
      module.stop();
      await ended;
      cleanup();
      return { transcript: (finalTranscript || lastPartial).trim() };
    },

    async cancel() {
      if (!module) return;
      try {
        module.abort();
      } finally {
        cleanup();
        signalEnd();
      }
    },
  };
}
