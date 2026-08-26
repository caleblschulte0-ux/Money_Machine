/**
 * Provider selection — the ONE place vendors are chosen.
 *
 * Env vars (see .env.example; all EXPO_PUBLIC_, i.e. bundled and non-secret):
 *   EXPO_PUBLIC_ANTHROPIC_API_KEY   dev-only direct Anthropic access
 *   EXPO_PUBLIC_BARKLY_BACKEND_URL production proxy base URL (preferred)
 *   EXPO_PUBLIC_BARKLY_MODEL       override dialogue model id
 *
 * With no configuration at all the app still runs: scripted dialogue +
 * on-device TTS + (native STT if dev-built, else typed input in the UI).
 */

import { DialogueProvider, SpeechToTextProvider, TextToSpeechProvider } from './types';
import { createAnthropicDialogue } from './dialogue/anthropic';
import { createScriptedDialogue } from './dialogue/scripted';
import { createExpoSpeechRecognitionStt } from './stt/expoSpeechRecognitionStt';
import { createExpoSpeechTts } from './tts/expoSpeechTts';

export interface ProviderSet {
  stt: SpeechToTextProvider;
  dialogue: DialogueProvider;
  tts: TextToSpeechProvider;
}

export function createProviders(): ProviderSet {
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  const baseURL = process.env.EXPO_PUBLIC_BARKLY_BACKEND_URL;
  const model = process.env.EXPO_PUBLIC_BARKLY_MODEL;

  const anthropic = createAnthropicDialogue({ apiKey, baseURL, model });
  const dialogue: DialogueProvider = anthropic.isAvailable()
    ? anthropic
    : createScriptedDialogue();

  return {
    stt: createExpoSpeechRecognitionStt(),
    dialogue,
    tts: createExpoSpeechTts(),
  };
}
