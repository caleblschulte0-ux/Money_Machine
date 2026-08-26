/**
 * Photo renderer — displays the ACTUAL approved renders of Barkly, cut from
 * the concept sheet (assets/barkly/renders/*, sourced from
 * assets/barkly/concept/barkly-concept.png). This is the default renderer:
 * it looks exactly like the character because it IS the character.
 *
 * Liveliness comes from pose selection per state plus whole-image motion
 * (breathe, bounce, tilt, talk-bob, sway). Per-part animation (jaw, ears,
 * blinks) arrives with the rigged production asset — see
 * assets/barkly/README.md for the state-render request spec.
 *
 * Implements BarklyRenderProps (src/animation/renderer.ts).
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { BarklyRenderProps } from '../animation/renderer';
import { BarklyState, BodyAction } from '../barkly/types';

const RENDERS = {
  front: require('../../assets/barkly/renders/front.png'),
  side: require('../../assets/barkly/renders/side.png'),
  threeQuarter: require('../../assets/barkly/renders/three_quarter.png'),
  face: require('../../assets/barkly/renders/face.png'),
} as const;

type Pose = keyof typeof RENDERS;

/** Which render carries each state. */
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

/** Display size per pose so the closeup doesn't dwarf the full-body shots. */
const POSE_SIZE: Record<Pose, { width: number; height: number }> = {
  front: { width: 244, height: 305 },
  side: { width: 280, height: 313 },
  threeQuarter: { width: 260, height: 300 },
  face: { width: 210, height: 170 },
};

function useLoop(active: boolean, duration: number): Animated.Value {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      v.stopAnimation();
      Animated.timing(v, { toValue: 0, duration: 160, useNativeDriver: true }).start();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, duration, v]);
  return v;
}

export default function BarklyPhotoView({ state, actions }: BarklyRenderProps) {
  const has = (a: BodyAction) => actions.includes(a);
  const asleep = state === 'sleepy' || has('SLEEP');
  const pose = poseFor(state);
  const size = POSE_SIZE[pose];

  const breathe = useLoop(true, asleep ? 1600 : 2400);
  const bob = useLoop(has('MOUTH_MOVE'), 160);       // talk rhythm
  const bounce = useLoop(has('EXCITED'), 260);
  const sway = useLoop(has('TAIL_WAG'), 300);        // happy rocking
  const look = useLoop(has('LOOK_LEFT') || has('LOOK_RIGHT'), 900);

  const tilt = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(tilt, {
      toValue: has('HEAD_TILT') ? 1 : 0,
      duration: 380,
      easing: Easing.out(Easing.back(1.6)),
      useNativeDriver: true,
    }).start();
  }, [actions]); // eslint-disable-line react-hooks/exhaustive-deps

  // Quick fade-in whenever the pose changes so cuts read as intentional.
  const fade = useRef(new Animated.Value(1)).current;
  const prevPose = useRef(pose);
  useEffect(() => {
    if (prevPose.current !== pose) {
      prevPose.current = pose;
      fade.setValue(0.25);
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    }
  }, [pose, fade]);

  const breatheScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, asleep ? 1.028 : 1.012] });
  const talkBob = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  const bounceLift = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -18] });
  const swayRotate = sway.interpolate({ inputRange: [0, 1], outputRange: ['-1.6deg', '1.6deg'] });
  const tiltRotate = tilt.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-6deg'] });
  const lookShift = look.interpolate({
    inputRange: [0, 1],
    outputRange: has('LOOK_LEFT') && has('LOOK_RIGHT') ? [-8, 8] : has('LOOK_LEFT') ? [0, -10] : [0, 10],
  });
  const sleepDroop = asleep ? '2deg' : '0deg';

  return (
    <View style={styles.stage}>
      <Animated.View
        style={{
          opacity: fade,
          transform: [
            { translateY: Animated.add(talkBob, bounceLift) },
            { translateX: lookShift },
            { scale: breatheScale },
            { rotate: swayRotate },
            { rotate: tiltRotate },
            { rotate: sleepDroop },
          ],
        }}
      >
        <Image source={RENDERS[pose]} style={{ width: size.width, height: size.height }} resizeMode="contain" />
      </Animated.View>

      {asleep && (
        <View style={styles.zzzWrap} pointerEvents="none">
          <Text style={[styles.zzz, { fontSize: 15, opacity: 0.5 }]}>z</Text>
          <Text style={[styles.zzz, { fontSize: 19, opacity: 0.7, marginLeft: 10, marginBottom: 10 }]}>z</Text>
          <Text style={[styles.zzz, { fontSize: 24, marginLeft: 10, marginBottom: 22 }]}>z</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { width: 300, height: 322, alignItems: 'center', justifyContent: 'flex-end' },
  zzzWrap: { position: 'absolute', top: 4, right: 30, flexDirection: 'row', alignItems: 'flex-end' },
  zzz: { color: '#A08F6F', fontWeight: '800' },
});
