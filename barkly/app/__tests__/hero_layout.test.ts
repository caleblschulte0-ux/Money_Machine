import {
  PLACES_HEIGHT,
  STATUS_HEIGHT,
  interactionRailWidth,
  layoutMode,
  navRailWidth,
  TAP_MIN,
  spriteScale,
  stageHeight,
  stageWidth,
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

  it('classifies four responsive layout modes', () => {
    expect(layoutMode(390, 844)).toBe('narrowPortrait');
    expect(layoutMode(768, 1024)).toBe('widePortrait');
    expect(layoutMode(844, 390)).toBe('phoneLandscape');
    expect(layoutMode(1024, 768)).toBe('tabletLandscape');
  });

  it('uses tablet width for world rather than inflating Barkly', () => {
    const mode = layoutMode(1024, 768);
    const width = stageWidth(1024, mode);
    const scale = spriteScale(768, width, mode);
    expect(width).toBeLessThan(1024 * 0.7);
    expect(scale).toBeLessThanOrEqual(1.25);
  });

  it('reserves real side rails in landscape', () => {
    const mode = layoutMode(844, 390);
    expect(navRailWidth(mode)).toBeGreaterThanOrEqual(80);
    expect(interactionRailWidth(mode)).toBeGreaterThanOrEqual(220);
    expect(stageHeight(390, mode)).toBeGreaterThan(280);
  });

  it('gives idle portrait space back to the world', () => {
    const active = stageHeight(844, 'narrowPortrait', true);
    const idle = stageHeight(844, 'narrowPortrait', false);
    expect(idle - active).toBeGreaterThanOrEqual(45);
    expect(idle).toBeGreaterThan(650);
  });

});
