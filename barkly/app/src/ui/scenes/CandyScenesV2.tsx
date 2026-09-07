import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient as RNGradient } from 'expo-linear-gradient';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient as SvgLinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { useReduceMotion } from '../motion';
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

function useLoop(duration: number, delay = 0, still = false) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) {
      value.stopAnimation();
      value.setValue(0.38);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(value, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, duration, value, still]);
  return value;
}




function Sky({ band, compact = false }: { band: SkyBand; compact?: boolean }) {
  const night = band === 'night';
  const still = useReduceMotion();
  const cloudA = useLoop(12000, 0, still);
  const cloudB = useLoop(15500, 800, still);
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
            {[38, 124, 232, 376].map((x, i) => (
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
      <Animated.View style={[styles.cloud, { top: compact ? 128 : 164, right: 10, transform: [{ translateX: cloudB.interpolate({ inputRange: [0, 1], outputRange: [24, -34] }) }, { scale: 0.52 }], opacity: 0.54 }]}>
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
            <RadialGradient id="windowSun" cx="36%" cy="30%" r="68%">
              <Stop offset="0" stopColor={DIORAMA.white} stopOpacity={0.74} />
              <Stop offset="0.26" stopColor={DIORAMA.lemon} />
              <Stop offset="1" stopColor={DIORAMA.goldDeep} />
            </RadialGradient>
          </Defs>
          {night ? (
            <><Circle cx={126} cy={27} r={15} fill={DIORAMA.goldLight} /><Circle cx={119} cy={21} r={14} fill={DIORAMA.skyNightA} /></>
          ) : <Circle cx={128} cy={27} r={17} fill="url(#windowSun)" />}
          <Path d="M-4 88Q35 61 76 82Q111 99 164 73V124H-4Z" fill="url(#windowHill)" />
          <Path d="M-4 96Q35 69 76 90Q111 107 164 81" stroke={night ? DIORAMA.parkHillNight : DIORAMA.parkHillDayEdge} strokeWidth={7} fill="none" opacity={0.34} />
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
      <Path d="M91 70V94M34 88H86M99 88H150" stroke={edge} strokeWidth={3} strokeLinecap="round" opacity={0.42} />
      <Rect x={40} y={35} width={34} height={35} rx={11} fill={DIORAMA.lemon} transform="rotate(-8 57 52)" />
      <Rect x={106} y={37} width={34} height={33} rx={11} fill={DIORAMA.aquaLight} transform="rotate(7 123 53)" />
      <Path d="M29 22Q88 7 152 24" stroke={DIORAMA.white} strokeWidth={7} strokeLinecap="round" opacity={night ? 0.1 : 0.38} />
    </Svg>
  );
}

function Lamp({ night }: { night: boolean }) {
  const still = useReduceMotion();
  const glow = useLoop(2500, 0, still);
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




function Shop({ x, y, w, h, base, light, edge, night, accent, quiet = false }: { x: number; y: number; w: number; h: number; base: string; light: string; edge: string; night: boolean; accent: string; quiet?: boolean }) {
  const glass = night ? DIORAMA.glassNight : DIORAMA.glassDay;
  const glassEdge = night ? DIORAMA.glassNightEdge : DIORAMA.glassDayEdge;
  return (
    <G opacity={quiet ? 0.56 : 1}>
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
      {Array.from({ length: 3 }, (_, i) => {
        const sw = (w - 22) / 3;
        return <Rect key={i} x={x + 11 + i * sw} y={y + 84} width={sw + 1} height={28} rx={5} fill={i % 2 === 0 ? DIORAMA.white : accent} opacity={night ? 0.62 : 0.98} />;
      })}
      <Rect x={x + 9} y={y + 108} width={w - 18} height={11} rx={5} fill={edge} opacity={0.82} />
      <Path d={`M${x + 17} ${y + 109}H${x + w - 18}`} stroke={DIORAMA.white} strokeWidth={3} strokeLinecap="round" opacity={night ? 0.06 : 0.22} />
      <Rect x={x + 17} y={y + 118} width={w - 34} height={h - 137} rx={16} fill={glassEdge} />
      <Rect x={x + 21} y={y + 113} width={w - 42} height={h - 137} rx={14} fill={`url(#glass-${x})`} />
      <Path d={`M${x + 31} ${y + 125}H${x + w - 31}`} stroke={DIORAMA.white} strokeWidth={10} strokeLinecap="round" opacity={night ? 0.12 : 0.48} />
      <Path d={`M${x + 29} ${y + 135}L${x + 54} ${y + h - 32}`} stroke={DIORAMA.white} strokeWidth={8} strokeLinecap="round" opacity={night ? 0.04 : 0.15} />
      <Rect x={x + w * 0.51} y={y + 114} width={7} height={h - 138} rx={3} fill={glassEdge} opacity={0.64} />
      {/* A display plane keeps the storefront from reading as empty glass. */}
      <Rect x={x + 25} y={y + h - 70} width={w - 50} height={42} rx={11} fill={edge} opacity={night ? 0.58 : 0.34} />
      <Rect x={x + 29} y={y + h - 76} width={w - 58} height={12} rx={6} fill={DIORAMA.woodWarm} />
      <Path d={`M${x + 35} ${y + h - 72}H${x + w - 35}`} stroke={DIORAMA.white} strokeWidth={4} strokeLinecap="round" opacity={night ? 0.08 : 0.32} />
      {!quiet && <Circle cx={x + w * 0.35} cy={y + h - 91} r={17} fill={accent} opacity={night ? 0.48 : 0.82} />}
      {!quiet && <Rect x={x + w * 0.61} y={y + h - 111} width={28} height={36} rx={10} fill={DIORAMA.signFace} opacity={night ? 0.54 : 0.9} />}
      {!quiet && <Path d={`M${x + w * 0.61 + 7} ${y + h - 100}H${x + w * 0.61 + 21}`} stroke={accent} strokeWidth={5} strokeLinecap="round" opacity={0.74} />}
    </G>
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
});
