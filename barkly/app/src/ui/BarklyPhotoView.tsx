/**
 * Photo renderer — displays the ACTUAL approved renders of Barkly, cut from
 * the concept sheet (assets/barkly/renders/*, sourced from
 * assets/barkly/concept/barkly-concept.png). This is the default renderer:
 * it looks exactly like the character because it IS the character.
 *
 * Motion design: everything is spring- or sine-based so nothing snaps.
 *  - entrance pop on mount
 *  - continuous breathe + slow idle drift
 *  - true crossfade between poses (two stacked images), with a scale settle
 *  - one-shot squash-and-stretch pop on emotional beats
 *  - talk-bob with a slight nod while speaking
 *  - excited bounce with squash on landing, sway when the tail would wag
 *  - floating, staggered z's while asleep
 *
 * Implements BarklyRenderProps (src/animation/renderer.ts).
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { BarklyRenderProps } from '../animation/renderer';
import { BarklyState, BodyAction } from '../barkly/types';

const RENDERS = {
  front: require('../../assets/barkly/renders/front.png'),
  side: require('../../assets/barkly/renders/side.png'),
  threeQuarter: require('../../assets/barkly/renders/three_quarter.png'),
  face: require('../../assets/barkly/renders/face.png'),
} as const;

// Facial variants derived from the front render (see assets README):
// real jaw-flap while speaking, real blinks while idle.
const FRONT_MOUTH_OPEN = require('../../assets/barkly/renders/front_mouth_open.png');
const FRONT_BLINK = require('../../assets/barkly/renders/front_blink.png');

type Pose = keyof typeof RENDERS;

function poseFor(state: BarklyState): Pose {
  switch (state) {
    case 'playing':
    case 'excited':
      return 'threeQuarter';
    case 'sleepy':
      return 'side';
    case 'thinking':
    case 'annoyed':
      return 'face'; // the sheet's EXPRESSION closeup — a dramatic zoom beat
    default:
      return 'front';
  }
}

const POSE_SIZE: Record<Pose, { width: number; height: number }> = {
  front: { width: 244, height: 305 },
  side: { width: 280, height: 313 },
  threeQuarter: { width: 260, height: 300 },
  face: { width: 210, height: 170 },
};

/** States that get a one-shot squash-and-stretch pop when entered. */
const POP_STATES: BarklyState[] = ['happy', 'excited', 'playing', 'eating', 'annoyed'];

/** Continuous 0→1→0 sine-feel loop while `active`. */
function useLoop(active: boolean, duration: number): Animated.Value {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      v.stopAnimation();
      Animated.timing(v, { toValue: 0, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, duration, v]);
  return v;
}

/** Floating, staggered sleep z's. */
function SleepZs() {
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(drift, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [drift]);

  const zs = [
    { size: 14, delayRange: [0, 0.55] as const, x: 0 },
    { size: 18, delayRange: [0.2, 0.75] as const, x: 14 },
    { size: 23, delayRange: [0.4, 0.95] as const, x: 26 },
  ];
  return (
    <View style={styles.zzzWrap} pointerEvents="none">
      {zs.map((z, i) => {
        const rise = drift.interpolate({ inputRange: [0, 1], outputRange: [6, -14 - i * 6] });
        const fade = drift.interpolate({
          inputRange: [0, z.delayRange[0], z.delayRange[1], 1],
          outputRange: [0, 0.15, 0.85, 0],
        });
        return (
          <Animated.Text
            key={i}
            style={[styles.zzz, { fontSize: z.size, left: z.x, opacity: fade, transform: [{ translateY: rise }] }]}
          >
            z
          </Animated.Text>
        );
      })}
    </View>
  );
}

export default function BarklyPhotoView({ state, actions }: BarklyRenderProps) {
  const has = (a: BodyAction) => actions.includes(a);
  const asleep = state === 'sleepy' || has('SLEEP');
  const talking = has('MOUTH_MOVE');
  const pose = poseFor(state);
  const size = POSE_SIZE[pose];

  // Jaw-flap: alternate open/closed mouth frames while speaking.
  const [jawOpen, setJawOpen] = useState(false);
  useEffect(() => {
    if (!talking) {
      setJawOpen(false);
      return;
    }
    const id = setInterval(() => setJawOpen((j) => !j), 150);
    return () => clearInterval(id);
  }, [talking]);

  // Occasional deadpan blink (front pose only — the others hold their look).
  const [blinking, setBlinking] = useState(false);
  useEffect(() => {
    if (asleep) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        if (!alive) return;
        setBlinking(true);
        setTimeout(() => {
          if (alive) setBlinking(false);
          schedule();
        }, 130);
      }, 2600 + Math.random() * 3000);
    };
    schedule();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [asleep]);

  // --- continuous loops ---
  const breathe = useLoop(true, asleep ? 1700 : 2300);
  const drift = useLoop(true, 3600); // slow ambient lean so idle never freezes
  const bob = useLoop(talking, 170);
  const bounce = useLoop(has('EXCITED'), 270);
  const sway = useLoop(has('TAIL_WAG'), 340);
  const look = useLoop(has('LOOK_LEFT') || has('LOOK_RIGHT'), 950);

  // --- springs ---
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(enter, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }).start();
  }, [enter]);

  const tilt = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(tilt, {
      toValue: has('HEAD_TILT') ? 1 : 0,
      friction: 5,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [actions]); // eslint-disable-line react-hooks/exhaustive-deps

  // One-shot squash-and-stretch when an emotional beat lands.
  const squash = useRef(new Animated.Value(0)).current;
  const prevState = useRef(state);
  useEffect(() => {
    if (prevState.current !== state && POP_STATES.includes(state)) {
      squash.setValue(0);
      Animated.sequence([
        Animated.timing(squash, { toValue: 1, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(squash, { toValue: 0, friction: 4, tension: 120, useNativeDriver: true }),
      ]).start();
    }
    prevState.current = state;
  }, [state, squash]);

  // --- pose crossfade: keep the old render on screen while the new fades in ---
  const [shown, setShown] = useState<{ current: Pose; prev: Pose | null }>({ current: pose, prev: null });
  const cross = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (pose === shown.current) return;
    setShown({ current: pose, prev: shown.current });
    cross.setValue(0);
    Animated.spring(cross, { toValue: 1, friction: 8, tension: 90, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setShown((s) => ({ ...s, prev: null }));
    });
  }, [pose]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- derived transforms ---
  const breatheScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, asleep ? 1.026 : 1.012] });
  const driftRotate = drift.interpolate({ inputRange: [0, 1], outputRange: ['-0.7deg', '0.7deg'] });
  const talkBob = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  const talkNod = bob.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '1.1deg'] });
  const bounceLift = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -20] });
  const bounceSquash = bounce.interpolate({ inputRange: [0, 0.15, 1], outputRange: [1, 0.965, 1.02] });
  const swayRotate = sway.interpolate({ inputRange: [0, 1], outputRange: ['-1.8deg', '1.8deg'] });
  const tiltRotate = tilt.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-6deg'] });
  const lookShift = look.interpolate({
    inputRange: [0, 1],
    outputRange: has('LOOK_LEFT') && has('LOOK_RIGHT') ? [-8, 8] : has('LOOK_LEFT') ? [0, -10] : [0, 10],
  });
  const enterScale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  const squashX = squash.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });
  const squashY = squash.interpolate({ inputRange: [0, 1], outputRange: [1, 0.93] });
  const crossIn = cross.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const crossOut = cross.interpolate({ inputRange: [0, 0.65, 1], outputRange: [1, 0, 0] });
  const crossScale = cross.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  const sleepDroop = asleep ? '2deg' : '0deg';

  const prevSize = shown.prev ? POSE_SIZE[shown.prev] : size;

  return (
    <View style={styles.stage}>
      <Animated.View
        style={{
          opacity: enter,
          transform: [
            { translateY: Animated.add(talkBob, bounceLift) },
            { translateX: lookShift },
            { rotate: driftRotate },
            { rotate: swayRotate },
            { rotate: tiltRotate },
            { rotate: talkNod },
            { rotate: sleepDroop },
            { scale: Animated.multiply(breatheScale, enterScale) },
            { scaleX: Animated.multiply(squashX, bounceSquash) },
            { scaleY: squashY },
          ],
        }}
      >
        <View style={{ width: size.width, height: size.height, alignItems: 'center', justifyContent: 'flex-end' }}>
          {shown.prev && (
            <Animated.Image
              source={RENDERS[shown.prev]}
              style={{ position: 'absolute', bottom: 0, width: prevSize.width, height: prevSize.height, opacity: crossOut }}
              resizeMode="contain"
            />
          )}
          <Animated.Image
            source={
              shown.current === 'front'
                ? talking && jawOpen
                  ? FRONT_MOUTH_OPEN
                  : blinking
                    ? FRONT_BLINK
                    : RENDERS.front
                : RENDERS[shown.current]
            }
            style={{ width: size.width, height: size.height, opacity: crossIn, transform: [{ scale: crossScale }] }}
            resizeMode="contain"
          />
        </View>
      </Animated.View>

      {/* invisible preloads so the first jaw-flap/blink never flickers */}
      <Image source={FRONT_MOUTH_OPEN} style={styles.preload} />
      <Image source={FRONT_BLINK} style={styles.preload} />

      {asleep && <SleepZs />}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { width: 300, height: 322, alignItems: 'center', justifyContent: 'flex-end' },
  preload: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  zzzWrap: { position: 'absolute', top: 8, right: 34, width: 60, height: 60 },
  zzz: { position: 'absolute', bottom: 0, color: '#A08F6F', fontWeight: '800' },
});
