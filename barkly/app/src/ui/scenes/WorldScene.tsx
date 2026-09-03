import React, { useEffect, useId, useRef } from 'react';
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
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { DIORAMA } from './artPalette';
import type { SkyBand } from './CandyScenesV2';
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
              // Night darkening belongs to the MASTER GRADE, which lies over
              // every layer at once. Dimming each prop on its own as well took
              // them to ~0.78 against a sky that was not dimmed, so props
              // dissolved into the background instead of being lit by the same
              // night. 0.88 keeps the object present; the blue wash above does
              // the rest, consistently, for the whole frame.
              opacity: opacity * atmosphericOpacity * (night ? 0.88 : 1),
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
 * THE MASTER GRADE — one light family for every location.
 *
 * Before this, each scene lit itself: Park ran cold, Home/Town/Beach ran
 * "warm", night was a purple wash, and the numbers said so. Measured with
 * `scripts/art-lab-sheet.py`, the saturation-weighted hue centroid of the four
 * day scenes sat at 37 / 90 / 71 / 52 degrees and the four night scenes at
 * 19 / 108 / 358 / 42 — four different games in one app, which is exactly what
 * it looked like. A Supercell board reads as one world because ONE sun lights
 * all of it: same key colour, same direction, same cool shadow, same vignette.
 * Local colour still differs (grass is green, sand is gold) — the LIGHT does
 * not.
 *
 * So the grade is a constant, not a per-scene argument:
 *
 *   day    warm key from the upper left, cool violet shadow pooling low
 *   night  a deep BLUE wash over everything, with warm light pools on the
 *          ground — night is a colour, not just less brightness
 *
 * `warm` no longer chooses a different sun. It only says this place has a
 * bounce source of its own (a lamp, a shopfront, low sun off sand), which
 * strengthens the ground pool. That is the only per-scene freedom left.
 */
const GRADE: Record<SkyBand, {
  key: string; keyFade: string; top: string; mid: string; bottom: string;
  pool: string; poolOpacity: number; vignette: string;
}> = {
  /*
   * FOUR BANDS, ONE FAMILY.
   *
   * This started as day-or-night, which left the eight hours of morning and
   * evening rendering a sunset or sunrise SKY under flat noon LIGHT -- the
   * scene and its own sky disagreeing about the time of day for a third of
   * every day. The bands share one recipe (warm key from the upper left, cool
   * shadow low, one vignette); what changes across them is the colour and
   * strength of that key, which is what changing light actually does.
   */
  morning: {
    key: 'rgba(255,216,170,0.16)',
    keyFade: 'rgba(255,236,208,0)',
    top: 'rgba(255,210,168,0.14)',
    mid: 'rgba(255,247,236,0)',
    bottom: 'rgba(78,66,118,0.08)',
    pool: DIORAMA.goldGlowSoft,
    poolOpacity: 0.13,
    vignette: 'rgba(46,34,64,0.09)',
  },
  /*
   * Day is a LIGHT pass, not a darkening pass. The first cut of this graded
   * with a 0.16 vignette and a 0.11 cool floor and cost the whole app a step
   * of brightness for its trouble: home's mean value fell 0.808 -> 0.714 and
   * Town's dead-pixel share went UP. Warm high, barely-there cool low, and a
   * vignette you can only see when you look for it.
   */
  day: {
    key: 'rgba(255,203,116,0.17)',
    keyFade: 'rgba(255,236,196,0)',
    top: 'rgba(255,208,128,0.15)',
    mid: 'rgba(255,247,226,0)',
    bottom: 'rgba(78,52,110,0.07)',
    pool: DIORAMA.goldGlowSoft,
    poolOpacity: 0.15,
    vignette: 'rgba(46,30,58,0.09)',
  },
  /*
   * Golden hour. The one band allowed to be loud: a low orange key, a long
   * cool shadow underneath it, and a stronger ground pool. This is the hour
   * the reference games use for their key art, and Barkly rendered it as
   * ordinary daylight with an orange gradient pasted behind.
   */
  evening: {
    key: 'rgba(255,156,88,0.22)',
    keyFade: 'rgba(255,196,140,0)',
    top: 'rgba(255,150,84,0.19)',
    mid: 'rgba(255,214,170,0)',
    bottom: 'rgba(76,42,98,0.13)',
    pool: DIORAMA.gold,
    poolOpacity: 0.20,
    vignette: 'rgba(52,28,52,0.13)',
  },
  /*
   * Night is a COLOUR. The wash has to be strong enough to own the frame --
   * measured, a deep wash pulled all four night hue centroids from 19/108/358/42
   * degrees into 262/210/237/247, one blue family -- and the warm has to be a
   * POOL rather than a haze. Softening the wash and spreading the gold wider
   * was tried and was worse in both directions: gold over blue mixes toward
   * neutral, so the dead-pixel share tripled (beach 7% -> 40%) while the hues
   * scattered again. Strong blue, small bright pools.
   */
  night: {
    key: 'rgba(104,150,236,0.14)',
    keyFade: 'rgba(104,150,236,0)',
    top: 'rgba(30,52,128,0.38)',
    mid: 'rgba(20,38,104,0.42)',
    bottom: 'rgba(9,17,58,0.50)',
    pool: DIORAMA.goldGlow,
    poolOpacity: 0.17,
    vignette: 'rgba(6,11,40,0.32)',
  },
} as const;

/**
 * A crescent as ONE path: disc O minus disc C, with no mask and nothing
 * painted in a fake sky colour.
 *
 * The two circles meet at P1/P2 (standard circle-circle intersection). The
 * crescent's boundary is the MAJOR arc of O -- the side away from the cutter,
 * which is the major arc whenever the cutter's centre is outside the chord,
 * i.e. `a > 0` -- followed by the MINOR arc of C, the side facing O's centre.
 * Sweep flags follow from that and hold for any offset satisfying `a > 0`:
 * clockwise on the outer, anticlockwise on the inner.
 *
 * Written out because both alternatives are worse. An SVG `<Mask>` does not
 * survive react-native-svg's web renderer -- the moon shipped as a full flat
 * disc with no bite in it -- and painting the bite in `skyNightA`, which is
 * what this replaced, leaves a visibly lighter round patch wherever the night
 * gradient is not exactly that colour, which is most of the sky.
 */
export function crescentPath(cx: number, cy: number, R: number, r: number, dx: number, dy: number): string {
  const d = Math.hypot(dx, dy);
  const a = (d * d + R * R - r * r) / (2 * d);
  const h = Math.sqrt(Math.max(0, R * R - a * a));
  const ux = dx / d;
  const uy = dy / d;
  const nx = -uy;
  const ny = ux;
  const x1 = cx + a * ux + h * nx;
  const y1 = cy + a * uy + h * ny;
  const x2 = cx + a * ux - h * nx;
  const y2 = cy + a * uy - h * ny;
  return `M${x1} ${y1}A${R} ${R} 0 1 1 ${x2} ${y2}A${r} ${r} 0 0 0 ${x1} ${y1}Z`;
}

/**
 * A LIGHT, WITH A REAL FALLOFF.
 *
 * Every glow in this app used to be stacked opaque discs, each smaller and
 * stronger than the last, on the stated grounds that "react-native-web has no
 * radial gradient". expo-linear-gradient does not -- but react-native-svg is
 * already a dependency of every scene in here and has had RadialGradient the
 * whole time. Three concentric discs have three visible circular edges, which
 * is why the Town street lamps rendered as ringed targets and read as UI
 * toggles rather than as lamps.
 *
 * One SVG, one true falloff, sized in its own square canvas so callers only
 * give it a centre and a radius. `stops` is the alpha ramp from the middle
 * out; the last stop is always forced to zero so a glow can never show an
 * edge at the boundary of its box.
 */
export function RadialGlow({
  cx,
  cy,
  r,
  ry = r,
  color,
  stops,
  opacity = 1,
}: {
  cx: number;
  cy: number;
  r: number;
  /** Vertical radius. Defaults to `r`; give it a smaller value for a pool or
   *  a contact shadow, which are ellipses seen at this camera angle. */
  ry?: number;
  color: string;
  /** Alpha at 0%, 33%, 66% of the radius. Falls to 0 at the rim. */
  stops: [number, number, number];
  opacity?: number;
}) {
  // Gradient ids are document-global and several lamps are lit at once.
  const id = `glow${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <View style={{ position: 'absolute', left: cx - r, top: cy - ry, width: r * 2, height: ry * 2, opacity }} pointerEvents="none">
      {/* preserveAspectRatio="none" is what lets one square gradient serve
          both a round glow and a squashed ground ellipse. */}
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={stops[0]} />
            <Stop offset="0.33" stopColor={color} stopOpacity={stops[1]} />
            <Stop offset="0.66" stopColor={color} stopOpacity={stops[2]} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={50} cy={50} r={50} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/** Shared key/fill/grade pass. It keeps separate assets in one light family. */
export function WorldLighting({
  band = 'day',
  night,
  warm = false,
  ground,
}: {
  /** Which of the four light situations this frame is in. */
  band?: SkyBand;
  /** Night behaviour (warm pools, prop dimming) — also true when he's asleep. */
  night: boolean;
  warm?: boolean;
  /** Where his feet are. The warm pool is cast around it, not at the frame. */
  ground: number;
  }) {
  /*
   * ONE wash strength, everywhere. An "interior" escape hatch was tried here
   * on the theory that a room at night is lit by its own lamp and should take
   * less of the blue -- Home carries warm wooden props and was measuring 18%
   * neutral pixels, which brown-under-blue will always do. Weakening the wash
   * to 58% made BOTH numbers worse: 22.3% neutral, and Home's hue centroid
   * slid out of the night family entirely (from 275 degrees to 332). Half a
   * grade is not a grade. The honest fix for a scene that reads muddy is more
   * light in the pools, never less colour in the wash.
   */
  const g = night ? GRADE.night : GRADE[band];
  return (
    <View style={[styles.fill, { zIndex: WORLD_LAYER_Z.fx }]} pointerEvents="none">
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
        colors={[g.key, g.keyFade]}
        locations={[0, 0.62]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0.68 }}
        style={styles.keySweep}
      />
      {/*
        Horizon haze, dialled way back. This was PURE WHITE at 0.42, spanning a
        118px band that lands exactly on Town's shopfronts -- a white veil over
        the most colourful thing in the scene, and a big part of why Town alone
        stayed pale after its props were re-rendered. Distance in this art
        style is carried by scale, overlap and contact shadow, not by fading
        things toward white; the haze is now a warm hint that the air has depth
        in it.
      */}
      <LinearGradient
        colors={['rgba(255,244,214,0.16)', 'rgba(255,244,214,0)']}
        style={[styles.horizonHaze, { top: ground - 178, opacity: night ? 0.05 : 0.15 }]}
      />
      {/* The grade itself: warm high, neutral mid, cool low. Identical everywhere. */}
      <LinearGradient
        colors={[g.top, g.mid, g.bottom]}
        locations={[0, 0.52, 1]}
        style={styles.fill}
      />
      {/*
        ORDER MATTERS: the pools go ON TOP of the wash.
        They were under it, so at night the deep blue was composited over the
        gold and the two mixed toward neutral exactly where the light was
        supposed to be brightest -- measured, that put Home's dead-pixel share
        at 18% with a bright lamp in frame. Light is not something the
        atmosphere is in front of.
      */}
      {/*
        The warm pool. At night this is the whole idea: a deep blue room with
        gold light lying on the floor where the lamp/window/fire is. It used to
        run at 0.035 after dark, which is invisible, so night was only ever
        "the same scene, darker and purple".

        It is a GRADIENT, not a filled pill. As a solid colour behind a pill
        radius its edge was plainly visible against dark sand and dark floor --
        a lens-shaped decal lying on the ground rather than light falling on
        it. Fading to nothing at both ends of its own box is what makes it
        read as illumination.
      */}
      <LinearGradient
        colors={['rgba(255,246,208,0)', g.pool, 'rgba(255,246,208,0)']}
        locations={[0, 0.5, 1]}
        style={[
          styles.keyPool,
          { top: ground - 54, opacity: warm ? g.poolOpacity : g.poolOpacity * 0.72 },
        ]}
      />
      {night && (
        <LinearGradient
          colors={['rgba(255,191,35,0)', 'rgba(255,203,88,0.62)', 'rgba(255,176,20,0)']}
          locations={[0, 0.5, 1]}
          style={[styles.keyCore, { top: ground - 34, opacity: warm ? 0.86 : 0.62 }]}
        />
      )}
      {/*
        A soft vignette on all four edges. This is the cheapest and most
        reliable cohesion cue in the reference games — it is what makes a flat
        stack of layers read as one photographed diorama — and it doubles as
        the frame that keeps the HUD off the art.
      */}
      <LinearGradient
        colors={[g.vignette, 'rgba(0,0,0,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.vignetteSide}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0)', g.vignette]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.vignetteSide}
      />
      <LinearGradient
        colors={[g.vignette, 'rgba(0,0,0,0)']}
        style={styles.vignetteTop}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0)', g.vignette]}
        style={styles.vignetteBottom}
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
  keyCore: {
    position: 'absolute',
    left: '22%',
    right: '22%',
    height: 74,
    borderRadius: radius.pill,
    transform: [{ scaleX: 1.1 }],
  },
  keySweep: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  vignetteSide: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  vignetteTop: { position: 'absolute', left: 0, right: 0, top: 0, height: '13%' },
  vignetteBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '22%' },
  horizonHaze: { position: 'absolute', left: 0, right: 0, height: 118 },
});
