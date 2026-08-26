/**
 * PLACEHOLDER Barkly renderer — drawn to match the approved concept sheet
 * (assets/barkly/concept/barkly-concept.png, "Barkley – Concept 3").
 *
 * Front view, standing. Key reads from the sheet: the head dominates the
 * body; long cream muzzle with a huge rounded-square charcoal nose; smug
 * half-lidded eyes; stiff bent ears angling outward; cream blaze; thick
 * belt-style collar with brass buckle and B tag; three-stripe knit socks
 * on the front paws; ring tail curl; low-slung body. Soft clay style —
 * no hard outlines, soft shading.
 *
 * Implements BarklyRenderProps (src/animation/renderer.ts). Production art
 * (Rive recommended) replaces this file; nothing else changes.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect, Text as SvgText } from 'react-native-svg';
import { BarklyRenderProps } from '../animation/renderer';
import { BodyAction } from '../barkly/types';

// Palette sampled from the concept sheet
const MUSTARD = '#C6952F';
const MUSTARD_EAR = '#AF7F22';
const MUSTARD_SHADE = '#9C7120';
const CREAM = '#F1E6CB';
const CREAM_SHADE = '#DECFA8';
const NOSE = '#3E332A';
const CHARCOAL = '#35302A';
const COLLAR = '#4B3527';
const COLLAR_DARK = '#3B2A1E';
const BRASS = '#B98F3E';
const BRASS_DARK = '#8F6B25';
const TONGUE = '#C9705F';

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

  const tailRotate = wag.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '18deg'] });
  const mouthScale = mouth.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
  const lift = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -16] });
  const breatheScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, asleep ? 1.03 : 1.012] });
  const headTilt = tilt.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-8deg'] });
  const lookShift = look.interpolate({
    inputRange: [0, 1],
    outputRange: has('LOOK_LEFT') && has('LOOK_RIGHT') ? [-6, 6] : has('LOOK_LEFT') ? [0, -7] : [0, 7],
  });

  // Pupils drift when he looks around; lids stay put (keeps the smug look).
  return (
    <View style={styles.stage}>
      <Animated.View style={[styles.character, { transform: [{ translateY: lift }, { scale: breatheScale }] }]}>

        {/* ring tail curl, peeking over the back (right side) */}
        <Animated.View style={[styles.tailWrap, { transform: [{ rotate: tailRotate }] }]}>
          <Svg width={64} height={64} viewBox="0 0 64 64">
            <Circle cx={32} cy={32} r={19} stroke={MUSTARD} strokeWidth={13}
              fill="none" strokeDasharray="90 30" strokeLinecap="round" transform="rotate(-55 32 32)" />
            <Circle cx={32} cy={32} r={19} stroke={MUSTARD_SHADE} strokeWidth={13} opacity={0.25}
              fill="none" strokeDasharray="30 90" strokeLinecap="round" transform="rotate(60 32 32)" />
          </Svg>
        </Animated.View>

        {/* body — standing, low-slung, narrower than the head */}
        <Svg width={250} height={158} viewBox="0 0 250 158" style={styles.body}>
          {/* rear feet peeking out */}
          <Rect x={30} y={122} width={40} height={26} rx={11} fill={CREAM_SHADE} />
          <Rect x={180} y={122} width={40} height={26} rx={11} fill={CREAM_SHADE} />

          {/* torso */}
          <Rect x={48} y={8} width={154} height={104} rx={38} fill={MUSTARD} />
          <Path d="M56 96 Q125 122 194 96 L194 76 Q125 104 56 76 Z" fill={MUSTARD_SHADE} opacity={0.18} />
          {/* cream chest/belly column */}
          <Rect x={89} y={20} width={72} height={92} rx={26} fill={CREAM} />

          {/* front legs: cream knit socks with three stripes */}
          <Rect x={64} y={54} width={40} height={80} rx={15} fill={CREAM} />
          <Rect x={146} y={54} width={40} height={80} rx={15} fill={CREAM} />
          <Path d="M68 60 a 15 15 0 0 1 10 -6 v 76 h -10 Z" fill={CREAM_SHADE} opacity={0.5} />
          <Path d="M150 60 a 15 15 0 0 1 10 -6 v 76 h -10 Z" fill={CREAM_SHADE} opacity={0.5} />
          {[92, 103, 114].map((y) => (
            <React.Fragment key={y}>
              <Rect x={64} y={y} width={40} height={6.5} fill={CHARCOAL} />
              <Rect x={146} y={y} width={40} height={6.5} fill={CHARCOAL} />
            </React.Fragment>
          ))}

          {/* front feet with toe grooves */}
          <Rect x={58} y={126} width={52} height={28} rx={12} fill={CREAM} />
          <Rect x={140} y={126} width={52} height={28} rx={12} fill={CREAM} />
          <Path d="M76 140 v11" stroke={CREAM_SHADE} strokeWidth={3.5} strokeLinecap="round" />
          <Path d="M92 140 v11" stroke={CREAM_SHADE} strokeWidth={3.5} strokeLinecap="round" />
          <Path d="M158 140 v11" stroke={CREAM_SHADE} strokeWidth={3.5} strokeLinecap="round" />
          <Path d="M174 140 v11" stroke={CREAM_SHADE} strokeWidth={3.5} strokeLinecap="round" />
        </Svg>

        {/* thick belt collar with brass buckle + B tag */}
        <Svg width={180} height={92} viewBox="0 0 180 92" style={styles.collar}>
          <Rect x={8} y={10} width={164} height={28} rx={11} fill={COLLAR} />
          <Rect x={8} y={10} width={164} height={9} rx={4.5} fill="#5C4433" opacity={0.8} />
          {/* strap end tucked through */}
          <Rect x={98} y={16} width={44} height={17} rx={8} fill={COLLAR_DARK} />
          {/* buckle */}
          <Rect x={58} y={4} width={36} height={40} rx={8} fill="none" stroke={BRASS} strokeWidth={7} />
          <Rect x={73} y={8} width={5} height={22} rx={2.5} fill={BRASS_DARK} />
          {/* tag on its ring */}
          <Circle cx={90} cy={46} r={5} stroke={BRASS_DARK} strokeWidth={3} fill="none" />
          <Circle cx={90} cy={66} r={18} fill={BRASS} />
          <Circle cx={90} cy={66} r={18} stroke={BRASS_DARK} strokeWidth={2.5} fill="none" />
          <SvgText x={90} y={73} fontSize={19} fontWeight="bold" fill={COLLAR_DARK} textAnchor="middle">B</SvgText>
        </Svg>

        {/* head — the dominant mass */}
        <Animated.View style={[styles.headWrap, { transform: [{ rotate: headTilt }] }]}>
          <Svg width={240} height={196} viewBox="0 0 240 196">
            {/* stiff bent ears, angling outward */}
            {perked ? (
              <>
                <Path d="M70 42 L34 -2 L6 30 L52 68 Z" fill={MUSTARD_EAR} stroke={MUSTARD_EAR} strokeWidth={10} strokeLinejoin="round" />
                <Path d="M170 42 L206 -2 L234 30 L188 68 Z" fill={MUSTARD_EAR} stroke={MUSTARD_EAR} strokeWidth={10} strokeLinejoin="round" />
              </>
            ) : (
              <>
                <Path d="M74 46 L26 10 L8 52 L52 74 Z" fill={MUSTARD_EAR} stroke={MUSTARD_EAR} strokeWidth={10} strokeLinejoin="round" />
                <Path d="M166 46 L214 10 L232 52 L188 74 Z" fill={MUSTARD_EAR} stroke={MUSTARD_EAR} strokeWidth={10} strokeLinejoin="round" />
                {/* folded tips */}
                <Path d="M26 12 L8 52 L24 60 Z" fill={MUSTARD_SHADE} opacity={0.45} />
                <Path d="M214 12 L232 52 L216 60 Z" fill={MUSTARD_SHADE} opacity={0.45} />
              </>
            )}

            {/* rectangular head block */}
            <Rect x={40} y={30} width={160} height={152} rx={26} fill={MUSTARD} />
            <Rect x={40} y={30} width={160} height={30} rx={15} fill="#FFFFFF" opacity={0.07} />

            {/* cream blaze widening into the long, broad muzzle */}
            <Path d="M103 30 L137 30 L139 82 C158 86 170 100 170 124 C170 158 152 178 120 178 C88 178 70 158 70 124 C70 100 82 86 101 82 Z" fill={CREAM} />
            <Path d="M76 132 C76 160 92 174 120 174 C148 174 164 160 164 132 L164 142 C164 166 148 178 120 178 C92 178 76 166 76 142 Z" fill={CREAM_SHADE} opacity={0.5} />

            {/* huge rounded-square nose */}
            <Rect x={90} y={92} width={60} height={44} rx={14} fill={NOSE} />
            <Rect x={96} y={96} width={48} height={11} rx={5.5} fill="#FFFFFF" opacity={0.09} />

            {/* head-side shading */}
            <Path d="M40 120 C40 156 52 176 74 180 L60 182 C46 174 40 152 40 132 Z" fill={MUSTARD_SHADE} opacity={0.25} />
          </Svg>

          {/* eyes overlay — solid dark pills that drift on look, under
              static mustard lids (the lids are what keep him smug) */}
          {eyes !== 'closed' && (
            <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: lookShift }] }]} pointerEvents="none">
              <Svg width={240} height={196} viewBox="0 0 240 196">
                <Rect x={54} y={52} width={40} height={26} rx={13} fill={NOSE} />
                <Rect x={146} y={52} width={40} height={26} rx={13} fill={NOSE} />
              </Svg>
            </Animated.View>
          )}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width={240} height={196} viewBox="0 0 240 196">
              {eyes !== 'closed' && (
                <>
                  {/* heavy upper lids, tilted down-outward = smug (deeper when annoyed) */}
                  <Rect x={46} y={eyes === 'annoyed' ? 46 : 38} width={56} height={20} rx={4}
                    fill={MUSTARD} transform="rotate(-7 74 52)" />
                  <Rect x={138} y={eyes === 'annoyed' ? 46 : 38} width={56} height={20} rx={4}
                    fill={MUSTARD} transform="rotate(7 166 52)" />
                  {/* lid crease */}
                  <Path d="M54 60 L94 55" stroke={MUSTARD_SHADE} strokeWidth={3} strokeLinecap="round" opacity={0.55} />
                  <Path d="M146 55 L186 60" stroke={MUSTARD_SHADE} strokeWidth={3} strokeLinecap="round" opacity={0.55} />
                </>
              )}
              {eyes === 'closed' && (
                <>
                  <Path d="M58 68 Q74 76 90 68" stroke={NOSE} strokeWidth={4.5} fill="none" strokeLinecap="round" />
                  <Path d="M150 68 Q166 76 182 68" stroke={NOSE} strokeWidth={4.5} fill="none" strokeLinecap="round" />
                </>
              )}
            </Svg>
          </View>

          {/* mouth overlay — clay crease + tiny snaggletooth, or open jaw */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            {talking ? (
              <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scaleY: mouthScale }] }]}>
                <Svg width={240} height={196} viewBox="0 0 240 196">
                  <Ellipse cx={120} cy={153} rx={14} ry={10} fill="#4A362C" />
                  <Ellipse cx={120} cy={157} rx={8} ry={4.5} fill={TONGUE} />
                  <Rect x={128} y={144} width={7} height={10} rx={2.5} fill="#FFFFFF" transform="rotate(5 131 149)" />
                </Svg>
              </Animated.View>
            ) : (
              <Svg width={240} height={196} viewBox="0 0 240 196">
                <Path d="M102 148 Q120 157 138 147" stroke={NOSE} strokeWidth={3.5} fill="none"
                  strokeLinecap="round" opacity={0.65} />
                <Rect x={127} y={147} width={7} height={11} rx={2.5} fill="#FFFFFF" transform="rotate(5 130 152)" />
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
  stage: { width: 300, height: 322, alignItems: 'center' },
  character: { width: 300, height: 322, alignItems: 'center' },

  tailWrap: { position: 'absolute', right: 26, top: 132, zIndex: 1 },
  body: { position: 'absolute', bottom: 0, zIndex: 2 },
  collar: { position: 'absolute', bottom: 62, zIndex: 4, alignSelf: 'center' },
  headWrap: { position: 'absolute', top: 0, width: 240, height: 196, zIndex: 5 },

  zzzWrap: { position: 'absolute', top: -8, right: 22, flexDirection: 'row', alignItems: 'flex-end' },
  zzz: { color: '#A08F6F', fontWeight: '800' },
});
