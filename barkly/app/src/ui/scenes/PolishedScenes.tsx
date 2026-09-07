import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { DIORAMA } from './artPalette';
import { radius } from '../theme';

const FACE = require('../../../assets/barkly/renders/face.png');

type SkyBand = 'morning' | 'day' | 'evening' | 'night';


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
  roomBed: { position: 'absolute', left: '3%' },
  bedBack: { position: 'absolute', bottom: 10, alignSelf: 'center' },
  bedFront: { position: 'absolute', bottom: -6, alignSelf: 'center' },
});