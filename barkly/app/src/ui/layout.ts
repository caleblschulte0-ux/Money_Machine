/**
 * The shape of the screen.
 *
 * THE REDESIGN. The previous version stacked chrome down the top of the
 * screen — a wordmark row, then four location tabs, then a plan pill — and
 * floated his speech ABOVE HIS HEAD, which meant the bubble was forever
 * negotiating for space with his face and with every notice. That is why it
 * read as cluttered no matter how many collisions got fixed: the layout was
 * asking three things to share one region.
 *
 * The fix is not more collision rules. It is giving each thing its own band:
 *
 *     ┌──────────────────────────────┐
 *     │ [c 65 Lv1]      [pack][🔊][⋯] │  STATUS   one row, nothing else
 *     │  home  park  town  beach  [›] │  PLACES   slim, with the plan chip
 *     │                              │
 *     │                              │
 *     │             🐕                │  STAGE    his, entirely. Nothing
 *     │                              │           is ever drawn over him.
 *     ├──────────────────────────────┤
 *     │ BARKLY                       │  DIALOGUE fixed panel. Everything
 *     │ "the line he just said"      │           anyone says appears here.
 *     ├──────────────────────────────┤
 *     │ [say something…      ] [talk] │  ACTIONS
 *     │ [ play ] [ feed ] [ sleep ]  │
 *     └──────────────────────────────┘
 *
 * Moving dialogue to a panel at the bottom is what makes "speech must never
 * cover anyone's face" true BY CONSTRUCTION rather than by measurement: the
 * stage and the dialogue band do not overlap, so nothing in one can land on
 * anything in the other. It also collapses four separate floating things —
 * his bubble, his thought, the NPC's bubble, the idle hint — into one panel
 * that is always in the same place, which is most of the decluttering.
 */

/**
 * The inset above the status row — notch, status bar, breathing room.
 *
 * It lives here rather than as a `paddingTop` literal in the screen because
 * the notice layer is positioned ABSOLUTELY, and absolute `top` in React
 * Native measures from the border box, ignoring that padding. When the two
 * numbers lived apart, the notice was placed 54px too high and printed
 * straight through the places row at every screen size.
 */
export const CONTENT_TOP = 54;

/**
 * The two chrome rows, sized so every control in them is a 44px TAP TARGET.
 *
 * They were 44 and 40, holding 38x38 round buttons and 29px-tall tabs, with
 * `hitSlop` making up the difference. React Native Web IGNORES hitSlop — so on
 * the web build, and in the browser audit that found this, those were 38px
 * and 29px targets against a 44px minimum (WCAG 2.5.5, Apple HIG). Padding is
 * the fix that works on both platforms, and it is not a detail here: this is
 * an app aimed at children, whose aim is worse than ours, not better.
 */
export const TAP_MIN = 44;
export const STATUS_HEIGHT = TAP_MIN;
export const PLACES_HEIGHT = TAP_MIN + 10;

/** Everything above this is chrome. Measured from the top of the content view. */
export const CHROME_BOTTOM = STATUS_HEIGHT + PLACES_HEIGHT + 12;

/**
 * ONE notice at a time, floating over the empty upper sky. Fixed height so
 * the stage below never reflows when a reward appears.
 */
export const NOTICE_TOP = CONTENT_TOP + CHROME_BOTTOM + 10;
/**
 * A slim strip, not a card.
 *
 * This was 86, so 96px of the stage was permanently reserved — for a notice
 * that is on screen for about five seconds. Everything the sprite is scaled
 * against subtracts this number, so it was the single biggest reason the dog
 * had been shrinking: he was being sized around a rivalry banner that is not
 * there 99% of the time. The banner is one line now and this is what it needs.
 */
export const NOTICE_MAX_HEIGHT = 46;

/**
 * The dialogue panel. Fixed height so the stage above it is a constant, and
 * tall enough for three lines plus a speaker name.
 */
export const DIALOGUE_HEIGHT = 100;

/** Text field + the three action buttons + the padding under them. */
export const CONTROLS_HEIGHT = 122;

/** Hard cap on lines of dialogue. Three fits the panel at every size. */
export const SPEECH_MAX_LINES = 3;

/**
 * How much room the stage gets, given the screen. Everything else is fixed,
 * so the character absorbs the difference — a taller phone means a bigger
 * dog, not a bigger gap.
 */
export function stageHeight(screenHeight: number): number {
  return Math.max(220, screenHeight - CHROME_BOTTOM - DIALOGUE_HEIGHT - CONTROLS_HEIGHT - 24);
}

/**
 * How big he is drawn, given the screen — and the reason it is a FUNCTION.
 *
 * He used to be scaled to the stage alone, which is wrong: the notice band
 * floats over the top of the stage, so the stage is not all his. At 360×780
 * that put a rivalry card 31px into the top of his sprite — the exact thing
 * "speech must never cover anyone's face" rules out. Scaling him to the room
 * he ACTUALLY has makes it impossible instead of unlikely.
 *
 * Measured, not guessed: at scale 1 the sprite box is 322 tall and its feet
 * sit 54px above the bottom of the stage.
 */
export const SPRITE_HEIGHT = 322;
export const SPRITE_FOOT = 54;
/** How far the notice band reaches down into the stage from its top. */
export const NOTICE_BAND = 10 + NOTICE_MAX_HEIGHT;

/**
 * The cap was 1.0 and it should not have been.
 *
 * 1.0 is just "the size the PNG happens to be exported at", which is not a
 * design decision about how big a dog should look on a phone. He is the
 * subject of the screen; if the stage has room, he uses it. The floor stays,
 * because on a short screen something has to give and it is better that he is
 * small than that a notice lands on his face.
 */
export function spriteScale(screenHeight: number): number {
  const room = stageHeight(screenHeight) - SPRITE_FOOT - NOTICE_BAND - 8;
  return Math.max(0.72, Math.min(1.3, room / SPRITE_HEIGHT));
}

/**
 * Notices are mutually exclusive and this is the order they win in: a hard
 * error outranks a degraded service, which outranks a story beat, which
 * outranks a coin receipt.
 */
export type NoticeKind = 'error' | 'degraded' | 'promotion' | 'reward';
export const NOTICE_PRIORITY: NoticeKind[] = ['error', 'degraded', 'promotion', 'reward'];
