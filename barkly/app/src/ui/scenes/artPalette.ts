/**
 * Colours of the WORLD, as opposed to colours of the interface.
 *
 * The Store/HUD and Barkly himself already have the visual finish we want:
 * confident base colour, a darker moulded edge, one controlled highlight and
 * a clean contact shadow. The world uses the same MATERIAL LOGIC without
 * literally sharing UI tokens. Dirt remains dirt and grass remains grass, but
 * everything now has enough authored range to look manufactured rather than
 * like flat SVG fill.
 */

/** The ground he stands on, per place. Used to tint his shadow. */
export const GROUND = {
  home: '#6F471D',
  park: '#386024',
  town: '#584227',
  beach: '#956F37',
} as const;

/** The dig spot at the park: turned earth. */
export const DIRT = {
  mound: '#AA681F',
  shade: '#73400E',
  hole: '#41260F',
  light: '#E1963D',
  edge: '#5D3510',
} as const;

/** The same spot at the beach: wet sand. */
export const SAND = {
  mound: '#F8CD8C',
  shade: '#D09853',
  ripple: '#A06E39',
  light: '#FFECCA',
  edge: '#AD763B',
} as const;

/** Metal on props and status dots — his tag, a buckle, a warning light. */
export const BRASS = {
  light: '#FFE9B3',
  mid: '#F7AE24',
  dark: '#885100',
  polished: '#F5A704',
  warm: '#FFC038',
  shade: '#BD7703',
  pale: '#F8D474',
  edge: '#6B4000',
} as const;

/** Foliage, for anything growing. */
export const LEAF = {
  light: '#87F75A',
  mid: '#47CF33',
  dark: '#238225',
  grey: '#6A9558',
  shine: '#D2FFB0',
} as const;

/** His ball. A red rubber ball with a seam, not a themed UI accent. */
export const BALL = {
  body: '#FF4331',
  seam: '#AE1708',
  gloss: '#F8F7F7',
  edge: '#811308',
} as const;

/**
 * The things you can buy, drawn rather than typed.
 */
export const ITEM = {
  biscuit: '#FFE6A2',
  biscuitEdge: '#D08F39',
  cheese: '#FFDA64',
  cheeseEdge: '#CC8900',
  cheeseHole: '#FAB300',
  steak: '#F24A40',
  steakFat: '#FFF6EE',
  steakEdge: '#93261E',
  rope: '#FBD380',
  ropeShade: '#BD7B27',
  bed: '#AA64FB',
  bedRim: '#6230AA',
  bedCushion: '#FFF0FF',
  rug: '#FF8163',
  rugInner: '#FFC0A4',
  rugEdge: '#BE3928',
  glass: '#A6EDFF',
  glassSill: '#E39539',
  leather: '#432919',
  stick: '#7A3E15',
  stickLight: '#CF7A2B',
} as const;

/**
 * Authored toy-diorama palette.
 *
 * The important thing is not saturation. It is MATERIAL RANGE: most major
 * surfaces get a base, a lower edge/shade and a small highlight. That is what
 * makes the Store feel crisp and what the old backgrounds lacked.
 */
export const DIORAMA = {
  white: '#FFFFFF',
  ink: '#2B2119',
  inkSoft: '#574638',
  shadow: '#231A14',
  shadowSoft: '#493526',
  cream: '#FFFBF0',
  paleCream: '#FFFBF0',
  butter: '#FFE97B',
  butterDeep: '#FFBF23',
  lemon: '#FFDB59',
  coral: '#FF7D71',
  coralDeep: '#E52F23',
  coralLight: '#FFBBA4',
  coralShine: '#FFEBE6',
  violet: '#B449DB',
  violetDeep: '#722497',
  violetLight: '#E184F7',
  violetShine: '#F9C6FF',
  violetNight: '#67377C',
  violetNightLight: '#8E54AD',
  aqua: '#47D3FF',
  aquaDeep: '#049AD0',
  aquaLight: '#BCF2FF',
  mint: '#65F483',
  mintDeep: '#25A94D',
  mintLight: '#C5FED1',

  /*
   * SKY AND HIGHLIGHTS KEEP THEIR CHROMA.
   *
   * The pale ends of these ramps were all within a few percent of white
   * (#F0FBFF sky, #FFF8E5 path, #FFF2D3 sand, #F0FFFF foam). Sky is the single
   * largest surface in three of the four locations, so a near-white lower stop
   * put a wide band of colourless pixels in every outdoor frame -- most of what
   * `art-lab-sheet.py` was reporting as Town's 22% "washed" share. A Clash Mini
   * sky is saturated all the way down to the horizon; the horizon reads as
   * lighter because it is lighter in VALUE, not because it is grey.
   */
  skyMorningA: '#FFDB90',
  skyMorningB: '#B9E7FF',
  skyDayA: '#74CFFF',
  skyDayB: '#B7E9FF',
  skyEveningA: '#FF9C88',
  skyEveningB: '#FFDFBA',
  skyNightA: '#3E409B',
  skyNightB: '#7D6EC5',

  wallDayA: '#FFF9E8',
  wallDayB: '#FFD2A5',
  wallDayEdge: '#E28D44',
  wallNightA: '#5650AC',
  wallNightB: '#6A5DA8',
  wallNightEdge: '#3E3771',

  floorDayFar: '#EEC273',
  floorDayNear: '#BC6A31',
  floorDayEdge: '#793C1E',
  floorNightFar: '#947350',
  floorNightNear: '#5E4430',
  floorNightEdge: '#3C2C21',
  woodDay: '#8F5121',
  woodNight: '#573B29',
  woodWarm: '#CD7530',
  woodDark: '#422819',
  woodMid: '#78411F',
  woodDeep: '#271A13',
  woodSoft: '#FFB051',
  woodShine: '#FFDFAB',

  gold: '#FFCE6A',
  goldDeep: '#DC8A00',
  goldLight: '#FFF6D0',
  goldGlow: '#FFED9D',
  goldGlowSoft: '#FFF4BA',

  windowFrameDay: '#FFA938',
  windowFrameDayEdge: '#BB6109',
  windowFrameNight: '#FED574',
  windowFrameNightEdge: '#A27422',
  windowSillDay: '#D67C21',
  windowSillNight: '#DEB54A',
  hillDay: '#6FDA61',
  hillNight: '#325D55',

  couchDay: '#FF746A',
  couchDayTop: '#FFAE9F',
  couchDaySeat: '#FFC2AF',
  couchDayEdge: '#D0352F',
  couchNight: '#8B4356',
  couchNightTop: '#B5566B',
  couchNightSeat: '#C77277',
  couchNightEdge: '#522838',

  parkHillDay: '#90D95E',
  parkHillDayLight: '#C2ED85',
  parkHillDayEdge: '#5C993D',
  parkHillNight: '#3E6335',
  parkHillNightEdge: '#244123',
  parkGrassDay: '#5DCB3F',
  parkGrassDayLight: '#A9E873',
  parkGrassDayEdge: '#2F7C2E',
  parkGrassNight: '#2A4E2B',
  parkGrassNightLight: '#4B7547',
  parkGrassNightEdge: '#19321F',
  parkTreeDay: '#43C22C',
  parkTreeDayLight: '#7EF447',
  parkTreeDayShine: '#CDFFA4',
  parkTreeDayEdge: '#1D7F21',
  parkTreeNight: '#254B26',
  parkTreeNightLight: '#3E6940',
  parkTreeNightEdge: '#142A15',
  parkPathDay: '#FFE9B3',
  parkPathDayLight: '#FFEFC4',
  parkPathDayEdge: '#E0A046',
  parkPathNight: '#817149',
  parkPathNightLight: '#AD9D6F',
  parkPathNightEdge: '#51442C',

  townCoral: '#F47163',
  townCoralLight: '#FFB7AC',
  townCoralEdge: '#A23F38',
  townBlue: '#42BEE2',
  townBlueLight: '#B0E7F1',
  townBlueEdge: '#25829F',
  townViolet: '#AC78C7',
  townVioletLight: '#E0C2E6',
  townVioletEdge: '#6A4780',
  townCoralNight: '#774871',
  townBlueNight: '#406193',
  townVioletNight: '#6A4F8C',
  /*
   * The road is the single biggest surface in Town and it was a desaturated
   * warm grey (#BFB09F), which is why Town alone stayed at 34% dead-grey
   * pixels after every other scene cleared the target -- the storefronts were
   * already candy-coloured, but they sit on top of a large neutral slab. A
   * Clash Mini board has no true greys in it: even the paving reads as a warm
   * tinted material. See docs/ART_DIRECTION.md.
   */
  townRoadDay: '#D9B57E',
  townRoadDayEdge: '#A6773F',
  townRoadNight: '#4E3B45',
  townRoadNightEdge: '#2E2130',
  townSidewalkDay: '#F8E0A8',
  townSidewalkDayLight: '#FFEEB8',
  townSidewalkDayEdge: '#CBA157',
  townSidewalkNight: '#765E45',
  townSidewalkNightEdge: '#4B3C2C',

  oceanDayA: '#23ADD6',
  oceanDayB: '#67D3E3',
  oceanDayLight: '#C4EEEE',
  oceanDayEdge: '#1D718F',
  oceanNightA: '#194469',
  oceanNightB: '#2D6A85',
  oceanNightLight: '#68A2BF',
  oceanNightEdge: '#102F49',
  sandDayFar: '#EFC56F',
  sandDayNear: '#FFDC93',
  sandDayLight: '#FFE6AE',
  sandDayEdge: '#A9723C',
  sandNightFar: '#7F653D',
  sandNightNear: '#5B4A32',
  sandNightLight: '#9E8361',
  sandNightEdge: '#3E3324',
  foamDay: '#D8FAFF',
  foamDayShade: '#CDF7FC',
  foamNight: '#A6C6D9',
  foamNightShade: '#5B88A6',
  grassBeachDay: '#7EA846',
  grassBeachLight: '#BEE06F',
  grassBeachNight: '#374F31',
  starfish: '#FF8567',

  pennantRed: '#FF706A',
  pennantYellow: '#FFDB59',
  pennantBlue: '#54D1FF',
  pennantGreen: '#73ED86',

  glassNight: '#FFE189',
  glassNightEdge: '#AF7E19',
  glassDay: '#F0FBFF',
  glassDayEdge: '#79C2DD',
  glassShine: '#F8F7F7',

  bedRim: '#7E42CD',
  bedWall: '#AE71F1',
  bedCushion: '#FAF0FF',
  bedEdge: '#502286',

  /** Small reusable accents used by scenery, never UI chrome. */
  flowerPink: '#FF91BA',
  flowerBlue: '#88DDFF',
  flowerYellow: '#FFE57C',
  planter: '#FF8E54',
  planterEdge: '#BA4118',
  signFace: '#FFF9DE',
  signEdge: '#BC6E1C',
} as const;
