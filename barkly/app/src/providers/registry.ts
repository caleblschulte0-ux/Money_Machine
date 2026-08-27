/**
 * Provider selection — the ONE place vendors are chosen.
 *
 * Env vars (see .env.example; all EXPO_PUBLIC_, i.e. bundled and non-secret):
 *   EXPO_PUBLIC_BARKLY_BACKEND_URL  production proxy base URL (preferred)
 *   EXPO_PUBLIC_BARKLY_APP_TOKEN    sent to the proxy; obfuscation, not a secret
 *   EXPO_PUBLIC_BARKLY_VOICE=off    force the device voice (demos, tests)
 *   EXPO_PUBLIC_ANTHROPIC_API_KEY   dev-only direct Anthropic access
 *   EXPO_PUBLIC_BARKLY_MODEL        override dialogue model id
 *   EXPO_PUBLIC_BARKLY_FORCE_KEYBOARD=1  report STT unavailable so the UI uses
 *                                   typed input (browser demos, sandboxed pages)
 *
 * The dialogue provider handed out is always the RESILIENT one: the real model
 * with the scripted Barkly behind it. With no configuration at all that
 * degrades cleanly to scripted-only, so the app still runs with zero
 * credentials — but a configured build is talking to the actual model, which
 * is the point.
 */

import { DialogueProvider, SpeechToTextProvider } from './types';
import { BarklyVoice, createBarklyVoice } from './tts/barklyVoiceTts';
import { createAnthropicDialogue } from './dialogue/anthropic';
import { createResilientDialogue, DialogueStatus } from './dialogue/resilient';
import { createScriptedDialogue } from './dialogue/scripted';
import { createExpoSpeechRecognitionStt } from './stt/expoSpeechRecognitionStt';
import { createExpoSpeechTts, ExpoSpeechTts } from './tts/expoSpeechTts';
import { currentDeviceId } from './device';
import { DialogueError } from './errors';

export interface ProviderSet {
  stt: SpeechToTextProvider;
  dialogue: DialogueProvider;
  /** The device voice — the fallback link, not the one the UI calls directly. */
  /** The device voice, with its picker and shaping controls exposed. */
  tts: ExpoSpeechTts;
  /** Barkly's own synthesized voice, via the proxy. Unavailable without one. */
  voice: BarklyVoice;
  /** Which brain answered last, and why — for the settings screen and error copy. */
  dialogueStatus(): DialogueStatus;
  /** True when a real model is configured at all (vs. scripted-only build). */
  modelConfigured: boolean;
}

export interface ProviderOptions {
  onDialogueFallback?: (err: DialogueError) => void;
}

export function createProviders(opts: ProviderOptions = {}): ProviderSet {
  const apiKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
  const baseURL = process.env.EXPO_PUBLIC_BARKLY_BACKEND_URL;
  const model = process.env.EXPO_PUBLIC_BARKLY_MODEL;
  const appToken = process.env.EXPO_PUBLIC_BARKLY_APP_TOKEN;

  const anthropic = createAnthropicDialogue({
    apiKey,
    baseURL,
    model,
    appToken,
    // Read at call time: the id is loaded from storage during boot, which may
    // finish after the providers are constructed.
    get deviceId() {
      return currentDeviceId();
    },
  });

  // The voice is only ever real behind the proxy: the vendor key and the
  // choice of WHICH voice is Barkly both live server-side.
  const voice = createBarklyVoice({
    baseURL: process.env.EXPO_PUBLIC_BARKLY_VOICE === 'off' ? undefined : baseURL,
    appToken,
    get deviceId() {
      return currentDeviceId();
    },
  });

  const scripted = createScriptedDialogue();
  const dialogue = createResilientDialogue(anthropic, scripted, {
    onFallback: opts.onDialogueFallback,
  });

  const deviceTts: ExpoSpeechTts = createExpoSpeechTts();
  const stt = createExpoSpeechRecognitionStt();
  if (process.env.EXPO_PUBLIC_BARKLY_FORCE_KEYBOARD === '1') {
    stt.isAvailable = async () => false;
  }

  return {
    stt,
    dialogue,
    tts: deviceTts,
    voice,
    dialogueStatus: () => dialogue.status(),
    modelConfigured: anthropic.isAvailable(),
  };
}
