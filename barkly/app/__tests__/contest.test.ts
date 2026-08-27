/**
 * The contest. These tests are mostly about fairness: a rivalry you cannot
 * lose is not a rivalry, and a mini-game a child cannot win is not a game.
 */

import {
  accuracy,
  contestReward,
  CONTEST_ROUNDS,
  freshContest,
  isHit,
  opponentHits,
  playRound,
  roundSpec,
  verdictLine,
} from '../src/game/contest';

const rules = { kind: 'fetch' as const, opponent: 'Duke', rounds: CONTEST_ROUNDS };
// opponentHits() fires when rng() is LOW, so a 0 makes Duke hit every time.
const oppHits = () => 0;
const oppMisses = () => 0.99;

describe('the duel is winnable and losable', () => {
  it('three perfect taps wins it', () => {
    let s = freshContest(rules);
    for (let i = 0; i < CONTEST_ROUNDS; i++) {
      const spec = roundSpec(i, () => 0.5);
      s = playRound(s, spec.target, spec, oppMisses).state;
    }
    expect(s.done).toBe(true);
    expect(s.won).toBe(true);
    expect(verdictLine(s)).toMatch(/Swept it/);
  });

  it('missing every round loses it — you CAN lose', () => {
    let s = freshContest(rules);
    for (let i = 0; i < CONTEST_ROUNDS; i++) {
      const spec = roundSpec(i, () => 0.5);
      // Tap at the far end of the track, nowhere near the zone.
      s = playRound(s, spec.target > 0.5 ? 0 : 1, spec, oppHits).state;
    }
    expect(s.done).toBe(true);
    expect(s.won).toBe(false);
    expect(verdictLine(s)).toMatch(/Duke won/);
  });

  it('a draw goes to the challenger, so there is always an answer', () => {
    let s = freshContest(rules);
    for (let i = 0; i < CONTEST_ROUNDS; i++) {
      const spec = roundSpec(i, () => 0.5);
      s = playRound(s, spec.target, spec, oppHits).state; // both hit every round
    }
    expect(s.you).toBe(0);
    expect(s.them).toBe(0);
    expect(s.won).toBe(true);
  });
});

describe('it gets harder without becoming unfair', () => {
  it('each round is faster than the last', () => {
    const sweeps = [0, 1, 2].map((r) => roundSpec(r, () => 0.5).sweepMs);
    expect(sweeps[1]).toBeLessThan(sweeps[0]);
    expect(sweeps[2]).toBeLessThan(sweeps[1]);
  });

  it('each round is tighter than the last', () => {
    const widths = [0, 1, 2].map((r) => roundSpec(r, () => 0.5).halfWidth);
    expect(widths[1]).toBeLessThan(widths[0]);
    expect(widths[2]).toBeLessThan(widths[1]);
  });

  it('even the hardest round leaves a target a child can hit', () => {
    // A fifth of the track wide, total. Speed is the difficulty, not accuracy.
    expect(roundSpec(2, () => 0.5).halfWidth * 2).toBeGreaterThan(0.18);
  });

  it('the zone never hangs off the end of the track', () => {
    for (const r of [0, 1, 2]) {
      for (const roll of [0, 0.5, 0.999]) {
        const spec = roundSpec(r, () => roll);
        expect(spec.target - spec.halfWidth).toBeGreaterThanOrEqual(0);
        expect(spec.target + spec.halfWidth).toBeLessThanOrEqual(1);
      }
    }
  });

  it('the opponent is good but beatable', () => {
    let hits = 0;
    for (let i = 0; i < 1000; i++) if (opponentHits(0, () => i / 1000)) hits++;
    expect(hits / 1000).toBeGreaterThan(0.4);
    expect(hits / 1000).toBeLessThan(0.75);
  });
});

describe('hit detection', () => {
  it('counts the edge of the zone as a hit', () => {
    const spec = roundSpec(0, () => 0.5);
    expect(isHit(spec.target + spec.halfWidth, spec)).toBe(true);
    expect(isHit(spec.target + spec.halfWidth + 0.01, spec)).toBe(false);
  });

  it('scores dead centre higher than a scrape', () => {
    const spec = roundSpec(0, () => 0.5);
    expect(accuracy(spec.target, spec)).toBe(1);
    expect(accuracy(spec.target + spec.halfWidth * 0.9, spec)).toBeLessThan(0.2);
  });
});

describe('rewards', () => {
  it('winning pays more than losing, but losing still pays', () => {
    const won = contestReward({ ...freshContest(rules), done: true, won: true });
    const lost = contestReward({ ...freshContest(rules), done: true, won: false });
    expect(won.coins).toBeGreaterThan(lost.coins);
    // Turning up and losing is not punished — this is a kids app.
    expect(lost.coins).toBeGreaterThan(0);
  });

  it('an unfinished contest pays nothing', () => {
    expect(contestReward(freshContest(rules))).toEqual({ coins: 0, xp: 0 });
  });
});
