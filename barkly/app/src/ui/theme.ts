/**
 * The design system.
 *
 * Before this file, every screen invented its own. Counted across src/ui:
 *
 *   - THREE different "ink" colours   (#3E332A, #3E3428, #2E2A26)
 *   - THREE different "soft" greys    (#7A6A55, #8A7A5F, #9A8F7A)
 *   - TWO golds (#C6952F, #C9A227) and TWO card whites (#FFFDF7, #FFF9EC)
 *   - 30 distinct font sizes: 7, 8, 8.5, 9, 9.5, 10, 11, 11.5, 12, 12.5, 13,
 *     13.5, 14, 15, 15.5, 16, 17, 18, 19, 20, 22, 23, 24, 25, 26, 27, 28, 29, 30
 *   - 25 distinct corner radii, 223 distinct hex values, 18 hand-rolled shadows
 *
 * Eleven files each declaring `const INK = ...` with a slightly different
 * brown is the tell. Nobody chose three inks; three files were each written
 * on their own and never compared. The result reads as almost-consistent,
 * which is the specific look of software assembled rather than designed — you
 * cannot point at the bug, it just feels cheap.
 *
 * So: one palette, one type scale, one spacing grid, one set of radii, one
 * elevation ramp. Everything in src/ui imports from here, and
 * __tests__/design_system.test.ts fails the build if a new raw hex or an
 * off-scale font size appears.
 *
 * The values are the ones the app already leaned on most — this is a
 * tightening of what is there, not a redesign of it.
 */

import { Platform, TextStyle, ViewStyle } from 'react-native';

// --------------------------------------------------------------- colour

export const color = {
  /** Primary text and the dark UI fill. */
  ink: '#3E3428',
  /** Secondary text: labels, blurbs, anything supporting. */
  inkSoft: '#8A7A5F',
  /** Between ink and inkSoft: secondary headings, strong-but-not-primary. */
  inkMid: '#5C4F3E',
  /** Tertiary: hints, counts, disabled text. Still passes on paper. */
  inkFaint: '#A8987C',
  /** Reversed text, on ink or on a photo. */
  inkOn: '#FFF9EC',

  /** Sheets and the raised surfaces on them. */
  paper: '#FFF9EC',
  card: '#FFFDF7',
  /** A recessed row inside a sheet. */
  well: '#F6EEDC',
  /** A filled chip or an inactive track. */
  fill: '#EDE1C8',
  /** Hairlines and dividers. */
  line: '#E7D9BE',

  /** Coins, levels, anything you earn. */
  gold: '#C9A227',
  goldSoft: '#E2C471',
  goldInk: '#72591E',
  /** The pale wash behind anything gold: a reward pill, a target zone. */
  goldWell: '#F5E6BE',

  /** His red. Errors borrow it so the app only has one alarming colour. */
  brand: '#B3402E',
  danger: '#8E2F20',
  dangerWell: '#FBE3DE',
  dangerLine: '#D08A7F',

  /** Grass and everything that agrees with you. */
  good: '#4E7A46',
  goodWell: '#E6F0DC',
  goodLine: '#7FA35C',

  /** Rivalry, warnings, anything warm and unresolved. */
  warm: '#C97B4B',
  warmWell: '#FBE7DC',
  warmLine: '#D08A5F',

  /** Scrims behind sheets. */
  scrim: 'rgba(40,32,22,0.45)',
} as const;

// ----------------------------------------------------------------- type

/**
 * Eight steps. Every piece of text in the app is one of these; if a new one
 * seems necessary, the answer is almost always that an existing step is
 * right and the layout around it is wrong.
 */
export const type = {
  /** Screen-owning statements. The onboarding line, a sheet's headline. */
  display: { fontSize: 24, lineHeight: 29, fontWeight: '900', letterSpacing: -0.4 },
  /** Sheet titles. */
  title: { fontSize: 20, lineHeight: 25, fontWeight: '800', letterSpacing: -0.2 },
  /** What he says. The one place a serif-sized line matters. */
  speech: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  /** Row names, buttons, anything you tap. */
  strong: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  /** Ordinary prose. */
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  /** Blurbs, secondary rows, most explanatory copy. */
  small: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  /** Counts, hints, timestamps. */
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  /** Section eyebrows. Always uppercase, always tracked out. */
  micro: { fontSize: 10, lineHeight: 13, fontWeight: '900', letterSpacing: 1.3 },
} as const satisfies Record<string, TextStyle>;

/**
 * Glyph sizes. A ✕, a ›, an emoji standing in for an object — these are
 * PICTURES, not type, so they are sized by how big the picture should be and
 * kept out of the type scale rather than quietly widening it.
 */
export const glyph = {
  close: 18,
  arrow: 26,
  icon: 26,
} as const;

/** Every font size the app is allowed to use. The test reads this. */
export const TYPE_SIZES: number[] = [
  ...new Set([...Object.values(type).map((t) => t.fontSize), ...Object.values(glyph)]),
];

// -------------------------------------------------------------- spacing

/** A 4pt grid. `space.md` is the default gap between related things. */
export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 30,
} as const;

// --------------------------------------------------------------- radius

export const radius = {
  /** Tags, small chips. */
  xs: 8,
  /** Inputs, dense rows. */
  sm: 12,
  /** Cards and list rows — the workhorse. */
  md: 18,
  /** Bubbles and prominent cards. */
  lg: 22,
  /** Sheet tops. */
  xl: 28,
  /** Pills and circles. */
  pill: 999,
} as const;

export const RADII: number[] = Object.values(radius);

// ------------------------------------------------------------ elevation

/**
 * Three heights, not eighteen. `web` gets a box-shadow because React Native
 * Web ignores the native shadow props.
 */
function shadow(y: number, blur: number, alpha: number): ViewStyle {
  return Platform.select({
    web: { boxShadow: `0 ${y}px ${blur}px rgba(74, 59, 42, ${alpha})` } as ViewStyle,
    default: {
      shadowColor: '#4A3B2A',
      shadowOpacity: alpha,
      shadowRadius: blur / 2,
      shadowOffset: { width: 0, height: y },
      elevation: Math.round(y * 1.5),
    } as ViewStyle,
  }) as ViewStyle;
}

export const elevation = {
  /**
   * Explicitly NO shadow. Needed because a style that conditionally drops out
   * of a card has to unset every prop the ramp set, on both platforms — the
   * one place that knows web uses `boxShadow` and native uses four props.
   */
  flat: Platform.select({
    web: { boxShadow: 'none' } as ViewStyle,
    default: { shadowOpacity: 0, shadowRadius: 0, elevation: 0 } as ViewStyle,
  }) as ViewStyle,
  /** Chips and rows resting on a surface. */
  low: shadow(2, 6, 0.08),
  /** Cards, bubbles, the header pills. */
  card: shadow(10, 24, 0.12),
  /** Sheets over the world. */
  sheet: shadow(-4, 30, 0.18),
} as const;
