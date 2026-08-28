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

/**
 * Structured situation, for a provider that cannot read a system prompt.
 *
 * The real model gets all of this as prose inside `systemPrompt`. The OFFLINE
 * brain cannot parse prose, and without this it answered the same six ways
 * forever regardless of where he was, how hungry he was, or who you are —
 * which is exactly what "he still has the same basic four lines" means.
 */
export interface DialogueContext {
  state: string;
  stats: { mood: number; energy: number; hunger: number; affection: number; curiosity: number };
  /** Where he is, e.g. "park". */
  location?: string;
  /** Display names of dogs present right now. */
  npcsPresent?: string[];
  /** What your person is called, if he knows. */
  personName?: string;
  /** The toy he is holding, e.g. "Squeaky ball". */
  toy?: string;
  /** Things he has dug up, newest first. */
  treasures?: string[];
  /** Local hour 0-23, so he can be sleepy at night. */
  hour?: number;
  /** Cues you taught him, so an offline Barkly can still perform one. */
  cues?: string[];
  /**
   * WHO HE HAS BECOME — the character record, flattened. Same reasoning as
   * the rest of this interface: the model reads it as prose in the prompt,
   * but the offline brain cannot, and without these fields it greeted a
   * best friend of months exactly like a stranger. Bond keys are lowercased
   * dog names; `label` is the escalation-ladder rung ("best friend",
   * "nemesis").
   */
  bonds?: Record<string, { kind: 'friend' | 'rival'; encounters: number; label: string }>;
  /** The possession he treats as sacred, e.g. "a rock that looks like a duck". */
  favoriteTreasure?: string;
  /** What he cannot stop thinking about right now. */
  obsession?: string;
  /** His active beef. */
  grievance?: { who: string; what: string };
  favoriteFriend?: string;
}

export interface DialogueRequest {
  systemPrompt: string;
  /** Recent turns, oldest first. The summary of older turns is already in systemPrompt. */
  turns: ChatTurn[];
  /** The user's newest utterance. */
  userText: string;
  /** Situation as data. Optional: a model-backed provider ignores it. */
  context?: DialogueContext;
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
