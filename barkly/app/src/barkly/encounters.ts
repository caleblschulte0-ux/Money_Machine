/**
 * Choice-driven Barkly encounters.
 *
 * Tapping a recurring dog should eventually become more than cycling a line.
 * These moments are derived from the relationship history that already exists:
 * favorite treasures, signature routines and the current social bond. Choices
 * then feed back into that history, so the player is helping author the saga.
 *
 * Pure and deterministic: no React, no storage, no random loot tables.
 */

import { CharacterState, friendshipStage, rivalryStage } from './character';
import { MemoryState } from './memory';
import { sanitize } from './facts';
import { BodyAction, ReactionState } from './types';
import { NPCS, NpcId } from '../world/npcs';

export interface EncounterChoice {
  id: string;
  label: string;
  /** Tiny preview of the attitude behind the choice. */
  hint: string;
  npcReply: string;
  barklyReply: string;
  /** Durable shared-memory sentence after the choice resolves. */
  memory: string;
  /** Positive intensifies/strengthens; negative cools the bond. */
  bondDelta: number;
  reaction?: ReactionState;
  actions: BodyAction[];
  /** If present, Barkly performs this learned routine after his reply. */
  routineCue?: string;
  /**
   * If present, this choice is not a line — it is a CONTEST. Picking it
   * opens the duel and the outcome, not a script, decides what happened.
   * "Challenge him" used to print two sentences and bump a counter, which is
   * an announcement rather than a challenge.
   */
  contest?: { kind: 'fetch' | 'race' | 'dig'; opponent: string };
  /** Said instead of barklyReply when a contest was won / lost. */
  wonReply?: string;
  lostReply?: string;
  /** Durable memory variants for the two outcomes. */
  wonMemory?: string;
  lostMemory?: string;
}

export interface SocialEncounter {
  id: string;
  npcId: NpcId;
  eyebrow: string;
  title: string;
  prompt: string;
  choices: EncounterChoice[];
}

export interface EncounterInput {
  npcId: NpcId;
  character: CharacterState;
  memory: MemoryState;
}

function signatureRoutine(memory: MemoryState) {
  return [...memory.trainingRules]
    .filter((rule) => rule.timesTriggered >= 3)
    .sort((a, b) => b.timesTriggered - a.timesTriggered || b.updatedAt - a.updatedAt)[0];
}

function bondCount(character: CharacterState, name: string): number {
  return character.socialBonds?.[name]?.encounters ?? 0;
}

function dukeEncounter(character: CharacterState, memory: MemoryState): SocialEncounter {
  const duke = NPCS.duke;
  const count = bondCount(character, duke.name);
  const treasure = character.favoriteTreasure;
  const routine = signatureRoutine(memory);

  if (treasure) {
    const item = sanitize(treasure, 70);
    const choices: EncounterChoice[] = [
      {
        id: 'defend',
        label: 'Defend the treasure',
        hint: 'maximum escalation',
        npcReply: 'Relax. It is literally dirt-adjacent.',
        barklyReply: 'You take that back. This is an artifact.',
        memory: `Defended ${item} when Duke insulted it. The feud got worse.`,
        bondDelta: 2,
        reaction: 'annoyed',
        actions: ['EAR_PERK', 'EXCITED'],
      },
      {
        id: 'unbothered',
        label: 'Act completely unbothered',
        hint: 'de-escalate the feud',
        npcReply: '...Wait. You are not mad?',
        barklyReply: "Nope. Don't care. Not even a little. ...Stop looking at it though.",
        memory: `Refused to take Duke's bait about ${item}. The feud cooled down a little.`,
        bondDelta: -1,
        reaction: 'happy',
        actions: ['LOOK_LEFT', 'BLINK'],
      },
    ];
    if (routine) {
      choices.push({
        id: 'routine',
        label: `Hit “${sanitize(routine.cue, 32)}”`,
        hint: 'weaponize the inside joke',
        npcReply: 'What is happening right now.',
        barklyReply: 'You asked for this, Duke.',
        memory: `Performed the “${sanitize(routine.cue, 50)}” routine at Duke during the treasure dispute.`,
        bondDelta: 1,
        reaction: 'excited',
        actions: ['TAIL_WAG', 'EAR_PERK'],
        routineCue: routine.cue,
      });
    }
    return {
      id: `duke-treasure-${Math.floor(count / 3)}`,
      npcId: 'duke',
      eyebrow: `${rivalryStage(count).label.toUpperCase()} BUSINESS`,
      title: 'Duke looked at the treasure.',
      prompt: `Duke just called ${item} “kind of mid.” Barkly has become completely still. This is now your problem.`,
      choices,
    };
  }

  if (routine) {
    return {
      id: `duke-routine-${Math.floor(count / 3)}`,
      npcId: 'duke',
      eyebrow: 'PUBLIC CHALLENGE',
      title: 'Duke mocked the routine.',
      prompt: `Duke says the “${sanitize(routine.cue, 50)}” routine is not a real trick. Barkly is looking at you like this requires a response.`,
      choices: [
        {
          id: 'perform',
          label: 'Perform it anyway',
          hint: 'commit to the bit',
          npcReply: 'That proved absolutely nothing.',
          barklyReply: 'Incorrect. It proved everything.',
          memory: `Performed “${sanitize(routine.cue, 50)}” in front of Duke after he mocked it.`,
          bondDelta: 2,
          reaction: 'excited',
          actions: ['TAIL_WAG'],
          routineCue: routine.cue,
        },
        {
          id: 'refuse',
          label: 'Refuse on principle',
          hint: 'Barkly chooses dignity',
          npcReply: 'Knew it.',
          barklyReply: "I'm not performing on command for Duke. I have standards now.",
          memory: `Refused to perform “${sanitize(routine.cue, 50)}” for Duke. Barkly claimed dignity.`,
          bondDelta: 0,
          reaction: 'annoyed',
          actions: ['LOOK_LEFT'],
        },
        {
          id: 'compliment',
          label: 'Say Duke has a good trick too',
          hint: 'unexpected peace offering',
          npcReply: '...Yeah? I mean. Obviously.',
          barklyReply: 'Do not make me regret this.',
          memory: `Gave Duke an unexpected compliment. The feud cooled a little.`,
          bondDelta: -1,
          reaction: 'happy',
          actions: ['HEAD_TILT'],
        },
      ],
    };
  }

  return {
    id: `duke-fetch-${Math.floor(count / 3)}`,
    npcId: 'duke',
    eyebrow: 'RIVAL EVENT',
    title: 'Duke issued a fetch challenge.',
    prompt: `${duke.name} says he fetches “at a national level” and wants Barkly to admit he is better. Barkly has declined to admit anything.`,
    choices: [
      {
        id: 'challenge',
        label: 'Challenge him',
        hint: 'settle it properly',
        npcReply: 'Finally. A serious competitor.',
        barklyReply: 'Serious? No. Competitor? Unfortunately yes.',
        memory: 'Accepted Duke’s dramatic fetch challenge. The rivalry intensified.',
        contest: { kind: 'fetch', opponent: duke.name },
        wonReply: 'Beat him. In front of everyone. I would like that noted.',
        lostReply: 'He won. Once. In specific conditions I intend to dispute.',
        wonMemory: 'Beat Duke in a real fetch duel. Duke has not recovered.',
        lostMemory: 'Lost a fetch duel to Duke and has been drafting excuses since.',
        bondDelta: 2,
        reaction: 'excited',
        actions: ['EXCITED', 'TAIL_WAG'],
      },
      {
        id: 'laugh',
        label: 'Laugh it off',
        hint: 'do not feed the ego',
        npcReply: 'Why are you both laughing.',
        barklyReply: 'National level. He said it with his whole chest.',
        memory: 'Laughed off Duke’s fetch challenge instead of escalating it.',
        bondDelta: 0,
        reaction: 'happy',
        actions: ['HEAD_TILT'],
      },
      {
        id: 'peace',
        label: 'Suggest doubles',
        hint: 'cool the feud',
        npcReply: '...Against who?',
        barklyReply: 'See? Teamwork. Horrible. Effective.',
        memory: 'Suggested teaming up with Duke instead of competing. The feud cooled.',
        bondDelta: -1,
        reaction: 'happy',
        actions: ['EAR_PERK'],
      },
    ],
  };
}

function biscuitEncounter(character: CharacterState, memory: MemoryState): SocialEncounter {
  const biscuit = NPCS.biscuit;
  const count = bondCount(character, biscuit.name);
  const treasure = character.favoriteTreasure;
  const routine = signatureRoutine(memory);

  if (routine) {
    return {
      id: `biscuit-routine-${Math.floor(count / 3)}`,
      npcId: 'biscuit',
      eyebrow: `${friendshipStage(count).label.toUpperCase()} EVENT`,
      title: 'Biscuit wants to learn the bit.',
      prompt: `Biscuit has seen the “${sanitize(routine.cue, 50)}” routine and is convinced Barkly can teach it to him in thirty seconds.`,
      choices: [
        {
          id: 'demo',
          label: 'Give him the full demo',
          hint: 'share the inside joke',
          npcReply: 'I understood all of that. Probably.',
          barklyReply: 'Watch closely, Biscuit. This is advanced curriculum.',
          memory: `Performed “${sanitize(routine.cue, 50)}” for Biscuit as a training demonstration.`,
          bondDelta: 2,
          reaction: 'excited',
          actions: ['EAR_PERK', 'TAIL_WAG'],
          routineCue: routine.cue,
        },
        {
          id: 'coach',
          label: 'Make Biscuit try first',
          hint: 'coach him badly',
          npcReply: 'Okay! What do I do with my legs?',
          barklyReply: 'Excellent question. I was hoping you knew.',
          memory: `Tried to coach Biscuit through the “${sanitize(routine.cue, 50)}” routine. Neither dog had a plan.`,
          bondDelta: 1,
          reaction: 'happy',
          actions: ['HEAD_TILT'],
        },
        {
          id: 'classified',
          label: 'Tell him it is classified',
          hint: 'protect the private ritual',
          npcReply: 'Oh. Is it government?',
          barklyReply: 'Higher clearance than government, Biscuit.',
          memory: `Declared the “${sanitize(routine.cue, 50)}” routine classified when Biscuit asked to learn it.`,
          bondDelta: 0,
          reaction: 'happy',
          actions: ['LOOK_LEFT'],
        },
      ],
    };
  }

  if (treasure) {
    const item = sanitize(treasure, 70);
    return {
      id: `biscuit-treasure-${Math.floor(count / 3)}`,
      npcId: 'biscuit',
      eyebrow: 'BEST-FRIEND BUSINESS',
      title: 'Biscuit found a “matching” treasure.',
      prompt: `Biscuit found a dirty object and insists it is the long-lost twin of ${item}. It does not look remotely similar.`,
      choices: [
        {
          id: 'accept',
          label: 'Accept the twin theory',
          hint: 'yes, obviously',
          npcReply: 'I KNEW IT. They are reunited!',
          barklyReply: 'The resemblance is uncanny if you stop looking at both objects.',
          memory: `Agreed with Biscuit that a random object was the long-lost twin of ${item}.`,
          bondDelta: 2,
          reaction: 'excited',
          actions: ['TAIL_WAG', 'HEAD_TILT'],
        },
        {
          id: 'museum',
          label: 'Add it to the museum',
          hint: 'collection gets lore',
          npcReply: 'Do I get a curator badge?',
          barklyReply: 'No. But you can stand near the exhibit.',
          memory: `Biscuit donated a questionable object to Barkly's imaginary museum.`,
          bondDelta: 1,
          reaction: 'happy',
          actions: ['EAR_PERK'],
        },
        {
          id: 'truth',
          label: 'Tell Biscuit the truth',
          hint: 'gentle reality check',
          npcReply: '...So they are cousins?',
          barklyReply: 'Sure, buddy. Cousins.',
          memory: `Tried to explain to Biscuit that his “matching treasure” did not match. He negotiated it down to cousins.`,
          bondDelta: 0,
          reaction: 'happy',
          actions: ['BLINK'],
        },
      ],
    };
  }

  return {
    id: `biscuit-mystery-${Math.floor(count / 3)}`,
    npcId: 'biscuit',
    eyebrow: 'BUDDY EVENT',
    title: 'Biscuit forgot what he buried.',
    prompt: 'Biscuit remembers burying something extremely important. He does not remember what it was, where he buried it, or why it mattered.',
    choices: [
      {
        id: 'help',
        label: 'Help him search',
        hint: 'good friend behavior',
        npcReply: 'YES. We need a search grid. What is a grid?',
        barklyReply: 'No idea. Start smelling dirt.',
        memory: 'Helped Biscuit search for the important mystery thing he forgot he buried.',
        bondDelta: 2,
        reaction: 'excited',
        actions: ['LOOK_LEFT', 'LOOK_RIGHT'],
      },
      {
        id: 'invent',
        label: 'Invent a map',
        hint: 'terrible leadership',
        npcReply: 'This map is just a paw print.',
        barklyReply: 'Correct. North is whichever way I point.',
        memory: 'Invented a completely fake treasure map for Biscuit’s lost mystery object.',
        bondDelta: 1,
        reaction: 'happy',
        actions: ['HEAD_TILT'],
      },
      {
        id: 'later',
        label: 'Tell him it can wait',
        hint: 'low chaos option',
        npcReply: 'Okay! I will forget again by then.',
        barklyReply: 'Perfect. Problem solved itself.',
        memory: 'Postponed Biscuit’s mystery-object search because neither dog knew what they were looking for.',
        bondDelta: 0,
        reaction: 'idle',
        actions: ['BLINK'],
      },
    ],
  };
}

function pepperEncounter(character: CharacterState, memory: MemoryState): SocialEncounter {
  const pepper = NPCS.pepper;
  const count = bondCount(character, pepper.name);
  const routine = signatureRoutine(memory);

  if (routine) {
    return {
      id: `pepper-routine-${Math.floor(count / 3)}`,
      npcId: 'pepper',
      eyebrow: 'REPUTATION EVENT',
      title: 'Pepper has heard about the routine.',
      prompt: `Pepper says three separate dogs have mentioned “${sanitize(routine.cue, 50)}.” Barkly apparently has a reputation now.`,
      choices: [
        {
          id: 'perform',
          label: 'Give Pepper the official version',
          hint: 'make the ritual public lore',
          npcReply: 'I regret asking. Continue.',
          barklyReply: 'You wanted the official version. No refunds.',
          memory: `Performed the official “${sanitize(routine.cue, 50)}” routine for Pepper.`,
          bondDelta: 2,
          reaction: 'excited',
          actions: ['TAIL_WAG'],
          routineCue: routine.cue,
        },
        {
          id: 'deny',
          label: 'Deny everything',
          hint: 'protect the mystique',
          npcReply: 'There are witnesses, Barkly.',
          barklyReply: 'Witnesses are famously unreliable.',
          memory: `Denied that the “${sanitize(routine.cue, 50)}” routine exists while Pepper cited witnesses.`,
          bondDelta: 1,
          reaction: 'happy',
          actions: ['LOOK_LEFT', 'BLINK'],
        },
        {
          id: 'retire',
          label: 'Declare it retired',
          hint: 'end on top',
          npcReply: 'You performed it yesterday.',
          barklyReply: 'Exactly. Historic final performance.',
          memory: `Declared “${sanitize(routine.cue, 50)}” retired in front of Pepper. Nobody believed him.`,
          bondDelta: 0,
          reaction: 'annoyed',
          actions: ['HEAD_TILT'],
        },
      ],
    };
  }

  return {
    id: `pepper-patrol-${Math.floor(count / 3)}`,
    npcId: 'pepper',
    eyebrow: `${friendshipStage(count).label.toUpperCase()} EVENT`,
    title: 'Pepper invited Barkly on patrol.',
    prompt: 'Pepper is doing one slow dignified lap of town and says Barkly may join if he can behave for ninety seconds.',
    choices: [
      {
        id: 'dignified',
        label: 'Attempt dignity',
        hint: 'bond with Pepper',
        npcReply: 'Good. Shoulders back. Ignore the pigeon.',
        barklyReply: 'I am dignity itself. ...There is a pigeon.',
        memory: 'Tried a dignified town patrol with Pepper and immediately noticed a pigeon.',
        bondDelta: 2,
        reaction: 'happy',
        actions: ['SIT', 'EAR_PERK'],
      },
      {
        id: 'race',
        label: 'Turn it into a race',
        hint: 'chaos wins',
        npcReply: 'That is the exact opposite of patrol.',
        barklyReply: 'Then why did you say “lap,” Pepper?',
        memory: 'Turned Pepper’s dignified town patrol into an unauthorized race.',
        contest: { kind: 'race', opponent: 'Pepper' },
        wonReply: 'Won the lap. It was a patrol. I patrolled fastest.',
        lostReply: 'Pepper won. Pepper is built like a rumour and moves like one.',
        wonMemory: 'Beat Pepper in an unauthorized race around the town square.',
        lostMemory: 'Lost an unauthorized race to Pepper and called it a warm-up.',
        bondDelta: 1,
        reaction: 'excited',
        actions: ['EXCITED', 'TAIL_WAG'],
      },
      {
        id: 'gossip',
        label: 'Ask what she has heard',
        hint: 'collect town lore',
        npcReply: 'Now that is a productive question.',
        barklyReply: 'Finally. Municipal intelligence.',
        memory: 'Skipped Pepper’s patrol instructions and asked for town gossip instead.',
        bondDelta: 1,
        reaction: 'happy',
        actions: ['EAR_PERK', 'HEAD_TILT'],
      },
    ],
  };
}

export function deriveSocialEncounter(input: EncounterInput): SocialEncounter {
  switch (input.npcId) {
    case 'duke':
      return dukeEncounter(input.character, input.memory);
    case 'biscuit':
      return biscuitEncounter(input.character, input.memory);
    case 'pepper':
      return pepperEncounter(input.character, input.memory);
  }
}

/**
 * Kept as a pure helper for tests/tools. The controller uses durable chapter
 * counts because a choice can cool a relationship and must never re-offer the
 * same chapter simply because the bond number moved downward.
 */
export function shouldOfferEncounter(character: CharacterState, npcId: NpcId): boolean {
  const name = NPCS[npcId].name;
  const count = bondCount(character, name);
  const chapters = character.socialChoices?.[name] ?? 0;
  return count >= 2 + chapters * 3;
}
