import React, { useEffect, useRef } from 'react';
import { Animated, ColorValue, Easing, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { DIORAMA } from './artPalette';
import { skyBand, SkyBand } from './CandyScenesV2';
import { elevation, radius } from '../theme';
import {
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

function SceneSky({ band, horizon }: { band: SkyBand; horizon: number }) {
  const night = band === 'night';
  const drift = useAmbientLoop(15000);
  return (
    <View style={styles.fill}>
      <LinearGradient colors={SKY[band]} style={styles.fill} />
      <View
        style={[
          styles.sun,
          {
            top: Math.max(66, horizon - 126),
            backgroundColor: night ? DIORAMA.goldLight : DIORAMA.lemon,
            opacity: night ? 0.82 : 1,
          },
        ]}
      />
      {night && <View style={[styles.moonCutout, { top: Math.max(58, horizon - 134), backgroundColor: DIORAMA.skyNightA }]} />}
      <Animated.View
        style={[
          styles.cloud,
          {
            top: Math.max(82, horizon - 96),
            opacity: night ? 0.10 : 0.54,
            transform: [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-18, 22] }) }],
          },
        ]}
      >
        <View style={[styles.cloudPuff, { left: 0, top: 18, width: 72, height: 25 }]} />
        <View style={[styles.cloudPuff, { left: 42, top: 0, width: 68, height: 43 }]} />
        <View style={[styles.cloudPuff, { left: 86, top: 16, width: 62, height: 27 }]} />
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
export function ParkScene({ hour, bandHeight = 620, groundY, motion = 'idle' }: { hour: number; bandHeight?: number; groundY?: number; motion?: WorldMotion }) {
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
  const path = night ? DIORAMA.parkPathNight : DIORAMA.parkPathDay;
  const pathEdge = night ? DIORAMA.parkPathNightEdge : DIORAMA.parkPathDayEdge;

  const treeW = 204 * scale;
  const treeH = 292 * scale;
  const benchW = 134 * scale;
  const benchH = 98 * scale;
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
      <WorldLayer name="sky"><SceneSky band={band} horizon={horizon} /></WorldLayer>
      <WorldLayer name="ground"><Svg width="100%" height="100%" viewBox={`0 0 420 ${canvasHeight}`} preserveAspectRatio="none" style={styles.fill}>
        <Defs>
          <SvgLinearGradient id="parkGroundV3" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={grassFar} />
            <Stop offset="0.38" stopColor={grass} />
            <Stop offset="1" stopColor={grassNear} />
          </SvgLinearGradient>
          <SvgLinearGradient id="parkPathV3" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={night ? DIORAMA.parkPathNightLight : DIORAMA.parkPathDayLight} />
            <Stop offset="1" stopColor={path} />
          </SvgLinearGradient>
        </Defs>
        <Path d={`M-20 ${horizon + 76}Q70 ${horizon - 12} 160 ${horizon + 50}Q246 ${horizon + 106} 330 ${horizon + 30}Q378 ${horizon - 2} 445 ${horizon + 50}V${canvasHeight}H-20Z`} fill={grassNear} />
        <Path d={`M-20 ${horizon + 61}Q70 ${horizon - 27} 160 ${horizon + 35}Q246 ${horizon + 91} 330 ${horizon + 15}Q378 ${horizon - 17} 445 ${horizon + 35}V${canvasHeight}H-20Z`} fill={night ? DIORAMA.parkHillNight : DIORAMA.parkHillDay} />
        <Path d={`M-20 ${horizon + 122}Q96 ${horizon + 48} 222 ${horizon + 92}Q322 ${horizon + 122} 448 ${horizon + 62}V${canvasHeight}H-20Z`} fill="url(#parkGroundV3)" />
        <Path d={`M310 ${horizon + 70}C336 ${horizon + 116} 350 ${horizon + 164} 332 ${ground - 10}C314 ${ground + 20} 320 ${ground + 56} 360 ${ground + 92}L405 ${ground + 82}C360 ${ground + 48} 354 ${ground + 18} 372 ${ground - 16}C394 ${horizon + 154} 376 ${horizon + 106} 330 ${horizon + 68}Z`} fill={pathEdge} />
        <Path d={`M318 ${horizon + 72}C342 ${horizon + 118} 354 ${horizon + 160} 340 ${ground - 8}C326 ${ground + 18} 334 ${ground + 48} 370 ${ground + 80}L393 ${ground + 75}C354 ${ground + 43} 348 ${ground + 16} 364 ${ground - 14}C384 ${horizon + 151} 369 ${horizon + 111} 328 ${horizon + 72}Z`} fill="url(#parkPathV3)" />
        <Path d={`M330 ${horizon + 86}C349 ${horizon + 125} 359 ${horizon + 158} 349 ${ground - 5}C340 ${ground + 16} 345 ${ground + 37} 374 ${ground + 64}`} stroke={DIORAMA.white} strokeWidth={4} fill="none" opacity={night ? 0.04 : 0.16} />
        <Path d={`M36 ${ground + 28}q6 -12 12 0M48 ${ground + 28}q6 -14 12 0M166 ${ground + 78}q5 -11 10 0M176 ${ground + 78}q5 -13 10 0M246 ${ground + 36}q5 -10 10 0`} stroke={night ? DIORAMA.parkGrassNightLight : DIORAMA.parkGrassDayLight} strokeWidth={3} fill="none" opacity={0.72} />
        <Path d={`M84 ${ground + 92}l4 -6 4 6 4 -6 4 6M222 ${ground + 116}l4 -6 4 6 4 -6 4 6`} stroke={night ? DIORAMA.gold : DIORAMA.lemon} strokeWidth={2.5} fill="none" opacity={night ? 0.24 : 0.68} />
      </Svg></WorldLayer>
      <WorldLayer name="distant">
        <WorldObject source={PARK_HEDGE} left={hedgeLeft} top={horizon + 43} width={hedgeW * 0.62} height={hedgeH * 0.62} night={night} depth={0.25} opacity={0.70} ambient="sway" />
        <WorldObject source={PARK_HEDGE} right={hedgeRight} top={horizon + 57} width={hedgeW * 0.55} height={hedgeH * 0.55} night={night} depth={0.22} opacity={0.62} ambient="sway" motionDelay={700} />
      </WorldLayer>
      <WorldLayer name="landmark">
        <WorldObject source={PARK_TREE} left={treeLeft} top={horizon - 88} width={treeW} height={treeH} night={night} depth={0.55} ambient="sway" contactShadow />
        <WorldObject source={PARK_TREE} right={treeRight} top={horizon - 80} width={treeW * 0.96} height={treeH * 0.96} night={night} depth={0.52} ambient="sway" motionDelay={900} flip contactShadow />
      </WorldLayer>
      <WorldLayer name="props">
        <WorldObject source={PARK_BENCH} left={benchLeft} top={horizon + 145} width={benchW} height={benchH} night={night} depth={0.78} contactShadow />
      </WorldLayer>
      <WorldLayer name="fx"><ParkMotion night={night} horizon={horizon} /></WorldLayer>
      <WorldLighting ground={ground} night={night} />
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

/** Town buildings are separate rendered modules; sidewalk, road, and weather stay live. */
export function TownScene({ hour, bandHeight = 620, groundY, motion = 'idle' }: { hour: number; bandHeight?: number; groundY?: number; motion?: WorldMotion }) {
  const { width, height } = useWindowDimensions();
  const scale = worldScale(width, height);
  const band = skyBand(hour);
  const night = band === 'night';
  const ground = groundY ?? bandHeight * 0.72;
  const canvasHeight = ground + 264;
  const horizon = clamp(ground - 458, 116, 154);
  const sidewalk = Math.max(372, ground - 116);
  const walk = night ? DIORAMA.townSidewalkNight : DIORAMA.townSidewalkDay;
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
      <WorldLayer name="sky"><SceneSky band={band} horizon={horizon + 30} /></WorldLayer>
      <WorldLayer name="distant">
        <WorldObject source={TOWN_STORE_CORAL} left={sideStoreInset} top={horizon + 34} width={shopW * 0.90} height={shopH * 0.90} night={night} depth={0.32} opacity={0.82} />
        <WorldObject source={TOWN_STORE_AQUA} left={centerStoreLeft} top={horizon + 8} width={shopW * 0.96} height={shopH * 0.96} night={night} depth={0.38} />
        <WorldObject source={TOWN_STORE_VIOLET} right={sideStoreInset} top={horizon + 28} width={shopW * 0.91} height={shopH * 0.91} night={night} depth={0.34} opacity={0.84} />
        <View style={[styles.shopSign, { left: centerStoreLeft + shopW * 0.17, top: horizon + 58, width: shopW * 0.62 }]}>
          <Text style={[styles.shopSignText, { fontSize: Math.max(9, 11 * scale) }]}>BARKLY'S</Text>
        </View>
      </WorldLayer>
      <WorldLayer name="ground"><Svg width="100%" height="100%" viewBox={`0 0 420 ${canvasHeight}`} preserveAspectRatio="none" style={styles.fill}>
        <Rect x={0} y={sidewalk + 9} width={420} height={canvasHeight - sidewalk} fill={walkEdge} />
        <Rect x={0} y={sidewalk} width={420} height={canvasHeight - sidewalk - 9} fill={walk} />
        <Path d={`M0 ${sidewalk + 7}H420`} stroke={DIORAMA.white} strokeWidth={7} opacity={night ? 0.05 : 0.22} />
        <Path d={`M104 ${sidewalk}L142 ${canvasHeight}M310 ${sidewalk}L342 ${canvasHeight}`} stroke={walkEdge} strokeWidth={2} opacity={0.16} />
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
      <WorldLighting ground={ground} night={night} warm />
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
export function BeachScene({ hour, bandHeight = 620, groundY, motion = 'idle' }: { hour: number; bandHeight?: number; groundY?: number; motion?: WorldMotion }) {
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
      <WorldLayer name="sky"><SceneSky band={band} horizon={horizon} /></WorldLayer>
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
      <WorldLighting ground={ground} night={night} warm />
    </WorldScene>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  sun: { position: 'absolute', right: 34, width: 50, height: 50, borderRadius: radius.pill },
  moonCutout: { position: 'absolute', right: 20, width: 48, height: 48, borderRadius: radius.pill },
  cloud: { position: 'absolute', left: 23, width: 150, height: 46 },
  cloudPuff: { position: 'absolute', borderRadius: radius.pill, backgroundColor: DIORAMA.white },
  fallingLeaf: { position: 'absolute', left: 34, width: 17, height: 9, borderTopLeftRadius: radius.md, borderBottomRightRadius: radius.md, backgroundColor: DIORAMA.parkTreeDayLight },
  fallingLeafSmall: { left: 0, width: 12, height: 7, backgroundColor: DIORAMA.parkTreeDay },
  butterfly: { position: 'absolute', left: 0, width: 22, height: 14 },
  butterflyLeft: { position: 'absolute', left: 1, top: 3, width: 10, height: 7, borderRadius: radius.pill, backgroundColor: DIORAMA.lemon, transform: [{ rotate: '-24deg' }] },
  butterflyRight: { position: 'absolute', right: 1, top: 3, width: 10, height: 7, borderRadius: radius.pill, backgroundColor: DIORAMA.coralLight, transform: [{ rotate: '24deg' }] },
  townGlint: { position: 'absolute', left: 0, width: 18, height: 190, borderRadius: radius.pill, backgroundColor: DIORAMA.white },
  fountainSpark: { position: 'absolute', width: 9, height: 9, borderRadius: radius.pill, backgroundColor: DIORAMA.white },
  shopSign: { position: 'absolute', height: 24, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: DIORAMA.cream, borderWidth: 2, borderColor: DIORAMA.townBlueEdge, ...elevation.low },
  shopSignText: { fontWeight: '900', letterSpacing: 1.2, color: DIORAMA.townBlueEdge },
  waveGlint: { position: 'absolute', right: 62, width: 64, height: 5, borderRadius: radius.pill, backgroundColor: DIORAMA.white },
  gull: { position: 'absolute', left: 0, width: 32, height: 18 },
  gullLeft: { position: 'absolute', left: 0, top: 8, width: 18, height: 3, borderRadius: radius.sm, backgroundColor: DIORAMA.inkSoft, transform: [{ rotate: '-22deg' }] },
  gullRight: { position: 'absolute', right: 0, top: 8, width: 18, height: 3, borderRadius: radius.sm, backgroundColor: DIORAMA.inkSoft, transform: [{ rotate: '22deg' }] },
});
