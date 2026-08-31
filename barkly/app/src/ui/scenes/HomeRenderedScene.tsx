import React from 'react';
import { ColorValue, Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect } from 'react-native-svg';
import { radius } from '../theme';
import { DIORAMA } from './artPalette';
import { skyBand, SkyBand } from './CandyScenesV2';

const CHAIR = require('../../../assets/world/home/props/chair.png');
const LAMP = require('../../../assets/world/home/props/lamp.png');
const BED = require('../../../assets/world/home/props/bed.png');
const SHELF = require('../../../assets/world/home/props/shelf.png');
const WINDOW_FRAME = require('../../../assets/world/home/architecture/window_frame.png');

const SKY: Record<SkyBand, readonly [ColorValue, ColorValue]> = {
  morning: [DIORAMA.skyMorningA, DIORAMA.skyMorningB],
  day: [DIORAMA.skyDayA, DIORAMA.skyDayB],
  evening: [DIORAMA.skyEveningA, DIORAMA.skyEveningB],
  night: [DIORAMA.skyNightA, DIORAMA.skyNightB],
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * A real rendered frame around a live, code-owned view.
 *
 * The timber, bevels and sill come from Blender, while the sky and hills remain
 * React Native layers behind the transparent panes. Home therefore gets real
 * material depth without becoming one baked background image.
 */
function RenderedWindow({
  band,
  upgraded,
  top,
  scale,
}: {
  band: SkyBand;
  upgraded: boolean;
  top: number;
  scale: number;
}) {
  const night = band === 'night';
  const width = (upgraded ? 224 : 208) * scale;
  const height = width * (760 / 720);

  return (
    <View style={[styles.windowWrap, { top, width, height }]}>
      <View
        style={[
          styles.windowCastShadow,
          {
            left: 16 * scale,
            top: 20 * scale,
            width: width * 0.83,
            height: height * 0.74,
            opacity: night ? 0.34 : 0.22,
          },
        ]}
      />
      <View
        style={[
          styles.skyAperture,
          {
            left: width * 0.19,
            top: height * 0.22,
            width: width * 0.61,
            height: height * 0.53,
          },
        ]}
      >
        <LinearGradient colors={SKY[band]} style={styles.fill} />
        <View
          style={[
            styles.sunMoon,
            {
              backgroundColor: night ? DIORAMA.goldLight : DIORAMA.lemon,
              opacity: night ? 0.82 : 1,
            },
          ]}
        />
        <View style={[styles.hillBack, { backgroundColor: night ? DIORAMA.hillNight : DIORAMA.parkHillDayLight }]} />
        <View style={[styles.hillFront, { backgroundColor: night ? DIORAMA.parkHillNight : DIORAMA.parkHillDay }]} />
        {!night && <View style={styles.windowGlint} />}
      </View>
      <Image source={WINDOW_FRAME} resizeMode="contain" style={[styles.windowImage, { width, height }]} />
      {upgraded && <View style={[styles.windowUpgradeSpark, { width: width * 0.46 }]} />}
    </View>
  );
}

function PictureMedallion({ top, night }: { top: number; night: boolean }) {
  return (
    <View style={[styles.pictureShadow, { top, opacity: night ? 0.5 : 0.2 }]}>
      <View style={styles.picture}>
        <View style={styles.pictureInset}>
          <View style={styles.pawPalm} />
          <View style={[styles.pawToe, { left: 12, top: 9 }]} />
          <View style={[styles.pawToe, { left: 25, top: 5 }]} />
          <View style={[styles.pawToe, { left: 38, top: 9 }]} />
        </View>
      </View>
    </View>
  );
}

function WallMillwork({ floorTop, night }: { floorTop: number; night: boolean }) {
  const rail = night ? DIORAMA.woodNight : DIORAMA.woodMid;
  return (
    <>
      <LinearGradient
        colors={night ? ['rgba(46,38,51,0.42)', 'rgba(35,30,44,0.16)'] : ['rgba(255,241,208,0.18)', 'rgba(197,139,78,0.12)']}
        style={[styles.wainscot, { top: floorTop - 132, height: 105 }]}
      />
      <View style={[styles.wainscotRailShadow, { top: floorTop - 137 }]} />
      <View style={[styles.wainscotRail, { top: floorTop - 142, backgroundColor: rail }]} />
      {[82, 205, 328].map((left) => (
        <View
          key={left}
          style={[
            styles.panelStile,
            {
              left,
              top: floorTop - 129,
              height: 94,
              backgroundColor: rail,
              opacity: night ? 0.32 : 0.26,
            },
          ]}
        />
      ))}
      <View style={[styles.panelBaseGlow, { top: floorTop - 34, opacity: night ? 0.04 : 0.18 }]} />
    </>
  );
}

function RenderedProp({
  source,
  left,
  right,
  top,
  width,
  height,
  night,
  rotate,
  opacity = 1,
}: {
  source: ReturnType<typeof require>;
  left?: number;
  right?: number;
  top: number;
  width: number;
  height: number;
  night: boolean;
  rotate?: string;
  opacity?: number;
}) {
  return (
    <Image
      source={source}
      resizeMode="contain"
      style={{
        position: 'absolute',
        left,
        right,
        top,
        width,
        height,
        opacity: (night ? 0.78 : 1) * opacity,
        transform: rotate ? [{ rotate }] : undefined,
      }}
    />
  );
}

function Rug({ groundY, night }: { groundY: number; night: boolean }) {
  return (
    <View style={[styles.rug, { top: groundY - 50, opacity: night ? 0.68 : 1 }]}>
      <LinearGradient colors={[DIORAMA.goldLight, DIORAMA.gold, DIORAMA.goldDeep]} style={styles.rugInner} />
      <View style={styles.rugRing} />
      <View style={styles.rugHighlight} />
    </View>
  );
}

function ForegroundVignette() {
  return (
    <>
      <LinearGradient
        colors={['rgba(35,18,8,0)', 'rgba(35,18,8,0.22)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.bottomVignette}
      />
      <View style={[styles.foregroundLeaf, styles.leafLeftA]} />
      <View style={[styles.foregroundLeaf, styles.leafLeftB]} />
      <View style={[styles.foregroundLeaf, styles.leafRightA]} />
      <View style={[styles.foregroundLeaf, styles.leafRightB]} />
    </>
  );
}

/**
 * Home's production renderer.
 *
 * The room shell stays deterministic React Native. High-value objects and
 * architecture are transparent renders from a shared Blender camera/light rig.
 * Every object remains individually placeable, replaceable and upgradeable.
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
  asleep?: boolean;
  groundY: number;
  chromeBottom: number;
}) {
  const { width } = useWindowDimensions();
  // More screen reveals more room; the authored objects do not inflate forever.
  const propScale = clamp(width / 390, 0.92, 1.05);
  const band = skyBand(hour);
  const night = band === 'night' || asleep;
  const has = (id: string) => upgrades.includes(id);
  const floorTop = Math.max(chromeBottom + 190, groundY - 158);

  const wall: readonly [ColorValue, ColorValue] = night
    ? [DIORAMA.wallNightA, DIORAMA.wallNightB]
    : [DIORAMA.wallDayA, DIORAMA.wallDayB];
  const floorFar = night ? DIORAMA.floorNightFar : DIORAMA.floorDayFar;
  const floorNear = night ? DIORAMA.floorNightNear : DIORAMA.floorDayNear;
  const floorLine = night ? DIORAMA.floorNightEdge : DIORAMA.floorDayEdge;

  const chairW = 158 * propScale;
  const chairH = chairW * (398 / 374);
  const lampW = 82 * propScale;
  const lampH = lampW * 2;
  const shelfW = 152 * propScale;
  const shelfH = shelfW * (481 / 298);
  const bedW = (has('home_bed') ? 154 : 136) * propScale;
  const bedH = bedW * (254 / 512);

  return (
    <View style={styles.fill} pointerEvents="none">
      <LinearGradient colors={wall} style={[styles.fill, { bottom: undefined, height: floorTop }]} />

      <Svg width="100%" height="100%" viewBox="0 0 420 760" preserveAspectRatio="none" style={styles.fill}>
        <Rect x={0} y={floorTop} width={420} height={760 - floorTop} fill={floorFar} />
        <Rect x={0} y={floorTop + 78} width={420} height={682 - floorTop} fill={floorNear} opacity={0.72} />
        {[34, 106, 178, 250, 322, 394].map((x) => (
          <Path
            key={x}
            d={`M${x} ${floorTop}L${210 + (x - 210) * 1.85} 760`}
            stroke={floorLine}
            strokeWidth={2}
            opacity={night ? 0.15 : 0.22}
          />
        ))}
        {[floorTop + 44, floorTop + 99, floorTop + 166, floorTop + 244].map((y) => (
          <Path key={y} d={`M0 ${y}H420`} stroke={floorLine} strokeWidth={2} opacity={night ? 0.12 : 0.18} />
        ))}
      </Svg>

      <LinearGradient
        colors={night ? ['rgba(16,18,35,0.18)', 'rgba(16,18,35,0)'] : ['rgba(255,218,132,0.30)', 'rgba(255,218,132,0)']}
        start={{ x: 0, y: 0.18 }}
        end={{ x: 0.74, y: 0.76 }}
        style={[styles.lightPool, { top: chromeBottom + 18, height: Math.max(270, groundY - chromeBottom + 28) }]}
      />

      <View style={[styles.ceilingTrim, { top: chromeBottom + 20, backgroundColor: night ? DIORAMA.woodNight : DIORAMA.woodDeep }]} />
      <WallMillwork floorTop={floorTop} night={night} />
      <View style={[styles.baseboard, { top: floorTop - 27, backgroundColor: night ? DIORAMA.woodNight : DIORAMA.woodDeep }]} />
      <View style={[styles.baseboardGlint, { top: floorTop - 24, opacity: night ? 0.04 : 0.22 }]} />

      <RenderedWindow band={night ? 'night' : band} upgraded={has('home_window')} top={chromeBottom + 46} scale={propScale} />
      <PictureMedallion top={chromeBottom + 94} night={night} />

      <RenderedProp source={SHELF} right={-9} top={chromeBottom + 48} width={shelfW} height={shelfH} night={night} />
      <RenderedProp source={LAMP} left={-3} top={floorTop - lampH + 11} width={lampW} height={lampH} night={night} />
      <RenderedProp
        source={CHAIR}
        left={8}
        top={floorTop - chairH + 36}
        width={chairW}
        height={chairH}
        night={night}
        rotate="-1deg"
      />
      <RenderedProp
        source={BED}
        right={10}
        top={floorTop + 12}
        width={bedW}
        height={bedH}
        night={night}
        rotate="1deg"
      />

      {has('home_rug') && <Rug groundY={groundY} night={night} />}

      <View style={[styles.floorBounce, { top: groundY - 24, opacity: night ? 0.035 : 0.11 }]} />
      <ForegroundVignette />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  lightPool: { position: 'absolute', left: 0, width: '74%' },
  ceilingTrim: {
    position: 'absolute', left: 0, right: 0, height: 12,
    borderBottomLeftRadius: radius.sm, borderBottomRightRadius: radius.sm,
  },
  baseboard: { position: 'absolute', left: 0, right: 0, height: 28 },
  baseboardGlint: { position: 'absolute', left: 0, right: 0, height: 5, backgroundColor: DIORAMA.white },
  wainscot: { position: 'absolute', left: 0, right: 0 },
  wainscotRailShadow: {
    position: 'absolute', left: 0, right: 0, height: 18,
    backgroundColor: DIORAMA.shadow, opacity: 0.11,
  },
  wainscotRail: {
    position: 'absolute', left: 0, right: 0, height: 12,
    borderRadius: radius.sm,
  },
  panelStile: {
    position: 'absolute', width: 5,
    borderRadius: radius.xs,
  },
  panelBaseGlow: {
    position: 'absolute', left: 0, right: 0, height: 6,
    backgroundColor: DIORAMA.white,
  },
  windowWrap: { position: 'absolute', left: -5 },
  windowCastShadow: {
    position: 'absolute',
    backgroundColor: DIORAMA.shadow,
    borderRadius: radius.lg,
    transform: [{ rotate: '1deg' }],
  },
  skyAperture: {
    position: 'absolute', overflow: 'hidden',
    borderRadius: radius.md,
    backgroundColor: DIORAMA.skyDayA,
  },
  windowImage: { position: 'absolute', left: 0, top: 0 },
  sunMoon: { position: 'absolute', right: 18, top: 16, width: 28, height: 28, borderRadius: radius.md },
  hillBack: {
    position: 'absolute', left: -24, right: 32, bottom: -30, height: 82,
    borderRadius: radius.pill, transform: [{ rotate: '-6deg' }],
  },
  hillFront: {
    position: 'absolute', left: 34, right: -26, bottom: -36, height: 88,
    borderRadius: radius.pill, transform: [{ rotate: '8deg' }],
  },
  windowGlint: {
    position: 'absolute', left: 12, top: 15, width: '44%', height: 7,
    borderRadius: radius.pill, backgroundColor: DIORAMA.white, opacity: 0.2,
    transform: [{ rotate: '-9deg' }],
  },
  windowUpgradeSpark: {
    position: 'absolute', left: 29, bottom: 25, height: 5,
    borderRadius: radius.pill, backgroundColor: DIORAMA.goldLight, opacity: 0.72,
  },
  pictureShadow: {
    position: 'absolute', left: '49%', width: 80, height: 94, marginLeft: -40,
    borderRadius: radius.lg, backgroundColor: DIORAMA.shadow,
    transform: [{ translateX: 4 }, { translateY: 6 }, { rotate: '-2deg' }],
  },
  picture: {
    position: 'absolute', left: -4, top: -6, width: 76, height: 88,
    padding: 7, borderRadius: radius.lg,
    backgroundColor: DIORAMA.woodWarm,
  },
  pictureInset: {
    flex: 1, borderRadius: radius.md, backgroundColor: DIORAMA.cream,
    alignItems: 'center', justifyContent: 'center',
  },
  pawPalm: { position: 'absolute', left: 21, top: 28, width: 30, height: 25, borderRadius: radius.md, backgroundColor: DIORAMA.woodDeep },
  pawToe: { position: 'absolute', width: 10, height: 13, borderRadius: radius.xs, backgroundColor: DIORAMA.woodDeep },
  rug: {
    position: 'absolute', left: '22%', right: '22%', height: 78,
    borderRadius: radius.pill, padding: 6, backgroundColor: DIORAMA.goldDeep,
    transform: [{ scaleX: 1.2 }],
  },
  rugInner: { flex: 1, borderRadius: radius.pill },
  rugRing: {
    position: 'absolute', left: '29%', right: '29%', top: 26, bottom: 17,
    borderRadius: radius.pill, borderWidth: 4, borderColor: DIORAMA.goldLight, opacity: 0.4,
  },
  rugHighlight: {
    position: 'absolute', left: 28, right: 28, top: 11, height: 7,
    borderRadius: radius.pill, backgroundColor: DIORAMA.white, opacity: 0.2,
  },
  floorBounce: {
    position: 'absolute', left: '18%', right: '18%', height: 110,
    borderRadius: radius.pill, backgroundColor: DIORAMA.goldGlowSoft,
    transform: [{ scaleX: 1.35 }],
  },
  bottomVignette: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 },
  foregroundLeaf: {
    position: 'absolute', bottom: -26, width: 92, height: 42,
    borderRadius: radius.pill, backgroundColor: DIORAMA.parkTreeDayEdge, opacity: 0.84,
  },
  leafLeftA: { left: -35, transform: [{ rotate: '34deg' }] },
  leafLeftB: { left: 5, bottom: -39, transform: [{ rotate: '62deg' }], opacity: 0.72 },
  leafRightA: { right: -36, transform: [{ rotate: '-32deg' }] },
  leafRightB: { right: 4, bottom: -39, transform: [{ rotate: '-61deg' }], opacity: 0.72 },
});