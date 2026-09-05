/**
 * Story Engine v2 — persistent, branching, resolvable sagas.
 *
 * story.ts discovers the story implicit in current history. This layer gives
 * that story time: chapters, decisions, consequences and an archive. A saga
 * therefore cannot reset to Chapter I just because the UI closed, and a player
 * choice can permanently change what kind of story it became.
 *
 * This module is deliberately storage-agnostic. Persist StoryState beside the
 * character save; the pure transitions make migration and long-run simulation
 * straightforward.
 */

import { CharacterState } from './character';
import { MemoryState } from './memory';
import { deriveStoryArc, StoryArc } from './story';

export type StoryRoute = 'unresolved' | 'escalated' | 'reconciled' | 'protected' | 'shared' | 'private' | 'public' | 'curated';
export type StoryStatus = 'active' | 'resolved';

export interface StoryDecision {
  id: string;
  label: string;
  route: StoryRoute;
  consequence: string;
  barklyLine: string;
  resolves?: boolean;
}

export interface StoryChapter {
  number: number;
  title: string;
  happenedAt: number;
  decisionId?: string;
  consequence?: string;
}

export interface PersistentStory {
  id: string;
  title: string;
  premise: string;
  cast: string[];
  status: StoryStatus;
  route: StoryRoute;
  intensity: StoryArc['intensity'];
  startedAt: number;
  updatedAt: number;
  chapters: StoryChapter[];
  choices: StoryDecision[];
  nextHook: string;
  resolvedAt?: number;
}

export interface StoryState {
  version: 2;
  active?: PersistentStory;
  archive: PersistentStory[];
}

export function freshStoryState(): StoryState {
  return { version: 2, archive: [] };
}

function decisionsFor(arc: StoryArc): StoryDecision[] {
  if (arc.id.startsWith('treasure-rival-')) {
    return [
      { id: 'guard-it', label: 'Guard the treasure', route: 'protected', consequence: 'Barkly chose possession over peace. The rival now knows this object matters.', barklyLine: 'Correct. We defend our artifacts.' },
      { id: 'let-them-see', label: 'Let the rival see it', route: 'shared', consequence: 'Barkly allowed a rival near something he loves. The feud has a crack in it now.', barklyLine: 'They may LOOK. Looking is not owning.' },
      { id: 'end-the-beef', label: 'Try to end the beef', route: 'reconciled', consequence: 'You pushed Barkly toward an actual truce instead of another incident.', barklyLine: 'I am not forgiving. I am... suspending hostilities.', resolves: true },
    ];
  }
  if (arc.id.startsWith('park-politics-')) {
    return [
      { id: 'pick-side', label: 'Pick a side', route: 'escalated', consequence: 'The park factions became explicit. Barkly has stopped pretending everybody gets along.', barklyLine: 'Finally. A clear organizational chart.' },
      { id: 'mediate', label: 'Force a peace summit', route: 'reconciled', consequence: 'Barkly attempted diplomacy. Nobody enjoyed it, which is how you know it was diplomacy.', barklyLine: 'This meeting could have been an email.', resolves: true },
      { id: 'stay-out', label: 'Stay out of it', route: 'unresolved', consequence: 'You refused to pick a faction. The politics continue without official endorsement.', barklyLine: 'Neutrality. Suspicious, but efficient.' },
    ];
  }
  if (arc.id.startsWith('ritual-spreads-')) {
    return [
      { id: 'keep-private', label: 'Keep it private', route: 'private', consequence: 'The routine remains a private language between Barkly and his person.', barklyLine: 'Good. Classified again.', resolves: true },
      { id: 'make-signature', label: 'Make it his signature', route: 'public', consequence: 'A private ritual became Barkly’s public reputation.', barklyLine: 'Fine. If they know it, I am going to be famous for it.', resolves: true },
    ];
  }
  if (arc.id === 'questionable-museum') {
    return [
      { id: 'curate', label: 'Build the collection', route: 'curated', consequence: 'Random finds became a deliberate collection with a crown jewel.', barklyLine: 'Exactly. Museum rules now.', resolves: true },
      { id: 'keep-digging', label: 'Never stop digging', route: 'escalated', consequence: 'Barkly rejected curation in favor of volume. The collection problem is now everybody’s problem.', barklyLine: 'Shelves are cheaper than restraint.' },
    ];
  }
  return [
    { id: 'continue', label: 'See what happens', route: 'unresolved', consequence: 'The story remains open.', barklyLine: 'Good. I was not done anyway.' },
  ];
}

function startStory(arc: StoryArc, now: number): PersistentStory {
  return {
    id: arc.id,
    title: arc.title,
    premise: arc.premise,
    cast: [...arc.cast],
    status: 'active',
    route: 'unresolved',
    intensity: arc.intensity,
    startedAt: now,
    updatedAt: now,
    chapters: [{ number: 1, title: arc.chapter, happenedAt: now }],
    choices: decisionsFor(arc),
    nextHook: arc.nextHook,
  };
}

/**
 * Reconcile the persistent ledger with the story currently implied by history.
 * A resolved saga stays resolved. A different earned saga may begin later.
 */
export function syncStoryState(
  state: StoryState,
  input: { character?: CharacterState; memory: MemoryState; now: number },
): StoryState {
  const arc = deriveStoryArc({ character: input.character, memory: input.memory });
  if (!arc) return state;

  if (state.active?.id === arc.id) {
    // History may intensify while the same saga is alive. Preserve decisions
    // and chapter history; only refresh the live pressure/hook.
    if (arc.intensity === state.active.intensity && arc.nextHook === state.active.nextHook) return state;
    return {
      ...state,
      active: { ...state.active, intensity: arc.intensity, nextHook: arc.nextHook, updatedAt: input.now },
    };
  }

  // Do not instantly resurrect the exact saga the player just resolved.
  if (state.archive.some((story) => story.id === arc.id)) return state;
  if (state.active) return state;
  return { ...state, active: startStory(arc, input.now) };
}

export interface StoryAdvanceResult {
  state: StoryState;
  story: PersistentStory;
  decision: StoryDecision;
}

export function advanceStory(state: StoryState, decisionId: string, now: number): StoryAdvanceResult | null {
  const current = state.active;
  if (!current || current.status !== 'active') return null;
  const decision = current.choices.find((choice) => choice.id === decisionId);
  if (!decision) return null;

  /*
   * Later chapters are titled by WHAT THE PLAYER DID, not by a number.
   *
   * Numbering them fought the opening chapter, whose title is authored by the
   * arc and carries its own heading -- so a two-chapter saga rendered as
   * "Chapter II . Bad Vibes Around the Treasure" followed by "Chapter 2",
   * two things both calling themselves the second chapter, one written and one
   * counted. The decision label is the truer name for these anyway: a chapter
   * of this story IS the choice that was made in it.
   */
  const chapter: StoryChapter = {
    number: current.chapters.length + 1,
    title: decision.resolves ? `Finale \u00b7 ${decision.label}` : decision.label,
    happenedAt: now,
    decisionId: decision.id,
    consequence: decision.consequence,
  };
  const next: PersistentStory = {
    ...current,
    route: decision.route,
    updatedAt: now,
    chapters: [...current.chapters, chapter],
    // A non-final choice can be revisited later, but the exact same decision
    // should not be offered twice in a row like a dialogue vending machine.
    choices: decision.resolves ? [] : current.choices.filter((choice) => choice.id !== decision.id),
    status: decision.resolves ? 'resolved' : 'active',
    resolvedAt: decision.resolves ? now : undefined,
    nextHook: decision.resolves
      ? `This is history now. Barkly can remember that you chose “${decision.label}.”`
      : `The next beat must honor this route: ${decision.route}.`,
  };

  const nextState: StoryState = decision.resolves
    ? { ...state, active: undefined, archive: [next, ...state.archive].slice(0, 12) }
    : { ...state, active: next };
  return { state: nextState, story: next, decision };
}

export function storyPromptTexture(state: StoryState): string[] {
  const lines: string[] = [];
  if (state.active) {
    const s = state.active;
    lines.push(`Active saga: ${s.title}. Route: ${s.route}. ${s.premise}`);
    const last = s.chapters[s.chapters.length - 1];
    if (last?.consequence) lines.push(`Last chapter consequence: ${last.consequence}`);
    lines.push(`Next story pressure: ${s.nextHook}`);
  }
  const recent = state.archive[0];
  if (recent) {
    const finale = recent.chapters[recent.chapters.length - 1];
    // The consequence is a full sentence and ends in a stop of its own, so it
    // is trimmed before this line adds one: "another incident.. You may" is
    // the kind of seam that makes a prompt read as generated.
    const ending = finale?.consequence?.replace(/\s*[.!?]+\s*$/, '');
    lines.push(`Resolved history: ${recent.title} ended on route ${recent.route}${ending ? ` — ${ending}` : ''}. You may remember it; do not restart it.`);
  }
  return lines;
}
