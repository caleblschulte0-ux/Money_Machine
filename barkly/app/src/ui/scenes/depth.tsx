/**
 * The parts that make a flat drawing read as a PLACE.
 *
 * CRISP PASS:
 * Depth is still essential, but atmosphere cannot become a soft filter over
 * the whole game. The goal is clean planes + clear contact + restrained air,
 * not haze/vignette/motes doing the art direction for us.
 */

import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

/** A ground plane seen in perspective. */
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
 * Air at the horizon. Shorter and quieter than the first version: enough to
 * remove a hard cut, not enough to wash the scene into a web-gradient haze.
 */
export function Haze({ top, color, height = 54 }: { top: number; color: string; height?: number }) {
  return (
    <LinearGradient
      colors={[color, `${color}00`]}
      style={[styles.haze, { top: top - height * 0.5, height }]}
      pointerEvents="none"
    />
  );
}

/** Restrained edge framing. The subject should win through composition first. */
export function Vignette({ strength = 0.1 }: { strength?: number }) {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="vig" cx="50%" cy="52%" r="78%">
          <Stop offset="62%" stopColor="#000000" stopOpacity={0} />
          <Stop offset="100%" stopColor="#20180E" stopOpacity={strength} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#vig)" />
    </Svg>
  );
}

/** The warm patch of floor the character is standing in. */
export function LightPool({ y, width = 300, height = 112, color = '#FFF3D2', opacity = 0.34 }: {
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
            <Stop offset="74%" stopColor={color} stopOpacity={opacity * 0.22} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx="50%" cy="50%" rx={width / 2} ry={height / 2} fill="url(#pool)" />
      </Svg>
    </View>
  );
}

/** Something close along the bottom edge of the frame. */
export function Foreground({ children, height = 96 }: { children: React.ReactNode; height?: number }) {
  return (
    <View style={[styles.foreground, { height }]} pointerEvents="none">
      {children}
    </View>
  );
}

/* ------------------------------------------------------------------ motion */

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
 * Three restrained particles, not a visual filter. The world can breathe
 * without putting translucent noise between the kid and the dog.
 */
export function Motes({ top, height = 220, tint = '#FFFFFF' }: { top: number; height?: number; tint?: string }) {
  const specks = [
    { x: '22%', r: 1.8, secs: 19, rise: 42, delay: 0 },
    { x: '58%', r: 1.4, secs: 25, rise: 54, delay: 3200 },
    { x: '81%', r: 2.0, secs: 22, rise: 34, delay: 6400 },
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
        opacity: v.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.32, 0.24, 0] }),
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -rise] }) },
          { translateX: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 7, -4] }) },
        ],
      }}
    >
      <View style={{ width: r * 2, height: r * 2, borderRadius: r, backgroundColor: tint }} />
    </Animated.View>
  );
}

/** A tight shadow that visually welds a character to the floor. */
export function ContactShadow({ width, opacity = 0.26, style }: {
  width: number;
  opacity?: number;
  style?: object;
}) {
  return (
    <View style={[styles.contact, { width, height: width * 0.25, marginLeft: -width / 2 }, style]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="cs" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor="#2B2117" stopOpacity={opacity} />
            <Stop offset="58%" stopColor="#2B2117" stopOpacity={opacity * 0.56} />
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
