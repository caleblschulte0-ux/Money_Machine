import React, { useEffect, useRef } from 'react';
import { Animated, ColorValue, Easing, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { DIORAMA } from './artPalette';
import { skyBand, SkyBand } from './CandyScenesV2';
import { elevation, radius } from '../theme';
import { CHROME_BOTTOM } from '../layout';
import {
  RadialGlow,
  WorldLayer,
  WorldLighting,
  WorldMotion,
  WorldObject,
  WorldScene,
  worldScale,
} from './WorldScene';

const PARK_TREE = require('../../../assets/world/park/props/tree.png');
const PARK_BENCH = require('../../../assets/world/park/props/bench.png');
const PARK_HEDGE = require('../../../assets/world/park/props/hedge.png');

const TOWN_STORE_CORAL = require('../../../assets/world/town/props/store_coral.png');
const TOWN_STORE_AQUA = require('../../../assets/world/town/props/store_aqua.png');
const TOWN_STORE_VIOLET = require('../../../assets/world/town/props/store_violet.png');
const TOWN_FOUNTAIN = require('../../../assets/world/town/props/fountain.png');
const TOWN_LAMP = require('../../../assets/world/town/props/lamp.png');
const TOWN_PLANTER = require('../../../assets/world/town/props/planter.png');

const BEACH_UMBRELLA = require('../../../assets/world/beach/props/umbrella.png');
const BEACH_LIFEGUARD = require('../../../assets/world/beach/props/lifeguard.png');
const BEACH_DUNE = require('../../../assets/world/beach/props/dune.png');
const BEACH_CASTLE = require('../../../assets/world/beach/props/castle.png');
const BEACH_PALM = require('../../../assets/world/beach/props/palm.png');

/** Sun/moon geometry, shared by the body and the box its halo needs. */
const SUN_R = 25;
const SUN_INSET = 34;
const SKY_BODY = SUN_R * 2 * 3.4;

/**
 * Canonical stage blocking. These are deliberate silhouette lanes, not a pile
 * of one-off offsets: the middle stays readable for Barkly, major landmarks
 * frame that lane, and supporting props stay near the edges.
 */
const COMPOSITION = {
  park: { treeLeft: -42, treeRight: -44, benchLeft: 10, hedgeLeft: 104, hedgeRight: 72 },
  town: { sideStore: -154, centerStoreLeft: 94, lampLeft: 22, lampRight: 20, planterLeft: 2, planterRight: 4 },
  beach: { palmLeft: -30, towerLeft: 14, umbrellaRight: -12, duneLeft: -38, duneRight: -42, castleRight: 14 },
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

function useAmbientLoop(duration: number, delay = 0) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(value, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, duration, value]);
  return value;
}

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
/**
 * A crescent as ONE path: disc O minus disc C, with no mask and nothing
 * painted in a fake sky colour.
 *
 * The two circles meet at P1/P2 (standard circle-circle intersection). The
 * crescent's boundary is the MAJOR arc of O -- the side away from the cutter,
 * which is the major arc whenever the cutter's centre is outside the chord,
 * i.e. `a > 0` -- followed by the MINOR arc of C, the side facing O's centre.
 * Sweep flags follow from that and hold for any offset satisfying `a > 0`:
 * clockwise on the outer, anticlockwise on the inner.
 *
 * Written out because both alternatives are worse. An SVG `<Mask>` does not
 * survive react-native-svg's web renderer -- the moon shipped as a full flat
 * disc with no bite in it -- and painting the bite in `skyNightA`, which is
 * what this replaced, leaves a visibly lighter round patch wherever the night
 * gradient is not exactly that colour, which is most of the sky.
 */
function crescentPath(cx: number, cy: number, R: number, r: number, dx: number, dy: number): string {
  const d = Math.hypot(dx, dy);
  const a = (d * d + R * R - r * r) / (2 * d);
  const h = Math.sqrt(Math.max(0, R * R - a * a));
  const ux = dx / d;
  const uy = dy / d;
  const nx = -uy;
  const ny = ux;
  const x1 = cx + a * ux + h * nx;
  const y1 = cy + a * uy + h * ny;
  const x2 = cx + a * ux - h * nx;
  const y2 = cy + a * uy - h * ny;
  return `M${x1} ${y1}A${R} ${R} 0 1 1 ${x2} ${y2}A${r} ${r} 0 0 0 ${x1} ${y1}Z`;
}

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
  const drift = useAmbientLoop(15000);
  return (
    <View style={styles.fill}>
      <LinearGradient colors={SKY[band]} style={styles.fill} />
      <SkyBody night={night} discTop={Math.max(chromeBottom + 26, horizon - 96)} />
      {/*
        A CLOUD, not a capsule.

        This was three white pills at 54% opacity, and 54% white over the day
        sky is grey -- on the contact sheet it read as an empty grey UI slab
        parked under the tab bar, which is exactly the "very HTML" note. Two
        things fix it: it has to be WHITE (a cloud is the brightest thing in a
        Supercell sky, not a translucent one), and its silhouette has to be
        lumpy rather than a rounded rectangle. Five puffs of different sizes on
        two rows give it a real edge, a soft tinted underside sells the volume,
        and a second smaller cloud further back gives the sky depth.
      */}
      <Animated.View
        style={[
          styles.cloud,
          {
            top: Math.max(94, horizon - 104),
            opacity: night ? 0.14 : 0.94,
            transform: [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-18, 22] }) }],
          },
        ]}
      >
        <View style={[styles.cloudShade, { left: 6, top: 26, width: 140, height: 20 }]} />
        <View style={[styles.cloudPuff, { left: 0, top: 20, width: 58, height: 26 }]} />
        <View style={[styles.cloudPuff, { left: 30, top: 6, width: 56, height: 40 }]} />
        <View style={[styles.cloudPuff, { left: 62, top: 0, width: 50, height: 46 }]} />
        <View style={[styles.cloudPuff, { left: 96, top: 12, width: 44, height: 34 }]} />
        <View style={[styles.cloudPuff, { left: 22, top: 30, width: 118, height: 18 }]} />
      </Animated.View>
      <Animated.View
        style={[
          styles.cloudFar,
          {
            top: Math.max(78, horizon - 148),
            opacity: night ? 0.08 : 0.62,
            transform: [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [14, -12] }) }],
          },
        ]}
      >
        <View style={[styles.cloudPuff, { left: 0, top: 10, width: 40, height: 17 }]} />
        <View style={[styles.cloudPuff, { left: 22, top: 2, width: 38, height: 25 }]} />
        <View style={[styles.cloudPuff, { left: 46, top: 9, width: 34, height: 18 }]} />
      </Animated.View>
    </View>
  );
}

function ParkMotion({ night, horizon }: { night: boolean; horizon: number }) {
  const leaf = useAmbientLoop(6200);
  const leafTwo = useAmbientLoop(7600, 1800);
  const butterfly = useAmbientLoop(5200, 900);
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

  const treeW = 204 * scale;
  const treeH = 292 * scale;
  // Pushed back and down a size. The bench sat at the same left anchor and
  // roughly the same height as the DIG mound, and on a real handset -- where
  // the stage is shorter than any harness viewport -- the two simply stacked
  // on top of each other. The bench is background; the mound is a CONTROL, so
  // the bench is the one that yields.
  const benchW = 116 * scale;
  const benchH = 85 * scale;
  const hedgeW = 142 * scale;
  const hedgeH = 72 * scale;
  const wideInset = Math.max(14, (width - 720) / 2);
  const treeLeft = width >= 600 ? wideInset : COMPOSITION.park.treeLeft;
  const treeRight = width >= 600 ? wideInset : COMPOSITION.park.treeRight;
  const benchLeft = width >= 600 ? wideInset + 30 : COMPOSITION.park.benchLeft;
  const hedgeLeft = width >= 600 ? wideInset + treeW * 0.88 : COMPOSITION.park.hedgeLeft;
  const hedgeRight = width >= 600 ? wideInset + treeW * 0.72 : COMPOSITION.park.hedgeRight;

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
          The park trail is GONE, not softened a third time.

          It was drawn in a 420-wide viewBox stretched with
          preserveAspectRatio="none", so instead of a path narrowing toward the
          horizon it rendered as a roughly constant-width vertical ribbon --
          from the right tree's canopy, straight through its trunk, and past
          the far dog to the bottom of the frame. Dropping its opacity twice
          only turned a strong glitch into a faint one; the SHAPE was wrong.
          The grass reads better with nothing on it, and the ground already
          carries its own gradient and tufts.
        */}
      </WorldLayer>
      <WorldLayer name="distant">
        <WorldObject source={PARK_HEDGE} left={hedgeLeft} top={horizon + 43} width={hedgeW * 0.62} height={hedgeH * 0.62} night={night} depth={0.25} opacity={0.70} ambient="sway" />
        <WorldObject source={PARK_HEDGE} right={hedgeRight} top={horizon + 57} width={hedgeW * 0.55} height={hedgeH * 0.55} night={night} depth={0.22} opacity={0.62} ambient="sway" motionDelay={700} />
      </WorldLayer>
      <WorldLayer name="landmark">
        <WorldObject source={PARK_TREE} left={treeLeft} top={horizon - 88} width={treeW} height={treeH} night={night} depth={0.55} ambient="sway" contactShadow />
        <WorldObject source={PARK_TREE} right={treeRight} top={horizon - 80} width={treeW * 0.96} height={treeH * 0.96} night={night} depth={0.52} ambient="sway" motionDelay={900} flip contactShadow />
      </WorldLayer>
      <WorldLayer name="props">
        <WorldObject source={PARK_BENCH} left={benchLeft} top={horizon + 92} width={benchW} height={benchH} night={night} depth={0.78} contactShadow />
      </WorldLayer>
      <WorldLayer name="fx"><ParkMotion night={night} horizon={horizon} /></WorldLayer>
      <WorldLighting ground={ground} night={night} band={band} />
    </WorldScene>
  );
}

function TownGlint({ night, top, fountainLeft }: { night: boolean; top: number; fountainLeft: number }) {
  const glint = useAmbientLoop(4200, 400);
  const water = useAmbientLoop(1900, 250);
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
 * A town at night has its lights ON.
 *
 * Every street lamp in this scene rendered as a dark blue post and every shop
 * window as a dark hole, so night Town read as "the day scene with the
 * brightness turned down" -- which was the whole complaint about night. Light
 * SOURCES are what make a night exterior legible: a warm bulb, a halo around
 * it, a pool of it on the pavement, and warm rectangles where the shopfronts
 * are. This layer only exists after dark; nothing about the day scene changes.
 *
 * The glow is built from concentric rounded views rather than a radial
 * gradient because react-native-web has no radial primitive. Three rings with
 * falling size and rising opacity read as a soft light at these radii.
 */
function TownNightLights({
  lampCenters,
  lampTop,
  lampW,
  sidewalk,
  spills,
}: {
  lampCenters: number[];
  lampTop: number;
  lampW: number;
  sidewalk: number;
  /** Warm light lying on the pavement in front of each lit shopfront. */
  spills: { left: number; top: number; width: number; height: number }[];
}) {
  const pulse = useAmbientLoop(3400);
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
      {spills.map((sp, i) => (
        <LinearGradient
          key={`spill${i}`}
          colors={['rgba(255,214,102,0)', 'rgba(255,214,102,0.34)', 'rgba(255,214,102,0)']}
          locations={[0, 0.5, 1]}
          style={[styles.shopSpill, sp]}
        />
      ))}
      {lampCenters.map((cx, i) => {
        const bulb = lampW * 0.34;
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
            <Animated.View
              style={[styles.fill, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] }) }]}
              pointerEvents="none"
            >
              <RadialGlow cx={cx} cy={lampTop + bulb * 0.7} r={bulb * 3.0} color={DIORAMA.butterDeep} stops={[0.62, 0.30, 0.10]} />
            </Animated.View>
            <View
              style={[
                styles.lampBulb,
                { left: cx - bulb / 2, top: lampTop + bulb * 0.15, width: bulb, height: bulb * 1.15, borderRadius: bulb * 0.4 },
              ]}
            />
            {/*
              The light lands somewhere -- without this the lamps float. A
              gradient, like every other pool in the game: a filled view behind
              a pill radius shows its own edge and reads as a decal on the
              pavement rather than as light on it.
            */}
            <LinearGradient
              colors={['rgba(255,214,102,0)', 'rgba(255,214,102,0.30)', 'rgba(255,214,102,0)']}
              locations={[0, 0.5, 1]}
              style={[
                styles.lampSpill,
                { left: cx - lampW * 1.5, top: sidewalk - lampW * 0.34, width: lampW * 3, height: lampW * 0.72, borderRadius: lampW * 1.5 },
              ]}
            />
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

  // Match the trimmed render's real 422x519 aspect ratio. Oversized side
  // modules crop like a street continuing off-screen instead of three icons
  // floating in the middle of the sky.
  const shopW = 248 * scale;
  const shopH = shopW * (519 / 422);
  const lampW = 62 * scale;
  const lampH = 174 * scale;
  const fountainW = 112 * scale;
  const fountainH = 102 * scale;
  const planterW = 72 * scale;
  const planterH = 92 * scale;
  const centerStoreLeft = width / 2 - shopW * 0.48;
  const sideStoreInset = centerStoreLeft - shopW * 0.78;
  const plazaInset = Math.max(18, width / 2 - 235 * scale);
  const planterInset = plazaInset + 42 * scale;
  const fountainLeft = width / 2 - fountainW / 2 - 108 * scale;

  return (
    <WorldScene motion={motion} testID="world-scene-town">
      <WorldLayer name="sky"><SceneSky band={band} horizon={horizon + 30} chromeBottom={chromeBottom} /></WorldLayer>
      <WorldLayer name="distant">
        <WorldObject source={TOWN_STORE_CORAL} left={sideStoreInset} top={horizon + 34} width={shopW * 0.90} height={shopH * 0.90} night={night} depth={0.32} />
        <WorldObject source={TOWN_STORE_AQUA} left={centerStoreLeft} top={horizon + 8} width={shopW * 0.96} height={shopH * 0.96} night={night} depth={0.38} />
        <WorldObject source={TOWN_STORE_VIOLET} right={sideStoreInset} top={horizon + 28} width={shopW * 0.91} height={shopH * 0.91} night={night} depth={0.34} />
        <View style={[styles.shopSign, { left: centerStoreLeft + shopW * 0.17, top: horizon + 58, width: shopW * 0.62 }]}>
          <Text style={[styles.shopSignText, { fontSize: Math.max(9, 11 * scale) }]}>BARKLY'S</Text>
        </View>
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
      </Svg></WorldLayer>
      <WorldLayer name="props">
        <WorldObject source={TOWN_PLANTER} left={planterInset} top={sidewalk - planterH + 11} width={planterW} height={planterH} night={night} depth={0.72} ambient="sway" contactShadow />
        <WorldObject source={TOWN_PLANTER} right={planterInset} top={sidewalk - planterH + 12} width={planterW} height={planterH} night={night} depth={0.72} ambient="sway" motionDelay={600} flip contactShadow />
        <WorldObject source={TOWN_LAMP} left={plazaInset} top={sidewalk - lampH + 16} width={lampW} height={lampH} night={night} depth={0.64} contactShadow />
        <WorldObject source={TOWN_LAMP} right={plazaInset} top={sidewalk - lampH + 16} width={lampW} height={lampH} night={night} depth={0.64} flip contactShadow />
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
      {night && (
        <WorldLayer name="fx">
          <TownNightLights
            lampCenters={[plazaInset + lampW / 2, width - plazaInset - lampW / 2]}
            lampTop={sidewalk - lampH + 16 + lampH * 0.06}
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
  const wave = useAmbientLoop(3000);
  const gull = useAmbientLoop(9000, 700);
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
  const oceanA = night ? DIORAMA.oceanNightA : DIORAMA.oceanDayA;
  const oceanB = night ? DIORAMA.oceanNightB : DIORAMA.oceanDayB;
  const oceanEdge = night ? DIORAMA.oceanNightEdge : DIORAMA.oceanDayEdge;
  const sandA = night ? DIORAMA.sandNightFar : DIORAMA.sandDayFar;
  const sandB = night ? DIORAMA.sandNightNear : DIORAMA.sandDayNear;
  const sandEdge = night ? DIORAMA.sandNightEdge : DIORAMA.sandDayEdge;

  const lifeguardW = 148 * scale;
  const lifeguardH = 230 * scale;
  const umbrellaW = 142 * scale;
  const umbrellaH = 194 * scale;
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
        <LinearGradient colors={[oceanA, oceanB]} style={{ position: 'absolute', left: 0, right: 0, top: horizon, height: tide - horizon + 28 }} />
        <Svg width="100%" height="100%" viewBox={`0 0 420 ${canvasHeight}`} preserveAspectRatio="none" style={styles.fill}>
        <Path d={`M-20 ${horizon + 24}Q32 ${horizon - 22} 84 ${horizon + 19}Q112 ${horizon - 2} 148 ${horizon + 27}Z`} fill={night ? DIORAMA.parkHillNight : DIORAMA.parkHillDay} opacity={0.64} />
        <Path d={`M440 ${horizon + 28}Q398 ${horizon - 18} 350 ${horizon + 17}Q320 ${horizon - 3} 286 ${horizon + 27}Z`} fill={night ? DIORAMA.parkHillNight : DIORAMA.parkHillDay} opacity={0.58} />
        <Path d={`M0 ${horizon + 36}Q82 ${horizon + 18} 164 ${horizon + 34}T316 ${horizon + 32}T430 ${horizon + 35}`} stroke={night ? DIORAMA.oceanNightLight : DIORAMA.oceanDayLight} strokeWidth={7} fill="none" opacity={night ? 0.08 : 0.30} />
        <Path d={`M-18 ${tide + 7}Q50 ${tide - 12} 118 ${tide + 4}T244 ${tide + 2}T362 ${tide + 1}T440 ${tide + 3}`} stroke={night ? DIORAMA.foamNightShade : DIORAMA.foamDayShade} strokeWidth={20} fill="none" />
        <Path d={`M-18 ${tide}Q50 ${tide - 19} 118 ${tide}T244 ${tide - 3}T362 ${tide - 4}T440 ${tide - 2}`} stroke={night ? DIORAMA.foamNight : DIORAMA.foamDay} strokeWidth={10} fill="none" />
        </Svg>
      </WorldLayer>
      <WorldLayer name="ground">
        <View style={{ position: 'absolute', left: 0, right: 0, top: sandTop + 8, bottom: 0, backgroundColor: sandEdge }} />
        <LinearGradient colors={[sandA, sandB]} style={{ position: 'absolute', left: 0, right: 0, top: sandTop, bottom: 0 }} />
        <LinearGradient colors={[oceanEdge, sandA]} style={{ position: 'absolute', left: 0, right: 0, top: sandTop, height: 54, opacity: night ? 0.12 : 0.24 }} />
        <Svg width="100%" height="100%" viewBox={`0 0 420 ${canvasHeight}`} preserveAspectRatio="none" style={styles.fill}>
          <Path d={`M44 ${sandTop + 92}q24 -8 48 0M306 ${sandTop + 82}q30 -10 58 1M122 ${sandTop + 186}q28 -7 54 2`} stroke={night ? DIORAMA.sandNightLight : DIORAMA.sandDayLight} strokeWidth={4} strokeLinecap="round" fill="none" opacity={0.34} />
          <Path d={`M74 ${sandTop + 128}l7 4 6 -5M344 ${sandTop + 166}l8 4 5 -6`} stroke={night ? DIORAMA.sandNightEdge : DIORAMA.sandDayEdge} strokeWidth={2.4} strokeLinecap="round" fill="none" opacity={0.34} />
        </Svg>
      </WorldLayer>
      <WorldLayer name="landmark">
        <WorldObject source={BEACH_PALM} left={palmLeft} top={horizon - 82} width={palmW} height={palmH} night={night} depth={0.44} opacity={0.86} ambient="sway" contactShadow />
        <WorldObject source={BEACH_LIFEGUARD} left={towerLeft} top={horizon + 16} width={lifeguardW * 0.94} height={lifeguardH * 0.94} night={night} depth={0.50} opacity={0.92} contactShadow />
        <WorldObject source={BEACH_UMBRELLA} right={umbrellaRight} top={horizon + 38} width={umbrellaW} height={umbrellaH} night={night} depth={0.56} ambient="sway" motionDelay={500} contactShadow />
      </WorldLayer>
      <WorldLayer name="foreground">
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
  cloud: { position: 'absolute', left: 23, width: 150, height: 48 },
  cloudFar: { position: 'absolute', right: 34, width: 82, height: 28 },
  cloudShade: { position: 'absolute', borderRadius: radius.pill, backgroundColor: DIORAMA.aquaLight },
  cloudPuff: { position: 'absolute', borderRadius: radius.pill, backgroundColor: DIORAMA.white },
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
  shopSign: { position: 'absolute', height: 24, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: DIORAMA.butter, borderWidth: 2, borderColor: DIORAMA.townBlueEdge, ...elevation.low },
  shopSignText: { fontWeight: '900', letterSpacing: 1.2, color: DIORAMA.townBlueEdge },
  waveGlint: { position: 'absolute', right: 62, width: 64, height: 5, borderRadius: radius.pill, backgroundColor: DIORAMA.white },
  gull: { position: 'absolute', left: 0, width: 32, height: 18 },
  gullLeft: { position: 'absolute', left: 0, top: 8, width: 18, height: 3, borderRadius: radius.sm, backgroundColor: DIORAMA.inkSoft, transform: [{ rotate: '-22deg' }] },
  gullRight: { position: 'absolute', right: 0, top: 8, width: 18, height: 3, borderRadius: radius.sm, backgroundColor: DIORAMA.inkSoft, transform: [{ rotate: '22deg' }] },
});
