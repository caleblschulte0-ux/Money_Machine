/**
 * The dialogue engine — one conversation round, end to end.
 *
 * User-taught cues are checked BEFORE the provider. Learned tricks and
 * multi-step routines therefore still work offline and cost no model call.
 */

import { CharacterState, friendshipStage, rivalryStage } from './character';
import { BarklyMemory } from './memory';
import { buildSystemPrompt, parseReply, WorldContext } from './prompts';
import { recall } from './recall';
import { looksLikeTrainingInstruction, parseLocalTrainingInstruction } from './training';
import { BarklyReply, BarklySnapshot } from './types';
import { DialogueProvider } from '../providers/types';

export interface ConverseResult {
  reply: BarklyReply;
  corrections: { key: string; from: string; to: string }[];
}

export class DialogueEngine {
  constructor(
    private provider: DialogueProvider,
    private memory: BarklyMemory,
  ) {}

  get providerName(): string {
    return this.provider.name;
  }

  async converse(
    userText: string,
    snapshot: BarklySnapshot,
    world?: WorldContext,
    character?: CharacterState,
  ): Promise<ConverseResult> {
    const empty: BarklyReply = {
      speech: '',
      actions: [],
      newUserFacts: [],
      newBarklyMemories: [],
      learnedTraining: [],
    };
    const text = userText.trim();
    if (!text) return { reply: empty, corrections: [] };

    const isTeaching = looksLikeTrainingInstruction(text);

    // A teaching sentence may contain an existing cue while correcting it, so
    // never fire the old trick in the middle of teaching the new version.
    if (!isTeaching) {
      const trained = this.memory.matchTraining(text);
      if (trained) {
        const reply: BarklyReply = {
          speech: trained.speech,
          reaction: trained.reaction,
          actions: trained.actions,
          routine: trained.routine,
          newUserFacts: [],
          newBarklyMemories: [],
          learnedTraining: [],
        };
        const now = Date.now();
        await this.memory.noteTrainingTriggered(trained.id);
        await this.memory.addTurn({ role: 'user', text, at: now });
        await this.memory.addTurn({ role: 'barkly', text: reply.speech, at: now });
        return { reply, corrections: [] };
      }
    }

    // Offline-capable teaching for representable physical tricks/routines.
    if (isTeaching) {
      const local = parseLocalTrainingInstruction(text);
      if (local) {
        await this.memory.learnTraining([local]);
        const isRoutine = (local.routine?.length ?? 0) > 1;
        const reply: BarklyReply = {
          speech: isRoutine
            ? `A whole routine? Fine. Say “${local.cue}”. I know the order.`
            : `Oh, I know this one now. Say “${local.cue}” and see what happens.`,
          reaction: 'happy',
          actions: ['EAR_PERK', 'TAIL_WAG'],
          newUserFacts: [],
          newBarklyMemories: [
            isRoutine
              ? `You taught me the routine “${local.cue}”: ${local.instruction}.`
              : `You taught me the cue “${local.cue}”.`,
          ],
          learnedTraining: [local],
        };
        const now = Date.now();
        await this.memory.addTurn({ role: 'user', text, at: now });
        await this.memory.addTurn({ role: 'barkly', text: reply.speech, at: now });
        await this.memory.remember([], reply.newBarklyMemories, { where: world?.locationDescription });
        return { reply, corrections: [] };
      }
    }

    const memState = this.memory.snapshot();

    // Recorded history is answered FROM the record, before any provider —
    // the same slot trained cues occupy, and for the same reason: these
    // questions have a right answer. "Do you remember the duck rock" used to
    // fall through to a generic story shape while a whole saga about that
    // rock sat in his experiences; recall() searches the FULL stores (the
    // ranked prompt window ages old sagas out — that is what made Pack Book
    // memories unreachable from free conversation).
    if (!isTeaching) {
      const recalled = recall({
        text,
        facts: memState.facts,
        experiences: memState.experiences,
        character,
        seed: Date.now() % 9973,
      });
      if (recalled) {
        const reply: BarklyReply = {
          speech: recalled.speech,
          reaction: recalled.reaction,
          actions: recalled.actions,
          newUserFacts: [],
          newBarklyMemories: [],
          learnedTraining: [],
        };
        const now = Date.now();
        await this.memory.addTurn({ role: 'user', text, at: now });
        await this.memory.addTurn({ role: 'barkly', text: reply.speech, at: now });
        // A memory that came up stays prompt-relevant — same rule as facts
        // the model referenced.
        await this.memory.touch(recalled.factIds);
        return { reply, corrections: [] };
      }
    }

    const relevant = this.memory.relevant();
    const systemPrompt = buildSystemPrompt({
      snapshot,
      memory: memState,
      world,
      relevant,
      character,
    });

    // The situation as DATA as well as prose. A model reads the prompt; the
    // offline brain cannot, and without this it repeats itself forever.
    //
    // The character record rides along too — bonds flattened to (kind,
    // encounters, rung label), keyed by lowercased name so the composer can
    // find "biscuit" however the player typed it. Before these fields, the
    // offline brain answered about a best friend of 34 hangouts exactly as
    // it did about a stranger, because nothing told it otherwise.
    const bonds = character?.socialBonds
      ? Object.fromEntries(
          Object.entries(character.socialBonds).map(([who, b]) => [
            who.trim().toLowerCase(),
            {
              kind: b.kind,
              encounters: b.encounters,
              label: (b.kind === 'friend' ? friendshipStage(b.encounters) : rivalryStage(b.encounters)).label,
            },
          ]),
        )
      : undefined;
    const context = {
      state: snapshot.state,
      stats: snapshot.stats,
      location: world?.locationDescription,
      npcsPresent: world?.npcs.map((n) => n.name),
      personName: this.memory.getFact('name')?.value,
      treasures: world?.stashItems,
      cues: memState.trainingRules.map((r) => r.cue),
      hour: new Date().getHours(),
      toy: world?.toy,
      bonds,
      favoriteTreasure: character?.favoriteTreasure,
      obsession: character?.obsession?.topic,
      grievance: character?.grievance
        ? { who: character.grievance.who, what: character.grievance.what }
        : undefined,
      favoriteFriend: character?.favoriteFriend,
    };

    const raw = await this.provider.complete({
      systemPrompt,
      turns: memState.turns,
      userText: text,
      context,
    });

    const reply = parseReply(raw);

    const now = Date.now();
    await this.memory.addTurn({ role: 'user', text, at: now });
    if (reply.speech) await this.memory.addTurn({ role: 'barkly', text: reply.speech, at: now });

    let corrections: ConverseResult['corrections'] = [];
    if (reply.newUserFacts.length > 0 || reply.newBarklyMemories.length > 0) {
      const result = await this.memory.remember(reply.newUserFacts, reply.newBarklyMemories, {
        where: world?.locationDescription,
      });
      corrections = result.updated;
    }

    const learned = reply.learnedTraining ?? [];
    if (isTeaching && learned.length > 0) {
      await this.memory.learnTraining(learned);
    }

    await this.memory.touch(relevant.facts.map((f) => f.id));
    return { reply, corrections };
  }
}
