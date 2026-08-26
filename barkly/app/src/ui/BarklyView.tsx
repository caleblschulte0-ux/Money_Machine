/**
 * PLACEHOLDER Barkly renderer — vector edition.
 *
 * Draws Barkly with react-native-svg, following the LOCKED design in
 * docs/CHARACTER.md: squat low-slung body, rectangular head, mustard/cream,
 * narrow deadpan eyes, snaggletooth, ears bent outward/downward, curled ring
 * tail, front-leg stripes, thick collar with a brass "B" tag. Blocky and
 * toy-like on purpose — this pass is about rendering him cleanly, not
 * redesigning him.
 *
 * Implements BarklyRenderProps (src/animation/renderer.ts). Production art
 * (Rive recommended) replaces this file; nothing else changes.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { BarklyRenderProps } from '../animation/renderer';
import { BodyAction } from '../barkly/types';

// Palette (concept sheet, docs/CHARACTER.md)
const MUSTARD = '#E0A93E';
const MUSTARD_DEEP = '#C08A2E';
const MUSTARD_SHADE = '#AA7A28';
const CREAM = '#F7EDD2';
const OUTLINE = '#4A3B2A';
const NOSE = '#332B24';
const COLLAR = '#453931';
const BRASS = '#D9A93F';
const BRASS_DARK = '#A87E27';
const TONGUE = '#D97B6C';

/** Loop an Animated.Value 0→1→0 while `active`; ease back to 0 when not. */
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

type EyeMode = 'open' | 'closed' | 'annoyed';

export default function BarklyView({ state, actions }: BarklyRenderProps) {
  const has = (a: BodyAction) => actions.includes(a);
  const asleep = state === 'sleepy' || has('SLEEP');
  const perked = has('EAR_PERK');
  const talking = has('MOUTH_MOVE');

  const wag = useLoop(has('TAIL_WAG'), 170);
  const mouth = useLoop(talking, 120);
  const bounce = useLoop(has('EXCITED'), 250);
  const breathe = useLoop(true, asleep ? 1500 : 2400);
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

  // Occasional deadpan blink.
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
        }, 110);
      }, 2400 + Math.random() * 2800);
    };
    schedule();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [asleep]);

  const eyes: EyeMode = asleep || blinking ? 'closed' : state === 'annoyed' ? 'annoyed' : 'open';

  const tailRotate = wag.interpolate({ inputRange: [0, 1], outputRange: ['-14deg', '22deg'] });
  const mouthScale = mouth.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  const lift = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -16] });
  const breatheScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, asleep ? 1.03 : 1.012] });
  const headTilt = tilt.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-8deg'] });
  const lookShift = look.interpolate({
    inputRange: [0, 1],
    outputRange: has('LOOK_LEFT') && has('LOOK_RIGHT') ? [-7, 7] : has('LOOK_LEFT') ? [0, -8] : [0, 8],
  });

  return (
    <View style={styles.stage}>
      <Animated.View style={[styles.character, { transform: [{ translateY: lift }, { scale: breatheScale }] }]}>

        {/* tail — curled ring, wags from its base */}
        <Animated.View style={[styles.tailWrap, { transform: [{ rotate: tailRotate }] }]}>
          <Svg width={70} height={70} viewBox="0 0 70 70">
            <Circle cx={35} cy={35} r={20} stroke={OUTLINE} strokeWidth={17} fill="none"
              strokeDasharray="88 40" strokeLinecap="round" transform="rotate(-30 35 35)" />
            <Circle cx={35} cy={35} r={20} stroke={MUSTARD_DEEP} strokeWidth={11} fill="none"
              strokeDasharray="86 42" strokeLinecap="round" transform="rotate(-30 35 35)" />
          </Svg>
        </Animated.View>

        {/* body — squat and low-slung */}
        <Svg width={276} height={168} viewBox="0 0 276 168" style={styles.body}>
          {/* back legs, tucked behind */}
          <Rect x={30} y={98} width={30} height={42} rx={11} fill={MUSTARD_SHADE} />
          <Rect x={216} y={98} width={30} height={42} rx={11} fill={MUSTARD_SHADE} />
          <Rect x={33} y={128} width={24} height={12} rx={6} fill={CREAM} />
          <Rect x={219} y={128} width={24} height={12} rx={6} fill={CREAM} />

          {/* torso */}
          <Rect x={14} y={26} width={248} height={94} rx={46} fill={MUSTARD} stroke={OUTLINE} strokeWidth={5} />
          {/* belly shade + soft back highlight */}
          <Path d="M26 96 Q138 132 250 96 L250 74 Q138 112 26 74 Z" fill={MUSTARD_SHADE} opacity={0.24} />
          {/* cream chest, tucked between the front legs */}
          <Path d="M104 58 Q138 48 172 58 Q182 84 172 108 Q138 122 104 108 Q94 84 104 58 Z" fill={CREAM} />

          {/* front legs with stripes, planted wide */}
          <Rect x={72} y={90} width={33} height={56} rx={13} fill={MUSTARD} stroke={OUTLINE} strokeWidth={4.5} />
          <Rect x={171} y={90} width={33} height={56} rx={13} fill={MUSTARD} stroke={OUTLINE} strokeWidth={4.5} />
          <Rect x={74.5} y={104} width={28} height={7} rx={3.5} fill={MUSTARD_SHADE} />
          <Rect x={74.5} y={116} width={28} height={7} rx={3.5} fill={MUSTARD_SHADE} />
          <Rect x={173.5} y={104} width={28} height={7} rx={3.5} fill={MUSTARD_SHADE} />
          <Rect x={173.5} y={116} width={28} height={7} rx={3.5} fill={MUSTARD_SHADE} />
          {/* cream paws */}
          <Path d="M74.5 130 h28 v4 a11 11 0 0 1 -11 11 h-6 a11 11 0 0 1 -11 -11 Z" fill={CREAM} />
          <Path d="M173.5 130 h28 v4 a11 11 0 0 1 -11 11 h-6 a11 11 0 0 1 -11 -11 Z" fill={CREAM} />
        </Svg>

        {/* collar — thick, with brass B tag */}
        <View style={styles.collar}>
          <View style={styles.collarStitch} />
          <View style={styles.tag}>
            <Text style={styles.tagText}>B</Text>
          </View>
        </View>

        {/* head — rectangular, deadpan, snaggletoothed */}
        <Animated.View style={[styles.headWrap, { transform: [{ rotate: headTilt }] }]}>
          <Svg width={224} height={176} viewBox="0 0 224 176">
            {/* ears: bent outward/downward (or perked) */}
            {perked ? (
              <>
                {/* perked: flaps lift up and out */}
                <Path d="M58 36 C40 20 20 8 16 20 C11 34 26 52 46 58 Z" fill={MUSTARD_DEEP} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
                <Path d="M166 36 C184 20 204 8 208 20 C213 34 198 52 178 58 Z" fill={MUSTARD_DEEP} stroke={OUTLINE} strokeWidth={4.5} strokeLinejoin="round" />
              </>
            ) : (
              <>
                {/* bent outward/downward: flaps anchored at the head's top
                    corners, folding out and hanging to cheek height */}
                <Rect x={28} y={24} width={44} height={68} rx={20} fill={MUSTARD_DEEP}
                  stroke={OUTLINE} strokeWidth={4.5} transform="rotate(36 50 30)" />
                <Rect x={152} y={24} width={44} height={68} rx={20} fill={MUSTARD_DEEP}
                  stroke={OUTLINE} strokeWidth={4.5} transform="rotate(-36 174 30)" />
                <Rect x={39} y={48} width={22} height={36} rx={11} fill={MUSTARD_SHADE}
                  transform="rotate(36 50 30)" opacity={0.8} />
                <Rect x={163} y={48} width={22} height={36} rx={11} fill={MUSTARD_SHADE}
                  transform="rotate(-36 174 30)" opacity={0.8} />
              </>
            )}

            {/* head block */}
            <Rect x={32} y={22} width={160} height={126} rx={30} fill={MUSTARD} stroke={OUTLINE} strokeWidth={5} />
            <Rect x={50} y={30} width={124} height={14} rx={7} fill="#FFFFFF" opacity={0.1} />
            <Path d="M40 120 Q112 148 184 120 L184 132 Q160 148 112 148 Q64 148 40 132 Z" fill={MUSTARD_SHADE} opacity={0.2} />

            {/* muzzle */}
            <Rect x={68} y={84} width={88} height={58} rx={21} fill={CREAM} stroke={OUTLINE} strokeWidth={3.5} />
            {/* freckles */}
            <Circle cx={82} cy={106} r={1.8} fill={OUTLINE} opacity={0.5} />
            <Circle cx={88} cy={112} r={1.8} fill={OUTLINE} opacity={0.5} />
            <Circle cx={140} cy={106} r={1.8} fill={OUTLINE} opacity={0.5} />
            <Circle cx={134} cy={112} r={1.8} fill={OUTLINE} opacity={0.5} />
            {/* big rounded-square nose */}
            <Rect x={93} y={88} width={38} height={27} rx={9} fill={NOSE} />
            <Circle cx={102} cy={95} r={3.4} fill="#FFFFFF" opacity={0.3} />
          </Svg>

          {/* eyes overlay — narrow + deadpan, drifts when looking around */}
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: lookShift }] }]}>
            <Svg width={224} height={176} viewBox="0 0 224 176">
              {eyes === 'open' && (
                <>
                  <Rect x={62} y={62} width={25} height={9} rx={4.5} fill={NOSE} />
                  <Rect x={135} y={62} width={29} height={9} rx={4.5} fill={NOSE} />
                </>
              )}
              {eyes === 'annoyed' && (
                <>
                  <Rect x={62} y={64} width={25} height={5.5} rx={2.7} fill={NOSE} />
                  <Rect x={135} y={64} width={29} height={5.5} rx={2.7} fill={NOSE} />
                  <Rect x={58} y={56} width={30} height={4} rx={2} fill={NOSE} transform="rotate(9 73 58)" opacity={0.85} />
                  <Rect x={134} y={56} width={30} height={4} rx={2} fill={NOSE} transform="rotate(-9 149 58)" opacity={0.85} />
                </>
              )}
              {eyes === 'closed' && (
                <>
                  <Path d="M62 66 Q74.5 73 87 66" stroke={NOSE} strokeWidth={4.5} fill="none" strokeLinecap="round" />
                  <Path d="M135 66 Q149.5 73 164 66" stroke={NOSE} strokeWidth={4.5} fill="none" strokeLinecap="round" />
                </>
              )}
            </Svg>
          </Animated.View>

          {/* mouth overlay — closed smirk + snaggletooth, or animated open jaw */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {talking ? (
              <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scaleY: mouthScale }] }]}>
                <Svg width={224} height={176} viewBox="0 0 224 176">
                  <Ellipse cx={112} cy={127} rx={15} ry={11.5} fill="#42302A" stroke={OUTLINE} strokeWidth={3} />
                  <Ellipse cx={112} cy={132} rx={8.5} ry={5.5} fill={TONGUE} />
                  <Rect x={119} y={114} width={8} height={10} rx={2.5} fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2} transform="rotate(7 123 119)" />
                </Svg>
              </Animated.View>
            ) : (
              <Svg width={224} height={176} viewBox="0 0 224 176">
                <Path d="M96 123 Q112 131 128 122" stroke={OUTLINE} strokeWidth={4} fill="none" strokeLinecap="round" />
                <Rect x={120} y={113} width={8} height={11} rx={2.5} fill="#FFFFFF" stroke={OUTLINE} strokeWidth={2} transform="rotate(7 124 118)" />
              </Svg>
            )}
          </View>
        </Animated.View>
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
  stage: { width: 300, height: 296, alignItems: 'center' },
  character: { width: 300, height: 296, alignItems: 'center' },

  tailWrap: { position: 'absolute', right: -4, top: 106, zIndex: 1 },
  body: { position: 'absolute', bottom: 0, zIndex: 2 },

  collar: {
    position: 'absolute',
    bottom: 128,
    width: 112,
    height: 21,
    backgroundColor: COLLAR,
    borderRadius: 9,
    zIndex: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collarStitch: {
    width: 92,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: '#6B594C',
  },
  tag: {
    position: 'absolute',
    bottom: -15,
    width: 25,
    height: 25,
    borderRadius: 12.5,
    backgroundColor: BRASS,
    borderWidth: 2.5,
    borderColor: BRASS_DARK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagText: { fontSize: 12, fontWeight: '900', color: '#6B4E14', lineHeight: 14 },

  headWrap: { position: 'absolute', top: 0, width: 224, height: 176, zIndex: 5 },

  zzzWrap: { position: 'absolute', top: -8, right: 26, flexDirection: 'row', alignItems: 'flex-end' },
  zzz: { color: '#A08F6F', fontWeight: '800' },
});
