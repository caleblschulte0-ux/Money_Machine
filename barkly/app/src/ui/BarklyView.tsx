/**
 * PLACEHOLDER Barkly renderer.
 *
 * This is development stand-in art, not the product. It draws Barkly from
 * plain RN Views because the locked design is deliberately blocky — squat
 * body, rectangular head, mustard/cream, deadpan eyes, snaggletooth, bent
 * ears, ring tail, leg stripes, brass "B" tag — so box geometry is genuinely
 * on-model. It follows docs/CHARACTER.md; do not "cute it up".
 *
 * It implements the BarklyRenderProps contract (src/animation/renderer.ts).
 * Production art (Rive recommended) replaces this file wholesale; nothing
 * else in the app changes.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { BarklyRenderProps } from '../animation/renderer';
import { BodyAction } from '../barkly/types';

// Palette from the concept sheet (docs/CHARACTER.md)
const MUSTARD = '#D9A441';
const MUSTARD_DARK = '#B8862F';
const CREAM = '#F3E7C9';
const CHARCOAL = '#2E2A26';
const COLLAR = '#3B3230';
const BRASS = '#C9963C';

/** Loop an Animated.Value 0→1→0 while `active`; snap to 0 when not. */
function useLoop(active: boolean, duration: number): Animated.Value {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      v.stopAnimation();
      Animated.timing(v, { toValue: 0, duration: 150, useNativeDriver: true }).start();
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

export default function BarklyView({ state, actions }: BarklyRenderProps) {
  const has = (a: BodyAction) => actions.includes(a);
  const asleep = state === 'sleepy' || has('SLEEP');

  // --- animation drivers ---
  const wag = useLoop(has('TAIL_WAG'), 180);
  const mouth = useLoop(has('MOUTH_MOVE'), 130);
  const bounce = useLoop(has('EXCITED'), 260);
  const breathe = useLoop(true, asleep ? 1400 : 2200);
  const look = useLoop(has('LOOK_LEFT') || has('LOOK_RIGHT'), 900);

  // Head tilt eases to a held angle rather than looping.
  const tilt = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(tilt, {
      toValue: has('HEAD_TILT') ? 1 : 0,
      duration: 350,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }).start();
  }, [actions]); // eslint-disable-line react-hooks/exhaustive-deps

  // Occasional deadpan blink (only when eyes are open and BLINK is ambient).
  const blink = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!has('BLINK') || asleep) return;
    let alive = true;
    const doBlink = () => {
      if (!alive) return;
      Animated.sequence([
        Animated.timing(blink, { toValue: 1, duration: 70, useNativeDriver: false }),
        Animated.timing(blink, { toValue: 0, duration: 90, useNativeDriver: false }),
      ]).start(() => {
        if (alive) timer = setTimeout(doBlink, 2200 + Math.random() * 2600);
      });
    };
    let timer = setTimeout(doBlink, 1500);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [actions, asleep]); // eslint-disable-line react-hooks/exhaustive-deps

  const tailRotate = wag.interpolate({ inputRange: [0, 1], outputRange: ['-16deg', '24deg'] });
  const mouthScale = mouth.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  const bodyLift = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });
  const breatheScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, asleep ? 1.035 : 1.015] });
  const headTilt = tilt.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-9deg'] });
  const lookShift = look.interpolate({
    inputRange: [0, 1],
    outputRange: has('LOOK_LEFT') && has('LOOK_RIGHT')
      ? [-5, 5]
      : has('LOOK_LEFT') ? [0, -6] : [0, 6],
  });
  const eyeHeight = blink.interpolate({ inputRange: [0, 1], outputRange: [7, 2] });

  // Deadpan by default; narrower when annoyed; closed when asleep.
  const annoyed = state === 'annoyed';
  const mouthOpen = has('MOUTH_MOVE');

  return (
    <View style={styles.stage}>
      <Animated.View style={{ transform: [{ translateY: bodyLift }, { scale: breatheScale }] }}>

        {/* HEAD — rectangular/blocky, on purpose */}
        <Animated.View style={[styles.head, { transform: [{ rotate: headTilt }] }]}>
          {/* ears: bent outward/downward */}
          <View style={[styles.ear, styles.earLeft, has('EAR_PERK') && styles.earPerked]} />
          <View style={[styles.ear, styles.earRight, has('EAR_PERK') && styles.earPerkedR]} />

          {/* eyes: narrow + deadpan; slightly asymmetric on purpose */}
          <View style={styles.eyeRow}>
            {asleep ? (
              <>
                <View style={styles.eyeClosed} />
                <View style={[styles.eyeClosed, { width: 20 }]} />
              </>
            ) : (
              <>
                <Animated.View style={[styles.eye, { height: eyeHeight, transform: [{ translateX: lookShift }] }, annoyed && styles.eyeAnnoyed]} />
                <Animated.View style={[styles.eye, { height: eyeHeight, width: 24, transform: [{ translateX: lookShift }] }, annoyed && styles.eyeAnnoyed]} />
              </>
            )}
          </View>

          {/* cream muzzle with big rounded-square charcoal nose */}
          <View style={styles.muzzle}>
            <View style={styles.nose} />
            {/* mouth + the snaggletooth */}
            <View style={styles.mouthArea}>
              <Animated.View style={[styles.mouth, { transform: [{ scaleY: mouthOpen ? mouthScale : 0.35 }] }]} />
              <View style={styles.snaggletooth} />
            </View>
          </View>
        </Animated.View>

        {/* COLLAR — thick, dark, round brass B tag */}
        <View style={styles.collar}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>B</Text>
          </View>
        </View>

        {/* BODY — squat and low-slung, cream chest */}
        <View style={styles.body}>
          <View style={styles.chest} />
          {/* curled ring tail */}
          <Animated.View style={[styles.tail, { transform: [{ rotate: tailRotate }] }]} />
          {/* legs: front pair with stripes, cream feet */}
          <View style={styles.legRow}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.leg}>
                {i < 2 && (
                  <>
                    <View style={[styles.stripe, { top: 4 }]} />
                    <View style={[styles.stripe, { top: 12 }]} />
                  </>
                )}
                <View style={styles.foot} />
              </View>
            ))}
          </View>
        </View>
      </Animated.View>

      {asleep && <Text style={styles.zzz}>z  z  z</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { alignItems: 'center', justifyContent: 'flex-end' },

  head: {
    width: 150,
    height: 110,
    backgroundColor: MUSTARD,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: CHARCOAL,
    zIndex: 3,
    alignItems: 'center',
  },
  ear: {
    position: 'absolute',
    top: -14,
    width: 34,
    height: 44,
    backgroundColor: MUSTARD_DARK,
    borderWidth: 3,
    borderColor: CHARCOAL,
    borderRadius: 10,
  },
  earLeft: { left: -12, transform: [{ rotate: '-38deg' }] },
  earRight: { right: -12, transform: [{ rotate: '38deg' }] },
  earPerked: { transform: [{ rotate: '-10deg' }], top: -24 },
  earPerkedR: { transform: [{ rotate: '10deg' }], top: -24 },

  eyeRow: {
    flexDirection: 'row',
    gap: 34,
    marginTop: 30,
  },
  eye: {
    width: 20,
    height: 7,
    backgroundColor: CHARCOAL,
    borderRadius: 3,
  },
  eyeAnnoyed: { height: 4 },
  eyeClosed: {
    width: 22,
    height: 3,
    backgroundColor: CHARCOAL,
    borderRadius: 2,
    marginTop: 3,
  },

  muzzle: {
    marginTop: 10,
    width: 84,
    height: 52,
    backgroundColor: CREAM,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: CHARCOAL,
    alignItems: 'center',
  },
  nose: {
    marginTop: 4,
    width: 30,
    height: 20,
    backgroundColor: CHARCOAL,
    borderRadius: 7, // large rounded-square nose
  },
  mouthArea: { alignItems: 'center', marginTop: 2 },
  mouth: {
    width: 26,
    height: 14,
    backgroundColor: CHARCOAL,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  snaggletooth: {
    position: 'absolute',
    top: 6,
    right: -16,
    width: 7,
    height: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: CHARCOAL,
    borderRadius: 2,
    transform: [{ rotate: '8deg' }],
  },

  collar: {
    width: 96,
    height: 18,
    backgroundColor: COLLAR,
    borderRadius: 7,
    marginTop: -9,
    zIndex: 4,
    alignItems: 'center',
  },
  tag: {
    position: 'absolute',
    bottom: -14,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: BRASS,
    borderWidth: 2,
    borderColor: CHARCOAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagText: { fontSize: 11, fontWeight: '800', color: CHARCOAL },

  body: {
    width: 190,
    height: 88, // squat, low-slung
    backgroundColor: MUSTARD,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: CHARCOAL,
    marginTop: -6,
    zIndex: 2,
    alignItems: 'center',
  },
  chest: {
    position: 'absolute',
    left: 18,
    top: 14,
    width: 52,
    height: 58,
    backgroundColor: CREAM,
    borderRadius: 16,
  },
  tail: {
    position: 'absolute',
    right: -26,
    top: -18,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 9,
    borderColor: MUSTARD_DARK, // ring/donut = curled tail
    backgroundColor: 'transparent',
  },
  legRow: {
    position: 'absolute',
    bottom: -22,
    flexDirection: 'row',
    gap: 22,
  },
  leg: {
    width: 22,
    height: 26,
    backgroundColor: MUSTARD,
    borderWidth: 3,
    borderColor: CHARCOAL,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    overflow: 'hidden',
    alignItems: 'center',
  },
  stripe: {
    position: 'absolute',
    width: 22,
    height: 4,
    backgroundColor: MUSTARD_DARK,
  },
  foot: {
    position: 'absolute',
    bottom: 0,
    width: 22,
    height: 8,
    backgroundColor: CREAM,
  },
  zzz: {
    position: 'absolute',
    top: -6,
    right: 30,
    fontSize: 18,
    color: '#8B8378',
    fontWeight: '700',
  },
});
