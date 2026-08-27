import { reduce, freshSnapshot } from '../src/barkly/state';
import { Stash, TREASURES } from '../src/world/stash';
import { pickThought } from '../src/world/thoughts';
import { createInMemoryStore } from '../src/storage/inMemoryStore';

describe('the stash', () => {
  it('digging adds a treasure and persists across reloads', async () => {
    const store = createInMemoryStore();
    const stash = new Stash(store, 'default');
    await stash.load();
    const found = await stash.dig();
    expect(TREASURES.some((t) => t.id === found.id)).toBe(true);

    const reloaded = new Stash(store, 'default');
    const items = await reloaded.load();
    expect(items.map((t) => t.id)).toContain(found.id);
  });

  it('prefers treasures he does not own yet', async () => {
    const stash = new Stash(createInMemoryStore(), 'default');
    await stash.load();
    const seen = new Set<string>();
    for (let i = 0; i < TREASURES.length; i++) {
      seen.add((await stash.dig()).id);
    }
    expect(seen.size).toBe(TREASURES.length);
  });

  it('clear() wipes it (privacy rule)', async () => {
    const store = createInMemoryStore();
    const stash = new Stash(store, 'default');
    await stash.load();
    await stash.dig();
    await stash.clear();
    const reloaded = new Stash(store, 'default');
    expect(await reloaded.load()).toHaveLength(0);
  });

  it('TREASURE makes him excited and lifts mood', () => {
    const before = freshSnapshot(0);
    const after = reduce(before, { type: 'TREASURE' });
    expect(after.state).toBe('excited');
    expect(after.stats.mood).toBeGreaterThan(before.stats.mood);
  });
});

describe('idle thoughts', () => {
  it('are location-aware and never empty', () => {
    for (const loc of ['home', 'park', 'town'] as const) {
      for (let seed = 0; seed < 20; seed++) {
        expect(pickThought(loc, 12, seed).length).toBeGreaterThan(5);
      }
    }
  });
  it('night thoughts only appear at night-adjacent seeds', () => {
    const dayPool = new Set(Array.from({ length: 60 }, (_, s) => pickThought('home', 12, s)));
    expect([...dayPool].some((t) => t.includes('moon'))).toBe(false);
  });
});
