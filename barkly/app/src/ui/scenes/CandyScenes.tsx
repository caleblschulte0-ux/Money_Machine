import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Ellipse, LinearGradient as SvgGradient, Path, Rect, Stop } from 'react-native-svg';
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

function loop(duration: number, delay = 0) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    a.start();
    return () => a.stop();
  }, [delay, duration, v]);
  return v;
}

function Sky({ band }: { band: SkyBand }) {
  const drift = loop(8500, 500);
  const night = band === 'night';
  return <View style={styles.fill} pointerEvents="none">
    <LinearGradient colors={SKY[band]} style={styles.fill} />
    <Svg width="100%" height="100%" viewBox="0 0 420 760" preserveAspectRatio="none">
      {night ? <>
        <Circle cx={336} cy={126} r={31} fill={DIORAMA.goldLight} />
        <Circle cx={324} cy={114} r={29} fill={DIORAMA.skyNightA} />
        {[45, 104, 179, 247, 388].map((x, i) => <Circle key={x} cx={x} cy={76 + (i % 3) * 42} r={i % 2 ? 1.8 : 2.5} fill={DIORAMA.paleCream} />)}
      </> : <Circle cx={338} cy={118} r={36} fill={DIORAMA.lemon} />}
    </Svg>
    <Animated.View style={[styles.cloud, { opacity: night ? 0.14 : 0.72, transform: [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-18, 25] }) }] }]}>
      <View style={[styles.cloudPart, { left: 0, width: 64 }]} /><View style={[styles.cloudPart, { left: 32, top: -12, width: 54 }]} /><View style={[styles.cloudPart, { left: 67, width: 68 }]} />
    </Animated.View>
  </View>;
}

function Window({ band, big }: { band: SkyBand; big: boolean }) {
  const night = band === 'night';
  const frame = night ? DIORAMA.windowFrameNight : DIORAMA.windowFrameDay;
  const edge = night ? DIORAMA.windowFrameNightEdge : DIORAMA.windowFrameDayEdge;
  const w = big ? 174 : 148; const h = big ? 126 : 106;
  return <View style={{ width: w, height: h + 10 }}>
    <View style={{ position: 'absolute', left: 6, right: 6, bottom: 0, height: 14, borderRadius: radius.md, backgroundColor: edge }} />
    <View style={{ width: w, height: h, borderRadius: radius.lg, borderWidth: 8, borderColor: edge, overflow: 'hidden' }}>
      <LinearGradient colors={SKY[band]} style={styles.fill} />
      <Svg width="100%" height="100%" viewBox="0 0 160 110" preserveAspectRatio="none">
        {night ? <><Circle cx={121} cy={25} r={15} fill={DIORAMA.goldLight} /><Circle cx={114} cy={18} r={14} fill={DIORAMA.skyNightA} /></> : <Circle cx={124} cy={24} r={17} fill={DIORAMA.lemon} />}
        <Path d="M0 88 Q46 63 86 81 T160 78 V110 H0Z" fill={night ? DIORAMA.hillNight : DIORAMA.hillDay} />
      </Svg>
      <View style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 5, backgroundColor: frame }} />
      <View style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 5, backgroundColor: frame }} />
      <View style={{ position: 'absolute', left: 12, right: 24, top: 8, height: 7, borderRadius: radius.pill, backgroundColor: DIORAMA.white, opacity: 0.48 }} />
    </View>
  </View>;
}

function Sofa({ night }: { night: boolean }) {
  const base = night ? DIORAMA.couchNight : DIORAMA.couchDay;
  const hi = night ? DIORAMA.couchNightTop : DIORAMA.couchDayTop;
  const seat = night ? DIORAMA.couchNightSeat : DIORAMA.couchDaySeat;
  const edge = night ? DIORAMA.couchNightEdge : DIORAMA.couchDayEdge;
  return <Svg width={178} height={112} viewBox="0 0 178 112">
    <Ellipse cx={89} cy={105} rx={75} ry={6} fill={DIORAMA.shadow} opacity={0.22} />
    <Rect x={16} y={15} width={146} height={58} rx={24} fill={edge} />
    <Rect x={16} y={10} width={146} height={58} rx={24} fill={base} />
    <Rect x={18} y={11} width={142} height={19} rx={11} fill={hi} />
    <Rect x={0} y={43} width={37} height={55} rx={18} fill={edge} /><Rect x={141} y={43} width={37} height={55} rx={18} fill={edge} />
    <Rect x={3} y={38} width={35} height={52} rx={17} fill={base} /><Rect x={140} y={38} width={35} height={52} rx={17} fill={base} />
    <Rect x={27} y={62} width={59} height={32} rx={13} fill={seat} /><Rect x={91} y={62} width={58} height={32} rx={13} fill={seat} />
    <Rect x={31} y={28} width={34} height={35} rx={10} fill={DIORAMA.lemon} transform="rotate(-8 48 45)" />
    <Path d="M29 19H149" stroke={DIORAMA.white} strokeWidth={6} strokeLinecap="round" opacity={0.34} />
  </Svg>;
}

function Lamp({ night }: { night: boolean }) {
  return <Svg width={70} height={150} viewBox="0 0 70 150">
    {night && <Circle cx={35} cy={28} r={33} fill={DIORAMA.goldGlow} opacity={0.25} />}
    <Ellipse cx={35} cy={143} rx={24} ry={6} fill={DIORAMA.shadow} opacity={0.2} />
    <Rect x={32} y={43} width={7} height={89} rx={4} fill={DIORAMA.woodDeep} /><Rect x={33} y={45} width={3} height={79} rx={2} fill={DIORAMA.woodShine} opacity={0.35} />
    <Ellipse cx={35} cy={136} rx={21} ry={7} fill={DIORAMA.woodDark} />
    <Path d="M14 7H56L64 42H6Z" fill={night ? DIORAMA.goldGlow : DIORAMA.gold} /><Path d="M17 8H53L55 18H15Z" fill={DIORAMA.goldLight} opacity={0.76} />
  </Svg>;
}

function HomeLife() {
  const a = loop(3300), b = loop(5200, 600);
  return <View style={styles.fill} pointerEvents="none">
    <Animated.View style={[styles.homeBeam, { opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0.035, 0.13] }) }]} />
    <Animated.View style={[styles.dust, { opacity: b.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.34] }), transform: [{ translateX: b.interpolate({ inputRange: [0, 1], outputRange: [-8, 22] }) }, { translateY: b.interpolate({ inputRange: [0, 1], outputRange: [8, -18] }) }] }]} />
  </View>;
}

export function HomeScene({ hour, upgrades = [], asleep = false, groundY, chromeBottom }: { hour: number; upgrades?: string[]; asleep?: boolean; groundY: number; chromeBottom: number }) {
  const band = skyBand(hour), night = band === 'night' || asleep;
  const has = (id: string) => upgrades.includes(id);
  const floorTop = Math.max(chromeBottom + 180, groundY - 126);
  return <View style={styles.fill} pointerEvents="none">
    <LinearGradient colors={night ? [DIORAMA.wallNightA, DIORAMA.wallNightB] : [DIORAMA.wallDayA, DIORAMA.wallDayB]} style={[styles.fill, { bottom: undefined, height: floorTop }]} />
    <View style={{ position: 'absolute', left: 0, right: 0, top: floorTop - 18, height: 18, backgroundColor: night ? DIORAMA.wallNightEdge : DIORAMA.wallDayEdge }} />
    <LinearGradient colors={night ? [DIORAMA.floorNightFar, DIORAMA.floorNightNear] : [DIORAMA.floorDayFar, DIORAMA.floorDayNear]} style={{ position: 'absolute', left: 0, right: 0, top: floorTop, bottom: 0 }} />
    <Svg width="100%" height="100%" viewBox="0 0 420 760" preserveAspectRatio="none" style={styles.fill}>
      <Path d={`M0 ${floorTop + 7}H420`} stroke={night ? DIORAMA.floorNightEdge : DIORAMA.floorDayEdge} strokeWidth={9} opacity={0.62} />
      {[48, 122, 198, 276, 352].map(x => <Path key={x} d={`M${x} ${floorTop}L${210 + (x - 210) * 1.7} 760`} stroke={night ? DIORAMA.floorNightEdge : DIORAMA.floorDayEdge} strokeWidth={2.2} opacity={night ? 0.2 : 0.3} />)}
    </Svg>
    <View style={{ position: 'absolute', left: 22, top: chromeBottom + 73 }}><Window band={band} big={has('home_window')} /></View>
    <View style={{ position: 'absolute', right: 16, top: floorTop - 91 }}><Sofa night={night} /></View>
    <View style={{ position: 'absolute', left: 9, top: floorTop - 130 }}><Lamp night={night} /></View>
    <View style={{ position: 'absolute', right: 32, top: chromeBottom + 78, width: 112, height: 60 }}>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 5, height: 11, borderRadius: radius.pill, backgroundColor: DIORAMA.woodWarm }} />
      {[DIORAMA.aqua, DIORAMA.violet, DIORAMA.mint].map((c, i) => <View key={c} style={{ position: 'absolute', left: 12 + i * 31, bottom: 15, width: 23, height: 29 + (i % 2) * 10, borderRadius: radius.sm, backgroundColor: c }}><View style={{ position: 'absolute', left: 4, right: 4, top: 4, height: 4, borderRadius: radius.pill, backgroundColor: DIORAMA.white, opacity: 0.45 }} /></View>)}
    </View>
    {has('home_bed') && <View style={{ position: 'absolute', left: 58, top: floorTop + 37 }}><Svg width={105} height={54} viewBox="0 0 105 54"><Ellipse cx={53} cy={47} rx={44} ry={5} fill={DIORAMA.shadow} opacity={0.18} /><Ellipse cx={53} cy={29} rx={45} ry={18} fill={DIORAMA.bedEdge} /><Ellipse cx={53} cy={24} rx={43} ry={17} fill={DIORAMA.bedWall} /><Ellipse cx={53} cy={28} rx={31} ry={11} fill={DIORAMA.bedCushion} /><Path d="M22 17Q53 7 84 17" stroke={DIORAMA.white} strokeWidth={5} fill="none" opacity={0.34} /></Svg></View>}
    {has('home_rug') && <View style={{ position: 'absolute', left: '19%', right: '19%', top: groundY + 28, height: 47, borderRadius: 50, backgroundColor: DIORAMA.coralDeep }}><LinearGradient colors={[DIORAMA.coralLight, DIORAMA.coral]} style={{ flex: 1, margin: 5, borderRadius: 45 }} /></View>}
    <HomeLife />
  </View>;
}

function Tree({ night, flip = false }: { night: boolean; flip?: boolean }) {
  const base = night ? DIORAMA.parkTreeNight : DIORAMA.parkTreeDay, hi = night ? DIORAMA.parkTreeNightLight : DIORAMA.parkTreeDayLight, edge = night ? DIORAMA.parkTreeNightEdge : DIORAMA.parkTreeDayEdge;
  return <Svg width={146} height={220} viewBox="0 0 146 220" style={flip ? { transform: [{ scaleX: -1 }] } : undefined}>
    <Ellipse cx={73} cy={211} rx={45} ry={7} fill={DIORAMA.shadow} opacity={0.17} /><Path d="M61 79C56 118 58 162 49 203H96C85 161 87 118 80 80Z" fill={DIORAMA.woodDeep} />
    <Path d="M65 87C64 124 65 159 59 190" stroke={DIORAMA.woodShine} strokeWidth={7} strokeLinecap="round" opacity={0.28} />
    <Circle cx={72} cy={64} r={52} fill={edge} /><Circle cx={56} cy={56} r={45} fill={base} /><Circle cx={92} cy={65} r={39} fill={base} /><Circle cx={70} cy={39} r={36} fill={hi} />
    <Path d="M35 37Q70 12 101 37" stroke={night ? DIORAMA.parkTreeNightLight : DIORAMA.parkTreeDayShine} strokeWidth={8} strokeLinecap="round" opacity={night ? 0.2 : 0.55} />
  </Svg>;
}

function ParkLife() {
  const a = loop(4700), b = loop(7000, 900);
  return <View style={styles.fill} pointerEvents="none">
    <Animated.View style={[styles.leaf, { transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [-25, 90] }) }, { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, 30] }) }, { rotate: a.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '130deg'] }) }] }]} />
    <Animated.View style={[styles.butterfly, { opacity: b.interpolate({ inputRange: [0, .12, .88, 1], outputRange: [0, .9, .9, 0] }), transform: [{ translateX: b.interpolate({ inputRange: [0, 1], outputRange: [-20, 390] }) }, { translateY: b.interpolate({ inputRange: [0, .5, 1], outputRange: [0, -32, 5] }) }] }]}><View style={styles.bflyL} /><View style={styles.bflyR} /></Animated.View>
  </View>;
}

export function ParkScene({ hour, bandHeight = 620, groundY }: { hour: number; bandHeight?: number; groundY?: number }) {
  const band = skyBand(hour), night = band === 'night', ground = groundY ?? bandHeight * .72, horizon = Math.max(175, ground - 180);
  const grass = night ? DIORAMA.parkGrassNight : DIORAMA.parkGrassDay, grassHi = night ? DIORAMA.parkGrassNightLight : DIORAMA.parkGrassDayLight, grassEdge = night ? DIORAMA.parkGrassNightEdge : DIORAMA.parkGrassDayEdge;
  const path = night ? DIORAMA.parkPathNight : DIORAMA.parkPathDay, pathHi = night ? DIORAMA.parkPathNightLight : DIORAMA.parkPathDayLight, pathEdge = night ? DIORAMA.parkPathNightEdge : DIORAMA.parkPathDayEdge;
  return <View style={styles.fill} pointerEvents="none"><Sky band={band} />
    <Svg width="100%" height="100%" viewBox={`0 0 420 ${bandHeight}`} preserveAspectRatio="none" style={styles.fill}><Defs><SvgGradient id="g" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={grassHi} /><Stop offset=".48" stopColor={grass} /><Stop offset="1" stopColor={grassEdge} /></SvgGradient><SvgGradient id="p" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={pathHi} /><Stop offset=".72" stopColor={path} /><Stop offset="1" stopColor={pathEdge} /></SvgGradient></Defs>
      <Path d={`M-40 ${horizon + 38}Q60 ${horizon - 28} 160 ${horizon + 27}T300 ${horizon + 12}T470 ${horizon + 28}V${bandHeight}H-40Z`} fill={night ? DIORAMA.parkHillNight : DIORAMA.parkHillDay} />
      <Path d={`M0 ${horizon + 55}Q130 ${horizon + 10} 250 ${horizon + 48}T420 ${horizon + 34}V${bandHeight}H0Z`} fill="url(#g)" />
      <Path d={`M188 ${horizon + 42}C196 ${horizon + 90} 157 ${ground + 34} 110 ${bandHeight}H302C256 ${ground + 34} 223 ${horizon + 90} 230 ${horizon + 42}Z`} fill={pathEdge} />
      <Path d={`M195 ${horizon + 42}C202 ${horizon + 91} 171 ${ground + 29} 130 ${bandHeight}H283C244 ${ground + 28} 216 ${horizon + 91} 224 ${horizon + 42}Z`} fill="url(#p)" />
      <Path d={`M0 ${horizon + 48}H420`} stroke={night ? DIORAMA.parkHillNightEdge : DIORAMA.parkHillDayEdge} strokeWidth={9} opacity={.7} />
    </Svg>
    <View style={{ position: 'absolute', left: -48, top: horizon - 138 }}><Tree night={night} /></View><View style={{ position: 'absolute', right: -56, top: horizon - 115 }}><Tree night={night} flip /></View>
    <View style={{ position: 'absolute', left: 27, top: horizon + 77 }}><Svg width={110} height={75} viewBox="0 0 110 75"><Ellipse cx={55} cy={69} rx={42} ry={5} fill={DIORAMA.shadow} opacity={.15} /><Rect x={10} y={21} width={90} height={17} rx={8} fill={DIORAMA.woodDeep} /><Rect x={10} y={16} width={90} height={17} rx={8} fill={DIORAMA.woodWarm} /><Rect x={17} y={38} width={9} height={28} rx={4} fill={DIORAMA.woodDeep} /><Rect x={84} y={38} width={9} height={28} rx={4} fill={DIORAMA.woodDeep} /><Path d="M21 21H88" stroke={DIORAMA.white} strokeWidth={4} opacity={.28} /></Svg></View>
    <View style={{ position: 'absolute', right: 26, top: horizon + 55 }}><Svg width={82} height={90} viewBox="0 0 82 90"><Ellipse cx={41} cy={85} rx={24} ry={4} fill={DIORAMA.shadow} opacity={.16} /><Rect x={37} y={36} width={8} height={48} rx={4} fill={DIORAMA.woodDeep} /><Rect x={3} y={5} width={76} height={41} rx={13} fill={DIORAMA.signEdge} /><Rect x={3} y={0} width={76} height={41} rx={13} fill={DIORAMA.signFace} /><Path d="M14 9H66" stroke={DIORAMA.white} strokeWidth={5} opacity={.58} /><Circle cx={29} cy={24} r={7} fill={DIORAMA.coral} /><Circle cx={52} cy={24} r={7} fill={DIORAMA.aqua} /></Svg></View>
    <ParkLife />
  </View>;
}

function Front({ x, y, w, h, base, hi, edge, night }: { x: number; y: number; w: number; h: number; base: string; hi: string; edge: string; night: boolean }) {
  const glass = night ? DIORAMA.glassNight : DIORAMA.glassDay, glassEdge = night ? DIORAMA.glassNightEdge : DIORAMA.glassDayEdge;
  return <><Rect x={x} y={y + 10} width={w} height={h} rx={21} fill={edge} /><Rect x={x} y={y} width={w} height={h} rx={21} fill={base} /><Rect x={x + 10} y={y + 9} width={w - 20} height={17} rx={8} fill={hi} opacity={night ? .3 : .75} /><Rect x={x + 18} y={y + 70} width={w - 36} height={72} rx={13} fill={glassEdge} /><Rect x={x + 18} y={y + 65} width={w - 36} height={70} rx={13} fill={glass} /><Path d={`M${x + 28} ${y + 76}H${x + w - 29}`} stroke={DIORAMA.white} strokeWidth={7} opacity={night ? .18 : .52} />{Array.from({ length: 5 }, (_, i) => <Rect key={i} x={x + 10 + i * ((w - 20) / 5)} y={y + 40} width={(w - 20) / 5 + 1} height={20} rx={5} fill={i % 2 ? hi : DIORAMA.white} opacity={night ? .58 : .96} />)}</>;
}

function TownLife() { const a = loop(3600), b = loop(7000, 1000); return <View style={styles.fill} pointerEvents="none"><Animated.View style={[styles.glint, { opacity: a.interpolate({ inputRange: [0, .45, 1], outputRange: [0, .48, 0] }), transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [-40, 330] }) }, { rotate: '14deg' }] }]} /><Animated.View style={[styles.passer, { opacity: b.interpolate({ inputRange: [0, .2, .8, 1], outputRange: [0, .12, .12, 0] }), transform: [{ translateX: b.interpolate({ inputRange: [0, 1], outputRange: [-70, 470] }) }] }]} /></View>; }

export function TownScene({ hour, bandHeight = 620, groundY }: { hour: number; bandHeight?: number; groundY?: number }) {
  const band = skyBand(hour), night = band === 'night', ground = groundY ?? bandHeight * .72, plaza = ground - 92, roof = Math.max(120, plaza - 245);
  const walk = night ? DIORAMA.townSidewalkNight : DIORAMA.townSidewalkDay, walkEdge = night ? DIORAMA.townSidewalkNightEdge : DIORAMA.townSidewalkDayEdge, walkHi = night ? DIORAMA.townSidewalkNightEdge : DIORAMA.townSidewalkDayLight;
  return <View style={styles.fill} pointerEvents="none"><Sky band={band} /><Svg width="100%" height="100%" viewBox={`0 0 420 ${bandHeight}`} preserveAspectRatio="none" style={styles.fill}>
    <Front x={-12} y={roof + 42} w={150} h={212} base={night ? DIORAMA.townCoralNight : DIORAMA.townCoral} hi={DIORAMA.townCoralLight} edge={DIORAMA.townCoralEdge} night={night} /><Front x={130} y={roof + 4} w={160} h={250} base={night ? DIORAMA.townBlueNight : DIORAMA.townBlue} hi={DIORAMA.townBlueLight} edge={DIORAMA.townBlueEdge} night={night} /><Front x={281} y={roof + 34} w={151} h={220} base={night ? DIORAMA.townVioletNight : DIORAMA.townViolet} hi={DIORAMA.townVioletLight} edge={DIORAMA.townVioletEdge} night={night} />
    <Rect x={0} y={plaza + 9} width={420} height={bandHeight - plaza} fill={walkEdge} /><Rect x={0} y={plaza} width={420} height={bandHeight - plaza - 9} fill={walk} /><Path d={`M0 ${plaza + 8}H420`} stroke={walkHi} strokeWidth={7} opacity={night ? .2 : .58} />
    {[70, 150, 230, 310].map(x => <Path key={x} d={`M${x} ${plaza}L${x + 44} ${bandHeight}`} stroke={walkEdge} strokeWidth={2.2} opacity={.25} />)}
  </Svg>
  {[34, 329].map((x, i) => <View key={x} style={{ position: 'absolute', left: x, top: plaza - 35 }}><Svg width={58} height={65} viewBox="0 0 58 65"><Ellipse cx={29} cy={60} rx={22} ry={4} fill={DIORAMA.shadow} opacity={.16} /><Path d="M11 31H47L42 58H16Z" fill={DIORAMA.planterEdge} /><Path d="M13 27H45L41 53H17Z" fill={DIORAMA.planter} /><Circle cx={20} cy={22} r={8} fill={i ? DIORAMA.flowerBlue : DIORAMA.flowerPink} /><Circle cx={36} cy={17} r={9} fill={DIORAMA.flowerYellow} /><Path d="M23 30l-3-13M33 30l4-16" stroke={DIORAMA.mintDeep} strokeWidth={4} /></Svg></View>)}
  <TownLife /></View>;
}

function BeachLife() { const a = loop(2700), b = loop(7600, 900); return <View style={styles.fill} pointerEvents="none"><Animated.View style={[styles.foam, { opacity: a.interpolate({ inputRange: [0, 1], outputRange: [.05, .23] }), transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-4, 7] }) }] }]} /><Animated.View style={[styles.gull, { opacity: b.interpolate({ inputRange: [0, .12, .88, 1], outputRange: [0, .48, .48, 0] }), transform: [{ translateX: b.interpolate({ inputRange: [0, 1], outputRange: [-42, 460] }) }, { translateY: b.interpolate({ inputRange: [0, .55, 1], outputRange: [0, -24, 5] }) }] }]}><View style={styles.gullL} /><View style={styles.gullR} /></Animated.View></View>; }

export function BeachScene({ hour, bandHeight = 620, groundY }: { hour: number; bandHeight?: number; groundY?: number }) {
  const band = skyBand(hour), night = band === 'night', ground = groundY ?? bandHeight * .72, tide = ground - 118, horizon = tide - 103;
  const oceanHi = night ? DIORAMA.oceanNightLight : DIORAMA.oceanDayLight, oceanEdge = night ? DIORAMA.oceanNightEdge : DIORAMA.oceanDayEdge, sandHi = night ? DIORAMA.sandNightLight : DIORAMA.sandDayLight, sandEdge = night ? DIORAMA.sandNightEdge : DIORAMA.sandDayEdge;
  return <View style={styles.fill} pointerEvents="none"><Sky band={band} />
    <View style={{ position: 'absolute', left: 0, right: 0, top: horizon + 8, height: tide - horizon + 32, backgroundColor: oceanEdge }} /><LinearGradient colors={night ? [DIORAMA.oceanNightA, DIORAMA.oceanNightB] : [DIORAMA.oceanDayA, DIORAMA.oceanDayB]} style={{ position: 'absolute', left: 0, right: 0, top: horizon, height: tide - horizon + 27 }} /><View style={{ position: 'absolute', left: 26, right: 26, top: horizon + 12, height: 7, borderRadius: radius.pill, backgroundColor: oceanHi, opacity: night ? .18 : .34 }} />
    <View style={{ position: 'absolute', left: 0, right: 0, top: tide + 8, bottom: 0, backgroundColor: sandEdge }} /><LinearGradient colors={night ? [DIORAMA.sandNightFar, DIORAMA.sandNightNear] : [DIORAMA.sandDayFar, DIORAMA.sandDayNear]} style={{ position: 'absolute', left: 0, right: 0, top: tide, bottom: 0 }} />
    <Svg width="100%" height="100%" viewBox={`0 0 420 ${bandHeight}`} preserveAspectRatio="none" style={styles.fill}><Path d={`M-15 ${tide + 7}Q52 ${tide - 11} 115 ${tide + 6}T238 ${tide + 5}T358 ${tide + 4}T440 ${tide + 5}`} stroke={night ? DIORAMA.foamNightShade : DIORAMA.foamDayShade} strokeWidth={15} fill="none" /><Path d={`M-15 ${tide}Q52 ${tide - 17} 115 ${tide}T238 ${tide - 2}T358 ${tide - 3}T440 ${tide - 2}`} stroke={night ? DIORAMA.foamNight : DIORAMA.foamDay} strokeWidth={9} fill="none" /><Path d={`M4 ${tide - 43}Q76 ${tide - 57} 151 ${tide - 43}T305 ${tide - 44}T430 ${tide - 43}`} stroke={oceanHi} strokeWidth={6} fill="none" opacity={night ? .2 : .46} /><Path d={`M72 ${ground + 63}Q210 ${ground + 85} 357 ${ground + 63}`} stroke={sandHi} strokeWidth={5} fill="none" opacity={night ? .1 : .34} /></Svg>
    <View style={{ position: 'absolute', right: -17, top: ground - 155 }}><Svg width={120} height={168} viewBox="0 0 120 168"><Ellipse cx={63} cy={160} rx={35} ry={5} fill={DIORAMA.shadow} opacity={.15} /><Path d="M61 58V153" stroke={DIORAMA.woodWarm} strokeWidth={7} /><Path d="M10 62Q58-8 110 62Z" fill={DIORAMA.coralDeep} /><Path d="M10 55Q58-15 110 55Z" fill={DIORAMA.coral} /><Path d="M26 49Q58 0 91 49Z" fill={DIORAMA.lemon} /><Path d="M27 42Q57 3 88 44" stroke={DIORAMA.white} strokeWidth={5} opacity={.4} /></Svg></View>
    <View style={{ position: 'absolute', left: -25, top: ground - 74 }}><Svg width={132} height={124} viewBox="0 0 132 124"><Ellipse cx={52} cy={112} rx={69} ry={25} fill={night ? DIORAMA.sandNightFar : DIORAMA.sandDayFar} />{[22, 39, 58, 76, 94].map((x, i) => <Path key={x} d={`M${x} 112Q${x + (i % 2 ? 14 : -9)} 78 ${x + (i % 3) * 6 - 2} 43`} stroke={night ? DIORAMA.grassBeachNight : DIORAMA.grassBeachDay} strokeWidth={6 - (i % 2)} fill="none" />)}</Svg></View>
    <BeachLife />
  </View>;
}

export function NightOverlay() { return <View pointerEvents="none" style={[styles.fill, { backgroundColor: DIORAMA.skyNightA, opacity: .12 }]} />; }

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  cloud: { position: 'absolute', left: 54, top: 124, width: 140, height: 40 }, cloudPart: { position: 'absolute', top: 0, height: 27, borderRadius: 30, backgroundColor: DIORAMA.white },
  homeBeam: { position: 'absolute', left: 37, top: 252, width: 112, height: 190, borderRadius: 80, backgroundColor: DIORAMA.goldLight, transform: [{ rotate: '-12deg' }] }, dust: { position: 'absolute', left: 112, top: 280, width: 7, height: 7, borderRadius: 7, backgroundColor: DIORAMA.white },
  leaf: { position: 'absolute', left: 88, top: 245, width: 12, height: 7, borderTopLeftRadius: 12, borderBottomRightRadius: 12, backgroundColor: DIORAMA.parkTreeDayLight }, butterfly: { position: 'absolute', left: 0, top: 260, width: 18, height: 12 }, bflyL: { position: 'absolute', left: 0, width: 10, height: 10, borderRadius: 8, backgroundColor: DIORAMA.violetLight, transform: [{ rotate: '-28deg' }] }, bflyR: { position: 'absolute', right: 0, width: 10, height: 10, borderRadius: 8, backgroundColor: DIORAMA.coralLight, transform: [{ rotate: '28deg' }] },
  glint: { position: 'absolute', left: 46, top: 228, width: 22, height: 150, borderRadius: radius.pill, backgroundColor: DIORAMA.white }, passer: { position: 'absolute', left: 0, top: 388, width: 36, height: 62, borderRadius: 20, backgroundColor: DIORAMA.shadow },
  foam: { position: 'absolute', left: 42, right: 42, top: 387, height: 9, borderRadius: radius.pill, backgroundColor: DIORAMA.white }, gull: { position: 'absolute', left: 0, top: 166, width: 26, height: 14 }, gullL: { position: 'absolute', left: 0, top: 5, width: 15, height: 3, borderRadius: 4, backgroundColor: DIORAMA.inkSoft, transform: [{ rotate: '-22deg' }] }, gullR: { position: 'absolute', right: 0, top: 5, width: 15, height: 3, borderRadius: 4, backgroundColor: DIORAMA.inkSoft, transform: [{ rotate: '22deg' }] },
});
