/**
 * Stage props that temporarily enter Barkly's world.
 *
 * They use the same authored material language as the Store and care dock:
 * clean silhouette, solid shadow, one highlight and no system-art shortcuts.
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
      style={[styles.bowl, { opacity: inV, transform: [{ scale: inV.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }) }] }]}
      pointerEvents="none"
    >
      <Svg width={118} height={70} viewBox="0 0 118 70">
        <Ellipse cx={59} cy={62} rx={45} ry={6} fill={DIORAMA.shadow} opacity={0.22} />
        <Ellipse cx={59} cy={26} rx={49} ry={10} fill={BRASS.dark} />
        <Ellipse cx={59} cy={24} rx={42} ry={7.5} fill={BRASS.mid} />

        <G y={8}>
          {steak && left > 0 && (
            <>
              <Path d="M34 15 q12-11 30-7 q18 3 20 14 q-5 8-21 8 q-20 0-29-15Z" fill={ITEM.steak} opacity={left >= 2 ? 1 : 0.58} />
              <Path d="M41 14 q9-6 21-3" stroke={ITEM.steakFat} strokeWidth={4} fill="none" strokeLinecap="round" />
              {left >= 2 && <Path d="M24 2 l2 5 M95 4 l-2 5 M59-2 v5" stroke={DIORAMA.goldLight} strokeWidth={2.5} strokeLinecap="round" />}
            </>
          )}
          {cheese && left > 0 && (
            <>
              <Path d={left >= 2 ? 'M35 22 L84 22 L71 1 Z' : 'M45 22 L75 22 L67 8 Z'} fill={ITEM.cheese} />
              <Circle cx={61} cy={14} r={2.6} fill={ITEM.cheeseHole} />
              {left >= 2 && <Circle cx={69} cy={9} r={2} fill={ITEM.cheeseHole} />}
            </>
          )}
          {biscuit && left > 0 && (
            <>
              <Circle cx={49} cy={14} r={8.5} fill={ITEM.biscuit} />
              <Circle cx={49} cy={14} r={4.8} fill={ITEM.biscuitEdge} opacity={0.55} />
              {left >= 2 && <Circle cx={67} cy={12} r={7.8} fill={ITEM.biscuit} />}
              {left >= 3 && <Circle cx={59} cy={18} r={6.5} fill={ITEM.biscuitEdge} />}
            </>
          )}
          {!steak && !cheese && !biscuit && left > 0 && (
            <>
              <Circle cx={44} cy={16} r={7.5} fill={ITEM.stickLight} opacity={left >= 3 ? 1 : 0} />
              <Circle cx={59} cy={12} r={8} fill={ITEM.stick} opacity={left >= 2 ? 1 : 0} />
              <Circle cx={75} cy={16} r={7.5} fill={ITEM.stickLight} />
            </>
          )}
          {left === 0 && (
            <>
              <Circle cx={50} cy={17} r={1.8} fill={ITEM.stickLight} />
              <Circle cx={64} cy={14} r={1.5} fill={ITEM.stick} />
              <Circle cx={72} cy={18} r={1.2} fill={ITEM.stickLight} />
            </>
          )}
        </G>

        <Path d="M10 26 Q59 43 108 26 C108 48 91 64 59 64 C27 64 10 48 10 26Z" fill={BRASS.polished} />
        <Path d="M18 33 Q59 48 100 33" stroke={BRASS.light} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.8} />
        <Path d="M24 31 Q43 36 62 31" stroke={DIORAMA.white} strokeWidth={3.4} fill="none" strokeLinecap="round" opacity={0.45} />
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
    <Animated.View style={[styles.ball, { opacity: inV, transform: [{ translateY: lift }, { scaleY: squash }] }]} pointerEvents="none">
      <Svg width={46} height={46} viewBox="0 0 46 46">
        <Ellipse cx={23} cy={42} rx={15} ry={3} fill={DIORAMA.shadow} opacity={0.18} />
        <Circle cx={23} cy={22} r={20} fill={BALL.body} />
        <Path d="M3 19 C15 13 31 13 43 19" stroke={BALL.seam} strokeWidth={3.2} fill="none" />
        <Circle cx={15} cy={13} r={5.5} fill={BALL.gloss} opacity={0.42} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bowl: { position: 'absolute', bottom: 0, left: '16.66%', marginLeft: -59, zIndex: 9 },
  ball: { position: 'absolute', bottom: 16, left: 24, zIndex: 6 },
});
