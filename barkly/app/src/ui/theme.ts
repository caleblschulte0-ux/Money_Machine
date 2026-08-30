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

  gold: '#F3C63F',
  goldSoft: '#FFE49A',
  goldInk: '#6A5118',
  goldWell: '#FFF0A8',

  brand: '#C43C50',
  danger: '#842A1D',
  dangerWell: '#FFD8D0',
  dangerLine: '#D77D70',

  good: '#356F35',
  goodWell: '#D7F4CC',
  goodLine: '#6EAE64',

  warm: '#A95730',
  warmWell: '#FFE0C2',
  warmLine: '#DB9965',

  pop: '#4CC9F0',
  popDeep: '#249FC8',

  violet: '#BDA7FF',
  violetDeep: '#7253BD',
  mint: '#79E08A',
  mintDeep: '#43AF59',
  lemon: '#FFD84D',
  lemonDeep: '#DCAF24',
  coral: '#FF7A59',
  coralDeep: '#D65238',

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
