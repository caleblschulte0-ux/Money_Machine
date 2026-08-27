/**
 * Escalation. The rule under test is "taps build pressure, moments promote" —
 * you cannot tap your way to a nemesis, and every promotion lands on a beat
 * the player played through.
 */

import {
  applyContact,
  FRIEND_LADDER,
  ladderProgress,
  pressureCeiling,
  promotionBetween,
  RIVAL_LADDER,
  rungAt,
  rungIndex,
} from '../src/barkly/escalation';

describe('the ladders are well formed', () => {
  for (const [name, ladder] of [['rival', RIVAL_LADDER], ['friend', FRIEND_LADDER]] as const) {
    it(`${name}: thresholds ascend and every rung has a moment`, () => {
      expect(ladder[0].at).toBe(0);
      for (let i = 1; i < ladder.length; i++) expect(ladder[i].at).toBeGreaterThan(ladder[i - 1].at);
      for (const rung of ladder) {
        expect(rung.label.length).toBeGreaterThan(0);
        expect(rung.blurb.length).toBeGreaterThan(0);
        // A rung with no headline and no line is an invisible promotion,
        // which is the exact bug this module exists to fix.
        expect(rung.headline).toContain('%s');
        expect(rung.line.length).toBeGreaterThan(10);
      }
    });
  }

  it('keeps the labels the rest of the app already says', () => {
    expect(rungAt('friend', 6).label).toBe('best friend');
    expect(rungAt('rival', 6).label).toBe('nemesis');
    expect(rungAt('rival', 0).label).toBe('annoying dog');
    expect(rungAt('rival', 99).label).toBe('generational feud');
  });
});

describe('casual contact builds pressure but never promotes', () => {
  it('twenty taps stall one short of the next rung', () => {
    let n = 0;
    for (let i = 0; i < 20; i++) {
      const r = applyContact('Duke', 'rival', n, { promotes: false });
      expect(r.promotion).toBeNull();
      n = r.encounters;
    }
    expect(n).toBe(2);
    expect(rungIndex('rival', n)).toBe(0);
  });

  it('reports that it held, so the caller could say so if it wanted', () => {
    expect(applyContact('Duke', 'rival', 1, { promotes: false }).held).toBe(false);
    expect(applyContact('Duke', 'rival', 2, { promotes: false }).held).toBe(true);
  });

  it('the ceiling is always one below the next rung', () => {
    expect(pressureCeiling('rival', 0)).toBe(2);
    expect(pressureCeiling('rival', 3)).toBe(5);
    expect(pressureCeiling('rival', 6)).toBe(11);
    expect(pressureCeiling('rival', 12)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('a played-through moment promotes, and says so', () => {
  it('crossing a rung returns the announcement with the name filled in', () => {
    const promo = applyContact('Duke', 'rival', 2, { promotes: true, delta: 1 }).promotion;
    expect(promo).not.toBeNull();
    expect(promo!.headline).toContain('Duke');
    expect(promo!.headline).not.toContain('%s');
    expect(promo!.fromLabel).toBe('annoying dog');
    expect(promo!.toLabel).toBe('official rival');
    expect(promo!.line.length).toBeGreaterThan(10);
  });

  it('a moment that does not cross a rung announces nothing', () => {
    expect(applyContact('Duke', 'rival', 0, { promotes: true, delta: 1 }).promotion).toBeNull();
  });

  it('a big delta still only announces the rung it landed on', () => {
    const promo = promotionBetween('Duke', 'rival', 0, 7);
    expect(promo!.toLabel).toBe('nemesis');
    expect(promo!.fromLabel).toBe('annoying dog');
  });

  it('cooling a relationship never announces a promotion', () => {
    const r = applyContact('Duke', 'rival', 4, { promotes: true, delta: -2 });
    expect(r.encounters).toBe(2);
    expect(r.promotion).toBeNull();
  });

  it('a count can never go negative', () => {
    expect(applyContact('Duke', 'rival', 1, { promotes: true, delta: -50 }).encounters).toBe(0);
  });
});

describe('the meter shows the next rung coming', () => {
  it('reads out how far there is left to go', () => {
    const p = ladderProgress('rival', 1);
    expect(p.stage.label).toBe('annoying dog');
    expect(p.nextLabel).toBe('official rival');
    expect(p.remaining).toBe(2);
    expect(p.hint).toBe('2 more incidents to official rival.');
  });

  it('uses the right noun and singular for a friendship one away', () => {
    expect(ladderProgress('friend', 2).hint).toBe('1 more hangout to actual buddy.');
  });

  it('fills from 0 to 1 across a rung and never overflows', () => {
    expect(ladderProgress('rival', 0).fraction).toBe(0);
    expect(ladderProgress('rival', 3).fraction).toBe(0);
    expect(ladderProgress('rival', 5).fraction).toBeCloseTo(2 / 3);
    expect(ladderProgress('rival', 999).fraction).toBe(1);
  });

  it('the top rung says so instead of promising a next one', () => {
    const p = ladderProgress('friend', 40);
    expect(p.nextLabel).toBeUndefined();
    expect(p.remaining).toBe(0);
    expect(p.hint).not.toContain('more');
  });

  it('at the pressure ceiling it says the next rung is ready', () => {
    // 3 is the first rung of "official rival"; nemesis is 6, so three to go.
    expect(ladderProgress('rival', 3).hint).toBe('3 more incidents to nemesis.');
    // A tap-stalled relationship sits one short, which is the cue to go play
    // the encounter rather than tap again.
    expect(ladderProgress('rival', 2).hint).toBe('1 more incident to official rival.');
  });
});
