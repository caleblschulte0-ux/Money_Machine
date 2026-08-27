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

/**
 * Home, plus whatever has been bought for it. `upgrades` is the set of placed
 * home item ids — a bought rug is ON THE FLOOR, not a line in a receipt. They
 * stack: bed and rug and window are not alternatives to each other.
 */
export function HomeScene({
  hour,
  upgrades = [],
  asleep = false,
}: {
  hour: number;
  upgrades?: string[];
  /** He sleeps IN the bed, so the empty one must not also be sitting there. */
  asleep?: boolean;
}) {
  const band = skyBand(hour);
  const has = (id: string) => upgrades.includes(id);
  const bigWindow = has('home_window');
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
      {/* window with live sky — bought bigger, if he owns the upgrade */}
      <View style={[styles.window, bigWindow && styles.windowBig]}>
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

      {/* Bought furniture is IN THE ROOM. */}
      {has('home_bed') && !asleep && <RoomBed upgraded />}

      {/* A bought rug is a real rug, not a receipt line. */}
      {has('home_rug') && (
        <View style={styles.rugWrap}>
          <Svg width="100%" height="100%" viewBox="0 0 300 76" preserveAspectRatio="none">
            <Ellipse cx={150} cy={38} rx={148} ry={36} fill="#9C5B4A" />
            <Ellipse cx={150} cy={38} rx={132} ry={29} fill="#B87860" />
            <Ellipse cx={150} cy={38} rx={104} ry={21} fill="#D8A487" />
            <Ellipse cx={150} cy={38} rx={72} ry={13} fill="#B87860" />
          </Svg>
        </View>
      )}
    </View>
  );
}

/**
 * The dog bed AS FURNITURE, sitting in the room whether or not he is in it.
 *
 * This is the bug the shop had been hiding: `home_bed` is the first house
 * item you can afford (level 2, 220 coins) and it was drawn ONLY while he was
 * asleep. You bought it, the shop said "out", the room looked exactly the
 * same, and the only way to see the thing you paid for was to put him to bed.
 * The rug and the window were wired into the scene; the bed never was.
 *
 * The sleeping bed is still the big centred one he lies in — this is the same
 * object seen from across the room, so buying it changes the room and using it
 * still reads as him getting into it.
 */
export function RoomBed({ upgraded = false }: { upgraded?: boolean }) {
  const rim = upgraded ? '#4E3D63' : '#6E5133';
  const wall = upgraded ? '#6B558A' : '#8A6844';
  const cushion = upgraded ? '#EFE3F2' : '#E3D2AC';
  return (
    <View style={styles.roomBed} pointerEvents="none">
      <Svg width={116} height={56} viewBox="0 0 132 62">
        <Ellipse cx={66} cy={34} rx={64} ry={22} fill={rim} />
        <Ellipse cx={66} cy={31} rx={57} ry={18} fill={wall} />
        <Ellipse cx={66} cy={35} rx={48} ry={13} fill={cushion} />
        {/* the near lip, so it reads as a bowl rather than a mat */}
        <Path d="M2 34 a64 22 0 0 0 128 0 a64 26 0 0 1 -128 0 Z" fill={rim} />
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------- park

/**
 * The sky, shared by every outdoor scene.
 *
 * It used to be a fixed 190px strip pinned to the top of the park only, which
 * did three unhelpful things: it put the sun directly behind the header pills
 * on any tall phone, it left the whole middle of the screen an empty wash, and
 * the beach had no sky furniture at all. One component, in PERCENTAGES, fixes
 * all three — everything sits below the chrome (which ends around 22% of the
 * height) and spreads down toward the horizon, so the sky reads as depth
 * rather than dead space.
 */
function SkyDetail({ band, birds = true }: { band: SkyBand; birds?: boolean }) {
  const night = band === 'night';
  return (
    <Svg width="100%" height="100%" style={styles.fill}>
      {/* A bare disc reads as a rendering glitch. The halo is what makes it a sun. */}
      {band === 'day' && (
        <>
          <Circle cx="84%" cy="30%" r={54} fill="#F5DC8C" opacity={0.22} />
          <Circle cx="84%" cy="30%" r={30} fill="#F7E39B" opacity={0.95} />
        </>
      )}
      {band === 'evening' && (
        <>
          <Circle cx="84%" cy="32%" r={56} fill="#EFA35C" opacity={0.2} />
          <Circle cx="84%" cy="32%" r={30} fill="#F0AF6E" opacity={0.95} />
        </>
      )}
      {band === 'morning' && (
        <>
          <Circle cx="84%" cy="29%" r={50} fill="#F5DC8C" opacity={0.2} />
          <Circle cx="84%" cy="29%" r={26} fill="#F8E7B4" opacity={0.95} />
        </>
      )}
      {night && (
        <>
          <Circle cx="84%" cy="29%" r={40} fill="#F2EAC8" opacity={0.13} />
          <Circle cx="84%" cy="29%" r={22} fill="#F2EAC8" />
          <Circle cx="18%" cy="27%" r={1.7} fill="#F2EAC8" />
          <Circle cx="34%" cy="35%" r={1.4} fill="#F2EAC8" />
          <Circle cx="52%" cy="25%" r={1.5} fill="#F2EAC8" />
          <Circle cx="62%" cy="40%" r={1.3} fill="#F2EAC8" />
          <Circle cx="88%" cy="43%" r={1.5} fill="#F2EAC8" />
        </>
      )}
      <Ellipse cx="24%" cy="34%" rx={44} ry={15} fill="#FFFFFF" opacity={night ? 0.12 : 0.7} />
      <Ellipse cx="34%" cy="31%" rx={30} ry={11} fill="#FFFFFF" opacity={night ? 0.1 : 0.55} />
      <Ellipse cx="70%" cy="45%" rx={34} ry={12} fill="#FFFFFF" opacity={night ? 0.1 : 0.5} />
      {/* Two birds, because an empty sky is the thing that reads unfinished. */}
      {birds && !night && (
        <>
          <Path d="M148 232 q7 -7 14 0 q7 -7 14 0" stroke="#8C7C63" strokeWidth={2} fill="none" opacity={0.5} />
          <Path d="M196 258 q5 -5 10 0 q5 -5 10 0" stroke="#8C7C63" strokeWidth={1.8} fill="none" opacity={0.4} />
        </>
      )}
    </Svg>
  );
}


export function ParkScene({ hour }: { hour: number }) {
  const band = skyBand(hour);
  const night = band === 'night';
  return (
    <View style={styles.fill} pointerEvents="none">
      <LinearGradient colors={SKY[band]} style={styles.fill} />
      <SkyDetail band={band} />
      {/* ground block, anchored to the bottom */}
      <Svg width="100%" height={460} viewBox="0 0 420 460" preserveAspectRatio="none" style={styles.ground}>
        {/* A far ridge above the near hills. Two planes of green instead of
            one is what stops the horizon reading as a flat cut-off. */}
        <Ellipse cx={140} cy={70} rx={230} ry={54} fill={night ? '#6C7F58' : '#CBDCAB'} opacity={0.85} />
        <Ellipse cx={352} cy={78} rx={190} ry={48} fill={night ? '#74875F' : '#D2E1B5'} opacity={0.8} />
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
      <SkyDetail band={band} />
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
// ---------------------------------------------------------------- beach

/**
 * The beach — the place you work towards. It is deliberately the most open
 * scene: a horizon rather than a wall, because "somewhere bigger" is the
 * whole reason to want it.
 */
export function BeachScene({ hour }: { hour: number }) {
  const band = skyBand(hour);
  const night = band === 'night';
  const dim = (day: string, nite: string) => (night ? nite : day);
  return (
    <View style={styles.fill} pointerEvents="none">
      <LinearGradient colors={SKY[band]} style={styles.fill} />
      <SkyDetail band={band} />
      <Svg width="100%" height={560} viewBox="0 0 420 560" preserveAspectRatio="none" style={styles.ground}>
        {/* far sea */}
        <Rect x={0} y={196} width={420} height={92} fill={dim('#5E93A8', '#243E52')} />
        <Rect x={0} y={196} width={420} height={5} fill={dim('#8FBACB', '#3A5B72')} />
        {/* nearer water, lighter */}
        <Rect x={0} y={272} width={420} height={54} fill={dim('#7FB4C4', '#2E4C63')} />
        {/* foam lines */}
        {[232, 258, 286, 308].map((y, i) => (
          <Path
            key={y}
            d={`M-20 ${y} q 60 ${i % 2 ? -7 : 7} 120 0 t 120 0 t 120 0 t 120 0`}
            stroke={dim('#EAF4F7', '#8FA9BC')}
            strokeWidth={3}
            fill="none"
            opacity={0.75}
          />
        ))}
        {/* wet sand, then dry sand */}
        <Path d="M0 320 q 105 -14 210 0 t 210 0 L420 560 L0 560 Z" fill={dim('#CDB489', '#8B7A5E')} />
        <Path d="M0 356 q 105 -12 210 0 t 210 0 L420 560 L0 560 Z" fill={dim('#E6D2A8', '#9E8C6B')} />
        {/* shells and a bit of seaweed, so it is not an empty gradient */}
        <Ellipse cx={72} cy={432} rx={11} ry={7} fill={dim('#F4E7CE', '#AC9C7C')} />
        <Ellipse cx={318} cy={470} rx={9} ry={6} fill={dim('#F0DCC0', '#A89873')} />
        <Path d="M336 398 q 14 -12 26 -2 q -10 12 -26 2 Z" fill={dim('#5C7A52', '#3C5236')} />
        <Path d="M96 500 q 18 -10 30 2 q -14 10 -30 -2 Z" fill={dim('#5C7A52', '#3C5236')} />
        {/* Gulls out over the water, off to the sides. They used to sit dead
            centre at head height, which put both of them behind Barkly. */}
        {!night && (
          <>
            <Path d="M28 148 q 10 -8 20 0 q 10 -8 20 0" stroke="#7A6A55" strokeWidth={2.5} fill="none" />
            <Path d="M352 122 q 8 -6 16 0 q 8 -6 16 0" stroke="#7A6A55" strokeWidth={2} fill="none" />
          </>
        )}
      </Svg>
    </View>
  );
}

/**
 * The bed comes in two halves and the dog goes BETWEEN them.
 *
 * A single ellipse behind him left him hovering over a mat like a hologram.
 * Drawing the front rim over his lower body is what makes him look nestled
 * IN the bed rather than parked on it — and it hides the stub of leg the
 * lying-down frame still has. Neither half works alone.
 */
export function DogBedBack({ upgraded = false }: { upgraded?: boolean }) {
  // The bought bed is plusher and a different material, so the upgrade is
  // visible at a glance rather than a number in a menu.
  const rim = upgraded ? '#4E3D63' : '#6E5133';
  const wall = upgraded ? '#6B558A' : '#8A6844';
  const cushion = upgraded ? '#EFE3F2' : '#E3D2AC';
  return (
    <View style={styles.bedBack} pointerEvents="none">
      <Svg width={348} height={104} viewBox="0 0 348 104">
        <Ellipse cx={174} cy={52} rx={170} ry={46} fill={rim} />
        <Ellipse cx={174} cy={47} rx={152} ry={37} fill={wall} />
        <Ellipse cx={174} cy={54} rx={132} ry={29} fill={cushion} />
      </Svg>
    </View>
  );
}

export function DogBedFront({ upgraded = false }: { upgraded?: boolean }) {
  const rim = upgraded ? '#584673' : '#7A5A38';
  const wall = upgraded ? '#6B558A' : '#8A6844';
  return (
    <View style={styles.bedFront} pointerEvents="none">
      <Svg width={348} height={56} viewBox="0 0 348 56">
        {/* Only the near lip of the rim: a half-ellipse clipped by the viewBox. */}
        <Ellipse cx={174} cy={6} rx={170} ry={46} fill={rim} />
        <Ellipse cx={174} cy={0} rx={152} ry={38} fill={wall} />
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
  // Back and to the left, clear of the rug and of his shadow. Lower and it
  // reads as a smear behind the rug; further right and he stands in it.
  roomBed: { position: 'absolute', bottom: '28%', left: '2%' },
  bedBack: { position: 'absolute', bottom: 10, alignSelf: 'center' },
  bedFront: { position: 'absolute', bottom: -6, alignSelf: 'center' },

  // Grows down and wider. Growing upward just hid it behind the tab bar.
  windowBig: { width: 172, height: 150, borderWidth: 9, top: '23%' },
  // Under his feet. At 8% the input bar covered the front half of it.
  rugWrap: { position: 'absolute', bottom: '17%', alignSelf: 'center', width: 286, height: 68 },
  homeRug: {
    position: 'absolute', bottom: '15%', alignSelf: 'center', width: 300, height: 64,
    borderRadius: 150, backgroundColor: '#C77C52', opacity: 0.3,
  },
  ground: { position: 'absolute', bottom: 0, left: 0, right: 0 },

});
