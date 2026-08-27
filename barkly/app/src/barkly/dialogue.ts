/**
 * The dialogue engine — one conversation round, end to end:
 *
 *   transcript -> prompt (personality + mood + world + ranked memory)
 *   -> DialogueProvider -> parse reply -> merge memory -> BarklyReply
 *
 * The engine is provider-agnostic and platform-agnostic. Speech capture and
 * audio playback happen outside (useBarkly's speak() lifecycle) so this stays
 * testable and so audio is never triggered from two places.
 */

import { BarklyMemory } from './memory';
import { buildSystemPrompt, parseReply, WorldContext } from './prompts';
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
  ): Promise<ConverseResult> {
    const empty: BarklyReply = {
      speech: '',
      actions: [],
      newUserFacts: [],
      newBarklyMemories: [],
    };
    const text = userText.trim();
    if (!text) return { reply: empty, corrections: [] };

    const memState = this.memory.snapshot();
    const relevant = this.memory.relevant();
    const systemPrompt = buildSystemPrompt({
      snapshot,
      memory: memState,
      world,
      relevant,
    });

    const raw = await this.provider.complete({
      systemPrompt,
      turns: memState.turns,
      userText: text,
    });

    const reply = parseReply(raw);

    // Record the exchange and any durable memory.
    const now = Date.now();
    await this.memory.addTurn({ role: 'user', text, at: now });
    if (reply.speech) {
      await this.memory.addTurn({ role: 'barkly', text: reply.speech, at: now });
    }

    let corrections: ConverseResult['corrections'] = [];
    if (reply.newUserFacts.length > 0 || reply.newBarklyMemories.length > 0) {
      const result = await this.memory.remember(reply.newUserFacts, reply.newBarklyMemories, {
        where: world?.locationDescription,
      });
      corrections = result.updated;
    }

    // Facts he was just shown stay prompt-relevant.
    await this.memory.touch(relevant.facts.map((f) => f.id));

    return { reply, corrections };
  }
}
