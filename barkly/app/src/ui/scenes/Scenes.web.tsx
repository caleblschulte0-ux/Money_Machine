import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { Drift, GroundPlane, LightPool, Motes, Sway, Vignette } from './depth';
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

function Pennants({ top, night }: { top: number; night: boolean }) {
  const colors = [DIORAMA.pennantRed, DIORAMA.pennantYellow, DIORAMA.pennantBlue, DIORAMA.pennantGreen];
  return (
    <View style={{ position: 'absolute', left: 24, right: 24, top }}>
      <Svg width="100%" height={38} viewBox="0 0 372 38" preserveAspectRatio="none">
        <Path d="M0 5 Q186 34 372 5" stroke={night ? DIORAMA.goldLight : DIORAMA.woodWarm} strokeWidth={2} fill="none" opacity={0.65} />
        {Array.from({ length: 9 }, (_, i) => {
          const x = 18 + i * 42;
          const sag = 8 + Math.sin(((i + 0.5) / 9) * Math.PI) * 13;
          return <Path key={i} d={`M${x} ${sag} L${x + 18} ${sag + 2} L${x + 10} ${sag + 18} Z`} fill={colors[i % colors.length]} opacity={night ? 0.78 : 0.96} />;
        })}
      </Svg>
    </View>
  );
}

function WindowView({ band, width, height }: { band: SkyBand; width: number; height: number }) {
  const night = band === 'night';
  const frame = night ? DIORAMA.windowFrameNight : DIORAMA.windowFrameDay;
  return (
    <View style={{ width, height, borderRadius: radius.md, overflow: 'hidden', borderWidth: 7, borderColor: frame, backgroundColor: frame }}>
      <LinearGradient colors={SKY[band]} style={StyleSheet.absoluteFill} />
      <Svg width="100%" height="100%" viewBox="0 0 150 110" preserveAspectRatio="none">
        {night ? (
          <>
            <Circle cx={112} cy={28} r={16} fill={DIORAMA.goldLight} />
            <Circle cx={104} cy={23} r={15} fill={DIORAMA.skyNightA} />
            {[24, 48, 76, 132].map((x, i) => <Circle key={x} cx={x} cy={18 + (i % 2) * 28} r={1.8} fill={DIORAMA.paleCream} />)}
          </>
        ) : (
          <>
            <Circle cx={116} cy={25} r={14} fill={DIORAMA.pennantYellow} opacity={0.9} />
            <Ellipse cx={40} cy={42} rx={26} ry={10} fill={DIORAMA.white} opacity={0.78} />
            <Ellipse cx={92} cy={52} rx={20} ry={8} fill={DIORAMA.white} opacity={0.58} />
          </>
        )}
        <Path d="M0 83 Q36 66 76 82 T150 78 V110 H0 Z" fill={night ? DIORAMA.hillNight : DIORAMA.hillDay} opacity={0.9} />
      </Svg>
      <View style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 5, backgroundColor: frame }} />
      <View style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 5, backgroundColor: frame }} />
      <View style={{ position: 'absolute', left: -8, right: -8, bottom: 0, height: 8, backgroundColor: night ? DIORAMA.windowSillNight : DIORAMA.windowSillDay }} />
    </View>
  );
}

function Sofa({ night, top }: { night: boolean; top: number }) {
  const back = night ? DIORAMA.couchNight : DIORAMA.couchDay;
  const topFace = night ? DIORAMA.couchNightTop : DIORAMA.couchDayTop;
  const seat = night ? DIORAMA.couchNightSeat : DIORAMA.couchDaySeat;
  return (
    <View style={{ position: 'absolute', left: 10, top }}>
      <Svg width={184} height={112} viewBox="0 0 184 112">
        <Ellipse cx={92} cy={104} rx={83} ry={7} fill={DIORAMA.shadow} opacity={0.2} />
        <Rect x={16} y={8} width={152} height={62} rx={19} fill={back} />
        <Rect x={16} y={8} width={152} height={24} rx={13} fill={topFace} />
        <Rect x={0} y={38} width={34} height={58} rx={15} fill={back} />
        <Rect x={150} y={38} width={34} height={58} rx={15} fill={back} />
        <Rect x={31} y={61} width={60} height={35} rx={12} fill={seat} />
        <Rect x={93} y={61} width={58} height={35} rx={12} fill={seat} />
        <Path d="M37 69 h48 M99 69 h46" stroke={back} strokeWidth={2} opacity={0.7} />
        <Rect x={25} y={30} width={36} height={36} rx={10} fill={DIORAMA.lemon} transform="rotate(-8 43 48)" />
        <Rect x={13} y={94} width={10} height={15} rx={4} fill={night ? DIORAMA.woodDark : DIORAMA.woodMid} />
        <Rect x={161} y={94} width={10} height={15} rx={4} fill={night ? DIORAMA.woodDark : DIORAMA.woodMid} />
      </Svg>
    </View>
  );
}

function WallPortrait({ top, night }: { top: number; night: boolean }) {
  return (
    <View style={{ position: 'absolute', right: 42, top, alignItems: 'center' }}>
      <View style={{ width: 76, height: 70, borderRadius: radius.sm, borderWidth: 6, borderColor: night ? DIORAMA.windowSillNight : DIORAMA.woodWarm, backgroundColor: DIORAMA.cream, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '2deg' }] }}>
        <Image source={FACE} style={{ width: 57, height: 52 }} resizeMode="contain" />
      </View>
      <View style={{ width: 92, height: 8, borderRadius: radius.xs, marginTop: 7, backgroundColor: night ? DIORAMA.windowSillNight : DIORAMA.woodMid }} />
      <View style={{ width: 64, height: 5, borderRadius: radius.xs, marginTop: 3, backgroundColor: night ? DIORAMA.woodDark : DIORAMA.woodSoft, opacity: 0.8 }} />
    </View>
  );
}

function FloorLamp({ top, night }: { top: number; night: boolean }) {
  return (
    <View style={{ position: 'absolute', right: 10, top }}>
      <Svg width={88} height={164} viewBox="0 0 88 164">
        {night && <Circle cx={45} cy={26} r={42} fill={DIORAMA.goldGlow} opacity={0.25} />}
        <Rect x={42} y={37} width={6} height={106} rx={3} fill={night ? DIORAMA.woodDark : DIORAMA.woodMid} />
        <Ellipse cx={45} cy={147} rx={23} ry={7} fill={night ? DIORAMA.woodDeep : DIORAMA.woodDark} />
        <Path d="M23 5 H66 L75 42 H14 Z" fill={night ? DIORAMA.goldGlow : DIORAMA.gold} />
        <Path d="M25 8 H64 L68 18 H21 Z" fill={DIORAMA.goldLight} opacity={0.55} />
        {night && <Ellipse cx={45} cy={43} rx={22} ry={6} fill={DIORAMA.goldGlowSoft} opacity={0.8} />}
      </Svg>
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
  const night = band === 'night';
  const has = (id: string) => upgrades.includes(id);
  const bigWindow = has('home_window');

  // Hard composition zones: wall fixtures end before furniture begins.
  const floorTop = Math.max(chromeBottom + 102, groundY - 118);
  const wallTop = chromeBottom + 14;
  const sofaTop = floorTop - 94;
  const windowTop = wallTop + 18;
  const windowHeight = Math.max(76, Math.min(bigWindow ? 128 : 104, sofaTop - windowTop - 18));
  const windowWidth = bigWindow ? 168 : 138;

  return (
    <View style={styles.fill} pointerEvents="none">
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: floorTop }}>
        <LinearGradient colors={night ? [DIORAMA.wallNightA, DIORAMA.wallNightB] : [DIORAMA.wallDayA, DIORAMA.wallDayB]} style={StyleSheet.absoluteFill} />
        <Pennants top={wallTop} night={night} />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 18, backgroundColor: night ? DIORAMA.floorNightFar : DIORAMA.gold }} />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 18, height: 3, backgroundColor: night ? DIORAMA.woodDark : DIORAMA.windowSillDay }} />
      </View>

      <GroundPlane top={floorTop} far={night ? DIORAMA.floorNightFar : DIORAMA.floorDayFar} near={night ? DIORAMA.floorNightNear : DIORAMA.floorDayNear}>
        <Svg width="100%" height="100%" viewBox="0 0 420 300" preserveAspectRatio="none">
          {[35, 105, 175, 245, 315, 385].map((x) => <Path key={x} d={`M${x} 0 L${210 + (x - 210) * 1.8} 300`} stroke={night ? DIORAMA.woodNight : DIORAMA.woodDay} strokeWidth={2} opacity={0.32} />)}
          {[58, 134, 224].map((y, i) => <Path key={y} d={`M0 ${y} H420`} stroke={night ? DIORAMA.woodNight : DIORAMA.woodDay} strokeWidth={1.5 + i * 0.55} opacity={0.24 + i * 0.05} />)}
        </Svg>
      </GroundPlane>

      <View style={{ position: 'absolute', left: 18, top: windowTop }}><WindowView band={band} width={windowWidth} height={windowHeight} /></View>
      <Sofa night={night} top={sofaTop} />
      <WallPortrait top={wallTop + 44} night={night} />
      <FloorLamp top={floorTop - 152} night={night} />

      {!night && (
        <View style={{ position: 'absolute', left: 18, right: 132, top: floorTop, height: 205 }}>
          <Svg width="100%" height="100%" viewBox="0 0 290 205" preserveAspectRatio="none">
            <Path d="M20 0 L112 0 L250 205 L78 205 Z" fill={DIORAMA.goldLight} opacity={0.2} />
            <Path d="M74 0 L88 0 L226 205 L210 205 Z" fill={DIORAMA.paleCream} opacity={0.22} />
          </Svg>
        </View>
      )}

      {has('home_rug') && (
        <View style={{ position: 'absolute', alignSelf: 'center', top: groundY - 42, width: 280, height: 76 }}>
          <Svg width="100%" height="100%" viewBox="0 0 280 76" preserveAspectRatio="none">
            <Ellipse cx={140} cy={40} rx={137} ry={34} fill={night ? DIORAMA.violetNight : DIORAMA.violet} />
            <Ellipse cx={140} cy={39} rx={120} ry={27} fill={night ? DIORAMA.violetNightLight : DIORAMA.violetLight} />
            <Path d="M32 38 Q70 12 108 38 T184 38 T248 38" stroke={DIORAMA.lemon} strokeWidth={7} fill="none" opacity={0.9} />
          </Svg>
        </View>
      )}

      {has('home_bed') && !asleep && <RoomBed upgraded top={groundY - 48} />}
      {night && <LightPool y={groundY - 8} width={320} opacity={0.18} />}
      <Motes top={floorTop - 80} height={230} tint={night ? DIORAMA.goldLight : DIORAMA.paleCream} />
      <Vignette strength={night ? 0.19 : 0.08} />
    </View>
  );
}

export function RoomBed({ upgraded = false, top }: { upgraded?: boolean; top?: number }) {
  const rim = upgraded ? DIORAMA.bedRim : DIORAMA.woodMid;
  const wall = upgraded ? DIORAMA.bedWall : DIORAMA.woodWarm;
  const cushion = upgraded ? DIORAMA.bedCushion : DIORAMA.cream;
  return (
    <View style={[styles.roomBed, top !== undefined && { top, bottom: undefined }]} pointerEvents="none">
      <Svg width={116} height={56} viewBox="0 0 132 62">
        <Ellipse cx={66} cy={36} rx={64} ry={22} fill={DIORAMA.ink} opacity={0.15} />
        <Ellipse cx={66} cy={31} rx={62} ry={22} fill={rim} />
        <Ellipse cx={66} cy={29} rx={55} ry={17} fill={wall} />
        <Ellipse cx={66} cy={34} rx={47} ry={12} fill={cushion} />
        <Path d="M4 33 a62 22 0 0 0 124 0 a62 25 0 0 1 -124 0 Z" fill={rim} />
      </Svg>
    </View>
  );
}

function SunMoon({ band }: { band: SkyBand }) {
  if (band === 'night') {
    return (
      <Svg width="100%" height="100%">
        <Circle cx="82%" cy="28%" r={38} fill={DIORAMA.goldLight} opacity={0.18} />
        <Circle cx="82%" cy="28%" r={21} fill={DIORAMA.paleCream} />
        <Circle cx="77%" cy="24%" r={19} fill={DIORAMA.skyNightA} />
        {[18, 34, 54, 68, 91].map((x, i) => <Circle key={x} cx={`${x}%`} cy={`${23 + (i % 3) * 13}%`} r={1.5} fill={DIORAMA.paleCream} opacity={0.85} />)}
      </Svg>
    );
  }
  return (
    <Svg width="100%" height="100%">
      <Circle cx="84%" cy="30%" r={46} fill={DIORAMA.goldLight} opacity={0.22} />
      <Circle cx="84%" cy="30%" r={24} fill={DIORAMA.lemon} />
      <Ellipse cx="22%" cy="31%" rx={44} ry={15} fill={DIORAMA.white} opacity={0.72} />
      <Ellipse cx="47%" cy="23%" rx={28} ry={10} fill={DIORAMA.white} opacity={0.58} />
    </Svg>
  );
}

function OutdoorBase({ band, bandHeight, children }: { band: SkyBand; bandHeight: number; children: React.ReactNode }) {
  return (
    <View style={styles.fill} pointerEvents="none">
      <View style={{ height: bandHeight }}>
        <LinearGradient colors={SKY[band]} style={StyleSheet.absoluteFill} />
        <SunMoon band={band} />
        {children}
      </View>
    </View>
  );
}

export function ParkScene({ hour, bandHeight = 620, groundY }: { hour: number; bandHeight?: number; groundY?: number }) {
  const band = skyBand(hour);
  const night = band === 'night';
  const horizon = Math.max(190, (groundY ?? bandHeight * 0.72) - 138);
  return (
    <OutdoorBase band={band} bandHeight={bandHeight}>
      <Svg width="100%" height={bandHeight} viewBox={`0 0 420 ${bandHeight}`} preserveAspectRatio="none" style={styles.fill}>
        <Path d={`M0 ${horizon + 32} Q70 ${horizon - 35} 145 ${horizon + 18} Q225 ${horizon - 54} 308 ${horizon + 18} Q365 ${horizon - 25} 420 ${horizon + 14} V${bandHeight} H0 Z`} fill={night ? DIORAMA.parkHillNight : DIORAMA.parkHillDay} />
        <Path d={`M0 ${horizon + 54} Q110 ${horizon + 18} 210 ${horizon + 54} Q322 ${horizon + 18} 420 ${horizon + 50} V${bandHeight} H0 Z`} fill={night ? DIORAMA.parkGrassNight : DIORAMA.parkGrassDay} />
        <Path d={`M176 ${horizon + 12} L245 ${horizon + 12} L372 ${bandHeight} L42 ${bandHeight} Z`} fill={night ? DIORAMA.woodNight : DIORAMA.floorDayFar} />
        <Path d={`M190 ${horizon + 12} L232 ${horizon + 12} L327 ${bandHeight} L92 ${bandHeight} Z`} fill={night ? DIORAMA.parkPathNight : DIORAMA.parkPathDay} opacity={0.92} />
        {[18, 62, 106, 150, 286, 330, 374, 412].map((x, i) => (
          <React.Fragment key={x}>
            <Rect x={x} y={horizon - 24 + (i % 2) * 7} width={5} height={43} rx={2} fill={night ? DIORAMA.woodDark : DIORAMA.woodDay} />
            <Circle cx={x + 2} cy={horizon - 27 + (i % 2) * 7} r={17 + (i % 3) * 3} fill={night ? DIORAMA.parkTreeNight : DIORAMA.parkTreeDay} />
          </React.Fragment>
        ))}
        <Rect x={18} y={horizon + 28} width={104} height={9} rx={4} fill={night ? DIORAMA.woodNight : DIORAMA.woodWarm} />
        <Rect x={26} y={horizon + 17} width={88} height={9} rx={4} fill={night ? DIORAMA.woodMid : DIORAMA.woodSoft} />
        <Rect x={30} y={horizon + 37} width={7} height={26} fill={night ? DIORAMA.woodDeep : DIORAMA.woodMid} />
        <Rect x={103} y={horizon + 37} width={7} height={26} fill={night ? DIORAMA.woodDeep : DIORAMA.woodMid} />
      </Svg>
      <View style={{ position: 'absolute', left: -52, top: horizon - 124 }}>
        <Sway degrees={1.2} seconds={6.8}>
          <Svg width={210} height={330} viewBox="0 0 210 330">
            <Rect x={55} y={84} width={34} height={246} rx={14} fill={night ? DIORAMA.woodDark : DIORAMA.woodMid} />
            <Ellipse cx={75} cy={72} rx={110} ry={78} fill={night ? DIORAMA.parkTreeNight : DIORAMA.parkTreeDay} />
            <Ellipse cx={25} cy={119} rx={66} ry={48} fill={night ? DIORAMA.parkTreeNightLight : DIORAMA.parkTreeDayLight} />
            <Circle cx={116} cy={110} r={10} fill={DIORAMA.lemon} opacity={night ? 0.6 : 0.95} />
          </Svg>
        </Sway>
      </View>
      <Motes top={horizon - 45} height={250} tint={night ? DIORAMA.skyDayB : DIORAMA.goldLight} />
      {groundY !== undefined && <LightPool y={groundY - 6} width={320} opacity={night ? 0.12 : 0.28} />}
      <Vignette strength={night ? 0.2 : 0.08} />
    </OutdoorBase>
  );
}

export function TownScene({ hour, bandHeight = 620, groundY }: { hour: number; bandHeight?: number; groundY?: number }) {
  const band = skyBand(hour);
  const night = band === 'night';
  const street = Math.max(260, (groundY ?? bandHeight * 0.72) - 118);
  const shopTop = Math.max(120, street - 185);
  const shopH = street - shopTop + 18;
  const pennants = [DIORAMA.pennantRed, DIORAMA.pennantYellow, DIORAMA.aqua, DIORAMA.mint];
  return (
    <OutdoorBase band={band} bandHeight={bandHeight}>
      <Svg width="100%" height={bandHeight} viewBox={`0 0 420 ${bandHeight}`} preserveAspectRatio="none" style={styles.fill}>
        <Rect x={0} y={shopTop} width={144} height={shopH} rx={12} fill={night ? DIORAMA.townCoralNight : DIORAMA.townCoral} />
        <Rect x={138} y={shopTop + 23} width={142} height={shopH - 23} rx={12} fill={night ? DIORAMA.townBlueNight : DIORAMA.townBlue} />
        <Rect x={274} y={shopTop - 9} width={146} height={shopH + 9} rx={12} fill={night ? DIORAMA.townVioletNight : DIORAMA.townViolet} />
        <Path d={`M0 ${shopTop + 52} H144`} stroke={DIORAMA.goldLight} strokeWidth={18} />
        <Path d={`M138 ${shopTop + 78} H280`} stroke={DIORAMA.lemon} strokeWidth={18} />
        <Path d={`M274 ${shopTop + 43} H420`} stroke={DIORAMA.mint} strokeWidth={18} />
        {[22, 66, 170, 219, 308, 360].map((x, i) => <Rect key={x} x={x} y={shopTop + 94 + (i % 2) * 12} width={38} height={54} rx={8} fill={night ? DIORAMA.glassNight : DIORAMA.glassDay} opacity={0.9} />)}
        <Rect x={0} y={street} width={420} height={18} fill={night ? DIORAMA.townSidewalkNight : DIORAMA.townSidewalkDay} />
        <Rect x={0} y={street + 18} width={420} height={bandHeight - street - 18} fill={night ? DIORAMA.townRoadNight : DIORAMA.townRoadDay} />
        <Path d={`M0 ${street + 54} H420`} stroke={DIORAMA.white} strokeWidth={2} opacity={night ? 0.2 : 0.35} />
      </Svg>
      <View style={{ position: 'absolute', left: 0, right: 0, top: shopTop + 6 }}>
        <Svg width="100%" height={52} viewBox="0 0 420 52" preserveAspectRatio="none">
          <Path d="M0 7 Q210 42 420 7" stroke={night ? DIORAMA.goldLight : DIORAMA.woodWarm} strokeWidth={2} fill="none" />
          {Array.from({ length: 10 }, (_, i) => {
            const x = 18 + i * 42;
            const y = 9 + Math.sin(((i + 0.5) / 10) * Math.PI) * 17;
            return <Path key={i} d={`M${x} ${y} L${x + 18} ${y} L${x + 9} ${y + 18} Z`} fill={pennants[i % 4]} opacity={night ? 0.72 : 1} />;
          })}
        </Svg>
      </View>
      <View style={{ position: 'absolute', right: -18, top: street - 152 }}>
        <Svg width={100} height={220} viewBox="0 0 100 220">
          {night && <Circle cx={54} cy={24} r={38} fill={DIORAMA.goldGlow} opacity={0.22} />}
          <Rect x={49} y={38} width={12} height={174} rx={6} fill={night ? DIORAMA.ink : DIORAMA.woodDeep} />
          <Path d="M24 8 H82 L74 48 H32 Z" fill={night ? DIORAMA.ink : DIORAMA.woodDeep} />
          <Rect x={35} y={13} width={36} height={28} rx={5} fill={night ? DIORAMA.goldGlow : DIORAMA.cream} />
        </Svg>
      </View>
      {groundY !== undefined && <LightPool y={groundY - 6} width={320} opacity={night ? 0.17 : 0.24} />}
      <Vignette strength={night ? 0.2 : 0.08} />
    </OutdoorBase>
  );
}

export function BeachScene({ hour, bandHeight = 620, groundY }: { hour: number; bandHeight?: number; groundY?: number }) {
  const band = skyBand(hour);
  const night = band === 'night';
  const tide = Math.max(270, (groundY ?? bandHeight * 0.72) - 118);
  const horizon = tide - 94;
  return (
    <OutdoorBase band={band} bandHeight={bandHeight}>
      <View style={{ position: 'absolute', left: 0, right: 0, top: horizon, height: tide - horizon + 30 }}>
        <LinearGradient colors={night ? [DIORAMA.oceanNightA, DIORAMA.oceanNightB] : [DIORAMA.oceanDayA, DIORAMA.oceanDayB]} style={StyleSheet.absoluteFill} />
      </View>
      <View style={{ position: 'absolute', left: -28, right: -28, top: tide - 31 }}>
        <WaveRow y={0} night={night} seconds={6.5} travel={15} opacity={0.94} />
        <WaveRow y={16} night={night} seconds={9} travel={-18} opacity={0.72} />
      </View>
      <GroundPlane top={tide} far={night ? DIORAMA.sandNightFar : DIORAMA.sandDayFar} near={night ? DIORAMA.sandNightNear : DIORAMA.sandDayNear}>
        <Svg width="100%" height="100%" viewBox="0 0 420 280" preserveAspectRatio="none">
          <Path d="M-10 9 q60 8 120 0 t120 0 t120 0 t90 0" stroke={night ? DIORAMA.foamNight : DIORAMA.white} strokeWidth={4} fill="none" opacity={0.75} />
          {[68, 126, 198].map((y, i) => <Path key={y} d={`M${10 - i * 8} ${y} Q210 ${y + 14 + i * 2} ${430 + i * 10} ${y}`} stroke={night ? DIORAMA.woodNight : DIORAMA.sandDayFar} strokeWidth={2} fill="none" opacity={0.45} />)}
          <Path d="M319 94 l4 7 l8 1 l-6 5 l2 8 l-8 -4 l-8 4 l2 -8 l-6 -5 l8 -1 Z" fill={DIORAMA.starfish} opacity={0.82} />
          {[70, 96, 122].map((y, i) => <Ellipse key={y} cx={86 + i * 12} cy={y} rx={5} ry={7} fill={night ? DIORAMA.woodDeep : DIORAMA.woodWarm} opacity={0.45} />)}
        </Svg>
      </GroundPlane>
      <View style={{ position: 'absolute', left: -34, top: tide - 62 }}>
        <Sway degrees={2.1} seconds={4.7}>
          <Svg width={160} height={240} viewBox="0 0 160 240">
            <Ellipse cx={45} cy={221} rx={96} ry={35} fill={night ? DIORAMA.sandNightFar : DIORAMA.sandDayFar} />
            {[22, 40, 58, 78, 95].map((x, i) => <Path key={x} d={`M${x} 220 q${8 - i * 3} -66 ${16 - (i % 2) * 24} -101`} stroke={night ? DIORAMA.grassBeachNight : DIORAMA.grassBeachDay} strokeWidth={4} strokeLinecap="round" fill="none" />)}
          </Svg>
        </Sway>
      </View>
      <View style={{ position: 'absolute', right: 17, top: tide + 24 }}>
        <Svg width={86} height={72} viewBox="0 0 86 72">
          <Ellipse cx={43} cy={64} rx={36} ry={7} fill={DIORAMA.shadow} opacity={0.14} />
          <Path d="M14 20 Q43 -4 72 20 Z" fill={DIORAMA.coral} />
          <Path d="M43 20 V57" stroke={DIORAMA.woodDay} strokeWidth={5} strokeLinecap="round" />
          <Rect x={55} y={44} width={22} height={18} rx={6} fill={DIORAMA.aqua} />
          <Path d="M58 44 q8 -12 16 0" stroke={DIORAMA.aquaDeep} strokeWidth={3} fill="none" />
        </Svg>
      </View>
      {groundY !== undefined && <LightPool y={groundY - 6} width={320} opacity={night ? 0.13 : 0.28} />}
      <Motes top={horizon} height={210} tint={night ? DIORAMA.skyDayB : DIORAMA.white} />
      <Vignette strength={night ? 0.19 : 0.07} />
    </OutdoorBase>
  );
}

function WaveRow({ y, night, seconds, travel, opacity }: { y: number; night: boolean; seconds: number; travel: number; opacity: number }) {
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: y }}>
      <Drift distance={travel} seconds={seconds}>
        <Svg width="120%" height={22} viewBox="0 0 480 22" preserveAspectRatio="none">
          <Path d="M0 12 q30 -9 60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0" stroke={night ? DIORAMA.foamNight : DIORAMA.foamDay} strokeWidth={5} fill="none" opacity={opacity} />
          <Path d="M0 18 q30 -7 60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0" stroke={night ? DIORAMA.foamNightShade : DIORAMA.foamDayShade} strokeWidth={3} fill="none" opacity={opacity * 0.7} />
        </Svg>
      </Drift>
    </View>
  );
}

export function NightOverlay() {
  return (
    <View style={[styles.fill, styles.nightWash]} pointerEvents="none">
      <Svg width="100%" height="42%">
        {[18, 33, 54, 70, 87].map((x, i) => <Circle key={x} cx={`${x}%`} cy={`${15 + (i % 3) * 14}%`} r={1.5 + (i % 2) * 0.3} fill={DIORAMA.paleCream} opacity={0.75} />)}
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
        <Ellipse cx={174} cy={59} rx={168} ry={42} fill={DIORAMA.ink} opacity={0.15} />
        <Ellipse cx={174} cy={52} rx={170} ry={46} fill={rim} />
        <Ellipse cx={174} cy={47} rx={152} ry={37} fill={wall} />
        <Ellipse cx={174} cy={54} rx={132} ry={29} fill={cushion} />
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
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  nightWash: { backgroundColor: 'rgba(38,31,85,0.14)' },
  roomBed: { position: 'absolute', left: '3%' },
  bedBack: { position: 'absolute', bottom: 10, alignSelf: 'center' },
  bedFront: { position: 'absolute', bottom: -6, alignSelf: 'center' },
});
