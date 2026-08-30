import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
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
function useAmbientLoop(duration: number, delay = 0) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
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
  }, [delay, duration, value]);
  return value;
}

function PremiumGlass() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.035)', 'rgba(255,255,255,0)']}
        locations={[0, 0.32, 0.72]}
        style={styles.topSheen}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.055)', 'rgba(33,25,18,0.035)']}
        locations={[0, 0.62, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

function HomeLife() {
  const glow = useAmbientLoop(2800);
  const drift = useAmbientLoop(4600, 700);
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
  const breeze = useAmbientLoop(3400);
  const wander = useAmbientLoop(6200, 900);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
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
  const gleam = useAmbientLoop(2600);
  const passerby = useAmbientLoop(5400, 600);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.shopGlint,
          {
            opacity: gleam.interpolate({ inputRange: [0, 0.42, 1], outputRange: [0, 0.34, 0] }),
            transform: [{ translateX: gleam.interpolate({ inputRange: [0, 1], outputRange: [-35, 105] }) }],
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
  const tide = useAmbientLoop(2500);
  const gull = useAmbientLoop(6400, 1100);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
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

  windowGlow: {
    position: 'absolute',
    left: 24,
    top: 172,
    width: 118,
    height: 78,
    borderRadius: 26,
    backgroundColor: 'rgba(255,244,187,0.34)',
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

  shopGlint: {
    position: 'absolute',
    left: 160,
    top: '28%',
    width: 16,
    height: 92,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.38)',
    transform: [{ rotate: '17deg' }],
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
