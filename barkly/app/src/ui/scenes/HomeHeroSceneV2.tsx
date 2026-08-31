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
  morning: ['#ffd39b', '#8ed7e8'],
  day: ['#9fdef2', '#e9f8ff'],
  evening: ['#ffaf76', '#f8d6a9'],
  night: ['#23344b', '#4b5b78'],
};

const DAY = {
  wallTop: '#596b73',
  wallBottom: '#73838a',
  wallInset: '#41545d',
  wallEdge: '#34454d',
  woodLight: '#d99250',
  wood: '#a96332',
  woodDeep: '#6a351f',
  woodDark: '#44251a',
  floorFar: '#d39a61',
  floorNear: '#a85f35',
  floorLine: '#7a4229',
  cream: '#fff0ce',
  creamDeep: '#e5c38d',
  coral: '#d96858',
  coralDeep: '#a94742',
  teal: '#4f9d9b',
  tealDeep: '#2e6d70',
  mustard: '#f0b84e',
  leaf: '#4f7f5b',
  leafDark: '#31563f',
  ink: '#2a2829',
};

function ArchWindow({ band, upgraded }: { band: SkyBand; upgraded: boolean }) {
  const night = band === 'night';
  const w = upgraded ? 206 : 190;
  const h = upgraded ? 250 : 228;
  return (
    <View style={{ width: w + 30, height: h + 34 }}>
      <View style={[styles.windowDepth, { width: w + 20, height: h + 18 }]} />
      <View style={[styles.windowOuter, { width: w + 8, height: h + 8 }]} />
      <View style={[styles.windowInner, { width: w, height: h }]}>
        <RNGradient colors={SKY[band]} style={styles.fill} />
        <Svg width="100%" height="100%" viewBox="0 0 200 250" preserveAspectRatio="none">
          <Defs>
            <SvgLinearGradient id="outsideHillBack" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={night ? '#324c56' : '#85b67a'} />
              <Stop offset="1" stopColor={night ? '#1f343c' : '#557f5b'} />
            </SvgLinearGradient>
            <SvgLinearGradient id="outsideHillFront" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={night ? '#29414b' : '#6d9d67'} />
              <Stop offset="1" stopColor={night ? '#182c35' : '#3d694b'} />
            </SvgLinearGradient>
          </Defs>
          {night ? (
            <>
              <Circle cx={152} cy={53} r={20} fill="#f7dda0" opacity={0.94} />
              <Circle cx={144} cy={45} r={19} fill="#2c415a" />
              {[23, 50, 82, 112, 170].map((x, i) => (
                <Circle key={x} cx={x} cy={32 + (i % 2) * 25} r={i % 2 ? 1.4 : 2} fill="#fff2cb" opacity={0.8} />
              ))}
            </>
          ) : (
            <>
              <Circle cx={154} cy={54} r={39} fill="#ffd77c" opacity={0.16} />
              <Circle cx={154} cy={54} r={20} fill="#ffd35b" />
            </>
          )}
          <Path d="M-15 167Q40 116 87 151Q132 180 218 126V265H-15Z" fill="url(#outsideHillBack)" />
          <Path d="M-15 194Q43 145 99 178Q145 205 218 156V265H-15Z" fill="url(#outsideHillFront)" />
          {!night && <Path d="M13 24Q65 5 117 22" stroke="#fff" strokeWidth={11} strokeLinecap="round" opacity={0.35} />}
          <Path d="M7 218Q54 206 93 216T191 207" stroke={night ? '#4d6570' : '#d7c994'} strokeWidth={5} strokeLinecap="round" opacity={0.5} />
        </Svg>
        <View style={[styles.mullion, { left: '50%', top: 0, bottom: 0, width: 8, marginLeft: -4 }]} />
        <View style={[styles.mullion, { left: 0, right: 0, top: '57%', height: 8 }]} />
      </View>
      <View style={[styles.windowSill, { width: w + 30 }]} />
      <View style={[styles.windowSillLight, { width: w + 12, opacity: night ? 0.08 : 0.42 }]} />
      <View style={[styles.windowSeat, { width: w + 38 }]}> 
        <View style={styles.windowCushion} />
        <View style={styles.windowPillow} />
      </View>
    </View>
  );
}

function BuiltInWall({ night }: { night: boolean }) {
  const body = night ? '#5a3527' : DAY.wood;
  const bodyDeep = night ? '#34251f' : DAY.woodDeep;
  return (
    <Svg width={166} height={344} viewBox="0 0 166 344">
      <Defs>
        <SvgLinearGradient id="builtBody" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={night ? '#79513d' : DAY.woodLight} />
          <Stop offset={0.24} stopColor={body} />
          <Stop offset="1" stopColor={bodyDeep} />
        </SvgLinearGradient>
        <SvgLinearGradient id="builtInset" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={night ? '#273740' : DAY.wallInset} />
          <Stop offset="1" stopColor={night ? '#1a2931' : DAY.wallEdge} />
        </SvgLinearGradient>
      </Defs>
      <Ellipse cx={82} cy={335} rx={72} ry={8} fill="#201710" opacity={0.24} />
      <Rect x={7} y={6} width={153} height={325} rx={36} fill={bodyDeep} />
      <Rect x={0} y={0} width={153} height={321} rx={36} fill="url(#builtBody)" />
      <Path d="M16 16Q76 -1 137 18" stroke="#fff" strokeWidth={9} strokeLinecap="round" opacity={night ? 0.05 : 0.19} />

      <Path d="M17 90V50Q17 24 45 24H109Q137 24 137 50V90Z" fill="url(#builtInset)" />
      <Rect x={17} y={83} width={120} height={72} rx={18} fill="url(#builtInset)" />
      <Rect x={17} y={163} width={120} height={57} rx={18} fill={night ? '#4a3328' : '#8d512e'} />
      <Rect x={17} y={228} width={120} height={75} rx={20} fill={night ? '#2b3840' : DAY.cream} opacity={0.94} />

      <Rect x={28} y={101} width={16} height={39} rx={5} fill="#725a9c" />
      <Rect x={48} y={95} width={18} height={45} rx={5} fill="#5f9ca6" />
      <Rect x={70} y={106} width={16} height={34} rx={5} fill="#c7685d" />
      <Rect x={91} y={98} width={15} height={42} rx={5} fill="#d5a343" />
      <Circle cx={119} cy={121} r={14} fill="#e4c879" />
      <Circle cx={119} cy={121} r={8} fill="#685138" />
      <Circle cx={119} cy={121} r={3} fill="#2b2725" />

      <Path d="M31 180H121" stroke="#fff" strokeWidth={6} strokeLinecap="round" opacity={night ? 0.05 : 0.18} />
      <Path d="M55 194Q75 174 95 194Q78 211 55 194Z" fill="#f0c05c" />
      <Circle cx={111} cy={192} r={4} fill="#f2d47c" />

      <Rect x={31} y={242} width={92} height={20} rx={9} fill={night ? '#413c37' : '#e7c99d'} />
      <Rect x={31} y={270} width={92} height={20} rx={9} fill={night ? '#413c37' : '#e7c99d'} />
      <Circle cx={111} cy={252} r={4} fill="#e8c85d" />
      <Circle cx={111} cy={280} r={4} fill="#e8c85d" />
    </Svg>
  );
}

function Armchair({ night }: { night: boolean }) {
  const body = night ? '#824a44' : DAY.coral;
  const edge = night ? '#5e3734' : DAY.coralDeep;
  return (
    <Svg width={146} height={133} viewBox="0 0 146 133">
      <Defs>
        <SvgLinearGradient id="armchair" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={night ? '#9a665d' : '#ee8b72'} />
          <Stop offset={0.35} stopColor={body} />
          <Stop offset="1" stopColor={edge} />
        </SvgLinearGradient>
      </Defs>
      <Ellipse cx={73} cy={126} rx={57} ry={7} fill="#241812" opacity={0.23} />
      <Rect x={22} y={17} width={103} height={82} rx={33} fill={edge} />
      <Rect x={18} y={10} width={103} height={82} rx={33} fill="url(#armchair)" />
      <Rect x={2} y={54} width={39} height={52} rx={19} fill={body} />
      <Rect x={106} y={54} width={38} height={52} rx={19} fill={body} />
      <Rect x={36} y={74} width={70} height={31} rx={15} fill={night ? '#6e403c' : '#c85b51'} />
      <Rect x={51} y={46} width={38} height={35} rx={11} fill={DAY.mustard} transform="rotate(-8 70 64)" />
      <Path d="M33 22Q72 7 108 24" stroke="#fff" strokeWidth={7} strokeLinecap="round" opacity={night ? 0.05 : 0.24} />
      <Rect x={30} y={101} width={10} height={22} rx={4} fill={DAY.woodDark} />
      <Rect x={105} y={101} width={10} height={22} rx={4} fill={DAY.woodDark} />
    </Svg>
  );
}

function Lamp({ night }: { night: boolean }) {
  return (
    <Svg width={76} height={185} viewBox="0 0 76 185">
      <Defs>
        <SvgLinearGradient id="lampShade2" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={night ? '#f0cf75' : '#ffe08b'} />
          <Stop offset="1" stopColor={night ? '#9d6e31' : '#c68a37'} />
        </SvgLinearGradient>
      </Defs>
      <Ellipse cx={38} cy={177} rx={28} ry={7} fill="#20160f" opacity={0.22} />
      <Rect x={34} y={56} width={8} height={108} rx={4} fill={DAY.woodDark} />
      <Path d="M38 63V151" stroke="#d99963" strokeWidth={2.7} strokeLinecap="round" opacity={0.4} />
      <Ellipse cx={38} cy={166} rx={22} ry={7} fill="#5a3425" />
      <Path d="M11 14H64L71 56H4Z" fill="url(#lampShade2)" />
      <Path d="M19 19H56" stroke="#fff" strokeWidth={6} strokeLinecap="round" opacity={night ? 0.14 : 0.42} />
    </Svg>
  );
}

function PetBed({ upgraded }: { upgraded: boolean }) {
  const w = upgraded ? 136 : 118;
  return (
    <Svg width={w} height={83} viewBox="0 0 136 83">
      <Ellipse cx={68} cy={77} rx={55} ry={6} fill="#211a15" opacity={0.2} />
      <Ellipse cx={68} cy={48} rx={59} ry={28} fill={DAY.tealDeep} />
      <Ellipse cx={68} cy={39} rx={57} ry={26} fill={DAY.teal} />
      <Ellipse cx={68} cy={49} rx={42} ry={16} fill="#efc963" />
      <Path d="M30 27Q68 11 106 28" stroke="#fff" strokeWidth={7} strokeLinecap="round" opacity={0.24} />
      <Circle cx={68} cy={49} r={4} fill="#b68234" opacity={0.6} />
      <Circle cx={57} cy={46} r={4} fill="#b68234" opacity={0.6} />
      <Circle cx={79} cy={46} r={4} fill="#b68234" opacity={0.6} />
    </Svg>
  );
}

function WallMedallions({ night }: { night: boolean }) {
  const frame = night ? '#704737' : DAY.wood;
  return (
    <Svg width={92} height={155} viewBox="0 0 92 155">
      <Rect x={12} y={6} width={68} height={75} rx={18} fill={DAY.woodDeep} opacity={0.32} />
      <Rect x={7} y={1} width={68} height={75} rx={18} fill={frame} />
      <Rect x={15} y={9} width={52} height={59} rx={14} fill={night ? '#40505b' : '#f0d5a8'} />
      <Path d="M35 54V24H46Q59 24 59 34Q59 41 52 44Q61 47 61 56Q61 67 46 67H35Z" fill={DAY.woodDeep} opacity={0.84} />
      <Circle cx={42} cy={120} r={26} fill={DAY.woodDeep} opacity={0.28} />
      <Circle cx={38} cy={116} r={26} fill={frame} />
      <Circle cx={38} cy={116} r={18} fill={night ? '#40505b' : '#f0d5a8'} />
      <Circle cx={38} cy={112} r={5} fill={DAY.woodDeep} />
      <Circle cx={29} cy={115} r={4} fill={DAY.woodDeep} />
      <Circle cx={47} cy={115} r={4} fill={DAY.woodDeep} />
      <Path d="M28 126Q38 117 48 126Q42 133 38 133Q34 133 28 126Z" fill={DAY.woodDeep} />
    </Svg>
  );
}

function ForegroundPlant({ right = false }: { right?: boolean }) {
  const flip = right ? -1 : 1;
  return (
    <Svg width={138} height={175} viewBox="0 0 138 175" style={{ transform: [{ scaleX: flip }] }}>
      <Ellipse cx={45} cy={166} rx={42} ry={8} fill="#251a14" opacity={0.22} />
      <Path d="M27 174Q58 111 71 44" stroke={DAY.woodDeep} strokeWidth={9} strokeLinecap="round" />
      <Ellipse cx={63} cy={50} rx={30} ry={13} fill={DAY.leafDark} transform="rotate(-40 63 50)" />
      <Ellipse cx={88} cy={76} rx={35} ry={15} fill={DAY.leaf} transform="rotate(28 88 76)" />
      <Ellipse cx={50} cy={104} rx={34} ry={15} fill={DAY.leafDark} transform="rotate(-31 50 104)" />
      <Ellipse cx={84} cy={130} rx={36} ry={16} fill={DAY.leaf} transform="rotate(24 84 130)" />
      <Path d="M48 42Q63 35 77 44" stroke="#fff" strokeWidth={5} strokeLinecap="round" opacity={0.15} />
    </Svg>
  );
}

function FloorToy() {
  return (
    <Svg width={72} height={48} viewBox="0 0 72 48">
      <Ellipse cx={35} cy={43} rx={30} ry={5} fill="#211710" opacity={0.18} />
      <Circle cx={36} cy={24} r={20} fill="#7560b2" />
      <Path d="M22 16Q35 7 50 16" stroke="#fff" strokeWidth={5} strokeLinecap="round" opacity={0.2} />
      <Circle cx={30} cy={23} r={3} fill="#332742" />
      <Circle cx={43} cy={23} r={3} fill="#332742" />
      <Path d="M31 31Q36 35 42 30" stroke="#332742" strokeWidth={2.5} strokeLinecap="round" fill="none" />
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
  const wallTop = night ? '#293845' : DAY.wallTop;
  const wallBottom = night ? '#40505a' : DAY.wallBottom;
  const floorFar = night ? '#654936' : DAY.floorFar;
  const floorNear = night ? '#493327' : DAY.floorNear;
  const floorLine = night ? '#33261f' : DAY.floorLine;

  return (
    <View style={styles.fill} pointerEvents="none">
      <RNGradient colors={[wallTop, wallBottom]} style={[styles.fill, { bottom: undefined, height: floorTop }]} />

      <Svg width="100%" height="100%" viewBox="0 0 420 760" preserveAspectRatio="none" style={styles.fill}>
        <Defs>
          <SvgLinearGradient id="heroWallLight" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#ffc86a" stopOpacity={night ? 0.02 : 0.18} />
            <Stop offset={0.42} stopColor="#fff" stopOpacity={night ? 0 : 0.025} />
            <Stop offset="1" stopColor="#112028" stopOpacity={night ? 0.2 : 0.11} />
          </SvgLinearGradient>
          <SvgLinearGradient id="heroFloor" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={floorFar} />
            <Stop offset="1" stopColor={floorNear} />
          </SvgLinearGradient>
          <SvgLinearGradient id="sunPool2" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#ffd378" stopOpacity={night ? 0 : 0.32} />
            <Stop offset="1" stopColor="#ffd378" stopOpacity={0} />
          </SvgLinearGradient>
        </Defs>
        <Rect x={0} y={0} width={420} height={floorTop} fill="url(#heroWallLight)" />

        <Path d={`M0 ${chromeBottom + 54}H420`} stroke="#fff" strokeWidth={2} opacity={night ? 0.025 : 0.08} />
        <Path d={`M0 ${chromeBottom + 121}H420`} stroke="#263940" strokeWidth={1.5} opacity={night ? 0.08 : 0.08} />
        <Path d={`M0 ${chromeBottom + 188}H420`} stroke="#263940" strokeWidth={1.5} opacity={night ? 0.08 : 0.07} />

        <Rect x={0} y={floorTop} width={420} height={760 - floorTop} fill="url(#heroFloor)" />
        {[34, 106, 178, 250, 322, 394].map((x) => (
          <Path key={x} d={`M${x} ${floorTop}L${210 + (x - 210) * 1.83} 760`} stroke={floorLine} strokeWidth={2.2} opacity={night ? 0.18 : 0.27} />
        ))}
        {[floorTop + 43, floorTop + 96, floorTop + 160, floorTop + 238].map((y) => (
          <Path key={y} d={`M0 ${y}H420`} stroke={floorLine} strokeWidth={2} opacity={night ? 0.14 : 0.22} />
        ))}
        {!night && <Path d={`M0 ${floorTop + 4}L176 ${floorTop + 4}L269 760H0Z`} fill="url(#sunPool2)" />}
      </Svg>

      <View style={[styles.ceilingTrim, { top: chromeBottom + 22, opacity: night ? 0.7 : 0.94 }]} />
      <View style={[styles.ceilingTrimLight, { top: chromeBottom + 22, opacity: night ? 0.05 : 0.24 }]} />
      <View style={[styles.baseboard, { top: floorTop - 30 }]} />
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
          <RNGradient colors={['#f0b65a', '#d68642', '#a75c38']} style={styles.rugInner} />
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
  windowDepth: { position: 'absolute', left: 16, top: 18, borderRadius: 56, backgroundColor: '#172126', opacity: 0.28 },
  windowOuter: { position: 'absolute', left: 2, top: 2, borderRadius: 58, backgroundColor: DAY.woodDeep },
  windowInner: {
    position: 'absolute',
    left: 6,
    top: 5,
    borderWidth: 10,
    borderColor: DAY.wood,
    borderTopLeftRadius: 58,
    borderTopRightRadius: 58,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    overflow: 'hidden',
  },
  mullion: { position: 'absolute', backgroundColor: DAY.wood },
  windowSill: { position: 'absolute', left: -6, bottom: 16, height: 24, borderRadius: radius.lg, backgroundColor: DAY.woodDeep },
  windowSillLight: { position: 'absolute', left: 3, bottom: 33, height: 6, borderRadius: radius.pill, backgroundColor: '#fff' },
  windowSeat: { position: 'absolute', left: -10, bottom: -3, height: 38, borderRadius: 18, backgroundColor: '#8a4f31', padding: 5 },
  windowCushion: { flex: 1, borderRadius: 14, backgroundColor: '#d76b58' },
  windowPillow: { position: 'absolute', left: 25, top: 4, width: 33, height: 28, borderRadius: 10, backgroundColor: DAY.mustard, transform: [{ rotate: '-7deg' }] },
  ceilingTrim: { position: 'absolute', left: 0, right: 0, height: 11, backgroundColor: DAY.woodDark },
  ceilingTrimLight: { position: 'absolute', left: 0, right: 0, height: 3, backgroundColor: '#fff' },
  baseboard: { position: 'absolute', left: 0, right: 0, height: 30, backgroundColor: DAY.woodDeep },
  baseboardLight: { position: 'absolute', left: 0, right: 0, height: 6, backgroundColor: '#fff' },
  rug: {
    position: 'absolute',
    left: '22%',
    right: '22%',
    height: 80,
    borderRadius: radius.pill,
    backgroundColor: '#7d432f',
    padding: 7,
    transform: [{ scaleX: 1.19 }],
  },
  rugInner: { flex: 1, borderRadius: radius.pill },
  rugHighlight: { position: 'absolute', left: 26, right: 26, top: 12, height: 8, borderRadius: radius.pill, backgroundColor: '#fff', opacity: 0.2 },
  rugCore: { position: 'absolute', left: '31%', right: '31%', top: 28, bottom: 18, borderRadius: radius.pill, borderWidth: 4, borderColor: '#f4c76e', opacity: 0.34 },
  windowGlow: { position: 'absolute', width: 155, height: 330, borderRadius: radius.pill, backgroundColor: '#ffd06d', transform: [{ rotate: '-12deg' }] },
  floorGlow: { position: 'absolute', left: 24, width: 226, height: 210, borderRadius: radius.pill, backgroundColor: '#ffd477', transform: [{ rotate: '-9deg' }] },
});
