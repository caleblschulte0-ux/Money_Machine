import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient as RNGradient } from 'expo-linear-gradient';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient as SvgLinearGradient,
  Path,
  RadialGradient,
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

/** A restrained floor light that welds the photographic hero to the scene. */
function StageLight({ y, night, warm = false }: { y: number; night: boolean; warm?: boolean }) {
  const id = `stage-${night ? 'night' : 'day'}-${warm ? 'warm' : 'cool'}`;
  const light = warm ? DIORAMA.goldLight : DIORAMA.white;
  const canvasHeight = Math.max(760, y + 160);
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 420 ${canvasHeight}`} preserveAspectRatio="none" style={styles.fill}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={light} stopOpacity={night ? 0.13 : 0.24} />
          <Stop offset="0.58" stopColor={light} stopOpacity={night ? 0.05 : 0.09} />
          <Stop offset="1" stopColor={DIORAMA.shadow} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={210} cy={y + 56} rx={184} ry={112} fill={`url(#${id})`} />
    </Svg>
  );
}

/**
 * Deterministic surface breakup. These marks are deliberately drawn by the
 * renderer instead of baked into a scene bitmap, so every ground plane can
 * keep its own perspective, tint and time-of-day treatment.
 */
function SurfaceGrain({ fromY, canvasHeight, color, night }: { fromY: number; canvasHeight: number; color: string; night: boolean }) {
  const span = Math.max(120, canvasHeight - fromY);
  return (
    <Svg width="100%" height="100%" viewBox={`0 0 420 ${canvasHeight}`} preserveAspectRatio="none" style={styles.fill}>
      {Array.from({ length: 34 }, (_, i) => {
        const depth = (i % 9) / 8;
        const x = (i * 97 + (i % 4) * 29) % 430 - 5;
        const y = fromY + 18 + ((i * 71) % Math.max(40, span - 30));
        const width = 2.5 + depth * 8;
        return (
          <Path
            key={i}
            d={`M${x} ${y}q${width * 0.55} ${1 + depth * 2} ${width} 0`}
            stroke={color}
            strokeWidth={1 + depth * 1.25}
            strokeLinecap="round"
            opacity={(night ? 0.055 : 0.1) + depth * 0.045}
          />
        );
      })}
    </Svg>
  );
}

function Sky({ band, compact = false }: { band: SkyBand; compact?: boolean }) {
  const night = band === 'night';
  const cloudA = useLoop(12000);
  const cloudB = useLoop(15500, 800);
  return (
    <View style={styles.fill} pointerEvents="none">
      <RNGradient colors={SKY[band]} style={styles.fill} />
      <Svg width="100%" height="100%" viewBox="0 0 420 760" preserveAspectRatio="none" style={styles.fill}>
        <Defs>
          <SvgLinearGradient id="sunGlow" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={DIORAMA.goldLight} stopOpacity={0.88} />
            <Stop offset="1" stopColor={DIORAMA.lemon} stopOpacity={0.35} />
          </SvgLinearGradient>
        </Defs>
        {night ? (
          <>
            <Circle cx={343} cy={compact ? 82 : 105} r={34} fill={DIORAMA.goldLight} opacity={0.92} />
            <Circle cx={331} cy={compact ? 71 : 94} r={31} fill={DIORAMA.skyNightA} />
            {[29, 68, 116, 177, 230, 285, 385].map((x, i) => (
              <Circle key={x} cx={x} cy={52 + (i % 4) * 31} r={i % 3 === 0 ? 2.2 : 1.5} fill={DIORAMA.paleCream} opacity={0.82} />
            ))}
          </>
        ) : (
          <>
            <Circle cx={341} cy={compact ? 78 : 104} r={48} fill="url(#sunGlow)" opacity={0.36} />
            <Circle cx={341} cy={compact ? 78 : 104} r={29} fill={DIORAMA.lemon} />
            <Path d={`M326 ${compact ? 68 : 94}Q341 ${compact ? 60 : 86} 355 ${compact ? 69 : 95}`} stroke={DIORAMA.white} strokeWidth={6} strokeLinecap="round" opacity={0.48} />
          </>
        )}
      </Svg>
      <Animated.View style={[styles.cloud, { top: compact ? 28 : 74, left: -12, transform: [{ translateX: cloudA.interpolate({ inputRange: [0, 1], outputRange: [-12, 42] }) }] }]}>
        <View style={[styles.cloudPuff, { width: 72, height: 27, left: 0, top: 15, opacity: night ? 0.1 : 0.83 }]} />
        <View style={[styles.cloudPuff, { width: 62, height: 42, left: 40, top: 0, opacity: night ? 0.1 : 0.92 }]} />
        <View style={[styles.cloudPuff, { width: 70, height: 28, left: 78, top: 14, opacity: night ? 0.1 : 0.84 }]} />
        <View style={[styles.cloudShade, { left: 24, top: 34, width: 105 }]} />
      </Animated.View>
      <Animated.View style={[styles.cloud, { top: compact ? 116 : 155, right: 10, transform: [{ translateX: cloudB.interpolate({ inputRange: [0, 1], outputRange: [24, -34] }) }, { scale: 0.64 }] }]}>
        <View style={[styles.cloudPuff, { width: 72, height: 27, left: 0, top: 15, opacity: night ? 0.08 : 0.73 }]} />
        <View style={[styles.cloudPuff, { width: 62, height: 42, left: 40, top: 0, opacity: night ? 0.08 : 0.82 }]} />
        <View style={[styles.cloudPuff, { width: 70, height: 28, left: 78, top: 14, opacity: night ? 0.08 : 0.74 }]} />
        <View style={[styles.cloudShade, { left: 24, top: 34, width: 105 }]} />
      </Animated.View>
    </View>
  );
}

function Window({ band, upgraded }: { band: SkyBand; upgraded: boolean }) {
  const night = band === 'night';
  const width = upgraded ? 176 : 158;
  const edge = night ? DIORAMA.windowFrameNightEdge : DIORAMA.windowFrameDayEdge;
  const frame = night ? DIORAMA.windowFrameNight : DIORAMA.windowFrameDay;
  return (
    <View style={{ width: width + 16, height: 146 }}>
      <View style={[styles.contact, { left: 9, right: 1, bottom: 0, height: 14 }]} />
      <View style={{ width, height: 130, borderRadius: radius.xl, borderWidth: 10, borderColor: edge, overflow: 'hidden', backgroundColor: frame }}>
        <RNGradient colors={SKY[band]} style={styles.fill} />
        <Svg width="100%" height="100%" viewBox="0 0 160 120" preserveAspectRatio="none">
          <Defs>
            <SvgLinearGradient id="windowHill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={night ? DIORAMA.hillNight : DIORAMA.parkHillDayLight} />
              <Stop offset="1" stopColor={night ? DIORAMA.parkHillNight : DIORAMA.parkHillDay} />
            </SvgLinearGradient>
          </Defs>
          {night ? (
            <><Circle cx={126} cy={27} r={15} fill={DIORAMA.goldLight} /><Circle cx={119} cy={21} r={14} fill={DIORAMA.skyNightA} /></>
          ) : <Circle cx={128} cy={27} r={17} fill={DIORAMA.lemon} />}
          <Path d="M-4 88Q35 61 76 82Q111 99 164 73V124H-4Z" fill="url(#windowHill)" />
          <Path d="M15 13Q56 2 96 15" stroke={DIORAMA.white} strokeWidth={9} strokeLinecap="round" opacity={0.46} />
        </Svg>
        <View style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 7, marginLeft: -3.5, backgroundColor: frame }} />
        <View style={{ position: 'absolute', top: '54%', left: 0, right: 0, height: 7, backgroundColor: frame }} />
      </View>
      <View style={{ position: 'absolute', left: -7, right: 10, bottom: 2, height: 16, borderRadius: radius.md, backgroundColor: edge }} />
      <View style={{ position: 'absolute', left: 3, right: 20, bottom: 9, height: 6, borderRadius: radius.pill, backgroundColor: DIORAMA.white, opacity: night ? 0.1 : 0.42 }} />
    </View>
  );
}

function SideCabinet({ night }: { night: boolean }) {
  const body = night ? DIORAMA.woodDark : DIORAMA.woodWarm;
  return (
    <Svg width={110} height={146} viewBox="0 0 110 146">
      <Defs>
        <SvgLinearGradient id="cab" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={DIORAMA.woodShine} />
          <Stop offset={0.18} stopColor={body} />
          <Stop offset="1" stopColor={DIORAMA.woodDeep} />
        </SvgLinearGradient>
      </Defs>
      <Ellipse cx={55} cy={139} rx={48} ry={7} fill={DIORAMA.shadow} opacity={0.2} />
      <Rect x={7} y={15} width={96} height={119} rx={22} fill={DIORAMA.woodDeep} />
      <Rect x={4} y={7} width={96} height={119} rx={22} fill="url(#cab)" />
      <Path d="M17 18H84" stroke={DIORAMA.white} strokeWidth={7} strokeLinecap="round" opacity={night ? 0.08 : 0.3} />
      <Rect x={15} y={38} width={74} height={31} rx={11} fill={night ? DIORAMA.wallNightA : DIORAMA.cream} opacity={0.87} />
      <Rect x={15} y={78} width={74} height={31} rx={11} fill={night ? DIORAMA.wallNightA : DIORAMA.cream} opacity={0.82} />
      <Circle cx={77} cy={54} r={4} fill={DIORAMA.goldLight} />
      <Circle cx={77} cy={94} r={4} fill={DIORAMA.goldLight} />
      <Circle cx={28} cy={2} r={15} fill={DIORAMA.aqua} />
      <Path d="M20 0Q29-15 38 0" stroke={DIORAMA.mintDeep} strokeWidth={6} strokeLinecap="round" />
    </Svg>
  );
}

function Sofa({ night }: { night: boolean }) {
  const body = night ? DIORAMA.couchNight : DIORAMA.couchDay;
  const top = night ? DIORAMA.couchNightTop : DIORAMA.couchDayTop;
  const edge = night ? DIORAMA.couchNightEdge : DIORAMA.couchDayEdge;
  return (
    <Svg width={185} height={122} viewBox="0 0 185 122">
      <Defs>
        <SvgLinearGradient id="sofaBody" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={top} />
          <Stop offset={0.26} stopColor={body} />
          <Stop offset="1" stopColor={edge} />
        </SvgLinearGradient>
      </Defs>
      <Ellipse cx={92} cy={114} rx={78} ry={8} fill={DIORAMA.shadow} opacity={0.23} />
      <Rect x={18} y={20} width={149} height={76} rx={31} fill={edge} />
      <Rect x={18} y={10} width={149} height={76} rx={31} fill="url(#sofaBody)" />
      <Rect x={0} y={47} width={42} height={54} rx={20} fill={edge} />
      <Rect x={143} y={47} width={42} height={54} rx={20} fill={edge} />
      <Rect x={4} y={39} width={38} height={54} rx={19} fill={body} />
      <Rect x={143} y={39} width={38} height={54} rx={19} fill={body} />
      <Rect x={31} y={68} width={58} height={29} rx={13} fill={night ? DIORAMA.couchNightSeat : DIORAMA.couchDaySeat} />
      <Rect x={95} y={68} width={58} height={29} rx={13} fill={night ? DIORAMA.couchNightSeat : DIORAMA.couchDaySeat} />
      <Rect x={40} y={35} width={34} height={35} rx={11} fill={DIORAMA.lemon} transform="rotate(-8 57 52)" />
      <Rect x={106} y={37} width={34} height={33} rx={11} fill={DIORAMA.aquaLight} transform="rotate(7 123 53)" />
      <Path d="M29 22Q88 7 152 24" stroke={DIORAMA.white} strokeWidth={7} strokeLinecap="round" opacity={night ? 0.1 : 0.38} />
    </Svg>
  );
}

function Lamp({ night }: { night: boolean }) {
  const glow = useLoop(2500);
  return (
    <View style={{ width: 82, height: 172 }}>
      {night && <Animated.View style={[styles.lampGlow, { opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.13, 0.28] }) }]} />}
      <Svg width={82} height={172} viewBox="0 0 82 172">
        <Defs>
          <SvgLinearGradient id="lampShade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={DIORAMA.goldLight} />
            <Stop offset="1" stopColor={DIORAMA.goldDeep} />
          </SvgLinearGradient>
        </Defs>
        <Ellipse cx={41} cy={164} rx={29} ry={7} fill={DIORAMA.shadow} opacity={0.22} />
        <Rect x={37} y={52} width={8} height={99} rx={4} fill={DIORAMA.woodDeep} />
        <Path d="M40 58V142" stroke={DIORAMA.woodShine} strokeWidth={3} strokeLinecap="round" opacity={0.38} />
        <Ellipse cx={41} cy={155} rx={23} ry={7} fill={DIORAMA.woodDark} />
        <Path d="M13 12H67L75 51H6Z" fill="url(#lampShade)" />
        <Path d="M20 16H58" stroke={DIORAMA.white} strokeWidth={6} strokeLinecap="round" opacity={0.47} />
      </Svg>
    </View>
  );
}

function WallPortrait({ night }: { night: boolean }) {
  return (
    <Svg width={84} height={82} viewBox="0 0 84 82">
      <Rect x={8} y={10} width={70} height={68} rx={18} fill={DIORAMA.woodDeep} opacity={0.28} />
      <Rect x={4} y={4} width={70} height={68} rx={18} fill={night ? DIORAMA.woodDark : DIORAMA.woodWarm} />
      <Rect x={11} y={11} width={56} height={53} rx={13} fill={night ? DIORAMA.wallNightB : DIORAMA.cream} />
      <Path d="M16 15H57" stroke={DIORAMA.white} strokeWidth={6} strokeLinecap="round" opacity={night ? 0.12 : 0.45} />
      <Ellipse cx={39} cy={39} rx={19} ry={17} fill={DIORAMA.gold} />
      <Ellipse cx={39} cy={40} rx={11} ry={9} fill={DIORAMA.cream} />
      <Circle cx={32} cy={35} r={2.5} fill={DIORAMA.inkSoft} />
      <Circle cx={46} cy={35} r={2.5} fill={DIORAMA.inkSoft} />
    </Svg>
  );
}

function HomeLife({ night }: { night: boolean }) {
  const mote = useLoop(5200, 400);
  const beam = useLoop(3900);
  return (
    <View style={styles.fill} pointerEvents="none">
      <Animated.View style={[styles.homeBeam, { opacity: beam.interpolate({ inputRange: [0, 1], outputRange: [night ? 0.01 : 0.04, night ? 0.035 : 0.11] }) }]} />
      <Animated.View style={[styles.homeMote, { opacity: mote.interpolate({ inputRange: [0, .12, .88, 1], outputRange: [0, .42, .42, 0] }), transform: [{ translateX: mote.interpolate({ inputRange: [0, 1], outputRange: [-20, 70] }) }, { translateY: mote.interpolate({ inputRange: [0, 1], outputRange: [25, -50] }) }] }]} />
    </View>
  );
}

export function HomeScene({ hour, upgrades = [], asleep = false, groundY, chromeBottom }: { hour: number; upgrades?: string[]; asleep?: boolean; groundY: number; chromeBottom: number }) {
  const band = skyBand(hour);
  const night = band === 'night' || asleep;
  const has = (id: string) => upgrades.includes(id);
  const floorTop = Math.max(chromeBottom + 174, groundY - 132);
  const trim = night ? DIORAMA.wallNightEdge : DIORAMA.wallDayEdge;
  const floorEdge = night ? DIORAMA.floorNightEdge : DIORAMA.floorDayEdge;
  return (
    <View style={styles.fill} pointerEvents="none">
      <RNGradient colors={night ? [DIORAMA.wallNightA, DIORAMA.wallNightB] : [DIORAMA.wallDayA, DIORAMA.wallDayB]} style={[styles.fill, { bottom: undefined, height: floorTop }]} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: chromeBottom + 33, height: 12, backgroundColor: DIORAMA.white, opacity: night ? 0.025 : 0.11 }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: floorTop - 28, height: 28, backgroundColor: trim }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: floorTop - 23, height: 7, backgroundColor: DIORAMA.white, opacity: night ? 0.04 : 0.28 }} />
      <RNGradient colors={night ? [DIORAMA.floorNightFar, DIORAMA.floorNightNear] : [DIORAMA.floorDayFar, DIORAMA.floorDayNear]} style={{ position: 'absolute', left: 0, right: 0, top: floorTop, bottom: 0 }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: floorTop, height: 12, backgroundColor: floorEdge, opacity: night ? 0.58 : 0.72 }} />
      <Svg width="100%" height="100%" viewBox="0 0 420 760" preserveAspectRatio="none" style={styles.fill}>
        <Rect x={224} y={chromeBottom + 63} width={172} height={145} rx={24} fill="none" stroke={trim} strokeWidth={5} opacity={night ? 0.12 : 0.32} />
        <Path d={`M239 ${chromeBottom + 78}H378`} stroke={DIORAMA.white} strokeWidth={4} strokeLinecap="round" opacity={night ? 0.03 : 0.16} />
        <Path d={`M30 ${floorTop - 3}L154 760H240L128 ${floorTop - 3}Z`} fill={DIORAMA.goldLight} opacity={night ? 0.015 : 0.055} />
        <Path d={`M210 ${chromeBottom + 46}V${floorTop}L248 760`} stroke={trim} strokeWidth={4} opacity={night ? 0.12 : 0.24} />
        <Path d={`M0 ${floorTop - 13}Q210 ${floorTop - 1} 420 ${floorTop - 13}`} stroke={DIORAMA.white} strokeWidth={4} opacity={night ? 0.025 : 0.13} />
        {[48, 126, 207, 291, 373].map((x) => <Path key={x} d={`M${x} ${floorTop}L${210 + (x - 210) * 1.7} 760`} stroke={floorEdge} strokeWidth={2.6} opacity={night ? 0.14 : 0.27} />)}
        {[floorTop + 52, floorTop + 111, floorTop + 179].map((y) => <Path key={y} d={`M0 ${y}H420`} stroke={floorEdge} strokeWidth={2.2} opacity={night ? 0.11 : 0.19} />)}
      </Svg>
      <SurfaceGrain fromY={floorTop} canvasHeight={760} color={floorEdge} night={night} />
      <HomeObjectLayer band={band} night={night} floorTop={floorTop} chromeBottom={chromeBottom} has={has} />
      <StageLight y={groundY} night={night} warm />
      <HomeLife night={night} />
    </View>
  );
}

/** Every room object owns its own draw call and z-position. */
function HomeObjectLayer({ band, night, floorTop, chromeBottom, has }: { band: SkyBand; night: boolean; floorTop: number; chromeBottom: number; has: (id: string) => boolean }) {
  return (
    <View style={styles.fill}>
      <View style={{ position: 'absolute', left: 22, top: chromeBottom + 70 }}><Window band={band} upgraded={has('home_window')} /></View>
      <View style={{ position: 'absolute', right: 18, top: chromeBottom + 60 }}><WallPortrait night={night} /></View>
      <View style={{ position: 'absolute', right: -8, top: floorTop - 105 }}><Sofa night={night} /></View>
      <View style={{ position: 'absolute', left: 9, top: floorTop - 142 }}><Lamp night={night} /></View>
      <View style={{ position: 'absolute', right: 32, top: floorTop - 235 }}><SideCabinet night={night} /></View>
      {has('home_rug') && <View style={styles.rug}><RNGradient colors={[DIORAMA.violetLight, DIORAMA.violet, DIORAMA.violetDeep]} style={styles.rugInner} /></View>}
      {has('home_bed') && (
        <Svg width={112} height={64} viewBox="0 0 112 64" style={{ position: 'absolute', left: 35, top: floorTop + 38 }}>
          <Ellipse cx={56} cy={58} rx={48} ry={6} fill={DIORAMA.shadow} opacity={0.18} />
          <Ellipse cx={56} cy={37} rx={49} ry={21} fill={DIORAMA.bedEdge} />
          <Ellipse cx={56} cy={30} rx={47} ry={20} fill={DIORAMA.bedWall} />
          <Ellipse cx={56} cy={37} rx={34} ry={12} fill={DIORAMA.bedCushion} />
          <Path d="M22 23Q56 10 91 23" stroke={DIORAMA.white} strokeWidth={6} strokeLinecap="round" opacity={0.36} />
        </Svg>
      )}
    </View>
  );
}

function Tree({ night, scale = 1, flip = false }: { night: boolean; scale?: number; flip?: boolean }) {
  const base = night ? DIORAMA.parkTreeNight : DIORAMA.parkTreeDay;
  const light = night ? DIORAMA.parkTreeNightLight : DIORAMA.parkTreeDayLight;
  const edge = night ? DIORAMA.parkTreeNightEdge : DIORAMA.parkTreeDayEdge;
  return (
    <Svg width={170 * scale} height={230 * scale} viewBox="0 0 170 230" style={flip ? { transform: [{ scaleX: -1 }] } : undefined}>
      <Defs>
        <SvgLinearGradient id={`tree${night ? 'N' : 'D'}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={light} />
          <Stop offset={0.45} stopColor={base} />
          <Stop offset="1" stopColor={edge} />
        </SvgLinearGradient>
        <RadialGradient id="treeOrb" cx="31%" cy="24%" r="74%">
          <Stop offset="0" stopColor={DIORAMA.white} stopOpacity={night ? 0.08 : 0.42} />
          <Stop offset="0.2" stopColor={light} />
          <Stop offset="0.7" stopColor={base} />
          <Stop offset="1" stopColor={edge} />
        </RadialGradient>
        <SvgLinearGradient id="treeTrunk" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={DIORAMA.woodDeep} />
          <Stop offset="0.42" stopColor={DIORAMA.woodWarm} />
          <Stop offset="0.72" stopColor={DIORAMA.woodDark} />
          <Stop offset="1" stopColor={DIORAMA.woodDeep} />
        </SvgLinearGradient>
      </Defs>
      <Ellipse cx={84} cy={222} rx={55} ry={8} fill={DIORAMA.shadow} opacity={0.17} />
      <Path d="M68 82Q67 145 55 213H112Q99 145 95 82Z" fill="url(#treeTrunk)" />
      <Path d="M76 93Q76 145 67 194" stroke={DIORAMA.woodShine} strokeWidth={8} strokeLinecap="round" opacity={0.32} />
      <Circle cx={79} cy={65} r={58} fill="url(#treeOrb)" />
      <Circle cx={40} cy={72} r={35} fill="url(#treeOrb)" />
      <Circle cx={126} cy={75} r={37} fill="url(#treeOrb)" />
      <Circle cx={80} cy={31} r={38} fill="url(#treeOrb)" />
      <Circle cx={42} cy={36} r={25} fill="url(#treeOrb)" />
      <Circle cx={119} cy={41} r={27} fill="url(#treeOrb)" />
      <Path d="M29 39Q75 2 126 36" stroke={DIORAMA.white} strokeWidth={10} strokeLinecap="round" opacity={night ? 0.06 : 0.28} />
      <Path d="M23 87Q78 111 140 84" stroke={edge} strokeWidth={9} strokeLinecap="round" opacity={0.3} />
      <Path d="M59 53q9-9 18-2M100 69q10-8 18 0M51 88q8-6 14-1" stroke={light} strokeWidth={4} strokeLinecap="round" opacity={night ? 0.12 : 0.42} />
    </Svg>
  );
}

function Bush({ night, width = 128 }: { night: boolean; width?: number }) {
  const base = night ? DIORAMA.parkTreeNight : DIORAMA.parkTreeDay;
  const light = night ? DIORAMA.parkTreeNightLight : DIORAMA.parkTreeDayLight;
  const edge = night ? DIORAMA.parkTreeNightEdge : DIORAMA.parkTreeDayEdge;
  return (
    <Svg width={width} height={72} viewBox="0 0 128 72">
      <Defs>
        <RadialGradient id="bushOrb" cx="30%" cy="20%" r="78%">
          <Stop offset="0" stopColor={DIORAMA.white} stopOpacity={night ? 0.06 : 0.34} />
          <Stop offset="0.22" stopColor={light} />
          <Stop offset="0.72" stopColor={base} />
          <Stop offset="1" stopColor={edge} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={64} cy={66} rx={56} ry={5} fill={DIORAMA.shadow} opacity={0.13} />
      <Circle cx={26} cy={42} r={25} fill="url(#bushOrb)" /><Circle cx={54} cy={30} r={31} fill="url(#bushOrb)" /><Circle cx={88} cy={33} r={29} fill="url(#bushOrb)" /><Circle cx={108} cy={45} r={21} fill="url(#bushOrb)" />
      <Circle cx={52} cy={21} r={19} fill="url(#bushOrb)" /><Circle cx={87} cy={23} r={16} fill="url(#bushOrb)" />
      <Path d="M31 29Q57 10 83 19" stroke={DIORAMA.white} strokeWidth={6} strokeLinecap="round" opacity={night ? 0.05 : 0.28} />
    </Svg>
  );
}

function Bench({ night }: { night: boolean }) {
  return (
    <Svg width={126} height={88} viewBox="0 0 126 88">
      <Ellipse cx={63} cy={82} rx={49} ry={6} fill={DIORAMA.shadow} opacity={0.18} />
      <Rect x={10} y={23} width={106} height={20} rx={10} fill={DIORAMA.woodDeep} />
      <Rect x={10} y={15} width={106} height={20} rx={10} fill={DIORAMA.woodWarm} />
      <Path d="M21 20H103" stroke={DIORAMA.white} strokeWidth={5} strokeLinecap="round" opacity={night ? 0.07 : 0.35} />
      <Rect x={15} y={48} width={96} height={17} rx={8} fill={DIORAMA.woodDark} />
      <Rect x={15} y={42} width={96} height={17} rx={8} fill={DIORAMA.woodMid} />
      <Rect x={24} y={58} width={11} height={23} rx={5} fill={DIORAMA.woodDeep} />
      <Rect x={92} y={58} width={11} height={23} rx={5} fill={DIORAMA.woodDeep} />
    </Svg>
  );
}

function ParkLife({ night }: { night: boolean }) {
  const leaf = useLoop(5000);
  const butterfly = useLoop(7800, 600);
  return (
    <View style={styles.fill} pointerEvents="none">
      <Animated.View style={[styles.leaf, { opacity: night ? 0.14 : 0.73, transform: [{ translateX: leaf.interpolate({ inputRange: [0, 1], outputRange: [-30, 180] }) }, { translateY: leaf.interpolate({ inputRange: [0, 1], outputRange: [0, 48] }) }, { rotate: leaf.interpolate({ inputRange: [0, 1], outputRange: ['-20deg', '170deg'] }) }] }]} />
      <Animated.View style={[styles.butterfly, { opacity: butterfly.interpolate({ inputRange: [0, .1, .9, 1], outputRange: [0, night ? 0.2 : .9, night ? 0.2 : .9, 0] }), transform: [{ translateX: butterfly.interpolate({ inputRange: [0, 1], outputRange: [-22, 430] }) }, { translateY: butterfly.interpolate({ inputRange: [0, .5, 1], outputRange: [10, -34, 6] }) }] }]}><View style={styles.butterflyL} /><View style={styles.butterflyR} /></Animated.View>
    </View>
  );
}

export function ParkScene({ hour, bandHeight = 620, groundY }: { hour: number; bandHeight?: number; groundY?: number }) {
  const band = skyBand(hour);
  const night = band === 'night';
  const ground = groundY ?? bandHeight * 0.72;
  // `groundY` is measured in real screen pixels. The previous V2 mixed that
  // value with a shorter SVG viewBox (`bandHeight`) and React Native stretched
  // the art vertically. On a 390x844 phone that turned a deliberate 100px sky
  // break into almost half a screen of blue. `ground + 264` tracks the real
  // viewport at every supported phone height (640 -> 640, 844 -> 844), so the
  // scenery now lands where the composition says it should.
  const canvasHeight = ground + 264;
  // The HUD's soft top scrim visually erases low-contrast scenery until about
  // y=190. Anchor the park itself above that fade instead of letting the
  // ground calculation push the treeline into the middle of the phone.
  const hillY = Math.max(138, Math.min(166, ground - 480));
  const grass = night ? DIORAMA.parkGrassNight : DIORAMA.parkGrassDay;
  const grassLight = night ? DIORAMA.parkGrassNightLight : DIORAMA.parkGrassDayLight;
  const grassEdge = night ? DIORAMA.parkGrassNightEdge : DIORAMA.parkGrassDayEdge;
  const path = night ? DIORAMA.parkPathNight : DIORAMA.parkPathDay;
  const pathLight = night ? DIORAMA.parkPathNightLight : DIORAMA.parkPathDayLight;
  const pathEdge = night ? DIORAMA.parkPathNightEdge : DIORAMA.parkPathDayEdge;
  return (
    <View style={styles.fill} pointerEvents="none">
      <Sky band={band} compact />
      <Svg width="100%" height="100%" viewBox={`0 0 420 ${canvasHeight}`} preserveAspectRatio="none" style={styles.fill}>
        <Defs>
          <SvgLinearGradient id="parkGrass" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={grassLight} /><Stop offset={0.25} stopColor={grass} /><Stop offset="1" stopColor={grassEdge} /></SvgLinearGradient>
          <SvgLinearGradient id="parkPath" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={pathLight} /><Stop offset={0.3} stopColor={path} /><Stop offset="1" stopColor={pathEdge} /></SvgLinearGradient>
        </Defs>
        <Path d={`M-30 ${hillY + 94}Q55 ${hillY + 17} 136 ${hillY + 65}Q205 ${hillY + 103} 278 ${hillY + 48}Q350 ${hillY + 9} 455 ${hillY + 72}V${canvasHeight}H-30Z`} fill={grassEdge} />
        <Path d={`M-30 ${hillY + 82}Q55 ${hillY + 5} 136 ${hillY + 53}Q205 ${hillY + 91} 278 ${hillY + 36}Q350 ${hillY - 3} 455 ${hillY + 60}V${canvasHeight}H-30Z`} fill={night ? DIORAMA.parkHillNight : DIORAMA.parkHillDay} />
        <Path d={`M-20 ${hillY + 114}Q96 ${hillY + 59} 214 ${hillY + 94}Q317 ${hillY + 122} 448 ${hillY + 68}V${canvasHeight}H-20Z`} fill={grassEdge} />
        <Path d={`M-20 ${hillY + 103}Q96 ${hillY + 48} 214 ${hillY + 83}Q317 ${hillY + 111} 448 ${hillY + 57}V${canvasHeight}H-20Z`} fill="url(#parkGrass)" />
        <Path d={`M194 ${hillY + 75}C202 ${hillY + 130} 158 ${ground + 45} 96 ${canvasHeight}H326C267 ${ground + 46} 223 ${hillY + 130} 230 ${hillY + 75}Z`} fill={pathEdge} />
        <Path d={`M201 ${hillY + 74}C209 ${hillY + 127} 175 ${ground + 38} 122 ${canvasHeight}H299C250 ${ground + 39} 216 ${hillY + 128} 223 ${hillY + 74}Z`} fill="url(#parkPath)" />
        <Path d={`M209 ${hillY + 87}C214 ${hillY + 138} 190 ${ground + 29} 151 ${canvasHeight}`} stroke={DIORAMA.white} strokeWidth={6} fill="none" opacity={night ? 0.05 : 0.24} />
        <Path d={`M18 ${hillY + 118}Q94 ${hillY + 91} 162 ${hillY + 112}`} stroke={DIORAMA.white} strokeWidth={7} fill="none" strokeLinecap="round" opacity={night ? 0.04 : 0.16} />
      </Svg>
      {[74, 166, 254, 336].map((left, i) => <View key={left} style={{ position: 'absolute', left, top: hillY + 30 + (i % 2) * 14 }}><Tree night={night} scale={0.28 + (i % 2) * 0.05} flip={i % 2 === 1} /></View>)}
      <SurfaceGrain fromY={hillY + 95} canvasHeight={canvasHeight} color={grassEdge} night={night} />
      <View style={{ position: 'absolute', left: -25, top: 46 }}><Tree night={night} scale={1.16} /></View>
      <View style={{ position: 'absolute', right: -28, top: 57 }}><Tree night={night} scale={1.12} flip /></View>
      <View style={{ position: 'absolute', left: 108, top: hillY + 1 }}><Bush night={night} width={112} /></View>
      <View style={{ position: 'absolute', right: 82, top: hillY + 24 }}><Bush night={night} width={104} /></View>
      <View style={{ position: 'absolute', left: 22, top: hillY + 143 }}><Bench night={night} /></View>
      <View style={{ position: 'absolute', left: -28, top: ground + 38 }}><Bush night={night} width={92} /></View>
      <View style={{ position: 'absolute', right: -25, top: ground + 34 }}><Bush night={night} width={88} /></View>
      <StageLight y={ground} night={night} />
      <ParkLife night={night} />
    </View>
  );
}

function Shop({ x, y, w, h, base, light, edge, night, accent }: { x: number; y: number; w: number; h: number; base: string; light: string; edge: string; night: boolean; accent: string }) {
  const glass = night ? DIORAMA.glassNight : DIORAMA.glassDay;
  const glassEdge = night ? DIORAMA.glassNightEdge : DIORAMA.glassDayEdge;
  return (
    <>
      <Defs>
        <SvgLinearGradient id={`shop-${x}`} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={light} /><Stop offset={0.24} stopColor={base} /><Stop offset="1" stopColor={edge} /></SvgLinearGradient>
        <SvgLinearGradient id={`glass-${x}`} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={DIORAMA.white} stopOpacity={night ? 0.12 : 0.56} /><Stop offset="0.28" stopColor={glass} /><Stop offset="1" stopColor={glassEdge} /></SvgLinearGradient>
      </Defs>
      <Rect x={x + 7} y={y + 13} width={w} height={h} rx={26} fill={edge} />
      <Rect x={x} y={y} width={w} height={h} rx={26} fill={`url(#shop-${x})`} />
      <Path d={`M${x + w - 22} ${y + 12}Q${x + w + 1} ${y + 28} ${x + w} ${y + h - 18}L${x + w - 15} ${y + h - 6}Z`} fill={edge} opacity={0.58} />
      <Path d={`M${x + 22} ${y + 4}Q${x + w / 2} ${y - 19} ${x + w - 21} ${y + 5}`} stroke={light} strokeWidth={15} strokeLinecap="round" opacity={0.9} />
      <Path d={`M${x + 16} ${y + 17}Q${x + w / 2} ${y + 2} ${x + w - 16} ${y + 18}`} stroke={DIORAMA.white} strokeWidth={9} strokeLinecap="round" opacity={night ? 0.06 : 0.28} />
      <Rect x={x + 16} y={y + 48} width={w - 32} height={31} rx={12} fill={edge} opacity={0.56} />
      <Rect x={x + 19} y={y + 43} width={w - 38} height={31} rx={12} fill={DIORAMA.signFace} />
      <Path d={`M${x + 31} ${y + 54}H${x + w - 31}`} stroke={DIORAMA.white} strokeWidth={7} strokeLinecap="round" opacity={night ? 0.16 : 0.58} />
      {Array.from({ length: 5 }, (_, i) => {
        const sw = (w - 22) / 5;
        return <Rect key={i} x={x + 11 + i * sw} y={y + 84} width={sw + 1} height={28} rx={5} fill={i % 2 === 0 ? DIORAMA.white : accent} opacity={night ? 0.62 : 0.98} />;
      })}
      <Rect x={x + 17} y={y + 118} width={w - 34} height={h - 137} rx={16} fill={glassEdge} />
      <Rect x={x + 21} y={y + 113} width={w - 42} height={h - 137} rx={14} fill={`url(#glass-${x})`} />
      <Path d={`M${x + 31} ${y + 125}H${x + w - 31}`} stroke={DIORAMA.white} strokeWidth={10} strokeLinecap="round" opacity={night ? 0.12 : 0.48} />
      <Path d={`M${x + 29} ${y + 135}L${x + 54} ${y + h - 32}`} stroke={DIORAMA.white} strokeWidth={8} strokeLinecap="round" opacity={night ? 0.04 : 0.15} />
      <Rect x={x + w * 0.51} y={y + 114} width={7} height={h - 138} rx={3} fill={glassEdge} opacity={0.64} />
      {/* A display plane keeps the storefront from reading as empty glass. */}
      <Rect x={x + 25} y={y + h - 70} width={w - 50} height={42} rx={11} fill={edge} opacity={night ? 0.58 : 0.34} />
      <Rect x={x + 29} y={y + h - 76} width={w - 58} height={12} rx={6} fill={DIORAMA.woodWarm} />
      <Path d={`M${x + 35} ${y + h - 72}H${x + w - 35}`} stroke={DIORAMA.white} strokeWidth={4} strokeLinecap="round" opacity={night ? 0.08 : 0.32} />
      <Circle cx={x + w * 0.35} cy={y + h - 91} r={17} fill={accent} opacity={night ? 0.48 : 0.82} />
      <Rect x={x + w * 0.61} y={y + h - 111} width={28} height={36} rx={10} fill={DIORAMA.signFace} opacity={night ? 0.54 : 0.9} />
      <Path d={`M${x + w * 0.61 + 7} ${y + h - 100}H${x + w * 0.61 + 21}`} stroke={accent} strokeWidth={5} strokeLinecap="round" opacity={0.74} />
    </>
  );
}

function LampPost({ night }: { night: boolean }) {
  const glow = useLoop(2700);
  return (
    <View style={{ width: 58, height: 158 }}>
      {night && <Animated.View style={[styles.streetGlow, { opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.2] }) }]} />}
      <Svg width={58} height={158} viewBox="0 0 58 158">
        <Ellipse cx={29} cy={152} rx={19} ry={5} fill={DIORAMA.shadow} opacity={0.18} />
        <Rect x={25} y={40} width={8} height={103} rx={4} fill={DIORAMA.inkSoft} />
        <Rect x={13} y={10} width={32} height={38} rx={12} fill={DIORAMA.goldDeep} />
        <Rect x={17} y={14} width={24} height={29} rx={9} fill={night ? DIORAMA.goldGlow : DIORAMA.goldLight} />
        <Path d="M21 18H34" stroke={DIORAMA.white} strokeWidth={5} strokeLinecap="round" opacity={0.54} />
        <Ellipse cx={29} cy={145} rx={16} ry={6} fill={DIORAMA.inkSoft} />
      </Svg>
    </View>
  );
}

function TownFountain({ night }: { night: boolean }) {
  return (
    <Svg width={104} height={92} viewBox="0 0 104 92">
      <Ellipse cx={52} cy={84} rx={47} ry={7} fill={DIORAMA.shadow} opacity={0.18} />
      <Ellipse cx={52} cy={69} rx={46} ry={16} fill={DIORAMA.townRoadNightEdge} />
      <Ellipse cx={52} cy={62} rx={44} ry={15} fill={night ? DIORAMA.townSidewalkNight : DIORAMA.townSidewalkDay} />
      <Ellipse cx={52} cy={59} rx={34} ry={10} fill={night ? DIORAMA.oceanNightA : DIORAMA.oceanDayA} />
      <Rect x={47} y={21} width={10} height={39} rx={5} fill={DIORAMA.woodWarm} />
      <Ellipse cx={52} cy={27} rx={22} ry={8} fill={DIORAMA.woodDeep} />
      <Ellipse cx={52} cy={22} rx={20} ry={7} fill={DIORAMA.goldLight} />
      <Path d="M43 24Q52 37 61 24" stroke={DIORAMA.white} strokeWidth={3} fill="none" opacity={night ? 0.16 : 0.46} />
    </Svg>
  );
}

function TownLife({ night }: { night: boolean }) {
  const glint = useLoop(4000);
  const walker = useLoop(9000, 1000);
  return (
    <View style={styles.fill} pointerEvents="none">
      <Animated.View style={[styles.windowGlint, { opacity: glint.interpolate({ inputRange: [0, .5, 1], outputRange: [0, night ? .16 : .42, 0] }), transform: [{ translateX: glint.interpolate({ inputRange: [0, 1], outputRange: [-50, 390] }) }, { rotate: '14deg' }] }]} />
      <Animated.View style={[styles.walker, { opacity: walker.interpolate({ inputRange: [0, .15, .85, 1], outputRange: [0, night ? .07 : .12, night ? .07 : .12, 0] }), transform: [{ translateX: walker.interpolate({ inputRange: [0, 1], outputRange: [-60, 460] }) }] }]} />
    </View>
  );
}

export function TownScene({ hour, bandHeight = 620, groundY }: { hour: number; bandHeight?: number; groundY?: number }) {
  const band = skyBand(hour);
  const night = band === 'night';
  const ground = groundY ?? bandHeight * 0.72;
  const canvasHeight = ground + 264;
  const sidewalkY = Math.max(350, ground - 132);
  // Roofs deliberately begin behind the chrome scrim. Their molded bodies
  // then emerge directly below navigation instead of leaving a blue void.
  const roof = 62;
  const walk = night ? DIORAMA.townSidewalkNight : DIORAMA.townSidewalkDay;
  const walkEdge = night ? DIORAMA.townSidewalkNightEdge : DIORAMA.townSidewalkDayEdge;
  const road = night ? DIORAMA.townRoadNight : DIORAMA.townRoadDay;
  const roadEdge = night ? DIORAMA.townRoadNightEdge : DIORAMA.townRoadDayEdge;
  return (
    <View style={styles.fill} pointerEvents="none">
      <Sky band={band} compact />
      <Svg width="100%" height="100%" viewBox={`0 0 420 ${canvasHeight}`} preserveAspectRatio="none" style={styles.fill}>
        <Shop x={-31} y={roof + 35} w={158} h={sidewalkY - roof - 12} base={night ? DIORAMA.townCoralNight : DIORAMA.townCoral} light={DIORAMA.townCoralLight} edge={DIORAMA.townCoralEdge} night={night} accent={DIORAMA.coral} />
        <Shop x={116} y={roof} w={188} h={sidewalkY - roof + 23} base={night ? DIORAMA.townBlueNight : DIORAMA.townBlue} light={DIORAMA.townBlueLight} edge={DIORAMA.townBlueEdge} night={night} accent={DIORAMA.aqua} />
        <Shop x={292} y={roof + 27} w={164} h={sidewalkY - roof - 4} base={night ? DIORAMA.townVioletNight : DIORAMA.townViolet} light={DIORAMA.townVioletLight} edge={DIORAMA.townVioletEdge} night={night} accent={DIORAMA.violetLight} />
        <Rect x={0} y={sidewalkY + 11} width={420} height={canvasHeight - sidewalkY} fill={walkEdge} />
        <Rect x={0} y={sidewalkY} width={420} height={canvasHeight - sidewalkY - 11} fill={walk} />
        <Path d={`M0 ${sidewalkY + 8}H420`} stroke={DIORAMA.white} strokeWidth={8} opacity={night ? 0.06 : 0.28} />
        {[70, 153, 236, 319].map((x) => <Path key={x} d={`M${x} ${sidewalkY}L${x + 43} ${canvasHeight}`} stroke={walkEdge} strokeWidth={2.4} opacity={0.27} />)}
        <Rect x={0} y={ground + 91} width={420} height={canvasHeight - ground - 91} fill={roadEdge} />
        <Rect x={0} y={ground + 99} width={420} height={canvasHeight - ground - 99} fill={road} />
        <Path d={`M22 ${ground + 126}H112M166 ${ground + 126}H256M310 ${ground + 126}H400`} stroke={DIORAMA.cream} strokeWidth={8} strokeLinecap="round" opacity={night ? 0.12 : 0.47} />
      </Svg>
      <SurfaceGrain fromY={sidewalkY} canvasHeight={canvasHeight} color={walkEdge} night={night} />
      <View style={{ position: 'absolute', left: '50%', marginLeft: -52, top: sidewalkY - 58 }}><TownFountain night={night} /></View>
      <StageLight y={ground} night={night} warm />
      <View style={{ position: 'absolute', left: 11, top: sidewalkY - 115 }}><LampPost night={night} /></View>
      <View style={{ position: 'absolute', right: 10, top: sidewalkY - 115 }}><LampPost night={night} /></View>
      <TownLife night={night} />
    </View>
  );
}

function Umbrella({ night }: { night: boolean }) {
  return (
    <Svg width={137} height={185} viewBox="0 0 137 185">
      <Defs><SvgLinearGradient id="umbrella" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={DIORAMA.coralLight} /><Stop offset="1" stopColor={DIORAMA.coralDeep} /></SvgLinearGradient></Defs>
      <Ellipse cx={68} cy={176} rx={43} ry={7} fill={DIORAMA.shadow} opacity={0.16} />
      <Path d="M68 64V166" stroke={DIORAMA.woodWarm} strokeWidth={8} strokeLinecap="round" />
      <Path d="M9 70Q67-17 128 70Z" fill={DIORAMA.coralDeep} />
      <Path d="M9 60Q67-27 128 60Z" fill="url(#umbrella)" />
      <Path d="M34 56Q67 0 103 57Z" fill={DIORAMA.lemon} />
      <Path d="M31 43Q66 0 99 45" stroke={DIORAMA.white} strokeWidth={7} strokeLinecap="round" opacity={night ? 0.1 : 0.37} />
    </Svg>
  );
}

function Dune({ night }: { night: boolean }) {
  const sand = night ? DIORAMA.sandNightFar : DIORAMA.sandDayFar;
  const grass = night ? DIORAMA.grassBeachNight : DIORAMA.grassBeachDay;
  const light = night ? DIORAMA.grassBeachNight : DIORAMA.grassBeachLight;
  return (
    <Svg width={154} height={126} viewBox="0 0 154 126">
      <Ellipse cx={74} cy={109} rx={80} ry={26} fill={sand} />
      {[21, 41, 61, 83, 105, 127].map((x, i) => <Path key={x} d={`M${x} 108Q${x + (i % 2 ? -13 : 14)} 71 ${x + (i % 3) * 4 - 4} 28`} stroke={i % 2 ? grass : light} strokeWidth={i % 2 ? 6 : 7} fill="none" strokeLinecap="round" />)}
      <Path d="M21 101Q76 81 135 102" stroke={DIORAMA.white} strokeWidth={5} opacity={night ? 0.04 : 0.18} strokeLinecap="round" />
    </Svg>
  );
}

function Castle({ night }: { night: boolean }) {
  const body = night ? DIORAMA.sandNightFar : DIORAMA.sandDayFar;
  const light = night ? DIORAMA.sandNightLight : DIORAMA.sandDayLight;
  const edge = night ? DIORAMA.sandNightEdge : DIORAMA.sandDayEdge;
  return (
    <Svg width={112} height={92} viewBox="0 0 112 92">
      <Ellipse cx={56} cy={86} rx={48} ry={6} fill={DIORAMA.shadow} opacity={0.13} />
      <Rect x={16} y={45} width={79} height={35} rx={11} fill={edge} /><Rect x={16} y={38} width={79} height={35} rx={11} fill={body} />
      <Rect x={24} y={18} width={24} height={29} rx={7} fill={body} /><Rect x={65} y={18} width={24} height={29} rx={7} fill={body} /><Rect x={43} y={7} width={29} height={35} rx={8} fill={light} />
      <Path d="M25 45Q56 33 86 45" stroke={DIORAMA.white} strokeWidth={6} strokeLinecap="round" opacity={night ? 0.05 : 0.28} />
      <Path d="M49 73V58Q56 49 63 58V73" fill={edge} />
      <Path d="M58 7V-2" stroke={DIORAMA.woodDeep} strokeWidth={4} /><Path d="M60 0L83 8L60 16Z" fill={DIORAMA.aqua} />
    </Svg>
  );
}

function Palm({ night, flip = false }: { night: boolean; flip?: boolean }) {
  const leaf = night ? DIORAMA.grassBeachNight : DIORAMA.grassBeachDay;
  const leafLight = night ? DIORAMA.grassBeachNight : DIORAMA.grassBeachLight;
  return (
    <Svg width={122} height={218} viewBox="0 0 122 218" style={flip ? { transform: [{ scaleX: -1 }] } : undefined}>
      <Defs>
        <SvgLinearGradient id="palmTrunk" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={DIORAMA.woodDeep} /><Stop offset="0.42" stopColor={DIORAMA.woodWarm} /><Stop offset="1" stopColor={DIORAMA.woodDark} />
        </SvgLinearGradient>
        <SvgLinearGradient id="palmLeaf" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={leafLight} /><Stop offset="1" stopColor={leaf} />
        </SvgLinearGradient>
      </Defs>
      <Ellipse cx={61} cy={209} rx={37} ry={7} fill={DIORAMA.shadow} opacity={0.16} />
      <Path d="M55 199Q64 139 58 72L75 70Q79 141 72 203Z" fill="url(#palmTrunk)" />
      {[[-1, 12, 64, 76], [14, 2, 65, 70], [40, -3, 67, 70], [72, 0, 68, 70], [99, 12, 68, 75], [104, 42, 69, 77], [5, 42, 65, 77]].map(([x, y, cx, cy], i) => (
        <Path key={i} d={`M${cx} ${cy}Q${(x + cx) / 2} ${y - 12} ${x} ${y + 22}Q${(x + cx) / 2} ${y + 11} ${cx} ${cy}Z`} fill="url(#palmLeaf)" />
      ))}
      <Path d="M64 77Q44 30 12 30M67 73Q90 26 112 37" stroke={DIORAMA.white} strokeWidth={4} strokeLinecap="round" opacity={night ? 0.04 : 0.2} />
    </Svg>
  );
}

function BeachLife({ night }: { night: boolean }) {
  const gull = useLoop(8500, 400);
  const glint = useLoop(2500);
  const foam = useLoop(2800, 300);
  return (
    <View style={styles.fill} pointerEvents="none">
      <Animated.View style={[styles.gull, { opacity: gull.interpolate({ inputRange: [0, .12, .88, 1], outputRange: [0, night ? .17 : .55, night ? .17 : .55, 0] }), transform: [{ translateX: gull.interpolate({ inputRange: [0, 1], outputRange: [-40, 450] }) }, { translateY: gull.interpolate({ inputRange: [0, .5, 1], outputRange: [8, -24, 5] }) }] }]}><View style={styles.gullL} /><View style={styles.gullR} /></Animated.View>
      <Animated.View style={[styles.waterGlint, { opacity: glint.interpolate({ inputRange: [0, 1], outputRange: [0.08, night ? .2 : .62] }), transform: [{ scaleX: glint.interpolate({ inputRange: [0, 1], outputRange: [.7, 1.28] }) }] }]} />
      <Animated.View style={[styles.foam, { opacity: foam.interpolate({ inputRange: [0, 1], outputRange: [night ? .06 : .15, night ? .16 : .38] }), transform: [{ translateY: foam.interpolate({ inputRange: [0, 1], outputRange: [-4, 8] }) }] }]} />
    </View>
  );
}

export function BeachScene({ hour, bandHeight = 620, groundY }: { hour: number; bandHeight?: number; groundY?: number }) {
  const band = skyBand(hour);
  const night = band === 'night';
  const ground = groundY ?? bandHeight * 0.72;
  const canvasHeight = ground + 264;
  const horizon = 188;
  const tide = horizon + 128;
  const sandTop = tide + 14;
  const oceanLight = night ? DIORAMA.oceanNightLight : DIORAMA.oceanDayLight;
  const oceanEdge = night ? DIORAMA.oceanNightEdge : DIORAMA.oceanDayEdge;
  const sandEdge = night ? DIORAMA.sandNightEdge : DIORAMA.sandDayEdge;
  return (
    <View style={styles.fill} pointerEvents="none">
      <Sky band={band} compact />
      <View style={{ position: 'absolute', left: 0, right: 0, top: horizon, height: tide - horizon + 30, backgroundColor: oceanEdge }} />
      <RNGradient colors={night ? [DIORAMA.oceanNightA, DIORAMA.oceanNightB] : [DIORAMA.oceanDayA, DIORAMA.oceanDayB]} style={{ position: 'absolute', left: 0, right: 0, top: horizon, height: tide - horizon + 20 }} />
      <Svg width="100%" height="100%" viewBox={`0 0 420 ${canvasHeight}`} preserveAspectRatio="none" style={styles.fill}>
        <Path d={`M-18 ${horizon + 31}Q18 ${horizon - 32} 70 ${horizon + 16}Q102 ${horizon - 10} 141 ${horizon + 29}Z`} fill={night ? DIORAMA.parkHillNight : DIORAMA.parkHillDay} opacity={0.72} />
        <Path d={`M438 ${horizon + 38}Q401 ${horizon - 24} 350 ${horizon + 17}Q321 ${horizon - 8} 286 ${horizon + 31}Z`} fill={night ? DIORAMA.parkHillNight : DIORAMA.parkHillDay} opacity={0.68} />
        <Path d={`M126 ${horizon + 27}Q165 ${horizon - 12} 204 ${horizon + 28}Z`} fill={night ? DIORAMA.parkHillNight : DIORAMA.parkHillDayLight} opacity={0.48} />
        <Path d={`M233 ${horizon + 28}Q264 ${horizon + 1} 294 ${horizon + 29}Z`} fill={night ? DIORAMA.parkHillNight : DIORAMA.parkHillDayLight} opacity={0.42} />
        <Path d={`M0 ${horizon + 32}Q83 ${horizon + 17} 163 ${horizon + 30}T315 ${horizon + 28}T430 ${horizon + 31}`} stroke={oceanLight} strokeWidth={8} fill="none" opacity={night ? .11 : .42} />
        <Path d={`M18 ${horizon + 72}Q92 ${horizon + 58} 162 ${horizon + 71}T302 ${horizon + 67}T410 ${horizon + 70}`} stroke={oceanLight} strokeWidth={5} fill="none" opacity={night ? .08 : .28} />
        <Path d={`M-20 ${horizon + 104}Q46 ${horizon + 91} 112 ${horizon + 106}T246 ${horizon + 102}T442 ${horizon + 99}`} stroke={DIORAMA.white} strokeWidth={3} fill="none" opacity={night ? .04 : .2} />
        <Path d={`M-15 ${tide + 8}Q49 ${tide - 11} 117 ${tide + 5}T242 ${tide + 4}T360 ${tide + 3}T438 ${tide + 5}`} stroke={night ? DIORAMA.foamNightShade : DIORAMA.foamDayShade} strokeWidth={20} fill="none" />
        <Path d={`M-15 ${tide}Q49 ${tide - 19} 117 ${tide}T242 ${tide - 2}T360 ${tide - 3}T438 ${tide - 2}`} stroke={night ? DIORAMA.foamNight : DIORAMA.foamDay} strokeWidth={11} fill="none" />
      </Svg>
      <View style={{ position: 'absolute', left: 0, right: 0, top: sandTop + 8, bottom: 0, backgroundColor: sandEdge }} />
      <RNGradient colors={night ? [DIORAMA.sandNightFar, DIORAMA.sandNightNear] : [DIORAMA.sandDayFar, DIORAMA.sandDayNear]} style={{ position: 'absolute', left: 0, right: 0, top: sandTop, bottom: 0 }} />
      <RNGradient colors={night ? [DIORAMA.oceanNightLight, DIORAMA.sandNightFar] : [DIORAMA.foamDayShade, DIORAMA.sandDayFar]} style={{ position: 'absolute', left: 0, right: 0, top: sandTop, height: 72, opacity: night ? 0.18 : 0.34 }} />
      <Svg width="100%" height="100%" viewBox={`0 0 420 ${canvasHeight}`} preserveAspectRatio="none" style={styles.fill}>
        <Path d={`M18 ${sandTop + 46}Q132 ${sandTop + 26} 236 ${sandTop + 45}Q327 ${sandTop + 61} 414 ${sandTop + 42}`} stroke={DIORAMA.white} strokeWidth={6} fill="none" opacity={night ? .03 : .16} />
        <Path d={`M-12 ${sandTop + 118}Q98 ${sandTop + 90} 211 ${sandTop + 119}T432 ${sandTop + 112}`} stroke={sandEdge} strokeWidth={3} fill="none" opacity={night ? .17 : .25} />
        <Path d={`M-18 ${sandTop + 211}Q104 ${sandTop + 171} 218 ${sandTop + 212}T438 ${sandTop + 202}`} stroke={sandEdge} strokeWidth={5} fill="none" opacity={night ? .2 : .3} />
        {[0, 1, 2].map((i) => {
          const x = 116 + i * 17;
          const y = sandTop + 151 + i * 28;
          return (
            <React.Fragment key={i}>
              <Ellipse cx={x} cy={y} rx={5 + i} ry={9 + i * 1.5} fill={sandEdge} opacity={night ? 0.18 : 0.28} transform={`rotate(-22 ${x} ${y})`} />
              <Circle cx={x - 6} cy={y - 8} r={2.2 + i * .35} fill={sandEdge} opacity={night ? 0.16 : 0.25} />
            </React.Fragment>
          );
        })}
        <Circle cx={318} cy={ground + 44} r={7} fill={DIORAMA.starfish} /><Path d={`M313 ${ground + 37}L323 ${ground + 51}M325 ${ground + 37}L311 ${ground + 50}`} stroke={DIORAMA.starfish} strokeWidth={5} strokeLinecap="round" />
      </Svg>
      <SurfaceGrain fromY={sandTop + 12} canvasHeight={canvasHeight} color={sandEdge} night={night} />
      <View style={{ position: 'absolute', right: -32, top: horizon - 116 }}><Palm night={night} flip /></View>
      <StageLight y={ground} night={night} warm />
      <View style={{ position: 'absolute', left: -35, top: sandTop + 38 }}><Dune night={night} /></View>
      <View style={{ position: 'absolute', right: -12, top: 186 }}><Umbrella night={night} /></View>
      <View style={{ position: 'absolute', left: 76, top: ground + 12 }}><Castle night={night} /></View>
      <BeachLife night={night} />
    </View>
  );
}

export function NightOverlay() {
  return <View pointerEvents="none" style={[styles.fill, { backgroundColor: DIORAMA.skyNightA, opacity: 0.08 }]} />;
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  contact: { position: 'absolute', borderRadius: radius.pill, backgroundColor: DIORAMA.shadow, opacity: 0.19 },
  cloud: { position: 'absolute', width: 150, height: 46 },
  cloudPuff: { position: 'absolute', borderRadius: radius.pill, backgroundColor: DIORAMA.white },
  cloudShade: { position: 'absolute', height: 9, borderRadius: radius.pill, backgroundColor: DIORAMA.shadow, opacity: 0.07 },
  lampGlow: { position: 'absolute', left: 2, top: -4, width: 78, height: 78, borderRadius: radius.pill, backgroundColor: DIORAMA.goldGlow },
  streetGlow: { position: 'absolute', left: -10, top: -4, width: 78, height: 78, borderRadius: radius.pill, backgroundColor: DIORAMA.goldGlow },
  rug: { position: 'absolute', left: '15%', right: '15%', bottom: 132, height: 64, borderRadius: radius.pill, backgroundColor: DIORAMA.violetDeep, padding: 7 },
  rugInner: { flex: 1, borderRadius: radius.pill },
  homeBeam: { position: 'absolute', left: 55, top: 265, width: 118, height: 230, borderRadius: radius.pill, backgroundColor: DIORAMA.goldLight, transform: [{ rotate: '-14deg' }] },
  homeMote: { position: 'absolute', left: 108, top: 319, width: 8, height: 8, borderRadius: radius.pill, backgroundColor: DIORAMA.white },
  leaf: { position: 'absolute', left: 65, top: 245, width: 16, height: 9, borderTopLeftRadius: radius.md, borderBottomRightRadius: radius.md, backgroundColor: DIORAMA.parkTreeDayLight },
  butterfly: { position: 'absolute', left: 0, top: 260, width: 20, height: 14 },
  butterflyL: { position: 'absolute', left: 0, width: 12, height: 12, borderRadius: radius.sm, backgroundColor: DIORAMA.violetLight, transform: [{ rotate: '-28deg' }] },
  butterflyR: { position: 'absolute', right: 0, width: 12, height: 12, borderRadius: radius.sm, backgroundColor: DIORAMA.coralLight, transform: [{ rotate: '28deg' }] },
  windowGlint: { position: 'absolute', left: 44, top: 210, width: 23, height: 182, borderRadius: radius.pill, backgroundColor: DIORAMA.white },
  walker: { position: 'absolute', left: 0, top: 398, width: 38, height: 65, borderRadius: radius.lg, backgroundColor: DIORAMA.shadow },
  gull: { position: 'absolute', left: 0, top: 157, width: 30, height: 16 },
  gullL: { position: 'absolute', left: 0, top: 7, width: 17, height: 3, borderRadius: radius.sm, backgroundColor: DIORAMA.inkSoft, transform: [{ rotate: '-22deg' }] },
  gullR: { position: 'absolute', right: 0, top: 7, width: 17, height: 3, borderRadius: radius.sm, backgroundColor: DIORAMA.inkSoft, transform: [{ rotate: '22deg' }] },
  waterGlint: { position: 'absolute', right: 92, top: 304, width: 38, height: 5, borderRadius: radius.pill, backgroundColor: DIORAMA.white },
  foam: { position: 'absolute', left: 42, right: 42, top: 381, height: 10, borderRadius: radius.pill, backgroundColor: DIORAMA.white },
});
