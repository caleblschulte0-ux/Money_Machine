import { TONE } from './worldPalette';

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
  home: TONE.wood.deep,
  park: TONE.grass.deep,
  town: TONE.paving.deep,
  beach: TONE.sand.deep,
} as const;

/** The dig spot at the park: turned earth. */
/*
 * DIRT and SAND used to live here: the colours of the park's dig mound and the
 * beach's search spot, when both were hand-drawn SVG. Both are Blender props
 * now (tools/blender/world_prop_pack.py, `_mound`), which is where their
 * colours went with them -- and this file only holds colours something in
 * `src/` actually paints with.
 */

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
  shadow: TONE.ink.deep,
  cream: TONE.cream.lit,
  paleCream: '#FFFBF0',
  butter: '#FFE97B',
  butterDeep: '#FFD87A',
  lemon: '#FFE27A',
  coral: '#FF867A',
  coralDeep: '#E5756E',
  coralLight: '#FFBBA4',
  violet: '#BD69DB',
  violetDeep: '#7E4897',
  violetNight: '#683C7C',
  aqua: '#7ADFFF',
  aquaDeep: '#64B3D0',
  aquaLight: '#BCF2FF',
  mint: '#75F490',
  mintDeep: '#51A96C',

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
  /*
   * THE SKY HAS A ZENITH NOW, and it did not before.
   *
   * Measured 2026-09-08: the sky band carried the least value range in the
   * whole picture -- the beach at 14:00 spanned 70 of 255 against its ground's
   * 142 -- and MORNING spanned 1.8. Its two stops were 221.2 and 223.0: a flat
   * wash with a name. It was also upside down, gold at the top and blue at the
   * horizon, which is a sunrise happening in the wrong half of the sky.
   *
   * Three stops per band, deep overhead to bright at the horizon, the way a
   * sky actually is. The warm end of morning and evening now sits where the
   * sun is rather than above the player's head.
   */
  skyMorningZenith: TONE.sky.shade,
  skyMorningA: '#FFDB90',
  skyMorningB: TONE.sky.pop,
  /* Aerial perspective. `hazeDay` is the sky a distant prop wears; `hazeNight`
     is the blue the master grade already washes the world with after dark. */
  hazeMorning: TONE.sand.lit,
  hazeDay: TONE.sky.lit,
  hazeEvening: TONE.brick.lit,
  hazeNight: '#4C509E',
  groundHazeMorning: TONE.sand.lit,
  groundHazeDay: TONE.sky.lit,
  groundHazeEvening: TONE.brick.lit,
  groundHazeNight: '#4C509E',
  groundDeepenDay: TONE.ink.deep,
  groundDeepenNight: '#121022',
  skyDayZenith: TONE.sky.base,
  skyDayA: TONE.sky.lit,
  skyDayB: TONE.sky.pop,
  skyEveningZenith: '#7A6BA8',
  skyEveningA: '#FF9C88',
  skyEveningB: TONE.sand.lit,
  skyNightZenith: '#2E2E5F',
  skyNightA: '#4A4C9B',
  skyNightB: '#7D6EC5',

  wallDayA: TONE.cream.lit,
  wallDayB: TONE.sand.lit,
  wallNightA: '#5853AC',
  wallNightB: '#6A5DA8',

  /*
   * THE DARK HALF OF "STRONG WINDOW LIGHT".
   *
   * The room's own target line is "strong window light", and it had the light:
   * a gold trapezoid laid down the floor in the floor's own perspective. What
   * a window actually does is BOTH -- it lights what it faces and leaves
   * everything else in the room's ambient, which is the part that was missing.
   * Measured across the pass that lowered the world's sun, home was the only
   * one of the four locations whose share of pixels below value 0.25 did not
   * move at all: 7.6% before, 7.6% after. The furniture got relit; the room it
   * stands in is drawn here, and nothing here knew about it.
   *
   * The hue is not a new decision. It is the SKY family's hue (205) at a
   * shadow's value -- the same hue `palette.light_rgb("fill")` gives every
   * rendered prop's shadow side, so the shade in the room and the shade on the
   * couch standing in it come from one sky. That is the whole reason the four
   * locations read as one game, and the room was outside it.
   */
  roomShade: '#273F51',

  floorDayFar: '#EEC273',
  floorDayNear: '#BC825A',
  floorDayEdge: '#794F3A',
  /*
   * THE NIGHT FLOOR IS COOL, BECAUSE THE NIGHT IS.
   *
   * These were the day floor's warm browns (hue 24-31) at a lower value, and
   * the night grade lays a deep blue over them at 0.42-0.50 alpha. Warm brown
   * under strong blue mixes toward grey, and the floor is the bottom half of
   * the frame -- which is why home-night measured 0.383 chroma / 17.5%
   * colourless in the shipping table, the worst cell in it by some way, in
   * the room a player spends most of their time in.
   *
   * Moved into the same violet family the night wall already uses (hue ~250)
   * at the same saturation they had, so the wash no longer has to fight the
   * art. The lamp's own warm pool still lands on top and reads warmer for
   * having something cool to sit against.
   */
  floorNightFar: '#5A4A8E',
  floorNightNear: '#3E3266',
  floorNightEdge: '#2A2145',
  /*
   * The trim at night, moved into the same violet family as the wall and the
   * floor above.
   *
   * It was the day wood's warm brown (hue 23) and it runs the full width of
   * the frame twice -- the ceiling line and the skirting -- so it was the last
   * warm element left fighting the blue wash after the floor changed.
   *
   * HONEST RESULT: on its own this measured INSIDE the run-to-run noise of the
   * palette instrument (home-night 16.9% -> 16.8% colourless, against +-0.7pts
   * of noise). It is kept for colour coherence with the floor and wall, NOT
   * because it moved a number. The floor change is the one that did the work.
   */
  woodNight: '#453458',
  woodWarm: '#CD9162',
  woodDark: '#422C20',
  woodMid: '#78513A',
  woodDeep: '#271A13',
  woodSoft: '#FFC37A',
  woodShine: '#FFDFAB',

  gold: '#FFD37A',
  goldDeep: '#DCB16A',
  goldLight: '#FFF6D0',
  goldGlow: '#FFED9D',
  goldGlowSoft: '#FFF4BA',

  windowFrameDay: '#FFC67A',
  windowFrameDayEdge: '#BB8A5A',
  windowFrameNight: '#FED77A',
  windowFrameNightEdge: '#A2844E',
  windowSillNight: '#DEBE6B',
  hillDay: '#76DA69',
  hillNight: '#325D55',

  couchDay: '#FF837A',
  couchDayTop: '#FFAE9F',
  couchDaySeat: '#FFC2AF',
  couchDayEdge: '#D06864',
  couchNight: '#8B4356',
  couchNightTop: '#B5576C',
  couchNightSeat: '#C77277',
  couchNightEdge: '#522838',

  parkHillDay: '#96D968',
  parkHillDayLight: '#C2ED85',
  parkHillDayEdge: '#649949',
  parkHillNight: '#3E6335',
  /*
   * THE LIGHT ON THE CHARACTER, per hour and per place.
   *
   * These are the colour a scene's light casts on Barkly and the dogs with
   * him, consumed by sceneLight() in WorldScene. They live here rather than in
   * that file because every colour in this game lives here -- and because the
   * night pair is a deliberate statement about two different situations: a
   * room at night is lit by its own lamp and stays warm, while outdoors is
   * moonlight. One cool dim everywhere is what made the living room read as
   * the same blue as the beach.
   */
  lightMorningWarm: '#FFD9A8',
  lightMorningOpen: '#FFE0AE',
  lightMorningStreet: '#FFD9B2',
  lightMorningShore: '#FFE6BE',
  lightDayWarm: '#FFF3DE',
  lightDayOpen: '#EEFFDF',
  lightDayStreet: '#FFF6E6',
  lightDayShore: '#FFF8E4',
  lightEveningWarm: '#FFB07A',
  lightEveningOpen: '#FFA98C',
  lightEveningStreet: '#FFAE8E',
  lightEveningShore: '#FF9F86',
  lightNightLamp: '#FFC98A',
  lightNightOpen: '#7C93D8',
  lightNightStreet: '#8C9AD6',
  lightNightShore: '#7488D2',
  parkGrassDay: '#78CB61',
  parkGrassDayLight: '#A9E873',
  parkGrassDayEdge: '#3C7C3C',
  parkGrassNight: '#2A4E2B',
  parkGrassNightLight: '#4B7547',
  parkGrassNightEdge: '#19321F',
  parkTreeDay: '#6DC25D',
  parkTreeDayLight: '#9DF475',
  parkTreeDayEdge: '#3D7F40',
  parkTreeNight: '#254B26',
  parkTreeNightLight: '#3E6940',
  parkTreeNightEdge: '#142A15',
  parkPathDay: '#FFE9B3',
  parkPathDayLight: '#FFEFC4',
  parkPathDayEdge: '#E0B06C',
  parkPathNight: '#817149',
  parkPathNightLight: '#AD9D6F',
  parkPathNightEdge: '#51442C',

  townBlueEdge: '#4C8B9F',
  /*
   * The road is the single biggest surface in Town and it was a desaturated
   * warm grey (#BFB09F), which is why Town alone stayed at 34% dead-grey
   * pixels after every other scene cleared the target -- the storefronts were
   * already candy-coloured, but they sit on top of a large neutral slab. A
   * Clash Mini board has no true greys in it: even the paving reads as a warm
   * tinted material. See docs/ART_DIRECTION.md.
   */
  /*
   * TOWN'S GROUND CARRIES TOWN'S COLOUR.
   *
   * Measured over the scene band, town ran mean_sat 0.346 and p90 0.490 against
   * a 0.42-0.55 / 0.65+ target -- the only location outside it, and by a
   * distance. Broken down by band the frame was evenly pale rather than having
   * one bad element: sky 0.322, storefronts 0.336, pavement 0.388. The sky is
   * shared with Park, which measures 0.505, so the sky is not the culprit --
   * Park simply has a big saturated green mass and Town had nothing to anchor
   * it. The storefronts are authored PNGs.
   *
   * That leaves the ground, which is Town's second-largest surface. Each stop
   * below had its CHROMA raised with its hue and its VALUE held exactly, so
   * nothing darkens, the ramp keeps its shape, and the accessibility contrast
   * checks see the same luminance family they passed on.
   */
  townRoadDay: '#D9AC68',
  townRoadDayEdge: '#A67F50',
  townRoadNight: '#4E3B45',
  townRoadNightEdge: '#2E2130',
  /*
   * The pavement is the single biggest surface in Town -- 19.3% of the frame,
   * measured -- and it was one flat #F8E0A8 slab at 0.30 chroma, which is why
   * Town sat 0.10 below every other scene at every hour. Park's dominant
   * surface is 24% of ITS frame and reads rich because it is a ramp of related
   * greens rather than one fill. Same treatment: a far tone that holds warmth
   * at the horizon, a near tone with real chroma under the player's feet.
   */
  townSidewalkDay: '#F4CB75',
  townSidewalkDayFar: '#FFDC8A',
  townSidewalkDayNear: '#E0B46C',
  townSidewalkDayEdge: '#B99459',
  townSidewalkNight: '#6E5740',
  townSidewalkNightFar: '#87694C',
  townSidewalkNightNear: '#574333',
  townSidewalkNightEdge: '#40331F',

  /*
   * The Beach had no dark in it. Measured over the scene band, pixels darker
   * than 0.45 value: Park 22.9%, Town 16.4%, Home 12.7%, Beach 6.6% -- and its
   * 5th-percentile value was 0.408 against roughly 0.28 everywhere else. There
   * was literally no shadow in the picture, which is why it read flat at every
   * hour and had the lowest tonal spread of any location in the game.
   *
   * Deep water at the horizon and wet sand at the tide line are where a beach
   * keeps its darks, and both were missing: the sea was two bright cyans and
   * the damp strip was a 24%-opacity wash.
   */
  oceanDayDeep: '#396577',
  oceanNightDeep: '#17262F',
  sandDayWet: '#9C734B',
  sandDayNearDeep: '#BC8E5A',
  sandNightNearDeep: '#3A2F20',
  sandNightWet: '#33291C',
  oceanDayA: '#67BDD6',
  oceanDayB: '#6DD4E3',
  oceanDayLight: '#C4EEEE',
  oceanDayEdge: '#457B8F',
  oceanNightA: '#325069',
  oceanNightB: '#407085',
  oceanNightLight: '#68A2BF',
  oceanNightEdge: '#233849',
  sandDayFar: '#EFC673',
  sandDayNear: '#FFDC93',
  sandDayLight: '#FFE6AE',
  sandDayEdge: '#A97D51',
  sandNightFar: '#7F653D',
  sandNightNear: '#5B4A32',
  sandNightLight: '#9E8361',
  sandNightEdge: '#3E3324',
  starfish: '#FF957A',


  glassNight: '#FFE189',
  glassNightEdge: '#AF9154',
  glassDay: '#F0FBFF',
  glassDayEdge: '#79C2DD',

  bedRim: '#9062CD',
  bedWall: '#AF74F1',
  bedCushion: '#FAF0FF',
  bedEdge: '#604086',

  /** Small reusable accents used by scenery, never UI chrome. */
  planter: '#FFA77A',
  signFace: '#FFF9DE',
} as const;

/**
 * The 24 dug-up treasures, drawn by `ui/TreasureIcon`.
 *
 * Beach finds run cooler than park finds on purpose: a shelf holding both
 * should read as two places he has been, not one prop box.
 */
export const TREASURE = {
  cloth: '#7FB3E8',
  clothShade: '#5886B8',
  clothCuff: '#FFF3DC',
  leather: '#C99660',
  leatherShade: '#8A6442',
  stone: '#A9A296',
  stoneShade: '#6F6A60',
  stoneLight: '#D2CCC1',
  bone: '#FFF4DC',
  boneShade: '#CBB794',
  shell: '#FFD9C2',
  shellShade: '#D08E64',
  seaGlass: '#7FE0B4',
  seaGlassShade: '#4B9C7C',
  crab: '#FF957A',
  crabShade: '#C06B5C',
  paper: '#F6E7C2',
  paperShade: '#C6A971',
  ink: '#4A3B24',
  kelp: '#438B4F',
  kelpLight: '#69C06B',
  rubber: '#FFE27A',
  rubberShade: '#D9BA68',
  bill: '#FFBD7A',
  bread: '#F0C173',
  breadShade: '#C0975C',
  filling: '#8FC46A',
  disc: '#6FCCE8',
  discShade: '#4D88A0',
  shine: '#FFFFFF',
} as const;
