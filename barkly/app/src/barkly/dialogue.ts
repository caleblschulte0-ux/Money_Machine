/**
 * The dialogue engine — one conversation round, end to end.
 *
 * User-taught cues are checked BEFORE the provider. Once Barkly learns a trick,
 * saying its cue does not need another AI request and still works when the live
 * model is unavailable.
 */

import { CharacterState } from './character';
import { BarklyMemory } from './memory';
import { buildSystemPrompt, parseReply, WorldContext } from './prompts';
import { looksLikeTrainingInstruction } from './training';
import { BarklyReply, BarklySnapshot } from './types';
import { DialogueProvider } from '../providers/types';

export interface ConverseResult {
  reply: BarklyReply;
  /** Facts whose value changed this turn — "actually it's green now". */
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
    // never fire a trick in the middle of teaching/reteaching that trick.
    if (!isTeaching) {
      const trained = this.memory.matchTraining(text);
      if (trained) {
        const reply: BarklyReply = {
          speech: trained.speech,
          reaction: trained.reaction,
          actions: trained.actions,
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

    const memState = this.memory.snapshot();
    const relevant = this.memory.relevant();
    const systemPrompt = buildSystemPrompt({
      snapshot,
      memory: memState,
      world,
      relevant,
      character,
    });

    const raw = await this.provider.complete({
      systemPrompt,
      turns: memState.turns,
      userText: text,
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

    // Defense in depth: the model is not trusted to decide that an ordinary
    // sentence was a training moment. The user's own wording must pass the gate.
    const learned = reply.learnedTraining ?? [];
    if (isTeaching && learned.length > 0) {
      await this.memory.learnTraining(learned);
    }

    await this.memory.touch(relevant.facts.map((f) => f.id));
    return { reply, corrections };
  }
}
