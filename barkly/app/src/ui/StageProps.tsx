/**
 * Stage props — small scene objects that appear for specific states:
 * a food bowl while eating, a bouncing ball while playing. Each springs in
 * on appear. Palette matches the concept sheet.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

function useSpringIn(): Animated.Value {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
  }, [v]);
  return v;
}

export function FoodBowl() {
  const inV = useSpringIn();
  return (
    <Animated.View
      style={[
        styles.bowl,
        { opacity: inV, transform: [{ scale: inV.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] },
      ]}
      pointerEvents="none"
    >
      <Svg width={104} height={46} viewBox="0 0 104 46">
        {/* kibble peeking over the rim */}
        <Circle cx={38} cy={12} r={6.5} fill="#8A6B3A" />
        <Circle cx={52} cy={9} r={7} fill="#9C7A42" />
        <Circle cx={66} cy={12} r={6.5} fill="#8A6B3A" />
        {/* bowl body */}
        <Path d="M8 14 L96 14 C96 34 82 44 52 44 C22 44 8 34 8 14 Z" fill="#3A322C" />
        <Ellipse cx={52} cy={14} rx={44} ry={8} fill="#4A403A" />
        <Ellipse cx={52} cy={13} rx={36} ry={5.5} fill="#2A241F" />
        {/* rim highlight */}
        <Path d="M14 18 C18 30 30 38 46 40" stroke="#5C5049" strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.7} />
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
  const lift = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -46] });
  const squash = bounce.interpolate({ inputRange: [0, 0.12, 1], outputRange: [1, 0.85, 1.05] });
  return (
    <Animated.View
      style={[
        styles.ball,
        {
          opacity: inV,
          transform: [{ translateY: lift }, { scaleY: squash }],
        },
      ]}
      pointerEvents="none"
    >
      <Svg width={40} height={40} viewBox="0 0 40 40">
        <Circle cx={20} cy={20} r={18} fill="#B3402E" />
        <Path d="M2.5 17 C14 12 26 12 37.5 17" stroke="#8E2F20" strokeWidth={3} fill="none" />
        <Circle cx={13} cy={12} r={5} fill="#FFFFFF" opacity={0.35} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bowl: { position: 'absolute', bottom: 42, alignSelf: 'center', marginLeft: 4, zIndex: 6 },
  ball: { position: 'absolute', bottom: 16, left: 24, zIndex: 6 },
});
