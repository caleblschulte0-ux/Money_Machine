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
import { Drift, farTint, Foreground, GroundPlane, Haze, LightPool, Motes, Surge, Sway, Vignette } from './depth';

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
  groundY,
  chromeBottom,
}: {
  hour: number;
  upgrades?: string[];
  /** He sleeps IN the bed, so the empty one must not also be sitting there. */
  asleep?: boolean;
  /**
   * Where his feet meet the floor, in pixels from the top of the scene band.
   *
   * The room used to be laid out in PERCENTAGES of the whole scene layer, so
   * the wall/floor seam landed behind his ears, the rug sat across his chest
   * as a wide pink slab, and the window and the portrait hung behind the
   * location tabs. Percentages describe a rectangle; a room has to be built
   * around where the character actually stands, and that is one number.
   */
  groundY: number;
  /** Nothing may hang above this — that is where the app's chrome ends. */
  chromeBottom: number;
}) {
  const band = skyBand(hour);
  const night = band === 'night';
  const dim = (day: string, nite: string) => (night ? nite : day);
  // The floor recedes behind him rather than starting at his toes.
  const floorTop = Math.max(chromeBottom + 88, groundY - 112);
  const wallArt = chromeBottom + 22;
  const has = (id: string) => upgrades.includes(id);
  const bigWindow = has('home_window');
  /**
   * The beam of window light on the floor, in the floor SVG's 420-wide
   * coordinates. It starts under the window (left: 7%) and lands further
   * right and wider, because light through an opening spreads as it travels
   * — a straight-down rectangle read as a spilled drink, not a beam.
   */
  const wl = 37;
  const wr = wl + (bigWindow ? 168 : 112);
  const wm = (wl + wr) / 2;
  return (
    <View style={styles.fill} pointerEvents="none">
      {/*
        The back wall. Lit from above and dimming toward the floor — the old
        room was one flat cream sheet from chrome to seam, which is most of
        why the middle of the screen read as dead space.
      */}
      <View style={[styles.fill, { bottom: undefined, height: floorTop }]}>
        <LinearGradient colors={night ? ['#5B5477', '#453F58'] : ['#FAF4E5', '#E9D8B9']} style={styles.fill} />
        {/* Ambient shadow where the wall meets the floor; the seam is a
            corner, and a corner is dark, not a ruled line. */}
        <LinearGradient
          colors={['rgba(74,58,36,0)', 'rgba(74,58,36,0.18)']}
          style={{ position: 'absolute', left: 0, right: 0, bottom: 12, height: 34 }}
        />
        {/* skirting board */}
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 12, height: 2.5, backgroundColor: dim('#CBB183', '#57503F') }} />
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 12, backgroundColor: dim('#E7D8B4', '#6E6350') }} />
      </View>

      {/* The floor is a PLANE: lighter where it meets the wall, warmer and
          darker as it comes toward the camera, planks converging with it. */}
      <GroundPlane top={floorTop} far={dim('#EBDCB8', '#6B5F50')} near={dim('#CDAF7F', '#4C4235')}>
        <Svg width="100%" height="100%" viewBox="0 0 420 300" preserveAspectRatio="none">
          {[60, 140, 220, 300, 380].map((x) => (
            <Path key={x} d={`M${x} 0 L${210 + (x - 210) * 1.9} 300`} stroke={dim('#BFA271', '#3E362B')} strokeWidth={2} opacity={0.45} />
          ))}
          {/* plank ends, spaced wider as they come nearer */}
          <Path d="M0 46 H420" stroke={dim('#BFA271', '#3E362B')} strokeWidth={1.4} opacity={0.25} />
          <Path d="M0 118 H420" stroke={dim('#BFA271', '#3E362B')} strokeWidth={2} opacity={0.3} />
          <Path d="M0 214 H420" stroke={dim('#BFA271', '#3E362B')} strokeWidth={2.6} opacity={0.35} />
        </Svg>
      </GroundPlane>

      {/* Window light, fallen across the planks. Split by the mullion — one
          unbroken patch reads as paint; the gap is what says "glass". */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: floorTop, height: 220 }}>
        <Svg width="100%" height="100%" viewBox="0 0 420 220" preserveAspectRatio="none">
          <Path
            d={`M${wl + 6} 4 L${wm - 4} 4 L${wm + 92} 208 L${wl + 58} 208 Z`}
            fill={dim('#FFE8B0', '#C9D4F4')}
            opacity={night ? 0.12 : 0.26}
          />
          <Path
            d={`M${wm + 4} 4 L${wr - 6} 4 L${wr + 124} 208 L${wm + 104} 208 Z`}
            fill={dim('#FFE8B0', '#C9D4F4')}
            opacity={night ? 0.12 : 0.26}
          />
        </Svg>
      </View>

      {/* A sofa against the back wall, cropped by the left edge — the room
          reads as continuing past the frame, and as somebody's. */}
      <View style={{ position: 'absolute', left: -34, top: floorTop - 72 }}>
        <Svg width={200} height={124} viewBox="0 0 200 124">
          <Ellipse cx={96} cy={116} rx={96} ry={8} fill="#2B2117" opacity={0.16} />
          <Rect x={0} y={0} width={186} height={72} rx={16} fill={dim('#A96C51', '#66463D')} />
          <Rect x={8} y={52} width={86} height={36} rx={10} fill={dim('#C08663', '#7A5548')} />
          <Rect x={98} y={52} width={82} height={36} rx={10} fill={dim('#C08663', '#7A5548')} />
          <Rect x={152} y={12} width={44} height={98} rx={15} fill={dim('#9C6248', '#5C4038')} />
          <Rect x={16} y={20} width={42} height={38} rx={9} fill={dim('#E9C46A', '#A98A4E')} transform="rotate(-8 37 39)" />
          <Rect x={12} y={102} width={10} height={14} rx={3} fill={dim('#6E4A34', '#3A2C22')} />
          <Rect x={132} y={104} width={10} height={12} rx={3} fill={dim('#6E4A34', '#3A2C22')} />
        </Svg>
      </View>

      {/* A floor lamp — and at night it is ON, which is what keeps the night
          room warm instead of abandoned. */}
      <View style={{ position: 'absolute', right: 34, top: floorTop - 134 }}>
        <Svg width={92} height={190} viewBox="0 0 92 190">
          {night && <Circle cx={46} cy={30} r={46} fill="#F5DC8C" opacity={0.22} />}
          <Rect x={43} y={40} width={6} height={122} fill={dim('#6E4A34', '#3A2F26')} />
          <Ellipse cx={46} cy={164} rx={24} ry={7} fill={dim('#6E4A34', '#3A2F26')} />
          <Path d="M26 6 L66 6 L76 44 L16 44 Z" fill={dim('#D8A76F', '#B98F55')} />
          {night && <Ellipse cx={46} cy={45} rx={22} ry={6} fill="#F5DC8C" opacity={0.6} />}
        </Svg>
      </View>

      {/* window with live sky — bought bigger, if he owns the upgrade */}
      <View style={[styles.window, bigWindow && styles.windowBig, { top: wallArt }]}>
        <LinearGradient colors={SKY[band]} style={styles.windowSky}>
          {band === 'night' && (
            <Svg width="100%" height="100%">
              <Circle cx="72%" cy="26%" r={13} fill="#F2EAC8" />
              <Circle cx="66%" cy="22%" r={11} fill={SKY.night[0]} />
              <Circle cx="22%" cy="56%" r={1.6} fill="#F2EAC8" />
              <Circle cx="38%" cy="18%" r={1.4} fill="#F2EAC8" />
              <Circle cx="55%" cy="55%" r={1.4} fill="#F2EAC8" />
            </Svg>
          )}
          {band !== 'night' && (
            <Svg width="100%" height="100%">
              <Ellipse cx="30%" cy="52%" rx={22} ry={9} fill="#FFFFFF" opacity={0.8} />
              <Ellipse cx="68%" cy="58%" rx={17} ry={7} fill="#FFFFFF" opacity={0.65} />
            </Svg>
          )}
        </LinearGradient>
        <View style={styles.windowBarH} />
        <View style={styles.windowBarV} />
        <View style={styles.windowSill} />
      </View>
      {/* framed portrait of the good boy himself */}
      <View style={[styles.frame, { top: wallArt + 8 }]}>
        <Image source={FACE} style={styles.framePhoto} resizeMode="contain" />
      </View>
      {/* The soft shadow-rug he stands on, centred on his feet. */}
      <View style={[styles.homeRug, { top: groundY - 30 }]} />

      {/* Bought furniture is IN THE ROOM. */}
      {has('home_bed') && !asleep && <RoomBed upgraded top={groundY - 44} />}

      {/* A bought rug is a real rug, not a receipt line. */}
      {has('home_rug') && (
        <View style={[styles.rugWrap, { top: groundY - 36 }]}>
          <Svg width="100%" height="100%" viewBox="0 0 300 76" preserveAspectRatio="none">
            <Ellipse cx={150} cy={38} rx={148} ry={36} fill="#9C5B4A" />
            <Ellipse cx={150} cy={38} rx={132} ry={29} fill="#B87860" />
            <Ellipse cx={150} cy={38} rx={104} ry={21} fill="#D8A487" />
            <Ellipse cx={150} cy={38} rx={72} ry={13} fill="#B87860" />
          </Svg>
        </View>
      )}

      {/* NEAR: the doorframe we are looking into the room past, cropped by
          the right edge. Big, dark, undetailed — near things sit in shadow,
          out of the light the room is lit by. */}
      <View style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 30, flexDirection: 'row' }}>
        <View style={{ width: 9, backgroundColor: dim('#4E3A24', '#241C12') }} />
        <View style={{ width: 2.5, backgroundColor: dim('#8A6844', '#453424') }} />
        <View style={{ flex: 1, backgroundColor: dim('#6E5133', '#382B1C') }} />
      </View>

      <Motes top={floorTop - 140} height={220} tint={night ? '#C9D8E8' : '#FFF3CE'} />
      <LightPool y={groundY - 4} width={310} opacity={night ? 0.16 : 0.4} />
      <Vignette strength={night ? 0.28 : 0.14} />
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
export function RoomBed({ upgraded = false, top }: { upgraded?: boolean; top?: number }) {
  const rim = upgraded ? '#4E3D63' : '#6E5133';
  const wall = upgraded ? '#6B558A' : '#8A6844';
  const cushion = upgraded ? '#EFE3F2' : '#E3D2AC';
  return (
    <View style={[styles.roomBed, top !== undefined && { top, bottom: undefined }]} pointerEvents="none">
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
 * The percentages are of the SCENE BAND, which stops above the dialogue panel
 * rather than running the full height of the screen. Everything sits below the
 * chrome inside that band — at the old full-screen values the moon rose into
 * the location tabs.
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
          <Circle cx="84%" cy="46%" r={54} fill="#F5DC8C" opacity={0.22} />
          <Circle cx="84%" cy="46%" r={30} fill="#F7E39B" opacity={0.95} />
        </>
      )}
      {band === 'evening' && (
        <>
          <Circle cx="84%" cy="48%" r={56} fill="#EFA35C" opacity={0.2} />
          <Circle cx="84%" cy="48%" r={30} fill="#F0AF6E" opacity={0.95} />
        </>
      )}
      {band === 'morning' && (
        <>
          <Circle cx="84%" cy="60%" r={50} fill="#F5DC8C" opacity={0.2} />
          <Circle cx="84%" cy="60%" r={26} fill="#F8E7B4" opacity={0.95} />
        </>
      )}
      {night && (
        <>
          <Circle cx="84%" cy="60%" r={40} fill="#F2EAC8" opacity={0.13} />
          <Circle cx="84%" cy="60%" r={22} fill="#F2EAC8" />
          <Circle cx="18%" cy="58%" r={1.7} fill="#F2EAC8" />
          <Circle cx="34%" cy="53%" r={1.4} fill="#F2EAC8" />
          <Circle cx="52%" cy="41%" r={1.5} fill="#F2EAC8" />
          <Circle cx="62%" cy="56%" r={1.3} fill="#F2EAC8" />
          <Circle cx="88%" cy="58%" r={1.5} fill="#F2EAC8" />
        </>
      )}
      <Ellipse cx="24%" cy="52%" rx={44} ry={15} fill="#FFFFFF" opacity={night ? 0.12 : 0.7} />
      <Ellipse cx="34%" cy="49%" rx={30} ry={11} fill="#FFFFFF" opacity={night ? 0.1 : 0.55} />
      <Ellipse cx="70%" cy="60%" rx={34} ry={12} fill="#FFFFFF" opacity={night ? 0.1 : 0.5} />
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


/**
 * The apron: the ground, continuing underneath the interface.
 *
 * Every outdoor scene used to stop dead at the bottom of its band, so the
 * picture ended in a ruler-straight line with the cream UI starting below it.
 * That single edge is most of what made the screen read as a web page with an
 * illustration pasted at the top. The world now runs on under the dialogue
 * panel and the horizon gradient fades it out, which is what a camera would
 * see and what every game that looks good does.
 *
 * The colour is each scene's NEAREST ground, sampled from the bottom of its
 * own ground drawing — a mismatch here would just move the seam rather than
 * remove it.
 */
const APRON = {
  park: { day: '#AECB84', night: '#78905C' },
  town: { day: '#C6AB80', night: '#4E4436' },
  beach: { day: '#D6BB8A', night: '#63553F' },
} as const;

function Apron({ place, night }: { place: keyof typeof APRON; night: boolean }) {
  return <View style={[styles.apron, { backgroundColor: APRON[place][night ? 'night' : 'day'] }]} />;
}

export function ParkScene({ hour, bandHeight = 620, groundY }: { hour: number; bandHeight?: number; groundY?: number }) {
  const band = skyBand(hour);
  const night = band === 'night';
  const sky = SKY[band][1];
  /**
   * The horizon sits where HE stands, not at a fixed fraction of the band.
   *
   * It used to be `bandHeight * 0.74` on every phone, which put the far hills
   * behind his ears on a short screen and left a lake of empty grass under him
   * on a tall one. A scene is composed around where the character's feet are.
   */
  const horizon = (groundY ?? bandHeight * 0.72) - 132;
  /**
   * Haze applies at NIGHT TOO — more, in fact. The first version skipped the
   * tint after dark and returned the daytime colour untouched, so the far
   * treeline and the fence rendered in full noon greens against a night sky:
   * a bright day-lit band floating behind the dogs. Night air is still air;
   * distance still washes toward the sky, and the night sky is dark, so the
   * same mix does the darkening for free.
   */
  const far = (c: string) => farTint(c, sky, night ? 0.7 : 0.34);
  const mid = (c: string) => farTint(c, sky, night ? 0.45 : 0.2);

  return (
    <View style={styles.fill} pointerEvents="none">
      <View style={{ height: bandHeight }}>
        <LinearGradient colors={SKY[band]} style={styles.fill} />
        <SkyDetail band={band} />

        {/* FAR: a treeline, washed most of the way into the sky. */}
        <Svg width="100%" height={horizon + 40} viewBox="0 0 420 400" preserveAspectRatio="none" style={styles.ground}>
          <Ellipse cx={70} cy={362} rx={150} ry={62} fill={far('#8FA96A')} />
          <Ellipse cx={210} cy={372} rx={170} ry={54} fill={far('#9CB477')} />
          <Ellipse cx={370} cy={358} rx={160} ry={66} fill={far('#8FA96A')} />
          {[38, 96, 168, 250, 318, 392].map((x, i) => (
            <React.Fragment key={x}>
              <Rect x={x - 2} y={318 + (i % 3) * 8} width={5} height={54} fill={far('#6E5A3C')} />
              <Ellipse cx={x} cy={314 + (i % 3) * 8} rx={20 + (i % 3) * 5} ry={22} fill={far('#7E9757')} />
            </React.Fragment>
          ))}
        </Svg>

        {/* The air between here and there. */}
        <Haze top={horizon} color={sky} height={92} />

        {/* THE GROUND, as a plane. */}
        <GroundPlane
          top={horizon}
          far={night ? '#5C7047' : '#B7CE8E'}
          near={night ? '#415533' : '#7E9E56'}
        >
          <Svg width="100%" height="100%" viewBox="0 0 420 340" preserveAspectRatio="none">
            {/* A path running away from the camera. Converging edges are the
                cheapest perspective in the world and the park had none. */}
            <Path d="M150 0 L268 0 L392 340 L34 340 Z" fill={night ? '#5A5138' : '#C4B183'} opacity={0.9} />
            <Path d="M162 0 L256 0 L360 340 L66 340 Z" fill={night ? '#645A3F' : '#D6C69B'} opacity={0.95} />
            {/* Mown stripes, converging with it. */}
            {[0, 1, 2, 3].map((i) => (
              <Path key={i} d={`M${40 + i * 96} 0 L${-40 + i * 150} 340`} stroke={night ? '#4C6039' : '#A8C27E'} strokeWidth={2} opacity={0.5} fill="none" />
            ))}
          </Svg>
        </GroundPlane>

        {/* MIDDLE: the things at his distance. A bench, a fence, a bin — the
            park had none of the furniture that makes a park a park. */}
        <Svg width="100%" height={bandHeight} viewBox="0 0 420 620" preserveAspectRatio="none" style={styles.fill}>
          {/* fence, on the horizon */}
          {Array.from({ length: 10 }, (_, i) => 8 + i * 45).map((x) => (
            <Rect key={x} x={x} y={horizon - 30} width={7} height={32} rx={3} fill={mid('#C6AF84')} />
          ))}
          <Rect x={0} y={horizon - 24} width={420} height={5} rx={2} fill={mid('#BCA478')} />
          <Rect x={0} y={horizon - 12} width={420} height={5} rx={2} fill={mid('#BCA478')} />
          {/* a bench, off to one side, in perspective */}
          <Path d={`M36 ${horizon + 26} L128 ${horizon + 20} L128 ${horizon + 30} L36 ${horizon + 38} Z`} fill={mid('#9A7A4E')} />
          <Path d={`M40 ${horizon + 10} L126 ${horizon + 5} L126 ${horizon + 15} L40 ${horizon + 21} Z`} fill={mid('#AC8B5C')} />
          <Rect x={44} y={horizon + 30} width={6} height={22} fill={mid('#7E6440')} />
          <Rect x={116} y={horizon + 26} width={6} height={22} fill={mid('#7E6440')} />
          {/* a bin */}
          <Rect x={368} y={horizon + 6} width={26} height={34} rx={4} fill={mid('#7E8B66')} />
          <Rect x={365} y={horizon + 2} width={32} height={7} rx={3} fill={mid('#6C7A57')} />
        </Svg>

        {/*
          A tree that is genuinely NEAR — and the first version of it floated in
          the top corner like a balloon, because it was hung off the horizon
          instead of standing on the ground. A near tree's trunk reaches the
          floor at the bottom of the frame; you only ever see part of it.
        */}
        <View style={[styles.nearTree, { top: horizon - 120, height: bandHeight - horizon + 130 }]}>
          <Sway degrees={0.9} seconds={7}>
            <Svg width={210} height={360} viewBox="0 0 210 360">
              <Rect x={44} y={92} width={34} height={268} rx={12} fill={night ? '#3A2C1B' : '#5E4A2C'} />
              <Ellipse cx={70} cy={78} rx={112} ry={86} fill={night ? '#334729' : '#5F7C3C'} />
              <Ellipse cx={16} cy={132} rx={70} ry={58} fill={night ? '#3A5030' : '#6B8946'} />
            </Svg>
          </Sway>
        </View>

        <Motes top={horizon - 40} height={220} tint={night ? '#C9D8E8' : '#FFF6D8'} />
      </View>

      {/*
        FOREGROUND. Grass at the very bottom of the frame, big and dark and out
        of the light he is standing in. The eye reads "there is ground between
        me and him" before it has looked at anything, which is the whole job.
      */}
      <Foreground height={72}>
        <Svg width="100%" height="100%" viewBox="0 0 420 72" preserveAspectRatio="none">
          <Path
            d="M0 72 L0 40 q22 -20 44 -4 q20 -22 44 -2 q26 -24 52 -2 q24 -20 48 -4 q26 -22 52 0 q24 -18 46 -2 q24 -20 48 -4 q22 -16 44 -2 L420 72 Z"
            fill={night ? '#2C3A22' : '#4E6733'}
            opacity={0.9}
          />
        </Svg>
      </Foreground>
      <View style={{ height: 0 }}>
      </View>
      {groundY !== undefined && <LightPool y={groundY - 6} width={330} opacity={night ? 0.14 : 0.42} />}
      <Apron place="park" night={night} />
      <Vignette strength={night ? 0.3 : 0.15} />
    </View>
  );
}

// ---------------------------------------------------------------- town

export function TownScene({ hour, bandHeight = 620, groundY }: { hour: number; bandHeight?: number; groundY?: number }) {
  const band = skyBand(hour);
  const night = band === 'night';
  const sky = SKY[band][1];
  /** Same rule as the park: the street is composed around his feet. */
  const h = (groundY ?? bandHeight * 0.72) - 132;
  const dim = (day: string, nite: string) => (night ? nite : day);
  const mid = (day: string, nite: string) => (night ? nite : farTint(day, sky, 0.12));
  const farC = (day: string, nite: string) => (night ? nite : farTint(day, sky, 0.5));
  return (
    <View style={styles.fill} pointerEvents="none">
      <View style={{ height: bandHeight }}>
        <LinearGradient colors={SKY[band]} style={styles.fill} />
        <SkyDetail band={band} />

        {/*
          FAR: the rest of the town, washed into the sky. Positioned by
          explicit top/height so the drawing lands ABOVE the horizon — the
          bottom-anchored version of this layer in the park spent a whole
          iteration entirely underneath the ground plane, every check green.
        */}
        <View style={{ position: 'absolute', left: 0, right: 0, top: h - 300, height: 300 }}>
          <Svg width="100%" height="100%" viewBox="0 0 420 300" preserveAspectRatio="none">
            <Path d="M-10 300 V196 L28 164 L66 196 V300 Z" fill={farC('#A18A6A', '#3F3850')} />
            <Rect x={66} y={216} width={64} height={84} fill={farC('#96805F', '#39334A')} />
            <Rect x={102} y={196} width={10} height={24} fill={farC('#8D775A', '#332E43')} />
            <Path d="M130 300 V186 L160 162 L190 186 V300 Z" fill={farC('#8D775A', '#3B3550')} />
            {/* the clock tower, seen down the alley between the shops */}
            <Rect x={196} y={130} width={36} height={170} fill={farC('#A18A6A', '#423B57')} />
            <Path d="M192 132 L214 96 L236 132 Z" fill={farC('#8D775A', '#39334A')} />
            <Circle cx={214} cy={152} r={10} fill={farC('#E9DDBE', '#5A5375')} />
            <Path d="M214 152 L214 145 M214 152 L219 152" stroke={farC('#6E5A48', '#39334A')} strokeWidth={1.6} />
            <Rect x={236} y={208} width={70} height={92} fill={farC('#96805F', '#39334A')} />
            <Path d="M306 300 V188 L340 160 L374 188 V300 Z" fill={farC('#A18A6A', '#3F3850')} />
            <Rect x={374} y={214} width={56} height={86} fill={farC('#8D775A', '#332E43')} />
            {night && (
              <>
                <Rect x={82} y={236} width={7} height={9} fill="#F5DC8C" opacity={0.8} />
                <Rect x={252} y={228} width={7} height={9} fill="#F5DC8C" opacity={0.7} />
                <Rect x={330} y={206} width={7} height={9} fill="#F5DC8C" opacity={0.8} />
              </>
            )}
          </Svg>
        </View>

        <Haze top={h} color={sky} height={90} />

        {/* The pavement HE stands on, running away to the kerb. */}
        <GroundPlane top={h + 70} far={dim('#DCCBA8', '#5E5342')} near={dim('#C6AB80', '#4E4436')}>
          <Svg width="100%" height="100%" viewBox="0 0 420 240" preserveAspectRatio="none">
            {[60, 130, 200, 270, 340].map((x) => (
              <Path key={x} d={`M${x} 0 L${210 + (x - 210) * 2} 240`} stroke={dim('#B29874', '#453B2E')} strokeWidth={2} opacity={0.4} />
            ))}
            <Path d="M0 46 H420" stroke={dim('#B29874', '#453B2E')} strokeWidth={1.4} opacity={0.3} />
            <Path d="M0 110 H420" stroke={dim('#B29874', '#453B2E')} strokeWidth={2} opacity={0.3} />
            <Path d="M0 190 H420" stroke={dim('#B29874', '#453B2E')} strokeWidth={2.6} opacity={0.35} />
          </Svg>
        </GroundPlane>

        {/*
          MIDDLE: the street. Camera on our side of it, shops across the
          road — the road BEHIND him is what buys the town its depth, and it
          keeps the kerb line away from his feet, which stand well below the
          band on tall phones.
        */}
        <Svg width="100%" height={bandHeight} viewBox="0 0 420 620" preserveAspectRatio="none" style={styles.fill}>
          {/* left shop: the bakery */}
          <Rect x={-24} y={h - 222} width={209} height={10} fill={mid('#D9BC8A', '#5E5138')} />
          <Rect x={-24} y={h - 212} width={209} height={212} fill={mid('#EBD3A8', '#6E6046')} />
          <Rect x={-24} y={h - 186} width={209} height={30} fill={dim('#B3402E', '#7A2E22')} />
          <Rect x={-24} y={h - 156} width={209} height={3} fill={dim('#8E3123', '#5A241B')} />
          {/* awning, and the shadow it casts — a canopy with no shadow is a sticker */}
          <Path d={`M-8 ${h - 148} L118 ${h - 148} L130 ${h - 122} L-18 ${h - 122} Z`} fill={dim('#C9553E', '#6E3428')} />
          {[10, 44, 78, 112].map((x) => (
            <Path key={x} d={`M${x} ${h - 148} L${x + 16} ${h - 148} L${x + 24} ${h - 122} L${x + 8} ${h - 122} Z`} fill="#E9D9BE" opacity={night ? 0.3 : 0.85} />
          ))}
          {[-10, 10, 30, 50, 70, 90, 110, 130].map((x, i) => (
            <Circle key={x} cx={x} cy={h - 122} r={8} fill={i % 2 === 0 ? dim('#C9553E', '#6E3428') : '#E9D9BE'} opacity={i % 2 === 0 ? 1 : night ? 0.3 : 0.85} />
          ))}
          <Rect x={-4} y={h - 114} width={130} height={12} fill="#000000" opacity={0.13} />
          {/* display window, recessed, with bread in it */}
          <Rect x={0} y={h - 118} width={108} height={98} rx={4} fill={dim('#7A5A38', '#4A3826')} />
          <Rect x={6} y={h - 112} width={96} height={86} fill={dim('#A3C2CF', '#F5DC8C')} />
          {night && <Rect x={12} y={h - 106} width={84} height={74} fill="#FBEDB6" opacity={0.8} />}
          <Rect x={10} y={h - 72} width={88} height={3} fill={dim('#7A5A38', '#B98F55')} opacity={0.6} />
          <Ellipse cx={28} cy={h - 80} rx={9} ry={6} fill={dim('#8A6844', '#C9963C')} opacity={0.75} />
          <Ellipse cx={52} cy={h - 79} rx={7} ry={7} fill={dim('#8A6844', '#C9963C')} opacity={0.75} />
          <Ellipse cx={76} cy={h - 80} rx={8} ry={5} fill={dim('#8A6844', '#C9963C')} opacity={0.75} />
          <Ellipse cx={34} cy={h - 40} rx={10} ry={6} fill={dim('#8A6844', '#C9963C')} opacity={0.7} />
          <Ellipse cx={68} cy={h - 41} rx={9} ry={6} fill={dim('#8A6844', '#C9963C')} opacity={0.7} />
          {!night && <Path d={`M26 ${h - 26} L58 ${h - 112} L74 ${h - 112} L42 ${h - 26} Z`} fill="#FFFFFF" opacity={0.16} />}
          {/* the doorway is a RECESS: reveal, shadowed lintel, door, step */}
          <Rect x={120} y={h - 124} width={54} height={124} fill={dim('#4E3A24', '#1E160E')} />
          <Rect x={120} y={h - 124} width={54} height={8} fill="#000000" opacity={0.2} />
          <Rect x={128} y={h - 114} width={40} height={108} rx={2} fill={dim('#7A5535', '#4A3420')} />
          <Rect x={133} y={h - 106} width={30} height={40} stroke={dim('#5E3F26', '#332416')} strokeWidth={2} fill="none" />
          <Rect x={133} y={h - 58} width={30} height={44} stroke={dim('#5E3F26', '#332416')} strokeWidth={2} fill="none" />
          <Circle cx={162} cy={h - 58} r={3.5} fill="#C9963C" />
          <Rect x={114} y={h - 8} width={66} height={8} rx={2} fill={dim('#D9C49C', '#5E5140')} />

          {/* the alley between the shops, going back to the far town */}
          <Path d={`M185 ${h} L236 ${h} L222 ${h - 56} L199 ${h - 56} Z`} fill={mid('#CFBB92', '#57503F')} />
          <Rect x={199} y={h - 110} width={23} height={54} fill={farC('#9B8468', '#3F3850')} />
          {night && <Rect x={207} y={h - 98} width={7} height={9} fill="#F5DC8C" opacity={0.7} />}
          <Rect x={185} y={h - 212} width={6} height={212} fill="#000000" opacity={0.18} />
          <Rect x={230} y={h - 212} width={6} height={212} fill="#000000" opacity={0.12} />

          {/* right shop: pet supplies */}
          <Rect x={236} y={h - 222} width={208} height={10} fill={mid('#CBB283', '#544732')} />
          <Rect x={236} y={h - 212} width={208} height={212} fill={mid('#DCC492', '#655741')} />
          <Rect x={236} y={h - 186} width={208} height={30} fill={dim('#5C7A52', '#37503A')} />
          <Rect x={236} y={h - 156} width={208} height={3} fill={dim('#48633F', '#2A3B2B')} />
          <Circle cx={412} cy={h - 171} r={13} fill="#F1E4C8" opacity={0.95} />
          <Ellipse cx={412} cy={h - 167} rx={5} ry={4} fill="#5C7A52" />
          <Circle cx={406} cy={h - 175} r={2.2} fill="#5C7A52" />
          <Circle cx={412} cy={h - 177} r={2.2} fill="#5C7A52" />
          <Circle cx={418} cy={h - 175} r={2.2} fill="#5C7A52" />
          <Path d={`M250 ${h - 148} L380 ${h - 148} L392 ${h - 122} L242 ${h - 122} Z`} fill={dim('#5F8054', '#3A5038')} />
          {[266, 300, 334, 366].map((x) => (
            <Path key={x} d={`M${x} ${h - 148} L${x + 16} ${h - 148} L${x + 24} ${h - 122} L${x + 8} ${h - 122} Z`} fill="#E9E4CC" opacity={night ? 0.3 : 0.85} />
          ))}
          {[250, 270, 290, 310, 330, 350, 370, 390].map((x, i) => (
            <Circle key={x} cx={x} cy={h - 122} r={8} fill={i % 2 === 0 ? dim('#5F8054', '#3A5038') : '#E9E4CC'} opacity={i % 2 === 0 ? 1 : night ? 0.3 : 0.85} />
          ))}
          <Rect x={246} y={h - 114} width={142} height={12} fill="#000000" opacity={0.13} />
          <Rect x={252} y={h - 118} width={106} height={98} rx={4} fill={dim('#6B4E30', '#41301E')} />
          <Rect x={258} y={h - 112} width={94} height={86} fill={dim('#A3C2CF', '#F5DC8C')} />
          {night && <Rect x={264} y={h - 106} width={82} height={74} fill="#FBEDB6" opacity={0.8} />}
          <Rect x={270} y={h - 64} width={22} height={20} fill={dim('#8A6844', '#C9963C')} opacity={0.7} />
          <Rect x={296} y={h - 58} width={26} height={14} fill={dim('#8A6844', '#C9963C')} opacity={0.7} />
          <Rect x={272} y={h - 86} width={18} height={16} fill={dim('#8A6844', '#C9963C')} opacity={0.7} />
          <Circle cx={334} cy={h - 52} r={8} fill={dim('#B3402E', '#8E3123')} opacity={0.8} />
          {!night && <Path d={`M276 ${h - 26} L308 ${h - 112} L322 ${h - 112} L290 ${h - 26} Z`} fill="#FFFFFF" opacity={0.16} />}
          {/* flower box: somebody waters these */}
          <Rect x={252} y={h - 18} width={106} height={12} rx={3} fill={dim('#6B4E30', '#3E2E1E')} />
          {!night && (
            <>
              <Circle cx={266} cy={h - 20} r={4} fill="#D96A4A" />
              <Circle cx={281} cy={h - 22} r={3.5} fill="#E9C46A" />
              <Circle cx={296} cy={h - 19} r={3} fill="#5C7A52" />
              <Circle cx={310} cy={h - 21} r={4} fill="#C0563C" />
              <Circle cx={326} cy={h - 22} r={3.5} fill="#D96A4A" />
              <Circle cx={341} cy={h - 19} r={3} fill="#5C7A52" />
            </>
          )}
          {/* the shops stand ON the pavement: contact shadow */}
          <Rect x={-24} y={h} width={468} height={7} fill="#2B2117" opacity={0.18} />

          {/* the far sidewalk, the road, and our kerb — three planes deep */}
          <Rect x={0} y={h + 7} width={420} height={13} fill={dim('#D5C29C', '#5E5342')} />
          <Rect x={0} y={h + 16} width={420} height={5} fill={dim('#B8A57E', '#493F30')} />
          <Rect x={0} y={h + 20} width={420} height={42} fill={dim('#A79A88', '#413B33')} />
          <Path d={`M0 ${h + 34} H420`} stroke={dim('#968A78', '#4A443B')} strokeWidth={1} opacity={0.5} />
          <Path d={`M0 ${h + 50} H420`} stroke={dim('#968A78', '#4A443B')} strokeWidth={1} opacity={0.5} />
          {[30, 52, 74, 96, 118].map((x) => (
            <Path key={x} d={`M${x + 3} ${h + 22} L${x + 11} ${h + 22} L${x + 14} ${h + 60} L${x} ${h + 60} Z`} fill="#E9E2CF" opacity={night ? 0.22 : 0.5} />
          ))}
          <Rect x={0} y={h + 62} width={420} height={8} fill={dim('#DCCBA6', '#6A5D48')} />
          {[30, 95, 160, 225, 290, 355].map((x) => (
            <Rect key={x} x={x} y={h + 62} width={2} height={8} fill={dim('#C2B18C', '#57503F')} opacity={0.8} />
          ))}
          <Rect x={0} y={h + 70} width={420} height={5} fill="#2B2117" opacity={0.22} />

          {/* bollards near the bottom-left, coming toward the camera */}
          <Ellipse cx={24} cy={606} rx={14} ry={4} fill="#2B2117" opacity={0.2} />
          <Rect x={18} y={552} width={13} height={52} rx={5} fill={dim('#4A403A', '#26221E')} />
          <Rect x={18} y={562} width={13} height={4} fill="#E8DFC8" opacity={0.6} />
          <Ellipse cx={60} cy={616} rx={12} ry={4} fill="#2B2117" opacity={0.18} />
          <Rect x={54} y={572} width={12} height={44} rx={5} fill={dim('#4A403A', '#26221E')} />
          <Rect x={54} y={581} width={12} height={4} fill="#E8DFC8" opacity={0.55} />
        </Svg>

        {/* the bakery's hanging sign, swinging a little */}
        <View style={{ position: 'absolute', left: '9%', top: h - 198 }}>
          <Sway degrees={2.2} seconds={4.5}>
            <Svg width={92} height={58} viewBox="0 0 92 58">
              <Rect x={30} y={0} width={4} height={13} fill={dim('#6E5133', '#3A2C1E')} />
              <Rect x={58} y={0} width={4} height={13} fill={dim('#6E5133', '#3A2C1E')} />
              <Rect x={10} y={12} width={72} height={38} rx={9} fill={dim('#4B3527', '#2A211A')} />
              <Path
                d="M30 31 h32 M30 31 a5 5 0 1 1 -6 -6 a5 5 0 1 1 6 6 M62 31 a5 5 0 1 0 6 -6 a5 5 0 1 0 -6 6"
                stroke="#E8D9BC" strokeWidth={5} strokeLinecap="round" fill="none"
              />
            </Svg>
          </Sway>
        </View>

        {/*
          NEAR: a lamppost cropped by the right edge — big, dark, and lit at
          night, when it takes over from the sun as what picks him out.
        */}
        <View style={{ position: 'absolute', right: -18, top: h - 300 }}>
          <Svg width={120} height={560} viewBox="0 0 120 560">
            <Ellipse cx={86} cy={530} rx={26} ry={6} fill="#2B2117" opacity={0.2} />
            <Rect x={78} y={46} width={16} height={470} rx={6} fill={dim('#3E3630', '#211E1B')} />
            <Path d="M70 516 q 6 -14 16 -16 l 8 0 0 20 -24 0 Z" fill={dim('#3E3630', '#211E1B')} />
            <Path d="M86 62 q -4 -24 -34 -22 l 0 9 q 24 -2 26 15 Z" fill={dim('#3E3630', '#211E1B')} />
            <Rect x={40} y={44} width={22} height={6} rx={2} fill={dim('#3E3630', '#211E1B')} />
            {night && <Circle cx={51} cy={66} r={32} fill="#F5DC8C" opacity={0.22} />}
            <Path d="M42 50 L60 50 L64 82 L38 82 Z" fill={dim('#332C26', '#1B1815')} />
            <Rect x={44} y={54} width={14} height={24} fill={night ? '#F5DC8C' : '#DAD2BC'} opacity={night ? 1 : 0.8} />
          </Svg>
        </View>

        <Motes top={h - 40} height={220} tint={night ? '#C9D8E8' : '#FFF6D8'} />
      </View>

      {groundY !== undefined && <LightPool y={groundY - 6} width={330} opacity={night ? 0.18 : 0.4} />}
      <Apron place="town" night={night} />
      <Vignette strength={night ? 0.3 : 0.16} />
    </View>
  );
}

// ------------------------------------------------------- sleep dressing

/** Dim, starry overlay while Barkly sleeps. Renders above the scene. */
export function NightOverlay() {
  return (
    <View style={[styles.fill, styles.night]} pointerEvents="none">
      <Svg width="100%" height="45%">
        <Circle cx="18%" cy="46%" r={1.8} fill="#F2EAC8" opacity={0.9} />
        <Circle cx="34%" cy="14%" r={1.4} fill="#F2EAC8" opacity={0.7} />
        <Circle cx="55%" cy="26%" r={1.7} fill="#F2EAC8" opacity={0.8} />
        <Circle cx="72%" cy="12%" r={1.4} fill="#F2EAC8" opacity={0.7} />
        <Circle cx="88%" cy="48%" r={1.8} fill="#F2EAC8" opacity={0.9} />
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
export function BeachScene({ hour, bandHeight = 620, groundY }: { hour: number; bandHeight?: number; groundY?: number }) {
  const band = skyBand(hour);
  const night = band === 'night';
  const sky = SKY[band][1];
  /**
   * Same composition rule as everywhere else: the scene is built around where
   * he stands. The tide line sits a fixed distance above his feet, so on every
   * phone the sea is BEHIND him and the sand he stands on runs to the bottom
   * of the frame — the old fixed-fraction version put the waterline through
   * his knees on short screens.
   */
  const tide = (groundY ?? bandHeight * 0.72) - 118;
  const horizon = tide - 96;
  const farC = (day: string, nite: string) => (night ? nite : farTint(day, sky, 0.45));
  const dim = (day: string, nite: string) => (night ? nite : day);
  return (
    <View style={styles.fill} pointerEvents="none">
      <View style={{ height: bandHeight }}>
        <LinearGradient colors={SKY[band]} style={styles.fill} />
        <SkyDetail band={band} birds={!night} />

        {/* THE SEA: deep at the horizon, paler as it nears the sand. The far
            band is washed toward the sky so the water meets it as air, not as
            a ruled line. */}
        <View style={{ position: 'absolute', left: 0, right: 0, top: horizon, height: tide - horizon + 26 }}>
          <LinearGradient
            colors={[farC('#6FA3B8', '#2A4258'), dim('#7FB4C4', '#2E4C63'), dim('#9CC8D2', '#3A5B72')]}
            style={StyleSheet.absoluteFill}
          />
          {/* a headland, far off, half dissolved in haze */}
          <Svg width="100%" height="100%" viewBox="0 0 420 120" preserveAspectRatio="none">
            <Path d="M300 26 Q345 2 420 14 L420 26 Z" fill={farC('#7E8E6A', '#33415A')} />
            {/* glints where the light sits on the water */}
            {!night && [22, 46, 74].map((y, i) => (
              <Path key={y} d={`M${40 + i * 90} ${y} h${34 - i * 6}`} stroke="#EAF6F8" strokeWidth={2} opacity={0.5 - i * 0.1} />
            ))}
            {night && <Path d="M186 10 L206 10 L214 120 L166 120 Z" fill="#F2EAC8" opacity={0.14} />}
          </Svg>
        </View>
        <Haze top={horizon} color={sky} height={64} />

        {/* WAVES that actually come in and go out. Two rows on different
            periods, so the water breathes instead of ticking. */}
        <View style={{ position: 'absolute', left: -30, right: -30, top: tide - 34 }}>
          <WaveRow y={0} night={night} seconds={7} travel={14} opacity={0.9} />
          <WaveRow y={16} night={night} seconds={9.5} travel={-18} opacity={0.7} />
        </View>

        {/* THE SAND, as a plane: wet and dark at the tide line, dry and warm
            near the camera. The wet band is what says the sea comes up here. */}
        <GroundPlane top={tide} far={dim('#B99E72', '#4E4433')} near={dim('#E2C795', '#5E5240')}>
          <LinearGradient
            colors={[dim('#8E7A56', '#3A3226'), `${dim('#8E7A56', '#3A3226')}00`]}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 34 }}
          />
          <Svg width="100%" height="100%" viewBox="0 0 420 260" preserveAspectRatio="none">
            {/* the foam edge left by the last wave */}
            <Path d="M-10 8 q 60 6 120 1 t 120 2 t 120 -2 t 90 2" stroke={dim('#F4F7F2', '#9CB0BC')} strokeWidth={3} fill="none" opacity={0.75} />
            {/* sand ripples, converging a little as they near */}
            {[70, 120, 178, 240].map((y, i) => (
              <Path key={y} d={`M${20 - i * 10} ${y} q 200 ${8 + i * 3} ${380 + i * 20} 0`} stroke={dim('#C8AC7C', '#453B2C')} strokeWidth={2} fill="none" opacity={0.4} />
            ))}
            {/* shells and a starfish, small, where a dog would find them */}
            <Ellipse cx={78} cy={116} rx={7} ry={5} fill={dim('#EFE0C8', '#6E6250')} />
            <Path d="M74 116 l8 0 M76 113 l5 5" stroke={dim('#C8AC7C', '#4E4433')} strokeWidth={1} />
            <Circle cx={318} cy={92} r={5} fill={dim('#E8CFB4', '#665A46')} />
            <Path d="M212 168 l6 8 l-10 0 Z M212 168 l-6 8 M212 168 l0 -9" stroke={dim('#D9945E', '#7A5638')} strokeWidth={3} strokeLinecap="round" />
            {/* paw prints wandering up from the water — somebody was here */}
            {[[150, 60], [166, 84], [150, 108], [168, 132]].map(([x, y]) => (
              <React.Fragment key={`${x}${y}`}>
                <Ellipse cx={x} cy={y} rx={5} ry={6.5} fill={dim('#A98E62', '#3E3528')} opacity={0.55} />
                <Circle cx={x - 4} cy={y - 6} r={1.8} fill={dim('#A98E62', '#3E3528')} opacity={0.55} />
                <Circle cx={x + 4} cy={y - 6} r={1.8} fill={dim('#A98E62', '#3E3528')} opacity={0.55} />
              </React.Fragment>
            ))}
          </Svg>
        </GroundPlane>

        {/* NEAR: dune grass, cropped by the frame's left edge. */}
        <View style={{ position: 'absolute', left: -30, top: tide - 60, height: bandHeight - tide + 90 }}>
          <Sway degrees={2.2} seconds={4.5}>
            <Svg width={150} height={260} viewBox="0 0 150 260">
              <Ellipse cx={40} cy={236} rx={96} ry={40} fill={dim('#D3B584', '#4E4433')} />
              {[18, 34, 50, 66, 84].map((x, i) => (
                <Path
                  key={x}
                  d={`M${x} 240 q ${8 - (i % 3) * 6} -70 ${14 - (i % 2) * 22} -104`}
                  stroke={dim('#7E8E5A', '#3A4A30')}
                  strokeWidth={4.5 - (i % 2)}
                  strokeLinecap="round"
                  fill="none"
                />
              ))}
            </Svg>
          </Sway>
        </View>

        <Motes top={horizon} height={200} tint={night ? '#C9D8E8' : '#F4FBFD'} />
      </View>

      {groundY !== undefined && <LightPool y={groundY - 6} width={330} opacity={night ? 0.14 : 0.4} />}
      <Apron place="beach" night={night} />
      <Vignette strength={night ? 0.3 : 0.14} />
    </View>
  );
}

/**
 * One line of surf, sliding in and out.
 *
 * The travel is the whole point — a static foam squiggle is a drawing OF a
 * wave, and the review's exact complaint was that the water never moved. The
 * row overhangs both screen edges so its ends never show while it slides.
 */
function WaveRow({ y, night, seconds, travel, opacity }: {
  y: number;
  night: boolean;
  seconds: number;
  travel: number;
  opacity: number;
}) {
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: y }}>
      <Drift distance={travel} seconds={seconds}>
        <Svg width="120%" height={22} viewBox="0 0 480 22" preserveAspectRatio="none">
          <Path
            d="M0 12 q 30 -9 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0"
            stroke={night ? '#8FA9BC' : '#F2FAFB'}
            strokeWidth={5}
            fill="none"
            opacity={opacity}
          />
          <Path
            d="M0 18 q 30 -7 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0 t 60 0"
            stroke={night ? '#5B7286' : '#C2E2E8'}
            strokeWidth={3}
            fill="none"
            opacity={opacity * 0.7}
          />
        </Svg>
      </Drift>
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

  // `top` is supplied by HomeScene from the ground line; see groundY there.
  window: {
    position: 'absolute', left: '7%', width: 126, height: 112,
    borderRadius: 14, borderWidth: 7, borderColor: '#C9AF7E',
    overflow: 'hidden', backgroundColor: '#C9AF7E',
  },
  windowSky: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  windowBarH: { position: 'absolute', top: '50%', left: 0, right: 0, height: 5, backgroundColor: '#C9AF7E' },
  windowBarV: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 5, backgroundColor: '#C9AF7E' },
  windowSill: { position: 'absolute', bottom: 0, left: -8, right: -8, height: 8, backgroundColor: '#BCA271' },
  frame: {
    position: 'absolute', right: '8%', width: 74, height: 66,
    borderRadius: 8, borderWidth: 5, borderColor: '#8A6844', backgroundColor: '#F4EAD2',
    alignItems: 'center', justifyContent: 'center',
    transform: [{ rotate: '2.5deg' }],
  },
  framePhoto: { width: 56, height: 48 },
  // Back and to the left, clear of the rug and of his shadow. Lower and it
  // reads as a smear behind the rug; further right and he stands in it.
  roomBed: { position: 'absolute', left: '3%' },
  bedBack: { position: 'absolute', bottom: 10, alignSelf: 'center' },
  bedFront: { position: 'absolute', bottom: -6, alignSelf: 'center' },

  // Grows down and wider. Growing upward just hid it behind the tab bar.
  windowBig: { width: 172, height: 150, borderWidth: 9 },
  // Under his feet. At 8% the input bar covered the front half of it.
  rugWrap: { position: 'absolute', alignSelf: 'center', width: 286, height: 68 },
  homeRug: {
    position: 'absolute', alignSelf: 'center', width: 300, height: 64,
    borderRadius: 150, backgroundColor: '#C77C52', opacity: 0.3,
  },
  nearTree: { position: 'absolute', left: -58 },
  ground: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  apron: { flex: 1, marginTop: -2 },

});
