import {
  PLACES_HEIGHT,
  STATUS_HEIGHT,
  TAP_MIN,
  spriteScale,
  stageHeight,
} from '../src/ui/layout';

describe('hero-first phone composition', () => {
  it('lets Barkly dominate a normal modern phone', () => {
    const scale = spriteScale(844, 390);
    const renderedBodyWidth = 244 * scale;

    expect(scale).toBeGreaterThanOrEqual(1.25);
    expect(renderedBodyWidth / 390).toBeGreaterThanOrEqual(0.78);
  });

  it('stays conservative on a browser-chrome-short phone', () => {
    const scale = spriteScale(640, 360);

    expect(scale).toBeGreaterThanOrEqual(0.6);
    expect(scale).toBeLessThanOrEqual(0.75);
    expect(stageHeight(640)).toBeGreaterThanOrEqual(212);
  });

  it('does not buy hero scale by shrinking child-sized controls', () => {
    expect(TAP_MIN).toBeGreaterThanOrEqual(44);
    expect(STATUS_HEIGHT).toBeGreaterThanOrEqual(TAP_MIN);
    expect(PLACES_HEIGHT).toBeGreaterThanOrEqual(TAP_MIN);
  });
});
