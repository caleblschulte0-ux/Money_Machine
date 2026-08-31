import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient as RNGradient } from 'expo-linear-gradient';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient as SvgLinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { radius } from '../theme';
import { DIORAMA } from './artPalette';
import { skyBand, SkyBand } from './CandyScenesV2';

const SKY: Record<SkyBand, [string, string]> = {
  morning: [DIORAMA.skyMorningA, DIORAMA.skyMorningB],
  day: [DIORAMA.skyDayA, DIORAMA.skyDayB],
  evening: [DIORAMA.skyEveningA, DIORAMA.skyEveningB],
  night: [DIORAMA.skyNightA, DIORAMA.skyNightB],
};

function HeroWindow({ band, upgraded }: { band: SkyBand; upgraded: boolean }) {
  const night = band === 'night';
  const w = upgraded ? 188 : 170;
  const h = upgraded ? 202 : 188;
  const frame = night ? DIORAMA.windowFrameNight : DIORAMA.windowFrameDay;
  const edge = night ? DIORAMA.windowFrameNightEdge : DIORAMA.windowFrameDayEdge;
  const hill = night ? DIORAMA.parkHillNight : DIORAMA.parkHillDay;
  const hillBack = night ? DIORAMA.hillNight : DIORAMA.parkHillDayLight;

  return (
    <View style={{ width: w + 22, height: h + 30 }}>
      <View style={[styles.windowShadow, { width: w + 12, height: h + 12 }]} />
      <View style={[styles.windowShell, { width: w, height: h, borderColor: edge, backgroundColor: frame }]}>
        <RNGradient colors={SKY[band]} style={styles.fill} />
        <Svg width="100%" height="100%" viewBox="0 0 180 210" preserveAspectRatio="none">
          <Defs>
            <SvgLinearGradient id="heroSkyGlow" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={night ? DIORAMA.skyNightA : DIORAMA.goldLight} stopOpacity={night ? 0.06 : 0.62} />
              <Stop offset="1" stopColor={DIORAMA.white} stopOpacity={0} />
            </SvgLinearGradient>
          </Defs>
          <Rect x={0} y={0} width={180} height={210} fill="url(#heroSkyGlow)" />
          {night ? (
            <>
              <Circle cx={137} cy={42} r={19} fill={DIORAMA.goldLight} opacity={0.92} />
              <Circle cx={130} cy={35} r={18} fill={DIORAMA.skyNightA} />
              {[28, 53, 88, 117, 158].map((x, i) => (
                <Circle key={x} cx={x} cy={26 + (i % 3) * 19} r={i % 2 ? 1.4 : 2} fill={DIORAMA.paleCream} opacity={0.72} />
              ))}
            </>
          ) : (
            <>
              <Circle cx={140} cy={44} r={29} fill={DIORAMA.goldLight} opacity={0.24} />
              <Circle cx={140} cy={44} r={18} fill={DIORAMA.lemon} />
            </>
          )}
          <Path d="M-10 142Q35 103 77 132Q115 154 190 112V220H-10Z" fill={hillBack} />
          <Path d="M-10 161Q38 126 87 153Q125 174 190 136V220H-10Z" fill={hill} />
          <Path d="M14 18Q59 3 106 16" stroke={DIORAMA.white} strokeWidth={10} strokeLinecap="round" opacity={night ? 0.05 : 0.42} />
        </Svg>
        <View style={[styles.windowMullion, { left: '50%', top: 0, bottom: 0, width: 8, marginLeft: -4, backgroundColor: frame }]} />
        <View style={[styles.windowMullion, { left: 0, right: 0, top: '55%', height: 8, backgroundColor: frame }]} />
      </View>
      <View style={[styles.windowSill, { width: w + 24, backgroundColor: edge }]} />
      <View style={[styles.windowSillHighlight, { width: w + 7, opacity: night ? 0.08 : 0.44 }]} />
    </View>
  );
}

function BuiltInShelf({ night }: { night: boolean }) {
  const wood = night ? DIORAMA.woodDark : DIORAMA.woodWarm;
  const inner = night ? DIORAMA.woodDeep : DIORAMA.woodMid;
  return (
    <Svg width={142} height={264} viewBox="0 0 142 264">
      <Defs>
        <SvgLinearGradient id="shelfBody" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={DIORAMA.woodShine} />
          <Stop offset={0.17} stopColor={wood} />
          <Stop offset="1" stopColor={DIORAMA.woodDeep} />
        </SvgLinearGradient>
      </Defs>
      <Ellipse cx={72} cy={256} rx={60} ry={8} fill={DIORAMA.shadow} opacity={0.18} />
      <Rect x={8} y={6} width={126} height={242} rx={28} fill={DIORAMA.woodDeep} />
      <Rect x={3} y={0} width={126} height={241} rx={28} fill="url(#shelfBody)" />
      <Rect x={16} y={27} width={100} height={74} rx={18} fill={inner} opacity={0.88} />
      <Rect x={16} y={112} width={100} height={50} rx={17} fill={inner} opacity={0.82} />
      <Rect x={16} y={174} width={100} height={49} rx={17} fill={night ? DIORAMA.wallNightA : DIORAMA.cream} opacity={0.86} />
      <Path d="M19 16Q63 2 107 16" stroke={DIORAMA.white} strokeWidth={8} strokeLinecap="round" opacity={night ? 0.05 : 0.27} />
      <Rect x={28} y={45} width={16} height={40} rx={5} fill={DIORAMA.violetDeep} />
      <Rect x={48} y={38} width={18} height={47} rx={5} fill={DIORAMA.aqua} />
      <Rect x={70} y={49} width={15} height={36} rx={5} fill={DIORAMA.coralLight} />
      <Rect x={90} y={43} width={14} height={42} rx={5} fill={DIORAMA.goldDeep} />
      <Circle cx={46} cy={132} r={13} fill={DIORAMA.mintDeep} />
      <Circle cx={36} cy={143} r={10} fill={DIORAMA.parkTreeDay} />
      <Circle cx={58} cy={145} r={11} fill={DIORAMA.parkTreeDayLight} />
      <Path d="M45 144V157" stroke={DIORAMA.woodDeep} strokeWidth={5} strokeLinecap="round" />
      <Rect x={82} y={124} width={27} height={29} rx={7} fill={DIORAMA.cream} />
      <Circle cx={95} cy={136} r={7} fill={DIORAMA.coralLight} />
      <Circle cx={94} cy={136} r={3} fill={DIORAMA.inkSoft} />
      <Path d="M35 191H97" stroke={DIORAMA.white} strokeWidth={6} strokeLinecap="round" opacity={night ? 0.05 : 0.25} />
      <Path d="M54 202Q66 187 78 202Q67 212 54 202Z" fill={DIORAMA.goldLight} />
      <Circle cx={103} cy={198} r={4} fill={DIORAMA.goldLight} />
    </Svg>
  );
}

function LoungeChair({ night }: { night: boolean }) {
  const body = night ? DIORAMA.couchNight : DIORAMA.couchDay;
  const edge = night ? DIORAMA.couchNightEdge : DIORAMA.couchDayEdge;
  const top = night ? DIORAMA.couchNightTop : DIORAMA.couchDayTop;
  return (
    <Svg width={148} height={136} viewBox="0 0 148 136">
      <Defs>
        <SvgLinearGradient id="chairBody" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={top} />
          <Stop offset={0.34} stopColor={body} />
          <Stop offset="1" stopColor={edge} />
        </SvgLinearGradient>
      </Defs>
      <Ellipse cx={74} cy={128} rx={59} ry={7} fill={DIORAMA.shadow} opacity={0.22} />
      <Rect x={24} y={16} width={101} height={84} rx={32} fill={edge} />
      <Rect x={20} y={9} width={101} height={84} rx={32} fill="url(#chairBody)" />
      <Rect x={5} y={52} width={36} height={55} rx={18} fill={body} />
      <Rect x={107} y={52} width={36} height={55} rx={18} fill={body} />
      <Rect x={36} y={74} width={69} height={32} rx={15} fill={night ? DIORAMA.couchNightSeat : DIORAMA.couchDaySeat} />
      <Rect x={51} y={46} width={38} height={35} rx={11} fill={DIORAMA.lemon} transform="rotate(-7 70 63)" />
      <Path d="M33 22Q72 7 108 24" stroke={DIORAMA.white} strokeWidth={7} strokeLinecap="round" opacity={night ? 0.06 : 0.34} />
      <Rect x={31} y={102} width={10} height={23} rx={5} fill={DIORAMA.woodDeep} />
      <Rect x={105} y={102} width={10} height={23} rx={5} fill={DIORAMA.woodDeep} />
    </Svg>
  );
}

function FloorLamp({ night }: { night: boolean }) {
  return (
    <Svg width={74} height={182} viewBox="0 0 74 182">
      <Defs>
        <SvgLinearGradient id="heroLamp" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={DIORAMA.goldLight} />
          <Stop offset="1" stopColor={DIORAMA.goldDeep} />
        </SvgLinearGradient>
      </Defs>
      <Ellipse cx={37} cy={174} rx={28} ry={7} fill={DIORAMA.shadow} opacity={0.22} />
      <Rect x={34} y={55} width={7} height={106} rx={4} fill={DIORAMA.woodDeep} />
      <Path d="M37 63V149" stroke={DIORAMA.woodShine} strokeWidth={2.7} strokeLinecap="round" opacity={0.38} />
      <Ellipse cx={37} cy={162} rx={22} ry={7} fill={DIORAMA.woodDark} />
      <Path d="M11 15H62L69 55H4Z" fill="url(#heroLamp)" />
      <Path d="M19 19H55" stroke={DIORAMA.white} strokeWidth={6} strokeLinecap="round" opacity={night ? 0.16 : 0.5} />
    </Svg>
  );
}

function PetBed({ night, upgraded }: { night: boolean; upgraded: boolean }) {
  const w = upgraded ? 130 : 112;
  return (
    <Svg width={w} height={78} viewBox="0 0 130 78">
      <Ellipse cx={65} cy={71} rx={53} ry={6} fill={DIORAMA.shadow} opacity={0.2} />
      <Ellipse cx={65} cy={45} rx={57} ry={26} fill={DIORAMA.bedEdge} />
      <Ellipse cx={65} cy={37} rx={55} ry={25} fill={DIORAMA.bedWall} />
      <Ellipse cx={65} cy={45} rx={41} ry={15} fill={DIORAMA.bedCushion} />
      <Path d="M28 27Q65 12 103 28" stroke={DIORAMA.white} strokeWidth={7} strokeLinecap="round" opacity={night ? 0.08 : 0.35} />
      <Circle cx={65} cy={45} r={4} fill={DIORAMA.goldDeep} opacity={0.55} />
      <Circle cx={54} cy={42} r={4} fill={DIORAMA.goldDeep} opacity={0.55} />
      <Circle cx={76} cy={42} r={4} fill={DIORAMA.goldDeep} opacity={0.55} />
    </Svg>
  );
}

function ForegroundLeaves({ side }: { side: 'left' | 'right' }) {
  const flip = side === 'right' ? -1 : 1;
  return (
    <Svg width={112} height={142} viewBox="0 0 112 142" style={{ transform: [{ scaleX: flip }] }}>
      <Path d="M15 139Q44 91 56 30" stroke={DIORAMA.woodDeep} strokeWidth={8} strokeLinecap="round" opacity={0.75} />
      <Ellipse cx={48} cy={50} rx={23} ry={10} fill={DIORAMA.parkTreeDay} transform="rotate(-38 48 50)" />
      <Ellipse cx={70} cy={71} rx={28} ry={12} fill={DIORAMA.parkTreeDayLight} transform="rotate(26 70 71)" />
      <Ellipse cx={38} cy={91} rx={27} ry={12} fill={DIORAMA.mintDeep} transform="rotate(-31 38 91)" />
      <Ellipse cx={68} cy={111} rx={29} ry={13} fill={DIORAMA.parkTreeDay} transform="rotate(24 68 111)" />
      <Path d="M35 43Q48 37 60 45" stroke={DIORAMA.white} strokeWidth={4} strokeLinecap="round" opacity={0.18} />
    </Svg>
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
  const night = band === 'night' || asleep;
  const has = (id: string) => upgrades.includes(id);
  const floorTop = Math.max(chromeBottom + 184, groundY - 154);
  const wallA = night ? DIORAMA.wallNightA : '#5c667b';
  const wallB = night ? DIORAMA.wallNightB : '#7e8798';
  const trim = night ? DIORAMA.wallNightEdge : DIORAMA.woodDark;
  const floorNear = night ? DIORAMA.floorNightNear : '#b87944';
  const floorFar = night ? DIORAMA.floorNightFar : '#d6a36a';
  const floorEdge = night ? DIORAMA.floorNightEdge : '#8b552f';

  return (
    <View style={styles.fill} pointerEvents="none">
      <RNGradient colors={[wallA, wallB]} style={[styles.fill, { bottom: undefined, height: floorTop }]} />

      <Svg width="100%" height="100%" viewBox="0 0 420 760" preserveAspectRatio="none" style={styles.fill}>
        <Defs>
          <SvgLinearGradient id="wallWarmth" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={DIORAMA.goldLight} stopOpacity={night ? 0.03 : 0.16} />
            <Stop offset={0.48} stopColor={DIORAMA.white} stopOpacity={night ? 0 : 0.035} />
            <Stop offset="1" stopColor={DIORAMA.shadow} stopOpacity={night ? 0.16 : 0.08} />
          </SvgLinearGradient>
          <SvgLinearGradient id="floorHero" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={floorFar} />
            <Stop offset="1" stopColor={floorNear} />
          </SvgLinearGradient>
          <SvgLinearGradient id="sunPatch" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={DIORAMA.goldLight} stopOpacity={night ? 0 : 0.23} />
            <Stop offset="1" stopColor={DIORAMA.goldLight} stopOpacity={0} />
          </SvgLinearGradient>
        </Defs>
        <Rect x={0} y={0} width={420} height={floorTop} fill="url(#wallWarmth)" />
        {[46, 116, 186, 256, 326, 396].map((x) => (
          <Path key={x} d={`M${x} ${chromeBottom + 42}V${floorTop - 31}`} stroke={DIORAMA.white} strokeWidth={1.2} opacity={night ? 0.025 : 0.07} />
        ))}
        {[chromeBottom + 78, chromeBottom + 142].map((y) => (
          <Path key={y} d={`M0 ${y}H420`} stroke={DIORAMA.shadow} strokeWidth={1.2} opacity={night ? 0.05 : 0.04} />
        ))}
        <Rect x={0} y={floorTop} width={420} height={760 - floorTop} fill="url(#floorHero)" />
        {[32, 105, 178, 251, 324, 397].map((x) => (
          <Path key={x} d={`M${x} ${floorTop}L${210 + (x - 210) * 1.7} 760`} stroke={floorEdge} strokeWidth={2.1} opacity={night ? 0.14 : 0.22} />
        ))}
        {[floorTop + 45, floorTop + 101, floorTop + 169, floorTop + 248].map((y) => (
          <Path key={y} d={`M0 ${y}H420`} stroke={floorEdge} strokeWidth={2} opacity={night ? 0.11 : 0.17} />
        ))}
        {!night && <Path d={`M18 ${floorTop + 6}L190 ${floorTop + 6}L255 760H0Z`} fill="url(#sunPatch)" />}
      </Svg>

      <View style={[styles.crownTrim, { top: chromeBottom + 28, backgroundColor: trim, opacity: night ? 0.72 : 0.9 }]} />
      <View style={[styles.crownHighlight, { top: chromeBottom + 28, opacity: night ? 0.05 : 0.22 }]} />
      <View style={[styles.baseboard, { top: floorTop - 28, backgroundColor: trim }]} />
      <View style={[styles.baseboardHighlight, { top: floorTop - 25, opacity: night ? 0.05 : 0.26 }]} />

      <View style={{ position: 'absolute', left: -4, top: chromeBottom + 48 }}>
        <HeroWindow band={band} upgraded={has('home_window')} />
      </View>
      <View style={{ position: 'absolute', right: -7, top: chromeBottom + 40 }}>
        <BuiltInShelf night={night} />
      </View>

      <View style={{ position: 'absolute', left: 18, top: floorTop - 127 }}>
        <LoungeChair night={night} />
      </View>
      <View style={{ position: 'absolute', left: -4, top: floorTop - 183 }}>
        <FloorLamp night={night} />
      </View>

      <Svg width={92} height={98} viewBox="0 0 92 98" style={{ position: 'absolute', left: 171, top: chromeBottom + 55 }}>
        <Rect x={9} y={8} width={74} height={80} rx={18} fill={DIORAMA.woodDeep} opacity={0.3} />
        <Rect x={4} y={3} width={74} height={80} rx={18} fill={night ? DIORAMA.woodDark : DIORAMA.woodWarm} />
        <Rect x={12} y={11} width={58} height={64} rx={14} fill={night ? DIORAMA.wallNightA : DIORAMA.cream} />
        <Path d="M37 58V27H49Q62 27 62 37Q62 44 55 47Q64 50 64 59Q64 70 49 70H37Z" fill={DIORAMA.woodDeep} opacity={0.8} />
        <Path d="M19 17H62" stroke={DIORAMA.white} strokeWidth={5} strokeLinecap="round" opacity={night ? 0.04 : 0.3} />
      </Svg>

      <Svg width={58} height={58} viewBox="0 0 58 58" style={{ position: 'absolute', left: 188, top: chromeBottom + 154 }}>
        <Circle cx={31} cy={31} r={24} fill={DIORAMA.woodDeep} opacity={0.25} />
        <Circle cx={27} cy={27} r={24} fill={night ? DIORAMA.woodDark : DIORAMA.woodWarm} />
        <Circle cx={27} cy={27} r={17} fill={night ? DIORAMA.wallNightA : DIORAMA.cream} />
        <Circle cx={27} cy={25} r={5} fill={DIORAMA.woodDeep} />
        <Circle cx={18} cy={28} r={4} fill={DIORAMA.woodDeep} />
        <Circle cx={36} cy={28} r={4} fill={DIORAMA.woodDeep} />
        <Path d="M17 39Q27 30 37 39Q31 46 27 46Q23 46 17 39Z" fill={DIORAMA.woodDeep} />
      </Svg>

      <View style={{ position: 'absolute', right: 22, top: floorTop + 16 }}>
        <PetBed night={night} upgraded={has('home_bed')} />
      </View>

      {has('home_rug') && (
        <View style={[styles.rug, { top: groundY - 46 }]}> 
          <RNGradient colors={[DIORAMA.violetLight, DIORAMA.violet, DIORAMA.violetDeep]} style={styles.rugInner} />
          <View style={styles.rugHighlight} />
        </View>
      )}

      <View style={[styles.floorGlow, { top: floorTop + 4, opacity: night ? 0.03 : 0.13 }]} />
      <View style={{ position: 'absolute', left: -38, bottom: -24 }}><ForegroundLeaves side="left" /></View>
      <View style={{ position: 'absolute', right: -42, bottom: -18 }}><ForegroundLeaves side="right" /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  windowShadow: {
    position: 'absolute',
    left: 12,
    top: 14,
    borderRadius: 44,
    backgroundColor: DIORAMA.shadow,
    opacity: 0.2,
  },
  windowShell: {
    borderWidth: 11,
    borderTopLeftRadius: 54,
    borderTopRightRadius: 54,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  windowMullion: { position: 'absolute' },
  windowSill: { position: 'absolute', left: -12, bottom: 9, height: 22, borderRadius: radius.lg },
  windowSillHighlight: { position: 'absolute', left: -2, bottom: 22, height: 6, borderRadius: radius.pill, backgroundColor: DIORAMA.white },
  crownTrim: { position: 'absolute', left: 0, right: 0, height: 9 },
  crownHighlight: { position: 'absolute', left: 0, right: 0, height: 3, backgroundColor: DIORAMA.white },
  baseboard: { position: 'absolute', left: 0, right: 0, height: 28 },
  baseboardHighlight: { position: 'absolute', left: 0, right: 0, height: 6, backgroundColor: DIORAMA.white },
  rug: {
    position: 'absolute',
    left: '24%',
    right: '24%',
    height: 78,
    borderRadius: radius.pill,
    backgroundColor: DIORAMA.violetDeep,
    padding: 7,
    transform: [{ scaleX: 1.16 }],
  },
  rugInner: { flex: 1, borderRadius: radius.pill },
  rugHighlight: { position: 'absolute', left: 24, right: 24, top: 12, height: 8, borderRadius: radius.pill, backgroundColor: DIORAMA.white, opacity: 0.22 },
  floorGlow: {
    position: 'absolute',
    left: 34,
    width: 205,
    height: 180,
    borderRadius: radius.pill,
    backgroundColor: DIORAMA.goldLight,
    transform: [{ rotate: '-9deg' }],
  },
});
