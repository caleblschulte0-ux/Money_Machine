import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient as SvgLinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
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
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, duration, v]);
  return v;
}

function Contact({ width, opacity = 0.22 }: { width: number; opacity?: number }) {
  return (
    <Svg width={width} height={22} viewBox={`0 0 ${width} 22`}>
      <Ellipse cx={width / 2} cy={13} rx={width * 0.46} ry={7.5} fill={DIORAMA.shadow} opacity={opacity * 0.35} />
      <Ellipse cx={width / 2} cy={12} rx={width * 0.31} ry={4.4} fill={DIORAMA.shadow} opacity={opacity * 0.75} />
      <Ellipse cx={width / 2} cy={11.5} rx={width * 0.16} ry={2.5} fill={DIORAMA.shadow} opacity={opacity} />
    </Svg>
  );
}

function SkyDetails({ band }: { band: SkyBand }) {
  const night = band === 'night';
  const drift = useLoop(8400, 300);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 420 760" preserveAspectRatio="none">
        {night ? (
          <>
            <Circle cx={330} cy={130} r={34} fill={DIORAMA.goldLight} />
            <Circle cx={317} cy={118} r={31} fill={DIORAMA.skyNightA} />
            {[58, 112, 182, 253, 374].map((x, i) => (
              <Circle key={x} cx={x} cy={86 + (i % 3) * 35} r={i % 2 ? 2 : 2.8} fill={DIORAMA.paleCream} opacity={0.9} />
            ))}
          </>
        ) : (
          <Circle cx={338} cy={120} r={37} fill={DIORAMA.lemon} opacity={0.95} />
        )}
      </Svg>
      <Animated.View
        style={[
          styles.cloud,
          {
            opacity: night ? 0.16 : 0.72,
            transform: [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-18, 22] }) }],
          },
        ]}
      >
        <View style={[styles.cloudPuff, { left: 0, width: 62 }]} />
        <View style={[styles.cloudPuff, { left: 31, top: -13, width: 52 }]} />
        <View style={[styles.cloudPuff, { left: 66, width: 70 }]} />
      </Animated.View>
    </View>
  );
}

function HomeWindow({ band, large }: { band: SkyBand; large: boolean }) {
  const night = band === 'night';
  const w = large ? 176 : 146;
  const h = large ? 126 : 106;
  const frame = night ? DIORAMA.windowFrameNight : DIORAMA.windowFrameDay;
  const frameEdge = night ? DIORAMA.windowFrameNightEdge : DIORAMA.windowFrameDayEdge;
  return (
    <View style={{ width: w, height: h + 12 }}>
      <View style={{ position: 'absolute', left: 7, right: 7, bottom: 0, height: 15, borderRadius: radius.md, backgroundColor: frameEdge }} />
      <View style={{ width: w, height: h, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 8, borderColor: frameEdge, backgroundColor: frame }}>
        <LinearGradient colors={SKY[band]} style={StyleSheet.absoluteFill} />
        <Svg width="100%" height="100%" viewBox="0 0 160 110" preserveAspectRatio="none">
          {night ? (
            <>
              <Circle cx={122} cy={25} r={15} fill={DIORAMA.goldLight} />
              <Circle cx={115} cy={18} r={14} fill={DIORAMA.skyNightA} />
              <Circle cx={43} cy={29} r={2} fill={DIORAMA.paleCream} />
              <Circle cx={80} cy={47} r={1.5} fill={DIORAMA.paleCream} />
            </>
          ) : (
            <>
              <Circle cx={126} cy={24} r={17} fill={DIORAMA.lemon} />
              <Ellipse cx={47} cy={43} rx={30} ry={10} fill={DIORAMA.white} opacity={0.88} />
            </>
          )}
          <Path d="M0 87 Q44 64 82 80 T160 77 V110 H0 Z" fill={night ? DIORAMA.hillNight : DIORAMA.hillDay} />
        </Svg>
        <View style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 5, backgroundColor: frame }} />
        <View style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 5, backgroundColor: frame }} />
        <View style={{ position: 'absolute', left: 12, right: 24, top: 8, height: 7, borderRadius: radius.pill, backgroundColor: DIORAMA.white, opacity: 0.46 }} />
      </View>
    </View>
  );
}

function CandySofa({ night }: { night: boolean }) {
  const base = night ? DIORAMA.couchNight : DIORAMA.couchDay;
  const light = night ? DIORAMA.couchNightTop : DIORAMA.couchDayTop;
  const seat = night ? DIORAMA.couchNightSeat : DIORAMA.couchDaySeat;
  const edge = night ? DIORAMA.couchNightEdge : DIORAMA.couchDayEdge;
  return (
    <View style={{ width: 178, height: 112 }}>
      <View style={{ position: 'absolute', bottom: -2, left: 1 }}><Contact width={176} opacity={0.27} /></View>
      <Svg width={178} height={104} viewBox="0 0 178 104">
        <Defs>
          <SvgLinearGradient id="sofa" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={light} />
            <Stop offset="0.55" stopColor={base} />
            <Stop offset="1" stopColor={edge} />
          </SvgLinearGradient>
        </Defs>
        <Rect x={16} y={12} width={146} height={58} rx={24} fill="url(#sofa)" />
        <Rect x={0} y={43} width={37} height={53} rx={18} fill={edge} />
        <Rect x={141} y={43} width={37} height={53} rx={18} fill={edge} />
        <Rect x={3} y={37} width={35} height={52} rx={17} fill={base} />
        <Rect x={140} y={37} width={35} height={52} rx={17} fill={base} />
        <Rect x={27} y={61} width={59} height={32} rx={13} fill={seat} />
        <Rect x={91} y={61} width={58} height={32} rx={13} fill={seat} />
        <Rect x={31} y={27} width={34} height={35} rx={10} fill={DIORAMA.lemon} transform="rotate(-8 48 44)" />
        <Path d="M28 18 H150" stroke={DIORAMA.white} strokeWidth={6} strokeLinecap="round" opacity={0.34} />
        <Path d="M36 67 H79 M99 67 H140" stroke={DIORAMA.white} strokeWidth={3} strokeLinecap="round" opacity={0.28} />
      </Svg>
    </View>
  );
}

function CandyLamp({ night }: { night: boolean }) {
  return (
    <Svg width={72} height={154} viewBox="0 0 72 154">
      {night && <Circle cx={36} cy={30} r={34} fill={DIORAMA.goldGlow} opacity={0.24} />}
      <Ellipse cx={36} cy={147} rx={25} ry={6} fill={DIORAMA.shadow} opacity={0.2} />
      <Rect x={33} y={45} width={7} height={91} rx={4} fill={DIORAMA.woodDeep} />
      <Rect x={34} y={46} width={3} height={82} rx={2} fill={DIORAMA.woodShine} opacity={0.38} />
      <Ellipse cx={36} cy={140} rx={22} ry={7} fill={DIORAMA.woodDark} />
      <Path d="M15 8 H57 L65 43 H7 Z" fill={night ? DIORAMA.goldGlow : DIORAMA.gold} />
      <Path d="M18 8 H54 L56 18 H16 Z" fill={DIORAMA.goldLight} opacity={0.76} />
      <Path d="M11 40 H61" stroke={DIORAMA.goldDeep} strokeWidth={5} />
    </Svg>
  );
}

function HomeAmbient() {
  const gleam = useLoop(3100);
  const dust = useLoop(5200, 500);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.homeGleam, { opacity: gleam.interpolate({ inputRange: [0, 1], outputRange: [0.04, 0.14] }) }]} />
      <Animated.View
        style={[
          styles.dust,
          {
            opacity: dust.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.34] }),
            transform: [
              { translateX: dust.interpolate({ inputRange: [0, 1], outputRange: [-8, 22] }) },
              { translateY: dust.interpolate({ inputRange: [0, 1], outputRange: [10, -18] }) },
            ],
          },
        ]}
      />
    </View>
  );
}

export function HomeScene({ hour, upgrades = [], asleep = false, groundY, chromeBottom }: {
  hour: number;
  upgrades?: string[];
  asleep?: boolean;
  groundY: number;
  chromeBottom: number;
}) {
  const band = skyBand(hour);
  const night = band === 'night' || asleep;
  const has = (id: string) => upgrades.includes(id);
  const floorTop = Math.max(chromeBottom + 178, groundY - 128);
  const windowTop = chromeBottom + 72;
  const sofaTop = floorTop - 92;

  return (
    <View style={styles.fill} pointerEvents="none">
      <LinearGradient
        colors={night ? [DIORAMA.wallNightA, DIORAMA.wallNightB] : [DIORAMA.wallDayA, DIORAMA.wallDayB]}
        style={[styles.fill, { bottom: undefined, height: floorTop }]}
      />
      <View style={{ position: 'absolute', left: 0, right: 0, top: floorTop - 18, height: 18, backgroundColor: night ? DIORAMA.wallNightEdge : DIORAMA.wallDayEdge }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: floorTop - 18, height: 5, backgroundColor: DIORAMA.white, opacity: night ? 0.1 : 0.28 }} />
      <LinearGradient
        colors={night ? [DIORAMA.floorNightFar, DIORAMA.floorNightNear] : [DIORAMA.floorDayFar, DIORAMA.floorDayNear]}
        style={{ position: 'absolute', left: 0, right: 0, top: floorTop, bottom: 0 }}
      />
      <Svg width="100%" height="100%" viewBox="0 0 420 760" preserveAspectRatio="none" style={styles.fill}>
        <Path d={`M0 ${floorTop + 8} H420`} stroke={night ? DIORAMA.floorNightEdge : DIORAMA.floorDayEdge} strokeWidth={9} opacity={0.62} />
        {[44, 116, 188, 260, 332, 404].map((x) => (
          <Path key={x} d={`M${x} ${floorTop} L${210 + (x - 210) * 1.72} 760`} stroke={night ? DIORAMA.floorNightEdge : DIORAMA.floorDayEdge} strokeWidth={2.2} opacity={night ? 0.23 : 0.32} />
        ))}
        {[floorTop + 48, floorTop + 104, floorTop + 174].map((y) => (
          <Path key={y} d={`M0 ${y} H420`} stroke={DIORAMA.white} strokeWidth={2} opacity={night ? 0.05 : 0.12} />
        ))}
      </Svg>

      <View style={{ position: 'absolute', left: 22, top: windowTop }}><HomeWindow band={band} large={has('home_window')} /></View>
      <View style={{ position: 'absolute', right: 18, top: sofaTop }}><CandySofa night={night} /></View>
      <View style={{ position: 'absolute', left: 12, top: floorTop - 132 }}><CandyLamp night={night} /></View>

      <View style={{ position: 'absolute', right: 34, top: chromeBottom + 76, width: 112, height: 63 }}>
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 11, borderRadius: radius.pill, backgroundColor: DIORAMA.woodDeep }} />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 6, height: 11, borderRadius: radius.pill, backgroundColor: DIORAMA.woodWarm }} />
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ position: 'absolute', left: 12 + i * 31, bottom: 15, width: 23, height: 30 + (i % 2) * 10, borderRadius: radius.sm, backgroundColor: [DIORAMA.aqua, DIORAMA.violet, DIORAMA.mint][i] }}>
            <View style={{ position: 'absolute', left: 4, right: 4, top: 4, height: 4, borderRadius: radius.pill, backgroundColor: DIORAMA.white, opacity: 0.42 }} />
          </View>
        ))}
      </View>

      {has('home_rug') && (
        <View style={{ position: 'absolute', left: '15%', right: '15%', top: groundY + 26, height: 52, borderRadius: 60, backgroundColor: DIORAMA.coralDeep, opacity: 0.98 }}>
          <LinearGradient colors={[DIORAMA.coralLight, DIORAMA.coral]} style={{ flex: 1, margin: 5, borderRadius: 55 }} />
          <View style={{ position: 'absolute', left: 24, right: 24, top: 10, height: 6, borderRadius: radius.pill, backgroundColor: DIORAMA.white, opacity: 0.24 }} />
        </View>
      )}
      <HomeAmbient />
    </View>
  );
}

function ParkTree({ night, mirror = false }: { night: boolean; mirror?: boolean }) {
  const leaf = night ? DIORAMA.parkTreeNight : DIORAMA.parkTreeDay;
  const light = night ? DIORAMA.parkTreeNightLight : DIORAMA.parkTreeDayLight;
  const edge = night ? DIORAMA.parkTreeNightEdge : DIORAMA.parkTreeDayEdge;
  return (
    <Svg width={145} height={220} viewBox="0 0 145 220" style={mirror ? { transform: [{ scaleX: -1 }] } : undefined}>
      <Ellipse cx={73} cy={211} rx={46} ry={8} fill={DIORAMA.shadow} opacity={0.18} />
      <Path d="M62 79 C56 118 58 161 49 203 H96 C84 160 87 117 80 80 Z" fill={DIORAMA.woodDeep} />
      <Path d="M65 86 C64 124 65 159 59 190" stroke={DIORAMA.woodShine} strokeWidth={7} strokeLinecap="round" opacity={0.3} />
      <Circle cx={71} cy={63} r={52} fill={edge} />
      <Circle cx={57} cy={56} r={45} fill={leaf} />
      <Circle cx={91} cy={64} r={39} fill={leaf} />
      <Circle cx={70} cy={39} r={36} fill={light} />
      <Path d="M34 37 Q69 12 101 37" stroke={night ? DIORAMA.parkTreeNightLight : DIORAMA.parkTreeDayShine} strokeWidth={8} strokeLinecap="round" opacity={night ? 0.22 : 0.58} />
    </Svg>
  );
}

function ParkAmbient() {
  const leaf = useLoop(4700);
  const butterfly = useLoop(6900, 800);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.floatingLeaf,
          {
            transform: [
              { translateX: leaf.interpolate({ inputRange: [0, 1], outputRange: [-30, 80] }) },
              { translateY: leaf.interpolate({ inputRange: [0, 1], outputRange: [0, 30] }) },
              { rotate: leaf.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '120deg'] }) },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.butterfly,
          {
            opacity: butterfly.interpolate({ inputRange: [0, 0.12, 0.88, 1], outputRange: [0, 0.9, 0.9, 0] }),
            transform: [
              { translateX: butterfly.interpolate({ inputRange: [0, 1], outputRange: [-20, 390] }) },
              { translateY: butterfly.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -35, 6] }) },
            ],
          },
        ]}
      >
        <View style={styles.butterflyWingLeft} />
        <View style={styles.butterflyWingRight} />
      </Animated.View>
    </View>
  );
}

export function ParkScene({ hour, bandHeight = 620, groundY }: { hour: number; bandHeight?: number; groundY?: number }) {
  const band = skyBand(hour);
  const night = band === 'night';
  const ground = groundY ?? bandHeight * 0.72;
  const horizon = Math.max(175, ground - 180);
  const grass = night ? DIORAMA.parkGrassNight : DIORAMA.parkGrassDay;
  const grassLight = night ? DIORAMA.parkGrassNightLight : DIORAMA.parkGrassDayLight;
  const grassEdge = night ? DIORAMA.parkGrassNightEdge : DIORAMA.parkGrassDayEdge;
  const path = night ? DIORAMA.parkPathNight : DIORAMA.parkPathDay;
  const pathLight = night ? DIORAMA.parkPathNightLight : DIORAMA.parkPathDayLight;
  const pathEdge = night ? DIORAMA.parkPathNightEdge : DIORAMA.parkPathDayEdge;

  return (
    <View style={styles.fill} pointerEvents="none">
      <LinearGradient colors={SKY[band]} style={styles.fill} />
      <SkyDetails band={band} />
      <Svg width="100%" height="100%" viewBox={`0 0 420 ${bandHeight}`} preserveAspectRatio="none" style={styles.fill}>
        <Defs>
          <SvgLinearGradient id="grassField" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={grassLight} />
            <Stop offset="0.46" stopColor={grass} />
            <Stop offset="1" stopColor={grassEdge} />
          </SvgLinearGradient>
          <SvgLinearGradient id="parkPath" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={pathLight} />
            <Stop offset="0.7" stopColor={path} />
            <Stop offset="1" stopColor={pathEdge} />
          </SvgLinearGradient>
        </Defs>
        <Path d={`M-40 ${horizon + 38} Q60 ${horizon - 28} 160 ${horizon + 27} T300 ${horizon + 12} T470 ${horizon + 28} V${bandHeight} H-40 Z`} fill={night ? DIORAMA.parkHillNight : DIORAMA.parkHillDay} />
        <Path d={`M0 ${horizon + 55} Q130 ${horizon + 10} 250 ${horizon + 48} T420 ${horizon + 34} V${bandHeight} H0 Z`} fill="url(#grassField)" />
        <Path d={`M188 ${horizon + 42} C195 ${horizon + 85} 156 ${ground + 34} 108 ${bandHeight} H302 C257 ${ground + 34} 223 ${horizon + 85} 230 ${horizon + 42} Z`} fill={pathEdge} opacity={0.72} />
        <Path d={`M194 ${horizon + 42} C202 ${horizon + 91} 170 ${ground + 29} 128 ${bandHeight} H284 C245 ${ground + 28} 216 ${horizon + 91} 224 ${horizon + 42} Z`} fill="url(#parkPath)" />
        <Path d={`M202 ${horizon + 52} C205 ${horizon + 78} 189 ${ground - 5} 175 ${ground + 18}`} stroke={DIORAMA.white} strokeWidth={6} strokeLinecap="round" opacity={night ? 0.08 : 0.2} />

        <Path d={`M0 ${horizon + 48} H420`} stroke={night ? DIORAMA.parkHillNightEdge : DIORAMA.parkHillDayEdge} strokeWidth={9} opacity={0.72} />
        {[34, 74, 338, 376].map((x, i) => (
          <React.Fragment key={x}>
            <Path d={`M${x} ${ground + 7 + (i % 2) * 10} v-19`} stroke={grassEdge} strokeWidth={4} />
            <Circle cx={x} cy={ground - 13 + (i % 2) * 10} r={6} fill={[DIORAMA.flowerPink, DIORAMA.flowerYellow, DIORAMA.flowerBlue, DIORAMA.flowerPink][i]} />
            <Circle cx={x - 2} cy={ground - 15 + (i % 2) * 10} r={2} fill={DIORAMA.white} opacity={0.6} />
          </React.Fragment>
        ))}
      </Svg>

      <View style={{ position: 'absolute', left: -48, top: horizon - 138 }}><ParkTree night={night} /></View>
      <View style={{ position: 'absolute', right: -56, top: horizon - 115 }}><ParkTree night={night} mirror /></View>
      <View style={{ position: 'absolute', left: 24, top: horizon + 74 }}>
        <Svg width={112} height={78} viewBox="0 0 112 78">
          <Ellipse cx={56} cy={72} rx={43} ry={5} fill={DIORAMA.shadow} opacity={0.15} />
          <Rect x={10} y={22} width={92} height={17} rx={8} fill={DIORAMA.woodDeep} />
          <Rect x={10} y={17} width={92} height={17} rx={8} fill={DIORAMA.woodWarm} />
          <Rect x={17} y={39} width={9} height={29} rx={4} fill={DIORAMA.woodDeep} />
          <Rect x={86} y={39} width={9} height={29} rx={4} fill={DIORAMA.woodDeep} />
          <Path d="M21 22 H91" stroke={DIORAMA.white} strokeWidth={4} strokeLinecap="round" opacity={0.28} />
        </Svg>
      </View>
      <View style={{ position: 'absolute', right: 25, top: horizon + 55 }}>
        <Svg width={83} height={91} viewBox="0 0 83 91">
          <Ellipse cx={42} cy={86} rx={24} ry={4} fill={DIORAMA.shadow} opacity={0.16} />
          <Rect x={38} y={37} width={8} height={48} rx={4} fill={DIORAMA.woodDeep} />
          <Rect x={3} y={6} width={77} height={41} rx={13} fill={DIORAMA.signEdge} />
          <Rect x={3} y={0} width={77} height={41} rx={13} fill={DIORAMA.signFace} />
          <Path d="M14 9 H67" stroke={DIORAMA.white} strokeWidth={5} strokeLinecap="round" opacity={0.6} />
          <Circle cx={30} cy={24} r={7} fill={DIORAMA.coral} />
          <Circle cx={52} cy={24} r={7} fill={DIORAMA.aqua} />
        </Svg>
      </View>
      <ParkAmbient />
    </View>
  );
}

function Storefront({ x, y, width, height, base, light, edge, night }: { x: number; y: number; width: number; height: number; base: string; light: string; edge: string; night: boolean }) {
  const glass = night ? DIORAMA.glassNight : DIORAMA.glassDay;
  const glassEdge = night ? DIORAMA.glassNightEdge : DIORAMA.glassDayEdge;
  return (
    <>
      <Rect x={x} y={y + 10} width={width} height={height} rx={21} fill={edge} />
      <Rect x={x} y={y} width={width} height={height} rx={21} fill={base} />
      <Rect x={x + 10} y={y + 9} width={width - 20} height={17} rx={8} fill={light} opacity={night ? 0.3 : 0.76} />
      <Rect x={x + 18} y={y + 70} width={width - 36} height={72} rx={13} fill={glassEdge} />
      <Rect x={x + 18} y={y + 65} width={width - 36} height={70} rx={13} fill={glass} />
      <Path d={`M${x + 28} ${y + 76} H${x + width - 29}`} stroke={DIORAMA.white} strokeWidth={7} strokeLinecap="round" opacity={night ? 0.18 : 0.52} />
      {Array.from({ length: 5 }, (_, i) => (
        <Rect key={i} x={x + 10 + i * ((width - 20) / 5)} y={y + 40} width={(width - 20) / 5 + 1} height={20} rx={5} fill={i % 2 ? light : DIORAMA.white} opacity={night ? 0.58 : 0.96} />
      ))}
    </>
  );
}

function TownAmbient() {
  const glint = useLoop(3600, 300);
  const passer = useLoop(7000, 1200);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.townGlint,
          {
            opacity: glint.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, 0.48, 0] }),
            transform: [{ translateX: glint.interpolate({ inputRange: [0, 1], outputRange: [-40, 330] }) }, { rotate: '14deg' }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.passer,
          {
            opacity: passer.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.13, 0.13, 0] }),
            transform: [{ translateX: passer.interpolate({ inputRange: [0, 1], outputRange: [-70, 470] }) }],
          },
        ]}
      />
    </View>
  );
}

export function TownScene({ hour, bandHeight = 620, groundY }: { hour: number; bandHeight?: number; groundY?: number }) {
  const band = skyBand(hour);
  const night = band === 'night';
  const ground = groundY ?? bandHeight * 0.72;
  const plazaTop = ground - 92;
  const roof = Math.max(120, plazaTop - 245);
  const sidewalk = night ? DIORAMA.townSidewalkNight : DIORAMA.townSidewalkDay;
  const sidewalkLight = night ? DIORAMA.townSidewalkNightEdge : DIORAMA.townSidewalkDayLight;
  const sidewalkEdge = night ? DIORAMA.townSidewalkNightEdge : DIORAMA.townSidewalkDayEdge;

  return (
    <View style={styles.fill} pointerEvents="none">
      <LinearGradient colors={SKY[band]} style={styles.fill} />
      <SkyDetails band={band} />
      <Svg width="100%" height="100%" viewBox={`0 0 420 ${bandHeight}`} preserveAspectRatio="none" style={styles.fill}>
        <Storefront x={-12} y={roof + 42} width={150} height={212} base={night ? DIORAMA.townCoralNight : DIORAMA.townCoral} light={DIORAMA.townCoralLight} edge={DIORAMA.townCoralEdge} night={night} />
        <Storefront x={130} y={roof + 4} width={160} height={250} base={night ? DIORAMA.townBlueNight : DIORAMA.townBlue} light={DIORAMA.townBlueLight} edge={DIORAMA.townBlueEdge} night={night} />
        <Storefront x={281} y={roof + 34} width={151} height={220} base={night ? DIORAMA.townVioletNight : DIORAMA.townViolet} light={DIORAMA.townVioletLight} edge={DIORAMA.townVioletEdge} night={night} />

        <Rect x={0} y={plazaTop + 9} width={420} height={bandHeight - plazaTop} fill={sidewalkEdge} />
        <Rect x={0} y={plazaTop} width={420} height={bandHeight - plazaTop - 9} fill={sidewalk} />
        <Path d={`M0 ${plazaTop + 8} H420`} stroke={sidewalkLight} strokeWidth={7} opacity={night ? 0.24 : 0.58} />
        {[70, 150, 230, 310].map((x) => <Path key={x} d={`M${x} ${plazaTop} L${x + 44} ${bandHeight}`} stroke={sidewalkEdge} strokeWidth={2.2} opacity={0.26} />)}
        {[plazaTop + 57, plazaTop + 120].map((y) => <Path key={y} d={`M0 ${y} H420`} stroke={DIORAMA.white} strokeWidth={2} opacity={night ? 0.05 : 0.15} />)}
      </Svg>

      <View style={{ position: 'absolute', left: 33, top: plazaTop - 35 }}>
        <Svg width={58} height={65} viewBox="0 0 58 65">
          <Ellipse cx={29} cy={60} rx={22} ry={4} fill={DIORAMA.shadow} opacity={0.16} />
          <Path d="M11 31 H47 L42 58 H16 Z" fill={DIORAMA.planterEdge} />
          <Path d="M13 27 H45 L41 53 H17 Z" fill={DIORAMA.planter} />
          <Path d="M18 31 H40" stroke={DIORAMA.coralShine} strokeWidth={4} strokeLinecap="round" opacity={0.5} />
          <Circle cx={20} cy={22} r={8} fill={DIORAMA.flowerPink} />
          <Circle cx={36} cy={17} r={9} fill={DIORAMA.flowerYellow} />
          <Path d="M23 30 l-3-13 M33 30 l4-16" stroke={DIORAMA.mintDeep} strokeWidth={4} />
        </Svg>
      </View>
      <View style={{ position: 'absolute', right: 34, top: plazaTop - 36 }}>
        <Svg width={57} height={66} viewBox="0 0 57 66">
          <Ellipse cx={29} cy={61} rx={22} ry={4} fill={DIORAMA.shadow} opacity={0.16} />
          <Path d="M11 31 H47 L42 59 H16 Z" fill={DIORAMA.planterEdge} />
          <Path d="M13 27 H45 L41 54 H17 Z" fill={DIORAMA.planter} />
          <Circle cx={21} cy={20} r={9} fill={DIORAMA.flowerBlue} />
          <Circle cx={37} cy={18} r={8} fill={DIORAMA.flowerPink} />
          <Path d="M23 30 l-2-15 M34 30 l3-15" stroke={DIORAMA.mintDeep} strokeWidth={4} />
        </Svg>
      </View>
      <TownAmbient />
    </View>
  );
}

function BeachAmbient() {
  const tide = useLoop(2700);
  const gull = useLoop(7600, 900);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.foamFlash,
          {
            opacity: tide.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.23] }),
            transform: [{ translateY: tide.interpolate({ inputRange: [0, 1], outputRange: [-4, 7] }) }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.gull,
          {
            opacity: gull.interpolate({ inputRange: [0, 0.12, 0.88, 1], outputRange: [0, 0.48, 0.48, 0] }),
            transform: [
              { translateX: gull.interpolate({ inputRange: [0, 1], outputRange: [-42, 460] }) },
              { translateY: gull.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, -24, 5] }) },
            ],
          },
        ]}
      >
        <View style={styles.gullWingLeft} />
        <View style={styles.gullWingRight} />
      </Animated.View>
    </View>
  );
}

export function BeachScene({ hour, bandHeight = 620, groundY }: { hour: number; bandHeight?: number; groundY?: number }) {
  const band = skyBand(hour);
  const night = band === 'night';
  const ground = groundY ?? bandHeight * 0.72;
  const tide = ground - 118;
  const horizon = tide - 103;
  const oceanLight = night ? DIORAMA.oceanNightLight : DIORAMA.oceanDayLight;
  const oceanEdge = night ? DIORAMA.oceanNightEdge : DIORAMA.oceanDayEdge;
  const sandLight = night ? DIORAMA.sandNightLight : DIORAMA.sandDayLight;
  const sandEdge = night ? DIORAMA.sandNightEdge : DIORAMA.sandDayEdge;

  return (
    <View style={styles.fill} pointerEvents="none">
      <LinearGradient colors={SKY[band]} style={styles.fill} />
      <SkyDetails band={band} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: horizon + 8, height: tide - horizon + 32, backgroundColor: oceanEdge }} />
      <LinearGradient colors={night ? [DIORAMA.oceanNightA, DIORAMA.oceanNightB] : [DIORAMA.oceanDayA, DIORAMA.oceanDayB]} style={{ position: 'absolute', left: 0, right: 0, top: horizon, height: tide - horizon + 27 }} />
      <View style={{ position: 'absolute', left: 26, right: 26, top: horizon + 12, height: 7, borderRadius: radius.pill, backgroundColor: oceanLight, opacity: night ? 0.18 : 0.34 }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: tide + 8, bottom: 0, backgroundColor: sandEdge }} />
      <LinearGradient colors={night ? [DIORAMA.sandNightFar, DIORAMA.sandNightNear] : [DIORAMA.sandDayFar, DIORAMA.sandDayNear]} style={{ position: 'absolute', left: 0, right: 0, top: tide, bottom: 0 }} />

      <Svg width="100%" height="100%" viewBox={`0 0 420 ${bandHeight}`} preserveAspectRatio="none" style={styles.fill}>
        <Path d={`M-15 ${tide + 7} Q52 ${tide - 11} 115 ${tide + 6} T238 ${tide + 5} T358 ${tide + 4} T440 ${tide + 5}`} stroke={night ? DIORAMA.foamNightShade : DIORAMA.foamDayShade} strokeWidth={15} fill="none" opacity={0.85} />
        <Path d={`M-15 ${tide} Q52 ${tide - 17} 115 ${tide} T238 ${tide - 2} T358 ${tide - 3} T440 ${tide - 2}`} stroke={night ? DIORAMA.foamNight : DIORAMA.foamDay} strokeWidth={9} fill="none" />
        <Path d={`M4 ${tide - 43} Q76 ${tide - 57} 151 ${tide - 43} T305 ${tide - 44} T430 ${tide - 43}`} stroke={oceanLight} strokeWidth={6} fill="none" opacity={night ? 0.2 : 0.46} />
        <Path d={`M72 ${ground + 63} Q210 ${ground + 85} 357 ${ground + 63}`} stroke={sandLight} strokeWidth={5} fill="none" opacity={night ? 0.1 : 0.34} />
        <Path d={`M329 ${ground + 50} l8 14 l-15 -4 l13 -8 l-3 15`} stroke={DIORAMA.starfish} strokeWidth={6} fill="none" strokeLinecap="round" />
      </Svg>

      <View style={{ position: 'absolute', right: -17, top: ground - 155 }}>
        <Svg width={120} height={168} viewBox="0 0 120 168">
          <Ellipse cx={63} cy={160} rx={35} ry={5} fill={DIORAMA.shadow} opacity={0.15} />
          <Path d="M61 58 V153" stroke={DIORAMA.woodWarm} strokeWidth={7} strokeLinecap="round" />
          <Path d="M10 62 Q58 -8 110 62 Z" fill={DIORAMA.coralDeep} />
          <Path d="M10 55 Q58 -15 110 55 Z" fill={DIORAMA.coral} />
          <Path d="M26 49 Q58 0 91 49 Z" fill={DIORAMA.lemon} />
          <Path d="M27 42 Q57 3 88 44" stroke={DIORAMA.white} strokeWidth={5} strokeLinecap="round" opacity={0.4} />
        </Svg>
      </View>
      <View style={{ position: 'absolute', left: -24, top: ground - 74 }}>
        <Svg width={132} height={124} viewBox="0 0 132 124">
          <Ellipse cx={52} cy={112} rx={69} ry={25} fill={night ? DIORAMA.sandNightFar : DIORAMA.sandDayFar} />
          {[22, 39, 58, 76, 94].map((x, i) => (
            <Path key={x} d={`M${x} 112 Q${x + (i % 2 ? 14 : -9)} 78 ${x + (i % 3) * 6 - 2} 43`} stroke={night ? DIORAMA.grassBeachNight : DIORAMA.grassBeachDay} strokeWidth={6 - (i % 2)} fill="none" strokeLinecap="round" />
          ))}
        </Svg>
      </View>
      <BeachAmbient />
    </View>
  );
}

export function NightOverlay() {
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: DIORAMA.skyNightA, opacity: 0.12 }]} />;
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject },
  cloud: { position: 'absolute', left: 54, top: 124, width: 140, height: 40 },
  cloudPuff: { position: 'absolute', top: 0, height: 27, borderRadius: 30, backgroundColor: DIORAMA.white },
  homeGleam: { position: 'absolute', left: 37, top: 252, width: 112, height: 190, borderRadius: 80, backgroundColor: DIORAMA.goldLight, transform: [{ rotate: '-12deg' }] },
  dust: { position: 'absolute', left: 112, top: 280, width: 7, height: 7, borderRadius: 7, backgroundColor: DIORAMA.white },
  floatingLeaf: { position: 'absolute', left: 88, top: 245, width: 12, height: 7, borderTopLeftRadius: 12, borderBottomRightRadius: 12, backgroundColor: DIORAMA.parkTreeDayLight },
  butterfly: { position: 'absolute', left: 0, top: 260, width: 18, height: 12 },
  butterflyWingLeft: { position: 'absolute', left: 0, width: 10, height: 10, borderRadius: 8, backgroundColor: DIORAMA.violetLight, transform: [{ rotate: '-28deg' }] },
  butterflyWingRight: { position: 'absolute', right: 0, width: 10, height: 10, borderRadius: 8, backgroundColor: DIORAMA.coralLight, transform: [{ rotate: '28deg' }] },
  townGlint: { position: 'absolute', left: 46, top: 228, width: 22, height: 150, borderRadius: radius.pill, backgroundColor: DIORAMA.white },
  passer: { position: 'absolute', left: 0, top: 388, width: 36, height: 62, borderRadius: 20, backgroundColor: DIORAMA.shadow },
  foamFlash: { position: 'absolute', left: 42, right: 42, top: 387, height: 9, borderRadius: radius.pill, backgroundColor: DIORAMA.white },
  gull: { position: 'absolute', left: 0, top: 166, width: 26, height: 14 },
  gullWingLeft: { position: 'absolute', left: 0, top: 5, width: 15, height: 3, borderRadius: 4, backgroundColor: DIORAMA.inkSoft, transform: [{ rotate: '-22deg' }] },
  gullWingRight: { position: 'absolute', right: 0, top: 5, width: 15, height: 3, borderRadius: 4, backgroundColor: DIORAMA.inkSoft, transform: [{ rotate: '22deg' }] },
});
