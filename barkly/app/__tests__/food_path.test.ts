/**
 * The food path, end to end at the data layer.
 *
 * This exists because ChatGPT shipped `feed(itemId)` and a FoodSheet that
 * nothing imported, so you could buy cheese and never eat it. The capability
 * was real and unreachable, which is the same as not having it.
 */

import { buy, consume, freshWallet } from '../src/game/progression';

describe('bought food can actually be eaten', () => {
  it('a purchased treat lands in the cupboard and can be taken out again', () => {
    // Biscuits are the level-1 treat, i.e. the one a new player can actually
    // reach. Cheese is level 2 and is correctly refused before then.
    const bought = buy({ ...freshWallet(), coins: 500 }, 'treat_biscuit');
    expect(bought.ok).toBe(true);
    expect(bought.wallet.pantry.treat_biscuit).toBe(1);

    const after = consume(bought.wallet, 'treat_biscuit');
    expect(after).not.toBeNull();
    expect(after!.pantry.treat_biscuit).toBeUndefined();
  });

  it('a treat above your level is refused before it reaches the cupboard', () => {
    const early = buy({ ...freshWallet(), coins: 500 }, 'treat_cheese');
    expect(early.ok).toBe(false);
    expect(early.wallet.pantry.treat_cheese).toBeUndefined();
  });

  it('eating something you do not have is refused, not silently faked', () => {
    expect(consume(freshWallet(), 'treat_steak')).toBeNull();
  });

  it('every treat in the shop is a treat you can actually consume', () => {
    // Guards against a treat being added to the store with no pantry path.
    let w = { ...freshWallet(), coins: 99999, xp: 99999 };
    for (const id of ['treat_biscuit', 'treat_cheese', 'treat_steak']) {
      w = buy(w, id, true).wallet;
      expect(w.pantry[id]).toBeGreaterThan(0);
      const eaten = consume(w, id);
      expect(eaten).not.toBeNull();
      w = eaten!;
    }
  });
});
