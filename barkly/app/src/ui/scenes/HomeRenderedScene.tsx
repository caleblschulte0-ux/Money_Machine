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

const SKY: Record<SkyBand, readonly [ColorValue, ColorValue]> = {
  morning: [DIORAMA.skyMorningA, DIORAMA.skyMorningB],
  day: [DIORAMA.skyDayA, DIORAMA.skyDayB],
  evening: [DIORAMA.skyEveningA, DIORAMA.skyEveningB],
  night: [DIORAMA.skyNightA, DIORAMA.skyNightB],
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function ArchWindow({
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
  const width = (upgraded ? 208 : 188) * scale;
  const height = (upgraded ? 238 : 218) * scale;

  return (
    <View style={[styles.windowWrap, { top, width: width + 26, height: height + 42 }]}>
      <View style={[styles.windowDepth, { width: width + 16, height: height + 18 }]} />
      <View style={[styles.windowFrame, { width: width + 7, height: height + 8 }]}>
        <View style={[styles.windowGlass, { width, height }]}>
          <LinearGradient colors={SKY[band]} style={styles.fill} />
          <View
            style={[
              styles.sunMoon,
              {
                backgroundColor: night ? DIORAMA.goldLight : DIORAMA.lemon,
                opacity: night ? 0.85 : 1,
              },
            ]}
          />
          <View style={[styles.hillBack, { backgroundColor: night ? DIORAMA.hillNight : DIORAMA.parkHillDayLight }]} />
          <View style={[styles.hillFront, { backgroundColor: night ? DIORAMA.parkHillNight : DIORAMA.parkHillDay }]} />
          <View style={styles.windowVertical} />
          <View style={styles.windowHorizontal} />
          {!night && <View style={styles.windowGlint} />}
        </View>
      </View>
      <View style={[styles.windowSill, { width: width + 28 }]} />
      {upgraded && <View style={[styles.windowUpgradeTrim, { width: width + 42 }]} />}
    </View>
  );
}

function PictureMedallion({ top, night }: { top: number; night: boolean }) {
  return (
    <View style={[styles.picture, { top, opacity: night ? 0.66 : 1 }]}>
      <View style={styles.pictureInset}>
        <View style={styles.pawPalm} />
        <View style={[styles.pawToe, { left: 12, top: 9 }]} />
        <View style={[styles.pawToe, { left: 25, top: 5 }]} />
        <View style={[styles.pawToe, { left: 38, top: 9 }]} />
      </View>
    </View>
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
}: {
  source: ReturnType<typeof require>;
  left?: number;
  right?: number;
  top: number;
  width: number;
  height: number;
  night: boolean;
  rotate?: string;
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
        opacity: night ? 0.76 : 1,
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
 * The room architecture remains deterministic React Native code, but the
 * furniture is authored as real 3D volumes and rendered to transparent PNGs.
 * That keeps every chair/lamp/bed/shelf independently placeable, replaceable,
 * and upgradeable without baking the room into one background image.
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
  // More screen reveals more room; furniture does not balloon on tablets.
  const propScale = clamp(width / 390, 0.92, 1.05);
  const band = skyBand(hour);
  const night = band === 'night' || asleep;
  const has = (id: string) => upgrades.includes(id);
  const floorTop = Math.max(chromeBottom + 188, groundY - 158);

  const wall: readonly [ColorValue, ColorValue] = night
    ? [DIORAMA.wallNightA, DIORAMA.wallNightB]
    : [DIORAMA.wallDayA, DIORAMA.wallDayB];
  const floorFar = night ? DIORAMA.floorNightFar : DIORAMA.floorDayFar;
  const floorNear = night ? DIORAMA.floorNightNear : DIORAMA.floorDayNear;
  const floorLine = night ? DIORAMA.floorNightEdge : DIORAMA.floorDayEdge;

  const chairW = 156 * propScale;
  const chairH = chairW * (398 / 374);
  const lampW = 79 * propScale;
  const lampH = lampW * 2;
  const shelfW = 148 * propScale;
  const shelfH = shelfW * (481 / 298);
  const bedW = (has('home_bed') ? 150 : 130) * propScale;
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
        colors={night ? ['rgba(16,18,35,0.18)', 'rgba(16,18,35,0)'] : ['rgba(255,218,132,0.28)', 'rgba(255,218,132,0)']}
        start={{ x: 0, y: 0.2 }}
        end={{ x: 0.72, y: 0.75 }}
        style={[styles.lightPool, { top: chromeBottom + 20, height: Math.max(260, groundY - chromeBottom + 20) }]}
      />

      <View style={[styles.ceilingTrim, { top: chromeBottom + 20, backgroundColor: night ? DIORAMA.woodNight : DIORAMA.woodDeep }]} />
      <View style={[styles.baseboard, { top: floorTop - 27, backgroundColor: night ? DIORAMA.woodNight : DIORAMA.woodDeep }]} />
      <View style={[styles.baseboardGlint, { top: floorTop - 24, opacity: night ? 0.04 : 0.22 }]} />

      <ArchWindow band={night ? 'night' : band} upgraded={has('home_window')} top={chromeBottom + 36} scale={propScale} />
      <PictureMedallion top={chromeBottom + 72} night={night} />

      <RenderedProp
        source={SHELF}
        right={-5}
        top={chromeBottom + 24}
        width={shelfW}
        height={shelfH}
        night={night}
      />
      <RenderedProp
        source={LAMP}
        left={-5}
        top={floorTop - lampH + 12}
        width={lampW}
        height={lampH}
        night={night}
      />
      <RenderedProp
        source={CHAIR}
        left={10}
        top={floorTop - chairH + 31}
        width={chairW}
        height={chairH}
        night={night}
        rotate="-1deg"
      />
      <RenderedProp
        source={BED}
        right={14}
        top={floorTop + 13}
        width={bedW}
        height={bedH}
        night={night}
        rotate="1deg"
      />

      {has('home_rug') && <Rug groundY={groundY} night={night} />}

      <View style={[styles.floorBounce, { top: groundY - 24, opacity: night ? 0.035 : 0.105 }]} />
      <ForegroundVignette />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  lightPool: { position: 'absolute', left: 0, width: '72%' },
  ceilingTrim: {
    position: 'absolute', left: 0, right: 0, height: 12,
    borderBottomLeftRadius: radius.sm, borderBottomRightRadius: radius.sm,
  },
  baseboard: { position: 'absolute', left: 0, right: 0, height: 28 },
  baseboardGlint: { position: 'absolute', left: 0, right: 0, height: 5, backgroundColor: DIORAMA.white },
  windowWrap: { position: 'absolute', left: -17 },
  windowDepth: {
    position: 'absolute', left: 17, top: 16,
    backgroundColor: DIORAMA.shadow, opacity: 0.26,
    borderTopLeftRadius: 96, borderTopRightRadius: 96,
    borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg,
  },
  windowFrame: {
    position: 'absolute', left: 2, top: 1, padding: 8,
    backgroundColor: DIORAMA.windowFrameDayEdge,
    borderTopLeftRadius: 98, borderTopRightRadius: 98,
    borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg,
  },
  windowGlass: {
    overflow: 'hidden',
    borderTopLeftRadius: 90, borderTopRightRadius: 90,
    borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md,
  },
  sunMoon: { position: 'absolute', right: 29, top: 28, width: 34, height: 34, borderRadius: 17 },
  hillBack: {
    position: 'absolute', left: -18, right: 48, bottom: -34, height: 96,
    borderRadius: 80, transform: [{ rotate: '-7deg' }],
  },
  hillFront: {
    position: 'absolute', left: 52, right: -34, bottom: -42, height: 104,
    borderRadius: 90, transform: [{ rotate: '8deg' }],
  },
  windowVertical: { position: 'absolute', top: 0, bottom: 0, left: '49%', width: 7, backgroundColor: DIORAMA.windowFrameDayEdge },
  windowHorizontal: { position: 'absolute', left: 0, right: 0, top: '58%', height: 7, backgroundColor: DIORAMA.windowFrameDayEdge },
  windowGlint: {
    position: 'absolute', left: 19, top: 20, width: '54%', height: 10,
    borderRadius: radius.pill, backgroundColor: DIORAMA.white, opacity: 0.22,
    transform: [{ rotate: '-8deg' }],
  },
  windowSill: {
    position: 'absolute', left: -6, bottom: 17, height: 23,
    borderRadius: radius.md, backgroundColor: DIORAMA.woodMid,
  },
  windowUpgradeTrim: {
    position: 'absolute', left: -13, bottom: 8, height: 8,
    borderRadius: radius.pill, backgroundColor: DIORAMA.gold,
  },
  picture: {
    position: 'absolute', left: '48%', width: 72, height: 86,
    marginLeft: -36, padding: 7, borderRadius: radius.lg,
    backgroundColor: DIORAMA.woodWarm,
    transform: [{ rotate: '-2deg' }],
  },
  pictureInset: {
    flex: 1, borderRadius: radius.md, backgroundColor: DIORAMA.cream,
    alignItems: 'center', justifyContent: 'center',
  },
  pawPalm: { position: 'absolute', left: 21, top: 28, width: 30, height: 25, borderRadius: 15, backgroundColor: DIORAMA.woodDeep },
  pawToe: { position: 'absolute', width: 10, height: 13, borderRadius: 7, backgroundColor: DIORAMA.woodDeep },
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
