/**
 * Barkly's state machine and internal drives.
 *
 * One reducer owns every transition — no animation booleans scattered through
 * the UI. The UI dispatches BarklyEvents; this module decides what Barkly is
 * doing and how he feels about it.
 *
 * THE CONVERSATION LOCK LIVES HERE. While Barkly is listening, thinking, or
 * speaking, every physical interaction (feed/play/pet/sleep/social/treasure)
 * and every emotional reaction is rejected by the reducer. UI buttons are also
 * disabled, but that is a convenience — correctness is enforced in the brain,
 * so a stray tap, a queued gesture, or a future caller cannot desynchronize
 * Barkly's body from what he is actually doing.
 */

import {
  BarklyEvent,
  BarklySnapshot,
  BarklyState,
  BarklyStats,
  BodyAction,
  INTERRUPTIBLE_EVENTS,
  isBusy,
} from './types';

export const DEFAULT_STATS: BarklyStats = {
  mood: 65,
  energy: 80,
  hunger: 40,
  affection: 50,
  curiosity: 70,
};

export function freshSnapshot(now: number): BarklySnapshot {
  return { state: 'idle', stats: { ...DEFAULT_STATS }, updatedAt: now, settleMs: null };
}

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

function adjust(stats: BarklyStats, delta: Partial<BarklyStats>): BarklyStats {
  return {
    mood: clamp(stats.mood + (delta.mood ?? 0)),
    energy: clamp(stats.energy + (delta.energy ?? 0)),
    hunger: clamp(stats.hunger + (delta.hunger ?? 0)),
    affection: clamp(stats.affection + (delta.affection ?? 0)),
    curiosity: clamp(stats.curiosity + (delta.curiosity ?? 0)),
  };
}

/** Move to a new behavior state, clearing any custom settle duration. */
function to(snap: BarklySnapshot, state: BarklyState, stats?: BarklyStats): BarklySnapshot {
  return { ...snap, state, stats: stats ?? snap.stats, settleMs: null };
}

/**
 * Wall-clock decay, applied on TICK (app foreground / periodic timer).
 * Rates are per hour and intentionally gentle — Barkly away for a weekend is
 * hungry and a bit mopey, not dead. Decay is capped at 48h so a long absence
 * doesn't zero everything out.
 */
export function decayStats(stats: BarklyStats, elapsedMs: number): BarklyStats {
  const hours = Math.min(Math.max(elapsedMs, 0) / 3_600_000, 48);
  if (hours <= 0) return stats;
  const decayed = adjust(stats, {
    hunger: +4 * hours,
    energy: +2 * hours, // resting while you're away
    mood: -1.5 * hours,
    curiosity: +1 * hours, // absence makes him nosier
  });
  // Absence makes him grumpy, never catatonic — mood floors at 15 unless it
  // was already lower for other reasons.
  const moodFloor = Math.min(stats.mood, 15);
  return { ...decayed, mood: Math.max(decayed.mood, moodFloor) };
}

/**
 * Baseline: what Barkly drifts back to when nothing is happening.
 * Needs override mood — a very hungry or exhausted dog doesn't idle happily.
 */
export function baselineState(stats: BarklyStats): BarklyState {
  if (stats.energy < 20) return 'sleepy';
  if (stats.hunger > 80) return 'hungry';
  if (stats.mood > 85) return 'happy';
  return 'idle';
}

/** States that are timed emotional beats — they settle back to baseline. */
const TRANSIENT: BarklyState[] = ['happy', 'excited', 'annoyed', 'eating', 'playing'];

export function isTransient(state: BarklyState): boolean {
  return TRANSIENT.includes(state);
}

export function reduce(snap: BarklySnapshot, event: BarklyEvent): BarklySnapshot {
  const { state, stats } = snap;

  // The conversation lock, applied once, for every interruptible event.
  if (isBusy(state) && INTERRUPTIBLE_EVENTS.includes(event.type)) {
    return snap;
  }

  switch (event.type) {
    case 'TALK_START':
      return to(snap, 'listening');
    case 'TALK_CAPTURED':
      return to(snap, 'thinking');
    case 'TALK_FAILED':
      return to(snap, baselineState(stats));
    case 'SPEAK_START':
      return to(snap, 'speaking');
    case 'SPEAK_END':
      // Talking to his person is the core bonding loop.
      return to(snap, baselineState(stats), adjust(stats, { affection: +2, mood: +2, curiosity: -2 }));

    case 'FEED':
      if (state === 'eating') return snap; // no double-feeding spam
      if (stats.hunger < 12) {
        // A full dog turns his nose up at more food. That's character, not a bug.
        return to(snap, 'annoyed');
      }
      return to(snap, 'eating', adjust(stats, { hunger: -30, mood: +8, energy: +5, affection: +3 }));

    case 'TREASURE':
      // Finding something in the dirt is the best thing that can happen to a dog.
      return to(snap, 'excited', adjust(stats, { mood: +6, curiosity: -6, energy: -4 }));

    case 'SOCIAL':
      if (event.friendly) {
        return to(snap, 'happy', adjust(stats, { mood: +5, affection: +2, curiosity: -3, energy: -3 }));
      }
      // Rival encounter: annoying, but a good feud is its own fun.
      return to(snap, 'annoyed', adjust(stats, { mood: -2, curiosity: -2 }));

    case 'PET':
      if (state === 'sleepy') {
        // Woken by petting: grumpy about it, secretly pleased.
        return to(snap, 'annoyed', adjust(stats, { affection: +1 }));
      }
      return to(snap, 'happy', adjust(stats, { affection: +3, mood: +2 }));

    case 'PLAY':
      if (stats.energy < 15) {
        // Too tired to play — that's a mood, not a bug.
        return to(snap, 'sleepy', adjust(stats, { mood: -2 }));
      }
      return to(snap, 'playing', adjust(stats, { energy: -15, mood: +10, affection: +4, hunger: +8 }));

    case 'SLEEP_TOGGLE': {
      if (state === 'sleepy') {
        const rested = adjust(stats, { energy: +40, mood: +5 });
        return to(snap, baselineState(rested), rested);
      }
      return to(snap, 'sleepy');
    }

    case 'REACTION': {
      // Only ReactionState values can arrive here (see types.ts) — the model
      // cannot put Barkly into a conversation or activity state.
      const next = to(snap, event.state);
      // A caller-supplied duration is honored by the settle timer.
      return event.durationMs && event.durationMs > 0
        ? { ...next, settleMs: event.durationMs }
        : next;
    }

    case 'SETTLE':
      return isTransient(state) ? to(snap, baselineState(stats)) : snap;

    case 'TICK': {
      const decayed = decayStats(stats, event.now - snap.updatedAt);
      const next: BarklySnapshot = { ...snap, stats: decayed, updatedAt: event.now };
      // Only re-derive posture when he's not mid-conversation or mid-beat.
      if (state === 'idle' || state === 'hungry' || state === 'sleepy') {
        next.state = baselineState(decayed);
      }
      return next;
    }
  }
}

/** Default hold time for a transient beat, per state. */
export function settleDelayMs(state: BarklyState): number {
  switch (state) {
    case 'eating': return 4000;
    case 'playing': return 6000;
    case 'excited': return 3500;
    case 'annoyed': return 3500;
    case 'happy': return 3000;
    default: return 0;
  }
}

/**
 * How long the CURRENT beat should hold: a caller-supplied duration when one
 * was given (REACTION durationMs), otherwise the per-state default. This is
 * the single place the settle timer should ask.
 */
export function currentSettleMs(snap: BarklySnapshot): number {
  return snap.settleMs ?? settleDelayMs(snap.state);
}

/**
 * Ambient body actions for a state — what Barkly's body does on its own.
 * The dialogue model can add more per reply; these are the defaults.
 */
export function ambientActions(state: BarklyState): BodyAction[] {
  switch (state) {
    case 'listening': return ['EAR_PERK', 'HEAD_TILT'];
    case 'thinking': return ['LOOK_LEFT', 'LOOK_RIGHT'];
    case 'speaking': return ['MOUTH_MOVE', 'TAIL_WAG'];
    case 'happy': return ['TAIL_WAG'];
    case 'excited': return ['EXCITED', 'TAIL_WAG'];
    case 'annoyed': return ['LOOK_LEFT'];
    case 'sleepy': return ['SLEEP'];
    case 'hungry': return ['HEAD_TILT'];
    case 'playing': return ['EXCITED', 'TAIL_WAG'];
    case 'eating': return ['MOUTH_MOVE'];
    case 'idle': return ['BLINK', 'SIT'];
  }
}

/** One-line mood description fed into the prompt so replies track his state. */
export function describeStats(stats: BarklyStats): string {
  const parts: string[] = [];
  parts.push(
    stats.mood > 75 ? 'in a great mood' :
    stats.mood > 45 ? 'in a decent mood' :
    stats.mood > 25 ? 'a bit grumpy' : 'thoroughly grumpy'
  );
  if (stats.energy < 25) parts.push('very sleepy');
  else if (stats.energy > 85) parts.push('bursting with energy');
  if (stats.hunger > 75) parts.push('really hungry and thinking about food');
  else if (stats.hunger > 55) parts.push('somewhat peckish');
  if (stats.affection > 75) parts.push('feeling very bonded to your person');
  if (stats.curiosity > 80) parts.push('extra nosy today');
  return parts.join(', ');
}
