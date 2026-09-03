/**
 * Barkly's Plan — a tiny personalized adventure board.
 *
 * This is retention without streak anxiety. Once per calendar day Barkly has
 * three things he wants to do. The goals are drawn from THIS Barkly's history:
 * rivalries, friends, taught routines, treasure habits and unlocked places.
 * Missing a day costs nothing. Completing a plan simply creates a satisfying
 * session arc and a reason to touch the systems that make Barkly distinctive.
 */

import { CharacterState } from '../barkly/character';
import { MemoryState } from '../barkly/memory';
import { deriveStoryArc } from '../barkly/story';
import { levelFor } from './progression';

export type AdventureEventKind = 'talk' | 'dig' | 'npc' | 'travel' | 'play' | 'feed' | 'routine';

export interface AdventureEvent {
  kind: AdventureEventKind;
  target?: string;
}

export interface AdventureGoal {
  id: string;
  kind: AdventureEventKind;
  label: string;
  detail: string;
  target?: string;
  done: boolean;
  /** Skips the daily rotation. Only the first-meeting on-ramp uses this. */
  pinned?: boolean;
}

export interface AdventureState {
  day: string;
  title: string;
  subtitle: string;
  goals: AdventureGoal[];
  completedAt?: number;
  rewarded: boolean;
}

export interface AdventureInput {
  character: CharacterState;
  memory: MemoryState;
  xp: number;
  now: number;
}

export const PLAN_REWARD = { coins: 24, xp: 32 };

const two = (n: number) => String(n).padStart(2, '0');

/**
 * A PLAN DAY is the player's local calendar day, not UTC.
 *
 * `toISOString().slice(0, 10)` silently rolls the plan at UTC midnight. In the
 * US that means a fresh "today" can appear in the evening, which is exactly
 * the sort of tiny software smell that makes a virtual pet feel like a task
 * app. The device already knows what day the player thinks it is, so use it.
 */
export function adventureDay(now: number): string {
  const date = new Date(now);
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function topBond(character: CharacterState, kind: 'friend' | 'rival') {
  return Object.entries(character.socialBonds ?? {})
    .filter(([, bond]) => bond.kind === kind && bond.encounters > 0)
    .sort((a, b) => b[1].encounters - a[1].encounters)[0];
}

function bestRoutine(memory: MemoryState) {
  return [...memory.trainingRules]
    .sort((a, b) => b.timesTriggered - a.timesTriggered || b.updatedAt - a.updatedAt)[0];
}

function candidates(input: AdventureInput): AdventureGoal[] {
  const rival = topBond(input.character, 'rival');
  const friend = topBond(input.character, 'friend');
  const routine = bestRoutine(input.memory);
  const level = levelFor(input.xp);
  const rows: AdventureGoal[] = [];

  /*
   * THE FIRST MEETING IS THE ON-RAMP, AND IT HAS TO BE PINNED.
   *
   * Every NPC goal below hangs off `topBond`, which filters `encounters > 0`
   * -- so a player who has never met a dog was offered no reason to go and
   * meet one. Their whole plan was "tell him something / cause zoomies /
   * handle the food situation", none of which leave the room. Barkly holding
   * a grudge for days is a third of the pitch, and nothing pointed at it: you
   * had to wander into the park on your own and tap a dog twice.
   *
   * So while there are NO bonds at all, meeting Duke is the plan's first item
   * -- pinned rather than left to the daily rotation, because a goal that
   * carries a product pillar cannot appear three days out of four. It
   * disappears the moment any bond exists, which is the same day it stops
   * being an on-ramp.
   */
  const met = Object.values(input.character.socialBonds ?? {}).some((b) => b.encounters > 0);
  if (!met) {
    rows.push({
      id: 'first-dog',
      kind: 'npc',
      target: 'duke',
      label: 'Go and meet Duke',
      detail: 'He is at the park. Barkly has opinions about him already, somehow.',
      done: false,
      pinned: true,
    });
  }

  if (rival) {
    rows.push({
      id: `rival-${rival[0].toLowerCase()}`,
      kind: 'npc',
      target: rival[0].toLowerCase(),
      label: `Go see ${rival[0]}`,
      detail: rival[1].encounters >= 6 ? 'The nemesis situation is not going to resolve itself.' : 'There is unfinished business here.',
      done: false,
    });
  }

  if (routine) {
    rows.push({
      id: `routine-${routine.id}`,
      kind: 'routine',
      target: routine.normalizedCue,
      label: `Use “${routine.cue}”`,
      detail: routine.timesTriggered >= 6 ? 'A signature tradition requires maintenance.' : 'Barkly learned it. Make him prove it.',
      done: false,
    });
  }

  if (friend) {
    rows.push({
      id: `friend-${friend[0].toLowerCase()}`,
      kind: 'npc',
      target: friend[0].toLowerCase(),
      label: `Check in with ${friend[0]}`,
      detail: friend[1].encounters >= 6 ? 'Best friends have business.' : 'See what they are up to.',
      done: false,
    });
  }

  if (level >= 2) {
    rows.push({
      id: 'dig-suspicious',
      kind: 'dig',
      label: 'Dig up something suspicious',
      detail: input.character.favoriteTreasure ? 'The current crown jewel could always be dethroned.' : 'The stash has standards. Very low standards.',
      done: false,
    });
  }

  if (level >= 4) {
    rows.push({
      id: 'town-lap',
      kind: 'travel',
      target: 'town',
      label: 'Take a lap through town',
      detail: 'Pepper has opinions. The pigeons have worse ones.',
      done: false,
    });
  }

  rows.push(
    {
      id: 'real-conversation',
      kind: 'talk',
      label: 'Tell Barkly something',
      detail: 'One actual conversation. He is nosy and this is how lore starts.',
      done: false,
    },
    {
      id: 'cause-zoomies',
      kind: 'play',
      label: 'Cause one round of zoomies',
      detail: 'This is technically enrichment. Mostly it is chaos.',
      done: false,
    },
    {
      id: 'food-situation',
      kind: 'feed',
      label: 'Handle the food situation',
      detail: 'Only counts when feeding actually makes sense.',
      done: false,
    },
  );

  return rows;
}

/** Deterministically rotate the candidate list so consecutive days feel different. */
export function createAdventure(input: AdventureInput): AdventureState {
  const day = adventureDay(input.now);
  const rows = candidates(input);
  const offset = rows.length === 0 ? 0 : hash(day) % rows.length;
  // Pinned goals sit in front of the rotation rather than inside it.
  const pinned = rows.filter((r) => r.pinned);
  const rest = rows.filter((r) => !r.pinned);
  const spun = rest.length === 0 ? [] : [...rest.slice(offset % rest.length), ...rest.slice(0, offset % rest.length)];
  const rotated = [...pinned, ...spun];
  const picked: AdventureGoal[] = [];
  const kinds = new Set<string>();
  for (const row of rotated) {
    const uniqueness = row.kind === 'npc' ? `${row.kind}:${row.target}` : row.kind;
    if (kinds.has(uniqueness)) continue;
    picked.push(row);
    kinds.add(uniqueness);
    if (picked.length === 3) break;
  }

  const story = deriveStoryArc({ character: input.character, memory: input.memory });
  return {
    day,
    title: "Barkly's Extremely Serious Plan",
    subtitle: story ? `Current complication: ${story.title}.` : 'Three things. No streak. No consequences if we get distracted.',
    goals: picked,
    rewarded: false,
  };
}

function targetMatches(goal: AdventureGoal, event: AdventureEvent): boolean {
  if (!goal.target) return true;
  if (!event.target) return false;
  const wanted = goal.target.toLowerCase().trim();
  const actual = event.target.toLowerCase().trim();
  return actual === wanted || actual.includes(wanted) || wanted.includes(actual);
}

export function progressAdventure(
  state: AdventureState,
  event: AdventureEvent,
  now: number,
): { state: AdventureState; changed: boolean; justCompleted: boolean } {
  if (state.completedAt) return { state, changed: false, justCompleted: false };
  let changed = false;
  const goals = state.goals.map((goal) => {
    if (goal.done || goal.kind !== event.kind || !targetMatches(goal, event)) return goal;
    changed = true;
    return { ...goal, done: true };
  });
  if (!changed) return { state, changed: false, justCompleted: false };
  const complete = goals.length > 0 && goals.every((goal) => goal.done);
  return {
    state: { ...state, goals, completedAt: complete ? now : undefined },
    changed: true,
    justCompleted: complete,
  };
}

export function adventureProgress(state: AdventureState): { done: number; total: number } {
  return { done: state.goals.filter((goal) => goal.done).length, total: state.goals.length };
}
