import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { Drift, GroundPlane, LightPool, Motes, Sway, Vignette } from './depth';

const FACE = require('../../../assets/barkly/renders/face.png');

type SkyBand = 'morning' | 'day' | 'evening' | 'night';

export function skyBand(hour: number): SkyBand {
  if (hour >= 21 || hour < 6) return 'night';
  if (hour < 10) return 'morning';
  if (hour < 17) return 'day';
  return 'evening';
}

const SKY: Record<SkyBand, [string, string]> = {
  morning: ['#FFD57C', '#BDEBFF'],
  day: ['#65C8FF', '#DDF7FF'],
  evening: ['#FF8D75', '#FFD3A0'],
  night: ['#53549A', '#8176B6'],
};

const NIGHT = {
  wallTop: '#625E9F',
  wallBottom: '#71689D',
  floorFar: '#89735E',
  floorNear: '#645443',
  wood: '#5A4436',
};

const DAY = {
  wallTop: '#FFF2BE',
  wallBottom: '#FFD9B6',
  floorFar: '#E6C68C',
  floorNear: '#BE8E5E',
  wood: '#865834',
};

function CandyPennants({ top, night }: { top: number; night: boolean }) {
  const colors = night ? ['#FF8A8A', '#FFD75A', '#74D5FF', '#9DE47E'] : ['#FF6F61', '#FFD84D', '#55C8F2', '#7BD889'];
  return (
    <View style={{ position: 'absolute', left: 24, right: 24, top }}>
      <Svg width="100%" height={38} viewBox="0 0 372 38" preserveAspectRatio="none">
        <Path d="M0 5 Q186 34 372 5" stroke={night ? '#EEDAB0' : '#A66A44'} strokeWidth={2} fill="none" opacity={0.65} />
        {Array.from({ length: 9 }, (_, i) => {
          const x = 18 + i * 42;
          const sag = 8 + Math.sin(((i + 0.5) / 9) * Math.PI) * 13;
          return <Path key={i} d={`M${x} ${sag} L${x + 18} ${sag + 2} L${x + 10} ${sag + 18} Z`} fill={colors[i % colors.length]} opacity={0.95} />;
        })}
      </Svg>
    </View>
  );
}

function WindowView({ band, width, height }: { band: SkyBand; width: number; height: number }) {
  const night = band === 'night';
  return (
    <View style={{ width, height, borderRadius: 18, overflow: 'hidden', borderWidth: 7, borderColor: night ? '#E7C77B' : '#D59B55', backgroundColor: '#D59B55' }}>
      <LinearGradient colors={SKY[band]} style={StyleSheet.absoluteFill} />
      <Svg width="100%" height="100%" viewBox="0 0 150 110" preserveAspectRatio="none">
        {night ? (
          <>
            <Circle cx={112} cy={28} r={16} fill="#FFF2B8" />
            <Circle cx={104} cy={23} r={15} fill={SKY.night[0]} />
            {[24, 48, 76, 132].map((x, i) => <Circle key={x} cx={x} cy={18 + (i % 2) * 28} r={1.8} fill="#FFF6CE" />)}
          </>
        ) : (
          <>
            <Circle cx={116} cy={25} r={14} fill="#FFF08A" opacity={0.9} />
            <Ellipse cx={40} cy={42} rx={26} ry={10} fill="#FFFFFF" opacity={0.78} />
            <Ellipse cx={92} cy={52} rx={20} ry={8} fill="#FFFFFF" opacity={0.58} />
          </>
        )}
        <Path d="M0 83 Q36 66 76 82 T150 78 V110 H0 Z" fill={night ? '#3E5F59' : '#77C66D'} opacity={0.9} />
      </Svg>
      <View style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 5, backgroundColor: night ? '#E7C77B' : '#D59B55' }} />
      <View style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 5, backgroundColor: night ? '#E7C77B' : '#D59B55' }} />
      <View style={{ position: 'absolute', left: -8, right: -8, bottom: 0, height: 8, backgroundColor: night ? '#C7A95C' : '#BC7C3C' }} />
    </View>
  );
}

function Sofa({ night, top }: { night: boolean; top: number }) {
  const back = night ? '#8A5261' : '#E87562';
  const topFace = night ? '#A66372' : '#FF907A';
  const seat = night ? '#B8797D' : '#FFA181';
  return (
    <View style={{ position: 'absolute', left: 10, top }}>
      <Svg width={184} height={112} viewBox="0 0 184 112">
        <Ellipse cx={92} cy={104} rx={83} ry={7} fill="#2A2017" opacity={0.2} />
        <Rect x={16} y={8} width={152} height={62} rx={19} fill={back} />
        <Rect x={16} y={8} width={152} height={24} rx={13} fill={topFace} />
        <Rect x={0} y={38} width={34} height={58} rx={15} fill={back} />
        <Rect x={150} y={38} width={34} height={58} rx={15} fill={back} />
        <Rect x={31} y={61} width={60} height={35} rx={12} fill={seat} />
        <Rect x={93} y={61} width={58} height={35} rx={12} fill={seat} />
        <Path d="M37 69 h48 M99 69 h46" stroke={back} strokeWidth={2} opacity={0.7} />
        <Rect x={25} y={30} width={36} height={36} rx={10} fill="#FFD95D" transform="rotate(-8 43 48)" />
        <Rect x={13} y={94} width={10} height={15} rx={4} fill={night ? '#4A352C' : '#744429'} />
        <Rect x={161} y={94} width={10} height={15} rx={4} fill={night ? '#4A352C' : '#744429'} />
      </Svg>
    </View>
  );
}

function WallPortrait({ top, night }: { top: number; night: boolean }) {
  return (
    <View style={{ position: 'absolute', right: 42, top, alignItems: 'center' }}>
      <View style={{ width: 76, height: 70, borderRadius: 13, borderWidth: 6, borderColor: night ? '#E0B85E' : '#A9683A', backgroundColor: '#FFF4D8', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '2deg' }] }}>
        <Image source={FACE} style={{ width: 57, height: 52 }} resizeMode="contain" />
      </View>
      <View style={{ width: 92, height: 8, borderRadius: 5, marginTop: 7, backgroundColor: night ? '#C69C51' : '#935E37' }} />
      <View style={{ width: 64, height: 5, borderRadius: 4, marginTop: 3, backgroundColor: night ? '#574735' : '#DCA05D', opacity: 0.8 }} />
    </View>
  );
}

function FloorLamp({ top, night }: { top: number; night: boolean }) {
  return (
    <View style={{ position: 'absolute', right: 10, top }}>
      <Svg width={88} height={164} viewBox="0 0 88 164">
        {night && <Circle cx={45} cy={26} r={42} fill="#FFE987" opacity={0.25} />}
        <Rect x={42} y={37} width={6} height={106} rx={3} fill={night ? '#47382E' : '#6B4530'} />
        <Ellipse cx={45} cy={147} rx={23} ry={7} fill={night ? '#3D3129' : '#5A3827'} />
        <Path d="M23 5 H66 L75 42 H14 Z" fill={night ? '#F0C45E' : '#FFC95B'} />
        <Path d="M25 8 H64 L68 18 H21 Z" fill="#FFF1B3" opacity={0.55} />
        {night && <Ellipse cx={45} cy={43} rx={22} ry={6} fill="#FFF0A0" opacity={0.8} />}
      </Svg>
    </View>
  );
}

export function HomeScene({
  hour,
  upgrades = [],
  asleep = false,
  groundY,
  chromeBottom,
}: {
  hour: number;
  upgrades?: string[];
  asleep?: boolean;
  groundY: number;
  chromeBottom: number;
}) {
  const band = skyBand(hour);
  const night = band === 'night';
  const palette = night ? NIGHT : DAY;
  const has = (id: string) => upgrades.includes(id);
  const bigWindow = has('home_window');

  // Composition contract: wall fixtures end before furniture begins.
  const floorTop = Math.max(chromeBottom + 102, groundY - 118);
  const wallTop = chromeBottom + 14;
  const sofaTop = floorTop - 94;
  const windowTop = wallTop + 18;
  const desiredWindowHeight = bigWindow ? 128 : 104;
  const windowHeight = Math.max(76, Math.min(desiredWindowHeight, sofaTop - windowTop - 18));
  const windowWidth = bigWindow ? 168 : 138;
  const portraitTop = wallTop + 44;

  return (
    <View style={styles.fill} pointerEvents="none">
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: floorTop }}>
        <LinearGradient colors={[palette.wallTop, palette.wallBottom]} style={StyleSheet.absoluteFill} />
        <CandyPennants top={wallTop} night={night} />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 18, backgroundColor: night ? '#76695B' : '#E7B66D' }} />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 18, height: 3, backgroundColor: night ? '#4A4037' : '#C78647' }} />
      </View>

      <GroundPlane top={floorTop} far={palette.floorFar} near={palette.floorNear}>
        <Svg width="100%" height="100%" viewBox="0 0 420 300" preserveAspectRatio="none">
          {[35, 105, 175, 245, 315, 385].map((x) => (
            <Path key={x} d={`M${x} 0 L${210 + (x - 210) * 1.8} 300`} stroke={palette.wood} strokeWidth={2} opacity={0.32} />
          ))}
          {[58, 134, 224].map((y, i) => <Path key={y} d={`M0 ${y} H420`} stroke={palette.wood} strokeWidth={1.5 + i * 0.55} opacity={0.24 + i * 0.05} />)}
        </Svg>
      </GroundPlane>

      <View style={{ position: 'absolute', left: 18, top: windowTop }}>
        <WindowView band={band} width={windowWidth} height={windowHeight} />
      </View>
      <Sofa night={night} top={sofaTop} />
      <WallPortrait top={portraitTop} night={night} />
      <FloorLamp top={floorTop - 152} night={night} />

      {!night && (
        <View style={{ position: 'absolute', left: 18, right: 132, top: floorTop, height: 205 }}>
          <Svg width="100%" height="100%" viewBox="0 0 290 205" preserveAspectRatio="none">
            <Path d="M20 0 L112 0 L250 205 L78 205 Z" fill="#FFF0B3" opacity={0.2} />
            <Path d="M74 0 L88 0 L226 205 L210 205 Z" fill="#FFF7D6" opacity={0.22} />
          </Svg>
        </View>
      )}

      {has('home_rug') && (
        <View style={{ position: 'absolute', alignSelf: 'center', top: groundY - 42, width: 280, height: 76 }}>
          <Svg width="100%" height="100%" viewBox="0 0 280 76" preserveAspectRatio="none">
            <Ellipse cx={140} cy={40} rx={137} ry={34} fill={night ? '#6C4779' : '#A85BC4'} />
            <Ellipse cx={140} cy={39} rx={120} ry={27} fill={night ? '#8A61A0' : '#D187E3'} />
            <Path d="M32 38 Q70 12 108 38 T184 38 T248 38" stroke={night ? '#F1C866' : '#FFD84D'} strokeWidth={7} fill="none" opacity={0.9} />
          </Svg>
        </View>
      )}

      {has('home_bed') && !asleep && <RoomBed upgraded top={groundY - 48} />}

      {night && <LightPool y={groundY - 8} width={320} opacity={0.18} />}
      <Motes top={floorTop - 80} height={230} tint={night ? '#FFF2C3' : '#FFF7DC'} />
      <Vignette strength={night ? 0.19 : 0.08} />
    </View>
  );
}

export function RoomBed({ upgraded = false, top }: { upgraded?: boolean; top?: number }) {
  const rim = upgraded ? '#6D4D99' : '#6A4B34';
  const wall = upgraded ? '#8E69BE' : '#9A6D45';
  const cushion = upgraded ? '#F7EAFE' : '#F1DEB8';
  return (
    <View style={[styles.roomBed, top !== undefined && { top, bottom: undefined }]} pointerEvents="none">
      <Svg width={116} height={56} viewBox="0 0 132 62">
        <Ellipse cx={66} cy={36} rx={64} ry={22} fill="#2A211B" opacity={0.15} />
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
        <Circle cx="82%" cy="28%" r={38} fill="#FFF3C4" opacity={0.18} />
        <Circle cx="82%" cy="28%" r={21} fill="#FFF5C8" />
        <Circle cx="77%" cy="24%" r={19} fill={SKY.night[0]} />
        {[18, 34, 54, 68, 91].map((x, i) => <Circle key={x} cx={`${x}%`} cy={`${23 + (i % 3) * 13}%`} r={1.5} fill="#FFF5D2" opacity={0.85} />)}
      </Svg>
    );
  }
  return (
    <Svg width="100%" height="100%">
      <Circle cx="84%" cy="30%" r={46} fill="#FFF4A6" opacity={0.22} />
      <Circle cx="84%" cy="30%" r={24} fill="#FFE66B" />
      <Ellipse cx="22%" cy="31%" rx={44} ry={15} fill="#FFFFFF" opacity={0.72} />
      <Ellipse cx="47%" cy="23%" rx={28} ry={10} fill="#FFFFFF" opacity={0.58} />
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
        <Path d={`M0 ${horizon + 32} Q70 ${horizon - 35} 145 ${horizon + 18} Q225 ${horizon - 54} 308 ${horizon + 18} Q365 ${horizon - 25} 420 ${horizon + 14} V${bandHeight} H0 Z`} fill={night ? '#496344' : '#8ACD67'} />
        <Path d={`M0 ${horizon + 54} Q110 ${horizon + 18} 210 ${horizon + 54} Q322 ${horizon + 18} 420 ${horizon + 50} V${bandHeight} H0 Z`} fill={night ? '#365337' : '#5FB947'} />
        <Path d={`M176 ${horizon + 12} L245 ${horizon + 12} L372 ${bandHeight} L42 ${bandHeight} Z`} fill={night ? '#6C624B' : '#E4CC8F'} />
        <Path d={`M190 ${horizon + 12} L232 ${horizon + 12} L327 ${bandHeight} L92 ${bandHeight} Z`} fill={night ? '#7D7154' : '#F2DEA9'} opacity={0.9} />
        {[18, 62, 106, 150, 286, 330, 374, 412].map((x, i) => (
          <React.Fragment key={x}>
            <Rect x={x} y={horizon - 24 + (i % 2) * 7} width={5} height={43} rx={2} fill={night ? '#4F4635' : '#866241'} />
            <Circle cx={x + 2} cy={horizon - 27 + (i % 2) * 7} r={17 + (i % 3) * 3} fill={night ? '#3E5938' : '#68A947'} />
          </React.Fragment>
        ))}
        <Rect x={18} y={horizon + 28} width={104} height={9} rx={4} fill={night ? '#765C44' : '#C68B51'} />
        <Rect x={26} y={horizon + 17} width={88} height={9} rx={4} fill={night ? '#896A4B' : '#DC9C5A'} />
        <Rect x={30} y={horizon + 37} width={7} height={26} fill={night ? '#4D3E31' : '#785134'} />
        <Rect x={103} y={horizon + 37} width={7} height={26} fill={night ? '#4D3E31' : '#785134'} />
      </Svg>
      <View style={{ position: 'absolute', left: -52, top: horizon - 124 }}>
        <Sway degrees={1.2} seconds={6.8}>
          <Svg width={210} height={330} viewBox="0 0 210 330">
            <Rect x={55} y={84} width={34} height={246} rx={14} fill={night ? '#473622' : '#684626'} />
            <Ellipse cx={75} cy={72} rx={110} ry={78} fill={night ? '#315032' : '#58A63E'} />
            <Ellipse cx={25} cy={119} rx={66} ry={48} fill={night ? '#3A5C39' : '#70C54D'} />
            <Circle cx={116} cy={110} r={10} fill="#FFD84D" opacity={night ? 0.6 : 0.95} />
          </Svg>
        </Sway>
      </View>
      <Motes top={horizon - 45} height={250} tint={night ? '#D5E8E0' : '#FFF8B7'} />
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
  return (
    <OutdoorBase band={band} bandHeight={bandHeight}>
      <Svg width="100%" height={bandHeight} viewBox={`0 0 420 ${bandHeight}`} preserveAspectRatio="none" style={styles.fill}>
        <Rect x={0} y={shopTop} width={144} height={shopH} rx={12} fill={night ? '#755270' : '#F47E86'} />
        <Rect x={138} y={shopTop + 23} width={142} height={shopH - 23} rx={12} fill={night ? '#4E668A' : '#63BEE8'} />
        <Rect x={274} y={shopTop - 9} width={146} height={shopH + 9} rx={12} fill={night ? '#6D5A86' : '#B790ED'} />
        <Path d={`M0 ${shopTop + 52} H144`} stroke="#FFF0B5" strokeWidth={18} />
        <Path d={`M138 ${shopTop + 78} H280`} stroke="#FFE36E" strokeWidth={18} />
        <Path d={`M274 ${shopTop + 43} H420`} stroke="#7DE0A0" strokeWidth={18} />
        {[22, 66, 170, 219, 308, 360].map((x, i) => <Rect key={x} x={x} y={shopTop + 94 + (i % 2) * 12} width={38} height={54} rx={8} fill={night ? '#EFCF78' : '#FFF6D6'} opacity={night ? 0.85 : 0.9} />)}
        <Rect x={0} y={street} width={420} height={18} fill={night ? '#6C6257' : '#E4D1A4'} />
        <Rect x={0} y={street + 18} width={420} height={bandHeight - street - 18} fill={night ? '#4C4744' : '#AFA9A2'} />
        <Path d={`M0 ${street + 54} H420`} stroke={night ? '#6D6660' : '#D7D2C9'} strokeWidth={2} opacity={0.55} />
        {[44, 115, 186, 257, 328].map((x) => <Rect key={x} x={x} y={street + 48} width={38} height={6} rx={2} fill="#FFF4C7" opacity={night ? 0.4 : 0.7} />)}
      </Svg>
      <View style={{ position: 'absolute', left: 0, right: 0, top: shopTop + 6 }}>
        <Svg width="100%" height={52} viewBox="0 0 420 52" preserveAspectRatio="none">
          <Path d="M0 7 Q210 42 420 7" stroke={night ? '#E8D4AC' : '#8A5B3A'} strokeWidth={2} fill="none" />
          {Array.from({ length: 10 }, (_, i) => {
            const x = 18 + i * 42;
            const y = 9 + Math.sin(((i + 0.5) / 10) * Math.PI) * 17;
            const colors = ['#FF625B', '#FFD84D', '#4CC9F0', '#70DC87'];
            return <Path key={i} d={`M${x} ${y} L${x + 18} ${y} L${x + 9} ${y + 18} Z`} fill={colors[i % 4]} opacity={night ? 0.72 : 1} />;
          })}
        </Svg>
      </View>
      <View style={{ position: 'absolute', right: -18, top: street - 152 }}>
        <Svg width={100} height={220} viewBox="0 0 100 220">
          {night && <Circle cx={54} cy={24} r={38} fill="#FFE77C" opacity={0.22} />}
          <Rect x={49} y={38} width={12} height={174} rx={6} fill={night ? '#25231F' : '#45413B'} />
          <Path d="M24 8 H82 L74 48 H32 Z" fill={night ? '#25231F' : '#45413B'} />
          <Rect x={35} y={13} width={36} height={28} rx={5} fill={night ? '#FFE77C' : '#FFF3D0'} />
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
        <LinearGradient colors={night ? ['#294B68', '#3D6A7E'] : ['#36A9D2', '#68D6E7']} style={StyleSheet.absoluteFill} />
      </View>
      <View style={{ position: 'absolute', left: -28, right: -28, top: tide - 31 }}>
        <WaveRow y={0} night={night} seconds={6.5} travel={15} opacity={0.94} />
        <WaveRow y={16} night={night} seconds={9} travel={-18} opacity={0.72} />
      </View>
      <GroundPlane top={tide} far={night ? '#7A674A' : '#E3C17D'} near={night ? '#5D503E' : '#FFDFA0'}>
        <Svg width="100%" height="100%" viewBox="0 0 420 280" preserveAspectRatio="none">
          <Path d="M-10 9 q60 8 120 0 t120 0 t120 0 t90 0" stroke={night ? '#A9C6D5' : '#FFFFFF'} strokeWidth={4} fill="none" opacity={0.75} />
          {[68, 126, 198].map((y, i) => <Path key={y} d={`M${10 - i * 8} ${y} Q210 ${y + 14 + i * 2} ${430 + i * 10} ${y}`} stroke={night ? '#665A47' : '#D0AE72'} strokeWidth={2} fill="none" opacity={0.45} />)}
          <Circle cx={319} cy={102} r={7} fill="#FF8C65" />
          <Path d="M319 94 l4 7 l8 1 l-6 5 l2 8 l-8 -4 l-8 4 l2 -8 l-6 -5 l8 -1 Z" fill="#FF7A59" opacity={0.82} />
          {[70, 96, 122].map((y, i) => <Ellipse key={y} cx={86 + i * 12} cy={y} rx={5} ry={7} fill={night ? '#4C4033' : '#B78F5C'} opacity={0.45} />)}
        </Svg>
      </GroundPlane>
      <View style={{ position: 'absolute', left: -34, top: tide - 62 }}>
        <Sway degrees={2.1} seconds={4.7}>
          <Svg width={160} height={240} viewBox="0 0 160 240">
            <Ellipse cx={45} cy={221} rx={96} ry={35} fill={night ? '#665642' : '#E6C488'} />
            {[22, 40, 58, 78, 95].map((x, i) => <Path key={x} d={`M${x} 220 q${8 - i * 3} -66 ${16 - (i % 2) * 24} -101`} stroke={night ? '#41543C' : '#7D9B55'} strokeWidth={4} strokeLinecap="round" fill="none" />)}
          </Svg>
        </Sway>
      </View>
      <View style={{ position: 'absolute', right: 17, top: tide + 24 }}>
        <Svg width={86} height={72} viewBox="0 0 86 72">
          <Ellipse cx={43} cy={64} rx={36} ry={7} fill="#3B2D20" opacity={0.14} />
          <Path d="M14 20 Q43 -4 72 20 Z" fill="#FF6F61" />
          <Path d="M43 20 V57" stroke="#865834" strokeWidth={5} strokeLinecap="round" />
          <Rect x={55} y={44} width={22} height={18} rx={6} fill="#4CC9F0" />
          <Path d="M58 44 q8 -12 16 0" stroke="#2FA9D0" strokeWidth={3} fill="none" />
        </Svg>
      </View>
      {groundY !== undefined && <LightPool y={groundY - 6} width={320} opacity={night ? 0.13 : 0.28} />}
      <Motes top={horizon} height={210} tint={night ? '#D7ECF4' : '#FFFFFF'} />
      <Vignette strength={night ? 0.19 : 0.07} />
    </OutdoorBase>
  );
}

function WaveRow({ y, night, seconds, travel, opacity }: { y: number; night: boolean; seconds: number; travel: number; opacity: number }) {
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: y }}>
      <Drift distance={travel} seconds={seconds}>
        <Svg width="120%" height={22} viewBox="0 0 480 22" preserveAspectRatio="none">
          <Path d="M0 12 q30 -9 60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0" stroke={night ? '#A2BCCB' : '#F7FFFF'} strokeWidth={5} fill="none" opacity={opacity} />
          <Path d="M0 18 q30 -7 60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0 t60 0" stroke={night ? '#66869B' : '#BDEAF0'} strokeWidth={3} fill="none" opacity={opacity * 0.7} />
        </Svg>
      </Drift>
    </View>
  );
}

export function NightOverlay() {
  return (
    <View style={[styles.fill, { backgroundColor: 'rgba(38,31,85,0.14)' }]} pointerEvents="none">
      <Svg width="100%" height="42%">
        {[18, 33, 54, 70, 87].map((x, i) => <Circle key={x} cx={`${x}%`} cy={`${15 + (i % 3) * 14}%`} r={1.5 + (i % 2) * 0.3} fill="#FFF4CB" opacity={0.75} />)}
      </Svg>
    </View>
  );
}

export function DogBedBack({ upgraded = false }: { upgraded?: boolean }) {
  const rim = upgraded ? '#62448A' : '#6A4C36';
  const wall = upgraded ? '#8E69BE' : '#956B47';
  const cushion = upgraded ? '#F6E9FF' : '#F0DDB7';
  return (
    <View style={styles.bedBack} pointerEvents="none">
      <Svg width={348} height={104} viewBox="0 0 348 104">
        <Ellipse cx={174} cy={59} rx={168} ry={42} fill="#2C211A" opacity={0.15} />
        <Ellipse cx={174} cy={52} rx={170} ry={46} fill={rim} />
        <Ellipse cx={174} cy={47} rx={152} ry={37} fill={wall} />
        <Ellipse cx={174} cy={54} rx={132} ry={29} fill={cushion} />
      </Svg>
    </View>
  );
}

export function DogBedFront({ upgraded = false }: { upgraded?: boolean }) {
  const rim = upgraded ? '#6D4D99' : '#7A573A';
  const wall = upgraded ? '#8E69BE' : '#956B47';
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
  roomBed: { position: 'absolute', left: '3%' },
  bedBack: { position: 'absolute', bottom: 10, alignSelf: 'center' },
  bedFront: { position: 'absolute', bottom: -6, alignSelf: 'center' },
});
