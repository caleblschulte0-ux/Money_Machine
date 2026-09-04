/**
 * Recall — answering from the record instead of around it.
 *
 * The Pack Book said Barkly had a saga about a rock shaped like a duck; asking
 * him "do you remember the duck rock" got a generic deflection, because
 * nothing between the utterance and the reply ever LOOKED at the record. The
 * offline composer invented a story shape, and the ranked prompt window had
 * usually aged the saga out. This module is the missing look: given the full
 * fact/experience stores and the character record, it recognises when the
 * player is asking about something that actually happened and answers FROM the
 * stored experience — verbatim history, in his voice around it.
 *
 * Matching is by SUBJECT, not phrasing: "duck rock", "the rock", "what
 * happened with Duke", "remember the beach" all reach the record through
 * token overlap, not through a regex per question.
 *
 * It runs in the dialogue engine BEFORE any provider (the same slot as
 * trained cues) so a recorded memory can never be shadowed by a generic pool,
 * offline or on. Pure: no storage, no clock, seed in.
 */

import { bondFor, CharacterState, friendshipStage, rivalryStage } from './character';
import { Experience, Fact } from './facts';
import { BodyAction, ReactionState } from './types';

export interface RecallInput {
  text: string;
  /** The FULL stores, not the prompt-ranked slice — old sagas count most. */
  facts: Fact[];
  experiences: Experience[];
  character?: CharacterState;
  seed?: number;
}

export interface Recalled {
  speech: string;
  reaction?: ReactionState;
  actions: BodyAction[];
  /** Facts this answer leaned on, for memory.touch(). */
  factIds: string[];
}

const at = <T>(list: T[], seed: number): T => list[Math.abs(Math.trunc(seed)) % list.length];

/**
 * Words that can never identify a memory on their own. Deliberately includes
 * the words treasure names are built from ("a rock THAT LOOKS LIKE a duck").
 */
const STOP = new Set(
  (
    'the a an and or but that this those these there here what when where why how who did does ' +
    'do you your yours me my mine our ours we they them their he she him her his hers it its ' +
    'is are was were be been being have has had will would can could should shall may might ' +
    'remember recall forget forgot forgotten happened happen happens tell told telling about ' +
    'with without like likes looks look looked really very just still ever never always again ' +
    'thing things stuff time day today yesterday once story stories was whats'
  ).split(/\s+/),
);

function tokens(s: string): string[] {
  return [...new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9'\s-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOP.has(w)),
  )];
}

/** "was there a duck rock" → yes iff a distinctive token of the name appears. */
function mentions(utterTokens: string[], name: string): boolean {
  const distinctive = tokens(name);
  return distinctive.length > 0 && distinctive.some((t) => utterTokens.includes(t));
}

/**
 * A recall-shaped sentence. Kept loose on purpose: the gate is "are they
 * reaching for the past", and the subject match does the precise work.
 */
const RECALL_CUE =
  /\b(remember|recall|forgot|forget|happened|history|that time|the time|tell me about|story about|the story|what was|what's the deal with|whats the deal with)\b/i;

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Experiences that involve this dog, best first. */
function experiencesWith(list: Experience[], name: string): Experience[] {
  return list
    .filter(
      (e) =>
        e.withWhom?.some((w) => sameName(w, name)) ||
        new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(e.what),
    )
    .sort((a, b) => b.importance - a.importance || b.at - a.at);
}

function stageLine(character: CharacterState | undefined, name: string): string {
  const bond = character ? bondFor(character, name) : undefined;
  if (!bond || bond.encounters < 3) return '';
  const label = bond.kind === 'friend' ? friendshipStage(bond.encounters).label : rivalryStage(bond.encounters).label;
  const cap = name.charAt(0).toUpperCase() + name.slice(1);
  return bond.kind === 'friend' ? ` ${cap} is my ${label}. That's on the record too.` : ` ${cap} is my ${label}. Officially.`;
}

// ------------------------------------------------------------------ treasure

function treasureReply(input: RecallInput, utterTokens: string[]): Recalled | null {
  const treasure = input.character?.favoriteTreasure;
  if (!treasure || !mentions(utterTokens, treasure)) return null;
  const seed = input.seed ?? 0;

  // The saga around the object, told in its own recorded words.
  const tTokens = tokens(treasure);
  const saga = input.experiences
    .filter((e) => tTokens.some((t) => e.what.toLowerCase().includes(t)))
    .sort((a, b) => b.importance - a.importance || b.at - a.at);

  const grief =
    input.character?.grievance && tTokens.some((t) => input.character!.grievance!.what.toLowerCase().includes(t))
      ? ` And yes, ${input.character.grievance.who} ${input.character.grievance.what}. We are not past it.`
      : '';

  // Neutral enough for a question OR a passing mention: any talk of his
  // sacred object gets steered to the saga, which is exactly how obsession
  // behaves in the wild.
  const openers = [
    `That's ${treasure} you're talking about. The best thing I own.`,
    `Of course I remember. ${treasure.charAt(0).toUpperCase() + treasure.slice(1)}. Finest object in this house.`,
    `You're asking ME about ${treasure}? I think about it hourly.`,
  ];
  const recount = saga.length > 0 ? ` ${at(saga, seed / 3).what}` : ` Found it myself. It's priceless now.`;
  return {
    speech: at(openers, seed) + recount + grief,
    reaction: 'excited',
    actions: ['TAIL_WAG', 'EXCITED'],
    factIds: [],
  };
}

// ---------------------------------------------------------------- the record

function dogReply(input: RecallInput, utterTokens: string[]): Recalled | null {
  const seed = input.seed ?? 0;
  // Every name the record knows: bonded dogs, dogs in experiences, non-person
  // fact subjects. The record defines who is askable — not a hardcoded list.
  const names = new Set<string>();
  for (const who of Object.keys(input.character?.socialBonds ?? {})) names.add(who.toLowerCase());
  for (const e of input.experiences) for (const w of e.withWhom ?? []) names.add(w.toLowerCase());
  for (const f of input.facts) {
    if (f.subject !== 'person' && f.subject !== 'barkly') names.add(f.subject.toLowerCase());
  }

  const name = [...names].find((n) => utterTokens.includes(n));
  if (!name) return null;

  const cap = name.charAt(0).toUpperCase() + name.slice(1);
  const evidence = experiencesWith(input.experiences, name);
  const opinion = input.facts.find((f) => sameName(f.subject, name));
  if (evidence.length === 0 && !opinion) return null;

  const stage = stageLine(input.character, name);
  const opinionBit = opinion ? ` My position on ${cap}: ${opinion.value}.` : '';
  const openers = [
    `${cap}. Right. I remember everything.`,
    `Oh, we're doing ${cap} history? Sit down.`,
    `${cap}. I keep records on this.`,
  ];
  const recount = evidence.length > 0 ? ` ${at(evidence, seed / 3).what}` : '';
  const friendly = (input.character ? bondFor(input.character, name)?.kind : undefined) !== 'rival';
  return {
    speech: at(openers, seed) + recount + opinionBit + stage,
    reaction: friendly ? 'happy' : 'annoyed',
    actions: friendly ? ['TAIL_WAG', 'EAR_PERK'] : ['EAR_PERK', 'HEAD_TILT'],
    factIds: opinion ? [opinion.id] : [],
  };
}

function experienceReply(input: RecallInput, utterTokens: string[]): Recalled | null {
  const seed = input.seed ?? 0;
  // Score every experience by how many distinctive words it shares with the
  // question ("remember the beach" → the beach trip; "the vacuum" → the
  // vacuum incident). where counts as a word of the memory.
  let best: { e: Experience; score: number } | null = null;
  for (const e of input.experiences) {
    const own = tokens(`${e.what} ${e.where ?? ''}`);
    const score = own.filter((t) => utterTokens.includes(t)).length;
    if (score > 0 && (!best || score > best.score || (score === best.score && e.importance > best.e.importance))) {
      best = { e, score };
    }
  }
  if (!best) return null;
  const openers = [
    `That happened. ${best.e.what} I was there for all of it.`,
    `${best.e.what} Yes. I remember. I remember EVERYTHING.`,
    `You mean this: ${best.e.what} A big day.`,
  ];
  return { speech: at(openers, seed), reaction: 'happy', actions: ['EAR_PERK', 'TAIL_WAG'], factIds: [] };
}

// ------------------------------------------------------------------- recall

/**
 * Answer from the record, or admit there is nothing there (return null and
 * let the normal path improvise — an invented story about an unrecorded
 * subject is in character; an invented story about a RECORDED one is a bug).
 */
/**
 * "WHAT DO YOU REMEMBER ABOUT ME?"
 *
 * The single most direct question anyone can ask this product, and it fell
 * through every branch of this module to the composer, which does not read the
 * record at all — so the answer to "what do you know about me" was a joke
 * about squirrels. Recall answered from EXPERIENCES (things that happened) and
 * from dogs, and never once from the FACTS, which are the things the player
 * actually told him about themselves.
 *
 * Not a data dump. Three at most, newest and most-used first, said the way he
 * says everything else — the point is that he is showing off, not printing a
 * table. And it is honest when the file is thin, because "I know everything
 * about you" from a dog who has been told one thing is the exact overclaim
 * this app cannot afford.
 */
const ABOUT_ME =
  /\b(?:what|how much|anything)\b[^?]*\b(?:know|remember)\b[^?]*\bab(?:ou)?t\s+me\b|\btell me (?:what|everything|all) (?:you|u) (?:know|remember)\b|\bdo (?:you|u) (?:know|remember) (?:anything|everything|much) about me\b/i;

function aboutYouReply(input: RecallInput, _utterTokens: string[]): Recalled | null {
  // Its own shape, deliberately narrow, because this branch runs BEFORE the
  // general recall cue: "what do you KNOW about me" carries none of the words
  // in RECALL_CUE (remember, history, that time...) and was rejected at the
  // door — the most on-thesis question in the app, turned away for using the
  // wrong verb.
  if (!ABOUT_ME.test(input.text)) return null;

  const mine = input.facts
    .filter((f) => f.subject === 'person' && f.key !== 'name' && f.value.trim().length > 0)
    .sort((a, b) => b.referenceCount - a.referenceCount || b.learnedAt - a.learnedAt);
  const name = input.facts.find((f) => f.subject === 'person' && f.key === 'name')?.value;

  if (mine.length === 0) {
    return {
      speech: name
        ? `${name}. That's what I've got so far, and I've made it my whole personality. Tell me something else.`
        : "Almost nothing, and I want you to sit with that. Start with your name.",
      reaction: 'annoyed',
      actions: ['HEAD_TILT'],
      factIds: [],
    };
  }

  const said = (f: Fact) => `${f.key.replace(/_/g, ' ')} is ${f.value}`;
  const top = mine.slice(0, 3);
  const list =
    top.length === 1
      ? `your ${said(top[0])}`
      : `${top.slice(0, -1).map((f) => `your ${said(f)}`).join(', ')} and your ${said(top[top.length - 1])}`;
  const openers = [
    `${name ? `${name}. ` : ''}Loads. ${list.charAt(0).toUpperCase()}${list.slice(1)}.`,
    `Everything, obviously. ${list.charAt(0).toUpperCase()}${list.slice(1)}. I could go on.`,
    `${list.charAt(0).toUpperCase()}${list.slice(1)}. That's off the top of my head.`,
  ];
  const more = mine.length > 3 ? ` And ${mine.length - 3} more I'm holding back for effect.` : '';
  return {
    speech: at(openers, input.seed ?? 0) + more,
    reaction: 'happy',
    actions: ['TAIL_WAG', 'EAR_PERK'],
    factIds: top.map((f) => f.id),
  };
}

/**
 * "Do you remember my sister?" — a question about a thing they TOLD him,
 * rather than a thing that happened. Same gap as above from the other side:
 * the sister's name is on file and nothing in here could reach it.
 */
function factReply(input: RecallInput, utterTokens: string[]): Recalled | null {
  const hit = input.facts.find(
    (f) =>
      f.subject === 'person' &&
      f.key
        .split('_')
        .some((part) => part.length >= 3 && utterTokens.includes(part)),
  );
  if (!hit) return null;
  const label = hit.key.replace(/_/g, ' ');
  const openers = [
    `Your ${label} is ${hit.value}. I don't lose things.`,
    `${hit.value}. That's your ${label}. Ask me a hard one.`,
    `Course I do. Your ${label}: ${hit.value}. Filed, cross-referenced, unforgettable.`,
  ];
  return {
    speech: at(openers, input.seed ?? 0),
    reaction: 'happy',
    actions: ['TAIL_WAG'],
    factIds: [hit.id],
  };
}

export function recall(input: RecallInput): Recalled | null {
  const utterTokens = tokens(input.text);
  if (utterTokens.length === 0 && !RECALL_CUE.test(input.text)) return null;

  // His sacred object needs no "remember" cue — any mention of it is about it.
  const treasure = treasureReply(input, utterTokens);
  if (treasure) return treasure;

  // Neither does "what do you know about me": see ABOUT_ME.
  const aboutYou = aboutYouReply(input, utterTokens);
  if (aboutYou) return aboutYou;

  // Everything else only intercepts when they are reaching for the past;
  // a casual "is Duke around" stays a conversation, not a deposition.
  if (!RECALL_CUE.test(input.text)) return null;

  // A dog by name first (most specific), then a thing they told him, then a
  // thing that happened, then the roll-call — which is the broadest and must
  // not swallow a question that had a precise answer.
  return (
    dogReply(input, utterTokens) ??
    factReply(input, utterTokens) ??
    experienceReply(input, utterTokens)
  );
}
