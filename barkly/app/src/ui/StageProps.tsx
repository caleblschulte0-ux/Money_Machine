/**
 * Stage props that temporarily enter Barkly's world.
 *
 * These sit next to the hero character, so they cannot be the flat leftovers
 * while the Store and Barkly look finished. Every temporary prop now uses the
 * same material recipe as the permanent toy dock: contact shadow, dark lower
 * edge, saturated body, one controlled highlight.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { BALL, BRASS, DIORAMA, DIRT, ITEM, SAND } from './scenes/artPalette';

function useSpringIn(): Animated.Value {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
  }, [v]);
  return v;
}

export function FoodBowl({ food = 'dinner' }: { food?: string }) {
  const inV = useSpringIn();
  const [left, setLeft] = React.useState(3);
  React.useEffect(() => {
    const t1 = setTimeout(() => setLeft(2), 1400);
    const t2 = setTimeout(() => setLeft(1), 2800);
    const t3 = setTimeout(() => setLeft(0), 4200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const steak = food === 'treat_steak';
  const cheese = food === 'treat_cheese';
  const biscuit = food === 'treat_biscuit';

  return (
    <Animated.View
      style={[
        styles.bowl,
        {
          opacity: inV,
          transform: [
            { translateY: inV.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
            { scale: inV.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }) },
          ],
        },
      ]}
      pointerEvents="none"
    >
      <Svg width={132} height={80} viewBox="0 0 132 80">
        <Ellipse cx={66} cy={72} rx={51} ry={7} fill={DIORAMA.shadow} opacity={0.14} />
        <Ellipse cx={66} cy={70} rx={37} ry={4} fill={DIORAMA.shadow} opacity={0.24} />
        <Ellipse cx={66} cy={29} rx={55} ry={12} fill={BRASS.edge} />
        <Ellipse cx={66} cy={25} rx={50} ry={10} fill={BRASS.mid} />

        <G y={9}>
          {steak && left > 0 && (
            <>
              <Path d="M37 17 q13-12 33-8 q20 3 22 15 q-6 9-23 9 q-22 0-32-16Z" fill={ITEM.steakEdge} opacity={left >= 2 ? 1 : 0.6} />
              <Path d="M37 14 q13-11 33-7 q20 3 22 14 q-6 8-23 8 q-22 0-32-15Z" fill={ITEM.steak} opacity={left >= 2 ? 1 : 0.62} />
              <Path d="M45 13 q10-6 23-3" stroke={ITEM.steakFat} strokeWidth={4.5} fill="none" strokeLinecap="round" />
              {left >= 2 && <Path d="M27 2 l2 6 M105 4 l-2 6 M66-2 v6" stroke={DIORAMA.goldLight} strokeWidth={2.8} strokeLinecap="round" />}
            </>
          )}
          {cheese && left > 0 && (
            <>
              <Path d={left >= 2 ? 'M38 25 L93 25 L78 2 Z' : 'M50 25 L84 25 L75 9 Z'} fill={ITEM.cheeseEdge} />
              <Path d={left >= 2 ? 'M39 21 L92 21 L78 1 Z' : 'M51 21 L83 21 L75 8 Z'} fill={ITEM.cheese} />
              <Circle cx={67} cy={13} r={2.8} fill={ITEM.cheeseHole} />
              {left >= 2 && <Circle cx={76} cy={8} r={2.2} fill={ITEM.cheeseHole} />}
              <Path d="M49 15 L75 7" stroke={DIORAMA.white} strokeWidth={3} opacity={0.32} strokeLinecap="round" />
            </>
          )}
          {biscuit && left > 0 && (
            <>
              <Circle cx={54} cy={17} r={9.5} fill={ITEM.biscuitEdge} />
              <Circle cx={54} cy={14.5} r={8.8} fill={ITEM.biscuit} />
              {left >= 2 && <Circle cx={75} cy={14} r={8.8} fill={ITEM.biscuit} />}
              {left >= 3 && <Circle cx={66} cy={21} r={7.3} fill={ITEM.biscuitEdge} />}
              <Path d="M49 10 q5-3 10 0" stroke={DIORAMA.white} strokeWidth={2.5} opacity={0.36} strokeLinecap="round" />
            </>
          )}
          {!steak && !cheese && !biscuit && left > 0 && (
            <>
              <Circle cx={49} cy={18} r={8.4} fill={ITEM.stickLight} opacity={left >= 3 ? 1 : 0} />
              <Circle cx={66} cy={14} r={9} fill={ITEM.stick} opacity={left >= 2 ? 1 : 0} />
              <Circle cx={84} cy={18} r={8.4} fill={ITEM.stickLight} />
              <Circle cx={63} cy={10} r={3} fill={DIORAMA.white} opacity={0.16} />
            </>
          )}
          {left === 0 && (
            <>
              <Circle cx={56} cy={20} r={2} fill={ITEM.stickLight} />
              <Circle cx={70} cy={17} r={1.7} fill={ITEM.stick} />
              <Circle cx={80} cy={21} r={1.4} fill={ITEM.stickLight} />
            </>
          )}
        </G>

        <Path d="M11 30 Q66 49 121 30 C121 56 101 73 66 73 C31 73 11 56 11 30Z" fill={BRASS.edge} />
        <Path d="M13 27 Q66 45 119 27 C118 51 99 68 66 68 C33 68 14 51 13 27Z" fill={BRASS.polished} />
        <Path d="M22 37 Q66 53 110 37" stroke={BRASS.dark} strokeWidth={3.4} fill="none" strokeLinecap="round" opacity={0.48} />
        <Path d="M20 31 Q66 43 112 31" stroke={BRASS.light} strokeWidth={5.5} fill="none" strokeLinecap="round" opacity={0.88} />
        <Path d="M28 29 Q49 35 70 29" stroke={DIORAMA.white} strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.55} />
      </Svg>
    </Animated.View>
  );
}

export function Ball() {
  const inV = useSpringIn();
  const bounce = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 320, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bounce]);
  const lift = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -48] });
  const squash = bounce.interpolate({ inputRange: [0, 0.12, 1], outputRange: [1, 0.84, 1.06] });
  return (
    <Animated.View style={[styles.ball, { opacity: inV, transform: [{ translateY: lift }, { scaleY: squash }] }]} pointerEvents="none">
      <Svg width={50} height={52} viewBox="0 0 50 52">
        <Ellipse cx={25} cy={48} rx={17} ry={3.5} fill={DIORAMA.shadow} opacity={0.2} />
        <Circle cx={25} cy={27} r={22} fill={BALL.edge} />
        <Circle cx={25} cy={24} r={21} fill={BALL.body} />
        <Path d="M4 21 C16 14 34 14 46 21" stroke={BALL.seam} strokeWidth={3.5} fill="none" />
        <Circle cx={16} cy={14} r={6} fill={BALL.gloss} opacity={0.5} />
        <Circle cx={14.5} cy={12.5} r={2.3} fill={BALL.gloss} opacity={0.82} />
      </Svg>
    </Animated.View>
  );
}

/**
 * Premium interaction mound for the park. This intentionally does not render
 * text or UI chrome: it is a physical piece of the world that the interaction
 * control can sit on top of later.
 */
export function DigMound({ active = false }: { active?: boolean }) {
  return (
    <Svg width={112} height={68} viewBox="0 0 112 68">
      <Ellipse cx={56} cy={60} rx={49} ry={7} fill={DIORAMA.shadow} opacity={0.18} />
      <Path d="M8 56Q21 25 49 20Q79 15 104 55Q82 66 56 65Q29 66 8 56Z" fill={DIRT.edge} />
      <Path d="M10 50Q24 19 50 15Q79 10 102 50Q79 60 56 59Q31 60 10 50Z" fill={DIRT.mound} />
      <Path d="M19 44Q34 23 51 22Q72 18 91 43" stroke={DIRT.light} strokeWidth={7} fill="none" strokeLinecap="round" opacity={0.72} />
      <Ellipse cx={57} cy={47} rx={17} ry={9} fill={DIRT.hole} />
      <Ellipse cx={57} cy={43} rx={13} ry={5} fill={DIORAMA.shadow} opacity={0.28} />
      <Path d="M24 51Q31 47 38 51M78 49Q85 44 91 49" stroke={DIRT.shade} strokeWidth={4} fill="none" strokeLinecap="round" />
      {active && <Path d="M23 19l-4-8M58 10V2M91 20l6-7" stroke={DIORAMA.goldLight} strokeWidth={3.2} strokeLinecap="round" />}
    </Svg>
  );
}

/** Same material treatment for the beach's wet-sand search spot. */
export function WetSandMound({ active = false }: { active?: boolean }) {
  return (
    <Svg width={112} height={66} viewBox="0 0 112 66">
      <Ellipse cx={56} cy={59} rx={50} ry={7} fill={DIORAMA.shadow} opacity={0.15} />
      <Path d="M7 54Q26 26 55 20Q85 18 105 54Q82 65 56 64Q29 65 7 54Z" fill={SAND.edge} />
      <Path d="M9 48Q28 20 56 15Q84 14 103 48Q80 59 56 58Q31 59 9 48Z" fill={SAND.mound} />
      <Path d="M20 40Q39 23 63 22Q80 21 93 38" stroke={SAND.light} strokeWidth={7} fill="none" strokeLinecap="round" opacity={0.78} />
      <Path d="M28 50Q38 42 47 49Q57 41 67 49Q78 42 87 49" stroke={SAND.ripple} strokeWidth={3.5} fill="none" strokeLinecap="round" />
      <Circle cx={44} cy={33} r={3} fill={DIORAMA.white} opacity={0.36} />
      {active && <Path d="M25 16l-4-8M58 9V1M88 17l6-7" stroke={DIORAMA.goldLight} strokeWidth={3.2} strokeLinecap="round" />}
    </Svg>
  );
}

const styles = StyleSheet.create({
  bowl: { position: 'absolute', bottom: -2, left: '16.66%', marginLeft: -66, zIndex: 9 },
  ball: { position: 'absolute', bottom: 16, left: 24, zIndex: 6 },
});
