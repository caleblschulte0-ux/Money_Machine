/**
 * The hydration gate.
 *
 * This is the regression test for the worst bug this app has had: the
 * save-on-change effects fired once with their DEFAULTS before the async boot
 * loader had read storage, so every launch overwrote the saved profile with a
 * fresh one. Coins, purchases, levels, every relationship, his stats and dev
 * mode were destroyed on every single launch, and the daily bonus re-granted
 * itself forever because `lastDailyBonus` went with them.
 *
 * The rule is one sentence and these tests are that sentence.
 */

import { createInMemoryStore } from '../src/storage/inMemoryStore';
import { HydrationGate } from '../src/storage/hydration';

describe('never write before you have read', () => {
  it('refuses a write until the load pass has run', async () => {
    const store = createInMemoryStore();
    await store.set('wallet', 'the real saved wallet');
    const gate = new HydrationGate(store);

    // This is the mount effect firing with freshWallet().
    const accepted = await gate.write('wallet', 'a default that would clobber it');
    expect(accepted).toBe(false);
    expect(gate.refusedWrites).toBe(1);

    // The loader still sees the REAL value, which was the whole point.
    expect(await gate.read('wallet')).toBe('the real saved wallet');
  });

  it('accepts writes once the gate is open', async () => {
    const store = createInMemoryStore();
    await store.set('wallet', 'old');
    const gate = new HydrationGate(store);
    await gate.read('wallet');
    gate.openAfterLoad();

    expect(await gate.write('wallet', 'new')).toBe(true);
    expect(await store.get('wallet')).toBe('new');
  });

  it('reads are never gated — reading is how the gate gets opened', async () => {
    const store = createInMemoryStore();
    await store.set('k', 'v');
    const gate = new HydrationGate(store);
    expect(gate.isOpen).toBe(false);
    expect(await gate.read('k')).toBe('v');
  });

  it('a failed boot still opens the gate — never-save is not a better bug', async () => {
    const gate = new HydrationGate(createInMemoryStore());
    // The hook opens it in a `finally`, so this is what a thrown boot does.
    gate.openAfterLoad();
    expect(gate.isOpen).toBe(true);
    expect(await gate.write('k', 'v')).toBe(true);
  });

  it('a write that throws is reported, not raised', async () => {
    const store = createInMemoryStore();
    const gate = new HydrationGate({
      ...store,
      set: async () => {
        throw new Error('quota');
      },
    });
    gate.openAfterLoad();
    await expect(gate.write('k', 'v')).resolves.toBe(false);
  });

  it('deleting is never gated — the privacy wipe must always work', async () => {
    const store = createInMemoryStore();
    await store.set('k', 'v');
    const gate = new HydrationGate(store);
    await gate.remove('k');
    expect(await store.get('k')).toBeNull();
  });

  it('the whole launch sequence, in order, keeps the profile', async () => {
    const store = createInMemoryStore();
    await store.set('wallet', JSON.stringify({ coins: 5, owned: ['collar_red'] }));

    // Launch: gate created, mount effect fires with the default, THEN the
    // async loader gets there.
    const gate = new HydrationGate(store);
    await gate.write('wallet', JSON.stringify({ coins: 40, owned: [] })); // refused
    const raw = await gate.read('wallet');
    gate.openAfterLoad();

    expect(JSON.parse(raw!)).toEqual({ coins: 5, owned: ['collar_red'] });
  });
});
