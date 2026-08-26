import { BarkleyMemory, TURN_WINDOW } from '../src/barkley/memory';
import { createInMemoryStore } from '../src/storage/inMemoryStore';

const turn = (role: 'user' | 'barkley', text: string) => ({ role, text, at: 1 });

describe('BarkleyMemory', () => {
  it('persists across instances (close/reopen the app)', async () => {
    const store = createInMemoryStore();
    const first = new BarkleyMemory(store, 'default');
    await first.load();
    await first.addTurn(turn('user', 'hi Barkley'));
    await first.remember(["Your person's name is Caleb."], ['Caleb promised to play tomorrow.']);

    const second = new BarkleyMemory(store, 'default');
    const state = await second.load();
    expect(state.turns).toHaveLength(1);
    expect(state.userFacts).toEqual(["Your person's name is Caleb."]);
    expect(state.barkleyMemories).toEqual(['Caleb promised to play tomorrow.']);
  });

  it('folds overflowing turns into the session summary instead of growing forever', async () => {
    const mem = new BarkleyMemory(createInMemoryStore(), 'default');
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
    const mem = new BarkleyMemory(createInMemoryStore(), 'default');
    await mem.load();
    await mem.remember(['Caleb has a sister.', 'caleb has a sister.'], []);
    await mem.remember(['Caleb has a sister.'], []);
    expect(mem.snapshot().userFacts).toHaveLength(1);
  });

  it('forgetAll wipes everything (privacy requirement)', async () => {
    const store = createInMemoryStore();
    const mem = new BarkleyMemory(store, 'default');
    await mem.load();
    await mem.addTurn(turn('user', 'secret'));
    await mem.remember(['fact'], ['memory']);
    await mem.forgetAll();

    const reloaded = new BarkleyMemory(store, 'default');
    const state = await reloaded.load();
    expect(state.turns).toHaveLength(0);
    expect(state.userFacts).toHaveLength(0);
    expect(state.barkleyMemories).toHaveLength(0);
    expect(state.sessionSummary).toBe('');
  });

  it('survives a corrupt store without crashing', async () => {
    const store = createInMemoryStore();
    await store.set('barkley/profile/default/memory-v1', '{not json');
    const mem = new BarkleyMemory(store, 'default');
    const state = await mem.load();
    expect(state.turns).toEqual([]);
  });
});
