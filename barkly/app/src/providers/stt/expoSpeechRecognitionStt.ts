/**
 * Strictly on-device speech-to-text via expo-speech-recognition
 * (iOS SFSpeechRecognizer / Android SpeechRecognizer).
 *
 * PRIVACY INVARIANT: Barkly never starts this provider unless the device
 * reports on-device recognition support, and every recognition request sets
 * requiresOnDeviceRecognition=true. A device that cannot honor that invariant
 * is treated as STT-unavailable and the UI falls back to typed input.
 *
 * Capture runs strictly between start() and stop(). Barkly does not persist
 * microphone audio or configure recordingOptions/audioSource.
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

  const supportsPrivateRecognition = (): boolean => {
    if (!module) return false;
    try {
      return module.isRecognitionAvailable() && module.supportsOnDeviceRecognition();
    } catch {
      return false;
    }
  };

  return {
    name: 'expo-speech-recognition-on-device',

    async isAvailable() {
      return supportsPrivateRecognition();
    },

    async requestPermissions() {
      // Do not ask for microphone/speech-recognition permission on a device
      // where Barkly would be unable to honor the on-device-only contract.
      if (!supportsPrivateRecognition() || !module) return false;
      const result = await module.requestPermissionsAsync();
      return result.granted;
    },

    async start(opts) {
      if (!module || !supportsPrivateRecognition()) {
        throw new Error('On-device speech recognition is unavailable');
      }
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
      module.start({
        lang,
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
        requiresOnDeviceRecognition: true,
      });
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
