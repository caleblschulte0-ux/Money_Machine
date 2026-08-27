import { reduce, freshSnapshot } from '../src/barkly/state';
import { Stash, TREASURES, treasuresAt } from '../src/world/stash';
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

  it('prefers treasures he does not own yet, per site', async () => {
    for (const site of ['park', 'beach'] as const) {
      const stash = new Stash(createInMemoryStore(), 'default');
      await stash.load();
      const pool = treasuresAt(site);
      const seen = new Set<string>();
      for (let i = 0; i < pool.length; i++) seen.add((await stash.dig(site)).id);
      expect(seen.size).toBe(pool.length);
    }
  });

  it('never turns up a seashell in a park hole', async () => {
    const stash = new Stash(createInMemoryStore(), 'default');
    await stash.load();
    const beachIds = new Set(treasuresAt('beach').map((t) => t.id));
    for (let i = 0; i < 40; i++) {
      expect(beachIds.has((await stash.dig('park')).id)).toBe(false);
    }
  });

  it('the two sites do not overlap and together are everything', () => {
    const park = treasuresAt('park').map((t) => t.id);
    const beach = treasuresAt('beach').map((t) => t.id);
    expect(park.filter((id) => beach.includes(id))).toEqual([]);
    expect(park.length + beach.length).toBe(TREASURES.length);
    // A new place has to bring its own finds or it is a new background.
    expect(beach.length).toBeGreaterThanOrEqual(8);
  });

  it('every treasure id is unique', () => {
    expect(new Set(TREASURES.map((t) => t.id)).size).toBe(TREASURES.length);
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
