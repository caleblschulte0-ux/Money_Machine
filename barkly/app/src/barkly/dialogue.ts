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
import { buildSystemPrompt, parseReply } from './prompts';
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

  async converse(userText: string, snapshot: BarklySnapshot): Promise<BarklyReply> {
    const text = userText.trim();
    if (!text) {
      return {
        speech: '', actions: [], newUserFacts: [], newBarklyMemories: [],
      };
    }

    const memState = this.memory.snapshot();
    const systemPrompt = buildSystemPrompt({ snapshot, memory: memState });

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
