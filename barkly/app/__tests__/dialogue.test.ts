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
