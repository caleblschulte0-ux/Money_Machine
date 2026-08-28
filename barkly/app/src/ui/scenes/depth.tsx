/**
 * The parts that make a flat drawing read as a PLACE.
 *
 * Every location was three or four bands of flat colour with a hard line where
 * they met, a couple of lollipop trees, and a big empty middle. Barkly is a
 * rendered object with real light on him; standing him on that read exactly
 * like what it was — a good model pasted onto a placeholder.
 *
 * None of what is missing is detail. Adding more trees to a flat green band
 * gives you a flat green band with more trees. What is missing is DEPTH, and
 * depth is four specific things, which is what this file is:
 *
 *   THE GROUND IS A PLANE, NOT A BAND. A floor going away from you gets
 *   lighter, hazier and less saturated toward the horizon. One gradient does
 *   more for the illusion than any amount of scenery.
 *
 *   THE HORIZON IS A DISSOLVE, NOT A CUT. Air between you and the far distance
 *   washes it toward the sky colour. A hard line between two greens is the
 *   single loudest "this is a placeholder" signal in the whole scene.
 *
 *   THINGS OVERLAP AT DIFFERENT SIZES. Three layers — far, middle, and
 *   something big and dark at the very bottom of the frame — tell the eye how
 *   far away everything is, before it has looked at any of it.
 *
 *   THE LIGHT PICKS SOMEBODY. A warm pool under the character and a darkening
 *   at the corners says where to look, and turns "empty" into "out of focus".
 *
 * All of it is vector and cheap, because it runs behind a dog on a phone.
 */

import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * A ground plane seen in perspective.
 *
 * `far` is the colour where it meets the horizon and `near` where it reaches
 * the bottom of the screen. They are the same surface: the difference between
 * them IS the depth, and the bigger that difference the further away the
 * horizon feels.
 */
export function GroundPlane({
  top,
  far,
  near,
  children,
}: {
  top: number;
  far: string;
  near: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={[styles.below, { top }]} pointerEvents="none">
      <LinearGradient colors={[far, near]} style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}

/**
 * Air. A soft band of sky colour sitting ON the horizon, fading out downward.
 *
 * This is the one that does the most and shows the least. Without it the
 * distance ends in a ruled line; with it the far scenery walks into the sky.
 */
export function Haze({ top, color, height = 78 }: { top: number; color: string; height?: number }) {
  return (
    <LinearGradient
      colors={[color, `${color}00`]}
      style={[styles.haze, { top: top - height * 0.55, height }]}
      pointerEvents="none"
    />
  );
}

/**
 * Corner darkening, very slightly.
 *
 * Portrait phones are tall, and a tall frame has a lot of screen a long way
 * from the subject. A vignette turns that from "nothing was drawn here" into
 * "this is the edge of the shot".
 */
export function Vignette({ strength = 0.16 }: { strength?: number }) {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="vig" cx="50%" cy="52%" r="76%">
          <Stop offset="55%" stopColor="#000000" stopOpacity={0} />
          <Stop offset="100%" stopColor="#20180E" stopOpacity={strength} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#vig)" />
    </Svg>
  );
}

/** The warm patch of floor the character is standing in. */
export function LightPool({ y, width = 300, height = 120, color = '#FFF3D2', opacity = 0.5 }: {
  y: number;
  width?: number;
  height?: number;
  color?: string;
  opacity?: number;
}) {
  return (
    <View style={[styles.pool, { top: y - height / 2, height }]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="pool" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={opacity} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx="50%" cy="50%" rx={width / 2} ry={height / 2} fill="url(#pool)" />
      </Svg>
    </View>
  );
}

/**
 * Something big, dark and close, along the bottom edge of the frame.
 *
 * A foreground element is the cheapest depth cue there is: the eye reads
 * "there is stuff between me and him, so he is over THERE". It is deliberately
 * darker and less detailed than everything else — near things in shadow, out of
 * the light the subject is standing in.
 */
export function Foreground({ children, height = 96 }: { children: React.ReactNode; height?: number }) {
  return (
    <View style={[styles.foreground, { height }]} pointerEvents="none">
      {children}
    </View>
  );
}

/* ------------------------------------------------------------------ motion */

/**
 * A very slow horizontal drift, for clouds and anything else that should move
 * without ever being caught moving.
 *
 * Deliberately long: at anything under about twenty seconds it stops being
 * weather and starts being an animation, and the eye goes to it instead of to
 * the dog.
 */
export function Drift({
  children,
  distance = 26,
  seconds = 34,
  delay = 0,
}: {
  children: React.ReactNode;
  distance?: number;
  seconds?: number;
  delay?: number;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: seconds * 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: seconds * 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, seconds, delay]);
  return (
    <Animated.View
      style={{ transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, distance] }) }] }}
      pointerEvents="none"
    >
      {children}
    </Animated.View>
  );
}

/**
 * The advance and retreat of an edge — written for the shoreline.
 *
 * Drift is horizontal because clouds are; water comes AT the camera, so the
 * foam edge needs the same slow sine on the other axis. It is a separate
 * component rather than a `direction` prop on Drift because the two read at
 * different speeds: weather is only weather past ~20s, but a wave that slow
 * reads as a tide going out — the sea breathes in seconds.
 */
export function Surge({
  children,
  distance = 12,
  seconds = 6,
  delay = 0,
}: {
  children: React.ReactNode;
  distance?: number;
  seconds?: number;
  delay?: number;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: seconds * 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: seconds * 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, seconds, delay]);
  return (
    <Animated.View
      style={{ transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, distance] }) }] }}
      pointerEvents="none"
    >
      {children}
    </Animated.View>
  );
}

/** A gentle rocking, for foliage and anything hanging. */
export function Sway({
  children,
  degrees = 1.4,
  seconds = 5,
  delay = 0,
}: {
  children: React.ReactNode;
  degrees?: number;
  seconds?: number;
  delay?: number;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: seconds * 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: -1, duration: seconds * 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, seconds, delay]);
  return (
    <Animated.View
      style={{
        transform: [
          { rotate: v.interpolate({ inputRange: [-1, 1], outputRange: [`-${degrees}deg`, `${degrees}deg`] }) },
        ],
      }}
      pointerEvents="none"
    >
      {children}
    </Animated.View>
  );
}

/**
 * Dust in the light, or pollen, or sea spray.
 *
 * Three of them, not thirty. The point is that the air is not a vacuum, and
 * three is enough to say that; more turns into snow.
 */
export function Motes({ top, height = 240, tint = '#FFFFFF' }: { top: number; height?: number; tint?: string }) {
  const specks = [
    { x: '22%', r: 2.2, secs: 17, rise: 46, delay: 0 },
    { x: '58%', r: 1.6, secs: 23, rise: 62, delay: 3200 },
    { x: '81%', r: 2.6, secs: 20, rise: 38, delay: 6400 },
  ];
  return (
    <View style={[styles.motes, { top, height }]} pointerEvents="none">
      {specks.map((s, i) => (
        <Mote key={i} {...s} tint={tint} />
      ))}
    </View>
  );
}

function Mote({ x, r, secs, rise, delay, tint }: {
  x: string; r: number; secs: number; rise: number; delay: number; tint: string;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 1, duration: secs * 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, secs, delay]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x as unknown as number,
        top: '70%',
        opacity: v.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.5, 0.4, 0] }),
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -rise] }) },
          { translateX: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 9, -5] }) },
        ],
      }}
    >
      <View style={{ width: r * 2, height: r * 2, borderRadius: r, backgroundColor: tint }} />
    </Animated.View>
  );
}

/**
 * The dark soft ellipse that welds a character to the floor.
 *
 * Exported so BOTH Barkly and the other dogs use the same one — they used to
 * differ, and an NPC with a weaker shadow floats next to a dog who does not,
 * which is most of why they read as stickers laid on the picture.
 */
export function ContactShadow({ width, opacity = 0.24, style }: {
  width: number;
  opacity?: number;
  style?: object;
}) {
  return (
    <View style={[styles.contact, { width, height: width * 0.3, marginLeft: -width / 2 }, style]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="cs" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#2B2117" stopOpacity={opacity} />
            <Stop offset="62%" stopColor="#2B2117" stopOpacity={opacity * 0.5} />
            <Stop offset="100%" stopColor="#2B2117" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx="50%" cy="50%" rx="50%" ry="50%" fill="url(#cs)" />
      </Svg>
    </View>
  );
}

/** A soft-edged silhouette, for far scenery that should sit IN the haze. */
export function farTint(base: string, sky: string, amount: number): string {
  const hex = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [r1, g1, b1] = hex(base);
  const [r2, g2, b2] = hex(sky);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * amount);
  return `#${[mix(r1, r2), mix(g1, g2), mix(b1, b2)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const styles = StyleSheet.create({
  below: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  haze: { position: 'absolute', left: 0, right: 0 },
  pool: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  foreground: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  motes: { position: 'absolute', left: 0, right: 0 },
  contact: { position: 'absolute', left: '50%' },
});
