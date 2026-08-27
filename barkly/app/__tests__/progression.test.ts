/**
 * The progression spine. These tests are mostly about what the system REFUSES
 * to do, because the failure mode for a kids app is not a crash — it is
 * quietly turning into a slot machine.
 */

import {
  areaUnlocked,
  grantCoins,
  grantEverything,
  grantLevel,
  buy,
  claimDaily,
  consume,
  earn,
  equip,
  equippedItem,
  freshWallet,
  LEVEL_XP,
  levelFor,
  levelProgress,
  STORE,
  storeFor,
  unlockedAt,
  Wallet,
} from '../src/game/progression';

const rich = (over: Partial<Wallet> = {}): Wallet => ({
  ...freshWallet(),
  coins: 5000,
  xp: 5000,
  ...over,
});

describe('earning is for caring for him', () => {
  it('pays for real interactions', () => {
    const { wallet, gained } = earn(freshWallet(), 'talk');
    expect(gained.coins).toBeGreaterThan(0);
    expect(wallet.xp).toBeGreaterThan(0);
  });

  it('pays NOTHING for an action that did nothing for him', () => {
    // Feeding a dog who is already full is farming a button, not care.
    const start = freshWallet();
    const { wallet, gained } = earn(start, 'feed', false);
    expect(gained).toEqual({ coins: 0, xp: 0 });
    expect(wallet.coins).toBe(start.coins);
    expect(wallet.xp).toBe(start.xp);
  });

  it('rewards effort in proportion — digging beats tapping', () => {
    const talk = earn(freshWallet(), 'talk').gained;
    const dig = earn(freshWallet(), 'dig').gained;
    expect(dig.coins).toBeGreaterThan(talk.coins);
    expect(dig.xp).toBeGreaterThan(talk.xp);
  });

  it('the daily bonus pays once a day, not once a tap', () => {
    const day1 = 1_700_000_000_000;
    const first = claimDaily(freshWallet(), day1);
    expect(first.claimed).toBe(true);
    const again = claimDaily(first.wallet, day1 + 3600_000);
    expect(again.claimed).toBe(false);
    expect(again.wallet.coins).toBe(first.wallet.coins);
    const tomorrow = claimDaily(first.wallet, day1 + 30 * 3600_000);
    expect(tomorrow.claimed).toBe(true);
  });

  it('announces a level-up so it is a moment, not a number changing', () => {
    let wallet = freshWallet();
    let announced: number | undefined;
    for (let i = 0; i < 12 && !announced; i++) {
      const r = earn(wallet, 'dig');
      wallet = r.wallet;
      announced = r.leveledTo;
    }
    expect(announced).toBe(2);
  });
});

describe('levels', () => {
  it('the first level-up lands fast enough to be seen in one session', () => {
    // Roughly two digs. If the first unlock is an hour away, nobody sees it.
    const twoDigs = earn(earn(freshWallet(), 'dig').wallet, 'dig');
    expect(levelFor(twoDigs.wallet.xp)).toBeGreaterThanOrEqual(2);
  });

  it('thresholds only ever go up', () => {
    for (let i = 1; i < LEVEL_XP.length; i++) {
      expect(LEVEL_XP[i]).toBeGreaterThan(LEVEL_XP[i - 1]);
    }
  });

  it('reports progress through the current level, never out of bounds', () => {
    for (const xp of [0, 39, 40, 500, 3400, 99_999]) {
      const p = levelProgress(xp);
      expect(p.frac).toBeGreaterThanOrEqual(0);
      expect(p.frac).toBeLessThanOrEqual(1);
      expect(p.need).toBeGreaterThan(0);
      expect(p.level).toBe(levelFor(xp));
    }
  });
});

describe('the store', () => {
  it('every price is payable by playing — nothing reads a wallet', () => {
    for (const item of STORE) {
      expect(item.price).toBeGreaterThan(0);
      // The dearest thing is reachable in a few weeks of ordinary play, not a
      // purchase. If this ever fails, someone has added a pay-gate.
      expect(item.price).toBeLessThanOrEqual(500);
    }
  });

  it('shows locked items rather than hiding them — the lock IS the goal', () => {
    const shelf = storeFor(1);
    expect(shelf.length).toBe(STORE.length);
    expect(shelf.some((s) => s.locked)).toBe(true);
  });

  it('refuses a purchase above your level, in his voice', () => {
    const result = buy({ ...freshWallet(), coins: 9999 }, 'collar_gold');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('locked');
    expect(result.line).toMatch(/level/i);
  });

  it('refuses a purchase you cannot afford, and says the numbers', () => {
    const result = buy({ ...freshWallet(), coins: 5 }, 'collar_red');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('too_expensive');
    expect(result.line).toContain('60');
    expect(result.line).toContain('5');
  });

  it('never charges you twice for the same permanent thing', () => {
    const first = buy(rich(), 'collar_red');
    expect(first.ok).toBe(true);
    const second = buy(first.wallet, 'collar_red');
    expect(second.ok).toBe(false);
    expect(second.reason).toBe('already_owned');
    expect(second.wallet.coins).toBe(first.wallet.coins);
  });

  it('a bought collar goes straight on — nobody buys one for the drawer', () => {
    const { wallet } = buy(rich(), 'collar_blue');
    expect(equippedItem(wallet, 'collar')?.id).toBe('collar_blue');
  });

  it('food stacks in the cupboard and is used up', () => {
    let wallet = buy(rich(), 'treat_cheese').wallet;
    wallet = buy(wallet, 'treat_cheese').wallet;
    expect(wallet.pantry.treat_cheese).toBe(2);

    wallet = consume(wallet, 'treat_cheese')!;
    expect(wallet.pantry.treat_cheese).toBe(1);
    wallet = consume(wallet, 'treat_cheese')!;
    expect(wallet.pantry.treat_cheese).toBeUndefined();
    expect(consume(wallet, 'treat_cheese')).toBeNull();
  });

  it('cannot equip something you do not own', () => {
    const wallet = freshWallet();
    expect(equip(wallet, 'collar_gold').equipped.collar).toBeUndefined();
  });

  it('spends exactly the price and no more', () => {
    const before = rich({ coins: 100 });
    const after = buy(before, 'collar_red').wallet;
    expect(after.coins).toBe(40);
  });
});

describe('unlocks are places, not percentages', () => {
  it('home is always open; the park and town are earned', () => {
    expect(areaUnlocked('home', 0)).toBe(true);
    expect(areaUnlocked('park', 0)).toBe(false);
    expect(areaUnlocked('town', 0)).toBe(false);
    expect(areaUnlocked('park', LEVEL_XP[1])).toBe(true);
    expect(areaUnlocked('town', LEVEL_XP[3])).toBe(true);
  });

  it('an unknown area is not accidentally locked', () => {
    expect(areaUnlocked('beach', 0)).toBe(true);
  });

  it('every level-up has something to show for it', () => {
    // A level that unlocks nothing is a number going up, which is not a
    // reason to open an app.
    for (let level = 2; level <= 7; level++) {
      expect(unlockedAt(level).length).toBeGreaterThan(0);
    }
  });

  it('what unlocks is announced in his voice', () => {
    const park = unlockedAt(2).find((u) => u.id === 'park');
    expect(park?.line).toMatch(/BIRDS/);
  });
});

describe('dev mode never locks the builder out of his own app', () => {
  it('opens every area regardless of level', () => {
    expect(areaUnlocked('town', 0)).toBe(false);
    expect(areaUnlocked('town', 0, true)).toBe(true);
  });

  it('unlocks the whole shelf', () => {
    expect(storeFor(1).some((s) => s.locked)).toBe(true);
    expect(storeFor(1, true).every((s) => !s.locked)).toBe(true);
  });

  it('buys a level-gated item you could not otherwise touch', () => {
    const broke = { ...freshWallet(), coins: 0 };
    expect(buy(broke, 'collar_gold').ok).toBe(false);
    const dev = buy(broke, 'collar_gold', true);
    expect(dev.ok).toBe(true);
    expect(dev.wallet.owned).toContain('collar_gold');
  });

  it('never pushes the wallet negative', () => {
    const broke = { ...freshWallet(), coins: 0 };
    expect(buy(broke, 'collar_gold', true).wallet.coins).toBe(0);
  });

  it('is a bypass on the GATES, not fabricated progress', () => {
    // The XP is untouched, so switching dev mode off leaves you exactly where
    // you were rather than stranding you at a level you did not earn.
    const before = freshWallet();
    const after = buy(before, 'collar_gold', true).wallet;
    expect(after.xp).toBe(before.xp);
    expect(levelFor(after.xp)).toBe(levelFor(before.xp));
  });

  it('grants top up rather than overwrite', () => {
    const w = grantCoins({ ...freshWallet(), coins: 10 }, 1000);
    expect(w.coins).toBe(1010);
    expect(grantCoins(w, -99999).coins).toBe(0); // never negative
  });

  it('a level grant only ever moves you forward', () => {
    const high = { ...freshWallet(), xp: LEVEL_XP[8] };
    expect(grantLevel(high, 2).xp).toBe(high.xp);
    expect(levelFor(grantLevel(freshWallet(), 7).xp)).toBe(7);
  });

  it('give-me-everything hands over one of each, keeping what you had', () => {
    const w = grantEverything({ ...freshWallet(), pantry: { treat_biscuit: 9 } });
    expect(w.owned).toContain('home_window');
    expect(w.owned).toContain('collar_gold');
    expect(w.pantry.treat_biscuit).toBe(9); // not clobbered down to the default
    expect(w.pantry.treat_steak).toBeGreaterThan(0);
  });
});
