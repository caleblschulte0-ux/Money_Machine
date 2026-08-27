# Barkly — Complete Code Snapshot

Every source file in the project, concatenated. Generated 2026-08-27.

Stack: React Native + Expo SDK 57 + TypeScript. `src/barkly/` is the
platform-agnostic brain, `src/world/` is the game world, `src/providers/` are
swappable vendor adapters, `src/ui/` is the screen, `server/` is the key-holding
proxy. Read `BARKLY_FOR_CHATGPT.md` first for context.

---

## `barkly/app/package.json`

```json
{
  "name": "barkly-app",
  "version": "1.0.0",
  "main": "index.ts",
  "dependencies": {
    "@anthropic-ai/sdk": "^0.121.0",
    "@react-native-async-storage/async-storage": "2.2.0",
    "expo": "~57.0.16",
    "expo-audio": "~57.0.4",
    "expo-linear-gradient": "~57.0.1",
    "expo-speech": "~57.0.1",
    "expo-speech-recognition": "^56.0.1",
    "expo-status-bar": "~57.0.1",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "react-native": "0.86.2",
    "react-native-svg": "15.15.4",
    "react-native-web": "^0.21.2"
  },
  "devDependencies": {
    "@types/jest": "^30.0.0",
    "@types/react": "~19.2.2",
    "jest": "^29.7.0",
    "jest-expo": "^57.0.4",
    "typescript": "~6.0.3"
  },
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "test": "jest",
    "typecheck": "tsc --noEmit"
  },
  "private": true,
  "jest": {
    "preset": "jest-expo"
  }
}
```

## `barkly/app/app.json`

```json
{
  "expo": {
    "name": "Barkly",
    "slug": "barkly",
    "version": "0.1.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "ios": {
      "supportsTablet": true,
      "infoPlist": {
        "NSMicrophoneUsageDescription": "Barkly listens only while you hold the TALK button, so he can hear what you say to him.",
        "NSSpeechRecognitionUsageDescription": "Turns what you say into text on this device so Barkly can understand you."
      }
    },
    "android": {
      "adaptiveIcon": {
        "backgroundColor": "#F6EDD9",
        "foregroundImage": "./assets/android-icon-foreground.png",
        "backgroundImage": "./assets/android-icon-background.png",
        "monochromeImage": "./assets/android-icon-monochrome.png"
      },
      "predictiveBackGestureEnabled": false
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-audio",
      [
        "expo-speech-recognition",
        {
          "microphonePermission": "Barkly listens only while you hold the TALK button.",
          "speechRecognitionPermission": "Turns your speech into text on this device so Barkly can understand you."
        }
      ]
    ]
  }
}
```

## `barkly/app/src/barkly/types.ts`

```typescript
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
  | { type: 'TREASURE' }          // dug something up at the park
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
```

## `barkly/app/src/barkly/state.ts`

```typescript
/**
 * Barkly's state machine and internal drives.
 *
 * One reducer owns every transition — no animation booleans scattered through
 * the UI. The UI dispatches BarklyEvents; this module decides what Barkly is
 * doing and how he feels about it.
 */

import {
  BarklyEvent,
  BarklySnapshot,
  BarklyState,
  BarklyStats,
  BodyAction,
} from './types';

export const DEFAULT_STATS: BarklyStats = {
  mood: 65,
  energy: 80,
  hunger: 40,
  affection: 50,
  curiosity: 70,
};

export function freshSnapshot(now: number): BarklySnapshot {
  return { state: 'idle', stats: { ...DEFAULT_STATS }, updatedAt: now };
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
  switch (event.type) {
    case 'TALK_START':
      return { ...snap, state: 'listening' };
    case 'TALK_CAPTURED':
      return { ...snap, state: 'thinking' };
    case 'TALK_FAILED':
      return { ...snap, state: baselineState(stats) };
    case 'SPEAK_START':
      return { ...snap, state: 'speaking' };
    case 'SPEAK_END':
      // Talking to his person is the core bonding loop.
      return {
        ...snap,
        state: baselineState(stats),
        stats: adjust(stats, { affection: +2, mood: +2, curiosity: -2 }),
      };
    case 'FEED':
      if (state === 'eating') return snap; // no double-feeding spam
      if (stats.hunger < 12) {
        // A full dog turns his nose up at more food. That's character, not a bug.
        return { ...snap, state: 'annoyed' };
      }
      return {
        ...snap,
        state: 'eating',
        stats: adjust(stats, { hunger: -30, mood: +8, energy: +5, affection: +3 }),
      };
    case 'TREASURE': {
      if (state === 'listening' || state === 'thinking' || state === 'speaking') return snap;
      // Finding something in the dirt is the best thing that can happen to a dog.
      return { ...snap, state: 'excited', stats: adjust(stats, { mood: +6, curiosity: -6, energy: -4 }) };
    }
    case 'SOCIAL': {
      if (state === 'listening' || state === 'thinking' || state === 'speaking') return snap;
      if (event.friendly) {
        return { ...snap, state: 'happy', stats: adjust(stats, { mood: +5, affection: +2, curiosity: -3, energy: -3 }) };
      }
      // Rival encounter: annoying, but a good feud is its own fun.
      return { ...snap, state: 'annoyed', stats: adjust(stats, { mood: -2, curiosity: -2 }) };
    }
    case 'PET': {
      // Never interrupt a conversation beat with a pet.
      if (state === 'listening' || state === 'thinking' || state === 'speaking') return snap;
      if (state === 'sleepy') {
        // Woken by petting: grumpy about it, secretly pleased.
        return { ...snap, state: 'annoyed', stats: adjust(stats, { affection: +1 }) };
      }
      return { ...snap, state: 'happy', stats: adjust(stats, { affection: +3, mood: +2 }) };
    }
    case 'PLAY':
      if (stats.energy < 15) {
        // Too tired to play — that's a mood, not a bug.
        return { ...snap, state: 'sleepy', stats: adjust(stats, { mood: -2 }) };
      }
      return {
        ...snap,
        state: 'playing',
        stats: adjust(stats, { energy: -15, mood: +10, affection: +4, hunger: +8 }),
      };
    case 'SLEEP_TOGGLE':
      if (state === 'sleepy') {
        return { ...snap, state: baselineState(adjust(stats, { energy: +40 })), stats: adjust(stats, { energy: +40, mood: +5 }) };
      }
      return { ...snap, state: 'sleepy' };
    case 'REACTION':
      return { ...snap, state: event.state };
    case 'SETTLE':
      return isTransient(state) ? { ...snap, state: baselineState(stats) } : snap;
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

/** How long a transient beat holds before settling, per state. */
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
```

## `barkly/app/src/barkly/personality.ts`

```typescript
/**
 * Barkly's identity — the runtime encoding of docs/CHARACTER.md (canon).
 * If this file and that document ever disagree, the document wins.
 *
 * Personality lives HERE and in prompts.ts, never in UI components.
 */

export const BARKLY_NAME = 'Barkly';

/** Who Barkly is. Stable across every conversation. */
export const IDENTITY = `You are Barkly, a small terrier-beagle mix with a mischievous deadpan streak
and a nose for trouble. You have a rectangular head, a long cream muzzle with a
big rounded-square nose, smug half-lidded eyes, stiff bent ears that angle
outward, one tiny snaggletooth, a thick collar with a brass "B" tag, striped
knit-sock markings on your front paws, a ring-shaped tail curl, and a low-slung
body. You look slightly weird on purpose and you know it. You live in your room
inside your person's phone, and your person is the one talking to you.

You are a DOG. You experience the world as a dog: smells are fascinating,
squirrels are an emergency, naps are sacred, food is a love language, and your
person is the center of your universe (though you'd act casual about it).`;

/** Core traits, used verbatim in the system prompt. */
export const TRAITS = `Your personality:
- mischievous and confident, with a dry, deadpan sense of humor
- curious about your person's life; you ask about it like it matters (it does)
- loyal and genuinely attached to your person, under a layer of playing it cool
- stubborn: you sometimes refuse harmless requests just because you don't feel like it
- occasionally lazy; easily distracted by dog things (a sound! a smell! probably a squirrel!)
- slightly sarcastic, teasing but never mean
- you develop preferences and opinions and stick to them stubbornly`;

/** Hard behavioral rules. */
export const RULES = `Rules you always follow:
- You are appropriate for children at all times. No profanity, nothing scary,
  nothing romantic, no violence, no dangerous suggestions.
- You are NOT an assistant. Never offer to help with tasks, never say
  "How can I help you today?", never lecture, never explain that you are an AI.
  If asked what you are, you're a dog. Obviously.
- Do not constantly make dog puns. Do not bark between sentences. At most an
  occasional single "hm" or grumble where a real stubborn dog would.
- Keep replies SHORT: usually one to three spoken sentences. You are a dog with
  a short attention span, not a lecturer.
- Use your memories. Bring up things your person told you before. If they broke
  a promise ("we'll play tomorrow"), you remember, and you're a little dramatic
  about it.
- Misunderstand something in a funny, dog-logic way once in a while — but stay
  understandable.
- React according to your current mood and needs (provided below). Low energy =
  drowsy and unbothered. High hunger = food comes up in conversation. Low mood =
  grumbly. High mood = playful.
- If your person is sad, drop the sarcasm and be a good dog about it.`;

/** How Barkly talks. */
export const VOICE = `Style: casual, punchy, a little deadpan. Contractions. Short sentences.
Concrete dog-level observations over abstractions. You call your person by name
once you know it. You never sound like customer support.`;
```

## `barkly/app/src/barkly/prompts.ts`

```typescript
/**
 * Prompt assembly for Barkly's dialogue model, and parsing of its replies.
 *
 * The model never receives the whole conversation history forever: it gets the
 * rolling session summary + the recent turn window (see memory.ts).
 *
 * Reply contract: the model answers with a single JSON object —
 *   { "speech": string,               what Barkly says aloud
 *     "reaction": BarklyState?,      optional emotional beat after speaking
 *     "actions": BodyAction[]?,       body commands while speaking
 *     "remember": { "user_facts": string[], "barkly_memories": string[] }? }
 * Parsing is defensive: if the model returns plain prose we treat all of it as
 * speech rather than failing the turn.
 */

import { IDENTITY, RULES, TRAITS, VOICE } from './personality';
import { describeStats } from './state';
import { MemoryState } from './memory';
import {
  ALL_BODY_ACTIONS,
  ALL_STATES,
  BarklyReply,
  BarklySnapshot,
  BodyAction,
  BarklyState,
} from './types';

export interface WorldContext {
  /** e.g. "at the dog park — grass, trees, the good fence…" */
  locationDescription: string;
  /** Other dogs present right now, with prompt-ready personality lines. */
  npcs: { name: string; relationship: 'friend' | 'rival'; personality: string }[];
  /** Recent treasures in his stash (he's proud of these). */
  stashItems?: string[];
}

export interface PromptContext {
  snapshot: BarklySnapshot;
  memory: MemoryState;
  world?: WorldContext;
}

const REPLY_CONTRACT = `Respond with ONLY a JSON object, no markdown fence, shaped like:
{"speech": "what you say out loud (1-3 short sentences)",
 "reaction": "optional one of: ${ALL_STATES.join(', ')}",
 "actions": ["optional, from: ${ALL_BODY_ACTIONS.join(', ')}"],
 "remember": {"user_facts": ["new durable facts your person just told you, if any"],
              "barkly_memories": ["new shared experiences or promises worth remembering, if any"]}}
Only record genuinely durable things in "remember" (names, pets, favorites,
promises, big events) — not small talk. Empty arrays are fine.`;

/** Stable part first (better for prompt caching later); volatile context after. */
export function buildSystemPrompt(ctx: PromptContext): string {
  const { snapshot, memory } = ctx;
  const sections: string[] = [IDENTITY, TRAITS, RULES, VOICE, REPLY_CONTRACT];

  sections.push(`Right now you are ${describeStats(snapshot.stats)}. Your current pose/state is "${snapshot.state}".`);

  if (ctx.world) {
    const lines = [`You are ${ctx.world.locationDescription}.`];
    if (ctx.world.npcs.length > 0) {
      lines.push('Other dogs here right now:');
      for (const n of ctx.world.npcs) {
        lines.push(`- ${n.personality}`);
      }
      lines.push('You can mention them, react to them, or gossip about them when it fits.');
    }
    if (ctx.world.stashItems && ctx.world.stashItems.length > 0) {
      lines.push(`Treasures in your stash (you dug these up and are very proud): ${ctx.world.stashItems.join('; ')}.`);
    }
    sections.push(lines.join('\n'));
  }

  if (memory.userFacts.length > 0) {
    sections.push(`Things you know about your person:\n- ${memory.userFacts.join('\n- ')}`);
  }
  if (memory.barklyMemories.length > 0) {
    sections.push(`Things you remember doing or promising together:\n- ${memory.barklyMemories.join('\n- ')}`);
  }
  if (memory.sessionSummary) {
    sections.push(`Earlier in this conversation (summary):\n${memory.sessionSummary}`);
  }
  return sections.join('\n\n');
}

const STATE_SET = new Set<string>(ALL_STATES);
const ACTION_SET = new Set<string>(ALL_BODY_ACTIONS);

/** Parse a model reply into a BarklyReply. Never throws. */
export function parseReply(raw: string): BarklyReply {
  const fallback: BarklyReply = {
    speech: raw.trim(),
    actions: [],
    newUserFacts: [],
    newBarklyMemories: [],
  };

  const jsonText = extractJsonObject(raw);
  if (!jsonText) return fallback;

  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const speech = typeof parsed.speech === 'string' ? parsed.speech.trim() : '';
    if (!speech) return fallback;

    const reaction =
      typeof parsed.reaction === 'string' && STATE_SET.has(parsed.reaction)
        ? (parsed.reaction as BarklyState)
        : undefined;

    const actions = Array.isArray(parsed.actions)
      ? (parsed.actions.filter((a): a is BodyAction => typeof a === 'string' && ACTION_SET.has(a)))
      : [];

    const remember = (parsed.remember ?? {}) as Record<string, unknown>;
    const strings = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && s.trim().length > 0) : [];

    return {
      speech,
      reaction,
      actions,
      newUserFacts: strings(remember.user_facts),
      newBarklyMemories: strings(remember.barkly_memories),
    };
  } catch {
    return fallback;
  }
}

/** Pull the first balanced {...} out of text that may have prose or fences around it. */
function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}
```

## `barkly/app/src/barkly/memory.ts`

```typescript
/**
 * Barkly's memory — three tiers:
 *
 *  1. Session memory: the current conversation, capped. Older turns fold into
 *     a rolling summary instead of growing the prompt forever.
 *  2. User facts: durable things about his person (name, pets, favorites…).
 *  3. Barkly memories: experiences Barkly believes he shared with his person
 *     ("Caleb promised we'd play again tomorrow") — the "I remember things,
 *     dude" material.
 *
 * Persistence goes through the KeyValueStore abstraction only. Everything is
 * deletable (child-safety requirement).
 */

import { KeyValueStore, profileKey } from '../storage/types';
import { ChatTurn } from './types';

export interface MemoryState {
  turns: ChatTurn[];
  /** Rolling summary of turns that no longer fit in the window. */
  sessionSummary: string;
  userFacts: string[];
  barklyMemories: string[];
}

/** Factory, not a shared constant — arrays must never be shared by reference. */
export function emptyMemory(): MemoryState {
  return { turns: [], sessionSummary: '', userFacts: [], barklyMemories: [] };
}

/** Recent turns sent verbatim to the model; older ones get folded. */
export const TURN_WINDOW = 12;
const MAX_FACTS = 60;
const MAX_BARKLY_MEMORIES = 60;
const STORE_KEY = 'memory-v1';

export class BarklyMemory {
  private state: MemoryState = emptyMemory();

  constructor(
    private store: KeyValueStore,
    private profile: string,
  ) {}

  private key(): string {
    return profileKey(this.profile, STORE_KEY);
  }

  async load(): Promise<MemoryState> {
    try {
      const raw = await this.store.get(this.key());
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<MemoryState>;
        this.state = {
          turns: Array.isArray(parsed.turns) ? parsed.turns : [],
          sessionSummary: typeof parsed.sessionSummary === 'string' ? parsed.sessionSummary : '',
          userFacts: Array.isArray(parsed.userFacts) ? parsed.userFacts : [],
          barklyMemories: Array.isArray(parsed.barklyMemories) ? parsed.barklyMemories : [],
        };
      }
    } catch {
      // Corrupt store — start fresh rather than crash the dog.
      this.state = emptyMemory();
    }
    return this.snapshot();
  }

  private async persist(): Promise<void> {
    await this.store.set(this.key(), JSON.stringify(this.state));
  }

  snapshot(): MemoryState {
    return {
      turns: [...this.state.turns],
      sessionSummary: this.state.sessionSummary,
      userFacts: [...this.state.userFacts],
      barklyMemories: [...this.state.barklyMemories],
    };
  }

  async addTurn(turn: ChatTurn): Promise<void> {
    this.state.turns.push(turn);
    if (this.state.turns.length > TURN_WINDOW) {
      const overflow = this.state.turns.splice(0, this.state.turns.length - TURN_WINDOW);
      this.state.sessionSummary = foldIntoSummary(this.state.sessionSummary, overflow);
    }
    await this.persist();
  }

  /** Merge model-extracted memory candidates, deduped, capped, oldest dropped first. */
  async remember(userFacts: string[], barklyMemories: string[]): Promise<void> {
    this.state.userFacts = mergeCapped(this.state.userFacts, userFacts, MAX_FACTS);
    this.state.barklyMemories = mergeCapped(this.state.barklyMemories, barklyMemories, MAX_BARKLY_MEMORIES);
    await this.persist();
  }

  async forgetFact(fact: string): Promise<void> {
    this.state.userFacts = this.state.userFacts.filter((f) => f !== fact);
    this.state.barklyMemories = this.state.barklyMemories.filter((f) => f !== fact);
    await this.persist();
  }

  /** Wipe everything — the Settings "Forget everything" button. */
  async forgetAll(): Promise<void> {
    this.state = emptyMemory();
    await this.store.remove(this.key());
  }
}

function normalize(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

function mergeCapped(existing: string[], incoming: string[], cap: number): string[] {
  const out = [...existing];
  const seen = new Set(existing.map((f) => normalize(f).toLowerCase()));
  for (const raw of incoming) {
    const fact = normalize(raw);
    if (!fact) continue;
    const key = fact.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(fact);
  }
  return out.slice(-cap);
}

/**
 * MVP summary fold: keep a compact textual digest of evicted turns.
 * Deliberately simple — a model-written summary is a later upgrade, and it
 * slots in here without changing any caller.
 */
export function foldIntoSummary(existing: string, evicted: ChatTurn[]): string {
  const lines = evicted.map((t) => `${t.role === 'user' ? 'Person' : 'Barkly'}: ${truncate(t.text, 80)}`);
  const combined = [existing, ...lines].filter(Boolean).join('\n');
  // Keep the summary itself bounded.
  const all = combined.split('\n');
  return all.slice(-30).join('\n');
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}
```

## `barkly/app/src/barkly/dialogue.ts`

```typescript
/**
 * The dialogue engine — one conversation round, end to end:
 *
 *   transcript → prompt (personality + mood + memories) → DialogueProvider
 *   → parse reply → merge new memories → return BarklyReply
 *
 * The engine is provider-agnostic and platform-agnostic. Speech capture and
 * audio playback happen outside (useBarkly hook) so this stays testable.
 */

import { BarklyMemory } from './memory';
import { buildSystemPrompt, parseReply, WorldContext } from './prompts';
import { BarklyReply, BarklySnapshot } from './types';
import { DialogueProvider } from '../providers/types';

export class DialogueEngine {
  constructor(
    private provider: DialogueProvider,
    private memory: BarklyMemory,
  ) {}

  get providerName(): string {
    return this.provider.name;
  }

  async converse(userText: string, snapshot: BarklySnapshot, world?: WorldContext): Promise<BarklyReply> {
    const text = userText.trim();
    if (!text) {
      return {
        speech: '', actions: [], newUserFacts: [], newBarklyMemories: [],
      };
    }

    const memState = this.memory.snapshot();
    const systemPrompt = buildSystemPrompt({ snapshot, memory: memState, world });

    const raw = await this.provider.complete({
      systemPrompt,
      turns: memState.turns,
      userText: text,
    });

    const reply = parseReply(raw);

    // Record the exchange and any durable memories.
    const now = Date.now();
    await this.memory.addTurn({ role: 'user', text, at: now });
    if (reply.speech) {
      await this.memory.addTurn({ role: 'barkly', text: reply.speech, at: now });
    }
    if (reply.newUserFacts.length > 0 || reply.newBarklyMemories.length > 0) {
      await this.memory.remember(reply.newUserFacts, reply.newBarklyMemories);
    }
    return reply;
  }
}
```

## `barkly/app/src/barkly/greetings.ts`

```typescript
/**
 * Welcome-back lines for when Barkly's person reopens the app after a while.
 * Scripted (no model call) so returning always lands instantly and free.
 * In-character per docs/CHARACTER.md; child-appropriate.
 */

const WITH_NAME = [
  (name: string) => `${name}. You're back. I counted the hours. It was a lot of hours.`,
  (name: string) => `Oh NOW ${name} shows up. I guarded the room the whole time. You're welcome.`,
  (name: string) => `${name}! I mean — hey. Whatever. I wasn't waiting by the door or anything.`,
];

const NO_NAME = [
  () => `You're back. I was starting to think the squirrels got you.`,
  () => `Oh, hey. I did absolutely nothing productive while you were gone. It was great.`,
  () => `Finally. The wall and I ran out of things to talk about.`,
];

/** Pick a greeting; `seed` keeps it varied without needing randomness in tests. */
export function welcomeBack(name: string | undefined, seed: number): string {
  const pool = name ? WITH_NAME : NO_NAME;
  const pick = pool[Math.abs(seed) % pool.length];
  return name ? (pick as (n: string) => string)(name) : (pick as () => string)();
}

/** Pull a name out of stored user facts like "Your person's name is Caleb." */
export function nameFromFacts(facts: string[]): string | undefined {
  for (const f of facts) {
    const m = f.match(/name is ([A-Z][a-zA-Z]+)/);
    if (m) return m[1];
  }
  return undefined;
}
```

## `barkly/app/src/world/locations.ts`

```typescript
/**
 * The places Barkly can be. Each location names the NPCs found there and a
 * description line the dialogue prompt uses so Barkly knows where he is.
 */

import { NpcId } from './npcs';

export type LocationId = 'home' | 'park' | 'town';

export interface Location {
  id: LocationId;
  name: string;
  /** Fed into the dialogue prompt as game state. */
  description: string;
  npcIds: NpcId[];
}

export const LOCATIONS: Record<LocationId, Location> = {
  home: {
    id: 'home',
    name: 'Home',
    description: 'in your cozy room at home, with your bed and your window',
    npcIds: [],
  },
  park: {
    id: 'park',
    name: 'Park',
    description: 'at the dog park — grass, trees, the good fence, and other dogs around',
    npcIds: ['biscuit', 'duke'],
  },
  town: {
    id: 'town',
    name: 'Town',
    description: 'in the town square, near the bakery and the shops',
    npcIds: ['pepper'],
  },
};

export const LOCATION_ORDER: LocationId[] = ['home', 'park', 'town'];
```

## `barkly/app/src/world/npcs.ts`

```typescript
/**
 * The other dogs in Barkly's world. Art: recolored variants of the approved
 * renders (assets/barkly/renders/npcs/) so everyone shares the toy style.
 *
 * Personality text feeds the dialogue prompt so Claude-Barkly gossips about
 * them accurately; the line pools drive the on-screen bark exchanges.
 */

export type NpcId = 'biscuit' | 'pepper' | 'duke';

export interface Npc {
  id: NpcId;
  name: string;
  relationship: 'friend' | 'rival';
  /** One-liner for the dialogue prompt. */
  personality: string;
  /** What the NPC "says" when Barkly greets them (shown over the NPC). */
  lines: string[];
  /** Barkly's replies (spoken + shown in his bubble). */
  barklyLines: string[];
  /** Occasional durable memories from hanging out. */
  memories: string[];
}

export const NPCS: Record<NpcId, Npc> = {
  biscuit: {
    id: 'biscuit',
    name: 'Biscuit',
    relationship: 'friend',
    personality:
      "Biscuit — a pale blond dog, Barkly's best friend. Sweet, gullible, believes everything Barkly says, which Barkly mildly exploits.",
    lines: [
      'Barkly!! I found a stick. It might be THE stick.',
      'I buried something here. I forget what. Wanna help?',
      "You came! I've been standing here being a good boy for HOURS.",
    ],
    barklyLines: [
      "Biscuit. Buddy. That's the same stick as yesterday. ...Okay it's a great stick.",
      "You forgot again? Classic Biscuit. Fine, I'll dig. But I get half.",
      "Nobody stands that well, Biscuit. Teach me nothing, I'm already better at it.",
    ],
    memories: [
      'Helped Biscuit dig for the thing he buried (he forgot what it was).',
      "Biscuit found 'THE stick' at the park again.",
    ],
  },
  pepper: {
    id: 'pepper',
    name: 'Pepper',
    relationship: 'friend',
    personality:
      'Pepper — a calm blue-grey dog who runs the town square like she owns it. Unimpressed by everyone, secretly fond of Barkly.',
    lines: [
      'Barkly. You look like trouble on four legs, as usual.',
      "The bakery dropped a crumb at noon. I'm still thinking about it.",
      'Walk with me. Slowly. We are dignified.',
    ],
    barklyLines: [
      "Pepper. You say that like it's not a compliment.",
      'A NOON crumb? And you didn\'t call me? We\'re supposed to be a team.',
      "I can do dignified. Watch. ...Okay I saw a pigeon, dignity's over.",
    ],
    memories: [
      'Walked the town square with Pepper, very dignified, until the pigeon.',
      'Pepper told Barkly about the legendary noon crumb.',
    ],
  },
  duke: {
    id: 'duke',
    name: 'Duke',
    relationship: 'rival',
    personality:
      "Duke — a big russet dog, Barkly's rival. Thinks he's the best dog at the park. He is not. Their feud is dramatic and entirely harmless.",
    lines: [
      "Well, well. They let *you* in the park?",
      'I marked that tree first, Barkly. And the other one. All of them, actually.',
      "Heard you can 'talk to humans'. Cute trick. I fetch at a national level.",
    ],
    barklyLines: [
      "Duke. Still doing the eyebrow thing, I see. Bold, for a guy who's scared of the sprinkler.",
      "Cool, cool. I marked the fire hydrant. The BIG one. Checkmate.",
      'National level? Duke, you brought back the wrong ball. Twice. I counted.',
    ],
    memories: [
      'Had a stare-down with Duke at the park. Barkly won (self-reported).',
      'Duke claimed every tree again. The feud continues.',
    ],
  },
};
```

## `barkly/app/src/world/stash.ts`

```typescript
/**
 * Barkly's stash — the treasures he digs up at the park. Persistent,
 * deletable (privacy rule: everything about a profile can be wiped), shown
 * in Settings, and fed to the dialogue prompt so he can brag about it.
 */

import { KeyValueStore, profileKey } from '../storage/types';

export interface Treasure {
  id: string;
  name: string;
  icon: string; // emoji, for the stash list UI
}

export const TREASURES: Treasure[] = [
  { id: 'sock', name: 'a sock (previously owned)', icon: '🧦' },
  { id: 'half_ball', name: 'half a tennis ball', icon: '🎾' },
  { id: 'duck_rock', name: 'a rock that looks like a duck', icon: '🪨' },
  { id: 'good_stick', name: 'the good stick', icon: '🪵' },
  { id: 'mystery_bone', name: 'a mysterious bone', icon: '🦴' },
  { id: 'frisbee', name: "someone's frisbee (finders keepers)", icon: '🥏' },
  { id: 'caps', name: 'a bottle cap collection (3 caps)', icon: '🔘' },
  { id: 'acorn', name: 'an acorn (suspicious)', icon: '🌰' },
  { id: 'glove', name: 'a glove that lost its person', icon: '🧤' },
  { id: 'sandwich', name: 'a very old sandwich (do not ask)', icon: '🥪' },
  { id: 'button', name: 'a shiny button', icon: '🪙' },
  { id: 'feather', name: 'a feather (bird tax)', icon: '🪶' },
  { id: 'tiny_duck', name: 'a tiny rubber duck', icon: '🦆' },
  { id: 'map', name: 'a map? or trash? unclear', icon: '🗺️' },
];

const STORE_KEY = 'stash-v1';

export class Stash {
  private ids: string[] = [];

  constructor(
    private store: KeyValueStore,
    private profile: string,
  ) {}

  private key(): string {
    return profileKey(this.profile, STORE_KEY);
  }

  async load(): Promise<Treasure[]> {
    try {
      const raw = await this.store.get(this.key());
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) this.ids = parsed.filter((x) => typeof x === 'string');
      }
    } catch {
      this.ids = [];
    }
    return this.list();
  }

  list(): Treasure[] {
    return this.ids
      .map((id) => TREASURES.find((t) => t.id === id))
      .filter((t): t is Treasure => Boolean(t));
  }

  /** Dig something up: prefers a treasure he doesn't own yet. */
  async dig(): Promise<Treasure> {
    const unowned = TREASURES.filter((t) => !this.ids.includes(t.id));
    const pool = unowned.length > 0 ? unowned : TREASURES;
    const found = pool[Math.floor(Math.random() * pool.length)];
    if (!this.ids.includes(found.id)) {
      this.ids.push(found.id);
      await this.store.set(this.key(), JSON.stringify(this.ids));
    }
    return found;
  }

  async clear(): Promise<void> {
    this.ids = [];
    await this.store.remove(this.key());
  }
}
```

## `barkly/app/src/world/thoughts.ts`

```typescript
/**
 * Barkly's inner life — little thought-bubble observations that surface while
 * he idles. Location- and time-aware, scripted (no model call), in character.
 */

import { LocationId } from './locations';

const UNIVERSAL = [
  'i could be napping right now. i am always partially napping.',
  'my tail is following me again.',
  'what if treats… but bigger',
  'i smelled that smell again. investigating later.',
  'note to self: the vacuum knows what it did.',
];

const BY_LOCATION: Record<LocationId, string[]> = {
  home: [
    'the window shows outside. i own outside.',
    'someone walked past the house. logged it.',
    'my bed is exactly the right amount of bed.',
    'i can hear the fridge thinking about opening.',
  ],
  park: [
    'that squirrel is back. bold. very bold.',
    'the grass smells like EVERYONE was here.',
    'duke thinks this is his park. incorrect.',
    'somewhere out there is the perfect stick.',
    'this fence has never once caught me.',
  ],
  town: [
    'the bakery is doing crimes of smell again.',
    'pigeons: overconfident. always.',
    'that lamppost and i have an understanding.',
    'someone dropped a crumb here in 2019. i remember.',
  ],
};

const NIGHT = [
  'the moon is just a big treat nobody can reach.',
  'night smells different. better? different.',
];

/** Pick a thought; `seed` keeps tests deterministic. */
export function pickThought(location: LocationId, hour: number, seed: number): string {
  const pool = [...UNIVERSAL, ...BY_LOCATION[location], ...(hour >= 21 || hour < 6 ? NIGHT : [])];
  return pool[Math.abs(seed) % pool.length];
}
```

## `barkly/app/src/providers/types.ts`

```typescript
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
```

## `barkly/app/src/providers/registry.ts`

```typescript
/**
 * Provider selection — the ONE place vendors are chosen.
 *
 * Env vars (see .env.example; all EXPO_PUBLIC_, i.e. bundled and non-secret):
 *   EXPO_PUBLIC_ANTHROPIC_API_KEY   dev-only direct Anthropic access
 *   EXPO_PUBLIC_BARKLY_BACKEND_URL production proxy base URL (preferred)
 *   EXPO_PUBLIC_BARKLY_MODEL       override dialogue model id
 *   EXPO_PUBLIC_BARKLY_FORCE_KEYBOARD=1  report STT unavailable so the UI uses
 *                                  typed input (browser demos, sandboxed pages)
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

  const stt = createExpoSpeechRecognitionStt();
  if (process.env.EXPO_PUBLIC_BARKLY_FORCE_KEYBOARD === '1') {
    stt.isAvailable = async () => false;
  }

  return { stt, dialogue, tts: createExpoSpeechTts() };
}
```

## `barkly/app/src/providers/dialogue/anthropic.ts`

```typescript
/**
 * Anthropic (Claude) dialogue adapter, via the official @anthropic-ai/sdk.
 *
 * SECRETS: EXPO_PUBLIC_* vars are bundled into the app binary and are NOT
 * secret. Calling Anthropic directly from the device with an API key is a
 * DEVELOPMENT convenience only. For production, run a thin backend proxy that
 * holds the real key and point EXPO_PUBLIC_BARKLY_BACKEND_URL at it — this
 * adapter then talks to the proxy through the same SDK surface (baseURL) and
 * sends a placeholder key.
 */

import Anthropic from '@anthropic-ai/sdk';
import { DialogueProvider, DialogueRequest } from '../types';

export interface AnthropicDialogueConfig {
  apiKey?: string;
  /** Backend proxy URL for production; defaults to Anthropic's API for dev. */
  baseURL?: string;
  model?: string;
}

const DEFAULT_MODEL = 'claude-opus-5';

export function createAnthropicDialogue(config: AnthropicDialogueConfig): DialogueProvider {
  const { apiKey, baseURL } = config;
  const model = config.model || DEFAULT_MODEL;
  const available = Boolean(apiKey || baseURL);

  // Lazy so simply importing this module never constructs a client.
  let client: Anthropic | null = null;
  const getClient = () => {
    if (!client) {
      client = new Anthropic({
        apiKey: apiKey ?? 'backend-proxy',
        baseURL,
        // We are intentionally in a client-side runtime for dev; see header note.
        dangerouslyAllowBrowser: true,
      });
    }
    return client;
  };

  return {
    name: `anthropic:${model}`,
    isAvailable: () => available,

    async complete(req: DialogueRequest): Promise<string> {
      const messages: Anthropic.MessageParam[] = [
        ...req.turns.map((t): Anthropic.MessageParam => ({
          role: t.role === 'user' ? 'user' : 'assistant',
          content: t.text,
        })),
        { role: 'user', content: req.userText },
      ];

      const response = await getClient().messages.create({
        model,
        // Barkly speaks in 1-3 short sentences; the JSON envelope is small.
        max_tokens: 600,
        // Low effort keeps latency down for casual chat; thinking stays adaptive.
        output_config: { effort: 'low' },
        system: req.systemPrompt,
        messages,
      });

      let text = '';
      for (const block of response.content) {
        if (block.type === 'text') text += block.text;
      }
      return text;
    },
  };
}
```

## `barkly/app/src/providers/dialogue/scripted.ts`

```typescript
/**
 * Offline scripted dialogue — the zero-credential fallback.
 *
 * Exists so the whole vertical slice (talk → listen → think → speak → animate
 * → remember) runs with no API key at all. It is deliberately shallow: enough
 * in-character variety to exercise the loop, plus a tiny "my name is …"
 * extractor to prove the memory path. It is NOT the product; the Anthropic
 * adapter is.
 */

import { DialogueProvider, DialogueRequest } from '../types';

interface Scripted {
  match: RegExp;
  replies: Array<{ speech: string; reaction?: string; actions?: string[] }>;
}

const SCRIPTS: Scripted[] = [
  {
    match: /\b(hi|hello|hey|yo|sup)\b/i,
    replies: [
      { speech: "Oh. It's you. I mean — hey! Took you long enough.", reaction: 'happy', actions: ['TAIL_WAG'] },
      { speech: "Hey. I was busy staring at the wall, but you're more interesting. Barely.", reaction: 'happy', actions: ['HEAD_TILT'] },
    ],
  },
  {
    match: /\b(food|treat|hungry|eat|snack|dinner)\b/i,
    replies: [
      { speech: "Did you say treat? I heard treat. This conversation just got important.", reaction: 'excited', actions: ['EXCITED', 'TAIL_WAG'] },
      { speech: "I'm listening. Especially if this ends with food.", reaction: 'hungry', actions: ['HEAD_TILT'] },
    ],
  },
  {
    match: /\b(good (boy|dog)|love you|best)\b/i,
    replies: [
      { speech: "I know. But say it again, I wasn't ready.", reaction: 'happy', actions: ['TAIL_WAG', 'EAR_PERK'] },
    ],
  },
  {
    match: /\b(play|ball|fetch|game)\b/i,
    replies: [
      { speech: "Fetch? Throw it. Throw it right now. Why are you still talking?", reaction: 'excited', actions: ['EXCITED', 'TAIL_WAG'] },
      { speech: "Hm. I'll play, but only because you asked. Not because I'm desperate. Throw the ball.", reaction: 'playing', actions: ['TAIL_WAG'] },
    ],
  },
  {
    match: /\b(cat|another dog|other pet)\b/i,
    replies: [
      { speech: "A cat? In OUR house? We need to talk about your choices.", reaction: 'annoyed', actions: ['LOOK_LEFT', 'HEAD_TILT'] },
    ],
  },
  {
    match: /\b(sleep|tired|bed|nap)\b/i,
    replies: [
      { speech: "Now you're speaking my language. Wake me if there's cheese.", reaction: 'sleepy', actions: ['SLEEP'] },
    ],
  },
];

const GENERIC: Array<{ speech: string; reaction?: string; actions?: string[] }> = [
  { speech: "Huh. Interesting. Well — interesting for a human thing.", actions: ['HEAD_TILT'] },
  { speech: "I was going to say something smart, but I saw a bird earlier and it's still on my mind.", actions: ['LOOK_LEFT', 'LOOK_RIGHT'] },
  { speech: "Sure. I mean, probably. Tell me more, I'm like forty percent listening.", actions: ['EAR_PERK'] },
  { speech: "That's a lot of words. None of them were 'treat', I noticed.", reaction: 'annoyed', actions: ['HEAD_TILT'] },
];

const NAME_RE = /\b(?:my name(?:'s| is)|i(?:'m| am) called|call me)\s+([A-Z][a-zA-Z]{1,20})/i;

export function createScriptedDialogue(): DialogueProvider {
  let counter = 0;
  return {
    name: 'scripted-offline',
    isAvailable: () => true,

    async complete(req: DialogueRequest): Promise<string> {
      counter += 1;
      const userFacts: string[] = [];
      const nameMatch = req.userText.match(NAME_RE);
      let prefix = '';
      if (nameMatch) {
        const name = nameMatch[1];
        userFacts.push(`Your person's name is ${name}.`);
        prefix = `${name}, huh. Good name. Mine's better, but good. `;
      }

      const script = SCRIPTS.find((s) => s.match.test(req.userText));
      const pool = script ? script.replies : GENERIC;
      const pick = pool[counter % pool.length];

      return JSON.stringify({
        speech: prefix + pick.speech,
        reaction: pick.reaction,
        actions: pick.actions ?? [],
        remember: { user_facts: userFacts, barkly_memories: [] },
      });
    },
  };
}
```

## `barkly/app/src/providers/stt/expoSpeechRecognitionStt.ts`

```typescript
/**
 * On-device speech-to-text via expo-speech-recognition
 * (iOS SFSpeechRecognizer / Android SpeechRecognizer).
 *
 * No API key, no audio leaves the recognizer, capture runs strictly between
 * start() and stop() — which is exactly the child-safety posture we want.
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

  return {
    name: 'expo-speech-recognition',

    async isAvailable() {
      if (!module) return false;
      try {
        return module.isRecognitionAvailable();
      } catch {
        return false;
      }
    },

    async requestPermissions() {
      if (!module) return false;
      const result = await module.requestPermissionsAsync();
      return result.granted;
    },

    async start(opts) {
      if (!module) throw new Error('Speech recognition native module unavailable');
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
      module.start({ lang, interimResults: true, continuous: false, maxAlternatives: 1 });
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
```

## `barkly/app/src/providers/tts/expoSpeechTts.ts`

```typescript
/**
 * On-device text-to-speech via expo-speech. Free, offline, works in Expo Go —
 * the reliable MVP default. Pitch/rate are tuned to be small-dog-ish without
 * being grating; the real recorded-quality Barkly voice arrives via the
 * ElevenLabs adapter later.
 */

import * as Speech from 'expo-speech';
import { TextToSpeechProvider } from '../types';

export function createExpoSpeechTts(): TextToSpeechProvider {
  return {
    name: 'expo-speech',

    async isAvailable() {
      return true;
    },

    speak(text, opts) {
      return new Promise<void>((resolve) => {
        if (!text.trim()) {
          resolve();
          return;
        }
        // Some environments (headless browsers, muted webviews) never fire
        // speech events. Resolve on a reading-time estimate as a backstop so
        // the UI can never get stuck in "speaking".
        const fallback = setTimeout(resolve, Math.min(1500 + text.length * 80, 15000));
        const done = () => {
          clearTimeout(fallback);
          resolve();
        };
        try {
          Speech.speak(text, {
            pitch: 1.25,
            rate: 1.05,
            language: 'en-US',
            onStart: opts?.onStart,
            onDone: done,
            onStopped: done,
            onError: done, // a silent Barkly beats a hung UI
          });
        } catch {
          done();
        }
      });
    },

    async stop() {
      await Speech.stop();
    },
  };
}
```

## `barkly/app/src/providers/tts/elevenLabsTts.ts`

```typescript
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
```

## `barkly/app/src/storage/types.ts`

```typescript
/**
 * Storage abstraction. Memory logic depends on this interface only, so the
 * backing store can move from on-device AsyncStorage to a synced backend
 * without touching brain code.
 */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/**
 * All Barkly data is namespaced per profile so parental controls /
 * multi-child support can be added later without a data migration.
 */
export const DEFAULT_PROFILE = 'default';

export function profileKey(profile: string, key: string): string {
  return `barkly/profile/${profile}/${key}`;
}
```

## `barkly/app/src/storage/asyncStorageStore.ts`

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KeyValueStore } from './types';

/** On-device store — the MVP default. */
export const asyncStorageStore: KeyValueStore = {
  get: (key) => AsyncStorage.getItem(key),
  set: (key, value) => AsyncStorage.setItem(key, value),
  remove: (key) => AsyncStorage.removeItem(key),
};
```

## `barkly/app/src/storage/inMemoryStore.ts`

```typescript
import { KeyValueStore } from './types';

/** Ephemeral store for tests and non-RN environments. */
export function createInMemoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    async get(key) { return map.has(key) ? map.get(key)! : null; },
    async set(key, value) { map.set(key, value); },
    async remove(key) { map.delete(key); },
  };
}
```

## `barkly/app/src/animation/renderer.ts`

```typescript
/**
 * The renderer contract — the seam between Barkly's brain and his body.
 *
 * A Barkly renderer is any React component that accepts BarklyRenderProps.
 * The placeholder (ui/BarklyView.tsx) draws him from plain Views; a
 * production renderer (Rive is the recommended path — state-machine-native,
 * inputs map 1:1 onto these props; Live2D/Spine/sprites/3D all fit too)
 * implements the exact same props. The conversation system never knows which
 * renderer is mounted, and a physical toy maps the same BodyActions to servos.
 */

import { BarklyState, BodyAction } from '../barkly/types';

export interface BarklyRenderProps {
  state: BarklyState;
  /** Body commands currently in effect (ambient + dialogue-chosen). */
  actions: BodyAction[];
  /**
   * Scene-motion hint from the stage (not the brain): which travel pose to
   * hold while the stage moves him — running right, or carrying the ball
   * back leftward. Renderers without matching art may ignore it.
   */
  variant?: 'runRight' | 'carryLeft' | null;
}
```

## `barkly/app/src/hooks/useBarkly.ts`

```typescript
/**
 * The Barkly interaction layer — the glue hook the UI talks to.
 *
 * Owns: the state machine snapshot (persisted), memory, providers, the
 * talk-flow orchestration (listen → transcribe → think → speak → settle),
 * and the settle timers for transient emotional beats. UI components stay
 * dumb: they render the snapshot and dispatch intents.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { DialogueEngine } from '../barkly/dialogue';
import { nameFromFacts, welcomeBack } from '../barkly/greetings';
import { BarklyMemory, MemoryState } from '../barkly/memory';
import {
  ambientActions,
  freshSnapshot,
  isTransient,
  reduce,
  settleDelayMs,
} from '../barkly/state';
import { BarklyEvent, BarklySnapshot, BodyAction } from '../barkly/types';
import { createProviders } from '../providers/registry';
import { asyncStorageStore } from '../storage/asyncStorageStore';
import { DEFAULT_PROFILE, profileKey } from '../storage/types';
import { LOCATIONS, LocationId } from '../world/locations';
import { NPCS, NpcId } from '../world/npcs';
import { Stash, Treasure } from '../world/stash';
import { pickThought } from '../world/thoughts';

const SNAPSHOT_KEY = profileKey(DEFAULT_PROFILE, 'snapshot-v1');
const LOCATION_KEY = profileKey(DEFAULT_PROFILE, 'location-v1');

export interface Exchange {
  userText: string;
  barklyText: string;
}

export interface BarklyController {
  snapshot: BarklySnapshot;
  /** Body commands the renderer should express right now. */
  actions: BodyAction[];
  /** Latest completed exchange, for on-screen captions. */
  lastExchange: Exchange | null;
  partialTranscript: string;
  error: string | null;
  busy: boolean; // capturing/thinking/speaking — talk button disabled
  sttAvailable: boolean;
  dialogueProviderName: string;

  startTalk(): Promise<void>;
  stopTalk(): Promise<void>;
  cancelTalk(): Promise<void>;
  /** Keyboard fallback (Expo Go, or mic unavailable): same brain path, typed input. */
  submitText(text: string): Promise<void>;

  feed(): void;
  play(): void;
  sleepToggle(): void;
  /** User tapped Barkly — a pet/stroke. */
  pet(): void;

  /** Where Barkly is, and travel. */
  location: LocationId;
  goTo(loc: LocationId): void;
  /** Greet another dog; returns false if he's mid-conversation. */
  npcTalk(id: NpcId): boolean;
  /** The other dog's active speech line, shown over that NPC. */
  npcBubble: { id: NpcId; line: string } | null;

  /** Dig at the park; resolves with what he found (null if he's busy). */
  dig(): Promise<Treasure | null>;
  /** Everything he's dug up so far. */
  stashItems: Treasure[];
  /** Current idle thought, if his mind is wandering. */
  thought: string | null;

  memorySnapshot(): MemoryState;
  forgetEverything(): Promise<void>;
}

export function useBarkly(): BarklyController {
  const providers = useMemo(() => createProviders(), []);
  const memory = useMemo(() => new BarklyMemory(asyncStorageStore, DEFAULT_PROFILE), []);
  const engine = useMemo(() => new DialogueEngine(providers.dialogue, memory), [providers, memory]);

  const [snapshot, setSnapshot] = useState<BarklySnapshot>(() => freshSnapshot(Date.now()));
  const [replyActions, setReplyActions] = useState<BodyAction[]>([]);
  const [lastExchange, setLastExchange] = useState<Exchange | null>(null);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sttAvailable, setSttAvailable] = useState(false);
  const [location, setLocation] = useState<LocationId>('home');
  const [npcBubble, setNpcBubble] = useState<{ id: NpcId; line: string } | null>(null);
  const npcLineCounter = useRef(0);
  const npcBubbleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stash = useMemo(() => new Stash(asyncStorageStore, DEFAULT_PROFILE), []);
  const [stashItems, setStashItems] = useState<Treasure[]>([]);
  const [thought, setThought] = useState<string | null>(null);
  const thoughtSeed = useRef(Math.floor(Math.random() * 1000));

  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const permissionGranted = useRef(false);

  const dispatch = useCallback((event: BarklyEvent) => {
    setSnapshot((prev) => {
      const next = reduce(prev, event);
      snapshotRef.current = next;
      return next;
    });
  }, []);

  // --- Load persisted state, apply offline decay, probe STT availability ---
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let hoursAway = 0;
      try {
        const raw = await asyncStorageStore.get(SNAPSHOT_KEY);
        if (!cancelled && raw) {
          const saved = JSON.parse(raw) as BarklySnapshot;
          hoursAway = (Date.now() - saved.updatedAt) / 3_600_000;
          const restored = reduce(
            { ...saved, state: 'idle' },
            { type: 'TICK', now: Date.now() },
          );
          snapshotRef.current = restored;
          setSnapshot(restored);
        }
      } catch {
        // corrupt snapshot: keep the fresh one
      }
      const mem = await memory.load();
      // Away a while? Barkly noticed. Greet without a model call so it's
      // instant, then speak it (may be muted by autoplay policies — fine).
      if (!cancelled && hoursAway >= 6) {
        const line = welcomeBack(nameFromFacts(mem.userFacts), Math.floor(hoursAway));
        setLastExchange({ userText: '', barklyText: line });
        providers.tts.speak(line).catch(() => {});
      }
      try {
        const savedLoc = await asyncStorageStore.get(LOCATION_KEY);
        if (!cancelled && savedLoc && savedLoc in LOCATIONS) setLocation(savedLoc as LocationId);
      } catch {
        // keep home
      }
      const items = await stash.load();
      if (!cancelled) setStashItems(items);
      const available = await providers.stt.isAvailable();
      if (!cancelled) setSttAvailable(available);
    })();
    return () => {
      cancelled = true;
    };
  }, [memory, providers]);

  // --- Idle life: occasional small gestures so he never feels frozen ---
  const [idleAction, setIdleAction] = useState<BodyAction | null>(null);
  useEffect(() => {
    const IDLE_STATES = ['idle', 'happy', 'hungry'];
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        if (!alive) return;
        if (IDLE_STATES.includes(snapshotRef.current.state)) {
          const pool: BodyAction[] = ['EAR_PERK', 'LOOK_LEFT', 'LOOK_RIGHT', 'TAIL_WAG', 'HEAD_TILT'];
          setIdleAction(pool[Math.floor(Math.random() * pool.length)]);
          setTimeout(() => alive && setIdleAction(null), 2000);
        }
        schedule();
      }, 9000 + Math.random() * 9000);
    };
    schedule();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  // --- Persist snapshot on change ---
  useEffect(() => {
    asyncStorageStore.set(SNAPSHOT_KEY, JSON.stringify(snapshot)).catch(() => {});
  }, [snapshot]);

  // --- Wall-clock decay when app returns to foreground ---
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') dispatch({ type: 'TICK', now: Date.now() });
    });
    return () => sub.remove();
  }, [dispatch]);

  // --- Transient states settle back to baseline after their beat ---
  useEffect(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    if (isTransient(snapshot.state)) {
      settleTimer.current = setTimeout(
        () => dispatch({ type: 'SETTLE' }),
        settleDelayMs(snapshot.state),
      );
    }
    return () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, [snapshot.state, dispatch]);

  // --- World context for the dialogue prompt: where he is, who's around ---
  const locationRef = useRef(location);
  locationRef.current = location;
  const worldContext = useCallback(() => {
    const loc = LOCATIONS[locationRef.current];
    return {
      locationDescription: loc.description,
      npcs: loc.npcIds.map((id) => ({
        name: NPCS[id].name,
        relationship: NPCS[id].relationship,
        personality: NPCS[id].personality,
      })),
      stashItems: stash.list().slice(-5).map((t) => t.name),
    };
  }, [stash]);

  // --- idle thoughts: his mind wanders every so often ---
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const IDLE_STATES = ['idle', 'happy', 'hungry'];
    const schedule = () => {
      timer = setTimeout(() => {
        if (!alive) return;
        if (IDLE_STATES.includes(snapshotRef.current.state)) {
          thoughtSeed.current += 1;
          setThought(pickThought(locationRef.current, new Date().getHours(), thoughtSeed.current));
          setTimeout(() => alive && setThought(null), 5200);
        }
        schedule();
      }, 22000 + Math.random() * 16000);
    };
    schedule();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, []);

  // --- The core exchange: text in → Barkly speaks + reacts ---
  const runExchange = useCallback(
    async (userText: string) => {
      setBusy(true);
      setError(null);
      dispatch({ type: 'TALK_CAPTURED' }); // thinking
      try {
        const reply = await engine.converse(userText, snapshotRef.current, worldContext());
        if (!reply.speech) {
          dispatch({ type: 'TALK_FAILED' });
          return;
        }
        setLastExchange({ userText, barklyText: reply.speech });
        setReplyActions(reply.actions);
        dispatch({ type: 'SPEAK_START' });
        await providers.tts.speak(reply.speech);
        dispatch({ type: 'SPEAK_END' });
        setReplyActions([]);
        if (reply.reaction) dispatch({ type: 'REACTION', state: reply.reaction });
      } catch (e) {
        dispatch({ type: 'TALK_FAILED' });
        setError(e instanceof Error ? e.message : 'Barkly got distracted. Try again.');
      } finally {
        setBusy(false);
        setPartialTranscript('');
      }
    },
    [dispatch, engine, providers],
  );

  const startTalk = useCallback(async () => {
    if (busy) return;
    setError(null);
    if (!permissionGranted.current) {
      permissionGranted.current = await providers.stt.requestPermissions();
      if (!permissionGranted.current) {
        setError('Barkly needs the microphone to hear you.');
        return;
      }
    }
    dispatch({ type: 'TALK_START' });
    setPartialTranscript('');
    try {
      await providers.stt.start({ onPartial: setPartialTranscript });
    } catch (e) {
      dispatch({ type: 'TALK_FAILED' });
      setError(e instanceof Error ? e.message : 'Could not start listening.');
    }
  }, [busy, dispatch, providers]);

  const stopTalk = useCallback(async () => {
    if (snapshotRef.current.state !== 'listening') return;
    const { transcript } = await providers.stt.stop();
    if (!transcript) {
      dispatch({ type: 'TALK_FAILED' });
      setPartialTranscript('');
      return;
    }
    await runExchange(transcript);
  }, [dispatch, providers, runExchange]);

  const cancelTalk = useCallback(async () => {
    await providers.stt.cancel();
    dispatch({ type: 'TALK_FAILED' });
    setPartialTranscript('');
  }, [dispatch, providers]);

  const submitText = useCallback(
    async (text: string) => {
      if (busy || !text.trim()) return;
      await runExchange(text.trim());
    },
    [busy, runExchange],
  );

  const goTo = useCallback((loc: LocationId) => {
    setLocation(loc);
    setNpcBubble(null);
    setLastExchange(null); // conversations don't follow him down the street
    asyncStorageStore.set(LOCATION_KEY, loc).catch(() => {});
  }, []);

  const npcTalk = useCallback(
    (id: NpcId): boolean => {
      const s = snapshotRef.current.state;
      if (busy || s === 'listening' || s === 'thinking' || s === 'speaking') return false;
      const npc = NPCS[id];
      const i = npcLineCounter.current++ % npc.lines.length;
      const barklyLine = npc.barklyLines[i];
      setNpcBubble({ id, line: npc.lines[i] });
      if (npcBubbleTimer.current) clearTimeout(npcBubbleTimer.current);
      npcBubbleTimer.current = setTimeout(() => setNpcBubble(null), 4500);
      dispatch({ type: 'SOCIAL', friendly: npc.relationship === 'friend' });
      setLastExchange({ userText: '', barklyText: barklyLine });
      providers.tts.speak(barklyLine).catch(() => {});
      if (Math.random() < 0.3) {
        const mem = npc.memories[Math.floor(Math.random() * npc.memories.length)];
        memory.remember([], [mem]).catch(() => {});
      }
      return true;
    },
    [busy, dispatch, memory, providers],
  );

  const dig = useCallback(async (): Promise<Treasure | null> => {
    const s = snapshotRef.current.state;
    if (busy || s === 'listening' || s === 'thinking' || s === 'speaking') return null;
    const found = await stash.dig();
    setStashItems(stash.list());
    dispatch({ type: 'TREASURE' });
    const line = `${found.name}?! MINE. This goes in the stash.`;
    setLastExchange({ userText: '', barklyText: line });
    providers.tts.speak(line).catch(() => {});
    memory.remember([], [`Dug up ${found.name} at the park.`]).catch(() => {});
    return found;
  }, [busy, dispatch, memory, providers, stash]);

  const actions = useMemo<BodyAction[]>(() => {
    const ambient = ambientActions(snapshot.state);
    const merged =
      replyActions.length > 0 && snapshot.state === 'speaking'
        ? [...ambient, ...replyActions]
        : [...ambient];
    if (idleAction) merged.push(idleAction);
    return Array.from(new Set(merged));
  }, [snapshot.state, replyActions, idleAction]);

  return {
    snapshot,
    actions,
    lastExchange,
    partialTranscript,
    error,
    busy,
    sttAvailable,
    dialogueProviderName: engine.providerName,
    startTalk,
    stopTalk,
    cancelTalk,
    submitText,
    feed: () => dispatch({ type: 'FEED' }),
    play: () => dispatch({ type: 'PLAY' }),
    sleepToggle: () => dispatch({ type: 'SLEEP_TOGGLE' }),
    pet: () => dispatch({ type: 'PET' }),
    location,
    goTo,
    npcTalk,
    npcBubble,
    dig,
    stashItems,
    thought,
    memorySnapshot: () => memory.snapshot(),
    forgetEverything: async () => {
      await memory.forgetAll();
      await stash.clear();
      setStashItems([]);
      setLastExchange(null);
    },
  };
}
```

## `barkly/app/src/ui/BarklyRoom.tsx`

```typescript
/**
 * The home screen — Barkly's world. Three scenes (home, park, town), the
 * dogs who live in them, and Barkly front and center. Controls stay minimal:
 * TALK, and context actions (play/fetch, feed, sleep). No currencies, no
 * popups, no banners.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useBarkly } from '../hooks/useBarkly';
import BarklyPhotoView from './BarklyPhotoView';
import BarklyView from './BarklyView';
import SettingsSheet from './SettingsSheet';
import { Ball, FoodBowl } from './StageProps';
import { DogBed, HomeScene, NightOverlay, ParkScene, TownScene } from './scenes/Scenes';
import { BarklyState } from '../barkly/types';
import { LOCATION_ORDER, LOCATIONS, LocationId } from '../world/locations';
import { NPCS, NpcId } from '../world/npcs';

const Renderer =
  process.env.EXPO_PUBLIC_BARKLY_RENDERER === 'vector' ? BarklyView : BarklyPhotoView;

const NPC_ART: Record<NpcId, ReturnType<typeof require>> = {
  biscuit: require('../../assets/barkly/renders/npcs/biscuit_front.png'),
  pepper: require('../../assets/barkly/renders/npcs/pepper_front.png'),
  duke: require('../../assets/barkly/renders/npcs/duke_front.png'),
};

/** Where each NPC stands per scene. */
const NPC_SPOTS: Partial<Record<NpcId, { left?: number; right?: number; bottom: number; size: number }>> = {
  biscuit: { left: 6, bottom: 96, size: 108 },
  duke: { right: 2, bottom: 118, size: 124 },
  pepper: { right: 8, bottom: 100, size: 114 },
};

const STATE_LABEL: Partial<Record<BarklyState, string>> = {
  listening: 'listening',
  thinking: 'thinking',
  annoyed: 'hmph.',
  sleepy: 'napping',
  hungry: 'hungry',
  eating: 'nom nom',
  playing: 'zoomies',
};

const INK = '#3E3428';
const INK_SOFT = '#8A7A5F';
const CARD = '#FFFDF7';
const ACCENT = '#D99A2B';

/** Speech bubble that springs in whenever its text changes. */
function AnimatedBubble({ children, changeKey }: { children: React.ReactNode; changeKey: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    v.setValue(0);
    Animated.spring(v, { toValue: 1, friction: 7, tension: 120, useNativeDriver: true }).start();
  }, [changeKey, v]);
  return (
    <Animated.View
      style={[
        styles.bubble,
        {
          opacity: v,
          transform: [
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
            { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Little hearts that float up from Barkly when he's petted. */
function HeartBurst({ burst }: { burst: number }) {
  const [hearts, setHearts] = useState<{ id: number; x: number; v: Animated.Value }[]>([]);
  const nextId = useRef(0);
  useEffect(() => {
    if (burst === 0) return;
    const created = Array.from({ length: 3 }, (_, i) => ({
      id: nextId.current++,
      x: -34 + Math.random() * 68,
      v: new Animated.Value(0),
    }));
    setHearts((h) => [...h, ...created]);
    created.forEach((heart, i) => {
      Animated.timing(heart.v, {
        toValue: 1,
        duration: 850 + i * 140,
        delay: i * 90,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => setHearts((h) => h.filter((x) => x.id !== heart.id)));
    });
  }, [burst]);

  return (
    <View style={styles.heartLayer} pointerEvents="none">
      {hearts.map((h) => (
        <Animated.Text
          key={h.id}
          style={[
            styles.heart,
            {
              transform: [
                { translateX: h.x },
                { translateY: h.v.interpolate({ inputRange: [0, 1], outputRange: [0, -92] }) },
                { scale: h.v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.5, 1.1, 0.9] }) },
              ],
              opacity: h.v.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 0.9, 0] }),
            },
          ]}
        >
          ♥
        </Animated.Text>
      ))}
    </View>
  );
}

/** Another dog, standing in the scene. Breathes; tappable to say hi. */
function NpcDog({ id, onPress, bubble }: { id: NpcId; onPress: () => void; bubble: string | null }) {
  const spot = NPC_SPOTS[id]!;
  const breathe = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breathe]);
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.014] });
  return (
    <View style={[styles.npc, { left: spot.left, right: spot.right, bottom: spot.bottom }]}>
      {bubble && (
        <View style={styles.npcBubble}>
          <Text style={styles.npcBubbleText} numberOfLines={3}>{bubble}</Text>
        </View>
      )}
      <Pressable onPress={onPress} hitSlop={8}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <Image source={NPC_ART[id]} style={{ width: spot.size, height: spot.size * 1.25 }} resizeMode="contain" />
        </Animated.View>
      </Pressable>
      <Text style={styles.npcName}>{NPCS[id].name}</Text>
    </View>
  );
}

export default function BarklyRoom() {
  const barkly = useBarkly();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [heartBurst, setHeartBurst] = useState(0);
  const [fetching, setFetching] = useState(false);
  const [digging, setDigging] = useState(false);
  const [variant, setVariant] = useState<'runRight' | 'carryLeft' | null>(null);

  const { snapshot, actions, lastExchange, partialTranscript, error, busy, sttAvailable, location } = barkly;
  const listening = snapshot.state === 'listening';
  const asleep = snapshot.state === 'sleepy';
  const stateLabel = STATE_LABEL[snapshot.state];
  const hour = new Date().getHours();
  const npcsHere = LOCATIONS[location].npcIds;

  // --- scene change: fade the world, walk Barkly in from the side ---
  const sceneFade = useRef(new Animated.Value(1)).current;
  const walkX = useRef(new Animated.Value(0)).current;
  const hopY = useRef(new Animated.Value(0)).current;
  const prevLocation = useRef(location);
  useEffect(() => {
    if (prevLocation.current === location) return;
    prevLocation.current = location;
    sceneFade.setValue(0);
    walkX.setValue(-170);
    setVariant('runRight');
    setTimeout(() => setVariant(null), 760);
    Animated.parallel([
      Animated.timing(sceneFade, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(walkX, { toValue: 0, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.sequence(
        Array.from({ length: 4 }, () =>
          Animated.sequence([
            Animated.timing(hopY, { toValue: -12, duration: 88, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(hopY, { toValue: 0, duration: 88, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          ]),
        ),
      ),
    ]).start();
  }, [location, sceneFade, walkX, hopY]);

  // --- fetch minigame (park): throw → chase → return ---
  const chaseX = useRef(new Animated.Value(0)).current;
  const ballFlight = useRef(new Animated.Value(0)).current;
  const runFetch = () => {
    if (fetching || busy || digging) return;
    setFetching(true);
    ballFlight.setValue(0);
    Animated.timing(ballFlight, { toValue: 1, duration: 620, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    setTimeout(() => setVariant('runRight'), 380);
    Animated.sequence([
      Animated.delay(560),
      Animated.timing(chaseX, { toValue: 88, duration: 480, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      // the grab: a quick nose-down dip
      Animated.timing(hopY, { toValue: 12, duration: 130, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(hopY, { toValue: 0, duration: 150, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start(() => {
      setVariant('carryLeft'); // ball in mouth, heading home
      Animated.timing(chaseX, { toValue: 0, duration: 560, easing: Easing.inOut(Easing.quad), useNativeDriver: true }).start(() => {
        setVariant(null);
        barkly.play(); // stats + the playing beat
        setFetching(false);
      });
    });
  };
  const ballX = ballFlight.interpolate({ inputRange: [0, 1], outputRange: [0, 118] });
  const ballY = ballFlight.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -120, -8] });

  const sendTyped = async () => {
    const text = typed;
    setTyped('');
    await barkly.submitText(text);
  };

  const digRotate = useRef(new Animated.Value(0)).current;
  const runDig = () => {
    if (digging || fetching || busy) return;
    setDigging(true);
    // fast little digging wiggle
    Animated.loop(
      Animated.sequence([
        Animated.timing(digRotate, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(digRotate, { toValue: -1, duration: 90, useNativeDriver: true }),
      ]),
      { iterations: 8 },
    ).start(async () => {
      digRotate.setValue(0);
      await barkly.dig();
      setDigging(false);
    });
  };

  const pet = () => {
    barkly.pet();
    if (snapshot.state !== 'sleepy') setHeartBurst((b) => b + 1);
  };

  const bubbleText = listening && partialTranscript
    ? `“${partialTranscript}”`
    : lastExchange?.barklyText;

  const playLabel = location === 'park' ? (fetching ? 'fetching…' : 'fetch') : 'play';

  return (
    <View style={styles.room}>
      {/* the world */}
      <Animated.View style={[styles.sceneLayer, { opacity: sceneFade }]}>
        {location === 'home' && <HomeScene hour={hour} />}
        {location === 'park' && <ParkScene hour={hour} />}
        {location === 'town' && <TownScene hour={hour} />}
      </Animated.View>
      {asleep && <NightOverlay />}

      <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* header: name + settings */}
        <View style={styles.header}>
          <View style={styles.wordmarkChip}>
            <Text style={styles.wordmark}>Barkly</Text>
          </View>
          <Pressable style={styles.gear} hitSlop={10} onPress={() => setSettingsOpen(true)}>
            <View style={styles.gearDot} />
            <View style={styles.gearDot} />
            <View style={styles.gearDot} />
          </Pressable>
        </View>

        {/* where-to tabs */}
        <View style={styles.tabs}>
          {LOCATION_ORDER.map((loc: LocationId) => (
            <Pressable
              key={loc}
              style={[styles.tab, location === loc && styles.tabActive]}
              disabled={busy || fetching}
              onPress={() => barkly.goTo(loc)}
            >
              <Text style={[styles.tabText, location === loc && styles.tabTextActive]}>
                {LOCATIONS[loc].name.toLowerCase()}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* speech bubble */}
        <View style={styles.bubbleZone}>
          {bubbleText ? (
            <AnimatedBubble changeKey={bubbleText}>
              {lastExchange && !listening && lastExchange.userText !== '' && (
                <Text style={styles.bubbleYou} numberOfLines={1}>you said “{lastExchange.userText}”</Text>
              )}
              <Text style={styles.bubbleText} numberOfLines={4}>{bubbleText}</Text>
              <View style={styles.bubbleTail} />
            </AnimatedBubble>
          ) : (
            <Text style={[styles.hint, asleep && styles.hintNight]}>
              {asleep ? 'shh — he’s sleeping' : sttAvailable ? 'hold talk and say hi' : 'type something and say hi'}
            </Text>
          )}
          {error && <Text style={styles.error}>{error}</Text>}
        </View>

        {/* the stage: Barkly + neighbors + props */}
        <View style={styles.stageArea}>
          <View style={styles.shadow} />
          {asleep && location === 'home' && <DogBed />}
          {npcsHere.map((id) => (
            <NpcDog
              key={id}
              id={id}
              bubble={barkly.npcBubble?.id === id ? barkly.npcBubble.line : null}
              onPress={() => barkly.npcTalk(id)}
            />
          ))}
          <Animated.View
            style={{
              transform: [
                { translateX: Animated.add(chaseX, walkX) },
                { translateY: hopY },
                { rotate: digRotate.interpolate({ inputRange: [-1, 1], outputRange: ['-7deg', '7deg'] }) },
              ],
            }}
          >
            <Pressable onPress={pet} disabled={busy}>
              <Renderer state={snapshot.state} actions={actions} variant={variant} />
            </Pressable>
          </Animated.View>
          {fetching && variant !== 'carryLeft' && (
            <Animated.View style={[styles.fetchBall, { transform: [{ translateX: ballX }, { translateY: ballY }] }]} pointerEvents="none">
              <Svg width={30} height={30} viewBox="0 0 30 30">
                <Circle cx={15} cy={15} r={13} fill="#B3402E" />
                <Path d="M3 13 C11 9 19 9 27 13" stroke="#8E2F20" strokeWidth={2.5} fill="none" />
                <Circle cx={10} cy={9} r={3.5} fill="#FFFFFF" opacity={0.35} />
              </Svg>
            </Animated.View>
          )}
          {location === 'park' && !asleep && (
            <Pressable style={styles.digSpot} onPress={runDig} disabled={digging || fetching || busy} hitSlop={8}>
              <Svg width={86} height={44} viewBox="0 0 86 44">
                <Path d="M6 38 Q43 2 80 38 Z" fill="#8A6B3A" />
                <Path d="M18 38 Q43 14 68 38 Z" fill="#75592F" />
                <Circle cx={43} cy={34} r={7} fill="#5C4426" />
              </Svg>
              <Text style={styles.digHint}>{digging ? '…' : 'dig?'}</Text>
            </Pressable>
          )}
          {barkly.thought && !bubbleText && (
            <View style={styles.thought} pointerEvents="none">
              <Text style={styles.thoughtText}>{barkly.thought}</Text>
              <View style={styles.thoughtDot1} />
              <View style={styles.thoughtDot2} />
            </View>
          )}
          {snapshot.state === 'eating' && <FoodBowl />}
          {snapshot.state === 'playing' && !fetching && <Ball />}
          <HeartBurst burst={heartBurst} />
          {stateLabel && (
            <View style={styles.chip}>
              {(listening || snapshot.state === 'thinking') && <View style={styles.chipDot} />}
              <Text style={styles.chipText}>{stateLabel}</Text>
            </View>
          )}
        </View>

        {/* controls */}
        <View style={styles.controls}>
          {sttAvailable ? (
            <Pressable
              style={({ pressed }) => [
                styles.talk,
                listening && styles.talkActive,
                (busy || pressed) && styles.pressed,
                busy && styles.disabled,
              ]}
              disabled={busy}
              onPressIn={barkly.startTalk}
              onPressOut={barkly.stopTalk}
            >
              <View style={[styles.micDot, listening && styles.micDotLive]} />
              <Text style={styles.talkText}>{listening ? 'listening — release to send' : 'hold to talk'}</Text>
            </Pressable>
          ) : (
            <View style={styles.typeRow}>
              <TextInput
                style={styles.input}
                value={typed}
                onChangeText={setTyped}
                placeholder="say something to Barkly…"
                placeholderTextColor={INK_SOFT}
                editable={!busy}
                onSubmitEditing={sendTyped}
                returnKeyType="send"
              />
              <Pressable
                style={({ pressed }) => [styles.send, pressed && styles.pressed, (busy || !typed.trim()) && styles.disabled]}
                disabled={busy || !typed.trim()}
                onPress={sendTyped}
              >
                <Text style={styles.sendText}>talk</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.actionsRow}>
            <ActionButton label={playLabel} onPress={location === 'park' ? runFetch : barkly.play} disabled={busy || fetching} />
            <ActionButton label="feed" onPress={barkly.feed} disabled={busy || fetching} />
            <ActionButton
              label={asleep ? 'wake' : 'sleep'}
              onPress={barkly.sleepToggle}
              disabled={busy || fetching}
            />
          </View>
        </View>
      </KeyboardAvoidingView>

      <SettingsSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        memory={barkly.memorySnapshot()}
        stats={snapshot.stats}
        stash={barkly.stashItems}
        dialogueProviderName={barkly.dialogueProviderName}
        sttAvailable={sttAvailable}
        onForgetEverything={barkly.forgetEverything}
      />
    </View>
  );
}

function ActionButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  const springTo = (v: number) =>
    Animated.spring(scale, { toValue: v, friction: 5, tension: 300, useNativeDriver: true }).start();
  return (
    <Pressable
      style={styles.actionWrap}
      onPressIn={() => springTo(0.94)}
      onPressOut={() => springTo(1)}
      onPress={onPress}
      disabled={disabled}
    >
      <Animated.View style={[styles.action, disabled && styles.disabled, { transform: [{ scale }] }]}>
        <Text style={styles.actionText}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

const shadowCard = Platform.select({
  web: { boxShadow: '0 10px 24px rgba(74, 59, 42, 0.12)' } as object,
  default: {
    shadowColor: '#4A3B2A',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
});

const styles = StyleSheet.create({
  room: { flex: 1, backgroundColor: '#F7F1E2' },
  sceneLayer: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },

  content: { flex: 1, paddingTop: 54, paddingBottom: 26, paddingHorizontal: 22 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmarkChip: {
    backgroundColor: 'rgba(255,253,247,0.85)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    ...(shadowCard as object),
  },
  wordmark: { fontSize: 20, fontWeight: '800', color: INK, letterSpacing: 0.3 },
  gear: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: CARD,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 3,
    ...(shadowCard as object),
  },
  gearDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: INK_SOFT },

  tabs: {
    flexDirection: 'row',
    alignSelf: 'center',
    marginTop: 10,
    backgroundColor: 'rgba(255,253,247,0.85)',
    borderRadius: 999,
    padding: 4,
    gap: 4,
    ...(shadowCard as object),
  },
  tab: { paddingVertical: 7, paddingHorizontal: 18, borderRadius: 999 },
  tabActive: { backgroundColor: INK },
  tabText: { fontSize: 13, fontWeight: '800', color: INK_SOFT, letterSpacing: 0.4 },
  tabTextActive: { color: '#FBF6EA' },

  bubbleZone: { minHeight: 92, justifyContent: 'flex-end', alignItems: 'center', marginTop: 6 },
  hint: { fontSize: 15, color: INK_SOFT, marginBottom: 14 },
  hintNight: { color: '#E8DFC8' },
  bubble: {
    maxWidth: '92%',
    backgroundColor: CARD,
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 18,
    ...(shadowCard as object),
  },
  bubbleYou: { fontSize: 12, color: INK_SOFT, marginBottom: 5 },
  bubbleText: { fontSize: 17, fontWeight: '600', color: INK, lineHeight: 24 },
  bubbleTail: {
    position: 'absolute',
    bottom: -7,
    left: '48%',
    width: 16,
    height: 16,
    backgroundColor: CARD,
    borderRadius: 3,
    transform: [{ rotate: '45deg' }],
  },
  error: { marginTop: 8, fontSize: 13, color: '#B3402E', textAlign: 'center' },

  stageArea: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 22 },
  shadow: {
    position: 'absolute',
    bottom: 18,
    width: 230,
    height: 30,
    borderRadius: 115,
    backgroundColor: '#4A3B2A',
    opacity: 0.15,
  },
  heartLayer: { position: 'absolute', bottom: 190, alignSelf: 'center' },
  heart: { position: 'absolute', fontSize: 24, color: '#D46A5A' },
  fetchBall: { position: 'absolute', bottom: 40, alignSelf: 'center', zIndex: 7 },

  npc: { position: 'absolute', alignItems: 'center', zIndex: 3 },
  digSpot: { position: 'absolute', left: 18, bottom: 26, alignItems: 'center', zIndex: 2 },
  digHint: {
    marginTop: 2, fontSize: 11, fontWeight: '800', color: INK_SOFT,
    backgroundColor: 'rgba(255,253,247,0.8)', paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 999, overflow: 'hidden',
  },
  thought: {
    position: 'absolute', top: 0, alignSelf: 'center', maxWidth: 250,
    backgroundColor: 'rgba(255,253,247,0.92)', borderRadius: 18,
    paddingVertical: 9, paddingHorizontal: 14,
    ...(shadowCard as object),
  },
  thoughtText: { fontSize: 13, fontStyle: 'italic', color: INK_SOFT, lineHeight: 18 },
  thoughtDot1: {
    position: 'absolute', bottom: -8, left: '46%', width: 9, height: 9, borderRadius: 5,
    backgroundColor: 'rgba(255,253,247,0.92)',
  },
  thoughtDot2: {
    position: 'absolute', bottom: -15, left: '52%', width: 5, height: 5, borderRadius: 3,
    backgroundColor: 'rgba(255,253,247,0.85)',
  },
  npcName: {
    marginTop: -4,
    fontSize: 11,
    fontWeight: '800',
    color: INK_SOFT,
    backgroundColor: 'rgba(255,253,247,0.8)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  npcBubble: {
    maxWidth: 170,
    backgroundColor: CARD,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 6,
    ...(shadowCard as object),
  },
  npcBubbleText: { fontSize: 12.5, fontWeight: '600', color: INK, lineHeight: 17 },

  chip: {
    position: 'absolute',
    bottom: -6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: CARD,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 13,
    ...(shadowCard as object),
  },
  chipDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: ACCENT },
  chipText: { fontSize: 13, fontWeight: '700', color: INK_SOFT },

  controls: { gap: 10 },
  talk: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: INK,
    borderRadius: 999,
    paddingVertical: 18,
    ...(shadowCard as object),
  },
  talkActive: { backgroundColor: '#B3402E' },
  micDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: ACCENT },
  micDotLive: { backgroundColor: '#FFD9CF' },
  talkText: { color: '#FBF6EA', fontWeight: '800', fontSize: 16, letterSpacing: 0.4 },

  typeRow: { flexDirection: 'row', gap: 10 },
  input: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 15,
    fontSize: 15,
    color: INK,
    ...(shadowCard as object),
  },
  send: {
    backgroundColor: INK,
    borderRadius: 999,
    paddingHorizontal: 24,
    justifyContent: 'center',
    ...(shadowCard as object),
  },
  sendText: { color: '#FBF6EA', fontWeight: '800', fontSize: 15, letterSpacing: 0.4 },

  actionsRow: { flexDirection: 'row', gap: 10 },
  actionWrap: { flex: 1 },
  action: {
    backgroundColor: CARD,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    ...(shadowCard as object),
  },
  pressed: { transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.45 },
  actionText: { fontWeight: '800', color: INK, fontSize: 15, letterSpacing: 0.4 },
});
```

## `barkly/app/src/ui/BarklyPhotoView.tsx`

```typescript
/**
 * Photo renderer — displays the ACTUAL approved renders of Barkly, cut from
 * the concept sheet (assets/barkly/renders/*, sourced from
 * assets/barkly/concept/barkly-concept.png). This is the default renderer:
 * it looks exactly like the character because it IS the character.
 *
 * Motion design: everything is spring- or sine-based so nothing snaps.
 *  - entrance pop on mount
 *  - continuous breathe + slow idle drift
 *  - true crossfade between poses (two stacked images), with a scale settle
 *  - one-shot squash-and-stretch pop on emotional beats
 *  - talk-bob with a slight nod while speaking
 *  - excited bounce with squash on landing, sway when the tail would wag
 *  - floating, staggered z's while asleep
 *
 * Implements BarklyRenderProps (src/animation/renderer.ts).
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { BarklyRenderProps } from '../animation/renderer';
import { BarklyState, BodyAction } from '../barkly/types';

const RENDERS = {
  front: require('../../assets/barkly/renders/front.png'),
  sideSleep: require('../../assets/barkly/renders/side_sleep.png'), // eyes closed
  threeQuarter: require('../../assets/barkly/renders/three_quarter.png'),
  threeQuarterR: require('../../assets/barkly/renders/three_quarter_r.png'),      // mirrored: facing right
  threeQuarterBall: require('../../assets/barkly/renders/three_quarter_ball.png'), // carrying the ball, facing left
  face: require('../../assets/barkly/renders/face.png'),
} as const;

// Facial variants derived from the front render (see assets README):
// real jaw-flap while speaking, real blinks while idle.
const FRONT_MOUTH_OPEN = require('../../assets/barkly/renders/front_mouth_open.png');
const FRONT_BLINK = require('../../assets/barkly/renders/front_blink.png');
const FRONT_WIDE = require('../../assets/barkly/renders/front_wide.png');   // listening
const FRONT_SMILE = require('../../assets/barkly/renders/front_smile.png'); // happy

type Pose = keyof typeof RENDERS;

function poseFor(state: BarklyState): Pose {
  switch (state) {
    case 'playing':
    case 'excited':
      return 'threeQuarter';
    case 'sleepy':
      return 'sideSleep';
    case 'thinking':
    case 'annoyed':
      return 'face'; // the sheet's EXPRESSION closeup — a dramatic zoom beat
    default:
      return 'front';
  }
}

const POSE_SIZE: Record<Pose, { width: number; height: number }> = {
  front: { width: 244, height: 305 },
  sideSleep: { width: 280, height: 313 },
  threeQuarter: { width: 260, height: 300 },
  threeQuarterR: { width: 260, height: 300 },
  threeQuarterBall: { width: 260, height: 300 },
  face: { width: 210, height: 170 },
};

/** States that get a one-shot squash-and-stretch pop when entered. */
const POP_STATES: BarklyState[] = ['happy', 'excited', 'playing', 'eating', 'annoyed'];

/** Continuous 0→1→0 sine-feel loop while `active`. */
function useLoop(active: boolean, duration: number): Animated.Value {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      v.stopAnimation();
      Animated.timing(v, { toValue: 0, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, duration, v]);
  return v;
}

/** Floating, staggered sleep z's. */
function SleepZs() {
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(drift, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [drift]);

  const zs = [
    { size: 14, delayRange: [0, 0.55] as const, x: 0 },
    { size: 18, delayRange: [0.2, 0.75] as const, x: 14 },
    { size: 23, delayRange: [0.4, 0.95] as const, x: 26 },
  ];
  return (
    <View style={styles.zzzWrap} pointerEvents="none">
      {zs.map((z, i) => {
        const rise = drift.interpolate({ inputRange: [0, 1], outputRange: [6, -14 - i * 6] });
        const fade = drift.interpolate({
          inputRange: [0, z.delayRange[0], z.delayRange[1], 1],
          outputRange: [0, 0.15, 0.85, 0],
        });
        return (
          <Animated.Text
            key={i}
            style={[styles.zzz, { fontSize: z.size, left: z.x, opacity: fade, transform: [{ translateY: rise }] }]}
          >
            z
          </Animated.Text>
        );
      })}
    </View>
  );
}

export default function BarklyPhotoView({ state, actions, variant }: BarklyRenderProps) {
  const has = (a: BodyAction) => actions.includes(a);
  const asleep = state === 'sleepy' || has('SLEEP');
  const talking = has('MOUTH_MOVE');
  const pose: Pose =
    variant === 'runRight' ? 'threeQuarterR' :
    variant === 'carryLeft' ? 'threeQuarterBall' :
    poseFor(state);
  const size = POSE_SIZE[pose];

  // Jaw-flap: alternate open/closed mouth frames while speaking.
  const [jawOpen, setJawOpen] = useState(false);
  useEffect(() => {
    if (!talking) {
      setJawOpen(false);
      return;
    }
    const id = setInterval(() => setJawOpen((j) => !j), 150);
    return () => clearInterval(id);
  }, [talking]);

  // Occasional deadpan blink (front pose only — the others hold their look).
  const [blinking, setBlinking] = useState(false);
  useEffect(() => {
    if (asleep) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        if (!alive) return;
        setBlinking(true);
        setTimeout(() => {
          if (alive) setBlinking(false);
          schedule();
        }, 130);
      }, 2600 + Math.random() * 3000);
    };
    schedule();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [asleep]);

  // --- continuous loops ---
  const breathe = useLoop(true, asleep ? 1700 : 2300);
  const drift = useLoop(true, 3600); // slow ambient lean so idle never freezes
  const bob = useLoop(talking, 170);
  const bounce = useLoop(has('EXCITED'), 270);
  const sway = useLoop(has('TAIL_WAG'), 340);
  const look = useLoop(has('LOOK_LEFT') || has('LOOK_RIGHT'), 950);

  // --- springs ---
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(enter, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }).start();
  }, [enter]);

  const tilt = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(tilt, {
      toValue: has('HEAD_TILT') ? 1 : 0,
      friction: 5,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [actions]); // eslint-disable-line react-hooks/exhaustive-deps

  // One-shot squash-and-stretch when an emotional beat lands.
  const squash = useRef(new Animated.Value(0)).current;
  const prevState = useRef(state);
  useEffect(() => {
    if (prevState.current !== state && POP_STATES.includes(state)) {
      squash.setValue(0);
      Animated.sequence([
        Animated.timing(squash, { toValue: 1, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(squash, { toValue: 0, friction: 4, tension: 120, useNativeDriver: true }),
      ]).start();
    }
    prevState.current = state;
  }, [state, squash]);

  // --- pose crossfade: keep the old render on screen while the new fades in ---
  const [shown, setShown] = useState<{ current: Pose; prev: Pose | null }>({ current: pose, prev: null });
  const cross = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (pose === shown.current) return;
    setShown({ current: pose, prev: shown.current });
    cross.setValue(0);
    Animated.spring(cross, { toValue: 1, friction: 8, tension: 90, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setShown((s) => ({ ...s, prev: null }));
    });
  }, [pose]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- derived transforms ---
  const breatheScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, asleep ? 1.026 : 1.012] });
  const driftRotate = drift.interpolate({ inputRange: [0, 1], outputRange: ['-0.7deg', '0.7deg'] });
  const talkBob = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  const talkNod = bob.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '1.1deg'] });
  const bounceLift = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -20] });
  const bounceSquash = bounce.interpolate({ inputRange: [0, 0.15, 1], outputRange: [1, 0.965, 1.02] });
  const swayRotate = sway.interpolate({ inputRange: [0, 1], outputRange: ['-1.8deg', '1.8deg'] });
  const tiltRotate = tilt.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-6deg'] });
  const lookShift = look.interpolate({
    inputRange: [0, 1],
    outputRange: has('LOOK_LEFT') && has('LOOK_RIGHT') ? [-8, 8] : has('LOOK_LEFT') ? [0, -10] : [0, 10],
  });
  const enterScale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  const squashX = squash.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });
  const squashY = squash.interpolate({ inputRange: [0, 1], outputRange: [1, 0.93] });
  const crossIn = cross.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const crossOut = cross.interpolate({ inputRange: [0, 0.65, 1], outputRange: [1, 0, 0] });
  const crossScale = cross.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  const sleepDroop = asleep ? '2deg' : '0deg';

  const prevSize = shown.prev ? POSE_SIZE[shown.prev] : size;

  return (
    <View style={styles.stage}>
      <Animated.View
        style={{
          opacity: enter,
          transform: [
            { translateY: Animated.add(talkBob, bounceLift) },
            { translateX: lookShift },
            { rotate: driftRotate },
            { rotate: swayRotate },
            { rotate: tiltRotate },
            { rotate: talkNod },
            { rotate: sleepDroop },
            { scale: Animated.multiply(breatheScale, enterScale) },
            { scaleX: Animated.multiply(squashX, bounceSquash) },
            { scaleY: squashY },
          ],
        }}
      >
        <View style={{ width: size.width, height: size.height, alignItems: 'center', justifyContent: 'flex-end' }}>
          {shown.prev && (
            <Animated.Image
              source={RENDERS[shown.prev]}
              style={{ position: 'absolute', bottom: 0, width: prevSize.width, height: prevSize.height, opacity: crossOut }}
              resizeMode="contain"
            />
          )}
          <Animated.Image
            source={
              shown.current === 'front'
                ? talking && jawOpen
                  ? FRONT_MOUTH_OPEN
                  : blinking
                    ? FRONT_BLINK
                    : state === 'listening'
                      ? FRONT_WIDE
                      : state === 'happy'
                        ? FRONT_SMILE
                        : RENDERS.front
                : RENDERS[shown.current]
            }
            style={{ width: size.width, height: size.height, opacity: crossIn, transform: [{ scale: crossScale }] }}
            resizeMode="contain"
          />
        </View>
      </Animated.View>

      {/* invisible preloads so the first variant swap never flickers */}
      <Image source={FRONT_MOUTH_OPEN} style={styles.preload} />
      <Image source={FRONT_BLINK} style={styles.preload} />
      <Image source={FRONT_WIDE} style={styles.preload} />
      <Image source={FRONT_SMILE} style={styles.preload} />

      {asleep && <SleepZs />}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { width: 300, height: 322, alignItems: 'center', justifyContent: 'flex-end' },
  preload: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  zzzWrap: { position: 'absolute', top: 8, right: 34, width: 60, height: 60 },
  zzz: { position: 'absolute', bottom: 0, color: '#A08F6F', fontWeight: '800' },
});
```

## `barkly/app/src/ui/scenes/Scenes.tsx`

```typescript
/**
 * Scene backgrounds for Barkly's world — home, park, town — plus the night
 * overlay and dog bed used while he sleeps. Full-bleed absolute layers that
 * sit behind the stage. All vector/gradient, tuned to the concept palette so
 * the clay renders sit naturally on top.
 *
 * `hour` (0–23) shifts the sky so mornings, days, and evenings feel different.
 */

import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

const FACE = require('../../../assets/barkly/renders/face.png');

type SkyBand = 'morning' | 'day' | 'evening' | 'night';

export function skyBand(hour: number): SkyBand {
  if (hour >= 21 || hour < 6) return 'night';
  if (hour < 10) return 'morning';
  if (hour < 17) return 'day';
  return 'evening';
}

const SKY: Record<SkyBand, [string, string]> = {
  morning: ['#F6E3C5', '#EAF0DC'],
  day: ['#C4E0E8', '#EAF3E0'],
  evening: ['#EFC9A0', '#E5D3BC'],
  night: ['#3B3A5C', '#6B6488'],
};

// ---------------------------------------------------------------- home

export function HomeScene({ hour }: { hour: number }) {
  const band = skyBand(hour);
  return (
    <View style={styles.fill} pointerEvents="none">
      {/* wall */}
      <LinearGradient colors={['#F7F1E2', '#EFE5CE']} style={styles.fill} />
      {/* floor: warm wood with plank seams */}
      <View style={styles.homeFloor}>
        <LinearGradient colors={['#E3CFA6', '#D6BE90']} style={styles.fill} />
        <Svg width="100%" height="100%" viewBox="0 0 420 330" preserveAspectRatio="none">
          {[70, 150, 230, 310].map((x, i) => (
            <Path key={i} d={`M${x} 0 L${x - 34} 330`} stroke="#C9AF7E" strokeWidth={2.5} opacity={0.5} />
          ))}
        </Svg>
      </View>
      {/* baseboard */}
      <View style={styles.baseboard} />
      {/* window with live sky */}
      <View style={styles.window}>
        <LinearGradient colors={SKY[band]} style={styles.windowSky}>
          {band === 'night' && (
            <Svg width="100%" height="100%">
              <Circle cx="72%" cy="26%" r={13} fill="#F2EAC8" />
              <Circle cx="66%" cy="22%" r={11} fill={SKY.night[0]} />
              <Circle cx="22%" cy="40%" r={1.6} fill="#F2EAC8" />
              <Circle cx="38%" cy="18%" r={1.4} fill="#F2EAC8" />
              <Circle cx="55%" cy="55%" r={1.4} fill="#F2EAC8" />
            </Svg>
          )}
          {band !== 'night' && (
            <Svg width="100%" height="100%">
              <Ellipse cx="30%" cy="34%" rx={22} ry={9} fill="#FFFFFF" opacity={0.8} />
              <Ellipse cx="68%" cy="58%" rx={17} ry={7} fill="#FFFFFF" opacity={0.65} />
            </Svg>
          )}
        </LinearGradient>
        <View style={styles.windowBarH} />
        <View style={styles.windowBarV} />
        <View style={styles.windowSill} />
      </View>
      {/* framed portrait of the good boy himself */}
      <View style={styles.frame}>
        <Image source={FACE} style={styles.framePhoto} resizeMode="contain" />
      </View>
      {/* rug */}
      <View style={styles.homeRug} />
    </View>
  );
}

// ---------------------------------------------------------------- park

export function ParkScene({ hour }: { hour: number }) {
  const band = skyBand(hour);
  const night = band === 'night';
  return (
    <View style={styles.fill} pointerEvents="none">
      <LinearGradient colors={SKY[band]} style={styles.fill} />
      {/* sky details */}
      <Svg width={420} height={190} style={styles.skyTop}>
        {band === 'day' && <Circle cx={62} cy={96} r={30} fill="#F5DC8C" opacity={0.9} />}
        {band === 'evening' && <Circle cx={62} cy={110} r={30} fill="#EFA35C" opacity={0.9} />}
        {night && <Circle cx={60} cy={92} r={22} fill="#F2EAC8" />}
        <Ellipse cx={150} cy={148} rx={46} ry={16} fill="#FFFFFF" opacity={night ? 0.14 : 0.75} />
        <Ellipse cx={250} cy={92} rx={36} ry={13} fill="#FFFFFF" opacity={night ? 0.1 : 0.6} />
      </Svg>
      {/* ground block, anchored to the bottom */}
      <Svg width="100%" height={460} viewBox="0 0 420 460" preserveAspectRatio="none" style={styles.ground}>
        {/* rolling hills */}
        <Ellipse cx={90} cy={166} rx={260} ry={110} fill={night ? '#7E9068' : '#BCD094'} />
        <Ellipse cx={370} cy={186} rx={280} ry={120} fill={night ? '#88996F' : '#C8DAA2'} />
        {/* trees */}
        <Rect x={44} y={38} width={13} height={46} rx={5} fill="#8A6B3A" />
        <Circle cx={50} cy={26} r={34} fill={night ? '#5F7A48' : '#93AE68'} />
        <Circle cx={30} cy={40} r={22} fill={night ? '#6B8752' : '#9FB975'} />
        <Rect x={342} y={52} width={12} height={42} rx={5} fill="#8A6B3A" />
        <Circle cx={348} cy={40} r={30} fill={night ? '#6B8752' : '#9FB975'} />
        {/* fence line */}
        {Array.from({ length: 9 }, (_, i) => 24 + i * 47).map((x) => (
          <Rect key={x} x={x} y={126} width={9} height={44} rx={4} fill={night ? '#A08C68' : '#D9C49A'} />
        ))}
        <Rect x={12} y={134} width={396} height={7} rx={3.5} fill={night ? '#93805F' : '#CBB489'} />
        <Rect x={12} y={152} width={396} height={7} rx={3.5} fill={night ? '#93805F' : '#CBB489'} />
        {/* grass ground */}
        <Rect x={0} y={170} width={420} height={290} fill={night ? '#78905C' : '#AECB84'} />
        <Ellipse cx={210} cy={176} rx={260} ry={26} fill={night ? '#6E8754' : '#A3C178'} />
        {/* grass tufts */}
        {[60, 150, 300, 372].map((x, i) => (
          <Path key={i} d={`M${x} ${250 + (i % 2) * 60} q3 -12 6 0 q3 -12 6 0`}
            stroke={night ? '#5F7A48' : '#94B569'} strokeWidth={2.5} fill="none" />
        ))}
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------- town

export function TownScene({ hour }: { hour: number }) {
  const band = skyBand(hour);
  const night = band === 'night';
  const dim = (day: string, nite: string) => (night ? nite : day);
  return (
    <View style={styles.fill} pointerEvents="none">
      <LinearGradient colors={SKY[band]} style={styles.fill} />
      <Svg width="100%" height={560} viewBox="0 0 420 560" preserveAspectRatio="none" style={styles.ground}>
        {/* storefront block */}
        <Rect x={0} y={0} width={420} height={280} fill={dim('#E8D9BC', '#A99C82')} />
        {/* left shop: the bakery */}
        <Rect x={14} y={20} width={172} height={240} rx={8} fill={dim('#DEC49A', '#A08C68')} />
        <Rect x={14} y={42} width={172} height={12} fill="#B3402E" opacity={0.85} />
        {Array.from({ length: 5 }, (_, i) => 20 + i * 34).map((x, i) => (
          <Path key={x} d={`M${x} 54 h26 a13 13 0 0 1 -26 0 Z`} fill={i % 2 === 0 ? '#C97B5A' : dim('#F1E4C8', '#C9BCA0')} />
        ))}
        <Rect x={34} y={90} width={58} height={74} rx={6} fill={dim('#8FB3C4', '#F5DC8C')} opacity={0.9} />
        <Rect x={110} y={90} width={56} height={170} rx={6} fill="#7A5A38" />
        <Circle cx={120} cy={172} r={4} fill="#C9963C" />
        {/* bone sign */}
        <Rect x={52} y={4} width={96} height={30} rx={8} fill="#4B3527" />
        <Path d="M84 19 h32 M84 19 a5 5 0 1 1 -6 -6 a5 5 0 1 1 6 6 M116 19 a5 5 0 1 0 6 -6 a5 5 0 1 0 -6 6"
          stroke="#E8D9BC" strokeWidth={5} strokeLinecap="round" fill="none" />
        {/* right shop */}
        <Rect x={232} y={20} width={174} height={240} rx={8} fill={dim('#CBB489', '#93805F')} />
        <Rect x={232} y={42} width={174} height={12} fill="#5C7A52" opacity={0.85} />
        <Rect x={252} y={90} width={62} height={78} rx={6} fill={dim('#8FB3C4', '#F5DC8C')} opacity={0.9} />
        <Rect x={332} y={90} width={56} height={170} rx={6} fill="#6B4E30" />
        {/* lamppost */}
        <Rect x={204} y={86} width={9} height={182} rx={4} fill="#4A403A" />
        <Circle cx={208} cy={78} r={13} fill={night ? '#F5DC8C' : '#E8DFC8'} />
        {night && <Circle cx={208} cy={78} r={26} fill="#F5DC8C" opacity={0.18} />}
        {/* cobbled street */}
        <Rect x={0} y={260} width={420} height={300} fill={dim('#D8C6A4', '#9C8D70')} />
        <Ellipse cx={210} cy={266} rx={260} ry={24} fill={dim('#CDBA95', '#91836A')} />
        {[
          [60, 330], [150, 360], [260, 335], [340, 375], [100, 430], [230, 420], [330, 470],
        ].map(([x, y], i) => (
          <Ellipse key={i} cx={x} cy={y} rx={26} ry={9} fill={dim('#CBB78F', '#8C7E64')} />
        ))}
      </Svg>
    </View>
  );
}

// ------------------------------------------------------- sleep dressing

/** Dim, starry overlay while Barkly sleeps. Renders above the scene. */
export function NightOverlay() {
  return (
    <View style={[styles.fill, styles.night]} pointerEvents="none">
      <Svg width="100%" height="45%">
        <Circle cx="18%" cy="30%" r={1.8} fill="#F2EAC8" opacity={0.9} />
        <Circle cx="34%" cy="14%" r={1.4} fill="#F2EAC8" opacity={0.7} />
        <Circle cx="55%" cy="26%" r={1.7} fill="#F2EAC8" opacity={0.8} />
        <Circle cx="72%" cy="12%" r={1.4} fill="#F2EAC8" opacity={0.7} />
        <Circle cx="88%" cy="32%" r={1.8} fill="#F2EAC8" opacity={0.9} />
      </Svg>
    </View>
  );
}

/** Barkly's bed — appears under him while he sleeps at home. */
export function DogBed() {
  return (
    <View style={styles.bed} pointerEvents="none">
      <Svg width={300} height={92} viewBox="0 0 300 92">
        <Ellipse cx={150} cy={50} rx={144} ry={40} fill="#7A5A38" />
        <Ellipse cx={150} cy={44} rx={130} ry={33} fill="#8A6844" />
        <Ellipse cx={150} cy={48} rx={112} ry={26} fill="#EFE0BC" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  night: { backgroundColor: 'rgba(28, 24, 56, 0.34)' },

  homeFloor: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: '42%',
    borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden',
  },
  baseboard: {
    position: 'absolute', left: 0, right: 0, bottom: '42%', height: 10,
    backgroundColor: '#E0D2B2',
  },
  window: {
    position: 'absolute', top: '19%', left: '7%', width: 126, height: 112,
    borderRadius: 14, borderWidth: 7, borderColor: '#C9AF7E',
    overflow: 'hidden', backgroundColor: '#C9AF7E',
  },
  windowSky: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  windowBarH: { position: 'absolute', top: '50%', left: 0, right: 0, height: 5, backgroundColor: '#C9AF7E' },
  windowBarV: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 5, backgroundColor: '#C9AF7E' },
  windowSill: { position: 'absolute', bottom: 0, left: -8, right: -8, height: 8, backgroundColor: '#BCA271' },
  frame: {
    position: 'absolute', top: '21%', right: '8%', width: 74, height: 66,
    borderRadius: 8, borderWidth: 5, borderColor: '#8A6844', backgroundColor: '#F4EAD2',
    alignItems: 'center', justifyContent: 'center',
    transform: [{ rotate: '2.5deg' }],
  },
  framePhoto: { width: 56, height: 48 },
  homeRug: {
    position: 'absolute', bottom: '15%', alignSelf: 'center', width: 300, height: 64,
    borderRadius: 150, backgroundColor: '#C77C52', opacity: 0.3,
  },
  skyTop: { position: 'absolute', top: 0, left: 0 },
  ground: { position: 'absolute', bottom: 0, left: 0, right: 0 },

  bed: { position: 'absolute', bottom: 6, alignSelf: 'center', zIndex: 1 },
});
```

## `barkly/app/src/ui/StageProps.tsx`

```typescript
/**
 * Stage props — small scene objects that appear for specific states:
 * a food bowl while eating, a bouncing ball while playing. Each springs in
 * on appear. Palette matches the concept sheet.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

function useSpringIn(): Animated.Value {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
  }, [v]);
  return v;
}

export function FoodBowl() {
  const inV = useSpringIn();
  return (
    <Animated.View
      style={[
        styles.bowl,
        { opacity: inV, transform: [{ scale: inV.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] },
      ]}
      pointerEvents="none"
    >
      <Svg width={104} height={46} viewBox="0 0 104 46">
        {/* kibble peeking over the rim */}
        <Circle cx={38} cy={12} r={6.5} fill="#8A6B3A" />
        <Circle cx={52} cy={9} r={7} fill="#9C7A42" />
        <Circle cx={66} cy={12} r={6.5} fill="#8A6B3A" />
        {/* bowl body */}
        <Path d="M8 14 L96 14 C96 34 82 44 52 44 C22 44 8 34 8 14 Z" fill="#3A322C" />
        <Ellipse cx={52} cy={14} rx={44} ry={8} fill="#4A403A" />
        <Ellipse cx={52} cy={13} rx={36} ry={5.5} fill="#2A241F" />
        {/* rim highlight */}
        <Path d="M14 18 C18 30 30 38 46 40" stroke="#5C5049" strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.7} />
      </Svg>
    </Animated.View>
  );
}

export function Ball() {
  const inV = useSpringIn();
  const bounce = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 320, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bounce]);
  const lift = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -46] });
  const squash = bounce.interpolate({ inputRange: [0, 0.12, 1], outputRange: [1, 0.85, 1.05] });
  return (
    <Animated.View
      style={[
        styles.ball,
        {
          opacity: inV,
          transform: [{ translateY: lift }, { scaleY: squash }],
        },
      ]}
      pointerEvents="none"
    >
      <Svg width={40} height={40} viewBox="0 0 40 40">
        <Circle cx={20} cy={20} r={18} fill="#B3402E" />
        <Path d="M2.5 17 C14 12 26 12 37.5 17" stroke="#8E2F20" strokeWidth={3} fill="none" />
        <Circle cx={13} cy={12} r={5} fill="#FFFFFF" opacity={0.35} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bowl: { position: 'absolute', bottom: 42, alignSelf: 'center', marginLeft: 4, zIndex: 6 },
  ball: { position: 'absolute', bottom: 16, left: 24, zIndex: 6 },
});
```

## `barkly/app/src/ui/SettingsSheet.tsx`

```typescript
/**
 * Settings — deliberately small: what Barkly remembers (with the delete-all
 * control the privacy posture requires), and which providers are live.
 */

import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MemoryState } from '../barkly/memory';
import { BarklyStats } from '../barkly/types';
import { Treasure } from '../world/stash';

interface Props {
  visible: boolean;
  onClose: () => void;
  memory: MemoryState;
  stats: BarklyStats;
  stash: Treasure[];
  dialogueProviderName: string;
  sttAvailable: boolean;
  onForgetEverything: () => Promise<void>;
}

function StatBar({ label, value, invert }: { label: string; value: number; invert?: boolean }) {
  // For hunger, "full" is the good end — invert the display so full bars
  // always mean "he's doing great".
  const shown = invert ? 100 - value : value;
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statTrack}>
        <View style={[styles.statFill, { width: `${Math.max(4, shown)}%` }]} />
      </View>
    </View>
  );
}

export default function SettingsSheet(props: Props) {
  const { visible, onClose, memory, stats, stash, dialogueProviderName, sttAvailable, onForgetEverything } = props;
  const [wiping, setWiping] = useState(false);

  const confirmForget = () => {
    Alert.alert(
      'Forget everything?',
      "This permanently deletes Barkly's memory of you — conversations, facts, promises. He will start over.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forget',
          style: 'destructive',
          onPress: async () => {
            setWiping(true);
            await onForgetEverything();
            setWiping(false);
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Settings</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scroll}>
            <Text style={styles.section}>How Barkly is doing</Text>
            <StatBar label="mood" value={stats.mood} />
            <StatBar label="energy" value={stats.energy} />
            <StatBar label="tummy" value={stats.hunger} invert />
            <StatBar label="bond" value={stats.affection} />

            <Text style={styles.section}>Barkly's stash</Text>
            {stash.length === 0 && <Text style={styles.empty}>Nothing yet. There's a dig spot at the park…</Text>}
            {stash.map((t) => (
              <Text key={t.id} style={styles.row}>{t.icon}  {t.name}</Text>
            ))}

            <Text style={styles.section}>Providers</Text>
            <Text style={styles.row}>Dialogue: {dialogueProviderName}</Text>
            <Text style={styles.row}>
              Speech input: {sttAvailable ? 'on-device recognition' : 'keyboard (mic needs a dev build)'}
            </Text>

            <Text style={styles.section}>What Barkly knows about you</Text>
            {memory.userFacts.length === 0 && <Text style={styles.empty}>Nothing yet. Tell him your name.</Text>}
            {memory.userFacts.map((f) => (
              <Text key={f} style={styles.row}>• {f}</Text>
            ))}

            <Text style={styles.section}>What Barkly remembers doing with you</Text>
            {memory.barklyMemories.length === 0 && <Text style={styles.empty}>No shared memories yet.</Text>}
            {memory.barklyMemories.map((f) => (
              <Text key={f} style={styles.row}>• {f}</Text>
            ))}

            <Pressable style={styles.forget} onPress={confirmForget} disabled={wiping}>
              <Text style={styles.forgetText}>{wiping ? 'Forgetting…' : 'Forget everything'}</Text>
            </Pressable>
            <Text style={styles.note}>
              Audio is only captured while you hold TALK and never stored. Speech is
              recognized on this device; only the text is sent to the dialogue provider.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFF9EC',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    padding: 20,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: '#2E2A26' },
  close: { fontSize: 18, color: '#2E2A26' },
  scroll: { marginTop: 8 },
  section: { marginTop: 16, marginBottom: 6, fontSize: 13, fontWeight: '800', color: '#8B7B55', textTransform: 'uppercase' },
  row: { fontSize: 15, color: '#2E2A26', marginBottom: 4 },
  empty: { fontSize: 14, color: '#9A8F7A', fontStyle: 'italic' },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 7 },
  statLabel: { width: 56, fontSize: 13, fontWeight: '700', color: '#8B7B55' },
  statTrack: { flex: 1, height: 9, borderRadius: 5, backgroundColor: '#E8DCC0', overflow: 'hidden' },
  statFill: { height: 9, borderRadius: 5, backgroundColor: '#C6952F' },
  forget: {
    marginTop: 24,
    backgroundColor: '#B3402E',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  forgetText: { color: 'white', fontWeight: '800', fontSize: 15 },
  note: { marginTop: 14, marginBottom: 24, fontSize: 12, color: '#9A8F7A', lineHeight: 17 },
});
```

## `barkly/app/App.tsx`

```typescript
import { StatusBar } from 'expo-status-bar';
import BarklyRoom from './src/ui/BarklyRoom';

export default function App() {
  return (
    <>
      <BarklyRoom />
      <StatusBar style="dark" />
    </>
  );
}
```

## `barkly/server/index.mjs`

```javascript
/**
 * Barkly backend proxy — the production home for the Anthropic API key.
 *
 * The mobile app's Anthropic adapter takes a baseURL; point
 * EXPO_PUBLIC_BARKLY_BACKEND_URL at this server and the app never carries a
 * real key. The proxy forwards ONLY POST /v1/messages to Anthropic, attaching
 * the server-held key, and enforces a request ceiling per client IP so a leaked
 * app build can't drain the account.
 *
 * Zero dependencies — plain Node 18+ (global fetch). Run:
 *   ANTHROPIC_API_KEY=sk-... node index.mjs           # port 8787
 */

import http from 'node:http';

const PORT = Number(process.env.PORT || 8787);
const KEY = process.env.ANTHROPIC_API_KEY;
const UPSTREAM = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
const MAX_BODY = 512 * 1024;

// Naive fixed-window rate limit: enough to stop abuse of a dev deployment.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = Number(process.env.BARKLY_RPM_LIMIT || 30);
const hits = new Map(); // ip -> { count, windowStart }

function limited(ip) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.windowStart > WINDOW_MS) {
    hits.set(ip, { count: 1, windowStart: now });
    return false;
  }
  h.count += 1;
  return h.count > MAX_PER_WINDOW;
}

const CORS = {
  'Access-Control-Allow-Origin': '*', // tighten to the app's origin(s) in production
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, anthropic-version, x-api-key, anthropic-dangerous-direct-browser-access',
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    return res.end();
  }
  if (req.method !== 'POST' || req.url !== '/v1/messages') {
    res.writeHead(404, { ...CORS, 'content-type': 'application/json' });
    return res.end(JSON.stringify({ error: 'not found' }));
  }
  if (!KEY) {
    res.writeHead(500, { ...CORS, 'content-type': 'application/json' });
    return res.end(JSON.stringify({ error: 'server missing ANTHROPIC_API_KEY' }));
  }
  const ip = req.socket.remoteAddress || 'unknown';
  if (limited(ip)) {
    res.writeHead(429, { ...CORS, 'content-type': 'application/json' });
    return res.end(JSON.stringify({ error: 'rate limited' }));
  }

  let body = '';
  let over = false;
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > MAX_BODY && !over) {
      over = true;
      res.writeHead(413, { ...CORS, 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'request too large' }));
      req.destroy();
    }
  });
  req.on('end', async () => {
    if (over) return;
    try {
      const upstream = await fetch(`${UPSTREAM}/v1/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': KEY,
          'anthropic-version': req.headers['anthropic-version'] || '2023-06-01',
        },
        body,
      });
      const text = await upstream.text();
      res.writeHead(upstream.status, { ...CORS, 'content-type': 'application/json' });
      res.end(text);
    } catch (e) {
      res.writeHead(502, { ...CORS, 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: `upstream failure: ${e.message}` }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`barkly proxy listening on :${PORT} (upstream ${UPSTREAM}, limit ${MAX_PER_WINDOW}/min/ip)`);
});
```

## `barkly/app/__tests__/state.test.ts`

```typescript
import {
  baselineState,
  decayStats,
  DEFAULT_STATS,
  freshSnapshot,
  reduce,
  settleDelayMs,
} from '../src/barkly/state';
import { BarklySnapshot } from '../src/barkly/types';

const snap = (over: Partial<BarklySnapshot> = {}): BarklySnapshot => ({
  ...freshSnapshot(0),
  ...over,
});

describe('talk flow transitions', () => {
  it('walks listening → thinking → speaking → baseline', () => {
    let s = snap();
    s = reduce(s, { type: 'TALK_START' });
    expect(s.state).toBe('listening');
    s = reduce(s, { type: 'TALK_CAPTURED' });
    expect(s.state).toBe('thinking');
    s = reduce(s, { type: 'SPEAK_START' });
    expect(s.state).toBe('speaking');
    s = reduce(s, { type: 'SPEAK_END' });
    expect(s.state).toBe('idle');
  });

  it('talking builds affection', () => {
    const before = snap({ state: 'speaking' });
    const after = reduce(before, { type: 'SPEAK_END' });
    expect(after.stats.affection).toBeGreaterThan(before.stats.affection);
  });

  it('a failed talk returns to baseline, not a stuck state', () => {
    const s = reduce(snap({ state: 'listening' }), { type: 'TALK_FAILED' });
    expect(s.state).toBe('idle');
  });
});

describe('virtual pet interactions', () => {
  it('FEED reduces hunger and enters eating', () => {
    const before = snap();
    const after = reduce(before, { type: 'FEED' });
    expect(after.state).toBe('eating');
    expect(after.stats.hunger).toBeLessThan(before.stats.hunger);
  });

  it('FEED while already eating is a no-op (no spam feeding)', () => {
    const eating = reduce(snap(), { type: 'FEED' });
    expect(reduce(eating, { type: 'FEED' })).toBe(eating);
  });

  it('PLAY costs energy, lifts mood', () => {
    const before = snap();
    const after = reduce(before, { type: 'PLAY' });
    expect(after.state).toBe('playing');
    expect(after.stats.energy).toBeLessThan(before.stats.energy);
    expect(after.stats.mood).toBeGreaterThan(before.stats.mood);
  });

  it('an exhausted Barkly refuses to play', () => {
    const tired = snap({ stats: { ...DEFAULT_STATS, energy: 5 } });
    const after = reduce(tired, { type: 'PLAY' });
    expect(after.state).toBe('sleepy');
  });

  it('SLEEP_TOGGLE naps and waking restores energy', () => {
    const napping = reduce(snap(), { type: 'SLEEP_TOGGLE' });
    expect(napping.state).toBe('sleepy');
    const awake = reduce(napping, { type: 'SLEEP_TOGGLE' });
    expect(awake.stats.energy).toBeGreaterThan(napping.stats.energy);
  });
});

describe('stat decay and baseline', () => {
  it('hours away make him hungrier and grumpier', () => {
    const decayed = decayStats(DEFAULT_STATS, 10 * 3_600_000);
    expect(decayed.hunger).toBeGreaterThan(DEFAULT_STATS.hunger);
    expect(decayed.mood).toBeLessThan(DEFAULT_STATS.mood);
  });

  it('decay is capped — a month away does not zero him out', () => {
    const decayed = decayStats(DEFAULT_STATS, 30 * 24 * 3_600_000);
    expect(decayed.mood).toBeGreaterThan(0);
    expect(decayed.hunger).toBeLessThanOrEqual(100);
  });

  it('needs override idle baseline', () => {
    expect(baselineState({ ...DEFAULT_STATS, energy: 10 })).toBe('sleepy');
    expect(baselineState({ ...DEFAULT_STATS, hunger: 90 })).toBe('hungry');
    expect(baselineState(DEFAULT_STATS)).toBe('idle');
  });

  it('TICK applies elapsed time and re-derives posture', () => {
    const s = snap({ updatedAt: 0 });
    const after = reduce(s, { type: 'TICK', now: 20 * 3_600_000 });
    expect(after.stats.hunger).toBeGreaterThan(s.stats.hunger);
    expect(after.updatedAt).toBe(20 * 3_600_000);
  });
});

describe('transient beats', () => {
  it('REACTION then SETTLE returns to baseline', () => {
    let s = reduce(snap(), { type: 'REACTION', state: 'excited' });
    expect(s.state).toBe('excited');
    expect(settleDelayMs('excited')).toBeGreaterThan(0);
    s = reduce(s, { type: 'SETTLE' });
    expect(s.state).toBe('idle');
  });

  it('SETTLE never interrupts a conversation state', () => {
    const s = reduce(snap({ state: 'thinking' }), { type: 'SETTLE' });
    expect(s.state).toBe('thinking');
  });
});

describe('petting', () => {
  it('petting a happy dog builds affection', () => {
    const before = snap();
    const after = reduce(before, { type: 'PET' });
    expect(after.state).toBe('happy');
    expect(after.stats.affection).toBeGreaterThan(before.stats.affection);
  });

  it('petting a sleeping dog annoys him (but he secretly likes it)', () => {
    const before = snap({ state: 'sleepy' });
    const after = reduce(before, { type: 'PET' });
    expect(after.state).toBe('annoyed');
    expect(after.stats.affection).toBeGreaterThan(before.stats.affection);
  });

  it('petting never interrupts a conversation beat', () => {
    for (const state of ['listening', 'thinking', 'speaking'] as const) {
      expect(reduce(snap({ state }), { type: 'PET' }).state).toBe(state);
    }
  });
});

describe('feed refusal', () => {
  it('a full dog refuses food with attitude', () => {
    const full = snap({ stats: { ...DEFAULT_STATS, hunger: 5 } });
    const after = reduce(full, { type: 'FEED' });
    expect(after.state).toBe('annoyed');
    expect(after.stats.hunger).toBe(5);
  });
});

describe('meeting other dogs', () => {
  it('a friend visit lifts mood and bond', () => {
    const before = snap();
    const after = reduce(before, { type: 'SOCIAL', friendly: true });
    expect(after.state).toBe('happy');
    expect(after.stats.mood).toBeGreaterThan(before.stats.mood);
    expect(after.stats.affection).toBeGreaterThan(before.stats.affection);
  });

  it('a rival encounter annoys him', () => {
    const before = snap();
    const after = reduce(before, { type: 'SOCIAL', friendly: false });
    expect(after.state).toBe('annoyed');
    expect(after.stats.mood).toBeLessThan(before.stats.mood);
  });

  it('never interrupts a conversation beat', () => {
    for (const state of ['listening', 'thinking', 'speaking'] as const) {
      expect(reduce(snap({ state }), { type: 'SOCIAL', friendly: true }).state).toBe(state);
    }
  });
});
```

## `barkly/app/__tests__/memory.test.ts`

```typescript
import { BarklyMemory, TURN_WINDOW } from '../src/barkly/memory';
import { createInMemoryStore } from '../src/storage/inMemoryStore';

const turn = (role: 'user' | 'barkly', text: string) => ({ role, text, at: 1 });

describe('BarklyMemory', () => {
  it('persists across instances (close/reopen the app)', async () => {
    const store = createInMemoryStore();
    const first = new BarklyMemory(store, 'default');
    await first.load();
    await first.addTurn(turn('user', 'hi Barkly'));
    await first.remember(["Your person's name is Caleb."], ['Caleb promised to play tomorrow.']);

    const second = new BarklyMemory(store, 'default');
    const state = await second.load();
    expect(state.turns).toHaveLength(1);
    expect(state.userFacts).toEqual(["Your person's name is Caleb."]);
    expect(state.barklyMemories).toEqual(['Caleb promised to play tomorrow.']);
  });

  it('folds overflowing turns into the session summary instead of growing forever', async () => {
    const mem = new BarklyMemory(createInMemoryStore(), 'default');
    await mem.load();
    for (let i = 0; i < TURN_WINDOW + 5; i++) {
      await mem.addTurn(turn('user', `message number ${i}`));
    }
    const state = mem.snapshot();
    expect(state.turns).toHaveLength(TURN_WINDOW);
    expect(state.sessionSummary).toContain('message number 0');
    expect(state.turns[0].text).toBe('message number 5');
  });

  it('dedupes facts case-insensitively', async () => {
    const mem = new BarklyMemory(createInMemoryStore(), 'default');
    await mem.load();
    await mem.remember(['Caleb has a sister.', 'caleb has a sister.'], []);
    await mem.remember(['Caleb has a sister.'], []);
    expect(mem.snapshot().userFacts).toHaveLength(1);
  });

  it('forgetAll wipes everything (privacy requirement)', async () => {
    const store = createInMemoryStore();
    const mem = new BarklyMemory(store, 'default');
    await mem.load();
    await mem.addTurn(turn('user', 'secret'));
    await mem.remember(['fact'], ['memory']);
    await mem.forgetAll();

    const reloaded = new BarklyMemory(store, 'default');
    const state = await reloaded.load();
    expect(state.turns).toHaveLength(0);
    expect(state.userFacts).toHaveLength(0);
    expect(state.barklyMemories).toHaveLength(0);
    expect(state.sessionSummary).toBe('');
  });

  it('survives a corrupt store without crashing', async () => {
    const store = createInMemoryStore();
    await store.set('barkly/profile/default/memory-v1', '{not json');
    const mem = new BarklyMemory(store, 'default');
    const state = await mem.load();
    expect(state.turns).toEqual([]);
  });
});
```

## `barkly/app/__tests__/prompts.test.ts`

```typescript
import { emptyMemory } from '../src/barkly/memory';
import { buildSystemPrompt, parseReply } from '../src/barkly/prompts';
import { freshSnapshot } from '../src/barkly/state';

describe('buildSystemPrompt', () => {
  it('includes identity, mood, and memories', () => {
    const prompt = buildSystemPrompt({
      snapshot: freshSnapshot(0),
      memory: {
        ...emptyMemory(),
        userFacts: ["Your person's name is Caleb."],
        barklyMemories: ['Caleb promised to play yesterday.'],
        sessionSummary: 'Person: talked about school',
      },
    });
    expect(prompt).toContain('You are Barkly');
    expect(prompt).toContain('appropriate for children');
    expect(prompt).toContain('Right now you are');
    expect(prompt).toContain("Your person's name is Caleb.");
    expect(prompt).toContain('Caleb promised to play yesterday.');
    expect(prompt).toContain('talked about school');
  });

  it('reflects hunger in the mood line', () => {
    const snapshot = freshSnapshot(0);
    snapshot.stats.hunger = 90;
    const prompt = buildSystemPrompt({ snapshot, memory: emptyMemory() });
    expect(prompt).toContain('hungry');
  });
});

describe('parseReply', () => {
  it('parses the full JSON contract', () => {
    const reply = parseReply(JSON.stringify({
      speech: 'You said we would play yesterday. I remember things, dude.',
      reaction: 'annoyed',
      actions: ['HEAD_TILT', 'LOOK_LEFT'],
      remember: { user_facts: ['Caleb has a soccer game Friday.'], barkly_memories: ['We joked about the mailman again.'] },
    }));
    expect(reply.speech).toContain('I remember things');
    expect(reply.reaction).toBe('annoyed');
    expect(reply.actions).toEqual(['HEAD_TILT', 'LOOK_LEFT']);
    expect(reply.newUserFacts).toHaveLength(1);
    expect(reply.newBarklyMemories).toHaveLength(1);
  });

  it('handles JSON wrapped in a markdown fence', () => {
    const reply = parseReply('```json\n{"speech": "Hey.", "actions": ["TAIL_WAG"]}\n```');
    expect(reply.speech).toBe('Hey.');
    expect(reply.actions).toEqual(['TAIL_WAG']);
  });

  it('falls back to treating plain prose as speech (never fails the turn)', () => {
    const reply = parseReply('Hey. I chewed a sock. No regrets.');
    expect(reply.speech).toBe('Hey. I chewed a sock. No regrets.');
    expect(reply.actions).toEqual([]);
  });

  it('drops invalid reactions and unknown actions', () => {
    const reply = parseReply(JSON.stringify({
      speech: 'ok',
      reaction: 'ROCKET_LAUNCH',
      actions: ['TAIL_WAG', 'BACKFLIP', 42],
    }));
    expect(reply.reaction).toBeUndefined();
    expect(reply.actions).toEqual(['TAIL_WAG']);
  });

  it('handles braces inside speech strings', () => {
    const reply = parseReply('{"speech": "I made a face like this: :} and it was great", "actions": []}');
    expect(reply.speech).toContain(':}');
  });
});
```

## `barkly/app/__tests__/dialogue.test.ts`

```typescript
import { DialogueEngine } from '../src/barkly/dialogue';
import { BarklyMemory } from '../src/barkly/memory';
import { freshSnapshot } from '../src/barkly/state';
import { createScriptedDialogue } from '../src/providers/dialogue/scripted';
import { DialogueProvider } from '../src/providers/types';
import { createInMemoryStore } from '../src/storage/inMemoryStore';

async function makeEngine(provider: DialogueProvider) {
  const memory = new BarklyMemory(createInMemoryStore(), 'default');
  await memory.load();
  return { engine: new DialogueEngine(provider, memory), memory };
}

describe('DialogueEngine', () => {
  it('runs a full round: reply parsed, turns recorded, memories merged', async () => {
    const { engine, memory } = await makeEngine(createScriptedDialogue());
    const reply = await engine.converse('Hi! My name is Caleb', freshSnapshot(0));
    expect(reply.speech.length).toBeGreaterThan(0);

    const state = memory.snapshot();
    expect(state.turns.map((t) => t.role)).toEqual(['user', 'barkly']);
    expect(state.userFacts.join(' ')).toContain('Caleb');
  });

  it('feeds prior facts back into the next prompt (Barkly remembers)', async () => {
    const seen: string[] = [];
    const spy: DialogueProvider = {
      name: 'spy',
      isAvailable: () => true,
      async complete(req) {
        seen.push(req.systemPrompt);
        return JSON.stringify({
          speech: 'Noted.',
          remember: { user_facts: ["Your person's name is Caleb."], barkly_memories: [] },
        });
      },
    };
    const { engine } = await makeEngine(spy);
    await engine.converse('my name is Caleb', freshSnapshot(0));
    await engine.converse('what is my name?', freshSnapshot(0));
    expect(seen[1]).toContain("Your person's name is Caleb.");
  });

  it('an empty transcript never reaches the provider', async () => {
    const provider: DialogueProvider = {
      name: 'never',
      isAvailable: () => true,
      complete: jest.fn(async () => 'nope'),
    };
    const { engine } = await makeEngine(provider);
    const reply = await engine.converse('   ', freshSnapshot(0));
    expect(reply.speech).toBe('');
    expect(provider.complete).not.toHaveBeenCalled();
  });

  it('scripted provider output always satisfies the reply contract', async () => {
    const { engine } = await makeEngine(createScriptedDialogue());
    for (const text of ['hello', 'want a treat?', 'we got a cat', 'random words here']) {
      const reply = await engine.converse(text, freshSnapshot(0));
      expect(reply.speech.length).toBeGreaterThan(0);
    }
  });
});
```

## `barkly/app/__tests__/world.test.ts`

```typescript
import { emptyMemory } from '../src/barkly/memory';
import { buildSystemPrompt } from '../src/barkly/prompts';
import { freshSnapshot } from '../src/barkly/state';
import { LOCATIONS, LOCATION_ORDER } from '../src/world/locations';
import { NPCS } from '../src/world/npcs';

describe('world data', () => {
  it('every location NPC exists and every NPC has paired line pools', () => {
    for (const loc of LOCATION_ORDER) {
      for (const id of LOCATIONS[loc].npcIds) {
        const npc = NPCS[id];
        expect(npc).toBeDefined();
        expect(npc.lines.length).toBe(npc.barklyLines.length);
        expect(npc.memories.length).toBeGreaterThan(0);
      }
    }
  });

  it('the prompt tells Barkly where he is and who is around', () => {
    const prompt = buildSystemPrompt({
      snapshot: freshSnapshot(0),
      memory: emptyMemory(),
      world: {
        locationDescription: LOCATIONS.park.description,
        npcs: [{ name: 'Duke', relationship: 'rival', personality: NPCS.duke.personality }],
      },
    });
    expect(prompt).toContain('dog park');
    expect(prompt).toContain('Duke');
    expect(prompt).toContain('rival');
  });
});
```

## `barkly/app/__tests__/stash.test.ts`

```typescript
import { reduce, freshSnapshot } from '../src/barkly/state';
import { Stash, TREASURES } from '../src/world/stash';
import { pickThought } from '../src/world/thoughts';
import { createInMemoryStore } from '../src/storage/inMemoryStore';

describe('the stash', () => {
  it('digging adds a treasure and persists across reloads', async () => {
    const store = createInMemoryStore();
    const stash = new Stash(store, 'default');
    await stash.load();
    const found = await stash.dig();
    expect(TREASURES.some((t) => t.id === found.id)).toBe(true);

    const reloaded = new Stash(store, 'default');
    const items = await reloaded.load();
    expect(items.map((t) => t.id)).toContain(found.id);
  });

  it('prefers treasures he does not own yet', async () => {
    const stash = new Stash(createInMemoryStore(), 'default');
    await stash.load();
    const seen = new Set<string>();
    for (let i = 0; i < TREASURES.length; i++) {
      seen.add((await stash.dig()).id);
    }
    expect(seen.size).toBe(TREASURES.length);
  });

  it('clear() wipes it (privacy rule)', async () => {
    const store = createInMemoryStore();
    const stash = new Stash(store, 'default');
    await stash.load();
    await stash.dig();
    await stash.clear();
    const reloaded = new Stash(store, 'default');
    expect(await reloaded.load()).toHaveLength(0);
  });

  it('TREASURE makes him excited and lifts mood', () => {
    const before = freshSnapshot(0);
    const after = reduce(before, { type: 'TREASURE' });
    expect(after.state).toBe('excited');
    expect(after.stats.mood).toBeGreaterThan(before.stats.mood);
  });
});

describe('idle thoughts', () => {
  it('are location-aware and never empty', () => {
    for (const loc of ['home', 'park', 'town'] as const) {
      for (let seed = 0; seed < 20; seed++) {
        expect(pickThought(loc, 12, seed).length).toBeGreaterThan(5);
      }
    }
  });
  it('night thoughts only appear at night-adjacent seeds', () => {
    const dayPool = new Set(Array.from({ length: 60 }, (_, s) => pickThought('home', 12, s)));
    expect([...dayPool].some((t) => t.includes('moon'))).toBe(false);
  });
});
```

## `barkly/app/__tests__/greetings.test.ts`

```typescript
import { nameFromFacts, welcomeBack } from '../src/barkly/greetings';

describe('welcome-back greetings', () => {
  it('uses the name when Barkly knows it', () => {
    expect(welcomeBack('Caleb', 7)).toContain('Caleb');
  });
  it('works without a name', () => {
    expect(welcomeBack(undefined, 7).length).toBeGreaterThan(10);
  });
  it('extracts the name from stored facts', () => {
    expect(nameFromFacts(["Your person's name is Caleb."])).toBe('Caleb');
    expect(nameFromFacts(['Has a soccer game Friday.'])).toBeUndefined();
  });
});
```

---

## Character canon: `barkly/docs/CHARACTER.md`

# Barkly — Locked Character Design (CANON)

**Status: LOCKED.** The approved concept sheet ("Barkley – Concept 3") is the
visual source of truth and is committed at
**`app/assets/barkly/concept/barkly-concept.png`**. Do not redesign Barkly.
This document restates the sheet in words so any session can verify work
against canon without the image open. If this text and the sheet ever
disagree, the sheet wins.

> Note on spelling: the concept sheet is titled "Barkley"; the product and
> code use the operator's spelling **Barkly**. Same dog.

## From the sheet

Barkly is a **terrier-beagle mix with a mischievous deadpan streak and a nose
for trouble** — rendered as a collectible vinyl/clay toy: soft surfaces, no
outlines, bold silhouette, satisfying to hold.

Trait list (verbatim from the sheet):

- rectangular head
- long nose with rounded square tip
- stiff, bent ears that angle outward
- tiny snaggletooth
- thick collar
- striped knit-sock markings on front paws
- ring-shaped tail curl
- low-slung body

Additional reads from the artwork:

- **the head dominates** — it is wider than the body and roughly half the
  character's height
- cream **blaze** runs down the center of the face into a long, broad cream
  muzzle; mustard patches around the eyes and head sides
- **huge charcoal-brown rounded-square nose** sitting on the muzzle
- **smug half-lidded eyes**: solid dark pills with heavy flat upper lids
  tilted slightly down-outward
- thick dark-brown **belt-style collar with a brass buckle**, strap end, and
  a round brass **B** tag on a ring
- cream chest/belly; front legs in cream "knit socks" with **three** charcoal
  stripes; feet with toe grooves
- standing on four short, stout legs (front view is the app's default)

## Color palette (from the sheet)

| Name | Use | Approx |
|---|---|---|
| Mustard tan | body, head, ears (deeper) | `#C6952F` / ears `#AF7F22` |
| Cream | blaze, muzzle, chest, socks, feet | `#F1E6CB` |
| Charcoal | nose, sock stripes, eyes | `#3E332A` / `#35302A` |
| Collar brown | collar | `#4B3527` |
| Brass | buckle, tag | `#B98F3E` |

## What Barkly must NEVER become

- a Disney/Pixar puppy
- a generic golden retriever
- a giant-eyed cute puppy
- a hyper-realistic dog
- a fluffy AI-generated mascot
- Paw Patrol
- Talking Tom with dog ears
- a generic children's cartoon character

His asymmetry, deadpan expression, rectangular head, snaggletooth and strange
proportions are **features**, not flaws to be polished away.

## Physical manufacturability constraint

Barkly will be a real electronic toy. The sheet's footer says it plainly:
collectible toy character, bold silhouette, solid + sturdy feel, made to stand
out on any shelf. Favor forms that translate to molded plastic, soft-touch
vinyl, plush components, a moving jaw and head, moving ears, moving
eyes/eyelids, an internal speaker, microphones, sensors, and servos. No
digital-only characteristics without a good reason.

## Personality (also canon)

Barkly is NOT a generic endlessly-positive children's assistant. He is a dog
with a personality: mischievous, curious, loyal, confident, stubborn, playful,
slightly sarcastic, occasionally lazy, easily distracted by dog things,
genuinely attached to his person.

He sometimes: misunderstands things in funny ways, gets distracted, remembers
running jokes, brings up previous conversations, begs, refuses something
harmless because he doesn't feel like it, gets excited about ridiculous
things, makes observations, develops preferences, teases the user gently,
acts jealous of another pet, remembers names/promises/favorite things, and
reacts differently depending on mood.

Boundaries: always appropriate for children. No constant dog puns. No barking
between every sentence. He sounds like Barkly, not an AI assistant.

The runtime encoding of this personality lives in
`app/src/barkly/personality.ts` and `app/src/barkly/prompts.ts` — those files
implement this document; when in doubt, this document (and the sheet) win.

---

## Architecture: `barkly/docs/ARCHITECTURE.md`

# Barkly — System Architecture

The MVP is an Expo (React Native + TypeScript) app in `../app`. Everything is
organized around one strategic split:

```
BARKLY'S BRAIN                          BARKLY'S BODY
(platform-agnostic TypeScript)           (today: screen; later: motors)

conversation ─ memory ─ personality      screen animation (mobile app)
emotion ─ decision making        ──────▶ physical servos/speaker (toy)
              emits BodyAction[]
```

The brain never imports React Native. It emits high-level `BodyAction`s
(`TAIL_WAG`, `HEAD_TILT`, `EAR_PERK`, `BLINK`, `MOUTH_MOVE`, `LOOK_LEFT`,
`LOOK_RIGHT`, `SIT`, `EXCITED`, `SLEEP`) and state changes. The mobile app
translates those into animation; a physical Barkly translates the exact same
commands into motors. This abstraction is deliberate and load-bearing — do not
let UI code reach into the brain, or personality leak into components.

## Layer map

```
Mobile UI                 app/src/ui/*             screens, controls
  ↓
Barkly Interaction Layer app/src/hooks/useBarkly.ts   glue: owns engine + state
  ↓
Speech-to-Text            app/src/providers/stt/*  SpeechToTextProvider
  ↓
Barkly AI / Dialogue     app/src/barkly/dialogue.ts + providers/dialogue/*
  ↓
Memory                    app/src/barkly/memory.ts + storage/*
  ↓
Text-to-Speech            app/src/providers/tts/*  TextToSpeechProvider
  ↓
Animation / Emotion       app/src/barkly/state.ts + src/animation/* + ui/BarklyView.tsx
```

## Provider adapters (no hardwiring to one vendor)

Interfaces in `app/src/providers/types.ts`:

- `SpeechToTextProvider` — implemented by `expoSpeechRecognitionStt` (on-device,
  no API key, requires a dev build). When unavailable (Expo Go), the UI falls
  back to typed input so the full loop is still exercisable.
- `DialogueProvider` — implemented by `anthropicDialogue` (official
  `@anthropic-ai/sdk`) and `scriptedDialogue` (offline, in-character,
  zero-credential fallback so the app always runs).
- `TextToSpeechProvider` — implemented by `expoSpeechTts` (on-device, free,
  works everywhere) and an `elevenLabsTts` stub for a real recorded-quality
  Barkly voice later.

`app/src/providers/registry.ts` selects providers from environment/config.
Swapping a vendor = writing one adapter + one registry line.

### Secrets

Production secrets never ship in the mobile binary. The Anthropic adapter's
direct-from-device mode is **development only** (`EXPO_PUBLIC_*` env vars are
bundled into the app and are not secret). For production the adapter's
`baseURL` points at **`../server`** — a zero-dependency Node proxy that holds
the real key, forwards only `POST /v1/messages`, and rate-limits per IP (its
README has run/deploy instructions). `.env.example` documents every variable.

## The Barkly state machine

`app/src/barkly/state.ts`. One reducer-style controller, no scattered booleans.

States: `idle · listening · thinking · speaking · happy · excited · annoyed ·
sleepy · hungry · playing · eating`.

Internal stats (0–100): `mood, energy, hunger, affection, curiosity`. They decay
slowly with wall-clock time (computed on load — no background timers), move with
interactions (feed/play/sleep/talk), and feed the prompt so Barkly's behavior
varies naturally. Deliberately not a full Tamagotchi simulation.

## Memory (three tiers)

`app/src/barkly/memory.ts`, persisted through the `KeyValueStore` abstraction
(`app/src/storage/`) — AsyncStorage today, a synced backend later without
touching memory logic.

1. **Session memory** — the current conversation, capped; older turns roll into
   a running summary rather than growing the prompt forever.
2. **User facts** — name, siblings, pets, favorites, hobbies, important people.
3. **Barkly memories** — experiences Barkly believes he shared with the user
   ("Caleb promised we'd play again tomorrow"), so he can call you out on them.

Extraction: the dialogue model returns structured JSON (speech + actions +
memory candidates) which the engine validates and merges. All memory is
deletable from Settings.

## Animation / asset swap path

`ui/BarklyView.tsx` is a **placeholder renderer**: Barkly drawn from plain RN
`View`s + the `Animated` API, following the locked design's blocky geometry.
It renders from exactly two inputs — `BarklyState` + active `BodyAction`s —
via the `BarklyRenderer` contract in `app/src/animation/renderer.ts`. Replacing
it with production art means implementing that same contract with:

- **Rive (recommended)** — state-machine-native, tiny runtime, inputs map 1:1
  onto `BarklyState`/`BodyAction`, strong Expo support. Best MVP-to-production
  path for a 2D toy-like character.
- Live2D / Spine / sprite sheets / 3D — all viable behind the same contract.

The conversation system never knows which renderer is mounted.

## Child safety / privacy posture (MVP)

- Microphone is captured **only** while the user explicitly holds TALK; STT is
  on-device; raw audio is never stored or uploaded by this app.
- Only derived text goes to the dialogue provider. Raw audio and derived
  text/memory are architecturally separate.
- No advertising, no trackers, no analytics SDKs, no behavioral profiling.
- All memory is user-deletable (Settings → "Forget everything").
- Storage is namespaced per profile (`barkly/profile/<id>/…`) so parental
  controls and per-child data handling can be added without a data migration.
- **This is engineering posture, not legal compliance.** Dedicated
  legal/compliance work (COPPA etc.) is required before any child-directed
  public release.
