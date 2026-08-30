import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { DIORAMA } from './artPalette';
import { radius } from '../theme';

const FACE = require('../../../assets/barkly/renders/face.png');

type SkyBand = 'morning' | 'day' | 'evening' | 'night';

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

/**
 * The Store looks expensive because each object has a base, a moulded lower
 * edge, a controlled highlight and a real contact shadow. These helpers apply
 * that exact MATERIAL LOGIC to the world without making scenery look like UI.
 */
function Contact({ width, opacity = 0.2 }: { width: number; opacity?: number }) {
  return (
    <Svg width={width} height={20} viewBox={`0 0 ${width} 20`}>
      <Ellipse cx={width / 2} cy={11} rx={width * 0.47} ry={8} fill={DIORAMA.shadow} opacity={opacity * 0.55} />
      <Ellipse cx={width / 2} cy={10} rx={width * 0.34} ry={5} fill={DIORAMA.shadow} opacity={opacity} />
      <Ellipse cx={width / 2} cy={9} rx={width * 0.18} ry={2.8} fill={DIORAMA.shadow} opacity={opacity + 0.07} />
    </Svg>
  );
}

function Window({ band, large }: { band: SkyBand; large: boolean }) {
  const night = band === 'night';
  const w = large ? 180 : 150;
  const h = large ? 132 : 112;
  const frame = night ? DIORAMA.windowFrameNight : DIORAMA.windowFrameDay;
  const edge = night ? DIORAMA.windowFrameNightEdge : DIORAMA.windowFrameDayEdge;
  return (
    <View style={{ width: w, height: h + 7 }}>
      <View style={{ position: 'absolute', left: 5, right: 5, bottom: 0, height: 14, borderRadius: radius.md, backgroundColor: edge, opacity: 0.92 }} />
      <View style={{ width: w, height: h, borderRadius: radius.md, overflow: 'hidden', borderWidth: 8, borderColor: frame, backgroundColor: frame }}>
        <LinearGradient colors={SKY[band]} style={StyleSheet.absoluteFill} />
        <Svg width="100%" height="100%" viewBox="0 0 160 110" preserveAspectRatio="none">
          {night ? (
            <>
              <Circle cx={122} cy={25} r={16} fill={DIORAMA.goldLight} />
              <Circle cx={114} cy={19} r={15} fill={DIORAMA.skyNightA} />
              <Circle cx={42} cy={24} r={2} fill={DIORAMA.paleCream} />
              <Circle cx={78} cy={42} r={1.7} fill={DIORAMA.paleCream} />
              <Circle cx={27} cy={57} r={1.4} fill={DIORAMA.paleCream} />
            </>
          ) : (
            <>
              <Circle cx={122} cy={24} r={18} fill={DIORAMA.lemon} />
              <Ellipse cx={41} cy={45} rx={29} ry={11} fill={DIORAMA.white} opacity={0.93} />
              <Ellipse cx={92} cy={57} rx={23} ry={8} fill={DIORAMA.white} opacity={0.74} />
            </>
          )}
          <Path d="M0 88 Q42 67 84 83 T160 80 V110 H0 Z" fill={night ? DIORAMA.hillNight : DIORAMA.hillDay} />
        </Svg>
        <View style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 5, backgroundColor: frame }} />
        <View style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 5, backgroundColor: frame }} />
        <View style={{ position: 'absolute', left: 11, right: 11, top: 5, height: 6, borderRadius: radius.pill, backgroundColor: DIORAMA.white, opacity: 0.55 }} />
        <View style={{ position: 'absolute', left: 7, top: 8, width: 5, bottom: 14, borderRadius: radius.pill, backgroundColor: DIORAMA.white, opacity: 0.12 }} />
      </View>
    </View>
  );
}

function Sofa({ night }: { night: boolean }) {
  const back = night ? DIORAMA.couchNight : DIORAMA.couchDay;
  const top = night ? DIORAMA.couchNightTop : DIORAMA.couchDayTop;
  const seat = night ? DIORAMA.couchNightSeat : DIORAMA.couchDaySeat;
  const edge = night ? DIORAMA.couchNightEdge : DIORAMA.couchDayEdge;
  return (
    <View style={{ width: 204, height: 122 }}>
      <View style={{ position: 'absolute', left: 5, right: 5, bottom: -2, alignItems: 'center' }}><Contact width={194} opacity={0.24} /></View>
      <Svg width={204} height={118} viewBox="0 0 204 118">
        <Rect x={17} y={14} width={170} height={65} rx={22} fill={edge} />
        <Rect x={17} y={8} width={170} height={64} rx={22} fill={back} />
        <Rect x={20} y={10} width={164} height={22} rx={14} fill={top} />
        <Rect x={0} y={45} width={39} height={61} rx={18} fill={edge} />
        <Rect x={165} y={45} width={39} height={61} rx={18} fill={edge} />
        <Rect x={2} y={40} width={37} height={59} rx={18} fill={back} />
        <Rect x={165} y={40} width={37} height={59} rx={18} fill={back} />
        <Rect x={31} y={67} width={68} height={35} rx={14} fill={edge} />
        <Rect x={103} y={67} width={66} height={35} rx={14} fill={edge} />
        <Rect x={33} y={62} width={65} height={34} rx={14} fill={seat} />
        <Rect x={104} y={62} width={63} height={34} rx={14} fill={seat} />
        <Rect x={28} y={31} width={41} height={40} rx={12} fill={DIORAMA.lemon} transform="rotate(-9 48 51)" />
        <Rect x={30} y={33} width={35} height={8} rx={4} fill={DIORAMA.goldLight} opacity={0.68} transform="rotate(-9 48 51)" />
        <Path d="M30 18 H172" stroke={DIORAMA.white} strokeWidth={6} opacity={0.34} strokeLinecap="round" />
        <Path d="M39 68 h51 M111 68 h47" stroke={DIORAMA.white} strokeWidth={3.5} strokeLinecap="round" opacity={0.3} />
        <Rect x={18} y={99} width={12} height={13} rx={4} fill={DIORAMA.woodDeep} />
        <Rect x={174} y={99} width={12} height={13} rx={4} fill={DIORAMA.woodDeep} />
      </Svg>
    </View>
  );
}

function Portrait({ night }: { night: boolean }) {
  const frame = night ? DIORAMA.windowSillNight : DIORAMA.woodWarm;
  return (
    <View style={{ width: 86, alignItems: 'center' }}>
      <View style={{ position: 'absolute', width: 74, height: 68, top: 6, borderRadius: radius.sm, backgroundColor: DIORAMA.woodDeep, opacity: 0.9 }} />
      <View style={{ width: 78, height: 72, borderRadius: radius.sm, borderWidth: 6, borderColor: frame, backgroundColor: DIORAMA.cream, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <View style={{ position: 'absolute', left: 6, right: 6, top: 4, height: 6, borderRadius: radius.pill, backgroundColor: DIORAMA.white, opacity: 0.58 }} />
        <Image source={FACE} style={{ width: 59, height: 54 }} resizeMode="contain" />
      </View>
    </View>
  );
}

function Lamp({ night }: { night: boolean }) {
  return (
    <Svg width={86} height={168} viewBox="0 0 86 168">
      {night && <Circle cx={44} cy={29} r={40} fill={DIORAMA.goldGlow} opacity={0.27} />}
      <Ellipse cx={44} cy={158} rx={27} ry={7} fill={DIORAMA.shadow} opacity={0.2} />
      <Rect x={41} y={45} width={7} height={101} rx={3.5} fill={DIORAMA.woodDeep} />
      <Rect x={42} y={45} width={3} height={92} rx={2} fill={DIORAMA.woodShine} opacity={0.38} />
      <Ellipse cx={44} cy={151} rx={25} ry={7} fill={DIORAMA.woodDark} />
      <Path d="M21 8 H67 L76 45 H12 Z" fill={night ? DIORAMA.goldGlow : DIORAMA.gold} />
      <Path d="M24 8 H65 L67 19 H21 Z" fill={DIORAMA.goldLight} opacity={0.78} />
      <Path d="M16 40 H72" stroke={DIORAMA.goldDeep} strokeWidth={5} opacity={0.9} />
    </Svg>
  );
}

function Pennants({ night }: { night: boolean }) {
  const colors = [DIORAMA.pennantRed, DIORAMA.pennantYellow, DIORAMA.pennantBlue, DIORAMA.pennantGreen];
  return (
    <Svg width="100%" height={44} viewBox="0 0 420 44" preserveAspectRatio="none">
      <Path d="M0 6 Q210 35 420 6" stroke={night ? DIORAMA.windowSillNight : DIORAMA.woodWarm} strokeWidth={3} fill="none" opacity={0.85} />
      {Array.from({ length: 10 }, (_, i) => {
        const x = 18 + i * 42;
        const sag = 8 + Math.sin(((i + 0.5) / 10) * Math.PI) * 13;
        return (
          <React.Fragment key={i}>
            <Path d={`M${x} ${sag + 3} L${x + 18} ${sag + 5} L${x + 10} ${sag + 20} Z`} fill={DIORAMA.shadow} opacity={0.12} />
            <Path d={`M${x} ${sag} L${x + 18} ${sag + 2} L${x + 10} ${sag + 18} Z`} fill={colors[i % colors.length]} opacity={night ? 0.82 : 1} />
            <Path d={`M${x + 3} ${sag + 3} L${x + 14} ${sag + 4}`} stroke={DIORAMA.white} strokeWidth={2} opacity={0.33} strokeLinecap="round" />
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

function HomeShelf({ night }: { night: boolean }) {
  return (
    <Svg width={126} height={64} viewBox="0 0 126 64">
      <Rect x={6} y={42} width={114} height={10} rx={5} fill={DIORAMA.woodDeep} />
      <Rect x={6} y={37} width={114} height={10} rx={5} fill={night ? DIORAMA.windowSillNight : DIORAMA.woodWarm} />
      <Path d="M14 39 H108" stroke={DIORAMA.white} strokeWidth={3} opacity={0.3} strokeLinecap="round" />
      <Rect x={19} y={17} width={23} height={22} rx={6} fill={DIORAMA.aqua} />
      <Rect x={51} y={9} width={26} height={30} rx={7} fill={DIORAMA.violet} />
      <Rect x={86} y={20} width={21} height={19} rx={6} fill={DIORAMA.mint} />
      <Path d="M23 21 H37 M55 14 H70 M90 24 H103" stroke={DIORAMA.white} strokeWidth={3} opacity={0.46} strokeLinecap="round" />
    </Svg>
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
  const night = band === 'night';
  const has = (id: string) => upgrades.includes(id);
  const floorTop = Math.max(chromeBottom + 112, groundY - 118);
  const wallTop = chromeBottom + 12;
  const sofaTop = floorTop - 98;
  const windowTop = wallTop + 47;
  const portraitTop = wallTop + 56;

  return (
    <View style={styles.fill} pointerEvents="none">
      <LinearGradient colors={night ? [DIORAMA.wallNightA, DIORAMA.wallNightB] : [DIORAMA.wallDayA, DIORAMA.wallDayB]} style={[styles.fill, { bottom: undefined, height: floorTop }]} />

      {/* Crisp architectural planes: wall, baseboard, floor. No vague haze. */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: wallTop, height: 44 }}><Pennants night={night} /></View>
      <View style={{ position: 'absolute', left: 0, right: 0, top: floorTop - 20, height: 20, backgroundColor: night ? DIORAMA.wallNightEdge : DIORAMA.wallDayEdge }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: floorTop - 20, height: 7, backgroundColor: DIORAMA.white, opacity: night ? 0.12 : 0.28 }} />
      <LinearGradient colors={night ? [DIORAMA.floorNightFar, DIORAMA.floorNightNear] : [DIORAMA.floorDayFar, DIORAMA.floorDayNear]} style={{ position: 'absolute', left: 0, right: 0, top: floorTop, bottom: 0 }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: floorTop, height: 8, backgroundColor: night ? DIORAMA.floorNightEdge : DIORAMA.floorDayEdge, opacity: 0.55 }} />

      <Svg width="100%" height="100%" viewBox="0 0 420 760" preserveAspectRatio="none" style={styles.fill}>
        {[48, 126, 204, 284, 368].map((x) => <Path key={x} d={`M${x} ${floorTop} L${210 + (x - 210) * 2} 760`} stroke={night ? DIORAMA.floorNightEdge : DIORAMA.floorDayEdge} strokeWidth={2.4} opacity={0.34} />)}
        {[floorTop + 62, floorTop + 142, floorTop + 238].map((y, i) => <Path key={y} d={`M0 ${y} H420`} stroke={night ? DIORAMA.floorNightEdge : DIORAMA.floorDayEdge} strokeWidth={1.6 + i * 0.4} opacity={0.24} />)}
        <Path d={`M22 ${floorTop + 16} Q210 ${floorTop - 4} 398 ${floorTop + 16}`} stroke={DIORAMA.white} strokeWidth={4} fill="none" opacity={night ? 0.07 : 0.16} />
      </Svg>

      <View style={{ position: 'absolute', left: 15, top: windowTop }}><Window band={band} large={has('home_window')} /></View>
      <View style={{ position: 'absolute', left: 2, top: sofaTop }}><Sofa night={night} /></View>
      <View style={{ position: 'absolute', right: 31, top: portraitTop }}><Portrait night={night} /></View>
      <View style={{ position: 'absolute', right: 1, top: floorTop - 154 }}><Lamp night={night} /></View>
      <View style={{ position: 'absolute', right: 97, top: wallTop + 141 }}><HomeShelf night={night} /></View>

      {has('home_rug') && (
        <View style={{ position: 'absolute', alignSelf: 'center', top: groundY - 44, width: 296, height: 80 }}>
          <Svg width="100%" height="100%" viewBox="0 0 296 80" preserveAspectRatio="none">
            <Ellipse cx={148} cy={46} rx={144} ry={31} fill={DIORAMA.violetDeep} opacity={0.85} />
            <Ellipse cx={148} cy={39} rx={144} ry={31} fill={DIORAMA.violet} />
            <Ellipse cx={148} cy={36} rx={124} ry={24} fill={DIORAMA.violetLight} />
            <Path d="M37 39 Q76 15 115 39 T193 39 T259 39" stroke={DIORAMA.lemon} strokeWidth={8} fill="none" opacity={0.98} />
            <Path d="M47 21 Q148 4 249 21" stroke={DIORAMA.white} strokeWidth={5} fill="none" opacity={0.28} />
          </Svg>
        </View>
      )}

      {has('home_bed') && !asleep && <RoomBed upgraded top={groundY - 49} />}
      {/* Foreground doorframe: one strong layer sells depth better than haze. */}
      <View style={{ position: 'absolute', right: 0, top: floorTop - 4, bottom: 0, width: 21, backgroundColor: night ? DIORAMA.woodDeep : DIORAMA.woodDark, opacity: 0.94 }} />
      <View style={{ position: 'absolute', right: 3, top: floorTop + 4, bottom: 0, width: 5, backgroundColor: DIORAMA.woodShine, opacity: night ? 0.1 : 0.22 }} />
    </View>
  );
}

function OutdoorSky({ band }: { band: SkyBand }) {
  const night = band === 'night';
  return (
    <Svg width="100%" height="100%" viewBox="0 0 420 420" preserveAspectRatio="none">
      {night ? (
        <>
          <Circle cx={350} cy={110} r={27} fill={DIORAMA.goldLight} />
          <Circle cx={339} cy={101} r={23} fill={DIORAMA.skyNightA} />
          {[52, 122, 216, 290, 378].map((x, i) => <Circle key={x} cx={x} cy={72 + (i % 4) * 23} r={1.8} fill={DIORAMA.paleCream} />)}
        </>
      ) : (
        <>
          <Circle cx={350} cy={104} r={38} fill={DIORAMA.lemon} opacity={0.18} />
          <Circle cx={350} cy={104} r={21} fill={DIORAMA.lemon} />
          <Circle cx={344} cy={98} r={7} fill={DIORAMA.goldLight} opacity={0.62} />
          <Ellipse cx={82} cy={122} rx={49} ry={16} fill={DIORAMA.white} opacity={0.88} />
          <Ellipse cx={224} cy={92} rx={35} ry={12} fill={DIORAMA.white} opacity={0.7} />
        </>
      )}
    </Svg>
  );
}

function ParkTree({ night, mirror = false }: { night: boolean; mirror?: boolean }) {
  const leaf = night ? DIORAMA.parkTreeNight : DIORAMA.parkTreeDay;
  const leafLight = night ? DIORAMA.parkTreeNightLight : DIORAMA.parkTreeDayLight;
  const leafEdge = night ? DIORAMA.parkTreeNightEdge : DIORAMA.parkTreeDayEdge;
  return (
    <Svg width={188} height={276} viewBox="0 0 188 276" style={mirror ? { transform: [{ scaleX: -1 }] } : undefined}>
      <Ellipse cx={90} cy={268} rx={40} ry={7} fill={DIORAMA.shadow} opacity={0.18} />
      <Rect x={69} y={76} width={32} height={190} rx={13} fill={DIORAMA.woodDeep} />
      <Rect x={71} y={72} width={28} height={188} rx={13} fill={DIORAMA.woodDark} />
      <Path d="M77 82 V242" stroke={DIORAMA.woodShine} strokeWidth={5} opacity={0.27} strokeLinecap="round" />
      <Ellipse cx={82} cy={78} rx={94} ry={68} fill={leafEdge} />
      <Ellipse cx={82} cy={68} rx={92} ry={67} fill={leaf} />
      <Ellipse cx={35} cy={116} rx={60} ry={47} fill={leafEdge} />
      <Ellipse cx={35} cy={107} rx={58} ry={45} fill={leafLight} />
      <Ellipse cx={119} cy={112} rx={53} ry={41} fill={leaf} />
      <Path d="M26 48 Q79 20 134 48" stroke={DIORAMA.white} strokeWidth={7} opacity={night ? 0.08 : 0.24} strokeLinecap="round" />
      {!night && <Path d="M2 93 Q33 68 65 80" stroke={DIORAMA.parkTreeDayShine} strokeWidth={6} opacity={0.42} strokeLinecap="round" />}
    </Svg>
  );
}

function ParkBench({ night }: { night: boolean }) {
  const wood = night ? DIORAMA.woodMid : DIORAMA.woodWarm;
  return (
    <Svg width={130} height={82} viewBox="0 0 130 82">
      <Ellipse cx={65} cy={76} rx={51} ry={6} fill={DIORAMA.shadow} opacity={0.17} />
      <Rect x={16} y={20} width={98} height={14} rx={7} fill={DIORAMA.woodDeep} />
      <Rect x={16} y={15} width={98} height={14} rx={7} fill={wood} />
      <Rect x={19} y={18} width={88} height={4} rx={2} fill={DIORAMA.woodShine} opacity={0.38} />
      <Rect x={11} y={43} width={108} height={14} rx={7} fill={DIORAMA.woodDeep} />
      <Rect x={11} y={38} width={108} height={14} rx={7} fill={wood} />
      <Rect x={19} y={52} width={9} height={24} rx={4} fill={DIORAMA.woodDeep} />
      <Rect x={102} y={52} width={9} height={24} rx={4} fill={DIORAMA.woodDeep} />
    </Svg>
  );
}

export function ParkScene({ hour, bandHeight = 620, groundY }: { hour: number; bandHeight?: number; groundY?: number }) {
  const band = skyBand(hour);
  const night = band === 'night';
  const ground = groundY ?? bandHeight * 0.72;
  const horizon = ground - 153;
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
      <LinearGradient colors={SKY[band]} style={styles.fill} />
      <View style={styles.fill}><OutdoorSky band={band} /></View>
      <Svg width="100%" height="100%" viewBox={`0 0 420 ${bandHeight}`} preserveAspectRatio="none" style={styles.fill}>
        {/* Distant molded hill with a darker lower lip. */}
        <Path d={`M0 ${horizon + 34} Q84 ${horizon - 28} 176 ${horizon + 18} T420 ${horizon + 12} V${bandHeight} H0 Z`} fill={hillEdge} />
        <Path d={`M0 ${horizon + 24} Q84 ${horizon - 38} 176 ${horizon + 8} T420 ${horizon + 2} V${bandHeight} H0 Z`} fill={hill} />
        <Path d={`M0 ${horizon + 66} Q96 ${horizon + 10} 214 ${horizon + 58} T420 ${horizon + 43} V${bandHeight} H0 Z`} fill={grassEdge} />
        <Path d={`M0 ${horizon + 56} Q96 ${horizon} 214 ${horizon + 48} T420 ${horizon + 33} V${bandHeight} H0 Z`} fill={grass} />
        <Path d={`M0 ${horizon + 58} Q100 ${horizon + 7} 214 ${horizon + 50} T420 ${horizon + 36}`} stroke={grassLight} strokeWidth={7} fill="none" opacity={night ? 0.22 : 0.5} />

        {/* Path: lower edge first, bright surface second, one highlight. */}
        <Path d={`M173 ${horizon + 18} L247 ${horizon + 18} L398 ${bandHeight} L30 ${bandHeight} Z`} fill={pathEdge} />
        <Path d={`M181 ${horizon + 14} L239 ${horizon + 14} L373 ${bandHeight} L54 ${bandHeight} Z`} fill={path} />
        <Path d={`M195 ${horizon + 15} L225 ${horizon + 15} L316 ${bandHeight} L110 ${bandHeight} Z`} fill={pathLight} opacity={night ? 0.12 : 0.26} />

        {/* Clean little flower clusters — scenery, not UI stickers. */}
        {[22, 46, 350, 379].map((x, i) => (
          <React.Fragment key={x}>
            <Path d={`M${x} ${ground + 4 + (i % 2) * 8} v-17`} stroke={grassEdge} strokeWidth={3} />
            <Circle cx={x} cy={ground - 15 + (i % 2) * 8} r={5} fill={[DIORAMA.flowerPink, DIORAMA.flowerYellow, DIORAMA.flowerBlue, DIORAMA.flowerPink][i]} />
            <Circle cx={x - 1.5} cy={ground - 17 + (i % 2) * 8} r={1.8} fill={DIORAMA.white} opacity={0.55} />
          </React.Fragment>
        ))}
      </Svg>

      <View style={{ position: 'absolute', left: -48, top: horizon - 125 }}><ParkTree night={night} /></View>
      <View style={{ position: 'absolute', right: -68, top: horizon - 85, opacity: 0.78 }}><ParkTree night={night} mirror /></View>
      <View style={{ position: 'absolute', left: 33, top: horizon + 37 }}><ParkBench night={night} /></View>
      {/* A polished dog-park sign gives the set an authored focal prop. */}
      <View style={{ position: 'absolute', right: 23, top: horizon + 22 }}>
        <Svg width={84} height={92} viewBox="0 0 84 92">
          <Ellipse cx={42} cy={87} rx={25} ry={4} fill={DIORAMA.shadow} opacity={0.15} />
          <Rect x={38} y={37} width={8} height={49} rx={4} fill={DIORAMA.woodDeep} />
          <Rect x={4} y={4} width={76} height={42} rx={12} fill={DIORAMA.signEdge} />
          <Rect x={4} y={0} width={76} height={42} rx={12} fill={DIORAMA.signFace} />
          <Path d="M16 10 H66" stroke={DIORAMA.white} strokeWidth={5} opacity={0.55} strokeLinecap="round" />
          <Circle cx={31} cy={23} r={6} fill={DIORAMA.coral} />
          <Circle cx={51} cy={23} r={6} fill={DIORAMA.aqua} />
        </Svg>
      </View>
    </View>
  );
}

function ShopFront({ x, y, w, h, base, light, edge, night }: {
  x: number; y: number; w: number; h: number; base: string; light: string; edge: string; night: boolean;
}) {
  const glass = night ? DIORAMA.glassNight : DIORAMA.glassDay;
  const glassEdge = night ? DIORAMA.glassNightEdge : DIORAMA.glassDayEdge;
  return (
    <>
      <Rect x={x} y={y + 8} width={w} height={h} rx={20} fill={edge} />
      <Rect x={x} y={y} width={w} height={h} rx={20} fill={base} />
      <Rect x={x + 10} y={y + 10} width={w - 20} height={16} rx={8} fill={light} opacity={night ? 0.28 : 0.72} />
      <Rect x={x + 18} y={y + 73} width={w - 36} height={70} rx={12} fill={glassEdge} />
      <Rect x={x + 18} y={y + 68} width={w - 36} height={70} rx={12} fill={glass} />
      <Path d={`M${x + 27} ${y + 77} H${x + w - 29}`} stroke={DIORAMA.glassShine} strokeWidth={6} opacity={night ? 0.24 : 0.58} strokeLinecap="round" />
      {/* Awning: thick blocks, not thin lines. */}
      {Array.from({ length: 5 }, (_, i) => (
        <Rect key={i} x={x + 12 + i * ((w - 24) / 5)} y={y + 42} width={(w - 24) / 5 + 1} height={18} rx={5} fill={i % 2 === 0 ? DIORAMA.white : light} opacity={night ? 0.55 : 0.95} />
      ))}
    </>
  );
}

export function TownScene({ hour, bandHeight = 620, groundY }: { hour: number; bandHeight?: number; groundY?: number }) {
  const band = skyBand(hour);
  const night = band === 'night';
  const ground = groundY ?? bandHeight * 0.72;
  const roof = ground - 250;
  const street = ground - 80;
  const sidewalk = night ? DIORAMA.townSidewalkNight : DIORAMA.townSidewalkDay;
  const sidewalkEdge = night ? DIORAMA.townSidewalkNightEdge : DIORAMA.townSidewalkDayEdge;
  const road = night ? DIORAMA.townRoadNight : DIORAMA.townRoadDay;
  const roadEdge = night ? DIORAMA.townRoadNightEdge : DIORAMA.townRoadDayEdge;

  return (
    <View style={styles.fill} pointerEvents="none">
      <LinearGradient colors={SKY[band]} style={styles.fill} />
      <View style={styles.fill}><OutdoorSky band={band} /></View>
      <Svg width="100%" height="100%" viewBox={`0 0 420 ${bandHeight}`} preserveAspectRatio="none" style={styles.fill}>
        <ShopFront x={-13} y={roof + 40} w={153} h={216} base={night ? DIORAMA.townCoralNight : DIORAMA.townCoral} light={DIORAMA.townCoralLight} edge={DIORAMA.townCoralEdge} night={night} />
        <ShopFront x={132} y={roof + 5} w={153} h={251} base={night ? DIORAMA.townBlueNight : DIORAMA.townBlue} light={DIORAMA.townBlueLight} edge={DIORAMA.townBlueEdge} night={night} />
        <ShopFront x={278} y={roof + 31} w={156} h={225} base={night ? DIORAMA.townVioletNight : DIORAMA.townViolet} light={DIORAMA.townVioletLight} edge={DIORAMA.townVioletEdge} night={night} />

        <Rect x={0} y={street + 8} width={420} height={82} fill={sidewalkEdge} />
        <Rect x={0} y={street} width={420} height={80} fill={sidewalk} />
        <Path d={`M0 ${street + 8} H420`} stroke={night ? DIORAMA.townSidewalkNightEdge : DIORAMA.townSidewalkDayLight} strokeWidth={6} opacity={night ? 0.5 : 0.68} />
        <Rect x={0} y={street + 80} width={420} height={bandHeight - street - 80} fill={roadEdge} />
        <Rect x={0} y={street + 80} width={420} height={Math.max(0, bandHeight - street - 88)} fill={road} />
        <Path d={`M24 ${street + 113} H105 M164 ${street + 113} H248 M307 ${street + 113} H392`} stroke={DIORAMA.paleCream} strokeWidth={6} opacity={night ? 0.34 : 0.72} strokeLinecap="round" />
      </Svg>

      <View style={{ position: 'absolute', left: 0, right: 0, top: roof + 51, height: 42 }}><Pennants night={night} /></View>
      {/* Planters pull the storefront finish into the playable ground plane. */}
      {[46, 339].map((x, i) => (
        <View key={x} style={{ position: 'absolute', left: x, top: street - 34 }}>
          <Svg width={55} height={62} viewBox="0 0 55 62">
            <Ellipse cx={27} cy={57} rx={21} ry={4} fill={DIORAMA.shadow} opacity={0.16} />
            <Path d="M10 30 H45 L40 56 H15 Z" fill={DIORAMA.planterEdge} />
            <Path d="M12 27 H43 L39 51 H16 Z" fill={DIORAMA.planter} />
            <Path d="M16 31 H39" stroke={DIORAMA.coralShine} strokeWidth={4} opacity={0.5} strokeLinecap="round" />
            <Circle cx={19} cy={23} r={8} fill={i ? DIORAMA.flowerBlue : DIORAMA.flowerPink} />
            <Circle cx={34} cy={18} r={9} fill={DIORAMA.flowerYellow} />
            <Path d="M22 29 l-3-12 M31 29 l3-15" stroke={DIORAMA.mintDeep} strokeWidth={4} />
          </Svg>
        </View>
      ))}
    </View>
  );
}

function BeachUmbrella({ night }: { night: boolean }) {
  return (
    <Svg width={120} height={166} viewBox="0 0 120 166">
      <Ellipse cx={63} cy={158} rx={34} ry={5} fill={DIORAMA.shadow} opacity={0.14} />
      <Path d="M61 58 V151" stroke={night ? DIORAMA.woodMid : DIORAMA.woodWarm} strokeWidth={7} strokeLinecap="round" />
      <Path d="M10 61 Q58 -8 110 61 Z" fill={DIORAMA.coralDeep} />
      <Path d="M10 55 Q58 -14 110 55 Z" fill={DIORAMA.coral} />
      <Path d="M26 49 Q58 0 90 49 Z" fill={DIORAMA.lemon} opacity={0.98} />
      <Path d="M26 42 Q57 4 87 44" stroke={DIORAMA.white} strokeWidth={5} opacity={0.38} strokeLinecap="round" />
    </Svg>
  );
}

export function BeachScene({ hour, bandHeight = 620, groundY }: { hour: number; bandHeight?: number; groundY?: number }) {
  const band = skyBand(hour);
  const night = band === 'night';
  const ground = groundY ?? bandHeight * 0.72;
  const tide = ground - 121;
  const horizon = tide - 96;
  const oceanLight = night ? DIORAMA.oceanNightLight : DIORAMA.oceanDayLight;
  const oceanEdge = night ? DIORAMA.oceanNightEdge : DIORAMA.oceanDayEdge;
  const sandLight = night ? DIORAMA.sandNightLight : DIORAMA.sandDayLight;
  const sandEdge = night ? DIORAMA.sandNightEdge : DIORAMA.sandDayEdge;

  return (
    <View style={styles.fill} pointerEvents="none">
      <LinearGradient colors={SKY[band]} style={styles.fill} />
      <View style={styles.fill}><OutdoorSky band={band} /></View>

      <View style={{ position: 'absolute', left: 0, right: 0, top: horizon, height: tide - horizon + 37, backgroundColor: oceanEdge }} />
      <LinearGradient colors={night ? [DIORAMA.oceanNightA, DIORAMA.oceanNightB] : [DIORAMA.oceanDayA, DIORAMA.oceanDayB]} style={{ position: 'absolute', left: 0, right: 0, top: horizon, height: tide - horizon + 29 }} />
      <View style={{ position: 'absolute', left: 20, right: 20, top: horizon + 11, height: 6, borderRadius: radius.pill, backgroundColor: oceanLight, opacity: night ? 0.15 : 0.32 }} />

      <View style={{ position: 'absolute', left: 0, right: 0, top: tide + 8, bottom: 0, backgroundColor: sandEdge }} />
      <LinearGradient colors={night ? [DIORAMA.sandNightFar, DIORAMA.sandNightNear] : [DIORAMA.sandDayFar, DIORAMA.sandDayNear]} style={{ position: 'absolute', left: 0, right: 0, top: tide, bottom: 0 }} />

      <Svg width="100%" height="100%" viewBox={`0 0 420 ${bandHeight}`} preserveAspectRatio="none" style={styles.fill}>
        <Path d={`M-10 ${tide + 5} Q50 ${tide - 9} 112 ${tide + 5} T232 ${tide + 4} T350 ${tide + 3} T430 ${tide + 4}`} stroke={night ? DIORAMA.foamNightShade : DIORAMA.foamDayShade} strokeWidth={13} fill="none" opacity={0.9} />
        <Path d={`M-10 ${tide} Q50 ${tide - 14} 112 ${tide} T232 ${tide - 1} T350 ${tide - 2} T430 ${tide - 1}`} stroke={night ? DIORAMA.foamNight : DIORAMA.foamDay} strokeWidth={9} fill="none" />
        <Path d={`M0 ${tide - 39} Q76 ${tide - 50} 152 ${tide - 39} T304 ${tide - 40} T430 ${tide - 39}`} stroke={oceanLight} strokeWidth={5} fill="none" opacity={night ? 0.18 : 0.42} />
        <Path d={`M45 ${ground + 71} Q210 ${ground + 94} 378 ${ground + 71}`} stroke={sandLight} strokeWidth={4} fill="none" opacity={night ? 0.1 : 0.32} />
        <Path d={`M326 ${ground + 53} l8 14 l-15 -4 l13 -8 l-3 15`} stroke={DIORAMA.starfish} strokeWidth={6} fill="none" strokeLinecap="round" />
      </Svg>

      <View style={{ position: 'absolute', left: -20, top: ground - 85 }}>
        <Svg width={140} height={234} viewBox="0 0 140 234">
          <Ellipse cx={38} cy={209} rx={84} ry={32} fill={night ? DIORAMA.sandNightFar : DIORAMA.sandDayFar} />
          <Path d="M0 202 Q60 181 121 204" stroke={sandLight} strokeWidth={6} opacity={night ? 0.09 : 0.34} fill="none" />
          {[20, 36, 54, 72, 90].map((x, i) => <Path key={x} d={`M${x} 210 Q${x + (i % 2 ? 18 : -12)} 136 ${x + (i % 3) * 8 - 4} 94`} stroke={night ? DIORAMA.grassBeachNight : DIORAMA.grassBeachDay} strokeWidth={6 - (i % 2)} fill="none" strokeLinecap="round" />)}
          {!night && <Path d="M29 183 Q44 148 53 126" stroke={DIORAMA.grassBeachLight} strokeWidth={3} opacity={0.65} />}
        </Svg>
      </View>
      <View style={{ position: 'absolute', right: -15, top: ground - 156, opacity: 0.92 }}><BeachUmbrella night={night} /></View>
    </View>
  );
}

export function NightOverlay() {
  return <View style={[styles.fill, { backgroundColor: DIORAMA.skyNightA, opacity: 0.16 }]} pointerEvents="none" />;
}

export function RoomBed({ upgraded = false, top }: { upgraded?: boolean; top?: number }) {
  const rim = upgraded ? DIORAMA.bedRim : DIORAMA.woodMid;
  const wall = upgraded ? DIORAMA.bedWall : DIORAMA.woodWarm;
  const cushion = upgraded ? DIORAMA.bedCushion : DIORAMA.cream;
  const edge = upgraded ? DIORAMA.bedEdge : DIORAMA.woodDeep;
  return (
    <View style={[styles.roomBed, top !== undefined && { top, bottom: undefined }]} pointerEvents="none">
      <Svg width={132} height={66} viewBox="0 0 132 66">
        <Ellipse cx={66} cy={55} rx={64} ry={9} fill={DIORAMA.shadow} opacity={0.18} />
        <Ellipse cx={66} cy={40} rx={64} ry={22} fill={edge} />
        <Ellipse cx={66} cy={34} rx={62} ry={22} fill={rim} />
        <Ellipse cx={66} cy={30} rx={55} ry={17} fill={wall} />
        <Ellipse cx={66} cy={36} rx={47} ry={12} fill={cushion} />
        <Path d="M4 34 a62 22 0 0 0 124 0 a62 25 0 0 1 -124 0 Z" fill={rim} />
        <Path d="M22 18 Q66 7 110 18" stroke={DIORAMA.white} strokeWidth={5} fill="none" opacity={0.3} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

export function DogBedBack({ upgraded = false }: { upgraded?: boolean }) {
  const rim = upgraded ? DIORAMA.bedRim : DIORAMA.woodMid;
  const wall = upgraded ? DIORAMA.bedWall : DIORAMA.woodWarm;
  const cushion = upgraded ? DIORAMA.bedCushion : DIORAMA.cream;
  const edge = upgraded ? DIORAMA.bedEdge : DIORAMA.woodDeep;
  return (
    <View style={styles.bedBack} pointerEvents="none">
      <Svg width={348} height={112} viewBox="0 0 348 112">
        <Ellipse cx={174} cy={75} rx={170} ry={43} fill={DIORAMA.shadow} opacity={0.18} />
        <Ellipse cx={174} cy={60} rx={170} ry={47} fill={edge} />
        <Ellipse cx={174} cy={53} rx={170} ry={46} fill={rim} />
        <Ellipse cx={174} cy={48} rx={152} ry={37} fill={wall} />
        <Ellipse cx={174} cy={55} rx={132} ry={29} fill={cushion} />
        <Path d="M45 29 Q174 5 303 29" stroke={DIORAMA.white} strokeWidth={7} fill="none" opacity={0.27} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

export function DogBedFront({ upgraded = false }: { upgraded?: boolean }) {
  const rim = upgraded ? DIORAMA.bedRim : DIORAMA.woodMid;
  const wall = upgraded ? DIORAMA.bedWall : DIORAMA.woodWarm;
  const edge = upgraded ? DIORAMA.bedEdge : DIORAMA.woodDeep;
  return (
    <View style={styles.bedFront} pointerEvents="none">
      <Svg width={348} height={61} viewBox="0 0 348 61">
        <Ellipse cx={174} cy={11} rx={170} ry={47} fill={edge} />
        <Ellipse cx={174} cy={5} rx={170} ry={46} fill={rim} />
        <Ellipse cx={174} cy={0} rx={152} ry={38} fill={wall} />
        <Path d="M48 12 Q174 33 300 12" stroke={DIORAMA.white} strokeWidth={6} fill="none" opacity={0.22} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  roomBed: { position: 'absolute', left: '3%' },
  bedBack: { position: 'absolute', bottom: 10, alignSelf: 'center' },
  bedFront: { position: 'absolute', bottom: -6, alignSelf: 'center' },
});