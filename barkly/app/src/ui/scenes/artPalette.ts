/**
 * Colours of the WORLD, as opposed to colours of the interface.
 *
 * These deliberately do NOT come from the design system. Dirt is dirt, grass
 * is grass, brass is brass; snapping them to `color.gold` because the hex
 * happened to be close would be a refactor that made the art worse to make a
 * lint rule happy. They are sampled from the concept art and they answer to
 * it, not to the token palette.
 *
 * What they were doing wrong was living loose inside BarklyRoom.tsx as raw
 * hexes among the chrome, indistinguishable from a button colour somebody had
 * eyeballed. Naming them here draws the line the design-system test enforces:
 * a screen file uses tokens, an art module uses art.
 */

/** The ground he stands on, per place. Used to tint his shadow. */
export const GROUND = {
  home: '#7A5A32',
  park: '#4F6B3A',
  town: '#6E5636',
  beach: '#9A7B4C',
} as const;

/** The dig spot at the park: turned earth. */
export const DIRT = {
  mound: '#8A6B3A',
  shade: '#75592F',
  hole: '#5C4426',
} as const;

/** The same spot at the beach: wet sand. */
export const SAND = {
  mound: '#D3BA92',
  shade: '#C2A87E',
  ripple: '#9C8560',
} as const;

/** Metal on props and status dots — his tag, a buckle, a warning light. */
export const BRASS = {
  light: '#D99A2B',
  mid: '#C9A46A',
  dark: '#8B6817',
  polished: '#B98F3E',
  warm: '#D1A63B',
  shade: '#A08759',
  pale: '#B08E58',
} as const;

/** Foliage, for the plan pill's done state and anything growing. */
export const LEAF = {
  light: '#70834D',
  mid: '#5E6F40',
  dark: '#53623A',
  grey: '#71805C',
} as const;

/** His ball. A red rubber ball with a seam, not a themed UI accent. */
export const BALL = {
  body: '#B3402E',
  seam: '#8E2F20',
  gloss: '#FFFFFF',
} as const;
