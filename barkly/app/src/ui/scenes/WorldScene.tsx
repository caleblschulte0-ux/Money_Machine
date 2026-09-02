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
  /*
   * Atmospheric perspective, but barely. At 0.78 + depth*0.22 a mid-depth prop
   * rendered around 0.85, and combined with a per-prop opacity it dropped the
   * town side-storefronts to roughly 0.70 over a pale sky -- which is what was
   * still holding Town at 28% dead-grey pixels after the shopfronts themselves
   * had been re-rendered in candy colours. The Supercell look keeps chroma at
   * every depth and separates planes with scale, overlap and shadow instead of
   * by fading things toward the background.
   */
  const atmosphericOpacity = 0.93 + safeDepth * 0.07;
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
        <>
          {/*
            A real contact shadow is two things: a wide soft pool that says the
            object displaces light, and a tight dark core right where it meets
            the ground that says it is TOUCHING. One faint hard-edged pill --
            which is what this was -- reads as a sticker lying near a smudge,
            and it is why the bench, the umbrella and the sandcastle all looked
            like they were hovering.

            The shadow sits at the bottom of the layout box because that is
            where the art's feet are: the render workflow trims every prop's
            transparent canvas, so no asset carries padding underneath. This
            was briefly parameterised with a `baseInset` escape hatch; its only
            use set the dog bed 16% of its height too high, which tucked the
            shadow up inside the bed and is why it looked unshadowed. Measured
            across every prop in assets/world: none has more than 1% padding.
          */}
          <View
            style={[
              styles.contactPool,
              {
                left: width * 0.05,
                width: width * 0.90,
                height: Math.max(10, Math.min(30, height * 0.13)),
                bottom: -Math.max(3, height * 0.02),
                opacity: (night ? 0.20 : 0.17) * (0.65 + safeDepth * 0.35),
              },
            ]}
          />
          <View
            style={[
              styles.contactCore,
              {
                left: width * 0.19,
                width: width * 0.62,
                height: Math.max(5, Math.min(14, height * 0.055)),
                bottom: Math.max(1, height * 0.005),
                opacity: (night ? 0.42 : 0.36) * (0.65 + safeDepth * 0.35),
              },
            ]}
          />
        </>
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

/** Shared key/fill/grade pass. It keeps separate assets in one light family. */
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
      <View
        style={[
          styles.keyPool,
          {
            top: ground - 54,
            backgroundColor: warm ? DIORAMA.goldGlowSoft : DIORAMA.white,
            opacity: night ? 0.035 : warm ? 0.12 : 0.09,
          },
        ]}
      />
      {/*
        The key light has to reach full transparency INSIDE its own box. It
        used to be clipped to width:'68%' while its diagonal axis still carried
        visible tint at that edge, which drew a hard vertical line down the
        full height of every outdoor scene — over sky, storefronts and ground
        alike. It read as a compositing seam, not a sunbeam. Spanning the full
        width and fading out by 0.62 along the axis keeps the same light
        direction with nothing to clip.
      */}
      <LinearGradient
        colors={[
          warm ? 'rgba(255,239,191,0.18)' : 'rgba(224,248,239,0.14)',
          'rgba(255,255,255,0)',
        ]}
        locations={[0, 0.62]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.68 }}
        style={styles.keySweep}
      />
      <LinearGradient
        colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0)']}
        style={[styles.horizonHaze, { top: ground - 178, opacity: night ? 0.03 : 0.42 }]}
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
  // Raised to meet Barkly rather than sitting a full step behind him. He used
  // to render at 1.14 while the world sat at 1.00, which is the mismatch that
  // made him look pasted on top of the scene instead of standing in it.
  const cameraEdge = viewportWidth > viewportHeight ? viewportHeight / 390 : viewportWidth / 390;
  return Math.max(0.95, Math.min(1.40, cameraEdge * 1.06));
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  camera: { position: 'absolute', left: -5, right: -5, top: -5, bottom: -5 },
  object: { position: 'absolute' },
  objectImage: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, width: '100%', height: '100%' },
  contactPool: {
    position: 'absolute',
    backgroundColor: DIORAMA.shadow,
    borderRadius: radius.pill,
    transform: [{ scaleX: 1.16 }],
  },
  contactCore: {
    position: 'absolute',
    backgroundColor: DIORAMA.shadow,
    borderRadius: radius.pill,
  },
  keyPool: {
    position: 'absolute',
    left: '9%',
    right: '9%',
    height: 132,
    borderRadius: radius.pill,
    transform: [{ scaleX: 1.18 }],
  },
  keySweep: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  horizonHaze: { position: 'absolute', left: 0, right: 0, height: 118 },
  bottomGrade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 140 },
});
