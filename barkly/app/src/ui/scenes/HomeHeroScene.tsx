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

function ArchWindow({ band, upgraded }: { band: SkyBand; upgraded: boolean }) {
  const night = band === 'night';
  const w = upgraded ? 206 : 190;
  const h = upgraded ? 250 : 228;
  const frame = night ? DIORAMA.windowFrameNight : DIORAMA.windowFrameDay;
  const edge = night ? DIORAMA.windowFrameNightEdge : DIORAMA.windowFrameDayEdge;
  const hillBack = night ? DIORAMA.hillNight : DIORAMA.parkHillDayLight;
  const hillFront = night ? DIORAMA.parkHillNight : DIORAMA.parkHillDay;

  return (
    <View style={{ width: w + 30, height: h + 34 }}>
      <View style={[styles.windowDepth, { width: w + 20, height: h + 18 }]} />
      <View style={[styles.windowOuter, { width: w + 8, height: h + 8, backgroundColor: edge }]} />
      <View style={[styles.windowInner, { width: w, height: h, borderColor: frame }]}>
        <RNGradient colors={SKY[band]} style={styles.fill} />
        <Svg width="100%" height="100%" viewBox="0 0 200 250" preserveAspectRatio="none">
          <Defs>
            <SvgLinearGradient id="outsideHillBack" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={hillBack} />
              <Stop offset="1" stopColor={hillFront} />
            </SvgLinearGradient>
            <SvgLinearGradient id="outsideHillFront" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={hillFront} />
              <Stop offset="1" stopColor={night ? DIORAMA.parkHillNightEdge : DIORAMA.parkHillDayEdge} />
            </SvgLinearGradient>
          </Defs>
          {night ? (
            <>
              <Circle cx={152} cy={53} r={20} fill={DIORAMA.goldLight} opacity={0.94} />
              <Circle cx={144} cy={45} r={19} fill={DIORAMA.skyNightA} />
              {[23, 50, 82, 112, 170].map((x, i) => (
                <Circle key={x} cx={x} cy={32 + (i % 2) * 25} r={i % 2 ? 1.4 : 2} fill={DIORAMA.paleCream} opacity={0.8} />
              ))}
            </>
          ) : (
            <>
              <Circle cx={154} cy={54} r={39} fill={DIORAMA.goldGlow} opacity={0.18} />
              <Circle cx={154} cy={54} r={20} fill={DIORAMA.lemon} />
            </>
          )}
          <Path d="M-15 167Q40 116 87 151Q132 180 218 126V265H-15Z" fill="url(#outsideHillBack)" />
          <Path d="M-15 194Q43 145 99 178Q145 205 218 156V265H-15Z" fill="url(#outsideHillFront)" />
          {!night && <Path d="M13 24Q65 5 117 22" stroke={DIORAMA.white} strokeWidth={11} strokeLinecap="round" opacity={0.35} />}
          <Path d="M7 218Q54 206 93 216T191 207" stroke={night ? DIORAMA.windowFrameNightEdge : DIORAMA.windowSillDay} strokeWidth={5} strokeLinecap="round" opacity={0.5} />
        </Svg>
        <View style={[styles.mullion, { left: '50%', top: 0, bottom: 0, width: 8, marginLeft: -4, backgroundColor: frame }]} />
        <View style={[styles.mullion, { left: 0, right: 0, top: '57%', height: 8, backgroundColor: frame }]} />
      </View>
      <View style={[styles.windowSill, { width: w + 30, backgroundColor: edge }]} />
      <View style={[styles.windowSillLight, { width: w + 12, opacity: night ? 0.08 : 0.42 }]} />
      <View style={[styles.windowSeat, { width: w + 38, backgroundColor: night ? DIORAMA.couchNightEdge : DIORAMA.woodMid }]}> 
        <View style={[styles.windowCushion, { backgroundColor: night ? DIORAMA.couchNight : DIORAMA.coral }]} />
        <View style={styles.windowPillow} />
      </View>
    </View>
  );
}

function BuiltInWall({ night }: { night: boolean }) {
  const body = night ? DIORAMA.woodNight : DIORAMA.woodWarm;
  const bodyDeep = night ? DIORAMA.woodDeep : DIORAMA.woodDark;
  const insetTop = night ? DIORAMA.wallNightEdge : DIORAMA.wallDayEdge;
  const insetBottom = night ? DIORAMA.wallNightA : DIORAMA.woodDeep;
  return (
    <Svg width={166} height={344} viewBox="0 0 166 344">
      <Defs>
        <SvgLinearGradient id="builtBody" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={night ? DIORAMA.woodMid : DIORAMA.woodShine} />
          <Stop offset={0.24} stopColor={body} />
          <Stop offset="1" stopColor={bodyDeep} />
        </SvgLinearGradient>
        <SvgLinearGradient id="builtInset" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={insetTop} />
          <Stop offset="1" stopColor={insetBottom} />
        </SvgLinearGradient>
      </Defs>
      <Ellipse cx={82} cy={335} rx={72} ry={8} fill={DIORAMA.shadow} opacity={0.24} />
      <Rect x={7} y={6} width={153} height={325} rx={36} fill={bodyDeep} />
      <Rect x={0} y={0} width={153} height={321} rx={36} fill="url(#builtBody)" />
      <Path d="M16 16Q76 -1 137 18" stroke={DIORAMA.white} strokeWidth={9} strokeLinecap="round" opacity={night ? 0.05 : 0.19} />
      <Path d="M17 90V50Q17 24 45 24H109Q137 24 137 50V90Z" fill="url(#builtInset)" />
      <Rect x={17} y={83} width={120} height={72} rx={18} fill="url(#builtInset)" />
      <Rect x={17} y={163} width={120} height={57} rx={18} fill={night ? DIORAMA.woodDeep : DIORAMA.woodDay} />
      <Rect x={17} y={228} width={120} height={75} rx={20} fill={night ? DIORAMA.wallNightA : DIORAMA.cream} opacity={0.94} />
      <Rect x={28} y={101} width={16} height={39} rx={5} fill={DIORAMA.violetDeep} />
      <Rect x={48} y={95} width={18} height={45} rx={5} fill={DIORAMA.aquaDeep} />
      <Rect x={70} y={106} width={16} height={34} rx={5} fill={DIORAMA.coralDeep} />
      <Rect x={91} y={98} width={15} height={42} rx={5} fill={DIORAMA.goldDeep} />
      <Circle cx={119} cy={121} r={14} fill={DIORAMA.goldLight} />
      <Circle cx={119} cy={121} r={8} fill={DIORAMA.woodDark} />
      <Circle cx={119} cy={121} r={3} fill={DIORAMA.ink} />
      <Path d="M31 180H121" stroke={DIORAMA.white} strokeWidth={6} strokeLinecap="round" opacity={night ? 0.05 : 0.18} />
      <Path d="M55 194Q75 174 95 194Q78 211 55 194Z" fill={DIORAMA.gold} />
      <Circle cx={111} cy={192} r={4} fill={DIORAMA.goldLight} />
      <Rect x={31} y={242} width={92} height={20} rx={9} fill={night ? DIORAMA.woodNight : DIORAMA.woodSoft} />
      <Rect x={31} y={270} width={92} height={20} rx={9} fill={night ? DIORAMA.woodNight : DIORAMA.woodSoft} />
      <Circle cx={111} cy={252} r={4} fill={DIORAMA.gold} />
      <Circle cx={111} cy={280} r={4} fill={DIORAMA.gold} />
    </Svg>
  );
}

function Armchair({ night }: { night: boolean }) {
  const body = night ? DIORAMA.couchNight : DIORAMA.couchDay;
  const edge = night ? DIORAMA.couchNightEdge : DIORAMA.couchDayEdge;
  return (
    <Svg width={146} height={133} viewBox="0 0 146 133">
      <Defs>
        <SvgLinearGradient id="armchair" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={night ? DIORAMA.couchNightTop : DIORAMA.couchDayTop} />
          <Stop offset={0.35} stopColor={body} />
          <Stop offset="1" stopColor={edge} />
        </SvgLinearGradient>
      </Defs>
      <Ellipse cx={73} cy={126} rx={57} ry={7} fill={DIORAMA.shadow} opacity={0.23} />
      <Rect x={22} y={17} width={103} height={82} rx={33} fill={edge} />
      <Rect x={18} y={10} width={103} height={82} rx={33} fill="url(#armchair)" />
      <Rect x={2} y={54} width={39} height={52} rx={19} fill={body} />
      <Rect x={106} y={54} width={38} height={52} rx={19} fill={body} />
      <Rect x={36} y={74} width={70} height={31} rx={15} fill={night ? DIORAMA.couchNightSeat : DIORAMA.couchDaySeat} />
      <Rect x={51} y={46} width={38} height={35} rx={11} fill={DIORAMA.lemon} transform="rotate(-8 70 64)" />
      <Path d="M33 22Q72 7 108 24" stroke={DIORAMA.white} strokeWidth={7} strokeLinecap="round" opacity={night ? 0.05 : 0.24} />
      <Rect x={30} y={101} width={10} height={22} rx={4} fill={DIORAMA.woodDark} />
      <Rect x={105} y={101} width={10} height={22} rx={4} fill={DIORAMA.woodDark} />
    </Svg>
  );
}

function Lamp({ night }: { night: boolean }) {
  return (
    <Svg width={76} height={185} viewBox="0 0 76 185">
      <Defs>
        <SvgLinearGradient id="lampShadeHero" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={DIORAMA.goldLight} />
          <Stop offset="1" stopColor={night ? DIORAMA.goldDeep : DIORAMA.windowFrameDayEdge} />
        </SvgLinearGradient>
      </Defs>
      <Ellipse cx={38} cy={177} rx={28} ry={7} fill={DIORAMA.shadow} opacity={0.22} />
      <Rect x={34} y={56} width={8} height={108} rx={4} fill={DIORAMA.woodDark} />
      <Path d="M38 63V151" stroke={DIORAMA.woodShine} strokeWidth={2.7} strokeLinecap="round" opacity={0.4} />
      <Ellipse cx={38} cy={166} rx={22} ry={7} fill={DIORAMA.woodDeep} />
      <Path d="M11 14H64L71 56H4Z" fill="url(#lampShadeHero)" />
      <Path d="M19 19H56" stroke={DIORAMA.white} strokeWidth={6} strokeLinecap="round" opacity={night ? 0.14 : 0.42} />
    </Svg>
  );
}

function PetBed({ upgraded }: { upgraded: boolean }) {
  const w = upgraded ? 136 : 118;
  return (
    <Svg width={w} height={83} viewBox="0 0 136 83">
      <Ellipse cx={68} cy={77} rx={55} ry={6} fill={DIORAMA.shadow} opacity={0.2} />
      <Ellipse cx={68} cy={48} rx={59} ry={28} fill={DIORAMA.aquaDeep} />
      <Ellipse cx={68} cy={39} rx={57} ry={26} fill={DIORAMA.aqua} />
      <Ellipse cx={68} cy={49} rx={42} ry={16} fill={DIORAMA.goldLight} />
      <Path d="M30 27Q68 11 106 28" stroke={DIORAMA.white} strokeWidth={7} strokeLinecap="round" opacity={0.24} />
      <Circle cx={68} cy={49} r={4} fill={DIORAMA.goldDeep} opacity={0.6} />
      <Circle cx={57} cy={46} r={4} fill={DIORAMA.goldDeep} opacity={0.6} />
      <Circle cx={79} cy={46} r={4} fill={DIORAMA.goldDeep} opacity={0.6} />
    </Svg>
  );
}

function WallMedallions({ night }: { night: boolean }) {
  const frame = night ? DIORAMA.woodNight : DIORAMA.woodWarm;
  return (
    <Svg width={92} height={155} viewBox="0 0 92 155">
      <Rect x={12} y={6} width={68} height={75} rx={18} fill={DIORAMA.woodDeep} opacity={0.32} />
      <Rect x={7} y={1} width={68} height={75} rx={18} fill={frame} />
      <Rect x={15} y={9} width={52} height={59} rx={14} fill={night ? DIORAMA.wallNightA : DIORAMA.cream} />
      <Path d="M35 54V24H46Q59 24 59 34Q59 41 52 44Q61 47 61 56Q61 67 46 67H35Z" fill={DIORAMA.woodDeep} opacity={0.84} />
      <Circle cx={42} cy={120} r={26} fill={DIORAMA.woodDeep} opacity={0.28} />
      <Circle cx={38} cy={116} r={26} fill={frame} />
      <Circle cx={38} cy={116} r={18} fill={night ? DIORAMA.wallNightA : DIORAMA.cream} />
      <Circle cx={38} cy={113} r={5} fill={DIORAMA.woodDeep} />
      <Circle cx={29} cy={115} r={4} fill={DIORAMA.woodDeep} />
      <Circle cx={47} cy={115} r={4} fill={DIORAMA.woodDeep} />
      <Path d="M28 126Q38 117 48 126Q42 133 38 133Q34 133 28 126Z" fill={DIORAMA.woodDeep} />
    </Svg>
  );
}

function ForegroundPlant({ right = false }: { right?: boolean }) {
  const flip = right ? -1 : 1;
  return (
    <Svg width={138} height={175} viewBox="0 0 138 175" style={{ transform: [{ scaleX: flip }] }}>
      <Ellipse cx={45} cy={166} rx={42} ry={8} fill={DIORAMA.shadow} opacity={0.22} />
      <Path d="M27 174Q58 111 71 44" stroke={DIORAMA.woodDeep} strokeWidth={9} strokeLinecap="round" />
      <Ellipse cx={63} cy={50} rx={30} ry={13} fill={DIORAMA.parkTreeDayEdge} transform="rotate(-40 63 50)" />
      <Ellipse cx={88} cy={76} rx={35} ry={15} fill={DIORAMA.parkTreeDay} transform="rotate(28 88 76)" />
      <Ellipse cx={50} cy={104} rx={34} ry={15} fill={DIORAMA.parkTreeDayEdge} transform="rotate(-31 50 104)" />
      <Ellipse cx={84} cy={130} rx={36} ry={16} fill={DIORAMA.parkTreeDay} transform="rotate(24 84 130)" />
      <Path d="M48 42Q63 35 77 44" stroke={DIORAMA.white} strokeWidth={5} strokeLinecap="round" opacity={0.15} />
    </Svg>
  );
}

function FloorToy() {
  return (
    <Svg width={72} height={48} viewBox="0 0 72 48">
      <Ellipse cx={35} cy={43} rx={30} ry={5} fill={DIORAMA.shadow} opacity={0.18} />
      <Circle cx={36} cy={24} r={20} fill={DIORAMA.violet} />
      <Path d="M22 16Q35 7 50 16" stroke={DIORAMA.white} strokeWidth={5} strokeLinecap="round" opacity={0.2} />
      <Circle cx={30} cy={23} r={3} fill={DIORAMA.violetDeep} />
      <Circle cx={43} cy={23} r={3} fill={DIORAMA.violetDeep} />
      <Path d="M31 31Q36 35 42 30" stroke={DIORAMA.violetDeep} strokeWidth={2.5} strokeLinecap="round" fill="none" />
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
  const floorTop = Math.max(chromeBottom + 188, groundY - 158);
  const wall = night ? [DIORAMA.wallNightA, DIORAMA.wallNightB] : [DIORAMA.wallDayA, DIORAMA.wallDayB];
  const floorFar = night ? DIORAMA.floorNightFar : DIORAMA.floorDayFar;
  const floorNear = night ? DIORAMA.floorNightNear : DIORAMA.floorDayNear;
  const floorLine = night ? DIORAMA.floorNightEdge : DIORAMA.floorDayEdge;

  return (
    <View style={styles.fill} pointerEvents="none">
      <RNGradient colors={wall} style={[styles.fill, { bottom: undefined, height: floorTop }]} />
      <Svg width="100%" height="100%" viewBox="0 0 420 760" preserveAspectRatio="none" style={styles.fill}>
        <Defs>
          <SvgLinearGradient id="heroWallLight" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={DIORAMA.goldLight} stopOpacity={night ? 0.02 : 0.18} />
            <Stop offset={0.42} stopColor={DIORAMA.white} stopOpacity={night ? 0 : 0.025} />
            <Stop offset="1" stopColor={DIORAMA.shadowSoft} stopOpacity={night ? 0.2 : 0.11} />
          </SvgLinearGradient>
          <SvgLinearGradient id="heroFloor" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={floorFar} />
            <Stop offset="1" stopColor={floorNear} />
          </SvgLinearGradient>
          <SvgLinearGradient id="sunPoolHero" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={DIORAMA.goldGlow} stopOpacity={night ? 0 : 0.32} />
            <Stop offset="1" stopColor={DIORAMA.goldGlow} stopOpacity={0} />
          </SvgLinearGradient>
        </Defs>
        <Rect x={0} y={0} width={420} height={floorTop} fill="url(#heroWallLight)" />
        <Path d={`M0 ${chromeBottom + 54}H420`} stroke={DIORAMA.white} strokeWidth={2} opacity={night ? 0.025 : 0.08} />
        <Path d={`M0 ${chromeBottom + 121}H420`} stroke={DIORAMA.wallNightEdge} strokeWidth={1.5} opacity={0.08} />
        <Path d={`M0 ${chromeBottom + 188}H420`} stroke={DIORAMA.wallNightEdge} strokeWidth={1.5} opacity={0.07} />
        <Rect x={0} y={floorTop} width={420} height={760 - floorTop} fill="url(#heroFloor)" />
        {[34, 106, 178, 250, 322, 394].map((x) => (
          <Path key={x} d={`M${x} ${floorTop}L${210 + (x - 210) * 1.83} 760`} stroke={floorLine} strokeWidth={2.2} opacity={night ? 0.18 : 0.27} />
        ))}
        {[floorTop + 43, floorTop + 96, floorTop + 160, floorTop + 238].map((y) => (
          <Path key={y} d={`M0 ${y}H420`} stroke={floorLine} strokeWidth={2} opacity={night ? 0.14 : 0.22} />
        ))}
        {!night && <Path d={`M0 ${floorTop + 4}L176 ${floorTop + 4}L269 760H0Z`} fill="url(#sunPoolHero)" />}
      </Svg>
      <View style={[styles.ceilingTrim, { top: chromeBottom + 22, backgroundColor: night ? DIORAMA.woodNight : DIORAMA.woodDark, opacity: night ? 0.7 : 0.94 }]} />
      <View style={[styles.ceilingTrimLight, { top: chromeBottom + 22, opacity: night ? 0.05 : 0.24 }]} />
      <View style={[styles.baseboard, { top: floorTop - 30, backgroundColor: night ? DIORAMA.woodNight : DIORAMA.woodDeep }]} />
      <View style={[styles.baseboardLight, { top: floorTop - 27, opacity: night ? 0.05 : 0.22 }]} />
      <View style={{ position: 'absolute', left: -14, top: chromeBottom + 35 }}>
        <ArchWindow band={band} upgraded={has('home_window')} />
      </View>
      <View style={{ position: 'absolute', right: -15, top: chromeBottom + 20 }}>
        <BuiltInWall night={night} />
      </View>
      <View style={{ position: 'absolute', left: 168, top: chromeBottom + 63 }}>
        <WallMedallions night={night} />
      </View>
      <View style={{ position: 'absolute', left: 14, top: floorTop - 126 }}>
        <Armchair night={night} />
      </View>
      <View style={{ position: 'absolute', left: -6, top: floorTop - 189 }}>
        <Lamp night={night} />
      </View>
      <View style={{ position: 'absolute', right: 17, top: floorTop + 13 }}>
        <PetBed upgraded={has('home_bed')} />
      </View>
      <View style={{ position: 'absolute', right: 34, top: floorTop + 92 }}>
        <FloorToy />
      </View>
      {has('home_rug') && (
        <View style={[styles.rug, { top: groundY - 44 }]}> 
          <RNGradient colors={[DIORAMA.goldLight, DIORAMA.gold, DIORAMA.goldDeep]} style={styles.rugInner} />
          <View style={styles.rugHighlight} />
          <View style={styles.rugCore} />
        </View>
      )}
      <View style={[styles.windowGlow, { left: 22, top: chromeBottom + 80, opacity: night ? 0.015 : 0.13 }]} />
      <View style={[styles.floorGlow, { top: floorTop + 9, opacity: night ? 0.02 : 0.12 }]} />
      <View style={{ position: 'absolute', left: -48, bottom: -37 }}><ForegroundPlant /></View>
      <View style={{ position: 'absolute', right: -62, bottom: -40 }}><ForegroundPlant right /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  windowDepth: { position: 'absolute', left: 16, top: 18, borderRadius: radius.pill, backgroundColor: DIORAMA.shadow, opacity: 0.28 },
  windowOuter: { position: 'absolute', left: 2, top: 2, borderRadius: radius.pill },
  windowInner: {
    position: 'absolute',
    left: 6,
    top: 5,
    borderWidth: 10,
    borderTopLeftRadius: radius.pill,
    borderTopRightRadius: radius.pill,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    overflow: 'hidden',
  },
  mullion: { position: 'absolute' },
  windowSill: { position: 'absolute', left: -6, bottom: 16, height: 24, borderRadius: radius.lg },
  windowSillLight: { position: 'absolute', left: 3, bottom: 33, height: 6, borderRadius: radius.pill, backgroundColor: DIORAMA.white },
  windowSeat: { position: 'absolute', left: -10, bottom: -3, height: 38, borderRadius: radius.md, padding: 5 },
  windowCushion: { flex: 1, borderRadius: radius.md },
  windowPillow: { position: 'absolute', left: 25, top: 4, width: 33, height: 28, borderRadius: radius.sm, backgroundColor: DIORAMA.lemon, transform: [{ rotate: '-7deg' }] },
  ceilingTrim: { position: 'absolute', left: 0, right: 0, height: 11 },
  ceilingTrimLight: { position: 'absolute', left: 0, right: 0, height: 3, backgroundColor: DIORAMA.white },
  baseboard: { position: 'absolute', left: 0, right: 0, height: 30 },
  baseboardLight: { position: 'absolute', left: 0, right: 0, height: 6, backgroundColor: DIORAMA.white },
  rug: {
    position: 'absolute',
    left: '22%',
    right: '22%',
    height: 80,
    borderRadius: radius.pill,
    backgroundColor: DIORAMA.goldDeep,
    padding: 7,
    transform: [{ scaleX: 1.19 }],
  },
  rugInner: { flex: 1, borderRadius: radius.pill },
  rugHighlight: { position: 'absolute', left: 26, right: 26, top: 12, height: 8, borderRadius: radius.pill, backgroundColor: DIORAMA.white, opacity: 0.2 },
  rugCore: { position: 'absolute', left: '31%', right: '31%', top: 28, bottom: 18, borderRadius: radius.pill, borderWidth: 4, borderColor: DIORAMA.goldLight, opacity: 0.34 },
  windowGlow: { position: 'absolute', width: 155, height: 330, borderRadius: radius.pill, backgroundColor: DIORAMA.goldGlow, transform: [{ rotate: '-12deg' }] },
  floorGlow: { position: 'absolute', left: 24, width: 226, height: 210, borderRadius: radius.pill, backgroundColor: DIORAMA.goldGlowSoft, transform: [{ rotate: '-9deg' }] },
});
