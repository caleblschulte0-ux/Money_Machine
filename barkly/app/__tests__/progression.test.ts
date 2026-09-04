/**
 * The progression spine. These tests are mostly about what the system REFUSES
 * to do, because the failure mode for a kids app is not a crash — it is
 * quietly turning into a slot machine.
 */

import {
  LEVEL_XP,
  SLOT_VERBS,
  STORE,
  Wallet,
  areaUnlocked,
  buy,
  claimDaily,
  consume,
  earn,
  equip,
  equippedItem,
  freshWallet,
  grantCoins,
  grantEverything,
  grantLevel,
  talkWasWorthIt,
  isPlaced,
  levelFor,
  levelProgress,
  placedIn,
  storeFor,
  unlockedAt,
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
  it('everything that already exists is OPEN from the start', () => {
    // Gating the park and the town meant a new player's first session was one
    // room and a shop full of grey rows. That is a wall, not a hook.
    for (const area of ['home', 'park', 'town']) {
      expect(areaUnlocked(area, 0)).toBe(true);
    }
  });

  it('the thing to work towards is somewhere NEW', () => {
    expect(areaUnlocked('beach', 0)).toBe(false);
    expect(areaUnlocked('beach', LEVEL_XP[3])).toBe(true);
  });

  it('an unknown area is not accidentally locked', () => {
    expect(areaUnlocked('somewhere-nobody-built-yet', 0)).toBe(true);
  });

  it('every level-up has something to show for it', () => {
    // A level that unlocks nothing is a number going up, which is not a
    // reason to open an app.
    for (let level = 2; level <= 7; level++) {
      expect(unlockedAt(level).length).toBeGreaterThan(0);
    }
  });

  it('what unlocks is announced in his voice', () => {
    const beach = unlockedAt(4).find((u) => u.id === 'beach');
    expect(beach?.line).toMatch(/BEACH/);
  });
});

describe('dev mode never locks the builder out of his own app', () => {
  it('opens every area regardless of level', () => {
    expect(areaUnlocked('beach', 0)).toBe(false);
    expect(areaUnlocked('beach', 0, true)).toBe(true);
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

describe('the house holds more than one thing at a time', () => {
  it('a bed and a rug and a window are not alternatives to each other', () => {
    let w = rich();
    for (const id of ['home_bed', 'home_rug', 'home_window']) {
      w = buy(w, id).wallet;
    }
    expect(placedIn(w, 'home').map((i) => i.id).sort()).toEqual([
      'home_bed',
      'home_rug',
      'home_window',
    ]);
  });

  it('but he still wears exactly ONE collar', () => {
    let w = buy(rich(), 'collar_red').wallet;
    w = buy(w, 'collar_blue').wallet;
    expect(placedIn(w, 'collar').map((i) => i.id)).toEqual(['collar_blue']);
  });

  it('a house item can be put away and put back', () => {
    let w = buy(rich(), 'home_rug').wallet;
    expect(isPlaced(w, 'home_rug')).toBe(true);
    w = equip(w, 'home_rug');
    expect(isPlaced(w, 'home_rug')).toBe(false); // still owned, just not out
    expect(w.owned).toContain('home_rug');
    w = equip(w, 'home_rug');
    expect(isPlaced(w, 'home_rug')).toBe(true);
  });

  it('a bought house item is OUT immediately - nobody buys a rug to roll it up', () => {
    const w = buy(rich(), 'home_bed').wallet;
    expect(isPlaced(w, 'home_bed')).toBe(true);
  });

  it('give-me-everything also puts something ON him', () => {
    // Owning a ball he is not holding leaves the play button behaving exactly
    // as it did before, which makes the grant look broken.
    const w = grantEverything(freshWallet());
    expect(equippedItem(w, 'toy')).toBeDefined();
    expect(equippedItem(w, 'collar')).toBeDefined();
  });

  it('does not swap out something he is already wearing', () => {
    const chosen = buy(rich(), 'collar_blue').wallet;
    expect(equippedItem(grantEverything(chosen), 'collar')?.id).toBe('collar_blue');
  });

  it('give-me-everything furnishes the whole room', () => {
    const w = grantEverything(freshWallet());
    expect(placedIn(w, 'home').length).toBe(
      STORE.filter((i) => i.slot === 'home').length,
    );
  });
});

/**
 * Taking things off. Buying a collar used to be a one-way door: `equip` only
 * ever SET the slot, so once he had one on he wore one forever and tapping the
 * one he was wearing was a dead tap that flashed "Red collar on."
 */
describe('equip is a toggle, not a one-way door', () => {
  const owning = (...ids: string[]): Wallet => ({
    ...freshWallet(),
    coins: 9999,
    xp: 5000,
    owned: [...ids],
  });

  it('tapping the collar he is wearing takes it off', () => {
    let w = equip(owning('collar_red'), 'collar_red');
    expect(w.equipped.collar).toBe('collar_red');
    w = equip(w, 'collar_red');
    expect(w.equipped.collar).toBeUndefined();
    expect(isPlaced(w, 'collar_red')).toBe(false);
    // and he still owns it
    expect(w.owned).toContain('collar_red');
  });

  it('a different collar swaps rather than stacking', () => {
    let w = equip(owning('collar_red', 'collar_blue'), 'collar_red');
    w = equip(w, 'collar_blue');
    expect(w.equipped.collar).toBe('collar_blue');
    expect(isPlaced(w, 'collar_red')).toBe(false);
  });

  it('the same for a toy', () => {
    let w = equip(owning('toy_ball'), 'toy_ball');
    expect(isPlaced(w, 'toy_ball')).toBe(true);
    w = equip(w, 'toy_ball');
    expect(isPlaced(w, 'toy_ball')).toBe(false);
  });

  it('house items still toggle in and out of the room', () => {
    let w = equip(owning('home_bed'), 'home_bed');
    expect(isPlaced(w, 'home_bed')).toBe(true);
    w = equip(w, 'home_bed');
    expect(isPlaced(w, 'home_bed')).toBe(false);
    w = equip(w, 'home_bed');
    expect(isPlaced(w, 'home_bed')).toBe(true);
  });

  it('you cannot equip what you do not own', () => {
    const w = equip(freshWallet(), 'collar_gold');
    expect(w.equipped.collar).toBeUndefined();
  });
});

describe('every slot has words that fit the thing', () => {
  it('nothing offers to let you WEAR A BED', () => {
    for (const slot of ['collar', 'toy', 'home', 'treat'] as const) {
      const v = SLOT_VERBS[slot];
      expect(v.on.length).toBeGreaterThan(0);
      expect(v.off.length).toBeGreaterThan(0);
      expect(v.onState.length).toBeGreaterThan(0);
      expect(v.offState.length).toBeGreaterThan(0);
    }
    expect(SLOT_VERBS.home.on).not.toMatch(/wear/i);
    expect(SLOT_VERBS.home.onState).not.toMatch(/worn/i);
    expect(SLOT_VERBS.collar.on).toMatch(/put on/i);
  });

  it('covers every slot in the store, so no item can fall through', () => {
    for (const item of STORE) expect(SLOT_VERBS[item.slot]).toBeDefined();
  });
});

describe('talking is rewarded, pressing the same key is not', () => {
  // `earn`'s anti-farming rule is stated in its own doc comment — a useless
  // repeat earns nothing — and TALK was the one caller that never invoked it.
  // Every message credited 6 XP unconditionally and level 2 is 40 XP, so seven
  // presses of the same key levelled you up. The number that inflates is the
  // one the Pack Book reads as history.
  it('counts a real turn, however short', () => {
    expect(talkWasWorthIt('yes', [])).toBe(true);
    expect(talkWasWorthIt('hi', [])).toBe(true);
    expect(talkWasWorthIt('my favorite food is pizza', [])).toBe(true);
    // Nonsense is play, not farming. He has an answer for it.
    expect(talkWasWorthIt('blorp', [])).toBe(true);
  });

  it('refuses the same thing said again', () => {
    expect(talkWasWorthIt('hi', ['hi'])).toBe(false);
    expect(talkWasWorthIt('HI!!', ['hi'])).toBe(false);
    expect(talkWasWorthIt('  hi  ', ['something else', 'hi'])).toBe(false);
    // Only the last three, so a running joke can come back around.
    expect(talkWasWorthIt('hi', ['hi', 'a thing', 'another', 'and another'])).toBe(true);
  });

  it('refuses something with no word in it', () => {
    expect(talkWasWorthIt('', [])).toBe(false);
    expect(talkWasWorthIt('   ', [])).toBe(false);
    expect(talkWasWorthIt('!!!', [])).toBe(false);
    expect(talkWasWorthIt('a b c d', [])).toBe(false);
    expect(talkWasWorthIt('7', [])).toBe(false);
  });

  it('closes the farm: the same key seven times does not reach level 2', () => {
    let w = freshWallet();
    const recent: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      const useful = talkWasWorthIt('a', recent);
      w = earn(w, 'talk', useful).wallet;
      recent.push('a');
    }
    expect(levelFor(w.xp)).toBe(1);
    expect(w.coins).toBe(freshWallet().coins);
  });
});
