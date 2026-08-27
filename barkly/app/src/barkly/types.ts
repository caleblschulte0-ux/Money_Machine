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
}

/** Events the state machine understands. UI and engine dispatch these; nothing else mutates state. */
export type BarklyEvent =
  | { type: 'TALK_START' }        // user pressed and holds TALK
  | { type: 'TALK_CAPTURED' }     // speech captured, brain is working
  | { type: 'TALK_FAILED' }       // STT/dialogue failed, back to idle
  | { type: 'SPEAK_START' }
  | { type: 'SPEAK_END' }
  | { type: 'FEED' }
  | { type: 'PET' }               // user tapped/stroked Barkly
  | { type: 'SOCIAL'; friendly: boolean } // greeted another dog (friend or rival)
  | { type: 'PLAY' }
  | { type: 'SLEEP_TOGGLE' }
  | { type: 'REACTION'; state: BarklyState; durationMs?: number } // brain-chosen emotional beat
  | { type: 'SETTLE' }            // timed reaction over, return to baseline
  | { type: 'TICK'; now: number }; // apply wall-clock stat decay

export interface ChatTurn {
  role: 'user' | 'barkly';
  text: string;
  at: number;
}

/** What one round of dialogue produces. */
export interface BarklyReply {
  /** What Barkly says out loud (goes to TTS). */
  speech: string;
  /** Emotional beat to display after speaking, if any. */
  reaction?: BarklyState;
  /** Body commands to perform while speaking. */
  actions: BodyAction[];
  /** New long-term memory candidates extracted from this exchange. */
  newUserFacts: string[];
  newBarklyMemories: string[];
}
