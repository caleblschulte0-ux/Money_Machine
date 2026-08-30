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
import { BALL, BRASS, DIORAMA, ITEM } from './scenes/artPalette';

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

const styles = StyleSheet.create({
  bowl: { position: 'absolute', bottom: -2, left: '16.66%', marginLeft: -66, zIndex: 9 },
  ball: { position: 'absolute', bottom: 16, left: 24, zIndex: 6 },
});