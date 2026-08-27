import { BarklyMemory, TURN_WINDOW } from '../src/barkly/memory';
import { createInMemoryStore } from '../src/storage/inMemoryStore';

const turn = (role: 'user' | 'barkly', text: string, at = 1) => ({ role, text, at });

describe('BarklyMemory', () => {
  it('persists structured facts across instances (close/reopen the app)', async () => {
    const store = createInMemoryStore();
    const first = new BarklyMemory(store, 'default');
    await first.load();
    await first.addTurn(turn('user', 'hi Barkly'));
    await first.remember(['name = Caleb'], ['Caleb promised to play tomorrow.']);

    const second = new BarklyMemory(store, 'default');
    const state = await second.load();
    expect(state.turns).toHaveLength(1);
    expect(second.getFact('name')?.value).toBe('Caleb');
    expect(state.barklyMemories).toContain('Caleb promised to play tomorrow.');
  });

  it('UPDATES a fact rather than believing both values (the core fix)', async () => {
    const mem = new BarklyMemory(createInMemoryStore(), 'default');
    await mem.load();
    await mem.remember(['favorite_color = blue'], []);
    const result = await mem.remember(['favorite_color = green'], []);

    expect(mem.getFact('favorite_color')?.value).toBe('green');
    // Exactly one favorite-colour fact exists, not two contradictory ones.
    const colorFacts = mem.snapshot().facts.filter((f) => f.key === 'favorite_color');
    expect(colorFacts).toHaveLength(1);
    // And the change is reported, so Barkly can acknowledge the correction.
    expect(result.updated).toEqual([{ key: 'favorite_color', from: 'blue', to: 'green' }]);
    // The old value is kept as history, not as a competing belief.
    expect(colorFacts[0].history?.[0].value).toBe('blue');
  });

  it('hearing the same fact again raises confidence without duplicating', async () => {
    const mem = new BarklyMemory(createInMemoryStore(), 'default');
    await mem.load();
    await mem.remember(['name = Caleb'], []);
    const before = mem.getFact('name')!;
    await mem.remember(['name = Caleb'], []);
    const after = mem.getFact('name')!;
    expect(mem.snapshot().facts.filter((f) => f.key === 'name')).toHaveLength(1);
    expect(after.confidence).toBeGreaterThan(before.confidence);
    expect(after.referenceCount).toBe(1);
  });

  it('parses loose prose statements into addressable facts', async () => {
    const mem = new BarklyMemory(createInMemoryStore(), 'default');
    await mem.load();
    await mem.remember(["Your person's name is Caleb."], []);
    expect(mem.getFact('name')?.value).toBe('Caleb');
  });

  it('ranks a name above a passing remark', async () => {
    const mem = new BarklyMemory(createInMemoryStore(), 'default');
    await mem.load();
    await mem.remember(['name = Caleb', 'saw a bird today'], []);
    const ranked = mem.relevant().facts;
    expect(ranked[0].key).toBe('name');
  });

  it('consolidates overflowing turns instead of growing forever', async () => {
    const mem = new BarklyMemory(createInMemoryStore(), 'default');
    await mem.load();
    for (let i = 0; i < TURN_WINDOW + 5; i++) {
      await mem.addTurn(turn('user', `message number ${i}`));
    }
    const state = mem.snapshot();
    expect(state.turns).toHaveLength(TURN_WINDOW);
    expect(state.turns[0].text).toBe('message number 5');
    expect(state.sessionSummary).toContain('message number 0');
    // Summary is bounded — this is what keeps prompt size flat.
    expect(state.sessionSummary.split('\n').length).toBeLessThanOrEqual(12);
  });

  it('rescues promises from turns that fall out of the window', async () => {
    const mem = new BarklyMemory(createInMemoryStore(), 'default');
    await mem.load();
    await mem.addTurn(turn('user', "I'll play with you tomorrow, I promise"));
    for (let i = 0; i < TURN_WINDOW + 2; i++) {
      await mem.addTurn(turn('user', `filler ${i}`));
    }
    const experiences = mem.snapshot().experiences;
    expect(experiences.some((e) => /promise/i.test(e.what))).toBe(true);
  });

  it('migrates a v1 memory forward instead of forgetting the user', async () => {
    const store = createInMemoryStore();
    await store.set(
      'barkly/profile/default/memory-v1',
      JSON.stringify({
        turns: [turn('user', 'hello')],
        sessionSummary: 'Person: said hello',
        userFacts: ["Your person's name is Caleb."],
        barklyMemories: ['We played fetch at the park.'],
      }),
    );
    const mem = new BarklyMemory(store, 'default');
    const state = await mem.load();
    expect(mem.getFact('name')?.value).toBe('Caleb');
    expect(state.barklyMemories).toContain('We played fetch at the park.');
    expect(state.turns).toHaveLength(1);
  });

  it('forgetAll wipes everything, including legacy data (privacy requirement)', async () => {
    const store = createInMemoryStore();
    const mem = new BarklyMemory(store, 'default');
    await mem.load();
    await mem.addTurn(turn('user', 'secret'));
    await mem.remember(['name = Caleb'], ['a memory']);
    await mem.forgetAll();

    const reloaded = new BarklyMemory(store, 'default');
    const state = await reloaded.load();
    expect(state.turns).toHaveLength(0);
    expect(state.facts).toHaveLength(0);
    expect(state.experiences).toHaveLength(0);
    expect(state.sessionSummary).toBe('');
  });

  it('survives a corrupt store without crashing', async () => {
    const store = createInMemoryStore();
    await store.set('barkly/profile/default/memory-v2', '{not json');
    const mem = new BarklyMemory(store, 'default');
    const state = await mem.load();
    expect(state.turns).toEqual([]);
    expect(state.facts).toEqual([]);
  });
});
