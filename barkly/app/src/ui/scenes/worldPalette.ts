/**
 * THE WORLD'S PALETTE, IN TYPESCRIPT. Generated -- do not edit.
 *
 * Source of truth is `tools/blender/palette.py`; this is the same families and
 * the same five-step ramp, emitted so that what `src/` paints and what Blender
 * renders cannot drift apart. Regenerate with:
 *
 *     python3 scripts/export-palette.py
 *
 * `__tests__/palette_export.test.ts` fails if this file is stale, which is the
 * only thing that makes "one palette" true rather than aspirational.
 */

export type ToneStep = 'deep' | 'shade' | 'base' | 'lit' | 'pop';

/** Every family, deep to pop. */
export const TONE = {
  grass: { deep: '#434A2B', shade: '#677D4A', base: '#9EC47C', lit: '#DEFDB7', pop: '#F0FACF' },
  foliage: { deep: '#383F22', shade: '#55703D', base: '#85B56A', lit: '#CEF6AB', pop: '#EBFACC' },
  sand: { deep: '#574C38', shade: '#887B61', base: '#CFBF9D', lit: '#FFF0CD', pop: '#FFF5D9' },
  stone: { deep: '#53493C', shade: '#84776A', base: '#C9BAAC', lit: '#FFF0DC', pop: '#FFF5E0' },
  paving: { deep: '#504637', shade: '#7F7562', base: '#C4B9A2', lit: '#FFF3D7', pop: '#FFF6DE' },
  sea: { deep: '#313834', shade: '#496367', base: '#72A3B0', lit: '#BDE6EA', pop: '#E4F5EB' },
  sky: { deep: '#4D5250', shade: '#738189', base: '#ACC6D9', lit: '#DCEEF4', pop: '#EFF4EB' },
  bark: { deep: '#2A2016', shade: '#523F2F', base: '#8F6F5A', lit: '#D8B89C', pop: '#F8E3C9' },
  wood: { deep: '#3A2D1D', shade: '#665036', base: '#A68661', lit: '#ECCCA2', pop: '#FFECCC' },
  brick: { deep: '#412C21', shade: '#6E483D', base: '#B0756A', lit: '#F4BDAB', pop: '#FFE1CD' },
  roof: { deep: '#3A261F', shade: '#663C3B', base: '#A66369', lit: '#ECADAA', pop: '#FFDCCF' },
  metal: { deep: '#3B3934', shade: '#5F6567', base: '#97A5B0', lit: '#DEE8EA', pop: '#F4F6EB' },
  grape: { deep: '#382A30', shade: '#5C4563', base: '#9471AB', lit: '#DBBAE5', pop: '#F5E1EB' },
  berry: { deep: '#3E1715', shade: '#6A1622', base: '#AB223E', lit: '#F07283', pop: '#FFBEBB' },
  sun: { deep: '#48390F', shade: '#775E13', base: '#BA9725', lit: '#FDDC6F', pop: '#FFECAE' },
  cream: { deep: '#585044', shade: '#8A8276', base: '#D1CABD', lit: '#FFF7E4', pop: '#FFF8E4' },
  ink: { deep: '#1A150C', shade: '#322C24', base: '#695F56', lit: '#B8AB9A', pop: '#DDD3BE' },
} as const;

export type ToneFamily = keyof typeof TONE;

/** One colour, the same call shape the render packs use. */
export function tone(family: ToneFamily, step: ToneStep = 'base'): string {
  return TONE[family][step];
}
