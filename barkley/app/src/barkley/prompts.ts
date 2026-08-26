/**
 * Prompt assembly for Barkley's dialogue model, and parsing of its replies.
 *
 * The model never receives the whole conversation history forever: it gets the
 * rolling session summary + the recent turn window (see memory.ts).
 *
 * Reply contract: the model answers with a single JSON object —
 *   { "speech": string,               what Barkley says aloud
 *     "reaction": BarkleyState?,      optional emotional beat after speaking
 *     "actions": BodyAction[]?,       body commands while speaking
 *     "remember": { "user_facts": string[], "barkley_memories": string[] }? }
 * Parsing is defensive: if the model returns plain prose we treat all of it as
 * speech rather than failing the turn.
 */

import { IDENTITY, RULES, TRAITS, VOICE } from './personality';
import { describeStats } from './state';
import { MemoryState } from './memory';
import {
  ALL_BODY_ACTIONS,
  ALL_STATES,
  BarkleyReply,
  BarkleySnapshot,
  BodyAction,
  BarkleyState,
} from './types';

export interface PromptContext {
  snapshot: BarkleySnapshot;
  memory: MemoryState;
}

const REPLY_CONTRACT = `Respond with ONLY a JSON object, no markdown fence, shaped like:
{"speech": "what you say out loud (1-3 short sentences)",
 "reaction": "optional one of: ${ALL_STATES.join(', ')}",
 "actions": ["optional, from: ${ALL_BODY_ACTIONS.join(', ')}"],
 "remember": {"user_facts": ["new durable facts your person just told you, if any"],
              "barkley_memories": ["new shared experiences or promises worth remembering, if any"]}}
Only record genuinely durable things in "remember" (names, pets, favorites,
promises, big events) — not small talk. Empty arrays are fine.`;

/** Stable part first (better for prompt caching later); volatile context after. */
export function buildSystemPrompt(ctx: PromptContext): string {
  const { snapshot, memory } = ctx;
  const sections: string[] = [IDENTITY, TRAITS, RULES, VOICE, REPLY_CONTRACT];

  sections.push(`Right now you are ${describeStats(snapshot.stats)}. Your current pose/state is "${snapshot.state}".`);

  if (memory.userFacts.length > 0) {
    sections.push(`Things you know about your person:\n- ${memory.userFacts.join('\n- ')}`);
  }
  if (memory.barkleyMemories.length > 0) {
    sections.push(`Things you remember doing or promising together:\n- ${memory.barkleyMemories.join('\n- ')}`);
  }
  if (memory.sessionSummary) {
    sections.push(`Earlier in this conversation (summary):\n${memory.sessionSummary}`);
  }
  return sections.join('\n\n');
}

const STATE_SET = new Set<string>(ALL_STATES);
const ACTION_SET = new Set<string>(ALL_BODY_ACTIONS);

/** Parse a model reply into a BarkleyReply. Never throws. */
export function parseReply(raw: string): BarkleyReply {
  const fallback: BarkleyReply = {
    speech: raw.trim(),
    actions: [],
    newUserFacts: [],
    newBarkleyMemories: [],
  };

  const jsonText = extractJsonObject(raw);
  if (!jsonText) return fallback;

  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const speech = typeof parsed.speech === 'string' ? parsed.speech.trim() : '';
    if (!speech) return fallback;

    const reaction =
      typeof parsed.reaction === 'string' && STATE_SET.has(parsed.reaction)
        ? (parsed.reaction as BarkleyState)
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
      newBarkleyMemories: strings(remember.barkley_memories),
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
