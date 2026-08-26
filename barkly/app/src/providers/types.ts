/**
 * Provider interfaces. Vendor-specific code lives behind these — swapping a
 * speech, dialogue, or voice vendor is one new adapter + one registry line,
 * never a change to the brain or the UI.
 */

import { ChatTurn } from '../barkly/types';

export interface SttResult {
  transcript: string;
}

/**
 * Push-to-talk speech capture. start() begins listening; stop() ends capture
 * and resolves with the final transcript ('' if nothing intelligible).
 * Implementations must only capture audio between start() and stop() —
 * child-safety requirement, not a style preference.
 */
export interface SpeechToTextProvider {
  readonly name: string;
  isAvailable(): Promise<boolean>;
  requestPermissions(): Promise<boolean>;
  start(opts?: { onPartial?: (text: string) => void }): Promise<void>;
  stop(): Promise<SttResult>;
  cancel(): Promise<void>;
}

export interface DialogueRequest {
  systemPrompt: string;
  /** Recent turns, oldest first. The summary of older turns is already in systemPrompt. */
  turns: ChatTurn[];
  /** The user's newest utterance. */
  userText: string;
}

export interface DialogueProvider {
  readonly name: string;
  isAvailable(): boolean;
  /** Returns the model's raw text reply (the engine parses the JSON contract). */
  complete(req: DialogueRequest): Promise<string>;
}

export interface TextToSpeechProvider {
  readonly name: string;
  isAvailable(): Promise<boolean>;
  /** Speak text aloud; resolves when playback finishes (or immediately on failure). */
  speak(text: string, opts?: { onStart?: () => void }): Promise<void>;
  stop(): Promise<void>;
}
