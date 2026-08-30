import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import {
  BeachScene as BaseBeachScene,
  DogBedBack,
  DogBedFront,
  HomeScene as BaseHomeScene,
  NightOverlay,
  ParkScene as BaseParkScene,
  RoomBed,
  skyBand,
  TownScene as BaseTownScene,
} from './PolishedScenes';

export { DogBedBack, DogBedFront, NightOverlay, RoomBed, skyBand };

/**
 * The scene art is intentionally crisp and composed; this layer adds LIFE,
 * not clutter. Motion stays behind Barkly and away from tap targets, uses only
 * transforms/opacity so it is cheap on phones, and is subtle enough that the
 * dog remains the hero instead of the background becoming a screensaver.
 */
function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => alive && setReduceMotion(enabled))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduceMotion;
}

function useAmbientLoop(duration: number, delay = 0, reduceMotion = false) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) {
      value.stopAnimation();
      value.setValue(0.35);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(value, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, duration, reduceMotion, value]);
  return value;
}

/**
 * Store-level finish without turning the world into chrome. The edge shade and
 * soft center light make every location read like the same toy-diorama product
 * while keeping the highest contrast in the middle where Barkly stands.
 */
function PremiumGlass() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0)']}
        locations={[0, 0.32, 0.72]}
        style={styles.topSheen}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.06)', 'rgba(33,25,18,0.045)']}
        locations={[0, 0.62, 1]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(30,23,18,0.055)', 'rgba(30,23,18,0)', 'rgba(30,23,18,0.055)']}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.heroHalo} />
    </View>
  );
}

function HomeLife() {
  const reduceMotion = useReduceMotion();
  const glow = useAmbientLoop(2800, 0, reduceMotion);
  const drift = useAmbientLoop(4600, 700, reduceMotion);
  const curtain = useAmbientLoop(3900, 350, reduceMotion);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.windowGlow,
          { opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.22] }) },
        ]}
      />
      <Animated.View
        style={[
          styles.homeLightRibbon,
          {
            opacity: curtain.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.14] }),
            transform: [
              { translateX: curtain.interpolate({ inputRange: [0, 1], outputRange: [-5, 7] }) },
              { rotate: '-13deg' },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.homeDust,
          {
            opacity: drift.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.25] }),
            transform: [
              { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-8, 18] }) },
              { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [7, -13] }) },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.homeDustSmall,
          {
            opacity: drift.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.04] }),
            transform: [{ translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -18] }) }],
          },
        ]}
      />
    </View>
  );
}

function ParkLife() {
  const reduceMotion = useReduceMotion();
  const breeze = useAmbientLoop(3400, 0, reduceMotion);
  const wander = useAmbientLoop(6200, 900, reduceMotion);
  const canopy = useAmbientLoop(4100, 250, reduceMotion);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.parkCanopyLight,
          {
            opacity: canopy.interpolate({ inputRange: [0, 1], outputRange: [0.035, 0.1] }),
            transform: [{ translateX: canopy.interpolate({ inputRange: [0, 1], outputRange: [-9, 9] }) }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.parkLeafOne,
          {
            opacity: breeze.interpolate({ inputRange: [0, 1], outputRange: [0.24, 0.72] }),
            transform: [
              { translateX: breeze.interpolate({ inputRange: [0, 1], outputRange: [-10, 36] }) },
              { translateY: breeze.interpolate({ inputRange: [0, 1], outputRange: [0, 12] }) },
              { rotate: breeze.interpolate({ inputRange: [0, 1], outputRange: ['-18deg', '48deg'] }) },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.parkLeafTwo,
          {
            opacity: wander.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.5] }),
            transform: [
              { translateX: wander.interpolate({ inputRange: [0, 1], outputRange: [18, -42] }) },
              { translateY: wander.interpolate({ inputRange: [0, 1], outputRange: [-3, 18] }) },
              { rotate: wander.interpolate({ inputRange: [0, 1], outputRange: ['22deg', '-55deg'] }) },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.cloudWisp,
          { transform: [{ translateX: wander.interpolate({ inputRange: [0, 1], outputRange: [-24, 30] }) }] },
        ]}
      />
    </View>
  );
}

function TownLife() {
  const reduceMotion = useReduceMotion();
  const gleam = useAmbientLoop(2600, 0, reduceMotion);
  const passerby = useAmbientLoop(5400, 600, reduceMotion);
  const windowPulse = useAmbientLoop(3300, 400, reduceMotion);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.townWindowWarmth,
          { opacity: windowPulse.interpolate({ inputRange: [0, 1], outputRange: [0.04, 0.12] }) },
        ]}
      />
      <Animated.View
        style={[
          styles.shopGlint,
          {
            opacity: gleam.interpolate({ inputRange: [0, 0.42, 1], outputRange: [0, 0.34, 0] }),
            transform: [
              { translateX: gleam.interpolate({ inputRange: [0, 1], outputRange: [-35, 105] }) },
              { rotate: '17deg' },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.townShadow,
          {
            opacity: passerby.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.15, 0] }),
            transform: [{ translateX: passerby.interpolate({ inputRange: [0, 1], outputRange: [-70, 430] }) }],
          },
        ]}
      />
    </View>
  );
}

function BeachLife() {
  const reduceMotion = useReduceMotion();
  const tide = useAmbientLoop(2500, 0, reduceMotion);
  const gull = useAmbientLoop(6400, 1100, reduceMotion);
  const water = useAmbientLoop(3700, 300, reduceMotion);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.oceanSparkle,
          {
            opacity: water.interpolate({ inputRange: [0, 1], outputRange: [0.03, 0.13] }),
            transform: [{ translateX: water.interpolate({ inputRange: [0, 1], outputRange: [-10, 18] }) }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.foamGleam,
          {
            opacity: tide.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.28] }),
            transform: [{ translateY: tide.interpolate({ inputRange: [0, 1], outputRange: [-4, 6] }) }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.gull,
          {
            opacity: gull.interpolate({ inputRange: [0, 0.15, 0.82, 1], outputRange: [0, 0.45, 0.45, 0] }),
            transform: [
              { translateX: gull.interpolate({ inputRange: [0, 1], outputRange: [-50, 430] }) },
              { translateY: gull.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -18, 4] }) },
            ],
          },
        ]}
      >
        <View style={styles.gullWingLeft} />
        <View style={styles.gullWingRight} />
      </Animated.View>
    </View>
  );
}

export function HomeScene(props: React.ComponentProps<typeof BaseHomeScene>) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <BaseHomeScene {...props} />
      <HomeLife />
      <PremiumGlass />
    </View>
  );
}

export function ParkScene(props: React.ComponentProps<typeof BaseParkScene>) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <BaseParkScene {...props} />
      <ParkLife />
      <PremiumGlass />
    </View>
  );
}

export function TownScene(props: React.ComponentProps<typeof BaseTownScene>) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <BaseTownScene {...props} />
      <TownLife />
      <PremiumGlass />
    </View>
  );
}

export function BeachScene(props: React.ComponentProps<typeof BaseBeachScene>) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <BaseBeachScene {...props} />
      <BeachLife />
      <PremiumGlass />
    </View>
  );
}

const styles = StyleSheet.create({
  topSheen: { position: 'absolute', left: 0, right: 0, top: 0, height: '38%' },
  heroHalo: {
    position: 'absolute',
    alignSelf: 'center',
    top: '29%',
    width: 250,
    height: 300,
    borderRadius: 160,
    backgroundColor: 'rgba(255,255,255,0.025)',
  },

  windowGlow: {
    position: 'absolute',
    left: 24,
    top: 172,
    width: 118,
    height: 78,
    borderRadius: 26,
    backgroundColor: 'rgba(255,244,187,0.34)',
  },
  homeLightRibbon: {
    position: 'absolute',
    left: 36,
    top: 232,
    width: 118,
    height: 190,
    borderRadius: 80,
    backgroundColor: 'rgba(255,248,215,0.22)',
  },
  homeDust: {
    position: 'absolute',
    left: 92,
    top: 212,
    width: 7,
    height: 7,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  homeDustSmall: {
    position: 'absolute',
    left: 127,
    top: 236,
    width: 4,
    height: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },

  parkCanopyLight: {
    position: 'absolute',
    left: -15,
    right: -15,
    top: '29%',
    height: 120,
    borderRadius: 90,
    backgroundColor: 'rgba(255,248,206,0.5)',
  },
  parkLeafOne: {
    position: 'absolute',
    left: 126,
    top: '34%',
    width: 10,
    height: 6,
    borderTopLeftRadius: 10,
    borderBottomRightRadius: 10,
    backgroundColor: 'rgba(91,128,61,0.9)',
  },
  parkLeafTwo: {
    position: 'absolute',
    right: 92,
    top: '28%',
    width: 8,
    height: 5,
    borderTopRightRadius: 9,
    borderBottomLeftRadius: 9,
    backgroundColor: 'rgba(120,151,73,0.9)',
  },
  cloudWisp: {
    position: 'absolute',
    left: 128,
    top: 118,
    width: 84,
    height: 13,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },

  townWindowWarmth: {
    position: 'absolute',
    left: 144,
    right: 140,
    top: '30%',
    height: 96,
    borderRadius: 20,
    backgroundColor: 'rgba(255,237,185,0.3)',
  },
  shopGlint: {
    position: 'absolute',
    left: 160,
    top: '28%',
    width: 16,
    height: 92,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.38)',
  },
  townShadow: {
    position: 'absolute',
    left: 0,
    bottom: '27%',
    width: 44,
    height: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(37,31,28,0.44)',
  },

  oceanSparkle: {
    position: 'absolute',
    left: 54,
    right: 54,
    top: '48%',
    height: 22,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.34)',
  },
  foamGleam: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '55%',
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.30)',
  },
  gull: { position: 'absolute', left: 0, top: '18%', width: 30, height: 14 },
  gullWingLeft: {
    position: 'absolute',
    left: 2,
    top: 5,
    width: 14,
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.74)',
    transform: [{ rotate: '-18deg' }],
  },
  gullWingRight: {
    position: 'absolute',
    left: 14,
    top: 5,
    width: 14,
    height: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.74)',
    transform: [{ rotate: '18deg' }],
  },
});