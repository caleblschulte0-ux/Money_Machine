/**
 * Scene backgrounds for Barkly's world — home, park, town — plus the night
 * overlay and dog bed used while he sleeps. Full-bleed absolute layers that
 * sit behind the stage. All vector/gradient, tuned to the concept palette so
 * the clay renders sit naturally on top.
 *
 * `hour` (0–23) shifts the sky so mornings, days, and evenings feel different.
 */

import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

const FACE = require('../../../assets/barkly/renders/face.png');

type SkyBand = 'morning' | 'day' | 'evening' | 'night';

export function skyBand(hour: number): SkyBand {
  if (hour >= 21 || hour < 6) return 'night';
  if (hour < 10) return 'morning';
  if (hour < 17) return 'day';
  return 'evening';
}

const SKY: Record<SkyBand, [string, string]> = {
  morning: ['#F6E3C5', '#EAF0DC'],
  day: ['#C4E0E8', '#EAF3E0'],
  evening: ['#EFC9A0', '#E5D3BC'],
  night: ['#3B3A5C', '#6B6488'],
};

// ---------------------------------------------------------------- home

export function HomeScene({ hour }: { hour: number }) {
  const band = skyBand(hour);
  return (
    <View style={styles.fill} pointerEvents="none">
      {/* wall */}
      <LinearGradient colors={['#F7F1E2', '#EFE5CE']} style={styles.fill} />
      {/* floor: warm wood with plank seams */}
      <View style={styles.homeFloor}>
        <LinearGradient colors={['#E3CFA6', '#D6BE90']} style={styles.fill} />
        <Svg width="100%" height="100%" viewBox="0 0 420 330" preserveAspectRatio="none">
          {[70, 150, 230, 310].map((x, i) => (
            <Path key={i} d={`M${x} 0 L${x - 34} 330`} stroke="#C9AF7E" strokeWidth={2.5} opacity={0.5} />
          ))}
        </Svg>
      </View>
      {/* baseboard */}
      <View style={styles.baseboard} />
      {/* window with live sky */}
      <View style={styles.window}>
        <LinearGradient colors={SKY[band]} style={styles.windowSky}>
          {band === 'night' && (
            <Svg width="100%" height="100%">
              <Circle cx="72%" cy="26%" r={13} fill="#F2EAC8" />
              <Circle cx="66%" cy="22%" r={11} fill={SKY.night[0]} />
              <Circle cx="22%" cy="40%" r={1.6} fill="#F2EAC8" />
              <Circle cx="38%" cy="18%" r={1.4} fill="#F2EAC8" />
              <Circle cx="55%" cy="55%" r={1.4} fill="#F2EAC8" />
            </Svg>
          )}
          {band !== 'night' && (
            <Svg width="100%" height="100%">
              <Ellipse cx="30%" cy="34%" rx={22} ry={9} fill="#FFFFFF" opacity={0.8} />
              <Ellipse cx="68%" cy="58%" rx={17} ry={7} fill="#FFFFFF" opacity={0.65} />
            </Svg>
          )}
        </LinearGradient>
        <View style={styles.windowBarH} />
        <View style={styles.windowBarV} />
        <View style={styles.windowSill} />
      </View>
      {/* framed portrait of the good boy himself */}
      <View style={styles.frame}>
        <Image source={FACE} style={styles.framePhoto} resizeMode="contain" />
      </View>
      {/* rug */}
      <View style={styles.homeRug} />
    </View>
  );
}

// ---------------------------------------------------------------- park

export function ParkScene({ hour }: { hour: number }) {
  const band = skyBand(hour);
  const night = band === 'night';
  return (
    <View style={styles.fill} pointerEvents="none">
      <LinearGradient colors={SKY[band]} style={styles.fill} />
      {/* sky details */}
      <Svg width={420} height={190} style={styles.skyTop}>
        {band === 'day' && <Circle cx={62} cy={96} r={30} fill="#F5DC8C" opacity={0.9} />}
        {band === 'evening' && <Circle cx={62} cy={110} r={30} fill="#EFA35C" opacity={0.9} />}
        {night && <Circle cx={60} cy={92} r={22} fill="#F2EAC8" />}
        <Ellipse cx={150} cy={148} rx={46} ry={16} fill="#FFFFFF" opacity={night ? 0.14 : 0.75} />
        <Ellipse cx={250} cy={92} rx={36} ry={13} fill="#FFFFFF" opacity={night ? 0.1 : 0.6} />
      </Svg>
      {/* ground block, anchored to the bottom */}
      <Svg width="100%" height={460} viewBox="0 0 420 460" preserveAspectRatio="none" style={styles.ground}>
        {/* rolling hills */}
        <Ellipse cx={90} cy={166} rx={260} ry={110} fill={night ? '#7E9068' : '#BCD094'} />
        <Ellipse cx={370} cy={186} rx={280} ry={120} fill={night ? '#88996F' : '#C8DAA2'} />
        {/* trees */}
        <Rect x={44} y={38} width={13} height={46} rx={5} fill="#8A6B3A" />
        <Circle cx={50} cy={26} r={34} fill={night ? '#5F7A48' : '#93AE68'} />
        <Circle cx={30} cy={40} r={22} fill={night ? '#6B8752' : '#9FB975'} />
        <Rect x={342} y={52} width={12} height={42} rx={5} fill="#8A6B3A" />
        <Circle cx={348} cy={40} r={30} fill={night ? '#6B8752' : '#9FB975'} />
        {/* fence line */}
        {Array.from({ length: 9 }, (_, i) => 24 + i * 47).map((x) => (
          <Rect key={x} x={x} y={126} width={9} height={44} rx={4} fill={night ? '#A08C68' : '#D9C49A'} />
        ))}
        <Rect x={12} y={134} width={396} height={7} rx={3.5} fill={night ? '#93805F' : '#CBB489'} />
        <Rect x={12} y={152} width={396} height={7} rx={3.5} fill={night ? '#93805F' : '#CBB489'} />
        {/* grass ground */}
        <Rect x={0} y={170} width={420} height={290} fill={night ? '#78905C' : '#AECB84'} />
        <Ellipse cx={210} cy={176} rx={260} ry={26} fill={night ? '#6E8754' : '#A3C178'} />
        {/* grass tufts */}
        {[60, 150, 300, 372].map((x, i) => (
          <Path key={i} d={`M${x} ${250 + (i % 2) * 60} q3 -12 6 0 q3 -12 6 0`}
            stroke={night ? '#5F7A48' : '#94B569'} strokeWidth={2.5} fill="none" />
        ))}
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------- town

export function TownScene({ hour }: { hour: number }) {
  const band = skyBand(hour);
  const night = band === 'night';
  const dim = (day: string, nite: string) => (night ? nite : day);
  return (
    <View style={styles.fill} pointerEvents="none">
      <LinearGradient colors={SKY[band]} style={styles.fill} />
      <Svg width="100%" height={560} viewBox="0 0 420 560" preserveAspectRatio="none" style={styles.ground}>
        {/* storefront block */}
        <Rect x={0} y={0} width={420} height={280} fill={dim('#E8D9BC', '#A99C82')} />
        {/* left shop: the bakery */}
        <Rect x={14} y={20} width={172} height={240} rx={8} fill={dim('#DEC49A', '#A08C68')} />
        <Rect x={14} y={42} width={172} height={12} fill="#B3402E" opacity={0.85} />
        {Array.from({ length: 5 }, (_, i) => 20 + i * 34).map((x, i) => (
          <Path key={x} d={`M${x} 54 h26 a13 13 0 0 1 -26 0 Z`} fill={i % 2 === 0 ? '#C97B5A' : dim('#F1E4C8', '#C9BCA0')} />
        ))}
        <Rect x={34} y={90} width={58} height={74} rx={6} fill={dim('#8FB3C4', '#F5DC8C')} opacity={0.9} />
        <Rect x={110} y={90} width={56} height={170} rx={6} fill="#7A5A38" />
        <Circle cx={120} cy={172} r={4} fill="#C9963C" />
        {/* bone sign */}
        <Rect x={52} y={4} width={96} height={30} rx={8} fill="#4B3527" />
        <Path d="M84 19 h32 M84 19 a5 5 0 1 1 -6 -6 a5 5 0 1 1 6 6 M116 19 a5 5 0 1 0 6 -6 a5 5 0 1 0 -6 6"
          stroke="#E8D9BC" strokeWidth={5} strokeLinecap="round" fill="none" />
        {/* right shop */}
        <Rect x={232} y={20} width={174} height={240} rx={8} fill={dim('#CBB489', '#93805F')} />
        <Rect x={232} y={42} width={174} height={12} fill="#5C7A52" opacity={0.85} />
        <Rect x={252} y={90} width={62} height={78} rx={6} fill={dim('#8FB3C4', '#F5DC8C')} opacity={0.9} />
        <Rect x={332} y={90} width={56} height={170} rx={6} fill="#6B4E30" />
        {/* lamppost */}
        <Rect x={204} y={86} width={9} height={182} rx={4} fill="#4A403A" />
        <Circle cx={208} cy={78} r={13} fill={night ? '#F5DC8C' : '#E8DFC8'} />
        {night && <Circle cx={208} cy={78} r={26} fill="#F5DC8C" opacity={0.18} />}
        {/* cobbled street */}
        <Rect x={0} y={260} width={420} height={300} fill={dim('#D8C6A4', '#9C8D70')} />
        <Ellipse cx={210} cy={266} rx={260} ry={24} fill={dim('#CDBA95', '#91836A')} />
        {[
          [60, 330], [150, 360], [260, 335], [340, 375], [100, 430], [230, 420], [330, 470],
        ].map(([x, y], i) => (
          <Ellipse key={i} cx={x} cy={y} rx={26} ry={9} fill={dim('#CBB78F', '#8C7E64')} />
        ))}
      </Svg>
    </View>
  );
}

// ------------------------------------------------------- sleep dressing

/** Dim, starry overlay while Barkly sleeps. Renders above the scene. */
export function NightOverlay() {
  return (
    <View style={[styles.fill, styles.night]} pointerEvents="none">
      <Svg width="100%" height="45%">
        <Circle cx="18%" cy="30%" r={1.8} fill="#F2EAC8" opacity={0.9} />
        <Circle cx="34%" cy="14%" r={1.4} fill="#F2EAC8" opacity={0.7} />
        <Circle cx="55%" cy="26%" r={1.7} fill="#F2EAC8" opacity={0.8} />
        <Circle cx="72%" cy="12%" r={1.4} fill="#F2EAC8" opacity={0.7} />
        <Circle cx="88%" cy="32%" r={1.8} fill="#F2EAC8" opacity={0.9} />
      </Svg>
    </View>
  );
}

/** Barkly's bed — appears under him while he sleeps at home. */
/**
 * The bed comes in two halves and the dog goes BETWEEN them.
 *
 * A single ellipse behind him left him hovering over a mat like a hologram.
 * Drawing the front rim over his lower body is what makes him look nestled
 * IN the bed rather than parked on it — and it hides the stub of leg the
 * lying-down frame still has. Neither half works alone.
 */
export function DogBedBack() {
  return (
    <View style={styles.bedBack} pointerEvents="none">
      <Svg width={348} height={104} viewBox="0 0 348 104">
        <Ellipse cx={174} cy={52} rx={170} ry={46} fill="#6E5133" />
        <Ellipse cx={174} cy={47} rx={152} ry={37} fill="#8A6844" />
        <Ellipse cx={174} cy={54} rx={132} ry={29} fill="#E3D2AC" />
      </Svg>
    </View>
  );
}

export function DogBedFront() {
  return (
    <View style={styles.bedFront} pointerEvents="none">
      <Svg width={348} height={56} viewBox="0 0 348 56">
        {/* Only the near lip of the rim: a half-ellipse clipped by the viewBox. */}
        <Ellipse cx={174} cy={6} rx={170} ry={46} fill="#7A5A38" />
        <Ellipse cx={174} cy={0} rx={152} ry={38} fill="#8A6844" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  night: { backgroundColor: 'rgba(28, 24, 56, 0.34)' },

  homeFloor: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: '42%',
    borderTopLeftRadius: 26, borderTopRightRadius: 26, overflow: 'hidden',
  },
  baseboard: {
    position: 'absolute', left: 0, right: 0, bottom: '42%', height: 10,
    backgroundColor: '#E0D2B2',
  },
  window: {
    position: 'absolute', top: '19%', left: '7%', width: 126, height: 112,
    borderRadius: 14, borderWidth: 7, borderColor: '#C9AF7E',
    overflow: 'hidden', backgroundColor: '#C9AF7E',
  },
  windowSky: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  windowBarH: { position: 'absolute', top: '50%', left: 0, right: 0, height: 5, backgroundColor: '#C9AF7E' },
  windowBarV: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 5, backgroundColor: '#C9AF7E' },
  windowSill: { position: 'absolute', bottom: 0, left: -8, right: -8, height: 8, backgroundColor: '#BCA271' },
  frame: {
    position: 'absolute', top: '21%', right: '8%', width: 74, height: 66,
    borderRadius: 8, borderWidth: 5, borderColor: '#8A6844', backgroundColor: '#F4EAD2',
    alignItems: 'center', justifyContent: 'center',
    transform: [{ rotate: '2.5deg' }],
  },
  framePhoto: { width: 56, height: 48 },
  bedBack: { position: 'absolute', bottom: 10, alignSelf: 'center' },
  bedFront: { position: 'absolute', bottom: -6, alignSelf: 'center' },

  homeRug: {
    position: 'absolute', bottom: '15%', alignSelf: 'center', width: 300, height: 64,
    borderRadius: 150, backgroundColor: '#C77C52', opacity: 0.3,
  },
  skyTop: { position: 'absolute', top: 0, left: 0 },
  ground: { position: 'absolute', bottom: 0, left: 0, right: 0 },

});
