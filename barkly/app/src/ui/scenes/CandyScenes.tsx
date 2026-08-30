import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { DIORAMA } from './artPalette';
import { radius } from '../theme';

export type SkyBand = 'morning' | 'day' | 'evening' | 'night';

export function skyBand(hour: number): SkyBand {
  if (hour >= 21 || hour < 6) return 'night';
  if (hour < 10) return 'morning';
  if (hour < 17) return 'day';
  return 'evening';
}

const SKY: Record<SkyBand, [string, string]> = {
  morning: [DIORAMA.skyMorningA, DIORAMA.skyMorningB],
  day: [DIORAMA.skyDayA, DIORAMA.skyDayB],
  evening: [DIORAMA.skyEveningA, DIORAMA.skyEveningB],
  night: [DIORAMA.skyNightA, DIORAMA.skyNightB],
};

function useLoop(duration: number, delay = 0) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(value, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [delay, duration, value]);
  return value;
}

function Cloud({ left, top, scale = 1, night = false }: { left: number; top: number; scale?: number; night?: boolean }) {
  return (
    <View style={{ position: 'absolute', left, top, width: 124 * scale, height: 45 * scale, opacity: night ? 0.13 : 0.88 }}>
      <View style={[styles.cloudLobe, { left: 0, top: 13 * scale, width: 58 * scale, height: 24 * scale }]} />
      <View style={[styles.cloudLobe, { left: 30 * scale, top: 0, width: 50 * scale, height: 34 * scale }]} />
      <View style={[styles.cloudLobe, { left: 67 * scale, top: 12 * scale, width: 57 * scale, height: 25 * scale }]} />
      <View style={{ position: 'absolute', left: 18 * scale, right: 8 * scale, bottom: 2, height: 8 * scale, borderRadius: radius.pill, backgroundColor: DIORAMA.shadow, opacity: night ? 0.09 : 0.08 }} />
    </View>
  );
}

function SkyBackdrop({ band, horizon = 330 }: { band: SkyBand; horizon?: number }) {
  const night = band === 'night';
  const driftA = useLoop(11000);
  const driftB = useLoop(14500, 1200);
  return (
    <View style={styles.fill} pointerEvents="none">
      <LinearGradient colors={SKY[band]} style={styles.fill} />
      <Svg width="100%" height="100%" viewBox="0 0 420 760" preserveAspectRatio="none" style={styles.fill}>
        {night ? (
          <>
            <Circle cx={338} cy={110} r={34} fill={DIORAMA.goldLight} />
            <Circle cx={326} cy={98} r={31} fill={DIORAMA.skyNightA} />
            {[36, 91, 156, 213, 278, 391].map((x, i) => (
              <Circle key={x} cx={x} cy={68 + (i % 3) * 38} r={i % 2 === 0 ? 2.2 : 1.5} fill={DIORAMA.paleCream} opacity={0.86} />
            ))}
          </>
        ) : (
          <>
            <Circle cx={340} cy={105} r={43} fill={DIORAMA.goldLight} opacity={0.38} />
            <Circle cx={340} cy={105} r={32} fill={DIORAMA.lemon} />
            <Path d="M323 91Q340 79 357 91" stroke={DIORAMA.white} strokeWidth={5} strokeLinecap="round" opacity={0.44} />
          </>
        )}
        <Path d={`M-25 ${horizon + 18}Q72 ${horizon - 52} 170 ${horizon + 12}T310 ${horizon - 9}T460 ${horizon + 20}V760H-25Z`} fill={night ? DIORAMA.hillNight : DIORAMA.hillDay} opacity={0.72} />
      </Svg>
      <Animated.View style={{ position: 'absolute', left: 22, top: 108, transform: [{ translateX: driftA.interpolate({ inputRange: [0, 1], outputRange: [-14, 34] }) }] }}>
        <Cloud left={0} top={0} scale={0.92} night={night} />
      </Animated.View>
      <Animated.View style={{ position: 'absolute', right: 10, top: 184, transform: [{ translateX: driftB.interpolate({ inputRange: [0, 1], outputRange: [18, -32] }) }] }}>
        <Cloud left={0} top={0} scale={0.66} night={night} />
      </Animated.View>
    </View>
  );
}

function ArchedWindow({ band, upgraded }: { band: SkyBand; upgraded: boolean }) {
  const night = band === 'night';
  const w = upgraded ? 178 : 156;
  const h = upgraded ? 142 : 124;
  const edge = night ? DIORAMA.windowFrameNightEdge : DIORAMA.windowFrameDayEdge;
  const frame = night ? DIORAMA.windowFrameNight : DIORAMA.windowFrameDay;
  return (
    <View style={{ width: w + 16, height: h + 22 }}>
      <View style={{ position: 'absolute', left: 8, right: 0, top: 8, bottom: 0, borderRadius: radius.xl, backgroundColor: DIORAMA.shadow, opacity: 0.18 }} />
      <View style={{ width: w, height: h, borderRadius: radius.xl, borderWidth: 9, borderColor: edge, overflow: 'hidden', backgroundColor: frame }}>
        <LinearGradient colors={SKY[band]} style={styles.fill} />
        <Svg width="100%" height="100%" viewBox="0 0 160 120" preserveAspectRatio="none">
          {night ? (
            <><Circle cx={122} cy={30} r={14} fill={DIORAMA.goldLight} /><Circle cx={115} cy={24} r={13} fill={DIORAMA.skyNightA} /></>
          ) : <Circle cx={126} cy={28} r={16} fill={DIORAMA.lemon} />}
          <Path d="M0 91Q36 64 76 85T160 79V120H0Z" fill={night ? DIORAMA.hillNight : DIORAMA.hillDay} />
          <Path d="M0 102Q46 78 87 99T160 94V120H0Z" fill={night ? DIORAMA.parkHillNight : DIORAMA.parkHillDay} />
          <Path d="M13 12Q58 2 98 13" stroke={DIORAMA.white} strokeWidth={8} strokeLinecap="round" opacity={0.44} />
        </Svg>
        <View style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 6, marginLeft: -3, backgroundColor: frame }} />
        <View style={{ position: 'absolute', top: '54%', left: 0, right: 0, height: 6, backgroundColor: frame }} />
      </View>
      <View style={{ position: 'absolute', left: -7, right: 10, bottom: 1, height: 15, borderRadius: radius.md, backgroundColor: edge }} />
      <View style={{ position: 'absolute', left: 3, right: 20, bottom: 7, height: 7, borderRadius: radius.pill, backgroundColor: DIORAMA.woodShine, opacity: night ? 0.18 : 0.44 }} />
    </View>
  );
}

function PremiumSofa({ night }: { night: boolean }) {
  const base = night ? DIORAMA.couchNight : DIORAMA.couchDay;
  const top = night ? DIORAMA.couchNightTop : DIORAMA.couchDayTop;
  const seat = night ? DIORAMA.couchNightSeat : DIORAMA.couchDaySeat;
  const edge = night ? DIORAMA.couchNightEdge : DIORAMA.couchDayEdge;
  return (
    <Svg width={188} height={126} viewBox="0 0 188 126">
      <Ellipse cx={96} cy={117} rx={78} ry={8} fill={DIORAMA.shadow} opacity={0.22} />
      <Rect x={20} y={24} width={150} height={72} rx={30} fill={edge} />
      <Rect x={20} y={15} width={150} height={72} rx={30} fill={base} />
      <Rect x={24} y={18} width={142} height={21} rx={12} fill={top} />
      <Rect x={3} y={51} width={42} height={55} rx={20} fill={edge} />
      <Rect x={0} y={43} width={42} height={55} rx={20} fill={base} />
      <Rect x={146} y={51} width={42} height={55} rx={20} fill={edge} />
      <Rect x={146} y={43} width={42} height={55} rx={20} fill={base} />
      <Rect x={31} y={70} width={61} height={31} rx={14} fill={seat} />
      <Rect x={97} y={70} width={61} height={31} rx={14} fill={seat} />
      <Rect x={44} y={36} width={36} height={35} rx={12} fill={DIORAMA.lemon} transform="rotate(-8 62 53)" />
      <Rect x={107} y={39} width={35} height={31} rx={11} fill={DIORAMA.aquaLight} transform="rotate(7 124 54)" />
      <Path d="M32 27H155" stroke={DIORAMA.white} strokeWidth={7} strokeLinecap="round" opacity={night ? 0.16 : 0.37} />
      <Path d="M11 52Q18 47 28 48" stroke={DIORAMA.white} strokeWidth={5} strokeLinecap="round" opacity={night ? 0.11 : 0.28} />
    </Svg>
  );
}

function HomeShelf({ night }: { night: boolean }) {
  return (
    <Svg width={124} height={88} viewBox="0 0 124 88">
      <Rect x={7} y={72} width={110} height={12} rx={6} fill={DIORAMA.woodDeep} />
      <Rect x={5} y={66} width={112} height={12} rx={6} fill={DIORAMA.woodWarm} />
      <Path d="M18 68H104" stroke={DIORAMA.woodShine} strokeWidth={4} strokeLinecap="round" opacity={night ? 0.12 : 0.42} />
      <Rect x={15} y={31} width={26} height={35} rx={9} fill={night ? DIORAMA.violetNight : DIORAMA.violet} />
      <Rect x={47} y={19} width={26} height={47} rx={9} fill={night ? DIORAMA.townBlueNight : DIORAMA.aqua} />
      <Rect x={79} y={26} width={27} height={40} rx={9} fill={night ? DIORAMA.couchNight : DIORAMA.coral} />
      {[20, 52, 84].map((x) => <Path key={x} d={`M${x} 38H${x + 15}`} stroke={DIORAMA.white} strokeWidth={5} strokeLinecap="round" opacity={night ? 0.12 : 0.42} />)}
      <Circle cx={18} cy={18} r={11} fill={DIORAMA.lemon} />
      <Circle cx={18} cy={18} r={5} fill={DIORAMA.goldDeep} />
    </Svg>
  );
}

function FloorLamp({ night }: { night: boolean }) {
  return (
    <Svg width={76} height={162} viewBox="0 0 76 162">
      {night && <Circle cx={37} cy={31} r={36} fill={DIORAMA.goldGlow} opacity={0.22} />}
      <Ellipse cx={38} cy={154} rx={27} ry={7} fill={DIORAMA.shadow} opacity={0.2} />
      <Rect x={34} y={49} width={8} height={91} rx={4} fill={DIORAMA.woodDeep} />
      <Path d="M38 54V131" stroke={DIORAMA.woodShine} strokeWidth={3} strokeLinecap="round" opacity={0.34} />
      <Ellipse cx={38} cy={145} rx={22} ry={8} fill={DIORAMA.woodDark} />
      <Path d="M14 8H61L69 47H6Z" fill={night ? DIORAMA.goldGlow : DIORAMA.gold} />
      <Path d="M18 10H57L59 21H15Z" fill={DIORAMA.goldLight} opacity={0.76} />
      <Path d="M20 14H45" stroke={DIORAMA.white} strokeWidth={4} strokeLinecap="round" opacity={0.4} />
    </Svg>
  );
}

function HomeAmbient({ night }: { night: boolean }) {
  const beam = useLoop(3600);
  const mote = useLoop(5600, 700);
  const glow = useLoop(2800, 300);
  return (
    <View style={styles.fill} pointerEvents="none">
      <Animated.View style={[styles.homeLightBeam, { opacity: beam.interpolate({ inputRange: [0, 1], outputRange: [night ? 0.018 : 0.04, night ? 0.05 : 0.12] }) }]} />
      <Animated.View style={[styles.homeMote, { opacity: mote.interpolate({ inputRange: [0, .1, .9, 1], outputRange: [0, .45, .45, 0] }), transform: [{ translateX: mote.interpolate({ inputRange: [0, 1], outputRange: [-10, 44] }) }, { translateY: mote.interpolate({ inputRange: [0, 1], outputRange: [18, -32] }) }] }]} />
      <Animated.View style={[styles.homeGlowDot, { opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.54] }), transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.18] }) }] }]} />
    </View>
  );
}

export function HomeScene({ hour, upgrades = [], asleep = false, groundY, chromeBottom }: { hour: number; upgrades?: string[]; asleep?: boolean; groundY: number; chromeBottom: number }) {
  const band = skyBand(hour);
  const night = band === 'night' || asleep;
  const has = (id: string) => upgrades.includes(id);
  const floorTop = Math.max(chromeBottom + 188, groundY - 132);
  const wallEdge = night ? DIORAMA.wallNightEdge : DIORAMA.wallDayEdge;
  const floorEdge = night ? DIORAMA.floorNightEdge : DIORAMA.floorDayEdge;
  return (
    <View style={styles.fill} pointerEvents="none">
      <LinearGradient colors={night ? [DIORAMA.wallNightA, DIORAMA.wallNightB] : [DIORAMA.wallDayA, DIORAMA.wallDayB]} style={[styles.fill, { bottom: undefined, height: floorTop }]} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: chromeBottom + 40, height: 11, backgroundColor: DIORAMA.white, opacity: night ? 0.025 : 0.11 }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: floorTop - 22, height: 22, backgroundColor: wallEdge }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: floorTop - 18, height: 7, backgroundColor: DIORAMA.woodShine, opacity: night ? 0.08 : 0.34 }} />
      <LinearGradient colors={night ? [DIORAMA.floorNightFar, DIORAMA.floorNightNear] : [DIORAMA.floorDayFar, DIORAMA.floorDayNear]} style={{ position: 'absolute', left: 0, right: 0, top: floorTop, bottom: 0 }} />
      <Svg width="100%" height="100%" viewBox="0 0 420 760" preserveAspectRatio="none" style={styles.fill}>
        <Path d={`M0 ${floorTop + 8}H420`} stroke={floorEdge} strokeWidth={9} opacity={0.52} />
        {[52, 126, 202, 278, 354].map((x) => <Path key={x} d={`M${x} ${floorTop}L${210 + (x - 210) * 1.68} 760`} stroke={floorEdge} strokeWidth={2.5} opacity={night ? 0.17 : 0.25} />)}
        {[floorTop + 55, floorTop + 112, floorTop + 178].map((y) => <Path key={y} d={`M0 ${y}H420`} stroke={floorEdge} strokeWidth={2} opacity={night ? 0.12 : 0.18} />)}
      </Svg>
      <View style={{ position: 'absolute', left: 22, top: chromeBottom + 74 }}><ArchedWindow band={band} upgraded={has('home_window')} /></View>
      <View style={{ position: 'absolute', right: 8, top: floorTop - 98 }}><PremiumSofa night={night} /></View>
      <View style={{ position: 'absolute', left: 2, top: floorTop - 144 }}><FloorLamp night={night} /></View>
      <View style={{ position: 'absolute', right: 24, top: chromeBottom + 66 }}><HomeShelf night={night} /></View>
      <View style={{ position: 'absolute', left: 18, right: 18, top: floorTop + 17, height: 10, borderRadius: radius.pill, backgroundColor: floorEdge, opacity: night ? 0.12 : 0.16 }} />
      {has('home_rug') && (
        <View style={{ position: 'absolute', left: '17%', right: '17%', top: groundY + 25, height: 51, borderRadius: radius.pill, backgroundColor: DIORAMA.coralDeep }}>
          <LinearGradient colors={[DIORAMA.coralLight, DIORAMA.coral]} style={{ flex: 1, margin: 6, borderRadius: radius.pill }} />
          <View style={{ position: 'absolute', left: 34, right: 34, top: 8, height: 7, borderRadius: radius.pill, backgroundColor: DIORAMA.white, opacity: 0.25 }} />
        </View>
      )}
      {has('home_bed') && (
        <View style={{ position: 'absolute', left: 54, top: floorTop + 36 }}>
          <Svg width={112} height={60} viewBox="0 0 112 60">
            <Ellipse cx={56} cy={54} rx={47} ry={6} fill={DIORAMA.shadow} opacity={0.18} />
            <Ellipse cx={56} cy={35} rx={49} ry={21} fill={DIORAMA.bedEdge} />
            <Ellipse cx={56} cy={29} rx={47} ry={20} fill={DIORAMA.bedWall} />
            <Ellipse cx={56} cy={35} rx={34} ry={12} fill={DIORAMA.bedCushion} />
            <Path d="M22 22Q55 11 90 22" stroke={DIORAMA.white} strokeWidth={6} strokeLinecap="round" opacity={0.34} />
          </Svg>
        </View>
      )}
      <HomeAmbient night={night} />
    </View>
  );
}

function ParkTree({ night, flip = false, small = false }: { night: boolean; flip?: boolean; small?: boolean }) {
  const base = night ? DIORAMA.parkTreeNight : DIORAMA.parkTreeDay;
  const light = night ? DIORAMA.parkTreeNightLight : DIORAMA.parkTreeDayLight;
  const edge = night ? DIORAMA.parkTreeNightEdge : DIORAMA.parkTreeDayEdge;
  const shine = night ? DIORAMA.parkTreeNightLight : DIORAMA.parkTreeDayShine;
  const scale = small ? 0.72 : 1;
  return (
    <Svg width={150 * scale} height={228 * scale} viewBox="0 0 150 228" style={flip ? { transform: [{ scaleX: -1 }] } : undefined}>
      <Ellipse cx={75} cy={220} rx={48} ry={7} fill={DIORAMA.shadow} opacity={0.16} />
      <Path d="M62 85C58 124 58 167 50 211H100C90 165 91 123 82 84Z" fill={DIORAMA.woodDeep} />
      <Path d="M67 96C66 130 67 166 61 198" stroke={DIORAMA.woodShine} strokeWidth={7} strokeLinecap="round" opacity={0.28} />
      <Circle cx={73} cy={68} r={55} fill={edge} />
      <Circle cx={50} cy={66} r={40} fill={base} />
      <Circle cx={94} cy={70} r={43} fill={base} />
      <Circle cx={74} cy={42} r={40} fill={light} />
      <Circle cx={37} cy={46} r={25} fill={base} />
      <Path d="M32 40Q69 13 106 39" stroke={shine} strokeWidth={9} strokeLinecap="round" opacity={night ? 0.13 : 0.5} />
      <Circle cx={46} cy={48} r={6} fill={DIORAMA.white} opacity={night ? 0.05 : 0.16} />
    </Svg>
  );
}

function ParkBench({ night }: { night: boolean }) {
  return (
    <Svg width={120} height={84} viewBox="0 0 120 84">
      <Ellipse cx={60} cy={78} rx={47} ry={6} fill={DIORAMA.shadow} opacity={0.16} />
      <Rect x={10} y={24} width={100} height={18} rx={9} fill={DIORAMA.woodDeep} />
      <Rect x={10} y={18} width={100} height={18} rx={9} fill={DIORAMA.woodWarm} />
      <Path d="M22 23H98" stroke={DIORAMA.woodShine} strokeWidth={4} strokeLinecap="round" opacity={night ? 0.12 : 0.38} />
      <Rect x={16} y={43} width={90} height={15} rx={7} fill={DIORAMA.woodDark} />
      <Rect x={16} y={39} width={90} height={15} rx={7} fill={DIORAMA.woodMid} />
      <Rect x={24} y={54} width={10} height={23} rx={5} fill={DIORAMA.woodDeep} />
      <Rect x={88} y={54} width={10} height={23} rx={5} fill={DIORAMA.woodDeep} />
    </Svg>
  );
}

function ParkSign({ night }: { night: boolean }) {
  return (
    <Svg width={90} height={102} viewBox="0 0 90 102">
      <Ellipse cx={45} cy={96} rx={25} ry={4} fill={DIORAMA.shadow} opacity={0.15} />
      <Rect x={41} y={45} width={8} height={49} rx={4} fill={DIORAMA.woodDeep} />
      <Rect x={4} y={10} width={82} height={45} rx={15} fill={DIORAMA.signEdge} />
      <Rect x={4} y={3} width={82} height={45} rx={15} fill={DIORAMA.signFace} />
      <Path d="M17 13H71" stroke={DIORAMA.white} strokeWidth={6} strokeLinecap="round" opacity={night ? 0.22 : 0.55} />
      <Circle cx={30} cy={33} r={8} fill={DIORAMA.coral} />
      <Circle cx={57} cy={33} r={8} fill={DIORAMA.aqua} />
    </Svg>
  );
}

function FlowerClump({ x, y, night }: { x: number; y: number; night: boolean }) {
  const green = night ? DIORAMA.parkTreeNightLight : DIORAMA.mintDeep;
  return (
    <Svg width={72} height={42} viewBox="0 0 72 42" style={{ position: 'absolute', left: x, top: y }}>
      <Path d="M10 38Q22 11 31 38M33 38Q40 7 49 38M47 38Q56 15 64 38" stroke={green} strokeWidth={5} fill="none" strokeLinecap="round" />
      <Circle cx={22} cy={20} r={7} fill={DIORAMA.flowerPink} />
      <Circle cx={42} cy={15} r={7} fill={DIORAMA.flowerYellow} />
      <Circle cx={57} cy={23} r={7} fill={DIORAMA.flowerBlue} />
      <Circle cx={20} cy={18} r={2.5} fill={DIORAMA.white} opacity={night ? 0.12 : 0.55} />
    </Svg>
  );
}

function ParkAmbient({ night }: { night: boolean }) {
  const leaf = useLoop(5000);
  const butterfly = useLoop(8200, 1100);
  const sparkle = useLoop(3000, 300);
  return (
    <View style={styles.fill} pointerEvents="none">
      <Animated.View style={[styles.parkLeaf, { opacity: night ? 0.2 : 0.74, transform: [{ translateX: leaf.interpolate({ inputRange: [0, 1], outputRange: [-28, 118] }) }, { translateY: leaf.interpolate({ inputRange: [0, 1], outputRange: [0, 42] }) }, { rotate: leaf.interpolate({ inputRange: [0, 1], outputRange: ['-25deg', '155deg'] }) }] }]} />
      <Animated.View style={[styles.butterfly, { opacity: butterfly.interpolate({ inputRange: [0, .12, .88, 1], outputRange: [0, night ? 0.26 : 0.92, night ? 0.26 : 0.92, 0] }), transform: [{ translateX: butterfly.interpolate({ inputRange: [0, 1], outputRange: [-28, 416] }) }, { translateY: butterfly.interpolate({ inputRange: [0, .5, 1], outputRange: [12, -34, 8] }) }] }]}>
        <View style={styles.bflyL} /><View style={styles.bflyR} />
      </Animated.View>
      <Animated.View style={[styles.parkSparkle, { opacity: sparkle.interpolate({ inputRange: [0, 1], outputRange: [0.05, night ? 0.24 : 0.5] }), transform: [{ scale: sparkle.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1.22] }) }] }]} />
    </View>
  );
}

export function ParkScene({ hour, bandHeight = 620, groundY }: { hour: number; bandHeight?: number; groundY?: number }) {
  const band = skyBand(hour);
  const night = band === 'night';
  const ground = groundY ?? bandHeight * 0.72;
  const horizon = Math.max(172, ground - 194);
  const hill = night ? DIORAMA.parkHillNight : DIORAMA.parkHillDay;
  const hillEdge = night ? DIORAMA.parkHillNightEdge : DIORAMA.parkHillDayEdge;
  const grass = night ? DIORAMA.parkGrassNight : DIORAMA.parkGrassDay;
  const grassLight = night ? DIORAMA.parkGrassNightLight : DIORAMA.parkGrassDayLight;
  const grassEdge = night ? DIORAMA.parkGrassNightEdge : DIORAMA.parkGrassDayEdge;
  const path = night ? DIORAMA.parkPathNight : DIORAMA.parkPathDay;
  const pathLight = night ? DIORAMA.parkPathNightLight : DIORAMA.parkPathDayLight;
  const pathEdge = night ? DIORAMA.parkPathNightEdge : DIORAMA.parkPathDayEdge;
  return (
    <View style={styles.fill} pointerEvents="none">
      <SkyBackdrop band={band} horizon={horizon} />
      <Svg width="100%" height="100%" viewBox={`0 0 420 ${bandHeight}`} preserveAspectRatio="none" style={styles.fill}>
        <Path d={`M-40 ${horizon + 45}Q48 ${horizon - 18} 135 ${horizon + 28}T262 ${horizon + 8}T470 ${horizon + 40}V${bandHeight}H-40Z`} fill={hillEdge} />
        <Path d={`M-40 ${horizon + 34}Q48 ${horizon - 27} 135 ${horizon + 19}T262 ${horizon - 1}T470 ${horizon + 31}V${bandHeight}H-40Z`} fill={hill} />
        <Path d={`M0 ${horizon + 66}Q106 ${horizon + 16} 224 ${horizon + 48}T420 ${horizon + 34}V${bandHeight}H0Z`} fill={grassEdge} />
        <Path d={`M0 ${horizon + 56}Q106 ${horizon + 8} 224 ${horizon + 40}T420 ${horizon + 26}V${bandHeight}H0Z`} fill={grass} />
        <Path d={`M0 ${horizon + 62}Q110 ${horizon + 20} 220 ${horizon + 49}`} stroke={grassLight} strokeWidth={8} fill="none" opacity={night ? 0.08 : 0.32} />
        <Path d={`M191 ${horizon + 44}C198 ${horizon + 99} 158 ${ground + 35} 102 ${bandHeight}H314C260 ${ground + 34} 220 ${horizon + 98} 229 ${horizon + 44}Z`} fill={pathEdge} />
        <Path d={`M198 ${horizon + 44}C205 ${horizon + 98} 174 ${ground + 30} 124 ${bandHeight}H291C244 ${ground + 30} 215 ${horizon + 98} 222 ${horizon + 44}Z`} fill={path} />
        <Path d={`M205 ${horizon + 55}C211 ${horizon + 105} 187 ${ground + 22} 150 ${bandHeight}`} stroke={pathLight} strokeWidth={6} fill="none" opacity={night ? 0.11 : 0.46} />
      </Svg>
      <View style={{ position: 'absolute', left: -51, top: horizon - 151 }}><ParkTree night={night} /></View>
      <View style={{ position: 'absolute', right: -58, top: horizon - 134 }}><ParkTree night={night} flip /></View>
      <View style={{ position: 'absolute', left: 121, top: horizon - 52 }}><ParkTree night={night} small /></View>
      <View style={{ position: 'absolute', left: 18, top: horizon + 92 }}><ParkBench night={night} /></View>
      <View style={{ position: 'absolute', right: 20, top: horizon + 67 }}><ParkSign night={night} /></View>
      <FlowerClump x={18} y={horizon + 183} night={night} />
      <FlowerClump x={326} y={horizon + 178} night={night} />
      <ParkAmbient night={night} />
    </View>
  );
}

function Storefront({ x, y, width, height, base, light, edge, night, awning }: { x: number; y: number; width: number; height: number; base: string; light: string; edge: string; night: boolean; awning: string }) {
  const glass = night ? DIORAMA.glassNight : DIORAMA.glassDay;
  const glassEdge = night ? DIORAMA.glassNightEdge : DIORAMA.glassDayEdge;
  return (
    <>
      <Rect x={x + 5} y={y + 12} width={width} height={height} rx={24} fill={edge} />
      <Rect x={x} y={y} width={width} height={height} rx={24} fill={base} />
      <Rect x={x + 10} y={y + 9} width={width - 20} height={19} rx={10} fill={light} opacity={night ? 0.22 : 0.72} />
      <Rect x={x + 16} y={y + 42} width={width - 32} height={24} rx={10} fill={edge} opacity={0.55} />
      <Rect x={x + 19} y={y + 38} width={width - 38} height={24} rx={10} fill={DIORAMA.signFace} />
      <Path d={`M${x + 29} ${y + 46}H${x + width - 30}`} stroke={DIORAMA.white} strokeWidth={6} strokeLinecap="round" opacity={night ? 0.18 : 0.58} />
      {Array.from({ length: 5 }, (_, i) => {
        const stripeW = (width - 22) / 5;
        return <Rect key={i} x={x + 11 + i * stripeW} y={y + 70} width={stripeW + 1} height={24} rx={5} fill={i % 2 === 0 ? DIORAMA.white : awning} opacity={night ? 0.62 : 0.98} />;
      })}
      <Rect x={x + 17} y={y + 103} width={width - 34} height={height - 121} rx={15} fill={glassEdge} />
      <Rect x={x + 17} y={y + 98} width={width - 34} height={height - 121} rx={15} fill={glass} />
      <Path d={`M${x + 29} ${y + 109}H${x + width - 29}`} stroke={DIORAMA.white} strokeWidth={8} strokeLinecap="round" opacity={night ? 0.15 : 0.52} />
      <Rect x={x + width * 0.52} y={y + 99} width={6} height={height - 122} rx={3} fill={glassEdge} opacity={0.7} />
    </>
  );
}

function StreetLamp({ night }: { night: boolean }) {
  return (
    <Svg width={54} height={150} viewBox="0 0 54 150">
      {night && <Circle cx={27} cy={24} r={29} fill={DIORAMA.goldGlow} opacity={0.19} />}
      <Ellipse cx={27} cy={145} rx={18} ry={4} fill={DIORAMA.shadow} opacity={0.16} />
      <Rect x={23} y={36} width={8} height={101} rx={4} fill={DIORAMA.inkSoft} />
      <Rect x={14} y={9} width={26} height={34} rx={10} fill={DIORAMA.goldDeep} />
      <Rect x={17} y={12} width={20} height={27} rx={8} fill={night ? DIORAMA.goldGlow : DIORAMA.goldLight} />
      <Path d="M21 16H31" stroke={DIORAMA.white} strokeWidth={4} strokeLinecap="round" opacity={0.55} />
      <Ellipse cx={27} cy={139} rx={15} ry={6} fill={DIORAMA.inkSoft} />
    </Svg>
  );
}

function TownPlanter({ night }: { night: boolean }) {
  return (
    <Svg width={68} height={70} viewBox="0 0 68 70">
      <Ellipse cx={34} cy={65} rx={27} ry={4} fill={DIORAMA.shadow} opacity={0.15} />
      <Path d="M9 32H59L54 63H14Z" fill={DIORAMA.planterEdge} />
      <Path d="M12 27H56L52 58H16Z" fill={DIORAMA.planter} />
      <Path d="M20 31H48" stroke={DIORAMA.white} strokeWidth={5} strokeLinecap="round" opacity={night ? 0.14 : 0.36} />
      <Path d="M26 30L21 11M36 29L39 8M46 31L53 15" stroke={night ? DIORAMA.parkTreeNightLight : DIORAMA.mintDeep} strokeWidth={5} strokeLinecap="round" />
      <Circle cx={20} cy={12} r={8} fill={DIORAMA.flowerPink} /><Circle cx={40} cy={8} r={8} fill={DIORAMA.flowerYellow} /><Circle cx={54} cy={16} r={8} fill={DIORAMA.flowerBlue} />
    </Svg>
  );
}

function TownAmbient({ night }: { night: boolean }) {
  const glint = useLoop(4100);
  const walker = useLoop(8600, 1200);
  const banner = useLoop(2600, 500);
  return (
    <View style={styles.fill} pointerEvents="none">
      <Animated.View style={[styles.townGlint, { opacity: glint.interpolate({ inputRange: [0, .45, 1], outputRange: [0, night ? 0.18 : 0.5, 0] }), transform: [{ translateX: glint.interpolate({ inputRange: [0, 1], outputRange: [-55, 355] }) }, { rotate: '13deg' }] }]} />
      <Animated.View style={[styles.townWalker, { opacity: walker.interpolate({ inputRange: [0, .16, .84, 1], outputRange: [0, night ? 0.1 : 0.14, night ? 0.1 : 0.14, 0] }), transform: [{ translateX: walker.interpolate({ inputRange: [0, 1], outputRange: [-65, 470] }) }] }]} />
      <Animated.View style={[styles.townBanner, { transform: [{ rotate: banner.interpolate({ inputRange: [0, 1], outputRange: ['-2deg', '3deg'] }) }] }]} />
    </View>
  );
}

export function TownScene({ hour, bandHeight = 620, groundY }: { hour: number; bandHeight?: number; groundY?: number }) {
  const band = skyBand(hour);
  const night = band === 'night';
  const ground = groundY ?? bandHeight * 0.72;
  const plaza = ground - 94;
  const roof = Math.max(112, plaza - 255);
  const walk = night ? DIORAMA.townSidewalkNight : DIORAMA.townSidewalkDay;
  const walkEdge = night ? DIORAMA.townSidewalkNightEdge : DIORAMA.townSidewalkDayEdge;
  const walkLight = night ? DIORAMA.townSidewalkNightEdge : DIORAMA.townSidewalkDayLight;
  const road = night ? DIORAMA.townRoadNight : DIORAMA.townRoadDay;
  const roadEdge = night ? DIORAMA.townRoadNightEdge : DIORAMA.townRoadDayEdge;
  return (
    <View style={styles.fill} pointerEvents="none">
      <SkyBackdrop band={band} horizon={roof + 86} />
      <Svg width="100%" height="100%" viewBox={`0 0 420 ${bandHeight}`} preserveAspectRatio="none" style={styles.fill}>
        <Storefront x={-18} y={roof + 46} width={154} height={218} base={night ? DIORAMA.townCoralNight : DIORAMA.townCoral} light={DIORAMA.townCoralLight} edge={DIORAMA.townCoralEdge} night={night} awning={DIORAMA.coral} />
        <Storefront x={128} y={roof + 7} width={164} height={257} base={night ? DIORAMA.townBlueNight : DIORAMA.townBlue} light={DIORAMA.townBlueLight} edge={DIORAMA.townBlueEdge} night={night} awning={DIORAMA.aqua} />
        <Storefront x={283} y={roof + 39} width={155} height={225} base={night ? DIORAMA.townVioletNight : DIORAMA.townViolet} light={DIORAMA.townVioletLight} edge={DIORAMA.townVioletEdge} night={night} awning={DIORAMA.violetLight} />
        <Rect x={0} y={plaza + 10} width={420} height={bandHeight - plaza} fill={walkEdge} />
        <Rect x={0} y={plaza} width={420} height={bandHeight - plaza - 10} fill={walk} />
        <Path d={`M0 ${plaza + 8}H420`} stroke={walkLight} strokeWidth={8} opacity={night ? 0.13 : 0.58} />
        {[76, 157, 238, 319].map((x) => <Path key={x} d={`M${x} ${plaza}L${x + 46} ${bandHeight}`} stroke={walkEdge} strokeWidth={2.3} opacity={0.24} />)}
        <Rect x={0} y={ground + 92} width={420} height={bandHeight - ground - 92} fill={roadEdge} />
        <Rect x={0} y={ground + 99} width={420} height={bandHeight - ground - 99} fill={road} />
        <Path d={`M25 ${ground + 124}H112M166 ${ground + 124}H253M308 ${ground + 124}H395`} stroke={night ? DIORAMA.townSidewalkNight : DIORAMA.cream} strokeWidth={7} strokeLinecap="round" opacity={night ? 0.16 : 0.5} />
      </Svg>
      <View style={{ position: 'absolute', left: 14, top: plaza - 84 }}><StreetLamp night={night} /></View>
      <View style={{ position: 'absolute', right: 12, top: plaza - 84 }}><StreetLamp night={night} /></View>
      <View style={{ position: 'absolute', left: 74, top: plaza - 31 }}><TownPlanter night={night} /></View>
      <View style={{ position: 'absolute', right: 74, top: plaza - 31 }}><TownPlanter night={night} /></View>
      <TownAmbient night={night} />
    </View>
  );
}

function BeachUmbrella({ night }: { night: boolean }) {
  return (
    <Svg width={126} height={176} viewBox="0 0 126 176">
      <Ellipse cx={65} cy={168} rx={40} ry={6} fill={DIORAMA.shadow} opacity={0.14} />
      <Path d="M64 62V159" stroke={DIORAMA.woodWarm} strokeWidth={8} strokeLinecap="round" />
      <Path d="M13 69Q62-10 116 69Z" fill={DIORAMA.coralDeep} />
      <Path d="M13 59Q62-20 116 59Z" fill={DIORAMA.coral} />
      <Path d="M29 52Q62 3 98 53Z" fill={DIORAMA.lemon} />
      <Path d="M31 45Q60 6 91 47" stroke={DIORAMA.white} strokeWidth={6} strokeLinecap="round" opacity={night ? 0.16 : 0.4} />
    </Svg>
  );
}

function SandCastle({ night }: { night: boolean }) {
  const base = night ? DIORAMA.sandNightFar : DIORAMA.sandDayFar;
  const light = night ? DIORAMA.sandNightLight : DIORAMA.sandDayLight;
  const edge = night ? DIORAMA.sandNightEdge : DIORAMA.sandDayEdge;
  return (
    <Svg width={104} height={86} viewBox="0 0 104 86">
      <Ellipse cx={52} cy={80} rx={46} ry={6} fill={DIORAMA.shadow} opacity={0.12} />
      <Rect x={18} y={42} width={68} height={33} rx={10} fill={edge} />
      <Rect x={18} y={36} width={68} height={33} rx={10} fill={base} />
      <Rect x={26} y={19} width={21} height={24} rx={6} fill={base} />
      <Rect x={58} y={19} width={21} height={24} rx={6} fill={base} />
      <Rect x={39} y={8} width={28} height={31} rx={7} fill={light} />
      <Path d="M25 42H80" stroke={DIORAMA.white} strokeWidth={5} strokeLinecap="round" opacity={night ? 0.09 : 0.32} />
      <Path d="M47 69V55Q52 48 58 55V69" fill={edge} />
      <Path d="M54 8V-2" stroke={DIORAMA.woodDeep} strokeWidth={4} />
      <Path d="M56 0L77 7L56 14Z" fill={DIORAMA.aqua} />
    </Svg>
  );
}

function BeachGrass({ night }: { night: boolean }) {
  const green = night ? DIORAMA.grassBeachNight : DIORAMA.grassBeachDay;
  const light = night ? DIORAMA.grassBeachNight : DIORAMA.grassBeachLight;
  return (
    <Svg width={132} height={112} viewBox="0 0 132 112">
      <Ellipse cx={54} cy={102} rx={70} ry={22} fill={night ? DIORAMA.sandNightFar : DIORAMA.sandDayFar} />
      {[21, 38, 55, 72, 89, 106].map((x, i) => <Path key={x} d={`M${x} 101Q${x + (i % 2 === 0 ? 12 : -10)} 69 ${x + (i % 3) * 5 - 3} 35`} stroke={i % 2 === 0 ? light : green} strokeWidth={i % 2 === 0 ? 6 : 5} fill="none" strokeLinecap="round" />)}
    </Svg>
  );
}

function BeachAmbient({ night }: { night: boolean }) {
  const foam = useLoop(3000);
  const gull = useLoop(8800, 800);
  const sparkle = useLoop(2400, 300);
  return (
    <View style={styles.fill} pointerEvents="none">
      <Animated.View style={[styles.foamBand, { opacity: foam.interpolate({ inputRange: [0, 1], outputRange: [night ? 0.05 : 0.12, night ? 0.15 : 0.32] }), transform: [{ translateY: foam.interpolate({ inputRange: [0, 1], outputRange: [-4, 8] }) }] }]} />
      <Animated.View style={[styles.gull, { opacity: gull.interpolate({ inputRange: [0, .12, .88, 1], outputRange: [0, night ? 0.24 : 0.52, night ? 0.24 : 0.52, 0] }), transform: [{ translateX: gull.interpolate({ inputRange: [0, 1], outputRange: [-45, 460] }) }, { translateY: gull.interpolate({ inputRange: [0, .5, 1], outputRange: [3, -25, 6] }) }] }]}>
        <View style={styles.gullL} /><View style={styles.gullR} />
      </Animated.View>
      <Animated.View style={[styles.waterSparkle, { opacity: sparkle.interpolate({ inputRange: [0, 1], outputRange: [0.08, night ? 0.2 : 0.62] }), transform: [{ scaleX: sparkle.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.25] }) }] }]} />
    </View>
  );
}

export function BeachScene({ hour, bandHeight = 620, groundY }: { hour: number; bandHeight?: number; groundY?: number }) {
  const band = skyBand(hour);
  const night = band === 'night';
  const ground = groundY ?? bandHeight * 0.72;
  const tide = ground - 118;
  const horizon = tide - 105;
  const oceanLight = night ? DIORAMA.oceanNightLight : DIORAMA.oceanDayLight;
  const oceanEdge = night ? DIORAMA.oceanNightEdge : DIORAMA.oceanDayEdge;
  const sandLight = night ? DIORAMA.sandNightLight : DIORAMA.sandDayLight;
  const sandEdge = night ? DIORAMA.sandNightEdge : DIORAMA.sandDayEdge;
  return (
    <View style={styles.fill} pointerEvents="none">
      <SkyBackdrop band={band} horizon={horizon} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: horizon + 8, height: tide - horizon + 40, backgroundColor: oceanEdge }} />
      <LinearGradient colors={night ? [DIORAMA.oceanNightA, DIORAMA.oceanNightB] : [DIORAMA.oceanDayA, DIORAMA.oceanDayB]} style={{ position: 'absolute', left: 0, right: 0, top: horizon, height: tide - horizon + 33 }} />
      <Svg width="100%" height="100%" viewBox={`0 0 420 ${bandHeight}`} preserveAspectRatio="none" style={styles.fill}>
        <Path d={`M12 ${horizon + 22}Q90 ${horizon + 8} 170 ${horizon + 21}T330 ${horizon + 19}T432 ${horizon + 21}`} stroke={oceanLight} strokeWidth={7} fill="none" opacity={night ? 0.16 : 0.45} />
        <Path d={`M-14 ${tide + 8}Q52 ${tide - 11} 117 ${tide + 5}T242 ${tide + 4}T360 ${tide + 3}T440 ${tide + 5}`} stroke={night ? DIORAMA.foamNightShade : DIORAMA.foamDayShade} strokeWidth={17} fill="none" />
        <Path d={`M-14 ${tide}Q52 ${tide - 18} 117 ${tide}T242 ${tide - 2}T360 ${tide - 3}T440 ${tide - 2}`} stroke={night ? DIORAMA.foamNight : DIORAMA.foamDay} strokeWidth={10} fill="none" />
      </Svg>
      <View style={{ position: 'absolute', left: 0, right: 0, top: tide + 8, bottom: 0, backgroundColor: sandEdge }} />
      <LinearGradient colors={night ? [DIORAMA.sandNightFar, DIORAMA.sandNightNear] : [DIORAMA.sandDayFar, DIORAMA.sandDayNear]} style={{ position: 'absolute', left: 0, right: 0, top: tide, bottom: 0 }} />
      <Svg width="100%" height="100%" viewBox={`0 0 420 ${bandHeight}`} preserveAspectRatio="none" style={styles.fill}>
        <Path d={`M40 ${ground + 62}Q208 ${ground + 85} 377 ${ground + 60}`} stroke={sandLight} strokeWidth={6} fill="none" opacity={night ? 0.08 : 0.28} />
        <Path d={`M68 ${ground + 18}Q112 ${ground + 7} 152 ${ground + 18}`} stroke={night ? DIORAMA.sandNightFar : DIORAMA.sandDayFar} strokeWidth={4} fill="none" opacity={0.42} />
        <Circle cx={324} cy={ground + 43} r={7} fill={DIORAMA.starfish} />
        <Path d={`M319 ${ground + 36}L328 ${ground + 50}M331 ${ground + 36}L317 ${ground + 49}`} stroke={DIORAMA.starfish} strokeWidth={5} strokeLinecap="round" />
      </Svg>
      <View style={{ position: 'absolute', right: -21, top: ground - 160 }}><BeachUmbrella night={night} /></View>
      <View style={{ position: 'absolute', left: 70, top: ground + 15 }}><SandCastle night={night} /></View>
      <View style={{ position: 'absolute', left: -28, top: ground - 69 }}><BeachGrass night={night} /></View>
      <BeachAmbient night={night} />
    </View>
  );
}

export function NightOverlay() {
  return <View pointerEvents="none" style={[styles.fill, { backgroundColor: DIORAMA.skyNightA, opacity: 0.1 }]} />;
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  cloudLobe: { position: 'absolute', borderRadius: radius.pill, backgroundColor: DIORAMA.white },
  homeLightBeam: { position: 'absolute', left: 34, top: 244, width: 126, height: 210, borderRadius: radius.pill, backgroundColor: DIORAMA.goldLight, transform: [{ rotate: '-12deg' }] },
  homeMote: { position: 'absolute', left: 111, top: 294, width: 8, height: 8, borderRadius: radius.pill, backgroundColor: DIORAMA.white },
  homeGlowDot: { position: 'absolute', right: 112, top: 170, width: 8, height: 8, borderRadius: radius.pill, backgroundColor: DIORAMA.goldLight },
  parkLeaf: { position: 'absolute', left: 76, top: 251, width: 14, height: 8, borderTopLeftRadius: radius.md, borderBottomRightRadius: radius.md, backgroundColor: DIORAMA.parkTreeDayLight },
  butterfly: { position: 'absolute', left: 0, top: 252, width: 19, height: 13 },
  bflyL: { position: 'absolute', left: 0, width: 11, height: 11, borderRadius: radius.sm, backgroundColor: DIORAMA.violetLight, transform: [{ rotate: '-28deg' }] },
  bflyR: { position: 'absolute', right: 0, width: 11, height: 11, borderRadius: radius.sm, backgroundColor: DIORAMA.coralLight, transform: [{ rotate: '28deg' }] },
  parkSparkle: { position: 'absolute', right: 109, top: 282, width: 6, height: 6, borderRadius: radius.pill, backgroundColor: DIORAMA.white },
  townGlint: { position: 'absolute', left: 44, top: 216, width: 22, height: 168, borderRadius: radius.pill, backgroundColor: DIORAMA.white },
  townWalker: { position: 'absolute', left: 0, top: 394, width: 36, height: 62, borderRadius: radius.lg, backgroundColor: DIORAMA.shadow },
  townBanner: { position: 'absolute', left: 170, top: 143, width: 82, height: 10, borderRadius: radius.pill, backgroundColor: DIORAMA.lemon },
  foamBand: { position: 'absolute', left: 42, right: 42, top: 390, height: 10, borderRadius: radius.pill, backgroundColor: DIORAMA.white },
  gull: { position: 'absolute', left: 0, top: 164, width: 28, height: 15 },
  gullL: { position: 'absolute', left: 0, top: 6, width: 16, height: 3, borderRadius: radius.sm, backgroundColor: DIORAMA.inkSoft, transform: [{ rotate: '-22deg' }] },
  gullR: { position: 'absolute', right: 0, top: 6, width: 16, height: 3, borderRadius: radius.sm, backgroundColor: DIORAMA.inkSoft, transform: [{ rotate: '22deg' }] },
  waterSparkle: { position: 'absolute', right: 92, top: 312, width: 34, height: 5, borderRadius: radius.pill, backgroundColor: DIORAMA.white },
});
