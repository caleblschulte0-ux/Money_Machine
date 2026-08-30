/**
 * Responsive screen geometry for Barkly.
 *
 * More screen reveals more world. It does not make Barkly or the HUD grow
 * without bound. Portrait uses two shallow top rows; landscape moves location
 * navigation and conversation controls into side rails around a center stage.
 */
export const CONTENT_TOP = 12;
export const CONTENT_BOTTOM = 12;

export function contentTop(insetTop: number): number {
  return insetTop > 0 ? insetTop + 8 : CONTENT_TOP;
}
export function contentBottom(insetBottom: number): number {
  return insetBottom > 0 ? insetBottom + 8 : CONTENT_BOTTOM;
}

export const TAP_MIN = 44;
export const STATUS_HEIGHT = TAP_MIN;
export const PLACES_HEIGHT = TAP_MIN + 4;
export const CHROME_BOTTOM = STATUS_HEIGHT + PLACES_HEIGHT + 6;

export type LayoutMode = 'narrowPortrait' | 'widePortrait' | 'phoneLandscape' | 'tabletLandscape';

export function layoutMode(width: number, height: number): LayoutMode {
  const landscape = width > height;
  const tablet = Math.min(width, height) >= 600;
  if (landscape) return tablet ? 'tabletLandscape' : 'phoneLandscape';
  return width >= 600 ? 'widePortrait' : 'narrowPortrait';
}

export function isLandscapeMode(mode: LayoutMode): boolean {
  return mode === 'phoneLandscape' || mode === 'tabletLandscape';
}

export function chromeBottom(mode: LayoutMode = 'narrowPortrait'): number {
  return isLandscapeMode(mode) ? STATUS_HEIGHT + 6 : CHROME_BOTTOM;
}

export function noticeTop(top: number, mode: LayoutMode = 'narrowPortrait'): number {
  return top + chromeBottom(mode) + 4;
}
export const NOTICE_MAX_HEIGHT = 38;

export const DIALOGUE_HEIGHT = 96;
export const DIALOGUE_GAP = 6;
export const CONTROLS_HEIGHT = TAP_MIN + 14;
export const SPEECH_MAX_LINES = 3;

export function contentFrameWidth(width: number, mode: LayoutMode): number {
  if (mode === 'narrowPortrait') return width;
  if (mode === 'widePortrait') return Math.min(620, Math.max(560, width - 40));
  if (mode === 'phoneLandscape') return Math.max(540, width - 24);
  return Math.min(1120, Math.max(760, width - 48));
}

export function navRailWidth(mode: LayoutMode): number {
  return mode === 'tabletLandscape' ? 112 : mode === 'phoneLandscape' ? 92 : 0;
}

export function interactionRailWidth(mode: LayoutMode): number {
  return mode === 'tabletLandscape' ? 300 : mode === 'phoneLandscape' ? 250 : 0;
}

export function stageWidth(width: number, mode: LayoutMode): number {
  if (mode === 'narrowPortrait') return width;
  if (mode === 'widePortrait') return Math.min(560, width - 40);
  const gutters = mode === 'tabletLandscape' ? 64 : 52;
  const available = width - navRailWidth(mode) - interactionRailWidth(mode) - gutters;
  const cap = mode === 'tabletLandscape' ? 620 : 430;
  return Math.max(mode === 'tabletLandscape' ? 360 : 210, Math.min(cap, available));
}

export function stageHeight(screenHeight: number, mode: LayoutMode = 'narrowPortrait'): number {
  if (isLandscapeMode(mode)) return Math.max(230, screenHeight - STATUS_HEIGHT - 18);
  return Math.max(
    212,
    screenHeight - CHROME_BOTTOM - DIALOGUE_HEIGHT - DIALOGUE_GAP * 2 - CONTROLS_HEIGHT - 18,
  );
}

export const SPRITE_HEIGHT = 322;
export const SPRITE_FOOT = 78;
export const NOTICE_BAND = 4 + NOTICE_MAX_HEIGHT;
const SPRITE_BODY_WIDTH = 244;

export function spriteScale(
  screenHeight: number,
  stageWidthPx = 390,
  mode: LayoutMode = 'narrowPortrait',
): number {
  const landscape = isLandscapeMode(mode);
  const room = stageHeight(screenHeight, mode) - SPRITE_FOOT - (landscape ? 20 : NOTICE_BAND + 4);
  const byWidth = (stageWidthPx * 0.82) / SPRITE_BODY_WIDTH;
  const minScale = landscape
    ? screenHeight < 430 ? 0.62 : 0.72
    : screenHeight < 590 ? 0.60 : screenHeight < 680 ? 0.66 : 0.72;
  const cap = mode === 'tabletLandscape' ? 1.25 : mode === 'widePortrait' ? 1.34 : mode === 'phoneLandscape' ? 1.05 : 1.42;
  return Math.max(minScale, Math.min(cap, room / SPRITE_HEIGHT, byWidth));
}

export type NoticeKind = 'error' | 'degraded' | 'promotion' | 'reward';
export const NOTICE_PRIORITY: NoticeKind[] = ['error', 'degraded', 'promotion', 'reward'];
