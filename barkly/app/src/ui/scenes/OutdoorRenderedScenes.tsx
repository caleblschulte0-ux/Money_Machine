import React, { useEffect, useRef } from 'react';
import { Animated, ColorValue, Easing, Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { DIORAMA } from './artPalette';
import { skyBand, SkyBand } from './CandyScenesV2';
import { radius } from '../theme';

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

function RenderedProp({
  source,
  left,
  right,
  top,
  width,
  height,
  night,
  opacity = 1,
  rotate,
  flip = false,
}: {
  source: ReturnType<typeof require>;
  left?: number;
  right?: number;
  top: number;
  width: number;
  height: number;
  night: boolean;
  opacity?: number;
  rotate?: string;
  flip?: boolean;
}) {
  const transforms: Array<{ rotate: string } | { scaleX: number }> = [];
  if (rotate) transforms.push({ rotate });
  if (flip) transforms.push({ scaleX: -1 });
  return (
    <Image
      source={source}
      resizeMode="contain"
      style={{
        position: 'absolute',
        left,
        right,
        top,
        width,
        height,
        opacity: opacity * (night ? 0.76 : 1),
        transform: transforms.length ? transforms : undefined,
      }}
    />
  );
}

function StageLight({ ground, night, warm = false }: { ground: number; night: boolean; warm?: boolean }) {
  return (
    <View
      style={[
        styles.stageLight,
        {
          top: ground - 52,
          backgroundColor: warm ? DIORAMA.goldGlowSoft : DIORAMA.white,
          opacity: night ? 0.035 : warm ? 0.12 : 0.09,
        },
      ]}
    />
  );
}

function SceneFinish({ night, warm = false }: { night: boolean; warm?: boolean }) {
  return (
    <View style={styles.fill} pointerEvents="none">
      <LinearGradient
        colors={[
          warm ? 'rgba(255,226,172,0.08)' : 'rgba(214,239,229,0.06)',
          'rgba(255,255,255,0)',
          night ? 'rgba(20,22,34,0.20)' : 'rgba(48,34,24,0.08)',
        ]}
        locations={[0, 0.55, 1]}
        style={styles.fill}
      />
      <LinearGradient colors={['rgba(20,18,25,0)', night ? 'rgba(16,18,30,0.20)' : 'rgba(38,28,20,0.10)']} style={styles.bottomGrade} />
    </View>
  );
}

function ParkMotion({ night, horizon }: { night: boolean; horizon: number }) {
  const leaf = useAmbientLoop(6200);
  return (
    <Animated.View
      style={[
        styles.fallingLeaf,
        {
          top: horizon + 72,
          opacity: night ? 0.12 : 0.50,
          transform: [
            { translateX: leaf.interpolate({ inputRange: [0, 1], outputRange: [-30, 170] }) },
            { translateY: leaf.interpolate({ inputRange: [0, 1], outputRange: [0, 56] }) },
            { rotate: leaf.interpolate({ inputRange: [0, 1], outputRange: ['-20deg', '150deg'] }) },
          ],
        },
      ]}
    />
  );
}

/** Park keeps terrain live in code and composes independent rendered landmarks over it. */
export function ParkScene({ hour, bandHeight = 620, groundY }: { hour: number; bandHeight?: number; groundY?: number }) {
  const { width } = useWindowDimensions();
  const scale = clamp(width / 390, 0.92, 1.06);
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

  return (
    <View style={styles.fill} pointerEvents="none">
      <SceneSky band={band} horizon={horizon} />
      <Svg width="100%" height="100%" viewBox={`0 0 420 ${canvasHeight}`} preserveAspectRatio="none" style={styles.fill}>
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
        <Path d={`M197 ${horizon + 70}C205 ${horizon + 150} 157 ${ground + 64} 88 ${canvasHeight}H332C264 ${ground + 64} 216 ${horizon + 150} 226 ${horizon + 70}Z`} fill={pathEdge} />
        <Path d={`M203 ${horizon + 69}C212 ${horizon + 148} 176 ${ground + 55} 118 ${canvasHeight}H304C248 ${ground + 56} 211 ${horizon + 148} 220 ${horizon + 69}Z`} fill="url(#parkPathV3)" />
        <Path d={`M211 ${horizon + 84}C216 ${horizon + 154} 190 ${ground + 35} 150 ${canvasHeight}`} stroke={DIORAMA.white} strokeWidth={5} fill="none" opacity={night ? 0.04 : 0.18} />
      </Svg>
      <RenderedProp source={PARK_HEDGE} left={112} top={horizon + 43} width={hedgeW * 0.62} height={hedgeH * 0.62} night={night} opacity={0.70} />
      <RenderedProp source={PARK_HEDGE} right={82} top={horizon + 57} width={hedgeW * 0.55} height={hedgeH * 0.55} night={night} opacity={0.62} />
      <RenderedProp source={PARK_TREE} left={-43} top={horizon - 88} width={treeW} height={treeH} night={night} />
      <RenderedProp source={PARK_TREE} right={-42} top={horizon - 80} width={treeW * 0.96} height={treeH * 0.96} night={night} flip />
      <RenderedProp source={PARK_BENCH} left={18} top={horizon + 145} width={benchW} height={benchH} night={night} rotate="-1deg" />
      <StageLight ground={ground} night={night} />
      <ParkMotion night={night} horizon={horizon} />
      <SceneFinish night={night} />
    </View>
  );
}

function TownGlint({ night, top }: { night: boolean; top: number }) {
  const glint = useAmbientLoop(4200, 400);
  return (
    <Animated.View
      style={[
        styles.townGlint,
        {
          top,
          opacity: glint.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, night ? 0.10 : 0.24, 0] }),
          transform: [{ translateX: glint.interpolate({ inputRange: [0, 1], outputRange: [-40, 420] }) }, { rotate: '12deg' }],
        },
      ]}
    />
  );
}

/** Town buildings are separate rendered modules; sidewalk, road, and weather stay live. */
export function TownScene({ hour, bandHeight = 620, groundY }: { hour: number; bandHeight?: number; groundY?: number }) {
  const { width } = useWindowDimensions();
  const scale = clamp(width / 390, 0.92, 1.06);
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

  const shopW = 176 * scale;
  const shopH = 344 * scale;
  const lampW = 62 * scale;
  const lampH = 174 * scale;
  const fountainW = 112 * scale;
  const fountainH = 102 * scale;
  const planterW = 72 * scale;
  const planterH = 92 * scale;

  return (
    <View style={styles.fill} pointerEvents="none">
      <SceneSky band={band} horizon={horizon + 30} />
      <RenderedProp source={TOWN_STORE_CORAL} left={-46} top={horizon + 41} width={shopW * 0.92} height={shopH * 0.92} night={night} opacity={0.88} />
      <RenderedProp source={TOWN_STORE_AQUA} left={112} top={horizon} width={shopW * 1.08} height={shopH * 1.08} night={night} />
      <RenderedProp source={TOWN_STORE_VIOLET} right={-48} top={horizon + 30} width={shopW * 0.94} height={shopH * 0.94} night={night} opacity={0.90} />
      <Svg width="100%" height="100%" viewBox={`0 0 420 ${canvasHeight}`} preserveAspectRatio="none" style={styles.fill}>
        <Rect x={0} y={sidewalk + 9} width={420} height={canvasHeight - sidewalk} fill={walkEdge} />
        <Rect x={0} y={sidewalk} width={420} height={canvasHeight - sidewalk - 9} fill={walk} />
        <Path d={`M0 ${sidewalk + 7}H420`} stroke={DIORAMA.white} strokeWidth={7} opacity={night ? 0.05 : 0.22} />
        <Path d={`M104 ${sidewalk}L142 ${canvasHeight}M310 ${sidewalk}L342 ${canvasHeight}`} stroke={walkEdge} strokeWidth={2} opacity={0.16} />
        <Rect x={0} y={ground + 92} width={420} height={canvasHeight - ground - 92} fill={roadEdge} />
        <Rect x={0} y={ground + 100} width={420} height={canvasHeight - ground - 100} fill={road} />
        <Path d={`M20 ${ground + 128}H112M166 ${ground + 128}H258M312 ${ground + 128}H402`} stroke={DIORAMA.cream} strokeWidth={7} strokeLinecap="round" opacity={night ? 0.10 : 0.38} />
      </Svg>
      <RenderedProp source={TOWN_PLANTER} left={8} top={sidewalk - planterH + 11} width={planterW} height={planterH} night={night} />
      <RenderedProp source={TOWN_PLANTER} right={11} top={sidewalk - planterH + 12} width={planterW} height={planterH} night={night} flip />
      <RenderedProp source={TOWN_LAMP} left={45} top={sidewalk - lampH + 16} width={lampW} height={lampH} night={night} />
      <RenderedProp source={TOWN_LAMP} right={42} top={sidewalk - lampH + 16} width={lampW} height={lampH} night={night} flip />
      <RenderedProp source={TOWN_FOUNTAIN} left={154} top={sidewalk - 40} width={fountainW} height={fountainH} night={night} />
      <StageLight ground={ground} night={night} warm />
      <TownGlint night={night} top={horizon + 132} />
      <SceneFinish night={night} warm />
    </View>
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
export function BeachScene({ hour, bandHeight = 620, groundY }: { hour: number; bandHeight?: number; groundY?: number }) {
  const { width } = useWindowDimensions();
  const scale = clamp(width / 390, 0.92, 1.06);
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

  return (
    <View style={styles.fill} pointerEvents="none">
      <SceneSky band={band} horizon={horizon} />
      <LinearGradient colors={[oceanA, oceanB]} style={{ position: 'absolute', left: 0, right: 0, top: horizon, height: tide - horizon + 28 }} />
      <Svg width="100%" height="100%" viewBox={`0 0 420 ${canvasHeight}`} preserveAspectRatio="none" style={styles.fill}>
        <Path d={`M-20 ${horizon + 24}Q32 ${horizon - 22} 84 ${horizon + 19}Q112 ${horizon - 2} 148 ${horizon + 27}Z`} fill={night ? DIORAMA.parkHillNight : DIORAMA.parkHillDay} opacity={0.64} />
        <Path d={`M440 ${horizon + 28}Q398 ${horizon - 18} 350 ${horizon + 17}Q320 ${horizon - 3} 286 ${horizon + 27}Z`} fill={night ? DIORAMA.parkHillNight : DIORAMA.parkHillDay} opacity={0.58} />
        <Path d={`M0 ${horizon + 36}Q82 ${horizon + 18} 164 ${horizon + 34}T316 ${horizon + 32}T430 ${horizon + 35}`} stroke={night ? DIORAMA.oceanNightLight : DIORAMA.oceanDayLight} strokeWidth={7} fill="none" opacity={night ? 0.08 : 0.30} />
        <Path d={`M-18 ${tide + 7}Q50 ${tide - 12} 118 ${tide + 4}T244 ${tide + 2}T362 ${tide + 1}T440 ${tide + 3}`} stroke={night ? DIORAMA.foamNightShade : DIORAMA.foamDayShade} strokeWidth={20} fill="none" />
        <Path d={`M-18 ${tide}Q50 ${tide - 19} 118 ${tide}T244 ${tide - 3}T362 ${tide - 4}T440 ${tide - 2}`} stroke={night ? DIORAMA.foamNight : DIORAMA.foamDay} strokeWidth={10} fill="none" />
      </Svg>
      <View style={{ position: 'absolute', left: 0, right: 0, top: sandTop + 8, bottom: 0, backgroundColor: sandEdge }} />
      <LinearGradient colors={[sandA, sandB]} style={{ position: 'absolute', left: 0, right: 0, top: sandTop, bottom: 0 }} />
      <LinearGradient colors={[oceanEdge, sandA]} style={{ position: 'absolute', left: 0, right: 0, top: sandTop, height: 54, opacity: night ? 0.12 : 0.24 }} />
      <RenderedProp source={BEACH_PALM} left={-48} top={horizon - 82} width={palmW} height={palmH} night={night} opacity={0.86} />
      <RenderedProp source={BEACH_LIFEGUARD} left={23} top={horizon + 12} width={lifeguardW} height={lifeguardH} night={night} opacity={0.94} />
      <RenderedProp source={BEACH_UMBRELLA} right={-9} top={horizon + 34} width={umbrellaW} height={umbrellaH} night={night} />
      <RenderedProp source={BEACH_DUNE} left={-38} top={sandTop + 92} width={duneW} height={duneH} night={night} opacity={0.90} />
      <RenderedProp source={BEACH_DUNE} right={-48} top={sandTop + 132} width={duneW * 0.90} height={duneH * 0.90} night={night} opacity={0.82} flip />
      <RenderedProp source={BEACH_CASTLE} right={76} top={ground + 8} width={castleW} height={castleH} night={night} rotate="1deg" />
      <StageLight ground={ground} night={night} warm />
      <BeachMotion night={night} tide={tide} />
      <SceneFinish night={night} warm />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  sun: { position: 'absolute', right: 34, width: 50, height: 50, borderRadius: radius.pill },
  moonCutout: { position: 'absolute', right: 20, width: 48, height: 48, borderRadius: radius.pill },
  cloud: { position: 'absolute', left: 23, width: 150, height: 46 },
  cloudPuff: { position: 'absolute', borderRadius: radius.pill, backgroundColor: DIORAMA.white },
  stageLight: { position: 'absolute', left: '9%', right: '9%', height: 132, borderRadius: radius.pill, transform: [{ scaleX: 1.18 }] },
  bottomGrade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 140 },
  fallingLeaf: { position: 'absolute', left: 34, width: 17, height: 9, borderTopLeftRadius: radius.md, borderBottomRightRadius: radius.md, backgroundColor: DIORAMA.parkTreeDayLight },
  townGlint: { position: 'absolute', left: 0, width: 18, height: 190, borderRadius: radius.pill, backgroundColor: DIORAMA.white },
  waveGlint: { position: 'absolute', right: 62, width: 64, height: 5, borderRadius: radius.pill, backgroundColor: DIORAMA.white },
  gull: { position: 'absolute', left: 0, width: 32, height: 18 },
  gullLeft: { position: 'absolute', left: 0, top: 8, width: 18, height: 3, borderRadius: radius.sm, backgroundColor: DIORAMA.inkSoft, transform: [{ rotate: '-22deg' }] },
  gullRight: { position: 'absolute', right: 0, top: 8, width: 18, height: 3, borderRadius: radius.sm, backgroundColor: DIORAMA.inkSoft, transform: [{ rotate: '22deg' }] },
});
