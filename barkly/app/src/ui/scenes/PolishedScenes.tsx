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

function Contact({ width, opacity = 0.2 }: { width: number; opacity?: number }) {
  return (
    <Svg width={width} height={18} viewBox={`0 0 ${width} 18`}>
      <Ellipse cx={width / 2} cy={9} rx={width * 0.46} ry={7} fill={DIORAMA.shadow} opacity={opacity} />
      <Ellipse cx={width / 2} cy={8} rx={width * 0.31} ry={4} fill={DIORAMA.shadow} opacity={opacity + 0.08} />
    </Svg>
  );
}

function Window({ band, large }: { band: SkyBand; large: boolean }) {
  const night = band === 'night';
  const w = large ? 174 : 144;
  const h = large ? 126 : 108;
  const frame = night ? DIORAMA.windowFrameNight : DIORAMA.windowFrameDay;
  return (
    <View style={{ width: w, height: h, borderRadius: radius.md, overflow: 'hidden', borderWidth: 8, borderColor: frame, backgroundColor: frame }}>
      <LinearGradient colors={SKY[band]} style={StyleSheet.absoluteFill} />
      <Svg width="100%" height="100%" viewBox="0 0 160 110" preserveAspectRatio="none">
        {night ? (
          <>
            <Circle cx={120} cy={26} r={16} fill={DIORAMA.goldLight} />
            <Circle cx={112} cy={20} r={15} fill={DIORAMA.skyNightA} />
            <Circle cx={42} cy={24} r={2} fill={DIORAMA.paleCream} />
            <Circle cx={78} cy={42} r={1.7} fill={DIORAMA.paleCream} />
          </>
        ) : (
          <>
            <Circle cx={122} cy={24} r={16} fill={DIORAMA.lemon} />
            <Ellipse cx={42} cy={46} rx={27} ry={10} fill={DIORAMA.white} opacity={0.9} />
            <Ellipse cx={90} cy={56} rx={22} ry={8} fill={DIORAMA.white} opacity={0.7} />
          </>
        )}
        <Path d="M0 86 Q42 67 84 83 T160 80 V110 H0 Z" fill={night ? DIORAMA.hillNight : DIORAMA.hillDay} />
      </Svg>
      <View style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 5, backgroundColor: frame }} />
      <View style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 5, backgroundColor: frame }} />
      <View style={{ position: 'absolute', left: 10, right: 10, top: 5, height: 5, borderRadius: radius.pill, backgroundColor: DIORAMA.white, opacity: 0.45 }} />
    </View>
  );
}

function Sofa({ night }: { night: boolean }) {
  const back = night ? DIORAMA.couchNight : DIORAMA.couchDay;
  const top = night ? DIORAMA.couchNightTop : DIORAMA.couchDayTop;
  const seat = night ? DIORAMA.couchNightSeat : DIORAMA.couchDaySeat;
  return (
    <View style={{ width: 194, height: 116 }}>
      <View style={{ position: 'absolute', left: 4, right: 4, bottom: -4, alignItems: 'center' }}><Contact width={186} /></View>
      <Svg width={194} height={112} viewBox="0 0 194 112">
        <Rect x={16} y={10} width={162} height={62} rx={20} fill={back} />
        <Rect x={16} y={10} width={162} height={22} rx={14} fill={top} />
        <Rect x={0} y={42} width={36} height={58} rx={16} fill={back} />
        <Rect x={158} y={42} width={36} height={58} rx={16} fill={back} />
        <Rect x={31} y={64} width={63} height={34} rx={13} fill={seat} />
        <Rect x={98} y={64} width={62} height={34} rx={13} fill={seat} />
        <Path d="M38 71 h50 M105 71 h48" stroke={top} strokeWidth={3} strokeLinecap="round" opacity={0.85} />
        <Rect x={28} y={31} width={39} height={38} rx={11} fill={DIORAMA.lemon} transform="rotate(-9 47 50)" />
        <Path d="M27 19 H165" stroke={DIORAMA.white} strokeWidth={5} opacity={0.24} strokeLinecap="round" />
        <Rect x={16} y={98} width={11} height={11} rx={4} fill={DIORAMA.woodDeep} />
        <Rect x={167} y={98} width={11} height={11} rx={4} fill={DIORAMA.woodDeep} />
      </Svg>
    </View>
  );
}

function Portrait({ night }: { night: boolean }) {
  const frame = night ? DIORAMA.windowSillNight : DIORAMA.woodWarm;
  return (
    <View style={{ width: 82, alignItems: 'center' }}>
      <View style={{ width: 76, height: 70, borderRadius: radius.sm, borderWidth: 6, borderColor: frame, backgroundColor: DIORAMA.cream, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', left: 6, right: 6, top: 4, height: 5, borderRadius: radius.pill, backgroundColor: DIORAMA.white, opacity: 0.5 }} />
        <Image source={FACE} style={{ width: 57, height: 52 }} resizeMode="contain" />
      </View>
    </View>
  );
}

function Lamp({ night }: { night: boolean }) {
  return (
    <Svg width={82} height={164} viewBox="0 0 82 164">
      {night && <Circle cx={42} cy={28} r={38} fill={DIORAMA.goldGlow} opacity={0.28} />}
      <Rect x={39} y={42} width={6} height={102} rx={3} fill={DIORAMA.woodDark} />
      <Ellipse cx={42} cy={149} rx={24} ry={7} fill={DIORAMA.woodDeep} />
      <Path d="M21 7 H63 L72 43 H12 Z" fill={night ? DIORAMA.goldGlow : DIORAMA.gold} />
      <Path d="M25 11 H59 L62 20 H22 Z" fill={DIORAMA.goldLight} opacity={0.72} />
    </Svg>
  );
}

function Pennants({ night }: { night: boolean }) {
  const colors = [DIORAMA.pennantRed, DIORAMA.pennantYellow, DIORAMA.pennantBlue, DIORAMA.pennantGreen];
  return (
    <Svg width="100%" height={42} viewBox="0 0 420 42" preserveAspectRatio="none">
      <Path d="M0 5 Q210 34 420 5" stroke={night ? DIORAMA.windowSillNight : DIORAMA.woodWarm} strokeWidth={2} fill="none" opacity={0.75} />
      {Array.from({ length: 10 }, (_, i) => {
        const x = 18 + i * 42;
        const sag = 8 + Math.sin(((i + 0.5) / 10) * Math.PI) * 13;
        return <Path key={i} d={`M${x} ${sag} L${x + 18} ${sag + 2} L${x + 10} ${sag + 18} Z`} fill={colors[i % colors.length]} opacity={night ? 0.78 : 1} />;
      })}
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
  const sofaTop = floorTop - 92;
  const windowTop = wallTop + 48;
  const portraitTop = wallTop + 58;

  return (
    <View style={styles.fill} pointerEvents="none">
      <LinearGradient colors={night ? [DIORAMA.wallNightA, DIORAMA.wallNightB] : [DIORAMA.wallDayA, DIORAMA.wallDayB]} style={[styles.fill, { bottom: undefined, height: floorTop }]} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: wallTop, height: 42 }}><Pennants night={night} /></View>
      <View style={{ position: 'absolute', left: 0, right: 0, top: floorTop - 17, height: 17, backgroundColor: night ? DIORAMA.floorNightFar : DIORAMA.woodSoft }} />
      <LinearGradient colors={night ? [DIORAMA.floorNightFar, DIORAMA.floorNightNear] : [DIORAMA.floorDayFar, DIORAMA.floorDayNear]} style={{ position: 'absolute', left: 0, right: 0, top: floorTop, bottom: 0 }} />

      <Svg width="100%" height="100%" viewBox="0 0 420 760" preserveAspectRatio="none" style={styles.fill}>
        {[50, 126, 204, 284, 366].map((x) => <Path key={x} d={`M${x} ${floorTop} L${210 + (x - 210) * 2} 760`} stroke={night ? DIORAMA.woodNight : DIORAMA.woodDay} strokeWidth={2} opacity={0.32} />)}
        {[floorTop + 62, floorTop + 142, floorTop + 238].map((y, i) => <Path key={y} d={`M0 ${y} H420`} stroke={night ? DIORAMA.woodNight : DIORAMA.woodDay} strokeWidth={1.5 + i * 0.5} opacity={0.25} />)}
      </Svg>

      <View style={{ position: 'absolute', left: 16, top: windowTop }}><Window band={band} large={has('home_window')} /></View>
      <View style={{ position: 'absolute', left: 6, top: sofaTop }}><Sofa night={night} /></View>
      <View style={{ position: 'absolute', right: 36, top: portraitTop }}><Portrait night={night} /></View>
      <View style={{ position: 'absolute', right: 4, top: floorTop - 150 }}><Lamp night={night} /></View>

      {has('home_rug') && (
        <View style={{ position: 'absolute', alignSelf: 'center', top: groundY - 40, width: 286, height: 72 }}>
          <Svg width="100%" height="100%" viewBox="0 0 286 72" preserveAspectRatio="none">
            <Ellipse cx={143} cy={38} rx={140} ry={32} fill={DIORAMA.violet} />
            <Ellipse cx={143} cy={36} rx={121} ry={24} fill={DIORAMA.violetLight} />
            <Path d="M35 38 Q73 14 111 38 T187 38 T251 38" stroke={DIORAMA.lemon} strokeWidth={7} fill="none" opacity={0.92} />
            <Path d="M44 21 Q143 4 242 21" stroke={DIORAMA.white} strokeWidth={4} fill="none" opacity={0.22} />
          </Svg>
        </View>
      )}

      {has('home_bed') && !asleep && <RoomBed upgraded top={groundY - 48} />}
      <View style={{ position: 'absolute', right: 0, top: floorTop - 4, bottom: 0, width: 20, backgroundColor: night ? DIORAMA.woodDeep : DIORAMA.woodDark, opacity: 0.9 }} />
    </View>
  );
}

function OutdoorSky({ band }: { band: SkyBand }) {
  const night = band === 'night';
  return (
    <Svg width="100%" height="100%" viewBox="0 0 420 420" preserveAspectRatio="none">
      {night ? (
        <>
          <Circle cx={350} cy={110} r={25} fill={DIORAMA.goldLight} />
          <Circle cx={339} cy={101} r={22} fill={DIORAMA.skyNightA} />
          {[52, 122, 216, 290].map((x, i) => <Circle key={x} cx={x} cy={72 + i * 23} r={1.8} fill={DIORAMA.paleCream} />)}
        </>
      ) : (
        <>
          <Circle cx={350} cy={104} r={34} fill={DIORAMA.lemon} opacity={0.2} />
          <Circle cx={350} cy={104} r={20} fill={DIORAMA.lemon} />
          <Ellipse cx={85} cy={122} rx={47} ry={15} fill={DIORAMA.white} opacity={0.82} />
          <Ellipse cx={224} cy={92} rx={34} ry={11} fill={DIORAMA.white} opacity={0.66} />
        </>
      )}
    </Svg>
  );
}

export function ParkScene({ hour, bandHeight = 620, groundY }: { hour: number; bandHeight?: number; groundY?: number }) {
  const band = skyBand(hour);
  const night = band === 'night';
  const ground = groundY ?? bandHeight * 0.72;
  const horizon = ground - 148;
  return (
    <View style={styles.fill} pointerEvents="none">
      <LinearGradient colors={SKY[band]} style={styles.fill} />
      <View style={styles.fill}><OutdoorSky band={band} /></View>
      <Svg width="100%" height="100%" viewBox={`0 0 420 ${bandHeight}`} preserveAspectRatio="none" style={styles.fill}>
        <Path d={`M0 ${horizon + 24} Q80 ${horizon - 30} 172 ${horizon + 14} T420 ${horizon + 8} V${bandHeight} H0 Z`} fill={night ? DIORAMA.parkHillNight : DIORAMA.parkHillDay} />
        <Path d={`M0 ${horizon + 62} Q92 ${horizon + 8} 210 ${horizon + 56} T420 ${horizon + 42} V${bandHeight} H0 Z`} fill={night ? DIORAMA.parkGrassNight : DIORAMA.parkGrassDay} />
        <Path d={`M176 ${horizon + 18} L244 ${horizon + 18} L390 ${bandHeight} L40 ${bandHeight} Z`} fill={night ? DIORAMA.parkPathNight : DIORAMA.parkPathDay} />
        <Path d={`M190 ${horizon + 18} L230 ${horizon + 18} L337 ${bandHeight} L94 ${bandHeight} Z`} fill={DIORAMA.white} opacity={night ? 0.05 : 0.16} />
        <Rect x={42} y={horizon + 50} width={96} height={12} rx={6} fill={DIORAMA.woodWarm} />
        <Rect x={46} y={horizon + 65} width={88} height={9} rx={5} fill={DIORAMA.woodSoft} />
        <Rect x={52} y={horizon + 72} width={8} height={34} rx={4} fill={DIORAMA.woodDark} />
        <Rect x={122} y={horizon + 72} width={8} height={34} rx={4} fill={DIORAMA.woodDark} />
        <Path d={`M28 ${horizon + 49} H148`} stroke={DIORAMA.white} strokeWidth={3} opacity={0.22} strokeLinecap="round" />
      </Svg>
      <View style={{ position: 'absolute', left: -44, top: horizon - 122 }}>
        <Svg width={190} height={280} viewBox="0 0 190 280">
          <Rect x={68} y={74} width={28} height={206} rx={12} fill={DIORAMA.woodDark} />
          <Ellipse cx={82} cy={70} rx={94} ry={68} fill={night ? DIORAMA.parkTreeNight : DIORAMA.parkTreeDay} />
          <Ellipse cx={34} cy={118} rx={58} ry={46} fill={night ? DIORAMA.parkTreeNightLight : DIORAMA.parkTreeDayLight} />
          <Path d="M28 48 Q80 20 132 48" stroke={DIORAMA.white} strokeWidth={6} opacity={0.12} strokeLinecap="round" />
        </Svg>
      </View>
      <View style={{ position: 'absolute', right: 18, top: ground - 58 }}><Contact width={84} opacity={0.12} /></View>
    </View>
  );
}

export function TownScene({ hour, bandHeight = 620, groundY }: { hour: number; bandHeight?: number; groundY?: number }) {
  const band = skyBand(hour);
  const night = band === 'night';
  const ground = groundY ?? bandHeight * 0.72;
  const roof = ground - 244;
  const street = ground - 76;
  const shop = (day: string, nite: string) => night ? nite : day;
  return (
    <View style={styles.fill} pointerEvents="none">
      <LinearGradient colors={SKY[band]} style={styles.fill} />
      <View style={styles.fill}><OutdoorSky band={band} /></View>
      <Svg width="100%" height="100%" viewBox={`0 0 420 ${bandHeight}`} preserveAspectRatio="none" style={styles.fill}>
        <Rect x={-12} y={roof + 34} width={150} height={218} rx={18} fill={shop(DIORAMA.townCoral, DIORAMA.townCoralNight)} />
        <Rect x={133} y={roof + 4} width={150} height={248} rx={18} fill={shop(DIORAMA.townBlue, DIORAMA.townBlueNight)} />
        <Rect x={278} y={roof + 26} width={154} height={226} rx={18} fill={shop(DIORAMA.townViolet, DIORAMA.townVioletNight)} />
        <Rect x={-6} y={roof + 46} width={136} height={16} rx={8} fill={DIORAMA.white} opacity={0.22} />
        <Rect x={143} y={roof + 16} width={130} height={16} rx={8} fill={DIORAMA.white} opacity={0.22} />
        <Rect x={288} y={roof + 38} width={134} height={16} rx={8} fill={DIORAMA.white} opacity={0.22} />
        <Rect x={18} y={roof + 108} width={92} height={62} rx={10} fill={night ? DIORAMA.glassNight : DIORAMA.glassDay} />
        <Rect x={160} y={roof + 82} width={94} height={72} rx={10} fill={night ? DIORAMA.glassNight : DIORAMA.glassDay} />
        <Rect x={305} y={roof + 104} width={98} height={64} rx={10} fill={night ? DIORAMA.glassNight : DIORAMA.glassDay} />
        <Rect x={0} y={street} width={420} height={78} fill={night ? DIORAMA.townSidewalkNight : DIORAMA.townSidewalkDay} />
        <Rect x={0} y={street + 78} width={420} height={bandHeight - street - 78} fill={night ? DIORAMA.townRoadNight : DIORAMA.townRoadDay} />
        <Path d={`M0 ${street + 8} H420`} stroke={DIORAMA.white} strokeWidth={5} opacity={0.18} />
        <Path d={`M28 ${roof + 89} H98 M170 ${roof + 64} H244 M316 ${roof + 86} H392`} stroke={DIORAMA.ink} strokeWidth={8} opacity={0.14} strokeLinecap="round" />
      </Svg>
      <View style={{ position: 'absolute', left: 0, right: 0, top: roof + 50, height: 40 }}><Pennants night={night} /></View>
    </View>
  );
}

export function BeachScene({ hour, bandHeight = 620, groundY }: { hour: number; bandHeight?: number; groundY?: number }) {
  const band = skyBand(hour);
  const night = band === 'night';
  const ground = groundY ?? bandHeight * 0.72;
  const tide = ground - 118;
  const horizon = tide - 92;
  return (
    <View style={styles.fill} pointerEvents="none">
      <LinearGradient colors={SKY[band]} style={styles.fill} />
      <View style={styles.fill}><OutdoorSky band={band} /></View>
      <LinearGradient colors={night ? [DIORAMA.oceanNightA, DIORAMA.oceanNightB] : [DIORAMA.oceanDayA, DIORAMA.oceanDayB]} style={{ position: 'absolute', left: 0, right: 0, top: horizon, height: tide - horizon + 30 }} />
      <LinearGradient colors={night ? [DIORAMA.sandNightFar, DIORAMA.sandNightNear] : [DIORAMA.sandDayFar, DIORAMA.sandDayNear]} style={{ position: 'absolute', left: 0, right: 0, top: tide, bottom: 0 }} />
      <Svg width="100%" height="100%" viewBox={`0 0 420 ${bandHeight}`} preserveAspectRatio="none" style={styles.fill}>
        <Path d={`M-10 ${tide + 4} Q50 ${tide - 8} 112 ${tide + 5} T232 ${tide + 4} T350 ${tide + 3} T430 ${tide + 4}`} stroke={night ? DIORAMA.foamNight : DIORAMA.foamDay} strokeWidth={8} fill="none" />
        <Path d={`M-10 ${tide + 16} Q62 ${tide + 8} 132 ${tide + 16} T276 ${tide + 15} T430 ${tide + 16}`} stroke={night ? DIORAMA.foamNightShade : DIORAMA.foamDayShade} strokeWidth={4} fill="none" opacity={0.9} />
        <Path d={`M40 ${ground + 70} Q210 ${ground + 92} 380 ${ground + 70}`} stroke={night ? DIORAMA.sandNightFar : DIORAMA.woodSoft} strokeWidth={3} fill="none" opacity={0.36} />
        <Path d={`M326 ${ground + 52} l8 14 l-15 -4 l13 -8 l-3 15`} stroke={DIORAMA.starfish} strokeWidth={5} fill="none" strokeLinecap="round" />
      </Svg>
      <View style={{ position: 'absolute', left: -20, top: ground - 80 }}>
        <Svg width={136} height={230} viewBox="0 0 136 230">
          <Ellipse cx={36} cy={205} rx={82} ry={32} fill={night ? DIORAMA.sandNightFar : DIORAMA.sandDayFar} />
          {[20, 36, 54, 72, 90].map((x, i) => <Path key={x} d={`M${x} 208 Q${x + (i % 2 ? 18 : -12)} 134 ${x + (i % 3) * 8 - 4} 92`} stroke={night ? DIORAMA.grassBeachNight : DIORAMA.grassBeachDay} strokeWidth={5 - (i % 2)} fill="none" strokeLinecap="round" />)}
        </Svg>
      </View>
    </View>
  );
}

export function NightOverlay() {
  return <View style={[styles.fill, { backgroundColor: DIORAMA.skyNightA, opacity: 0.18 }]} pointerEvents="none" />;
}

export function RoomBed({ upgraded = false, top }: { upgraded?: boolean; top?: number }) {
  const rim = upgraded ? DIORAMA.bedRim : DIORAMA.woodMid;
  const wall = upgraded ? DIORAMA.bedWall : DIORAMA.woodWarm;
  const cushion = upgraded ? DIORAMA.bedCushion : DIORAMA.cream;
  return (
    <View style={[styles.roomBed, top !== undefined && { top, bottom: undefined }]} pointerEvents="none">
      <Svg width={124} height={60} viewBox="0 0 132 62">
        <Ellipse cx={66} cy={39} rx={64} ry={20} fill={DIORAMA.shadow} opacity={0.16} />
        <Ellipse cx={66} cy={33} rx={62} ry={22} fill={rim} />
        <Ellipse cx={66} cy={30} rx={55} ry={17} fill={wall} />
        <Ellipse cx={66} cy={35} rx={47} ry={12} fill={cushion} />
        <Path d="M4 33 a62 22 0 0 0 124 0 a62 25 0 0 1 -124 0 Z" fill={rim} />
        <Path d="M22 18 Q66 7 110 18" stroke={DIORAMA.white} strokeWidth={4} fill="none" opacity={0.22} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

export function DogBedBack({ upgraded = false }: { upgraded?: boolean }) {
  const rim = upgraded ? DIORAMA.bedRim : DIORAMA.woodMid;
  const wall = upgraded ? DIORAMA.bedWall : DIORAMA.woodWarm;
  const cushion = upgraded ? DIORAMA.bedCushion : DIORAMA.cream;
  return (
    <View style={styles.bedBack} pointerEvents="none">
      <Svg width={348} height={104} viewBox="0 0 348 104">
        <Ellipse cx={174} cy={57} rx={170} ry={42} fill={DIORAMA.shadow} opacity={0.16} />
        <Ellipse cx={174} cy={52} rx={170} ry={46} fill={rim} />
        <Ellipse cx={174} cy={47} rx={152} ry={37} fill={wall} />
        <Ellipse cx={174} cy={54} rx={132} ry={29} fill={cushion} />
        <Path d="M45 29 Q174 5 303 29" stroke={DIORAMA.white} strokeWidth={6} fill="none" opacity={0.2} strokeLinecap="round" />
      </Svg>
    </View>
  );
}

export function DogBedFront({ upgraded = false }: { upgraded?: boolean }) {
  const rim = upgraded ? DIORAMA.bedRim : DIORAMA.woodMid;
  const wall = upgraded ? DIORAMA.bedWall : DIORAMA.woodWarm;
  return (
    <View style={styles.bedFront} pointerEvents="none">
      <Svg width={348} height={56} viewBox="0 0 348 56">
        <Ellipse cx={174} cy={6} rx={170} ry={46} fill={rim} />
        <Ellipse cx={174} cy={0} rx={152} ry={38} fill={wall} />
        <Path d="M48 11 Q174 32 300 11" stroke={DIORAMA.white} strokeWidth={5} fill="none" opacity={0.16} strokeLinecap="round" />
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
