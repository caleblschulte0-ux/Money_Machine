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
 * Conversation lifecycle/activity states remain app-owned.
 */
export type ReactionState = 'idle' | 'happy' | 'excited' | 'annoyed' | 'sleepy' | 'hungry';

export const ALL_REACTIONS: ReactionState[] = [
  'idle', 'happy', 'excited', 'annoyed', 'sleepy', 'hungry',
];

export const CONVERSATION_STATES: BarklyState[] = ['listening', 'thinking', 'speaking'];

export function isBusy(state: BarklyState): boolean {
  return CONVERSATION_STATES.includes(state);
}

/**
 * States where a tap should CUT HIM OFF rather than be ignored.
 *
 * Speaking is the long one — several seconds per line on a real device — and
 * for most of that the buttons rendered fully enabled while every handler
 * silently refused, so a tap did nothing at all and said nothing about why.
 * A dog you can't interrupt is not a pet, it is a cutscene.
 *
 * Listening and thinking are NOT interruptible: there is a capture or a
 * request in flight and tearing it up mid-way is how the conversation state
 * gets corrupted.
 */
export function isInterruptible(state: BarklyState): boolean {
  return state === 'speaking';
}

/** A tap must be refused outright only while a turn is actually in flight. */
export function isLocked(state: BarklyState): boolean {
  return isBusy(state) && !isInterruptible(state);
}

/**
 * High-level body commands emitted by the brain. The same commands can drive
 * today's renderer and tomorrow's motors.
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

/** One beat in a custom routine. Beats run IN ORDER, never simultaneously. */
export interface RoutineBeat {
  /** What Barkly says during this beat. Short on purpose; the action is the point. */
  speech: string;
  reaction?: ReactionState;
  actions: BodyAction[];
}

/**
 * One reusable trick/rule Barkly may learn when his person explicitly teaches
 * him a cue. `routine` is the differentiator: a cue can trigger choreography,
 * not merely a static reaction.
 */
export interface LearnedTrainingRule {
  cue: string;
  instruction: string;
  /** Opening line when the cue fires. */
  speech: string;
  reaction?: ReactionState;
  actions: BodyAction[];
  /** Optional ordered performance. Limited/validated by training.ts. */
  routine?: RoutineBeat[];
}

/** Internal drives, each 0–100. */
export interface BarklyStats {
  mood: number;
  energy: number;
  hunger: number;
  affection: number;
  curiosity: number;
}

export interface BarklySnapshot {
  state: BarklyState;
  stats: BarklyStats;
  updatedAt: number;
  settleMs: number | null;
}

export type BarklyEvent =
  | { type: 'TALK_START' }
  | { type: 'TALK_CAPTURED' }
  | { type: 'TALK_FAILED' }
  | { type: 'SPEAK_START' }
  | { type: 'SPEAK_END' }
  | { type: 'FEED' }
  | { type: 'PET' }
  | { type: 'SOCIAL'; friendly: boolean }
  | { type: 'TREASURE' }
  | { type: 'PLAY' }
  | { type: 'SLEEP_TOGGLE' }
  | { type: 'REACTION'; state: ReactionState; durationMs?: number }
  | { type: 'SETTLE' }
  | { type: 'TICK'; now: number };

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
  speech: string;
  reaction?: ReactionState;
  actions: BodyAction[];
  /** Ordered beats when this reply is a learned multi-step routine. */
  routine?: RoutineBeat[];
  newUserFacts: string[];
  newBarklyMemories: string[];
  learnedTraining?: LearnedTrainingRule[];
}
