/**
 * Where things are allowed to be on screen.
 *
 * The brief was exact: "pretend that everything that could ever pop up on the
 * screen popped up at once — things need to be positioned so they don't
 * interact." That is a layout CONTRACT, not a set of nudges, so it lives in
 * one file with numbers you can read, and there is a stress mode that turns
 * every overlay on at once plus a browser check that measures the boxes and
 * fails on any overlap.
 *
 * What was wrong:
 *
 * - Notices STACKED. A coin reward, a rivalry promotion and a degraded-service
 *   banner were three siblings in one column with a 6px gap. Earn coins during
 *   a promotion and you got two cards deep; add a backend warning and it was
 *   three, reaching down into the speech bubble.
 * - The speech bubble's zone STARTED ABOVE THE NOTICE ZONE. Its anchor began
 *   at the top of the stage (~181px) while notices sat at 190px, so a
 *   four-line reply grew straight up through them.
 * - Nothing declared its space. Every overlay picked its own offset, so any
 *   new one was a guess.
 *
 * The bands below are measured from the top of the content view (which already
 * carries the safe-area padding). They are exclusive: nothing in one band may
 * enter another.
 */

/** Header row: wordmark, coins, pack, mute, settings. */
export const CHROME_TOP = 0;

/**
 * Everything above this is fixed chrome (header, location tabs, plan pill).
 * Measured with all three present, which is the normal case.
 */
export const CHROME_BOTTOM = 186;

/**
 * ONE notice at a time, in its own reserved strip. The height is capped at
 * the tallest notice (the promotion card, three lines) so the band below can
 * be positioned against a constant rather than against whatever happens to be
 * showing.
 */
export const NOTICE_TOP = CHROME_BOTTOM + 8;
export const NOTICE_MAX_HEIGHT = 86;
export const NOTICE_BOTTOM = NOTICE_TOP + NOTICE_MAX_HEIGHT;

/**
 * His speech bubble and thought bubble share one anchor above his head. It
 * may grow upward, and it stops here — clear of the notice strip, whether or
 * not a notice is showing.
 */
export const SPEECH_TOP = NOTICE_BOTTOM + 8;

/** Roughly how tall the sprite is, standing on the stage floor. */
export const SPRITE_HEIGHT = 305;

/** Text field + the three action buttons + the padding under them. */
export const CONTROLS_HEIGHT = 150;

/** A bubble needs at least this much room to be worth showing. */
export const SPEECH_MIN_HEIGHT = 132;

/**
 * Hard cap on how many lines of him fit in a bubble. Four lines at a 360px
 * width is taller than the speech band, and a `flex-end` box overflows
 * UPWARD — straight back through the notice strip that the band exists to
 * stay clear of. Three lines fit at every size we check.
 */
export const SPEECH_MAX_LINES = 3;

/**
 * Where his speech bubble's tail sits, measured from the TOP of the content
 * view — just over his head.
 *
 * This has to be computed from the real screen height, which is the thing the
 * first version got wrong: it was a flat 470px from the bottom, and on a
 * 780px screen that put the band's floor ABOVE its own ceiling, so a four-line
 * reply spilled straight up through the notice strip and the plan pill. The
 * clamp is the important half — when there genuinely isn't room the bubble
 * grows DOWN over the top of his head (which looks like a speech bubble) and
 * never up into the chrome (which looks broken).
 */
export function speechTail(screenHeight: number): number {
  const headLine = screenHeight - CONTROLS_HEIGHT - SPRITE_HEIGHT;
  return Math.max(SPEECH_TOP + SPEECH_MIN_HEIGHT, headLine);
}

/**
 * Where an NPC's bubble sits: its own horizontal band, just under his.
 *
 * These used to float directly above each NPC sprite, which meant their
 * position depended on that dog's size and offset — and on a short screen,
 * where his own bubble gets pushed down toward his head, the two met. Giving
 * them a band derived from the SAME function makes the separation structural
 * rather than a coincidence of three sprite offsets.
 */
export const NPC_BUBBLE_GAP = 12;
export function npcBubbleTop(screenHeight: number): number {
  return speechTail(screenHeight) + NPC_BUBBLE_GAP;
}

/** The state chip ("napping", "listening") sits under him, above the controls. */
export const CHIP_BOTTOM = 150;

/**
 * Notices are mutually exclusive and this is the order they win in: a hard
 * error outranks a degraded service, which outranks a story beat, which
 * outranks a coin receipt.
 *
 * The error used to live at the bottom of the speech anchor, as if it were
 * something he said — which put it at head height, straight through the NPC's
 * bubble. An error is a notice, so it goes in the notice slot with the rest
 * and inherits the reservation that keeps that slot clear.
 */
export type NoticeKind = 'error' | 'degraded' | 'promotion' | 'reward';
export const NOTICE_PRIORITY: NoticeKind[] = ['error', 'degraded', 'promotion', 'reward'];
