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

/**
 * The things you can buy, drawn rather than typed.
 *
 * The shop used emoji — a red circle for the red collar, a football for the
 * squeaky ball, a slice of cartoon cheese. Emoji render in the SYSTEM's art
 * style, not the app's, so a photoreal soccer ball sat two rows below a
 * hand-modelled dog and every row announced that nobody had drawn anything.
 * These are the palette those drawings use; see ui/ItemIcon.tsx.
 */
export const ITEM = {
  biscuit: '#EADCB6',
  biscuitEdge: '#CBB68C',
  cheese: '#E8C255',
  cheeseEdge: '#C9A032',
  cheeseHole: '#D4AC3E',
  steak: '#B5584B',
  steakFat: '#EBD9C4',
  steakEdge: '#8E4038',
  rope: '#D8C5A0',
  ropeShade: '#B7A177',
  bed: '#6B558A',
  bedRim: '#4E3D63',
  bedCushion: '#EFE3F2',
  rug: '#B87860',
  rugInner: '#D8A487',
  rugEdge: '#9C5B4A',
  glass: '#BFD9E4',
  glassSill: '#C9AF7E',
  leather: '#4A3A2C',
  /** The stick he already owns. Bark, not floor. */
  stick: '#6E5232',
  stickLight: '#8A6A44',
} as const;

/**
 * The authored kids-game world palette.
 *
 * This is deliberately broader and brighter than the old illustrative palette:
 * these colours are the paint on Barkly's toy-diorama world. Keeping them here
 * means Home/Park/Town/Beach can get loud without turning component files into
 * a pile of one-off hex guesses.
 */
export const DIORAMA = {
  white: '#FFFFFF',
  ink: '#2A211A',
  shadow: '#2A2017',
  cream: '#FFF4D8',
  paleCream: '#FFF7DC',
  butter: '#FFE66A',
  butterDeep: '#FFC93D',
  lemon: '#FFD84D',
  coral: '#FF6F61',
  coralDeep: '#E87562',
  coralLight: '#FFA181',
  violet: '#A85BC4',
  violetLight: '#D187E3',
  violetNight: '#6C4779',
  violetNightLight: '#8A61A0',
  skyMorningA: '#FFD57C',
  skyMorningB: '#BDEBFF',
  skyDayA: '#65C8FF',
  skyDayB: '#DDF7FF',
  skyEveningA: '#FF8D75',
  skyEveningB: '#FFD3A0',
  skyNightA: '#53549A',
  skyNightB: '#8176B6',
  wallDayA: '#FFF2BE',
  wallDayB: '#FFD9B6',
  wallNightA: '#625E9F',
  wallNightB: '#71689D',
  floorDayFar: '#E6C68C',
  floorDayNear: '#BE8E5E',
  floorNightFar: '#89735E',
  floorNightNear: '#645443',
  woodDay: '#865834',
  woodNight: '#5A4436',
  woodWarm: '#A66A44',
  woodDark: '#47382E',
  woodMid: '#6B4530',
  woodDeep: '#3D3129',
  woodSoft: '#DCA05D',
  gold: '#FFC95B',
  goldLight: '#FFF1B3',
  goldGlow: '#FFE987',
  goldGlowSoft: '#FFF0A0',
  windowFrameDay: '#D59B55',
  windowFrameNight: '#E7C77B',
  windowSillDay: '#BC7C3C',
  windowSillNight: '#C7A95C',
  hillDay: '#77C66D',
  hillNight: '#3E5F59',
  couchDay: '#E87562',
  couchDayTop: '#FF907A',
  couchNight: '#8A5261',
  couchNightTop: '#A66372',
  couchNightSeat: '#B8797D',
  couchDaySeat: '#FFA181',
  parkHillDay: '#8ACD67',
  parkHillNight: '#496344',
  parkGrassDay: '#5FB947',
  parkGrassNight: '#365337',
  parkTreeDay: '#58A63E',
  parkTreeDayLight: '#70C54D',
  parkTreeNight: '#315032',
  parkTreeNightLight: '#3A5C39',
  parkPathDay: '#F2DEA9',
  parkPathNight: '#7D7154',
  townCoral: '#F47E86',
  townBlue: '#63BEE8',
  townViolet: '#B790ED',
  townCoralNight: '#755270',
  townBlueNight: '#4E668A',
  townVioletNight: '#6D5A86',
  townRoadDay: '#AFA9A2',
  townRoadNight: '#4C4744',
  townSidewalkDay: '#E4D1A4',
  townSidewalkNight: '#6C6257',
  aqua: '#4CC9F0',
  aquaDeep: '#2FA9D0',
  mint: '#70DC87',
  oceanDayA: '#36A9D2',
  oceanDayB: '#68D6E7',
  oceanNightA: '#294B68',
  oceanNightB: '#3D6A7E',
  sandDayFar: '#E3C17D',
  sandDayNear: '#FFDFA0',
  sandNightFar: '#7A674A',
  sandNightNear: '#5D503E',
  foamDay: '#F7FFFF',
  foamDayShade: '#BDEAF0',
  foamNight: '#A2BCCB',
  foamNightShade: '#66869B',
  grassBeachDay: '#7D9B55',
  grassBeachNight: '#41543C',
  starfish: '#FF7A59',
  pennantRed: '#FF625B',
  pennantYellow: '#FFD84D',
  pennantBlue: '#55C8F2',
  pennantGreen: '#7BD889',
  glassNight: '#EFCF78',
  glassDay: '#FFF6D6',
  bedRim: '#6D4D99',
  bedWall: '#8E69BE',
  bedCushion: '#F7EAFE',
} as const;
