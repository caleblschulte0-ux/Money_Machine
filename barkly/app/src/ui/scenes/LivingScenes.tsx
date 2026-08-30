import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

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
 * LIFE, not blur.
 *
 * The first ambient pass put a translucent "premium glass" wash over the
 * entire world. It did technically add sheen, but it also softened every edge
 * we had just spent time making crisp. This layer now moves LOCAL things only:
 * light from a window, leaves, a butterfly, shop reflections, waves and gulls.
 * Barkly and the authored scenery stay sharp.
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
      value.setValue(0.38);
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

function HomeLife() {
  const reduceMotion = useReduceMotion();
  const glow = useAmbientLoop(2600, 0, reduceMotion);
  const mote = useAmbientLoop(4800, 500, reduceMotion);
  const mote2 = useAmbientLoop(5700, 1200, reduceMotion);
  const lamp = useAmbientLoop(3300, 300, reduceMotion);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.windowGlow,
          { opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.2] }) },
        ]}
      />
      <Animated.View
        style={[
          styles.lampPulse,
          { opacity: lamp.interpolate({ inputRange: [0, 1], outputRange: [0.03, 0.12] }), transform: [{ scale: lamp.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.05] }) }] },
        ]}
      />
      <Animated.View
        style={[
          styles.homeMote,
          {
            opacity: mote.interpolate({ inputRange: [0, 0.2, 0.85, 1], outputRange: [0, 0.5, 0.28, 0] }),
            transform: [
              { translateX: mote.interpolate({ inputRange: [0, 1], outputRange: [-8, 30] }) },
              { translateY: mote.interpolate({ inputRange: [0, 1], outputRange: [12, -27] }) },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.homeMoteSmall,
          {
            opacity: mote2.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.42, 0.2, 0] }),
            transform: [
              { translateX: mote2.interpolate({ inputRange: [0, 1], outputRange: [8, -22] }) },
              { translateY: mote2.interpolate({ inputRange: [0, 1], outputRange: [3, -31] }) },
            ],
          },
        ]}
      />
    </View>
  );
}

function ParkLife() {
  const reduceMotion = useReduceMotion();
  const breeze = useAmbientLoop(3000, 0, reduceMotion);
  const wander = useAmbientLoop(6100, 650, reduceMotion);
  const butterfly = useAmbientLoop(5200, 1250, reduceMotion);
  const cloud = useAmbientLoop(7400, 300, reduceMotion);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.cloudWisp,
          { opacity: cloud.interpolate({ inputRange: [0, 1], outputRange: [0.24, 0.42] }), transform: [{ translateX: cloud.interpolate({ inputRange: [0, 1], outputRange: [-22, 34] }) }] },
        ]}
      />
      <Animated.View
        style={[
          styles.parkLeafOne,
          {
            opacity: breeze.interpolate({ inputRange: [0, 0.12, 0.85, 1], outputRange: [0, 0.75, 0.62, 0] }),
            transform: [
              { translateX: breeze.interpolate({ inputRange: [0, 1], outputRange: [-16, 58] }) },
              { translateY: breeze.interpolate({ inputRange: [0, 1], outputRange: [-4, 18] }) },
              { rotate: breeze.interpolate({ inputRange: [0, 1], outputRange: ['-18deg', '95deg'] }) },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.parkLeafTwo,
          {
            opacity: wander.interpolate({ inputRange: [0, 0.12, 0.86, 1], outputRange: [0, 0.52, 0.38, 0] }),
            transform: [
              { translateX: wander.interpolate({ inputRange: [0, 1], outputRange: [25, -72] }) },
              { translateY: wander.interpolate({ inputRange: [0, 1], outputRange: [-2, 24] }) },
              { rotate: wander.interpolate({ inputRange: [0, 1], outputRange: ['22deg', '-120deg'] }) },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.butterfly,
          {
            opacity: butterfly.interpolate({ inputRange: [0, 0.12, 0.84, 1], outputRange: [0, 0.9, 0.78, 0] }),
            transform: [
              { translateX: butterfly.interpolate({ inputRange: [0, 1], outputRange: [-45, 250] }) },
              { translateY: butterfly.interpolate({ inputRange: [0, 0.45, 1], outputRange: [20, -18, 8] }) },
              { rotate: butterfly.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-8deg', '9deg', '-6deg'] }) },
            ],
          },
        ]}
      >
        <View style={styles.butterflyLeft} />
        <View style={styles.butterflyRight} />
      </Animated.View>
    </View>
  );
}

function TownLife() {
  const reduceMotion = useReduceMotion();
  const gleam = useAmbientLoop(2500, 0, reduceMotion);
  const passerby = useAmbientLoop(5600, 700, reduceMotion);
  const sign = useAmbientLoop(2300, 250, reduceMotion);
  const windowPulse = useAmbientLoop(3500, 400, reduceMotion);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.townWindowWarmth,
          { opacity: windowPulse.interpolate({ inputRange: [0, 1], outputRange: [0.035, 0.12] }) },
        ]}
      />
      <Animated.View
        style={[
          styles.shopGlint,
          {
            opacity: gleam.interpolate({ inputRange: [0, 0.42, 1], outputRange: [0, 0.54, 0] }),
            transform: [
              { translateX: gleam.interpolate({ inputRange: [0, 1], outputRange: [-48, 122] }) },
              { rotate: '17deg' },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.townShadow,
          {
            opacity: passerby.interpolate({ inputRange: [0, 0.22, 0.76, 1], outputRange: [0, 0.14, 0.14, 0] }),
            transform: [{ translateX: passerby.interpolate({ inputRange: [0, 1], outputRange: [-80, 460] }) }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.openSign,
          { transform: [{ rotate: sign.interpolate({ inputRange: [0, 1], outputRange: ['-2.5deg', '2.5deg'] }) }] },
        ]}
      >
        <View style={styles.openSignGloss} />
      </Animated.View>
    </View>
  );
}

function BeachLife() {
  const reduceMotion = useReduceMotion();
  const tide = useAmbientLoop(2350, 0, reduceMotion);
  const tide2 = useAmbientLoop(3200, 500, reduceMotion);
  const gull = useAmbientLoop(6500, 1050, reduceMotion);
  const water = useAmbientLoop(3700, 300, reduceMotion);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        style={[
          styles.oceanSparkle,
          {
            opacity: water.interpolate({ inputRange: [0, 1], outputRange: [0.04, 0.22] }),
            transform: [{ translateX: water.interpolate({ inputRange: [0, 1], outputRange: [-16, 28] }) }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.foamGleam,
          {
            opacity: tide.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.48] }),
            transform: [
              { translateX: tide.interpolate({ inputRange: [0, 1], outputRange: [-10, 12] }) },
              { translateY: tide.interpolate({ inputRange: [0, 1], outputRange: [-5, 6] }) },
              { scaleX: tide.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] }) },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.foamGleamSecond,
          {
            opacity: tide2.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.31] }),
            transform: [{ translateY: tide2.interpolate({ inputRange: [0, 1], outputRange: [4, -4] }) }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.gull,
          {
            opacity: gull.interpolate({ inputRange: [0, 0.12, 0.84, 1], outputRange: [0, 0.62, 0.62, 0] }),
            transform: [
              { translateX: gull.interpolate({ inputRange: [0, 1], outputRange: [-55, 445] }) },
              { translateY: gull.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -23, 5] }) },
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
    </View>
  );
}

export function ParkScene(props: React.ComponentProps<typeof BaseParkScene>) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <BaseParkScene {...props} />
      <ParkLife />
    </View>
  );
}

export function TownScene(props: React.ComponentProps<typeof BaseTownScene>) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <BaseTownScene {...props} />
      <TownLife />
    </View>
  );
}

export function BeachScene(props: React.ComponentProps<typeof BaseBeachScene>) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <BaseBeachScene {...props} />
      <BeachLife />
    </View>
  );
}

const styles = StyleSheet.create({
  windowGlow: {
    position: 'absolute',
    left: 22,
    top: 174,
    width: 128,
    height: 82,
    borderRadius: 26,
    backgroundColor: 'rgba(255,232,126,0.44)',
  },
  lampPulse: {
    position: 'absolute',
    right: 4,
    top: 200,
    width: 78,
    height: 78,
    borderRadius: 90,
    backgroundColor: 'rgba(255,222,109,0.52)',
  },
  homeMote: {
    position: 'absolute',
    left: 91,
    top: 246,
    width: 7,
    height: 7,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  homeMoteSmall: {
    position: 'absolute',
    left: 132,
    top: 267,
    width: 4,
    height: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },

  cloudWisp: {
    position: 'absolute',
    left: 116,
    top: 117,
    width: 92,
    height: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.58)',
  },
  parkLeafOne: {
    position: 'absolute',
    left: 109,
    top: '34%',
    width: 13,
    height: 8,
    borderTopLeftRadius: 13,
    borderBottomRightRadius: 13,
    backgroundColor: 'rgba(69,145,55,0.96)',
  },
  parkLeafTwo: {
    position: 'absolute',
    right: 83,
    top: '27%',
    width: 11,
    height: 7,
    borderTopRightRadius: 11,
    borderBottomLeftRadius: 11,
    backgroundColor: 'rgba(123,202,78,0.95)',
  },
  butterfly: {
    position: 'absolute',
    left: 32,
    top: '39%',
    width: 18,
    height: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  butterflyLeft: { width: 8, height: 10, borderTopLeftRadius: 8, borderBottomRightRadius: 8, backgroundColor: 'rgba(255,126,170,0.96)', transform: [{ rotate: '-20deg' }] },
  butterflyRight: { width: 8, height: 10, borderTopRightRadius: 8, borderBottomLeftRadius: 8, backgroundColor: 'rgba(255,213,70,0.96)', transform: [{ rotate: '20deg' }] },

  townWindowWarmth: {
    position: 'absolute',
    left: 145,
    right: 141,
    top: '31%',
    height: 91,
    borderRadius: 20,
    backgroundColor: 'rgba(255,226,130,0.62)',
  },
  shopGlint: {
    position: 'absolute',
    left: 144,
    top: '32%',
    width: 18,
    height: 92,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
  townShadow: {
    position: 'absolute',
    left: 0,
    top: '63%',
    width: 38,
    height: 13,
    borderRadius: 999,
    backgroundColor: 'rgba(45,35,28,0.64)',
  },
  openSign: {
    position: 'absolute',
    right: 73,
    top: '35%',
    width: 42,
    height: 22,
    borderRadius: 8,
    backgroundColor: 'rgba(255,216,77,0.94)',
    borderWidth: 3,
    borderColor: 'rgba(114,76,31,0.75)',
  },
  openSignGloss: { position: 'absolute', left: 5, right: 5, top: 3, height: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.55)' },

  oceanSparkle: {
    position: 'absolute',
    left: 70,
    right: 55,
    top: '42%',
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  foamGleam: {
    position: 'absolute',
    left: -18,
    right: -18,
    top: '56%',
    height: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  foamGleamSecond: {
    position: 'absolute',
    left: 38,
    right: 72,
    top: '52%',
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  gull: {
    position: 'absolute',
    left: 0,
    top: '22%',
    width: 28,
    height: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gullWingLeft: { width: 13, height: 4, borderTopLeftRadius: 10, borderTopRightRadius: 10, backgroundColor: 'rgba(255,255,255,0.94)', transform: [{ rotate: '14deg' }] },
  gullWingRight: { width: 13, height: 4, borderTopLeftRadius: 10, borderTopRightRadius: 10, backgroundColor: 'rgba(255,255,255,0.94)', transform: [{ rotate: '-14deg' }] },
});