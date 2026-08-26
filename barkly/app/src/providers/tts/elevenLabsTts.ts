/**
 * ElevenLabs TTS adapter — STUB.
 *
 * This is the slot for Barkly's real, character-consistent voice. It is not
 * implemented yet because it requires (a) an ElevenLabs account + API key and
 * (b) a designed/cloned Barkly voice ID — both product decisions, not code.
 *
 * What implementing it takes:
 *  1. Backend proxy endpoint (never ship the ElevenLabs key in the app) that
 *     calls POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}
 *     and streams back audio.
 *  2. Play the returned audio here with expo-audio's createAudioPlayer,
 *     resolving speak() when playback finishes.
 *  3. Flip the provider choice in registry.ts (env: EXPO_PUBLIC_BARKLY_TTS).
 *
 * Until then the registry never selects this provider; expo-speech is the
 * working default.
 */

import { TextToSpeechProvider } from '../types';

export function createElevenLabsTts(): TextToSpeechProvider {
  return {
    name: 'elevenlabs (stub)',
    async isAvailable() {
      return false;
    },
    async speak() {
      throw new Error('ElevenLabs TTS not implemented — see file header for what it needs.');
    },
    async stop() {},
  };
}
