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
  home: '#6D4E2D',
  park: '#426132',
  town: '#5B4934',
  beach: '#8B7047',
} as const;

/** The dig spot at the park: turned earth. */
export const DIRT = {
  mound: '#9A6A35',
  shade: '#704820',
  hole: '#49311C',
  light: '#C89252',
  edge: '#5F3E20',
} as const;

/** The same spot at the beach: wet sand. */
export const SAND = {
  mound: '#E5C28D',
  shade: '#BC9462',
  ripple: '#94704A',
  light: '#FFE2AE',
  edge: '#9E774D',
} as const;

/** Metal on props and status dots — his tag, a buckle, a warning light. */
export const BRASS = {
  light: '#FFE29A',
  mid: '#D7A340',
  dark: '#855612',
  polished: '#D29B28',
  warm: '#E5B44A',
  shade: '#A87520',
  pale: '#E2C67B',
  edge: '#6F480E',
} as const;

/** Foliage, for anything growing. */
export const LEAF = {
  light: '#8ADE68',
  mid: '#58B84A',
  dark: '#347C36',
  grey: '#6F8D62',
  shine: '#C6F4A3',
} as const;

/** His ball. A red rubber ball with a seam, not a themed UI accent. */
export const BALL = {
  body: '#E75142',
  seam: '#9D2D22',
  gloss: '#FFFFFF',
  edge: '#7B251D',
} as const;

/**
 * The things you can buy, drawn rather than typed.
 */
export const ITEM = {
  biscuit: '#F0D99B',
  biscuitEdge: '#B98B4E',
  cheese: '#FFD756',
  cheeseEdge: '#B98519',
  cheeseHole: '#D9A522',
  steak: '#D65C55',
  steakFat: '#FFE5CD',
  steakEdge: '#893832',
  rope: '#E6C684',
  ropeShade: '#A97A3E',
  bed: '#A56FE2',
  bedRim: '#67439B',
  bedCushion: '#FFF0FF',
  rug: '#EA836A',
  rugInner: '#FFB08D',
  rugEdge: '#AA4B3F',
  glass: '#9EDFF0',
  glassSill: '#C9914F',
  leather: '#4A3426',
  stick: '#754727',
  stickLight: '#B77B43',
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
  cream: '#FFF5D8',
  paleCream: '#FFF9E8',
  butter: '#FFE66A',
  butterDeep: '#F1B82C',
  lemon: '#FFD84D',
  coral: '#FF6F61',
  coralDeep: '#C8473F',
  coralLight: '#FFAA8D',
  coralShine: '#FFD1C6',
  violet: '#A85BC4',
  violetDeep: '#71378C',
  violetLight: '#D187E3',
  violetShine: '#EFB4F6',
  violetNight: '#684578',
  violetNightLight: '#8A61A0',
  aqua: '#4CC9F0',
  aquaDeep: '#238FB6',
  aquaLight: '#A6EBFB',
  mint: '#70DC87',
  mintDeep: '#3A9A57',
  mintLight: '#B7F1C3',

  skyMorningA: '#FFD57C',
  skyMorningB: '#BDEBFF',
  skyDayA: '#64C9FF',
  skyDayB: '#DDF7FF',
  skyEveningA: '#FF8D75',
  skyEveningB: '#FFD3A0',
  skyNightA: '#4D4F90',
  skyNightB: '#8176B6',

  wallDayA: '#FFF2BE',
  wallDayB: '#FFD6AE',
  wallDayEdge: '#E4A96E',
  wallNightA: '#625E9F',
  wallNightB: '#71689D',
  wallNightEdge: '#49446F',

  floorDayFar: '#EBC989',
  floorDayNear: '#C7834F',
  floorDayEdge: '#965A36',
  floorNightFar: '#8C745B',
  floorNightNear: '#604C3C',
  floorNightEdge: '#44362D',
  woodDay: '#865834',
  woodNight: '#5A4436',
  woodWarm: '#B67847',
  woodDark: '#493326',
  woodMid: '#744A30',
  woodDeep: '#33261F',
  woodSoft: '#E7A95E',
  woodShine: '#F8D49A',

  gold: '#FFC95B',
  goldDeep: '#C2851E',
  goldLight: '#FFF1B3',
  goldGlow: '#FFE987',
  goldGlowSoft: '#FFF0A0',

  windowFrameDay: '#E2A24D',
  windowFrameDayEdge: '#A76525',
  windowFrameNight: '#E7C77B',
  windowFrameNightEdge: '#947337',
  windowSillDay: '#BC7C3C',
  windowSillNight: '#C7A95C',
  hillDay: '#77C66D',
  hillNight: '#3E5F59',

  couchDay: '#F56F65',
  couchDayTop: '#FF9B89',
  couchDaySeat: '#FFAF97',
  couchDayEdge: '#B84B47',
  couchNight: '#84505E',
  couchNightTop: '#A66372',
  couchNightSeat: '#B8797D',
  couchNightEdge: '#563441',

  parkHillDay: '#93D86D',
  parkHillDayEdge: '#5EAA48',
  parkHillNight: '#486441',
  parkHillNightEdge: '#30482F',
  parkGrassDay: '#62C64B',
  parkGrassDayLight: '#A4EA79',
  parkGrassDayEdge: '#348A39',
  parkGrassNight: '#365337',
  parkGrassNightLight: '#547351',
  parkGrassNightEdge: '#253C2B',
  parkTreeDay: '#53AD43',
  parkTreeDayLight: '#82D95A',
  parkTreeDayShine: '#C2F29A',
  parkTreeDayEdge: '#2F7932',
  parkTreeNight: '#315032',
  parkTreeNightLight: '#49694A',
  parkTreeNightEdge: '#203621',
  parkPathDay: '#F7DEA2',
  parkPathDayLight: '#FFF0C5',
  parkPathDayEdge: '#C89A59',
  parkPathNight: '#7D7154',
  parkPathNightLight: '#A29776',
  parkPathNightEdge: '#554B38',

  townCoral: '#F57B84',
  townCoralLight: '#FFB0B5',
  townCoralEdge: '#B34A55',
  townBlue: '#58C2EA',
  townBlueLight: '#A8E9FA',
  townBlueEdge: '#288AB2',
  townViolet: '#B68AEE',
  townVioletLight: '#DFC3FF',
  townVioletEdge: '#7550AE',
  townCoralNight: '#755270',
  townBlueNight: '#4E668A',
  townVioletNight: '#6D5A86',
  townRoadDay: '#AFA9A2',
  townRoadDayEdge: '#817A73',
  townRoadNight: '#4C4744',
  townRoadNightEdge: '#363230',
  townSidewalkDay: '#E8D3A2',
  townSidewalkDayLight: '#FFF0C4',
  townSidewalkDayEdge: '#B89A65',
  townSidewalkNight: '#6C6257',
  townSidewalkNightEdge: '#4B443D',

  oceanDayA: '#31ADD9',
  oceanDayB: '#69D9E8',
  oceanDayLight: '#B8F4FB',
  oceanDayEdge: '#1B7FA8',
  oceanNightA: '#294B68',
  oceanNightB: '#3D6A7E',
  oceanNightLight: '#719BB0',
  oceanNightEdge: '#1E394F',
  sandDayFar: '#E6BE76',
  sandDayNear: '#FFE0A0',
  sandDayLight: '#FFF1C9',
  sandDayEdge: '#BA8954',
  sandNightFar: '#7A674A',
  sandNightNear: '#5D503E',
  sandNightLight: '#95826A',
  sandNightEdge: '#463C30',
  foamDay: '#F7FFFF',
  foamDayShade: '#BDEAF0',
  foamNight: '#A2BCCB',
  foamNightShade: '#66869B',
  grassBeachDay: '#7D9B55',
  grassBeachLight: '#B3CC78',
  grassBeachNight: '#41543C',
  starfish: '#FF7A59',

  pennantRed: '#FF625B',
  pennantYellow: '#FFD84D',
  pennantBlue: '#55C8F2',
  pennantGreen: '#7BD889',

  glassNight: '#F1D584',
  glassNightEdge: '#9E7A31',
  glassDay: '#EAF9FF',
  glassDayEdge: '#7FB6CB',
  glassShine: '#FFFFFF',

  bedRim: '#8055B8',
  bedWall: '#A879DB',
  bedCushion: '#F7EAFE',
  bedEdge: '#56347F',

  /** Small reusable accents used by scenery, never UI chrome. */
  flowerPink: '#FF7DAE',
  flowerBlue: '#75D8FF',
  flowerYellow: '#FFE26B',
  planter: '#F08B57',
  planterEdge: '#A64F31',
  signFace: '#FFF3BF',
  signEdge: '#A87035',
} as const;