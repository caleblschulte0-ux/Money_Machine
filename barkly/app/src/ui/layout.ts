/**
 * Phone-first screen geometry for Barkly.
 *
 * The rule is simple: chrome owns the edges, Barkly owns the middle, and
 * transient UI is never allowed to borrow his face just because a browser
 * viewport happened to have enough room in one screenshot.
 *
 * HERO PASS:
 * The earlier responsive pass solved collisions, but it solved them too
 * conservatively on normal/tall phones. Barkly ended up looking like a small
 * object inside a UI composition. A kid should see the DOG first. The maths
 * below now lets him use substantially more of the available width whenever
 * the vertical room genuinely exists, while preserving the smaller short-phone
 * floor that keeps Safari/browser-chrome layouts safe.
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
/**
 * Keep navigation comfortable without giving it more vertical authority than
 * the character. It was 54px; 50px keeps the same 44px tap target plus air.
 */
export const PLACES_HEIGHT = TAP_MIN + 6;
export const CHROME_BOTTOM = STATUS_HEIGHT + PLACES_HEIGHT + 8;

/** One compact transient notice, above the character stage. */
export function noticeTop(top: number): number {
  return top + CHROME_BOTTOM + 4;
}
export const NOTICE_MAX_HEIGHT = 38;

/** Dialogue has its own band below the world. */
export const DIALOGUE_HEIGHT = 100;
export const DIALOGUE_GAP = 8;

/**
 * There is one 44px talk/type row now. Keep it fully usable, but do not reserve
 * web-form-sized whitespace around it. This gives the dog room without making
 * the interaction controls smaller.
 */
export const CONTROLS_HEIGHT = TAP_MIN + 20;

export const SPEECH_MAX_LINES = 3;

/**
 * `screenHeight` here means the usable content height AFTER real safe areas
 * have been removed by the caller. Short browser viewports are allowed; the
 * stage shrinks gracefully instead of making fixed chrome overlap the dog.
 */
export function stageHeight(screenHeight: number): number {
  return Math.max(
    212,
    screenHeight - CHROME_BOTTOM - DIALOGUE_HEIGHT - DIALOGUE_GAP * 2 - CONTROLS_HEIGHT - 18,
  );
}

export const SPRITE_HEIGHT = 322;
export const SPRITE_FOOT = 78;
export const NOTICE_BAND = 4 + NOTICE_MAX_HEIGHT;
const SPRITE_BODY_WIDTH = 244;

/**
 * Barkly is the hero, not another widget.
 *
 * The previous width cap used only 67% of the phone, which was excellent for
 * proving nothing collided and bad for a pet game: on a 390px phone it capped
 * him around 1.07x even when there was hundreds of pixels of empty vertical
 * stage. We now allow up to 82% of the phone width. Height still wins on short
 * screens, so a 360x640 browser remains conservative while an 844/932px phone
 * finally gives the dog the scale the product needs.
 */
export function spriteScale(screenHeight: number, screenWidth = 390): number {
  const room = stageHeight(screenHeight) - SPRITE_FOOT - NOTICE_BAND - 4;
  const byWidth = (screenWidth * 0.82) / SPRITE_BODY_WIDTH;
  const minScale = screenHeight < 590 ? 0.60 : screenHeight < 680 ? 0.66 : 0.72;
  return Math.max(minScale, Math.min(1.42, room / SPRITE_HEIGHT, byWidth));
}

export type NoticeKind = 'error' | 'degraded' | 'promotion' | 'reward';
export const NOTICE_PRIORITY: NoticeKind[] = ['error', 'degraded', 'promotion', 'reward'];
