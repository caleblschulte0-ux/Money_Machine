/**
 * Barkly's visual system.
 *
 * This is intentionally NOT a neutral productivity-app palette. Barkly is a
 * bright toy world for kids: warm paper, sky-blue recesses, candy controls,
 * chunky readable type and shadows that make controls feel molded rather than
 * CSS-flat. The world art remains in scenes/artPalette.ts; this file owns UI.
 */

import { Platform, TextStyle, ViewStyle } from 'react-native';

export const color = {
  ink: '#3E3428',
  inkMid: '#5C4F3E',
  inkSoft: '#685A44',
  inkFaint: '#A8987C',
  inkOn: '#FFF7E8',

  paper: '#FFF7E8',
  card: '#FFFFFF',
  well: '#FFE7A8',
  fill: '#D9F0FF',
  line: '#B8D6EA',

  gold: '#F3C63F',
  goldSoft: '#FFE49A',
  goldInk: '#72591E',
  goldWell: '#FFF0A8',

  brand: '#C43C50',
  danger: '#8E2F20',
  dangerWell: '#FFD8D0',
  dangerLine: '#D8867A',

  good: '#3F7A3A',
  goodWell: '#D7F4CC',
  goodLine: '#75B467',

  warm: '#B76435',
  warmWell: '#FFE0C2',
  warmLine: '#E0A26F',

  pop: '#4CC9F0',
  popDeep: '#2FA9D0',

  /**
   * Lighter than the first candy-purple (#A985F4). That version looked good
   * but dark 12px labels measured only 4.26:1. This one keeps the toy-store
   * purple while clearing the phone readability gate comfortably.
   */
  violet: '#BDA7FF',
  violetDeep: '#7B5CC7',
  mint: '#79E08A',
  mintDeep: '#4DBB62',
  lemon: '#FFD84D',
  lemonDeep: '#E3B92F',
  coral: '#FF7A59',
  coralDeep: '#DA5A3E',

  gloss: 'rgba(255,255,255,0.52)',
  glossSoft: 'rgba(255,255,255,0.28)',

  scrim: 'rgba(40,32,22,0.45)',
} as const;

export const type = {
  display: { fontSize: 24, lineHeight: 29, fontWeight: '900', letterSpacing: -0.4 },
  title: { fontSize: 20, lineHeight: 25, fontWeight: '800', letterSpacing: -0.2 },
  speech: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  strong: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  small: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  micro: { fontSize: 10, lineHeight: 13, fontWeight: '900', letterSpacing: 1.3 },
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
  flat: Platform.select({
    web: { boxShadow: 'none' } as ViewStyle,
    default: { shadowOpacity: 0, shadowRadius: 0, elevation: 0 } as ViewStyle,
  }) as ViewStyle,
  low: shadow(3, 7, 0.13),
  card: shadow(7, 14, 0.18),
  toy: shadow(9, 16, 0.24),
  sheet: shadow(-4, 26, 0.2),
} as const;
