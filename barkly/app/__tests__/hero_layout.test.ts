import {
  CARE_DOCK_CLEARANCE,
  CARE_DOCK_HEIGHT,
  CARE_DOCK_OVERLAP,
  INTERACTION_GUTTER,
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
import { worldScale } from '../src/ui/scenes/WorldScene';

describe('hero-first phone composition', () => {
  /*
   * These bounds used to read >= 0.70 of the screen width, and measured on a
   * real 390x844 build he came out 342px wide -- 88% of the frame with 24px of
   * air either side. That is not dominance, that is the dog covering the room:
   * the authored world could only ever appear in the margins, and the other
   * dogs read as a scale error rather than as distance. The camera pulled back
   * so he occupies about two thirds of the frame. He is still far and away the
   * largest thing on screen; the room now exists around him.
   */
  it('keeps Barkly dominant without swallowing the authored world on a modern phone', () => {
    const scale = spriteScale(844, 390);
    const renderedBodyWidth = 244 * scale;

    expect(scale).toBeGreaterThanOrEqual(0.84);
    expect(scale).toBeLessThanOrEqual(0.88);
    // Dominant, but with real room either side of him.
    expect(renderedBodyWidth / 390).toBeGreaterThanOrEqual(0.50);
    expect(renderedBodyWidth / 390).toBeLessThanOrEqual(0.58);
  });

  it('keeps Barkly substantial on a browser-chrome-short phone', () => {
    const scale = spriteScale(640, 360);

    expect(scale).toBeGreaterThanOrEqual(0.82);
    expect(scale).toBeLessThanOrEqual(0.9);
    expect(stageHeight(640)).toBeGreaterThanOrEqual(212);
  });

  it('does not collapse Barkly on the most compressed supported phone', () => {
    expect(spriteScale(568, 360)).toBeGreaterThanOrEqual(0.76);
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

  it('keeps Barkly and the authored world on one tablet camera', () => {
    const mode = layoutMode(1024, 768);
    const width = stageWidth(1024, mode);
    const scale = spriteScale(768, width, mode);
    expect(width).toBeLessThan(1024 * 0.7);
    expect(scale).toBeGreaterThanOrEqual(1.06);
    expect(scale).toBeLessThanOrEqual(1.12);
    // The point of the rule, unchanged: one camera. Barkly and the world must
    // stay in the same scale family, whichever way the numbers are tuned.
    expect(Math.abs(scale - worldScale(1024, 768))).toBeLessThanOrEqual(0.32);
  });

  it('reveals more world on tall tablets instead of turning Barkly into a poster', () => {
    const mode = layoutMode(768, 1024);
    const scale = spriteScale(1024, stageWidth(768, mode), mode, true);
    expect(scale).toBeGreaterThanOrEqual(1.06);
    expect(scale).toBeLessThanOrEqual(1.12);
    // A tall tablet reveals MORE world than the dog grows: the gap between the
    // two scales opens in the world's favour, never the other way.
    expect(worldScale(768, 1024)).toBeGreaterThanOrEqual(scale);
  });

  it('reserves real side rails in landscape', () => {
    const mode = layoutMode(844, 390);
    expect(navRailWidth(mode)).toBeGreaterThanOrEqual(80);
    expect(interactionRailWidth(mode)).toBeGreaterThanOrEqual(220);
    expect(stageHeight(390, mode)).toBeGreaterThan(280);
  });

  /*
   * This test used to assert the OPPOSITE -- that the idle stage is at least
   * 45px taller than the speaking stage, "giving idle portrait space back to
   * the world". That was a deliberate decision and it is being reversed on
   * real-device evidence, so the reasoning is worth recording rather than
   * silently flipping.
   *
   * Because spriteScale and groundY are both derived from stage height, a
   * stage that grows at idle means Barkly CHANGES SIZE and the ground moves
   * under him every time a speech bubble opens and closes. In a screenshot
   * that is invisible. On an actual phone -- where Safari's bottom bar has
   * already taken ~90px -- it reads as the entire scene lurching whenever he
   * talks, which is the single most-reported spacing complaint.
   *
   * Reserving the worst case costs a few tens of pixels of world at idle and
   * buys a composition that never moves. A speech bubble is not a layout
   * event.
   */
  it('never resizes the world when Barkly speaks', () => {
    const speaking = stageHeight(844, 'narrowPortrait', true);
    const idle = stageHeight(844, 'narrowPortrait', false);
    expect(idle).toBe(speaking);
    expect(idle).toBeGreaterThan(600);

    // ...and therefore he does not change size, and the ground stays put.
    expect(spriteScale(844, 390, 'narrowPortrait', false)).toBe(
      spriteScale(844, 390, 'narrowPortrait', true),
    );
  });

  it('uses the care dock as a controlled foreground overlap', () => {
    expect(CARE_DOCK_HEIGHT).toBeGreaterThanOrEqual(TAP_MIN + 12);
    expect(CARE_DOCK_OVERLAP).toBeGreaterThanOrEqual(10);
    expect(CARE_DOCK_OVERLAP).toBeLessThanOrEqual(20);
    expect(CARE_DOCK_CLEARANCE).toBe(CARE_DOCK_HEIGHT - CARE_DOCK_OVERLAP);
  });

  it('uses one meaningful lower-third gutter instead of edge-hugging magic numbers', () => {
    expect(INTERACTION_GUTTER).toBeGreaterThanOrEqual(12);
    expect(INTERACTION_GUTTER).toBeLessThanOrEqual(20);
  });
});
