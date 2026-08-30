/**
 * Phone-first screen geometry for Barkly.
 *
 * The rule is simple: chrome owns the edges, Barkly owns the middle, and
 * transient UI is never allowed to borrow his face just because a browser
 * viewport happened to have enough room in one screenshot.
 */

/**
 * Web previews have no native safe-area inset. Give them ordinary breathing
 * room, not a fake 54px notch. Native devices report the real inset and get a
 * small cushion beyond it.
 */
export const CONTENT_TOP = 12;
export const CONTENT_BOTTOM = 12;

export function contentTop(insetTop: number): number {
  return insetTop > 0 ? insetTop + 8 : CONTENT_TOP;
}
export function contentBottom(insetBottom: number): number {
  return insetBottom > 0 ? insetBottom + 8 : CONTENT_BOTTOM;
}

/** Real child-sized tap targets on every platform. */
export const TAP_MIN = 44;
export const STATUS_HEIGHT = TAP_MIN;
export const PLACES_HEIGHT = TAP_MIN + 10;
export const CHROME_BOTTOM = STATUS_HEIGHT + PLACES_HEIGHT + 12;

/** One compact transient notice, above the character stage. */
export function noticeTop(top: number): number {
  return top + CHROME_BOTTOM + 4;
}
export const NOTICE_MAX_HEIGHT = 38;

/** Dialogue has its own band below the world. */
export const DIALOGUE_HEIGHT = 100;
export const DIALOGUE_GAP = 10;

/**
 * IMPORTANT: this used to be 122px because the screen once had a text field
 * PLUS a PLAY / FEED / SLEEP action row. That action row was replaced by the
 * bowl, toy and bed in the world, but the old 122px reservation survived.
 * On a 640px phone it needlessly crushed the entire stage upward by ~54px.
 * There is one 44px talk/type row now, plus breathing room.
 */
export const CONTROLS_HEIGHT = TAP_MIN + 24;

export const SPEECH_MAX_LINES = 3;

/**
 * `screenHeight` here means the usable content height AFTER real safe areas
 * have been removed by the caller. Short browser viewports are allowed; the
 * stage shrinks gracefully instead of making fixed chrome overlap the dog.
 */
export function stageHeight(screenHeight: number): number {
  return Math.max(
    205,
    screenHeight - CHROME_BOTTOM - DIALOGUE_HEIGHT - DIALOGUE_GAP * 2 - CONTROLS_HEIGHT - 18,
  );
}

export const SPRITE_HEIGHT = 322;
export const SPRITE_FOOT = 78;
export const NOTICE_BAND = 4 + NOTICE_MAX_HEIGHT;
const SPRITE_BODY_WIDTH = 244;

/**
 * Short phones get a genuinely smaller composition. The previous hard 0.72
 * floor meant the dog could no longer shrink even when Safari/browser chrome
 * removed another 60–80px of vertical room. A smaller Barkly with clear air
 * around his ears is better than a large Barkly underneath banners and NPCs.
 */
export function spriteScale(screenHeight: number, screenWidth = 390): number {
  const room = stageHeight(screenHeight) - SPRITE_FOOT - NOTICE_BAND - 8;
  const byWidth = (screenWidth * 0.67) / SPRITE_BODY_WIDTH;
  const minScale = screenHeight < 590 ? 0.60 : screenHeight < 680 ? 0.66 : 0.72;
  return Math.max(minScale, Math.min(1.3, room / SPRITE_HEIGHT, byWidth));
}

export type NoticeKind = 'error' | 'degraded' | 'promotion' | 'reward';
export const NOTICE_PRIORITY: NoticeKind[] = ['error', 'degraded', 'promotion', 'reward'];
