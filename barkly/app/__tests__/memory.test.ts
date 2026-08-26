import { BarklyMemory, TURN_WINDOW } from '../src/barkly/memory';
import { createInMemoryStore } from '../src/storage/inMemoryStore';

const turn = (role: 'user' | 'barkly', text: string) => ({ role, text, at: 1 });

describe('BarklyMemory', () => {
  it('persists across instances (close/reopen the app)', async () => {
    const store = createInMemoryStore();
    const first = new BarklyMemory(store, 'default');
    await first.load();
    await first.addTurn(turn('user', 'hi Barkly'));
    await first.remember(["Your person's name is Caleb."], ['Caleb promised to play tomorrow.']);

    const second = new BarklyMemory(store, 'default');
    const state = await second.load();
    expect(state.turns).toHaveLength(1);
    expect(state.userFacts).toEqual(["Your person's name is Caleb."]);
    expect(state.barklyMemories).toEqual(['Caleb promised to play tomorrow.']);
  });

  it('folds overflowing turns into the session summary instead of growing forever', async () => {
    const mem = new BarklyMemory(createInMemoryStore(), 'default');
    await mem.load();
    for (let i = 0; i < TURN_WINDOW + 5; i++) {
      await mem.addTurn(turn('user', `message number ${i}`));
    }
    const state = mem.snapshot();
    expect(state.turns).toHaveLength(TURN_WINDOW);
    expect(state.sessionSummary).toContain('message number 0');
    expect(state.turns[0].text).toBe('message number 5');
  });

  it('dedupes facts case-insensitively', async () => {
    const mem = new BarklyMemory(createInMemoryStore(), 'default');
    await mem.load();
    await mem.remember(['Caleb has a sister.', 'caleb has a sister.'], []);
    await mem.remember(['Caleb has a sister.'], []);
    expect(mem.snapshot().userFacts).toHaveLength(1);
  });

  it('forgetAll wipes everything (privacy requirement)', async () => {
    const store = createInMemoryStore();
    const mem = new BarklyMemory(store, 'default');
    await mem.load();
    await mem.addTurn(turn('user', 'secret'));
    await mem.remember(['fact'], ['memory']);
    await mem.forgetAll();

    const reloaded = new BarklyMemory(store, 'default');
    const state = await reloaded.load();
    expect(state.turns).toHaveLength(0);
    expect(state.userFacts).toHaveLength(0);
    expect(state.barklyMemories).toHaveLength(0);
    expect(state.sessionSummary).toBe('');
  });

  it('survives a corrupt store without crashing', async () => {
    const store = createInMemoryStore();
    await store.set('barkly/profile/default/memory-v1', '{not json');
    const mem = new BarklyMemory(store, 'default');
    const state = await mem.load();
    expect(state.turns).toEqual([]);
  });
});
