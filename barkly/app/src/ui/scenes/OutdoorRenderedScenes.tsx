import React, { useEffect, useRef } from 'react';
import { Animated, ColorValue, Easing, Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useAmbientLoop, useReduceMotion } from '../motion';
import { DIORAMA } from './artPalette';
import { skyBand, SkyBand } from './CandyScenesV2';
import { elevation, radius } from '../theme';
import { CHROME_BOTTOM } from '../layout';
import {
  baselineZ,
  crescentPath,
  RadialGlow,
  WorldLayer,
  WorldLighting,
  WorldMotion,
  WorldObject,
  WorldScene,
  worldScale,
  GroundHaze,
} from './WorldScene';

const PARK_TREE = require('../../../assets/world/park/props/tree.png');
const PARK_BENCH = require('../../../assets/world/park/props/bench.png');
const PARK_HEDGE = require('../../../assets/world/park/props/hedge.png');
const PARK_TREELINE = require('../../../assets/world/park/props/treeline.png');
const PARK_TUFT = require('../../../assets/world/park/props/grass_tuft.png');
const PARK_FLOWERS = require('../../../assets/world/park/props/wildflowers.png');
const PARK_CLUMP = require('../../../assets/world/park/props/grass_clump.png');

/**
 * GROUND COVER, PLACED BY HAND.
 *
 * The grass was one flat fill. Measured off a screenshot, a clean band of it
 * varied by a standard deviation of 28 -- and the town pavement by 4.6, and
 * the town sky by 4.3 -- which is what "painted, not built" looks like in a
 * number, and why a hand-modelled dog read as standing on green paper.
 *
 * Scatter rather than a texture: an orthographic camera at this yaw cannot be
 * made to tile seamlessly without fighting it, and scatter has the advantage
 * that it can be placed AROUND things. These positions are authored, not
 * generated, for exactly that reason -- the park's bottom band is committed to
 * the DIG badge and two NPC name plates, and `scripts/blocking.mjs` fails the
 * build if decoration lands on any of them. Decoration yields.
 *
 * `fx` is a fraction of the frame width and `dy` an offset down from the
 * horizon, so the scatter breathes with the viewport instead of clustering.
 */
/* The trimmed renders' own aspects. __tests__/scene_surfaces.test.ts holds these
   against the real PNGs, the same way the shop's item art is held. */
const TREELINE_ASPECT = 640 / 119;
const TUFT_ASPECT = 295 / 296;
const FLOWERS_ASPECT = 238 / 280;
const CLUMP_ASPECT = 403 / 295;

type Cover = { fx: number; dy: number; s: number; depth: number; flip?: boolean; flower?: boolean };
const PARK_COVER: readonly Cover[] = [
  // Far: small, just under the treeline, low contrast.
  { fx: 0.07, dy: 118, s: 0.40, depth: 0.26 },
  { fx: 0.30, dy: 132, s: 0.36, depth: 0.26, flip: true },
  { fx: 0.63, dy: 114, s: 0.42, depth: 0.26 },
  { fx: 0.88, dy: 136, s: 0.38, depth: 0.26, flip: true },
  { fx: 0.46, dy: 150, s: 0.44, depth: 0.30, flower: true },
  { fx: 0.18, dy: 158, s: 0.44, depth: 0.30 },
  // Mid: level with the far tree's foot and the bench.
  { fx: 0.10, dy: 226, s: 0.62, depth: 0.48 },
  { fx: 0.82, dy: 214, s: 0.66, depth: 0.48, flip: true },
  { fx: 0.26, dy: 250, s: 0.58, depth: 0.52, flower: true },
  { fx: 0.94, dy: 262, s: 0.62, depth: 0.54 },
  { fx: 0.68, dy: 236, s: 0.54, depth: 0.50, flip: true },
  // Lower mid: the last tier before the frame's bottom band, which belongs to
  // the DIG badge and two name plates. The NEAR tier is the two clumps in the
  // foreground layer -- cover this size at that distance stopped reading as
  // grass and started reading as spiky plants standing at the dog's chest.
  //
  // And there is nothing in the MIDDLE of this tier, because the middle of
  // that band is the dog. A tuft at fx 0.44 covered 65% of his face column at
  // 430x932 -- `scripts/prop-clear-check.mjs` caught it, and the answer is
  // never to move him. Between the badge on the left, the name plates and his
  // own silhouette, the lowest tier of cover only has the frame edges, which
  // is what depth costs.
  { fx: 0.04, dy: 352, s: 0.86, depth: 0.72 },
  { fx: 0.72, dy: 344, s: 0.82, depth: 0.72 },
  { fx: 0.97, dy: 380, s: 0.90, depth: 0.76, flip: true },
];

/**
 * The lowest a sky object may sit and still be seen.
 *
 * Measured, not guessed: the destination tabs end at y 109 at 360x568,
 * 360x780, 390x844 and 430x932 alike, and the scene renders underneath them
 * from y 0. Nine pixels of air above that.
 */
const CHROME_CLEAR = 118;

/*
 * The sky's own props. They belong to no location -- park, town and beach all
 * render one `SceneSky` -- so they live in `assets/world/sky/` rather than
 * being promoted three times.
 *
 * Widths in points; heights derived from the trimmed renders' own aspects,
 * which `__tests__/scene_surfaces.test.ts` holds against the files on disk.
 */
const CLOUD = require('../../../assets/world/sky/cloud.png');
const CLOUD_FAR = require('../../../assets/world/sky/cloud_far.png');
const CLOUD_ASPECT = 536 / 137;
const CLOUD_FAR_ASPECT = 361 / 93;
/*
 * Widths as a FRACTION of the viewport, capped. A flat 168 is 43% of a 390pt
 * phone and 39% of a 430pt one, which is a cloud that dominates the sky on the
 * small device and looks about right on the large one -- the same class of bug
 * as the window sun that was authored in pixels inside a pane derived from the
 * screen.
 */
const CLOUD_W = (width: number) => Math.min(150, width * 0.36);
const CLOUD_FAR_W = (width: number) => Math.min(94, width * 0.23);

/**
 * STREET BUNTING — the loudest thing in Town, on purpose.
 *
 * Town measured the palest of the four locations by a distance (mean_sat 0.340
 * against a 0.42-0.55 target) and it was evenly pale rather than having one bad
 * element: sky 0.322, storefronts 0.336, pavement 0.388. Raising the ground
 * ramp's chroma moved the whole frame only 0.340 -> 0.363, because the
 * storefronts are authored PNGs in pastel and nothing in the frame was
 * saturated enough to anchor it. Park reads rich at 0.504 because it has a big
 * confident green mass; Town had no equivalent.
 *
 * So Town gets what docs/VISUAL_DIRECTION_KIDS_GAME.md already asks it for --
 * "signs/awnings", "more vertical city rhythm than Park" -- as a line of flags
 * strung over the street in the candy family. It is high chroma in the part of
 * the frame that had least (the sky band), it crosses the whole width so the
 * street reads as continuing past both edges, and it gives the eye something
 * at the top of a scene whose interest was all in the lower half.
 */
function TownBunting({ top, night }: { top: number; night: boolean }) {
  const FLAGS = [
    DIORAMA.coral, DIORAMA.lemon, DIORAMA.aqua, DIORAMA.violet, DIORAMA.mint,
    DIORAMA.coral, DIORAMA.lemon, DIORAMA.aqua, DIORAMA.violet, DIORAMA.mint,
    DIORAMA.coral, DIORAMA.lemon,
  ];
  const W = 420;
  const SAG = 26;
  const H = SAG + 34;
  const step = W / (FLAGS.length - 1);
  // Its own box, at its own height. Drawing this into a `styles.fill` SVG
  // stretched the viewBox over the whole scene and put the flags somewhere
  // nobody asked for -- with preserveAspectRatio="none" a 204-unit box mapped
  // onto 844px moves every coordinate by a factor of four.
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top, height: H }} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <Path
          d={`M 0 2 Q ${W / 2} ${2 + SAG * 1.9} ${W} 2`}
          stroke={night ? DIORAMA.woodDeep : DIORAMA.woodWarm}
          strokeWidth={2.4}
          fill="none"
          opacity={night ? 0.5 : 0.85}
        />
        {FLAGS.map((fill, i) => {
          const t = i / (FLAGS.length - 1);
          // The point on that same curve, so each flag hangs from the string
          // rather than from a straight line pretending to be one.
          const y = 2 + 4 * (SAG * 0.95) * t * (1 - t);
          const x = i * step;
          const w = 13;
          const h = 19;
          const lean = (t - 0.5) * 13;
          return (
            <Path
              key={i}
              d={`M ${x - w / 2} ${y} L ${x + w / 2} ${y} L ${x + lean * 0.35} ${y + h} Z`}
              fill={fill}
              opacity={night ? 0.44 : 0.95}
            />
          );
        })}
      </Svg>
    </View>
  );
}


const TOWN_STORE_CORAL = require('../../../assets/world/town/props/store_coral.png');
const TOWN_STORE_AQUA = require('../../../assets/world/town/props/store_aqua.png');
const TOWN_STORE_VIOLET = require('../../../assets/world/town/props/store_violet.png');
const TOWN_FOUNTAIN = require('../../../assets/world/town/props/fountain.png');
const TOWN_LAMP = require('../../../assets/world/town/props/lamp.png');
const TOWN_PLANTER = require('../../../assets/world/town/props/planter.png');
const TOWN_ROOFTOPS = require('../../../assets/world/town/props/rooftops.png');
const TOWN_KERB = require('../../../assets/world/town/props/kerb.png');
const TOWN_PAVING = require('../../../assets/world/town/props/paving.png');
/* Trimmed renders' own aspects; __tests__/scene_surfaces.test.ts holds them. */
const ROOFTOPS_ASPECT = 640 / 144;
const KERB_ASPECT = 605 / 33;
const PAVING_ASPECT = 638 / 21;

/**
 * COURSES OF PAVING, RECEDING.
 *
 * The pavement below the kerb measured a standard deviation of 4.6 across the
 * whole band -- one fill, with three drawn hairlines standing in for joints.
 * Each entry is one rendered course: how far below the kerb line it sits, how
 * wide it runs (wider means nearer, and it crops off both frame edges, which
 * is the perspective), and a phase shift so the joints do not stack into
 * columns down the picture.
 *
 * They all stay ABOVE the name-plate band. A first pass ran four of them down
 * to dy 136 and `scripts/blocking.mjs` failed it: the third landed at y
 * 624..642, which is PEPPER's plate to the pixel. The mistake underneath was
 * arithmetic, not taste -- `sidewalk` is `Math.max(372, ground - 116)` and I
 * had reasoned about the 372, when the real value on a 390x844 frame is 529.
 * A clamp's floor is not the number the scene uses.
 *
 * Three courses, all in the upper part of the pavement, which is also where
 * they belong: joints compress with distance, so a course near the camera
 * would show one seam, not a run of them.
 *
 * The opacities are LOW on purpose. At better than half they stopped being
 * joints and became four sleepers laid across the pavement; a course you can
 * pick out individually is a course that has become an object.
 */
const TOWN_PAVING_COURSES: readonly { dy: number; w: number; phase: number; opacity: number }[] = [
  { dy: 4, w: 1.06, phase: 0.0, opacity: 0.30 },
  { dy: 26, w: 1.22, phase: 0.34, opacity: 0.38 },
  { dy: 56, w: 1.44, phase: 0.08, opacity: 0.46 },
];

const BEACH_UMBRELLA = require('../../../assets/world/beach/props/umbrella.png');
const BEACH_LIFEGUARD = require('../../../assets/world/beach/props/lifeguard.png');
const BEACH_DUNE = require('../../../assets/world/beach/props/dune.png');
const BEACH_CASTLE = require('../../../assets/world/beach/props/castle.png');
const BEACH_PALM = require('../../../assets/world/beach/props/palm.png');
const BEACH_HEADLAND = require('../../../assets/world/beach/props/headland.png');
const BEACH_SHELLS = require('../../../assets/world/beach/props/shells.png');
const BEACH_SURF = require('../../../assets/world/beach/props/surf.png');
const BEACH_MARRAM = require('../../../assets/world/beach/props/dune_grass.png');
const HEADLAND_ASPECT = 640 / 67;
const SURF_ASPECT = 640 / 55;
const SHELLS_ASPECT = 272 / 142;
const MARRAM_ASPECT = 212 / 249;

/**
 * WHAT GOES ON THE SAND.
 *
 * Measured off a screenshot, the beach sand varies by a standard deviation of
 * 8.0 -- 318 distinct colours across a 160x70 patch, and the same 318 on the
 * other side of the frame. It has a good gradient down it and still reads as
 * one fill, because a gradient is not texture.
 *
 * `dy` is measured down from the tide line rather than from the horizon, since
 * that is where this scene's ground actually starts. Same rule as the park:
 * clear of the SIFT badge and BISCUIT's plate, and clear of his face column,
 * both held by __tests__/scene_surfaces.test.ts.
 */
const BEACH_COVER: readonly Cover[] = [
  // Dry sand just up from the wet strip.
  { fx: 0.14, dy: 26, s: 0.42, depth: 0.30 },
  { fx: 0.44, dy: 34, s: 0.38, depth: 0.30, flip: true },
  { fx: 0.72, dy: 24, s: 0.44, depth: 0.30 },
  { fx: 0.90, dy: 40, s: 0.46, depth: 0.32, flower: true },
  // Mid beach. Nothing between fx 0.10 and 0.32 at this height: that is the
  // SIFT badge's column.
  { fx: 0.02, dy: 116, s: 0.62, depth: 0.50, flower: true },
  { fx: 0.52, dy: 128, s: 0.58, depth: 0.52 },
  { fx: 0.62, dy: 108, s: 0.66, depth: 0.50, flip: true },
  // Near. Clear of BISCUIT's plate on the left and of the middle, which is him.
  { fx: 0.36, dy: 206, s: 0.86, depth: 0.74, flip: true },
  // Not fx 0.94: at that width the shell lands entirely inside the right
  // dune, which `scripts/blocking.mjs` calls -- and calls correctly, because a
  // prop wholly inside another prop at the same distance is not depth, it is
  // clutter. The dune runs x 298..437 and the sandcastle x 271..381; this sits
  // in the gap left of both.
  { fx: 0.56, dy: 222, s: 0.92, depth: 0.76 },
];

/** Sun/moon geometry, shared by the body and the box its halo needs. */
const SUN_R = 25;
const SUN_INSET = 34;
const SKY_BODY = SUN_R * 2 * 3.4;

/*
 * AND THEY HAVE TO STAY OFF THE SUN.
 *
 * The far cloud shipped for one build at `right: 34` -- which is SUN_INSET,
 * the sun's own inset -- so it landed exactly on the disc. Measured on a 2x
 * beach capture: the sun went from 6,927 lit pixels to 160. The brightest
 * landmark in the sky, gone, and nothing failed. The sun's box is SKY_BODY
 * wide at SUN_INSET from the right, so the clouds get the space to the LEFT
 * of it and the disc keeps its corner.
 */
const SUN_ZONE = SUN_INSET + SKY_BODY;

/**
 * Canonical stage blocking. These are deliberate silhouette lanes, not a pile
 * of one-off offsets: the middle stays readable for Barkly, major landmarks
 * frame that lane, and supporting props stay near the edges.
 */
const COMPOSITION = {
  park: { treeLeft: -42, treeRight: -26, benchLeft: 214, hedgeLeft: 104, hedgeRight: 72, brushLeft: -64, brushRight: -37 },
  town: { sideStore: -154, centerStoreLeft: 94, lampLeft: 22, lampRight: 20, planterLeft: 2, planterRight: 4 },
  beach: { palmLeft: -30, towerLeft: 14, umbrellaRight: -12, duneLeft: -100, duneRight: -42, castleRight: 14 },
} as const;

const SKY: Record<SkyBand, readonly [ColorValue, ColorValue]> = {
  morning: [DIORAMA.skyMorningA, DIORAMA.skyMorningB],
  day: [DIORAMA.skyDayA, DIORAMA.skyDayB],
  evening: [DIORAMA.skyEveningA, DIORAMA.skyEveningB],
  night: [DIORAMA.skyNightA, DIORAMA.skyNightB],
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/*
 * The scene's ambient loops, all of them honouring reduce-motion.
 *
 * There were TWO copies of this hook in the app: one in ui/motion.ts that
 * checks the accessibility setting, and this one, which did not. The one that
 * checked lived in LivingScenes.tsx -- a file nothing had imported for a long
 * time -- and this one is the copy that actually ran. So the app contained a
 * correct implementation of "stop moving things" and every animation the player
 * could see ignored it.
 *
 * One copy now, read once per scene and passed down, because reading the
 * setting inside each of nine loops registers nine accessibility listeners to
 * answer the same question.
 */
// (the shared hooks come from ui/motion; see the note above)

/*
 * THE SUN IS A LIGHT, NOT A STICKER.
 *
 * It was a 50px `borderRadius: pill` View filled with one flat colour, and on
 * the contact sheet that is exactly what it read as -- a UI dot parked in the
 * corner of every outdoor scene. Nothing in the sky acknowledged it, so the
 * brightest object in the frame had no relationship to the frame.
 *
 * A radial bloom fixes that for the cost of one shared `RadialGlow`: the disc
 * keeps its authored position and size, and a halo 3.4x its radius fades to
 * nothing well inside the canvas so there is never a hard edge to the glow.
 */
function SkyBody({ night, discTop }: { night: boolean; discTop: number }) {
  const disc = night ? DIORAMA.goldLight : DIORAMA.lemon;
  const glow = night ? DIORAMA.goldGlow : DIORAMA.butter;
  const c = SKY_BODY / 2;
  return (
    <View style={[styles.skyBody, { top: discTop - (SKY_BODY / 2 - SUN_R) }]} pointerEvents="none">
      <RadialGlow
        cx={c}
        cy={c}
        r={c}
        color={glow}
        stops={night ? [0.34, 0.17, 0.05] : [0.52, 0.26, 0.09]}
      />
      <Svg width="100%" height="100%" viewBox={`0 0 ${SKY_BODY} ${SKY_BODY}`}>
        {night ? (
          <Path d={crescentPath(c, c, SUN_R, SUN_R * 0.92, 15, -9)} fill={disc} opacity={0.96} />
        ) : (
          <Circle cx={c} cy={c} r={SUN_R} fill={disc} />
        )}
      </Svg>
    </View>
  );
}

/*
 * `chromeBottom` is where the HUD ends, passed in the way HomeScene already
 * receives it. The sun used to sit at `Math.max(66, horizon - 126)` and got
 * tucked under the location tabs; the first fix raised that floor to a literal
 * 132, which was worse in a quieter way -- every scene clamps its horizon
 * (Park <= 184, Town <= 184, Beach <= 210), so `horizon - 96` is at most 114
 * and the second branch became UNREACHABLE. The disc stopped tracking the
 * horizon at all and became a constant that happened to look right on the one
 * device it was eyeballed on. The comment justifying it also cited 106 for
 * CHROME_BOTTOM, which is 98. A floor derived from the real chrome height
 * still clears the HUD on a notched phone, where `chromeBottom` grows with the
 * top inset and a hard-coded 132 would not.
 */
function SceneSky({ band, horizon, chromeBottom }: { band: SkyBand; horizon: number; chromeBottom: number }) {
  const night = band === 'night';
  const still = useReduceMotion();
  const drift = useAmbientLoop(15000, 0, still);
  const { width } = useWindowDimensions();
  const cloudW = CLOUD_W(width);
  const cloudFarW = CLOUD_FAR_W(width);
  // The far cloud's right edge, kept clear of the sun's box by construction
  // rather than by a literal that happened to look right on one phone.
  const cloudFarRight = Math.max(cloudW * 0.4, SUN_ZONE - SKY_BODY * 0.32);
  return (
    <View style={styles.fill}>
      <LinearGradient colors={SKY[band]} style={styles.fill} />
      <SkyBody night={night} discTop={Math.max(chromeBottom + 26, horizon - 96)} />
      {/*
        THE CLOUDS ARE RENDERS NOW.

        They were five white `borderRadius` Views stacked into a lumpy
        outline, and a comment here explained at length how to arrange pills
        so they stop reading as a UI panel. On a 2x capture of the beach at
        2pm the near one still read as a pale grey rounded slab under the tab
        bar, because the problem was never the arrangement: a capsule has one
        silhouette and one flat fill, and the sky was the largest surface in
        the frame still drawn that way while everything below the horizon is a
        Blender render. `tools/blender/world_prop_pack.py:sky_cloud`.

        Sized by WIDTH and the render's own aspect, like every other prop in
        this app since the dig mound shipped 22% squashed off a typed height.
      */}
      {/*
        AND THEY HAVE TO CLEAR THE TAB BAR.

        The old floor was 94 and the destination tabs end at 109 on every
        tested viewport, so whenever the horizon sat low enough for the clamp
        to bite -- town on a phone, every time -- the cloud's whole lumpy top
        hid behind the chrome and all that showed was its flat bottom edge.
        CHROME_CLEAR keeps the silhouette, which is the only part that reads.
      */}
      <Animated.View
        style={[
          styles.cloud,
          {
            top: Math.max(CHROME_CLEAR, horizon - 104),
            width: cloudW,
            height: cloudW / CLOUD_ASPECT,
            opacity: night ? 0.16 : 0.98,
            transform: [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-18, 22] }) }],
          },
        ]}
      >
        {/*
          The size lives on the IMAGE, not only on the wrapper.

          `styles.fill` is `position:absolute` with all four insets and no
          width -- which constrains a View, but not an Image: react-native-web
          renders one as a div carrying the PNG's own intrinsic size, and it
          wins. Measured off the live DOM: the wrapper was a correct 140x36
          and the image inside it 536x137, the file's pixel dimensions, spilling
          across the whole sky and swallowing the sun.
        */}
        <Image source={CLOUD} resizeMode="contain" style={{ width: cloudW, height: cloudW / CLOUD_ASPECT }} />
      </Animated.View>
      <Animated.View
        style={[
          styles.cloudFar,
          {
            top: Math.max(CHROME_CLEAR - 4, horizon - 152),
            right: cloudFarRight,
            width: cloudFarW,
            height: cloudFarW / CLOUD_FAR_ASPECT,
            opacity: night ? 0.09 : 0.70,
            transform: [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [14, -12] }) }],
          },
        ]}
      >
        <Image source={CLOUD_FAR} resizeMode="contain" style={{ width: cloudFarW, height: cloudFarW / CLOUD_FAR_ASPECT }} />
      </Animated.View>
    </View>
  );
}

function ParkMotion({ night, horizon }: { night: boolean; horizon: number }) {
  const still = useReduceMotion();
  const leaf = useAmbientLoop(6200, 0, still);
  const leafTwo = useAmbientLoop(7600, 1800, still);
  const butterfly = useAmbientLoop(5200, 900, still);
  return (
    <View style={styles.fill}>
      <Animated.View
        style={[
          styles.fallingLeaf,
          {
            top: horizon + 72,
            opacity: night ? 0.12 : 0.48,
            transform: [
              { translateX: leaf.interpolate({ inputRange: [0, 1], outputRange: [-30, 170] }) },
              { translateY: leaf.interpolate({ inputRange: [0, 1], outputRange: [0, 56] }) },
              { rotate: leaf.interpolate({ inputRange: [0, 1], outputRange: ['-20deg', '150deg'] }) },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.fallingLeaf,
          styles.fallingLeafSmall,
          {
            top: horizon + 112,
            opacity: night ? 0.08 : 0.34,
            transform: [
              { translateX: leafTwo.interpolate({ inputRange: [0, 1], outputRange: [390, 184] }) },
              { translateY: leafTwo.interpolate({ inputRange: [0, 1], outputRange: [0, 42] }) },
              { rotate: leafTwo.interpolate({ inputRange: [0, 1], outputRange: ['30deg', '-170deg'] }) },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.butterfly,
          {
            top: horizon + 176,
            opacity: night ? 0.05 : 0.48,
            transform: [
              { translateX: butterfly.interpolate({ inputRange: [0, 1], outputRange: [76, 314] }) },
              { translateY: butterfly.interpolate({ inputRange: [0, 0.5, 1], outputRange: [12, -14, 8] }) },
            ],
          },
        ]}
      >
        <View style={styles.butterflyLeft} />
        <View style={styles.butterflyRight} />
      </Animated.View>
    </View>
  );
}

/** Park keeps terrain live in code and composes independent rendered landmarks over it. */
export function ParkScene({ hour, bandHeight = 620, groundY, chromeBottom = CHROME_BOTTOM, motion = 'idle' }: { hour: number; bandHeight?: number; groundY?: number; chromeBottom?: number; motion?: WorldMotion }) {
  const { width, height } = useWindowDimensions();
  const scale = worldScale(width, height);
  const band = skyBand(hour);
  const night = band === 'night';
  const ground = groundY ?? bandHeight * 0.72;
  const canvasHeight = ground + 264;
  const horizon = clamp(ground - 416, 148, 184);
  const grassFar = night ? DIORAMA.parkGrassNightLight : DIORAMA.parkGrassDayLight;
  const grass = night ? DIORAMA.parkGrassNight : DIORAMA.parkGrassDay;
  const grassNear = night ? DIORAMA.parkGrassNightEdge : DIORAMA.parkGrassDayEdge;

  /*
   * FIVE DEPTH TIERS, NOT TWO.
   *
   * Measured at 390x844 the whole park lived between y90 and y400 -- two trees,
   * two far hedges, a bench -- and the entire band from there down to the care
   * tray held nothing but Barkly and the two visiting dogs. A background and an
   * actor plane, and no foreground at all, which is why the scene measured
   * 50.4% detail against Town's 79.0% and read as a wall of green with a dog in
   * front of it. `scripts/dead-space.py` is the number.
   *
   * Depth here is bought three ways, all of them cheap and none of them a new
   * asset: SCALE (the far tree is 0.76 of the near one, not 0.96 -- at 0.96 the
   * pair reads as one flat hedge-row), OVERLAP (the bench crosses the far
   * tree's trunk, the brush crosses everything), and CROPPING (the foreground
   * brush runs off both frame edges, which is the strongest distance cue
   * available and was simply absent).
   */
  const treeW = 204 * scale;
  const treeH = 292 * scale;
  // The far tree. Smaller AND higher: both, or it reads as a small tree
  // standing next to a big one rather than the same tree further away.
  const farTree = 0.76;
  /*
   * The bench used to sit at left:10, which put it from x5 to x128 -- inside
   * the left tree's trunk, at every viewport. It was not a near miss: it had
   * been pushed there deliberately to get it clear of the DIG mound, and the
   * trunk was never in that arithmetic. It lives in the midground now, right of
   * centre, where it crosses the FAR tree's trunk and reads as standing in
   * front of it.
   */
  const benchW = 128 * scale;
  const benchH = 94 * scale;
  const hedgeW = 142 * scale;
  const hedgeH = 72 * scale;
  /*
   * The foreground tier, and it is DELIBERATELY narrow.
   *
   * A full-width band of brush across the bottom is the textbook version and
   * this scene cannot have it: measured, the bottom of the park is entirely
   * committed already -- the DIG control's badge at x61..102 y453, BISCUIT's at
   * x28..92 y620, DUKE's at x304..353 y625. A first pass ran brush across both
   * corners and covered two of them. Names and controls are information; the
   * brush is decoration, and decoration yields.
   *
   * So it runs off the extreme edges only, clear of every badge, which still
   * buys the thing that was missing: something nearer than the actors, cropped
   * by the frame.
   */
  const brushW = 96 * scale;
  const brushH = 132 * scale;
  const wideInset = Math.max(14, (width - 720) / 2);
  const treeLeft = width >= 600 ? wideInset : COMPOSITION.park.treeLeft;
  const treeRight = width >= 600 ? wideInset + 40 : COMPOSITION.park.treeRight;
  const benchLeft = width >= 600 ? wideInset + treeW * 1.18 : COMPOSITION.park.benchLeft;
  const hedgeLeft = width >= 600 ? wideInset + treeW * 0.88 : COMPOSITION.park.hedgeLeft;
  const hedgeRight = width >= 600 ? wideInset + treeW * 0.72 : COMPOSITION.park.hedgeRight;
  const brushLeft = width >= 600 ? wideInset - 70 : COMPOSITION.park.brushLeft;
  const brushRight = width >= 600 ? wideInset - 76 : COMPOSITION.park.brushRight;
  const brushTop = ground - 206;

  return (
    <WorldScene motion={motion} testID="world-scene-park">
      <WorldLayer name="sky"><SceneSky band={band} horizon={horizon} chromeBottom={chromeBottom} /></WorldLayer>
      <WorldLayer name="ground"><Svg width="100%" height="100%" viewBox={`0 0 420 ${canvasHeight}`} preserveAspectRatio="none" style={styles.fill}>
        <Defs>
          <SvgLinearGradient id="parkGroundV3" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={grassFar} />
            <Stop offset="0.38" stopColor={grass} />
            <Stop offset="1" stopColor={grassNear} />
          </SvgLinearGradient>
        </Defs>
        <Path d={`M-20 ${horizon + 76}Q70 ${horizon - 12} 160 ${horizon + 50}Q246 ${horizon + 106} 330 ${horizon + 30}Q378 ${horizon - 2} 445 ${horizon + 50}V${canvasHeight}H-20Z`} fill={grassNear} />
        <Path d={`M-20 ${horizon + 61}Q70 ${horizon - 27} 160 ${horizon + 35}Q246 ${horizon + 91} 330 ${horizon + 15}Q378 ${horizon - 17} 445 ${horizon + 35}V${canvasHeight}H-20Z`} fill={night ? DIORAMA.parkHillNight : DIORAMA.parkHillDay} />
        <Path d={`M-20 ${horizon + 122}Q96 ${horizon + 48} 222 ${horizon + 92}Q322 ${horizon + 122} 448 ${horizon + 62}V${canvasHeight}H-20Z`} fill="url(#parkGroundV3)" />
        <Path d={`M36 ${ground + 28}q6 -12 12 0M48 ${ground + 28}q6 -14 12 0M166 ${ground + 78}q5 -11 10 0M176 ${ground + 78}q5 -13 10 0M246 ${ground + 36}q5 -10 10 0`} stroke={night ? DIORAMA.parkGrassNightLight : DIORAMA.parkGrassDayLight} strokeWidth={3} fill="none" opacity={0.72} />
        <Path d={`M84 ${ground + 92}l4 -6 4 6 4 -6 4 6M222 ${ground + 116}l4 -6 4 6 4 -6 4 6`} stroke={night ? DIORAMA.gold : DIORAMA.lemon} strokeWidth={2.5} fill="none" opacity={night ? 0.24 : 0.68} />
      </Svg>
        {/*
          THE TRAIL, IN PIXELS, BECAUSE 420-SPACE LIED AT WIDE ASPECTS.

          It was removed once for being "a roughly constant-width vertical
          ribbon", brought back with a proper taper, and measured -- at ONE
          viewport. At 390x844 the ground SVG's viewBox stretches 0.929 in x and
          0.929 in y, near enough uniform that an authored taper survives, which
          is exactly what I checked and exactly what generalises worst. At
          1024x768 the same viewBox stretches 2.44 in x against 0.94 in y: a
          2.6:1 anamorphic squash that flattens the taper back into a strip and
          reproduces the original defect on every wide screen.

          ChatGPT's world pass had already found this from the other end, and
          its note is the better description of the symptom: "the earlier path
          used the strongest warm value in the scene and read like a slide
          attached to the hero tree on every wide viewport." Both halves were
          true -- too wide AND too loud.

          So the trail gets its own SVG in REAL PIXELS (x is 1:1, y within ~6%),
          it narrows as the frame widens instead of spreading with it, and it is
          drawn a full stop softer. A path is a worn place in the grass, not a
          feature competing with the dog standing on it.
        */}
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${Math.max(1, width)} ${canvasHeight}`}
          preserveAspectRatio="none"
          style={styles.fill}
        >
          <Defs>
            <SvgLinearGradient id="parkTrailV5" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={night ? DIORAMA.parkPathNightEdge : DIORAMA.parkPathDay} stopOpacity={night ? 0.34 : 0.34} />
              <Stop offset="1" stopColor={night ? DIORAMA.parkPathNight : DIORAMA.parkPathDayLight} stopOpacity={night ? 0.20 : 0.16} />
            </SvgLinearGradient>
          </Defs>
          {(() => {
            const mid = width / 2;
            const top = horizon + 72;
            // Narrower as the frame widens: at 390 it is a path, and at 1024 a
            // proportional one would be a runway.
            const near = Math.min(width * 0.30, 128);
            const far = 11;
            return (
              <>
                <Path
                  d={`M${mid - far} ${top}Q${mid - far * 1.6} ${top + 190} ${mid - near} ${canvasHeight}L${mid + near} ${canvasHeight}Q${mid + far * 1.6} ${top + 190} ${mid + far} ${top}Z`}
                  fill="url(#parkTrailV5)"
                />
                <Path
                  d={`M${mid - far} ${top}Q${mid - far * 1.6} ${top + 190} ${mid - near} ${canvasHeight}`}
                  stroke={night ? DIORAMA.parkPathNightLight : DIORAMA.parkPathDayEdge}
                  strokeWidth={2}
                  fill="none"
                  opacity={night ? 0.14 : 0.20}
                />
                <Path
                  d={`M${mid + far} ${top}Q${mid + far * 1.6} ${top + 190} ${mid + near} ${canvasHeight}`}
                  stroke={night ? DIORAMA.parkPathNightLight : DIORAMA.parkPathDayEdge}
                  strokeWidth={2}
                  fill="none"
                  opacity={night ? 0.14 : 0.20}
                />
              </>
            );
          })()}
        </Svg>
        <GroundHaze horizon={horizon} height={canvasHeight} night={night} />
      </WorldLayer>
      <WorldLayer name="distant">
        {/*
          THE HORIZON. Sky met grass at a hard colour change with nothing
          between them, so the field had no far edge and the sky had nothing to
          sit behind. Overscanned past both frame edges: a horizon that stops
          inside the frame is a hedge.
        */}
        <WorldObject
          source={PARK_TREELINE}
          left={-24}
          top={horizon + 6}
          width={width + 48}
          height={(width + 48) / TREELINE_ASPECT}
          night={night}
          depth={0.14}
          opacity={0.92}
        />
        <WorldObject source={PARK_HEDGE} left={hedgeLeft} top={horizon + 43} width={hedgeW * 0.62} height={hedgeH * 0.62} night={night} depth={0.25} opacity={0.70} ambient="sway" />
        <WorldObject source={PARK_HEDGE} right={hedgeRight} top={horizon + 57} width={hedgeW * 0.55} height={hedgeH * 0.55} night={night} depth={0.22} opacity={0.62} ambient="sway" motionDelay={700} />
      </WorldLayer>
      {/*
        ONE layer for everything standing on the grass. WorldObject sorts these
        by their ground line, so the tree in front of the bench is a fact about
        where their feet are rather than about which WorldLayer someone filed
        them under -- which is the mistake that put a bench through a trunk.
      */}
      <WorldLayer name="landmark">
        {/* The grass, as grass. See PARK_COVER -- and it sits in this layer,
            not one of its own, so a tuft in front of the bench is a fact about
            where its roots are like everything else here. */}
          {PARK_COVER.map((c, i) => {
            const w = (c.flower ? 74 : 92) * c.s * scale;
            const h = w / (c.flower ? FLOWERS_ASPECT : TUFT_ASPECT);
            return (
              <WorldObject
                key={`cover-${c.fx}-${c.dy}`}
                source={c.flower ? PARK_FLOWERS : PARK_TUFT}
                left={width * c.fx - w / 2}
                top={horizon + c.dy - h}
                width={w}
                height={h}
                night={night}
                depth={c.depth}
                opacity={0.55 + 0.45 * c.depth}
                ambient="sway"
                motionDelay={220 * i}
                flip={c.flip}
              />
            );
          })}
        <WorldObject source={PARK_TREE} right={treeRight} top={horizon - 46} width={treeW * farTree} height={treeH * farTree} night={night} depth={0.34} ambient="sway" motionDelay={900} flip contactShadow />
        <WorldObject source={PARK_BENCH} left={benchLeft} top={horizon + 190} width={benchW} height={benchH} night={night} depth={0.70} contactShadow />
        <WorldObject source={PARK_TREE} left={treeLeft} top={horizon - 88} width={treeW} height={treeH} night={night} depth={0.62} ambient="sway" contactShadow />
      </WorldLayer>
      {/*
        The foreground was TWO SHRUNKEN COPIES OF THE TREE. That bought the
        cropping, which is the point of a foreground tier and was the thing
        actually missing -- but what a player sees in the bottom corners of a
        field is not a small tree, it is the grass they are standing in. Same
        placement, same crop, real ground cover, and bigger, because foreground
        earns its distance by being nearer than everything else.
      */}
      <WorldLayer name="foreground">
        <WorldObject source={PARK_CLUMP} left={brushLeft - 22} top={brushTop + 48} width={brushW * 1.5} height={(brushW * 1.5) / CLUMP_ASPECT} night={night} depth={0.97} ambient="sway" motionDelay={1500} />
        <WorldObject source={PARK_CLUMP} right={brushRight - 26} top={brushTop + 62} width={brushW * 1.4} height={(brushW * 1.4) / CLUMP_ASPECT} night={night} depth={1} ambient="sway" motionDelay={2100} flip />
      </WorldLayer>
      <WorldLayer name="fx"><ParkMotion night={night} horizon={horizon} /></WorldLayer>
      <WorldLighting ground={ground} night={night} band={band} />
    </WorldScene>
  );
}

function TownGlint({ night, top, fountainLeft }: { night: boolean; top: number; fountainLeft: number }) {
  const still = useReduceMotion();
  const glint = useAmbientLoop(4200, 400, still);
  const water = useAmbientLoop(1900, 250, still);
  return (
    <View style={styles.fill}>
      <Animated.View
        style={[
          styles.townGlint,
          {
            top,
            opacity: glint.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, night ? 0.10 : 0.22, 0] }),
            transform: [{ translateX: glint.interpolate({ inputRange: [0, 1], outputRange: [-40, 420] }) }, { rotate: '12deg' }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.fountainSpark,
          {
            top: top + 119,
            left: fountainLeft,
            opacity: water.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.12, night ? 0.28 : 0.78, 0.12] }),
            transform: [
              { translateY: water.interpolate({ inputRange: [0, 1], outputRange: [8, -8] }) },
              { scale: water.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1.08] }) },
            ],
          },
        ]}
      />
    </View>
  );
}

/**
 * A town at dusk and after dark has its lights ON.
 *
 * Every street lamp in this scene rendered as a dark blue post and every shop
 * window as a dark hole, so night Town read as "the day scene with the
 * brightness turned down" -- which was the whole complaint about night. Light
 * SOURCES are what make a night exterior legible: a warm bulb, a halo around
 * it, and a pool of it on the pavement.
 *
 * EVENING GETS THEM TOO, at `intensity` 0.55. Gating this on `night` (>= 21:00)
 * left the 17:00-21:00 band -- a fifth of every day, and the band whose sky is
 * most obviously dusk -- with a row of dead posts under an orange sunset. It
 * also left Town's weakest lit measurement there (12.2% colourless at evening
 * against 5.9% at day), and warm light is exactly what that band wants: gold
 * over an orange key stays chromatic, where gold over the blue night wash mixes
 * toward neutral. Lighting evening is the rare change that makes the picture
 * better and the number better at the same time.
 */
function TownNightLights({
  lampCenters,
  glassCenters,
  glassW,
  glassH,
  lampW,
  sidewalk,
  spills,
  intensity = 1,
  afterDark = true,
}: {
  /** Post centres. The pool on the pavement belongs under the POST. */
  lampCenters: number[];
  /**
   * Where the lit pane actually is, measured off the prop rather than guessed
   * from the sprite box: the glass sits at 0.374 / 0.192 of the PNG and is
   * 0.452 x 0.173 of it, so a bulb centred on the sprite lands up and to the
   * left of the pane it is meant to be inside. Invisible at night behind the
   * bloom, obvious at dusk with the bloom off -- which is how it was found.
   */
  glassCenters: { x: number; y: number }[];
  glassW: number;
  glassH: number;
  lampW: number;
  sidewalk: number;
  /** Warm light lying on the pavement in front of each lit shopfront. */
  spills: { left: number; top: number; width: number; height: number }[];
  /** 1 after dark; lower at dusk, when the sky is still carrying the scene. */
  intensity?: number;
  /**
   * Whether the light SPREADS -- bloom around the bulb, pools on the pavement.
   * After dark it must: a lamp that lights nothing floats. At dusk it must not,
   * and both halves of that were measured. Spilling gold across a still-bright
   * peach pavement took town-evening 12.2% -> 15.0% colourless, and the bloom
   * alone still left it at 14.8%, because gold over a pale warm surface
   * flattens it the same way gold over the blue night wash does. At dusk the
   * sky is still lighting the town; all the lamps have to say is that they are
   * ON, and a lit BULB says it for the price of a few dozen pixels.
   */
  afterDark?: boolean;
}) {
  const still = useReduceMotion();
  const pulse = useAmbientLoop(3400, 0, still);
  return (
    <View style={styles.fill} pointerEvents="none">
      {/*
        "The shops are open" is said by the light ON THE PAVEMENT, not by a
        panel stuck on the glass.

        Two versions of a lit window were tried and both failed for the same
        reason: an overlay rectangle over a rendered shopfront reads as a
        rectangle. Small and opaque it looked like a sticky note; large and
        soft it looked like a translucent panel laid over the signage, and it
        measured worse too (town-night 7.5% -> 14.6% neutral pixels, because
        gold spread over that much blue mixes toward grey). Warm spill pooling
        on the ground in front of each door says the same thing, cannot be
        mistaken for geometry, and only touches pixels that are already lit.
      */}
      {afterDark &&
        spills.map((sp, i) => (
          <LinearGradient
            key={`spill${i}`}
            colors={['rgba(255,214,102,0)', 'rgba(255,214,102,0.34)', 'rgba(255,214,102,0)']}
            locations={[0, 0.5, 1]}
            style={[styles.shopSpill, sp, { opacity: intensity }]}
          />
        ))}
      {lampCenters.map((cx, i) => {
        const glass = glassCenters[i];
        return (
          <React.Fragment key={`lamp${i}`}>
            {/*
              ONE glow with a real falloff, not three stacked discs.

              This was three concentric filled circles, each smaller and
              stronger, justified by "react-native-web has no radial gradient".
              react-native-svg does, and it is already in every scene in this
              file -- so what shipped was three visible circular edges, which
              is exactly why the street lamps read as ringed UI toggles in the
              night contact sheet. The pulse now breathes the whole light
              instead of only its outermost ring.
            */}
            {afterDark && (
              <Animated.View
                style={[
                  styles.fill,
                  { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.78 * intensity, intensity] }) },
                ]}
                pointerEvents="none"
              >
                <RadialGlow cx={glass.x} cy={glass.y} r={glassW * 2.2} color={DIORAMA.butterDeep} stops={[0.62, 0.30, 0.10]} />
              </Animated.View>
            )}
            <View
              style={[
                styles.lampBulb,
                {
                  left: glass.x - glassW / 2,
                  top: glass.y - glassH / 2,
                  width: glassW,
                  height: glassH,
                  borderRadius: glassW * 0.28,
                  opacity: 0.96 * intensity,
                },
              ]}
            />
            {/*
              The light lands somewhere -- without this the lamps float. A
              gradient, like every other pool in the game: a filled view behind
              a pill radius shows its own edge and reads as a decal on the
              pavement rather than as light on it.
            */}
            {afterDark && (
              <LinearGradient
                colors={['rgba(255,214,102,0)', 'rgba(255,214,102,0.30)', 'rgba(255,214,102,0)']}
                locations={[0, 0.5, 1]}
                style={[
                  styles.lampSpill,
                  { left: cx - lampW * 1.5, top: sidewalk - lampW * 0.34, width: lampW * 3, height: lampW * 0.72, borderRadius: lampW * 1.5, opacity: intensity },
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

/** Town buildings are separate rendered modules; sidewalk, road, and weather stay live. */
export function TownScene({ hour, bandHeight = 620, groundY, chromeBottom = CHROME_BOTTOM, motion = 'idle' }: { hour: number; bandHeight?: number; groundY?: number; chromeBottom?: number; motion?: WorldMotion }) {
  const { width, height } = useWindowDimensions();
  const scale = worldScale(width, height);
  const band = skyBand(hour);
  const night = band === 'night';
  const ground = groundY ?? bandHeight * 0.72;
  const canvasHeight = ground + 264;
  const horizon = clamp(ground - 458, 116, 154);
  const sidewalk = Math.max(372, ground - 116);
  const walk = night ? DIORAMA.townSidewalkNight : DIORAMA.townSidewalkDay;
  const walkFar = night ? DIORAMA.townSidewalkNightFar : DIORAMA.townSidewalkDayFar;
  const walkNear = night ? DIORAMA.townSidewalkNightNear : DIORAMA.townSidewalkDayNear;
  const walkEdge = night ? DIORAMA.townSidewalkNightEdge : DIORAMA.townSidewalkDayEdge;
  const road = night ? DIORAMA.townRoadNight : DIORAMA.townRoadDay;
  const roadEdge = night ? DIORAMA.townRoadNightEdge : DIORAMA.townRoadDayEdge;
  // The street lights come on at DUSK, not at 21:00. See TownNightLights.
  const lampsOn = night || band === 'evening';

  // Match the trimmed render's real 422x519 aspect ratio. Oversized side
  // modules crop like a street continuing off-screen instead of three icons
  // floating in the middle of the sky.
  const shopW = 248 * scale;
  const shopH = shopW * (519 / 422);
  const lampW = 62 * scale;
  const lampH = 174 * scale;
  // Where the lamp SPRITE's top edge lands -- the same expression the sprite
  // itself is positioned with, so the lit pane can be placed off the prop's
  // own measured geometry instead of guessed from the sprite's centre.
  const lampSpriteTop = sidewalk - lampH + 16;
  const fountainW = 112 * scale;
  const fountainH = 102 * scale;
  const planterW = 72 * scale;
  const planterH = 92 * scale;
  const centerStoreLeft = width / 2 - shopW * 0.48;
  const sideStoreInset = centerStoreLeft - shopW * 0.78;
  /*
   * THREE PROPS WERE STACKED IN ONE CORNER.
   *
   * These insets are all derived from half the width, and on a phone they all
   * hit the same clamp: measured at 390x844 the fountain sat at x16..135, the
   * left planter at x57..134 and the left lamp at x13..79 -- three objects
   * inside 120px of the bottom-left, while Barkly took 56% of the frame in the
   * middle. scripts/blocking.mjs called both overlaps.
   *
   * Town is not short of things (it measures the highest detail of any location
   * at 79%); it was short of PLACES to put them. A 390px frame with a 219px dog
   * in it has room for two props a side, so the left lamp moves out to the
   * frame edge, clear of the fountain, and the left planter renders only where
   * there is somewhere for it to stand. The right pair already had lanes of
   * their own and are untouched.
   */
  const plazaInset = Math.max(18, width / 2 - 235 * scale);
  const lampInsetLeft = width >= 600 ? plazaInset : plazaInset - 30;
  const planterInset = plazaInset + 42 * scale;
  const showLeftPlanter = width >= 600;
  const fountainLeft = width / 2 - fountainW / 2 - 108 * scale;

  return (
    <WorldScene motion={motion} testID="world-scene-town">
      <WorldLayer name="sky"><SceneSky band={band} horizon={horizon + 30} chromeBottom={chromeBottom} /></WorldLayer>
      <WorldLayer name="distant">
        {/*
          THE NEXT STREET OVER.

          The town sky measured a standard deviation of 4.3 across a whole
          band -- one fill, with three shopfronts standing in front of nothing.
          This is the roofline behind them: overscanned past both frame edges,
          low in the frame so only the roofs clear the shops, and graded hard
          by depth so it reads as distance rather than as more town.
        */}
        <WorldObject
          source={TOWN_ROOFTOPS}
          left={-28}
          top={horizon - 34}
          width={width + 56}
          height={(width + 56) / ROOFTOPS_ASPECT}
          night={night}
          depth={0.10}
          opacity={0.86}
        />
        {/*
          DEPTH IS A DISTANCE NOW, so these had to be re-authored.

          The storefronts sat at 0.32-0.38, which was harmless while `depth`
          only drove a 7% opacity nudge and nothing else. Turning on real
          aerial perspective made them the three biggest, most saturated
          objects in the game wearing 18% sky, and Town went straight back to
          the washed-out state this repo already fought once.

          They are not distant. They are the street the dog is standing in --
          the rooftops behind them at 0.10 are the distance here. Around 0.55
          gives them the light kiss a building five metres away should take,
          and keeps the ramp honest between the rooftops and the fountain.
        */}
      </WorldLayer>
      {/* Strung in front of the shopfronts, clear of the chrome above. */}
      <WorldLayer name="distant">
        <TownBunting top={Math.max(CHROME_CLEAR + 14, horizon - 62)} night={night} />
      </WorldLayer>
      {/*
        THE PAVEMENT IS PAVED.
        Measured, Town's single biggest surface was #C0C090 at 19.3% OF THE
        WHOLE FRAME in one flat colour at 0.30 chroma -- a fifth of the scene
        painted as one slab, which is the real reason Town read weakest at
        every hour of the day. It was never the sky: Park's dominant surface is
        24% of its frame at 0.628, and it reads rich because it is a GRADIENT
        with tufts on it, spread across several tones rather than one.
        So the pavement gets what the grass already had -- a far-to-near ramp
        so the ground recedes, and paving joints that converge with it so the
        surface has structure to catch the light instead of being a fill.
      */}
      <WorldLayer name="ground"><Svg width="100%" height="100%" viewBox={`0 0 420 ${canvasHeight}`} preserveAspectRatio="none" style={styles.fill}>
        <Defs>
          <SvgLinearGradient id="townWalk" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={walkFar} />
            <Stop offset="0.55" stopColor={walk} />
            <Stop offset="1" stopColor={walkNear} />
          </SvgLinearGradient>
        </Defs>
        <Rect x={0} y={sidewalk + 9} width={420} height={canvasHeight - sidewalk} fill={walkEdge} />
        <Rect x={0} y={sidewalk} width={420} height={canvasHeight - sidewalk - 9} fill="url(#townWalk)" />
        <Path d={`M0 ${sidewalk + 7}H420`} stroke={DIORAMA.white} strokeWidth={7} opacity={night ? 0.05 : 0.22} />
        {/*
          Paving joints. They fan out from the vanishing point the same way the
          road markings do, so the ground has a direction; the horizontals space
          out toward the viewer for the same reason.
        */}
        {[-150, -40, 66, 176, 290, 400, 512].map((x) => (
          <Path
            key={`joint${x}`}
            d={`M${210 + (x - 210) * 0.62} ${sidewalk + 6}L${x} ${ground + 96}`}
            stroke={walkEdge}
            strokeWidth={1.6}
            opacity={night ? 0.16 : 0.26}
          />
        ))}
        {[16, 40, 72].map((dy, i) => (
          <Path
            key={`course${dy}`}
            d={`M0 ${sidewalk + dy}H420`}
            stroke={walkEdge}
            strokeWidth={1.4}
            opacity={(night ? 0.12 : 0.20) - i * 0.03}
          />
        ))}
        <Rect x={0} y={ground + 92} width={420} height={canvasHeight - ground - 92} fill={roadEdge} />
        <Rect x={0} y={ground + 100} width={420} height={canvasHeight - ground - 100} fill={road} />
        <Path d={`M20 ${ground + 128}H112M166 ${ground + 128}H258M312 ${ground + 128}H402`} stroke={DIORAMA.cream} strokeWidth={7} strokeLinecap="round" opacity={night ? 0.10 : 0.38} />
      </Svg>
        <GroundHaze horizon={horizon} height={canvasHeight} night={night} />
      </WorldLayer>
      {/*
        THE SHOPS STAND ON THE PAVEMENT, so they are landmarks, not distance.

        They were in the `distant` layer, which sits at z 10 -- BELOW the
        ground plane at z 20. That was invisible while the ground was only a
        flat fill, and the moment the ground got a haze of its own the haze
        washed straight over the three biggest, most saturated objects in the
        game. Measured on the storefront band: saturation 0.459 with no haze,
        0.425 from the ground haze alone, 0.405 once prop haze was added --
        closing on the 0.42 floor this repo already fought Town back from once.

        A building occludes the ground it stands on. `landmark` (z 30) is where
        that is true, and it leaves `distant` holding what is actually distant:
        the rooftops behind them, at depth 0.10.
      */}
      <WorldLayer name="landmark">
        <WorldObject source={TOWN_STORE_CORAL} left={sideStoreInset} top={horizon + 34} width={shopW * 0.90} height={shopH * 0.90} night={night} depth={0.52} />
        <WorldObject source={TOWN_STORE_AQUA} left={centerStoreLeft} top={horizon + 8} width={shopW * 0.96} height={shopH * 0.96} night={night} depth={0.58} />
        <WorldObject source={TOWN_STORE_VIOLET} right={sideStoreInset} top={horizon + 28} width={shopW * 0.91} height={shopH * 0.91} night={night} depth={0.54} />
        {/*
          AND THE SIGN MOVES WITH THEM.

          It carries `baselineZ(...) + 1`, which only beats the shopfront while
          the two are SIBLINGS: zIndex is scoped to a stacking context, so the
          moment the shops moved to `landmark` and the sign stayed behind in
          `distant`, the name went behind the building again -- the exact defect
          the note below was written about, reintroduced by a layer change
          rather than by a missing zIndex. It vanished from the capture entirely.
        */}
        {/*
          THE SIGN HAS TO STATE ITS DEPTH NOW.

          Giving WorldObject a baseline-derived zIndex fixed the bench in the
          tree and quietly broke this: a plain View has no zIndex, and among
          siblings anything with one beats it, so the shop's name went BEHIND
          the shopfront it names. It showed as "BARKLY'S" in dark teal against a
          teal wall, above the painted plaque instead of on it -- which reads as
          a font or position bug rather than a stacking one, and was only caught
          by zooming into a capture.

          This is the one place in any scene where a code-drawn element shares a
          layer with a prop (__tests__/layer_stacking.test.ts keeps it the only
          one), and the fix is for it to say where it stands like everything
          else. The plaque is measured from the asset rather than guessed: in
          store_aqua.png the cream board runs y 0.187..0.311 and x 0.154..0.778
          of the trimmed art, with the accent bar crossing it at 0.26.

          AND IT IS TEXT, NOT A SIGN. Getting the depth right revealed the
          second half: it was drawing its OWN butter plaque, with a teal border
          and a drop shadow, on top of the plaque the shop already has painted
          on it. The two did not line up, so the shop's accent bar stuck out
          below the pill as a loose teal underline and the whole thing read as
          a disabled text field hovering in front of the building. The shop has
          a signboard. The only thing missing from it was the name, so that is
          all this draws -- placed in the cream band ABOVE the accent bar
          (0.190..0.255), which is why its height is a fraction of the prop
          rather than 24 points.
        */}
        <View
          style={[
            styles.shopSign,
            {
              left: centerStoreLeft + shopW * 0.96 * 0.16,
              top: horizon + 8 + shopH * 0.96 * 0.190,
              width: shopW * 0.96 * 0.62,
              height: shopH * 0.96 * 0.065,
              zIndex: baselineZ(horizon + 8, shopH * 0.96) + 1,
            },
          ]}
        >
          <Text style={[styles.shopSignText, { fontSize: Math.max(9, 11 * scale) }]}>BARKLY'S</Text>
        </View>
      </WorldLayer>
      <WorldLayer name="props">
        {/* The pavement's own surface. See TOWN_PAVING_COURSES. */}
        {TOWN_PAVING_COURSES.map((c) => {
          const w = width * c.w;
          const h = w / PAVING_ASPECT;
          return (
            <WorldObject
              key={`paving-${c.dy}`}
              source={TOWN_PAVING}
              left={(width - w) / 2 - w * c.phase * 0.06}
              top={sidewalk + c.dy * scale}
              width={w}
              height={h}
              night={night}
              depth={0.42 + c.dy / 400}
              opacity={c.opacity}
            />
          );
        })}
        {/*
          WHERE THE PAVEMENT STOPS. It measured sd 4.6 -- one fill with three
          drawn hairlines on it pretending to be slab joints -- and it met the
          road at a colour change with no edge at all.
        */}
        <WorldObject
          source={TOWN_KERB}
          left={-24}
          top={sidewalk - (width + 48) / KERB_ASPECT + 4}
          width={width + 48}
          height={(width + 48) / KERB_ASPECT}
          night={night}
          depth={0.46}
        />
        {showLeftPlanter && <WorldObject source={TOWN_PLANTER} left={planterInset} top={sidewalk - planterH + 11} width={planterW} height={planterH} night={night} depth={0.72} ambient="sway" contactShadow />}
        <WorldObject source={TOWN_PLANTER} right={planterInset} top={sidewalk - planterH + 12} width={planterW} height={planterH} night={night} depth={0.72} ambient="sway" motionDelay={600} flip contactShadow />
        <WorldObject source={TOWN_LAMP} left={lampInsetLeft} top={lampSpriteTop} width={lampW} height={lampH} night={night} depth={0.64} contactShadow />
        <WorldObject source={TOWN_LAMP} right={plazaInset} top={lampSpriteTop} width={lampW} height={lampH} night={night} depth={0.64} flip contactShadow />
        <WorldObject source={TOWN_FOUNTAIN} left={fountainLeft} top={sidewalk - fountainH + 30} width={fountainW} height={fountainH} night={night} depth={0.76} contactShadow />
      </WorldLayer>
      <WorldLayer name="fx"><TownGlint night={night} top={horizon + 132} fountainLeft={fountainLeft + fountainW * 0.48} /></WorldLayer>
      <WorldLighting ground={ground} night={night} band={band} warm />
      {/*
        AFTER the grade, deliberately. Rendered before it (as a foreground
        layer) the deep blue wash composited straight over the gold and every
        lamp came out a flat pale-blue disc that read as a UI artifact rather
        than as a light. Same rule as the warm pools inside WorldLighting
        itself: light is not something the atmosphere sits in front of.
      */}
      {lampsOn && (
        <WorldLayer name="fx">
          <TownNightLights
            intensity={night ? 1 : 0.55}
            afterDark={night}
            lampCenters={[plazaInset + lampW / 2, width - plazaInset - lampW / 2]}
            glassCenters={[
              { x: plazaInset + lampW * 0.374, y: lampSpriteTop + lampH * 0.192 },
              // Mirrored: the right lamp is drawn with `flip`.
              { x: width - plazaInset - lampW * 0.374, y: lampSpriteTop + lampH * 0.192 },
            ]}
            glassW={lampW * 0.452}
            glassH={lampH * 0.173}
            lampW={lampW}
            sidewalk={sidewalk}
            spills={[
              { left: sideStoreInset, top: sidewalk - shopW * 0.10, width: shopW * 0.90, height: shopW * 0.26 },
              { left: centerStoreLeft, top: sidewalk - shopW * 0.12, width: shopW * 0.96, height: shopW * 0.30 },
              { left: width - sideStoreInset - shopW * 0.91, top: sidewalk - shopW * 0.10, width: shopW * 0.91, height: shopW * 0.26 },
            ]}
          />
        </WorldLayer>
      )}
    </WorldScene>
  );
}

function BeachMotion({ night, tide }: { night: boolean; tide: number }) {
  const still = useReduceMotion();
  const wave = useAmbientLoop(3000, 0, still);
  const gull = useAmbientLoop(9000, 700, still);
  return (
    <View style={styles.fill}>
      <Animated.View
        style={[
          styles.waveGlint,
          {
            top: tide - 60,
            opacity: wave.interpolate({ inputRange: [0, 1], outputRange: [night ? 0.04 : 0.14, night ? 0.11 : 0.34] }),
            transform: [{ scaleX: wave.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1.18] }) }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.gull,
          {
            top: tide - 160,
            opacity: night ? 0.12 : 0.44,
            transform: [
              { translateX: gull.interpolate({ inputRange: [0, 1], outputRange: [-40, 440] }) },
              { translateY: gull.interpolate({ inputRange: [0, 0.5, 1], outputRange: [8, -18, 6] }) },
            ],
          },
        ]}
      >
        <View style={styles.gullLeft} />
        <View style={styles.gullRight} />
      </Animated.View>
    </View>
  );
}

/** Beach landmarks are modular props over code-owned ocean, tide, and sand. */
export function BeachScene({ hour, bandHeight = 620, groundY, chromeBottom = CHROME_BOTTOM, motion = 'idle' }: { hour: number; bandHeight?: number; groundY?: number; chromeBottom?: number; motion?: WorldMotion }) {
  const { width, height } = useWindowDimensions();
  const scale = worldScale(width, height);
  const band = skyBand(hour);
  const night = band === 'night';
  const ground = groundY ?? bandHeight * 0.72;
  const canvasHeight = ground + 264;
  const horizon = clamp(ground - 386, 172, 210);
  const tide = horizon + 120;
  const sandTop = tide + 15;
  const oceanDeep = night ? DIORAMA.oceanNightDeep : DIORAMA.oceanDayDeep;
  const sandWet = night ? DIORAMA.sandNightWet : DIORAMA.sandDayWet;
  const sandNearDeep = night ? DIORAMA.sandNightNearDeep : DIORAMA.sandDayNearDeep;
  const oceanA = night ? DIORAMA.oceanNightA : DIORAMA.oceanDayA;
  const oceanB = night ? DIORAMA.oceanNightB : DIORAMA.oceanDayB;
  const oceanEdge = night ? DIORAMA.oceanNightEdge : DIORAMA.oceanDayEdge;
  const sandA = night ? DIORAMA.sandNightFar : DIORAMA.sandDayFar;
  const sandB = night ? DIORAMA.sandNightNear : DIORAMA.sandDayNear;
  // sandEdge is gone with the dead View it fed; see the sand gradient below.

  const lifeguardW = 148 * scale;
  const lifeguardH = 230 * scale;
  const umbrellaW = 142 * scale;
  const umbrellaH = 194 * scale;
  /*
   * The palm was 67% inside the lifeguard tower -- the same defect as the park
   * bench in the tree, found by scripts/blocking.mjs the first time it was
   * pointed at this scene. Two objects at nearly the same distance occupying
   * the same place, so the eye has nowhere to put either of them.
   *
   * It took three tries to accept that the palm and the tower cannot share that
   * corner at ANY size. Made NEAR -- bigger, cropped by the left edge -- the
   * frame ate it: 170px wide with its trunk at the right of its own bounding
   * box left a sliver of frond, and the dune then measured 92% inside it. Made
   * FAR and pushed further left, it became a green smudge against the frame
   * edge. Moving the tower right instead puts a 147px landmark 75% inside
   * Barkly's silhouette, rising past his head, which prop-clear-check refuses
   * and should.
   *
   * A fourth try put it small on the far shore, between the tower and the
   * umbrella, where the frame is genuinely empty. It grew out of the sea: the
   * far shore here is the ~15px between the tide line and the near sand, and
   * nothing stands on that convincingly. A fifth, near and at the left edge,
   * laid its canopy horizontally through the tower's roof.
   *
   * So the honest answer, after five: A 390px BEACH HAS NO ROOM FOR IT. The
   * frame already carries a lifeguard tower, an umbrella, a sandcastle, a dune,
   * two dogs and the SIFT control's badge, and every position left either
   * collides with one of those or falls off the edge. It renders on wide
   * screens, where `wideInset` gives it somewhere real to stand, and the phone
   * gets the scene without it -- which measured and looked better than any of
   * the five placements did.
   *
   * Not a limitation to work around later: a 390px frame is a fixed budget and
   * this prop is the one that does not fit in it.
   */
  const showPalm = width >= 600;
  const palmW = 126 * scale;
  const palmH = 264 * scale;
  const duneW = 146 * scale;
  const duneH = 90 * scale;
  const castleW = 104 * scale;
  const castleH = 92 * scale;
  const wideInset = Math.max(18, (width - 700 * scale) / 2);
  const palmLeft = width >= 600 ? wideInset - 24 : COMPOSITION.beach.palmLeft;
  const towerLeft = width >= 600 ? wideInset + 104 * scale : COMPOSITION.beach.towerLeft;
  const umbrellaRight = width >= 600 ? wideInset + 70 * scale : COMPOSITION.beach.umbrellaRight;
  const duneLeft = width >= 600 ? wideInset - 6 : COMPOSITION.beach.duneLeft;
  const duneRight = width >= 600 ? wideInset - 12 : COMPOSITION.beach.duneRight;
  const castleRight = width >= 600 ? wideInset + 112 * scale : COMPOSITION.beach.castleRight;

  return (
    <WorldScene motion={motion} testID="world-scene-beach">
      <WorldLayer name="sky"><SceneSky band={band} horizon={horizon} chromeBottom={chromeBottom} /></WorldLayer>
      <WorldLayer name="distant">
        {/*
          Deep at the horizon, shallow at your feet -- which is both how water
          works and where this scene's missing darks live. It was two bright
          cyans, so the sea contributed nothing below 0.56 value and the whole
          location had no anchor for the eye.
        */}
        {/* Depth stated: this layer holds a rendered headland now, and a
            LinearGradient carries no zIndex of its own. Sea, headland, surf. */}
        <LinearGradient
          colors={[oceanDeep, oceanA, oceanB]}
          locations={[0, 0.42, 1]}
          style={{ zIndex: 1, position: 'absolute', left: 0, right: 0, top: horizon, height: tide - horizon + 28 }}
        />
        {/*
          THE FAR SIDE OF THE BAY.

          Two SVG slivers used to sit here -- a bump at each end of the horizon
          with open sky between them, which reads as two hills floating on the
          sea rather than as a coastline. The beach sky measures a standard
          deviation of 3.3, the flattest surface in the game, and the reason is
          that nothing ends against it. Same fix the park's treeline got.
        */}
        <WorldObject
          source={BEACH_HEADLAND}
          left={-26}
          top={horizon - (width + 52) / HEADLAND_ASPECT + 12}
          width={width + 52}
          height={(width + 52) / HEADLAND_ASPECT}
          night={night}
          depth={0.08}
          opacity={0.82}
        />
        {/*
          THE SHORELINE WAS A SQUIGGLE.

          Two SVG strokes -- a 20-wide shade and a 10-wide highlight -- carried
          the whole idea of "water arriving at a shore", stretched through a
          `preserveAspectRatio="none"` viewBox so they were anamorphic on every
          viewport but one. At phone size that reads as a scratch in the paint.

          Surf is foam, so it is built as a fused metaball field rather than
          spheres, and it BREAKS: three tall crests carry a line that is thin
          between them, over one continuous spent wash.
          `tools/blender/world_prop_pack.py:beach_surf`.

          Overscanned past both frame edges like the headland above it -- a
          shoreline that stops inside the frame is a puddle.
        */}
        <WorldObject
          source={BEACH_SURF}
          left={-26}
          top={tide - ((width + 52) / SURF_ASPECT) * 0.58}
          width={width + 52}
          height={(width + 52) / SURF_ASPECT}
          night={night}
          depth={0.10}
        />
        <Svg width="100%" height="100%" viewBox={`0 0 420 ${canvasHeight}`} preserveAspectRatio="none" style={[styles.fill, { zIndex: 2 }]}>
        <Path d={`M0 ${horizon + 36}Q82 ${horizon + 18} 164 ${horizon + 34}T316 ${horizon + 32}T430 ${horizon + 35}`} stroke={night ? DIORAMA.oceanNightLight : DIORAMA.oceanDayLight} strokeWidth={7} fill="none" opacity={night ? 0.08 : 0.30} />
        </Svg>
      </WorldLayer>
      <WorldLayer name="ground">
        {/*
          THE SAND IS 55% OF THIS PICTURE AND IT WAS ONE TONE.
          
          It ran #EFC56F to #FFDC93 -- 0.94 value to 1.00, two near-whites --
          so more than half the frame carried no tonal information at all. That,
          not the sea, is why the Beach measured 6.6% of its pixels darker than
          mid-value against the Park's 22.9%, and had the lowest tonal spread of
          any location at every hour of the day. Thin bands at the tide line
          cannot fix a flat majority; the majority has to stop being flat.
          
          Bright where the light is, deepening toward the camera, which is both
          how a beach looks and what gives the ground plane somewhere to go.
          
          (The opaque `sandEdge` View that used to sit under this gradient
          covered exactly the same box and was painted over completely -- a
          layer that had not been visible in any build. Its tone is the third
          stop now, doing the job it was presumably added for.)
        */}
        <LinearGradient
          colors={[sandA, sandB, sandNearDeep]}
          locations={[0, 0.28, 0.72]}
          style={{ position: 'absolute', left: 0, right: 0, top: sandTop, bottom: 0 }}
        />
        {/*
          WET SAND. The strip the last wave soaked, and the darkest thing on the
          beach. It was a 24%-opacity wash of ocean-edge over sand, which is to
          say almost nothing; at full strength it does the job a shadow does in
          every other location -- separates the water from the land and gives
          the ground plane somewhere to start.
        */}
        <LinearGradient
          colors={[sandWet, sandA]}
          style={{ position: 'absolute', left: 0, right: 0, top: sandTop, height: 46, opacity: night ? 0.42 : 0.72 }}
        />
        <LinearGradient colors={[oceanEdge, sandA]} style={{ position: 'absolute', left: 0, right: 0, top: sandTop, height: 26, opacity: night ? 0.20 : 0.38 }} />
        <Svg width="100%" height="100%" viewBox={`0 0 420 ${canvasHeight}`} preserveAspectRatio="none" style={styles.fill}>
          <Path d={`M44 ${sandTop + 92}q24 -8 48 0M306 ${sandTop + 82}q30 -10 58 1M122 ${sandTop + 186}q28 -7 54 2`} stroke={night ? DIORAMA.sandNightLight : DIORAMA.sandDayLight} strokeWidth={4} strokeLinecap="round" fill="none" opacity={0.34} />
          <Path d={`M74 ${sandTop + 128}l7 4 6 -5M344 ${sandTop + 166}l8 4 5 -6`} stroke={night ? DIORAMA.sandNightEdge : DIORAMA.sandDayEdge} strokeWidth={2.4} strokeLinecap="round" fill="none" opacity={0.34} />
        </Svg>
        <GroundHaze horizon={horizon} height={canvasHeight} night={night} strength={0.46} />
      </WorldLayer>
      <WorldLayer name="landmark">
        {showPalm && <WorldObject source={BEACH_PALM} left={palmLeft} top={horizon - 82} width={palmW} height={palmH} night={night} depth={0.44} opacity={0.86} ambient="sway" contactShadow />}
        {/* What is actually ON the sand. See BEACH_COVER. Same layer as the
            tower and the umbrella so a shell in front of the dune is a fact
            about where it lies, not about which layer it was filed under. */}
        {BEACH_COVER.map((c, i) => {
          const w = (c.flower ? 54 : 58) * c.s * scale;
          const h = w / (c.flower ? MARRAM_ASPECT : SHELLS_ASPECT);
          return (
            <WorldObject
              key={`shore-${c.fx}-${c.dy}`}
              source={c.flower ? BEACH_MARRAM : BEACH_SHELLS}
              left={width * c.fx - w / 2}
              top={sandTop + c.dy - h}
              width={w}
              height={h}
              night={night}
              depth={c.depth}
              opacity={0.62 + 0.38 * c.depth}
              ambient={c.flower ? 'sway' : undefined}
              motionDelay={260 * i}
              flip={c.flip}
              contactShadow
            />
          );
        })}
        <WorldObject source={BEACH_LIFEGUARD} left={towerLeft} top={horizon + 16} width={lifeguardW * 0.94} height={lifeguardH * 0.94} night={night} depth={0.50} opacity={0.92} contactShadow />
        <WorldObject source={BEACH_UMBRELLA} right={umbrellaRight} top={horizon + 38} width={umbrellaW} height={umbrellaH} night={night} depth={0.56} ambient="sway" motionDelay={500} contactShadow />
      </WorldLayer>
      <WorldLayer name="foreground">
        {/*
          Pushed left, clear of the SIFT control's badge. It used to sit right
          behind it: scripts/blocking.mjs reported SIFT covered, and a mound of
          sand behind a mound-shaped control is unreadable anyway.
        */}
        <WorldObject source={BEACH_DUNE} left={duneLeft} top={sandTop + 98} width={duneW} height={duneH} night={night} depth={0.90} opacity={0.88} contactShadow />
        <WorldObject source={BEACH_DUNE} right={duneRight} top={sandTop + 138} width={duneW * 0.90} height={duneH * 0.90} night={night} depth={0.94} opacity={0.78} flip contactShadow />
        <WorldObject source={BEACH_CASTLE} right={castleRight} top={sandTop + 124} width={castleW} height={castleH * 1.50} night={night} depth={0.92} contactShadow />
      </WorldLayer>
      <WorldLayer name="fx"><BeachMotion night={night} tide={tide} /></WorldLayer>
      <WorldLighting ground={ground} night={night} band={band} warm />
    </WorldScene>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  skyBody: { position: 'absolute', right: SUN_INSET - (SKY_BODY / 2 - SUN_R), width: SKY_BODY, height: SKY_BODY },
  cloud: { position: 'absolute', left: 23 },
  cloudFar: { position: 'absolute' },
  fallingLeaf: { position: 'absolute', left: 34, width: 17, height: 9, borderTopLeftRadius: radius.md, borderBottomRightRadius: radius.md, backgroundColor: DIORAMA.parkTreeDayLight },
  fallingLeafSmall: { left: 0, width: 12, height: 7, backgroundColor: DIORAMA.parkTreeDay },
  butterfly: { position: 'absolute', left: 0, width: 22, height: 14 },
  butterflyLeft: { position: 'absolute', left: 1, top: 3, width: 10, height: 7, borderRadius: radius.pill, backgroundColor: DIORAMA.lemon, transform: [{ rotate: '-24deg' }] },
  butterflyRight: { position: 'absolute', right: 1, top: 3, width: 10, height: 7, borderRadius: radius.pill, backgroundColor: DIORAMA.coralLight, transform: [{ rotate: '24deg' }] },
  shopSpill: { position: 'absolute', borderRadius: radius.pill },
  lampBulb: { position: 'absolute', backgroundColor: DIORAMA.goldLight, opacity: 0.96 },
  lampSpill: { position: 'absolute', transform: [{ scaleX: 1.1 }] },
  townGlint: { position: 'absolute', left: 0, width: 18, height: 190, borderRadius: radius.pill, backgroundColor: DIORAMA.white },
  fountainSpark: { position: 'absolute', width: 9, height: 9, borderRadius: radius.pill, backgroundColor: DIORAMA.white },
  shopSign: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  shopSignText: { fontWeight: '900', letterSpacing: 1.2, color: DIORAMA.townBlueEdge },
  waveGlint: { position: 'absolute', right: 62, width: 64, height: 5, borderRadius: radius.pill, backgroundColor: DIORAMA.white },
  gull: { position: 'absolute', left: 0, width: 32, height: 18 },
  gullLeft: { position: 'absolute', left: 0, top: 8, width: 18, height: 3, borderRadius: radius.sm, backgroundColor: DIORAMA.inkSoft, transform: [{ rotate: '-22deg' }] },
  gullRight: { position: 'absolute', right: 0, top: 8, width: 18, height: 3, borderRadius: radius.sm, backgroundColor: DIORAMA.inkSoft, transform: [{ rotate: '22deg' }] },
});
