/**
 * Core vocabulary for Barkly's brain.
 *
 * Everything in src/barkly/ is platform-agnostic TypeScript: no React,
 * no React Native, no Expo imports. The brain talks to the outside world
 * through these types and the provider interfaces in src/providers/types.ts.
 */

/** Barkly's observable behavior state — drives animation today, motors later. */
export type BarklyState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'happy'
  | 'excited'
  | 'annoyed'
  | 'sleepy'
  | 'hungry'
  | 'playing'
  | 'eating';

export const ALL_STATES: BarklyState[] = [
  'idle', 'listening', 'thinking', 'speaking', 'happy', 'excited',
  'annoyed', 'sleepy', 'hungry', 'playing', 'eating',
];

/**
 * The ONLY states the dialogue model may ask for.
 *
 * Conversation lifecycle states (listening/thinking/speaking) and activity
 * states (eating/playing) are owned by application logic — a model reply can
 * never put Barkly's body into them, because the app is the thing that knows
 * whether audio is playing or a bowl is on screen. See docs/ARCHITECTURE.md.
 */
export type ReactionState = 'idle' | 'happy' | 'excited' | 'annoyed' | 'sleepy' | 'hungry';

export const ALL_REACTIONS: ReactionState[] = [
  'idle', 'happy', 'excited', 'annoyed', 'sleepy', 'hungry',
];

/** States that mean a conversation turn is in flight. Nothing may interrupt these. */
export const CONVERSATION_STATES: BarklyState[] = ['listening', 'thinking', 'speaking'];

/** True while a conversation turn owns Barkly's body. */
export function isBusy(state: BarklyState): boolean {
  return CONVERSATION_STATES.includes(state);
}

/**
 * High-level body commands emitted by the brain.
 * The mobile app maps these to animation; a physical Barkly maps the exact
 * same commands to servos. Keep them device-agnostic: "TAIL_WAG", never
 * "rotate tail View 20deg".
 */
export type BodyAction =
  | 'LOOK_LEFT'
  | 'LOOK_RIGHT'
  | 'TAIL_WAG'
  | 'HEAD_TILT'
  | 'EAR_PERK'
  | 'BLINK'
  | 'MOUTH_MOVE'
  | 'SIT'
  | 'EXCITED'
  | 'SLEEP';

export const ALL_BODY_ACTIONS: BodyAction[] = [
  'LOOK_LEFT', 'LOOK_RIGHT', 'TAIL_WAG', 'HEAD_TILT', 'EAR_PERK',
  'BLINK', 'MOUTH_MOVE', 'SIT', 'EXCITED', 'SLEEP',
];

/** Internal drives, each 0–100. These vary Barkly's behavior; they are not a Tamagotchi sim. */
export interface BarklyStats {
  mood: number;       // 0 grumpy … 100 delighted
  energy: number;     // 0 exhausted … 100 zoomies
  hunger: number;     // 0 full … 100 starving (higher = hungrier)
  affection: number;  // bond with his person
  curiosity: number;  // appetite for new things
}

export interface BarklySnapshot {
  state: BarklyState;
  stats: BarklyStats;
  /** ms since epoch when stats were last updated — used for offline decay. */
  updatedAt: number;
  /**
   * How long the current transient beat should hold before settling, when a
   * caller asked for a specific duration. Null means "use the default for
   * this state" (settleDelayMs). Cleared whenever the state changes.
   */
  settleMs: number | null;
}

/**
 * Events the state machine understands. UI and engine dispatch these; nothing
 * else mutates state.
 *
 * Interaction events (FEED/PLAY/PET/SOCIAL/TREASURE/SLEEP_TOGGLE) are rejected
 * by the reducer while a conversation is in flight — the lock lives here, not
 * in whether a button happened to be disabled.
 */
export type BarklyEvent =
  | { type: 'TALK_START' }        // user pressed and holds TALK
  | { type: 'TALK_CAPTURED' }     // speech captured, brain is working
  | { type: 'TALK_FAILED' }       // STT/dialogue failed, back to idle
  | { type: 'SPEAK_START' }
  | { type: 'SPEAK_END' }
  | { type: 'FEED' }
  | { type: 'PET' }               // user tapped/stroked Barkly
  | { type: 'SOCIAL'; friendly: boolean } // greeted another dog (friend or rival)
  | { type: 'TREASURE' }          // dug something up at the park
  | { type: 'PLAY' }
  | { type: 'SLEEP_TOGGLE' }
  | { type: 'REACTION'; state: ReactionState; durationMs?: number } // emotional beat
  | { type: 'SETTLE' }            // timed reaction over, return to baseline
  | { type: 'TICK'; now: number }; // apply wall-clock stat decay

/** Interaction events the conversation lock applies to. */
export const INTERRUPTIBLE_EVENTS: BarklyEvent['type'][] = [
  'FEED', 'PET', 'SOCIAL', 'TREASURE', 'PLAY', 'SLEEP_TOGGLE', 'REACTION',
];

export interface ChatTurn {
  role: 'user' | 'barkly';
  text: string;
  at: number;
}

/** What one round of dialogue produces. */
export interface BarklyReply {
  /** What Barkly says out loud (goes to TTS). */
  speech: string;
  /** Emotional beat to display after speaking, if any. Model-chosen but restricted. */
  reaction?: ReactionState;
  /** Body commands to perform while speaking. */
  actions: BodyAction[];
  /** New durable facts the model extracted, as "key: value" style statements. */
  newUserFacts: string[];
  /** New shared experiences Barkly believes he had with his person. */
  newBarklyMemories: string[];
}
