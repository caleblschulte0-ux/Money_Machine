import React, { useEffect, useRef } from 'react';
import {
  Animated,
  DimensionValue,
  Easing,
  Image,
  ImageSourcePropType,
  ImageStyle,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DIORAMA } from './artPalette';
import { radius } from '../theme';

/**
 * The canonical presentation contract for every Barkly location.
 *
 * A scene is a stack of predictable planes rather than one illustration. The
 * same contract is used by Home, Park, Town and Beach so camera, lighting and
 * responsive changes cannot drift into four unrelated implementations.
 */
export type WorldLayerName =
  | 'sky'
  | 'distant'
  | 'landmark'
  | 'ground'
  | 'props'
  | 'foreground'
  | 'fx';

export type WorldMotion = 'idle' | 'arrive' | 'active' | 'sleep';

export const WORLD_LAYER_Z: Record<WorldLayerName, number> = {
  sky: 0,
  distant: 10,
  ground: 20,
  landmark: 30,
  props: 40,
  foreground: 50,
  fx: 60,
};

const CAMERA: Record<WorldMotion, { scale: number; y: number }> = {
  idle: { scale: 1, y: 0 },
  arrive: { scale: 0.985, y: 2 },
  active: { scale: 1.018, y: -3 },
  sleep: { scale: 1.026, y: 5 },
};

export function WorldScene({
  children,
  motion = 'idle',
  testID,
}: {
  children: React.ReactNode;
  motion?: WorldMotion;
  testID?: string;
}) {
  const scale = useRef(new Animated.Value(CAMERA.idle.scale)).current;
  const translateY = useRef(new Animated.Value(CAMERA.idle.y)).current;
  const target = CAMERA[motion];

  useEffect(() => {
    const duration = motion === 'arrive' ? 420 : motion === 'sleep' ? 1200 : 360;
    Animated.parallel([
      Animated.timing(scale, {
        toValue: target.scale,
        duration,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: target.y,
        duration,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [motion, scale, target.scale, target.y, translateY]);

  // Values are deliberately restrained. This is a living camera, not a zoom
  // effect competing with Barkly or shifting the HUD.
  return (
    <View style={styles.fill} pointerEvents="none" testID={testID}>
      <Animated.View style={[styles.camera, { transform: [{ translateY }, { scale }] }]}>
        {children}
      </Animated.View>
    </View>
  );
}

export function WorldLayer({
  name,
  children,
  style,
}: {
  name: WorldLayerName;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.fill, { zIndex: WORLD_LAYER_Z[name] }, style]} pointerEvents="none">
      {children}
    </View>
  );
}

export function WorldObject({
  source,
  left,
  right,
  top,
  width,
  height,
  depth = 0.55,
  night = false,
  opacity = 1,
  rotate,
  flip = false,
  contactShadow = false,
  ambient,
  motionDelay = 0,
  style,
}: {
  source: ImageSourcePropType;
  left?: DimensionValue;
  right?: DimensionValue;
  top: number;
  width: number;
  height: number;
  /** 0 is distant atmosphere, 1 is the gameplay plane. */
  depth?: number;
  night?: boolean;
  opacity?: number;
  rotate?: string;
  flip?: boolean;
  contactShadow?: boolean;
  /** Tiny environmental motion; never used for structural architecture. */
  ambient?: 'sway' | 'bob';
  motionDelay?: number;
  style?: StyleProp<ImageStyle>;
}) {
  const safeDepth = Math.max(0, Math.min(1, depth));
  const atmosphericOpacity = 0.78 + safeDepth * 0.22;
  const transforms: Array<{ rotate: string } | { scaleX: number }> = [];
  if (rotate) transforms.push({ rotate });
  if (flip) transforms.push({ scaleX: -1 });
  const position = { left, right, top, width, height } as const;
  const motion = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!ambient) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(motionDelay),
        Animated.timing(motion, { toValue: 1, duration: ambient === 'sway' ? 3600 : 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(motion, { toValue: 0, duration: ambient === 'sway' ? 3600 : 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [ambient, motion, motionDelay]);

  const ambientTransform = ambient === 'sway'
    ? [{ rotate: motion.interpolate({ inputRange: [0, 1], outputRange: ['-0.55deg', '0.55deg'] }) }]
    : ambient === 'bob'
      ? [{ translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [0, -2.5] }) }]
      : undefined;

  return (
    <View style={[styles.object, position]} pointerEvents="none">
      {contactShadow && (
        <View
          style={[
            styles.contactShadow,
            {
              left: width * 0.16,
              width: width * 0.68,
              height: Math.max(8, Math.min(20, height * 0.08)),
              bottom: Math.max(1, height * 0.025),
              opacity: (night ? 0.26 : 0.21) * (0.7 + safeDepth * 0.3),
            },
          ]}
        />
      )}
      <Animated.View style={[styles.objectImage, ambientTransform ? { transform: ambientTransform } : undefined]}>
        <Image
          source={source}
          resizeMode="contain"
          style={[
            styles.objectImage,
            {
              opacity: opacity * atmosphericOpacity * (night ? 0.78 : 1),
              transform: transforms.length ? transforms : undefined,
            },
            style,
          ]}
        />
      </Animated.View>
    </View>
  );
}

/**
 * Shared key/fill/grade pass. It keeps separate assets in one light family.
 *
 * The previous revision used a 68%-wide rectangular sweep. Its transparent
 * endpoint still left a visible vertical edge over the world, so the light
 * read as a UI overlay instead of atmosphere. This pass deliberately uses
 * only full-width vertical grades; bounded light rectangles cannot leak into
 * the composition because there are none.
 */
export function WorldLighting({
  night,
  warm = false,
  ground,
}: {
  night: boolean;
  warm?: boolean;
  ground: number;
}) {
  return (
    <View style={[styles.fill, { zIndex: WORLD_LAYER_Z.fx }]} pointerEvents="none">
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']}
        locations={[0, 0.5, 1]}
        style={[styles.horizonHaze, { top: ground - 210, opacity: night ? 0.02 : 0.34 }]}
      />
      <LinearGradient
        colors={[
          warm ? 'rgba(255,226,172,0.08)' : 'rgba(214,239,229,0.06)',
          'rgba(255,255,255,0)',
          night ? 'rgba(20,22,34,0.20)' : 'rgba(48,34,24,0.08)',
        ]}
        locations={[0, 0.55, 1]}
        style={styles.fill}
      />
      <LinearGradient
        colors={['rgba(20,18,25,0)', night ? 'rgba(16,18,30,0.20)' : 'rgba(38,28,20,0.10)']}
        style={styles.bottomGrade}
      />
    </View>
  );
}

export function worldScale(viewportWidth: number, viewportHeight = 844): number {
  // The short edge behaves like a camera zoom. Portrait art can grow modestly
  // on a tablet; landscape art is constrained by its height. This keeps the
  // rendered world in the same physical scale family as Barkly while wider
  // screens reveal more environment instead of stretching phone blocking.
  const cameraEdge = viewportWidth > viewportHeight ? viewportHeight / 390 : viewportWidth / 390;
  return Math.max(0.90, Math.min(1.34, cameraEdge));
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  camera: { position: 'absolute', left: -5, right: -5, top: -5, bottom: -5 },
  object: { position: 'absolute' },
  objectImage: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, width: '100%', height: '100%' },
  contactShadow: {
    position: 'absolute',
    backgroundColor: DIORAMA.shadow,
    borderRadius: radius.pill,
    transform: [{ scaleX: 1.14 }],
  },
  horizonHaze: { position: 'absolute', left: 0, right: 0, height: 156 },
  bottomGrade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 140 },
});
