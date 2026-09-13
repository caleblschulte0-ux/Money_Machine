/**
 * Barkly's visual system.
 *
 * CRISP PASS:
 * "Kid friendly" does not mean "more colors." The UI needs the same resolved
 * rendering discipline as a polished mobile game: confident contrast, solid
 * surfaces, one shadow language, controlled highlights and typography that
 * does not look like default web copy. The world art remains in
 * scenes/artPalette.ts; this file owns UI.
 */

import { Platform, TextStyle, ViewStyle } from 'react-native';

export const color = {
  /** Slightly deeper neutrals make text and edges feel printed, not washed. */
  ink: '#342C22',
  inkMid: '#4F4436',
  inkSoft: '#655743',
  inkFaint: '#9D8E75',
  inkOn: '#FFF9EE',

  /** Clean solids. Warm enough for Barkly, not beige enough to look muddy. */
  paper: '#FFFAF2',
  card: '#FFFFFF',
  well: '#FFE7A8',
  fill: '#D9F0FF',
  line: '#9EC9E1',

  gold: '#F3D375',
  goldSoft: '#FFE49A',
  goldInk: '#6A5933',
  goldWell: '#FFF0A8',

  // #A8515E. Two constraints meet on this one token and both are hard.
  //
  // Chroma: it was #C43C50 at saturation 0.69, and the whole UI is now capped
  // at 0.52 -- Barkly's own level -- because a HUD louder than the character
  // inverts the hierarchy the concept sheet states ("made to stand out on any
  // shelf"). Contrast: reversed text sits on this colour, so it has to clear
  // AA 4.5:1 against the three light surfaces, and pulling saturation out of a
  // mid-value red RAISES its luminance -- capping alone dropped it to 3.88.
  //
  // Saturation is what the hierarchy cares about and VALUE is what contrast
  // cares about, so they are separable: the chroma stays capped and the value
  // comes down from 0.77 to 0.66 instead. Clears at 4.97 / 5.25 / 5.07.
  brand: '#A8515E',
  danger: '#84483F',
  dangerWell: '#FFD8D0',
  dangerLine: '#D77D70',

  good: '#356F35',
  goodWell: '#D7F4CC',
  goodLine: '#6EAE64',

  warm: '#A96D51',
  warmWell: '#FFE0C2',
  warmLine: '#DB9B69',

  pop: '#73D2F0',
  popDeep: '#60AEC8',
  /*
   * The blue that is legible at 10px. `popDeep` is a SURFACE colour: measured
   * against pure white it is 3.06:1, so any small text in it fails WCAG AA
   * before the background behind it is even considered -- and the badge it sat
   * on is 78% white over the live scene, which pushed the "BARKLY BRAIN" chip
   * to 2.96:1 in the audit. 6.03:1 on white, and it still reads as his blue.
   */
  popInk: '#3F7484',

  violet: '#BDA7FF',
  violetWell: '#EDE4FF',
  violetDeep: '#775BBD',
  mint: '#79E08A',
  mintDeep: '#54AF67',
  lemon: '#FFE27A',
  lemonDeep: '#DCC06A',
  coral: '#FF957A',
  coralDeep: '#D67967',

  /**
   * The grounds the ITEM ART stands on, in the shop and the food tray.
   *
   * Both sheets used to set the well to the full-strength category colour --
   * a coral square behind a biscuit, a lemon square behind cheese. That was
   * fine while the items were flat drawings with white outlines, and it stopped
   * being fine the day they became rendered objects in the world's own palette:
   * measured against the mean colour of each render, cheese on coral came out
   * at 1.38:1 and the biscuit at 1.61:1, where 3:1 is the floor for a graphic
   * you are meant to identify.
   *
   * Each of these is its colour mixed into `paper` at the strongest fraction
   * that still keeps EVERY item render at or above 3.05:1 -- solved per colour,
   * which is why they are not all the same strength. The category is still
   * loud: it carries on the section tab, the card border and the bottom edge.
   * Recompute these if the item renders change. They are PANES, not `*Well`
   * colours -- a well here is a filled chip behind text, and these are the
   * near-white glass an object is displayed against.
   */
  coralPane: '#FFF2E9',
  lemonPane: '#FFF5D8',
  violetPane: '#F9F3F3',
  popPane: '#EFF6F2',
  mintPane: '#EEF7E4',

  /** Highlights are accents now, not translucent frosting over every surface. */
  gloss: 'rgba(255,255,255,0.34)',
  glossSoft: 'rgba(255,255,255,0.18)',

  scrim: 'rgba(38,30,22,0.50)',
} as const;

export const type = {
  display: { fontSize: 24, lineHeight: 28, fontWeight: '900', letterSpacing: -0.45 },
  title: { fontSize: 20, lineHeight: 24, fontWeight: '900', letterSpacing: -0.25 },
  speech: { fontSize: 17, lineHeight: 23, fontWeight: '700', letterSpacing: -0.1 },
  strong: { fontSize: 15, lineHeight: 19, fontWeight: '800' },
  body: { fontSize: 15, lineHeight: 20, fontWeight: '500' },
  small: { fontSize: 13, lineHeight: 17, fontWeight: '500' },
  caption: { fontSize: 12, lineHeight: 15, fontWeight: '700' },
  micro: { fontSize: 10, lineHeight: 12, fontWeight: '900', letterSpacing: 1.2 },
} as const satisfies Record<string, TextStyle>;

export const glyph = {
  close: 18,
  arrow: 26,
  icon: 26,
} as const;

export const TYPE_SIZES: number[] = [
  ...new Set([...Object.values(type).map((t) => t.fontSize), ...Object.values(glyph)]),
];

export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 30,
} as const;

/**
 * Rounded is part of the toy language; random rounding is not. Keep the one
 * scale so every surface feels designed by the same game team.
 */
export const radius = {
  xs: 8,
  sm: 12,
  md: 18,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const RADII: number[] = Object.values(radius);

function shadow(y: number, blur: number, alpha: number): ViewStyle {
  return Platform.select({
    web: { boxShadow: `0 ${y}px ${blur}px rgba(59, 47, 34, ${alpha})` } as ViewStyle,
    default: {
      shadowColor: '#3B2F22',
      shadowOpacity: alpha,
      shadowRadius: blur / 2,
      shadowOffset: { width: 0, height: y },
      elevation: Math.round(y * 1.5),
    } as ViewStyle,
  }) as ViewStyle;
}

/**
 * Tighter shadows = crisper forms. The previous 14–26px blur spread made
 * otherwise solid controls look like soft HTML cards. These still lift from
 * the world, but their edges stay readable.
 */
/**
 * THE WORLD'S EDGE, IN THE INTERFACE.
 *
 * Every object in the game is separated from what is behind it by an ink
 * contour -- `scripts/promote-props.py` grows it off each prop's own alpha in
 * `tone("ink", "deep")`, and `scripts/outline-cast.py` gives the dog the same
 * one. The interface had none: flat white cards with hairline shadows, sitting
 * over a rendered world that is drawn in a completely different language. Held
 * side by side that is the same complaint the props got -- a thing from one
 * picture dropped into another.
 *
 * This is that ink, as the exact RGB the renders carry, so a panel edge and a
 * prop edge are the same colour rather than two people's idea of "dark".
 *
 * IT IS ONE CONSTANT. Set `SURFACE_EDGE` to 0 and every sheet, card and chip
 * goes back to what it was, with no other edit anywhere.
 */
export const contour = '#0D1123';
export const SURFACE_EDGE = 2;

/**
 * A surface that belongs in the world: ink edge, and a shadow that sits
 * UNDER it rather than blurring around it.
 *
 * `radius` is the corner it takes. Pass `edge: false` for a surface that
 * genuinely has no outline in the reference either -- a full-bleed hero
 * image, or a pane an object is displayed against.
 */
export function molded(
  cornerRadius: number,
  options: { edge?: boolean; top?: boolean } = {},
): ViewStyle {
  const { edge = true, top = false } = options;
  const corners: ViewStyle = top
    ? { borderTopLeftRadius: cornerRadius, borderTopRightRadius: cornerRadius }
    : { borderRadius: cornerRadius };
  if (!edge || SURFACE_EDGE <= 0) return corners;
  return {
    ...corners,
    borderWidth: SURFACE_EDGE,
    borderColor: contour,
    // A top-edged surface (a sheet rising off the bottom) must not draw a line
    // across the bottom of the screen: that reads as a gap under the sheet.
    ...(top ? { borderBottomWidth: 0 } : null),
  };
}

export const elevation = {
  flat: Platform.select({
    web: { boxShadow: 'none' } as ViewStyle,
    default: { shadowOpacity: 0, shadowRadius: 0, elevation: 0 } as ViewStyle,
  }) as ViewStyle,
  low: shadow(2, 5, 0.15),
  card: shadow(4, 8, 0.18),
  toy: shadow(6, 10, 0.22),
  sheet: shadow(-3, 18, 0.19),
} as const;
