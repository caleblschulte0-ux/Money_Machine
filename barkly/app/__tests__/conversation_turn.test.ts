import {
  PLAYER_FLOOR_GRACE_MS,
  autonomousSpeechAllowed,
  nextPlayerFloorUntil,
} from '../src/barkly/conversationTurn';

describe('conversation turn arbitration', () => {
  it('gives an explicit player action a real quiet window', () => {
    const now = 10_000;
    expect(nextPlayerFloorUntil(now)).toBe(now + PLAYER_FLOOR_GRACE_MS);
    expect(PLAYER_FLOOR_GRACE_MS).toBeGreaterThanOrEqual(20_000);
  });

  it('never lets autonomous speech talk over a held conversation', () => {
    expect(autonomousSpeechAllowed(100_000, 0, true)).toBe(false);
  });

  it('does not let autonomous chatter immediately steal the floor back', () => {
    const until = nextPlayerFloorUntil(1_000);
    expect(autonomousSpeechAllowed(until - 1, until, false)).toBe(false);
    expect(autonomousSpeechAllowed(until, until, false)).toBe(true);
  });
});
