import {
  baselineState,
  decayStats,
  DEFAULT_STATS,
  freshSnapshot,
  reduce,
  settleDelayMs,
} from '../src/barkley/state';
import { BarkleySnapshot } from '../src/barkley/types';

const snap = (over: Partial<BarkleySnapshot> = {}): BarkleySnapshot => ({
  ...freshSnapshot(0),
  ...over,
});

describe('talk flow transitions', () => {
  it('walks listening → thinking → speaking → baseline', () => {
    let s = snap();
    s = reduce(s, { type: 'TALK_START' });
    expect(s.state).toBe('listening');
    s = reduce(s, { type: 'TALK_CAPTURED' });
    expect(s.state).toBe('thinking');
    s = reduce(s, { type: 'SPEAK_START' });
    expect(s.state).toBe('speaking');
    s = reduce(s, { type: 'SPEAK_END' });
    expect(s.state).toBe('idle');
  });

  it('talking builds affection', () => {
    const before = snap({ state: 'speaking' });
    const after = reduce(before, { type: 'SPEAK_END' });
    expect(after.stats.affection).toBeGreaterThan(before.stats.affection);
  });

  it('a failed talk returns to baseline, not a stuck state', () => {
    const s = reduce(snap({ state: 'listening' }), { type: 'TALK_FAILED' });
    expect(s.state).toBe('idle');
  });
});

describe('virtual pet interactions', () => {
  it('FEED reduces hunger and enters eating', () => {
    const before = snap();
    const after = reduce(before, { type: 'FEED' });
    expect(after.state).toBe('eating');
    expect(after.stats.hunger).toBeLessThan(before.stats.hunger);
  });

  it('FEED while already eating is a no-op (no spam feeding)', () => {
    const eating = reduce(snap(), { type: 'FEED' });
    expect(reduce(eating, { type: 'FEED' })).toBe(eating);
  });

  it('PLAY costs energy, lifts mood', () => {
    const before = snap();
    const after = reduce(before, { type: 'PLAY' });
    expect(after.state).toBe('playing');
    expect(after.stats.energy).toBeLessThan(before.stats.energy);
    expect(after.stats.mood).toBeGreaterThan(before.stats.mood);
  });

  it('an exhausted Barkley refuses to play', () => {
    const tired = snap({ stats: { ...DEFAULT_STATS, energy: 5 } });
    const after = reduce(tired, { type: 'PLAY' });
    expect(after.state).toBe('sleepy');
  });

  it('SLEEP_TOGGLE naps and waking restores energy', () => {
    const napping = reduce(snap(), { type: 'SLEEP_TOGGLE' });
    expect(napping.state).toBe('sleepy');
    const awake = reduce(napping, { type: 'SLEEP_TOGGLE' });
    expect(awake.stats.energy).toBeGreaterThan(napping.stats.energy);
  });
});

describe('stat decay and baseline', () => {
  it('hours away make him hungrier and grumpier', () => {
    const decayed = decayStats(DEFAULT_STATS, 10 * 3_600_000);
    expect(decayed.hunger).toBeGreaterThan(DEFAULT_STATS.hunger);
    expect(decayed.mood).toBeLessThan(DEFAULT_STATS.mood);
  });

  it('decay is capped — a month away does not zero him out', () => {
    const decayed = decayStats(DEFAULT_STATS, 30 * 24 * 3_600_000);
    expect(decayed.mood).toBeGreaterThan(0);
    expect(decayed.hunger).toBeLessThanOrEqual(100);
  });

  it('needs override idle baseline', () => {
    expect(baselineState({ ...DEFAULT_STATS, energy: 10 })).toBe('sleepy');
    expect(baselineState({ ...DEFAULT_STATS, hunger: 90 })).toBe('hungry');
    expect(baselineState(DEFAULT_STATS)).toBe('idle');
  });

  it('TICK applies elapsed time and re-derives posture', () => {
    const s = snap({ updatedAt: 0 });
    const after = reduce(s, { type: 'TICK', now: 20 * 3_600_000 });
    expect(after.stats.hunger).toBeGreaterThan(s.stats.hunger);
    expect(after.updatedAt).toBe(20 * 3_600_000);
  });
});

describe('transient beats', () => {
  it('REACTION then SETTLE returns to baseline', () => {
    let s = reduce(snap(), { type: 'REACTION', state: 'excited' });
    expect(s.state).toBe('excited');
    expect(settleDelayMs('excited')).toBeGreaterThan(0);
    s = reduce(s, { type: 'SETTLE' });
    expect(s.state).toBe('idle');
  });

  it('SETTLE never interrupts a conversation state', () => {
    const s = reduce(snap({ state: 'thinking' }), { type: 'SETTLE' });
    expect(s.state).toBe('thinking');
  });
});
