import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  ImageSourcePropType,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { elevation, radius } from '../theme';
import { DIORAMA } from './artPalette';

export type SkyBand = 'morning' | 'day' | 'evening' | 'night';

export function skyBand(hour: number): SkyBand {
  if (hour >= 21 || hour < 6) return 'night';
  if (hour < 10) return 'morning';
  if (hour < 17) return 'day';
  return 'evening';
}

type SceneName = 'home' | 'park' | 'town' | 'beach';

const ART: Record<SceneName, { portrait: ImageSourcePropType; landscape: ImageSourcePropType }> = {
  home: {
    portrait: require('../../../assets/world/diorama/home.webp'),
    landscape: require('../../../assets/world/diorama/home-landscape.webp'),
  },
  park: {
    portrait: require('../../../assets/world/diorama/park.webp'),
    landscape: require('../../../assets/world/diorama/park-landscape.webp'),
  },
  town: {
    portrait: require('../../../assets/world/diorama/town.webp'),
    landscape: require('../../../assets/world/diorama/town-landscape.webp'),
  },
  beach: {
    portrait: require('../../../assets/world/diorama/beach.webp'),
    landscape: require('../../../assets/world/diorama/beach-landscape.webp'),
  },
};

const TIME_TINT: Record<SkyBand, string> = {
  morning: 'rgba(255, 213, 151, 0.06)',
  day: 'rgba(255, 255, 255, 0)',
  evening: 'rgba(129, 54, 41, 0.13)',
  night: 'rgba(19, 28, 70, 0.46)',
};

/**
 * Authored, responsive environment plate with a restrained camera breath.
 * The render already contains far/mid/near planes; the tiny camera move and
 * independent light/mote layers keep it from reading as a poster behind the
 * live characters without making the world visually restless.
 */
function DioramaPlate({ scene, hour, asleep = false }: { scene: SceneName; hour: number; asleep?: boolean }) {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const band = asleep ? 'night' : skyBand(hour);
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 13000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 13000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [drift]);

  const source = useMemo(() => (landscape ? ART[scene].landscape : ART[scene].portrait), [landscape, scene]);

  return (
    <View style={styles.fill} pointerEvents="none">
      <Animated.Image
        source={source}
        resizeMode="cover"
        fadeDuration={0}
        style={[
          styles.plate,
          {
            transform: [
              { scale: 1.022 },
              { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-2, 2] }) },
              { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [1.5, -1.5] }) },
            ],
          },
        ]}
      />
      <View style={[styles.fill, { backgroundColor: TIME_TINT[band] }]} />
      <LinearGradient
        colors={['rgba(27, 24, 37, 0.26)', 'rgba(27, 24, 37, 0)', 'rgba(27, 24, 37, 0.08)']}
        locations={[0, 0.24, 1]}
        style={styles.fill}
      />
      <View style={[styles.sunWash, landscape && styles.sunWashLandscape, band === 'night' && styles.sunWashNight]} />
      <Atmosphere scene={scene} night={band === 'night'} />
    </View>
  );
}

function Atmosphere({ scene, night }: { scene: SceneName; night: boolean }) {
  const travel = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(travel, { toValue: 1, duration: scene === 'beach' ? 5600 : 7600, easing: Easing.linear, useNativeDriver: true }),
    );
    animation.start();
    return () => animation.stop();
  }, [scene, travel]);

  return (
    <View style={styles.fill}>
      <Animated.View
        style={[
          styles.mote,
          {
            opacity: travel.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, night ? 0.12 : 0.36, night ? 0.12 : 0.36, 0] }),
            transform: [
              { translateX: travel.interpolate({ inputRange: [0, 1], outputRange: [-20, 180] }) },
              { translateY: travel.interpolate({ inputRange: [0, 1], outputRange: [16, -38] }) },
            ],
          },
        ]}
      />
      {scene === 'beach' && (
        <Animated.View
          style={[
            styles.waterShimmer,
            {
              opacity: travel.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.04, night ? 0.1 : 0.3, 0.04] }),
              transform: [{ scaleX: travel.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.8, 1.22, 0.8] }) }],
            },
          ]}
        />
      )}
    </View>
  );
}

function HomeUpgrades({ upgrades }: { upgrades: string[] }) {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const has = (id: string) => upgrades.includes(id);
  return (
    <View style={styles.fill} pointerEvents="none">
      {has('home_window') && (
        <View style={[styles.windowGlow, landscape ? styles.windowGlowLandscape : styles.windowGlowPortrait]}>
          <View style={styles.windowSparkA} />
          <View style={styles.windowSparkB} />
        </View>
      )}
      {has('home_rug') && (
        <LinearGradient
          colors={['rgba(111, 71, 170, 0.78)', 'rgba(155, 113, 208, 0.9)', 'rgba(77, 48, 126, 0.82)']}
          style={[styles.rug, landscape && styles.rugLandscape]}
        />
      )}
      {has('home_bed') && (
        <View style={[styles.bed, landscape && styles.bedLandscape]}>
          <View style={styles.bedRim} />
          <View style={styles.bedCushion} />
          <View style={styles.bedHighlight} />
        </View>
      )}
    </View>
  );
}

export function HomeScene({ hour, upgrades = [], asleep = false }: { hour: number; upgrades?: string[]; asleep?: boolean; groundY: number; chromeBottom: number }) {
  return <View style={styles.fill}><DioramaPlate scene="home" hour={hour} asleep={asleep} /><HomeUpgrades upgrades={upgrades} /></View>;
}

export function ParkScene({ hour }: { hour: number; bandHeight?: number; groundY?: number }) {
  return <DioramaPlate scene="park" hour={hour} />;
}

export function TownScene({ hour }: { hour: number; bandHeight?: number; groundY?: number }) {
  return <DioramaPlate scene="town" hour={hour} />;
}

export function BeachScene({ hour }: { hour: number; bandHeight?: number; groundY?: number }) {
  return <DioramaPlate scene="beach" hour={hour} />;
}

export function NightOverlay() {
  return <View pointerEvents="none" style={[styles.fill, styles.sleepOverlay]} />;
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', inset: 0 },
  plate: { position: 'absolute', left: -4, right: -4, top: -4, bottom: -4, width: undefined, height: undefined },
  sunWash: { position: 'absolute', left: '-20%', top: '-12%', width: '74%', height: '54%', borderRadius: 999, backgroundColor: 'rgba(255, 224, 164, 0.06)', transform: [{ rotate: '-13deg' }] },
  sunWashLandscape: { width: '48%', height: '72%' },
  sunWashNight: { opacity: 0.12 },
  mote: { position: 'absolute', left: '19%', top: '45%', width: 7, height: 7, borderRadius: radius.pill, backgroundColor: DIORAMA.paleCream },
  waterShimmer: { position: 'absolute', left: '35%', right: '35%', top: '38%', height: 4, borderRadius: radius.pill, backgroundColor: DIORAMA.white },
  windowGlow: { position: 'absolute', borderWidth: 3, borderColor: 'rgba(255, 231, 155, 0.64)', ...elevation.toy },
  windowGlowPortrait: { left: '8%', top: '10%', width: '37%', height: '27%', borderRadius: radius.pill },
  windowGlowLandscape: { left: '13%', top: '5%', width: '23%', height: '32%', borderRadius: radius.pill },
  windowSparkA: { position: 'absolute', right: -5, top: '24%', width: 9, height: 9, borderRadius: radius.pill, backgroundColor: DIORAMA.goldGlowSoft },
  windowSparkB: { position: 'absolute', left: -4, bottom: '18%', width: 6, height: 6, borderRadius: radius.pill, backgroundColor: DIORAMA.goldGlowSoft },
  rug: { position: 'absolute', left: '13%', right: '13%', bottom: '13%', height: '13%', borderRadius: radius.pill, opacity: 0.76, transform: [{ scaleY: 0.45 }] },
  rugLandscape: { left: '29%', right: '29%', bottom: '8%', height: '19%' },
  bed: { position: 'absolute', left: '7%', bottom: '17%', width: 118, height: 62, borderRadius: radius.pill, backgroundColor: DIORAMA.woodDeep, ...elevation.toy },
  bedLandscape: { left: '13%', bottom: '13%' },
  bedRim: { position: 'absolute', inset: 5, borderRadius: radius.pill, backgroundColor: DIORAMA.woodWarm },
  bedCushion: { position: 'absolute', left: 17, right: 17, top: 18, bottom: 8, borderRadius: radius.pill, backgroundColor: DIORAMA.bedCushion },
  bedHighlight: { position: 'absolute', left: 22, right: 22, top: 10, height: 7, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.35)' },
  sleepOverlay: { backgroundColor: 'rgba(13, 18, 48, 0.1)' },
});
