/**
 * Stage props — small scene objects that appear for specific states:
 * a food bowl while eating, a bouncing ball while playing. Each springs in
 * on appear. Palette matches the concept sheet.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

function useSpringIn(): Animated.Value {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
  }, [v]);
  return v;
}

/**
 * What he is actually eating, being actually eaten.
 *
 * There was one bowl of generic kibble for every food — buy the "completely
 * unreasonable steak", tap it, and watch him eat the same brown pellets as
 * dinner. The food you chose is the food in the bowl now, and it GOES DOWN in
 * bites while he eats, because food that stays full while a dog chews over it
 * is a prop, not a meal. Steak gets sparkles; it is a birthday-level event and
 * the screen should agree.
 */
export function FoodBowl({ food = 'dinner' }: { food?: string }) {
  const inV = useSpringIn();
  // Three helpings -> two -> one -> gone, on a chew rhythm. Local to the prop:
  // it starts when the bowl appears, which is when he starts eating.
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
        { opacity: inV, transform: [{ scale: inV.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] },
      ]}
      pointerEvents="none"
    >
      <Svg width={104} height={58} viewBox="0 0 104 58">
        {/*
          Paint order is the whole trick: back rim, then interior, then the
          FOOD, then the bowl's front wall over the food's base. The first
          version painted the food first and the whole bowl after it, which
          hid every meal behind the rim — "visible feeding" with nothing
          visible.
        */}
        <Ellipse cx={52} cy={22} rx={44} ry={8} fill="#4A403A" />
        <Ellipse cx={52} cy={21.5} rx={37} ry={6} fill="#2A241F" />
        {/* the food, by what it IS, thinning as it goes */}
        <G y={9}>
          {steak && left > 0 && (
            <>
              <Path d="M30 10 q10 -9 26 -6 q16 3 18 12 q-4 6 -18 6 q-18 0 -26 -12 Z" fill="#B5584B" opacity={left >= 2 ? 1 : 0.55} />
              <Path d="M36 9 q8 -5 18 -3" stroke="#EBD9C4" strokeWidth={3.5} fill="none" strokeLinecap="round" />
              {left >= 2 && <Path d="M20 -2 l2 4 M84 0 l-2 4 M52 -6 l0 4" stroke="#F2D488" strokeWidth={2.4} strokeLinecap="round" />}
            </>
          )}
          {cheese && left > 0 && (
            <>
              <Path d={left >= 2 ? 'M30 16 L74 16 L63 -2 Z' : 'M40 16 L66 16 L59 4 Z'} fill="#E8C255" />
              <Circle cx={54} cy={10} r={2.4} fill="#C9A032" />
              {left >= 2 && <Circle cx={61} cy={6} r={1.8} fill="#C9A032" />}
            </>
          )}
          {biscuit && left > 0 && (
            <>
              <Circle cx={44} cy={9} r={7.5} fill="#EADCB6" />
              <Circle cx={44} cy={9} r={4.2} fill="#CBB68C" opacity={0.6} />
              {left >= 2 && <Circle cx={60} cy={7} r={6.8} fill="#EADCB6" />}
              {left >= 3 && <Circle cx={53} cy={12} r={5.8} fill="#CBB68C" />}
            </>
          )}
          {!steak && !cheese && !biscuit && left > 0 && (
            <>
              <Circle cx={38} cy={10} r={6.5} fill="#8A6B3A" opacity={left >= 3 ? 1 : 0} />
              <Circle cx={52} cy={7} r={7} fill="#9C7A42" opacity={left >= 2 ? 1 : 0} />
              <Circle cx={66} cy={10} r={6.5} fill="#8A6B3A" />
            </>
          )}
          {/* crumbs where the food was: eaten, not vanished */}
          {left === 0 && (
            <>
              <Circle cx={44} cy={12} r={1.8} fill="#9C7A42" />
              <Circle cx={57} cy={10} r={1.4} fill="#8A6B3A" />
              <Circle cx={64} cy={13} r={1.2} fill="#9C7A42" />
            </>
          )}
        </G>
        {/* front wall, whose top edge follows the rim's near arc */}
        <Path d="M8 22 Q52 36 96 22 C96 42 82 56 52 56 C22 56 8 42 8 22 Z" fill="#3A322C" />
        <Path d="M14 28 C18 40 30 48 46 50" stroke="#5C5049" strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.7} />
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
  /**
   * The meal lands ON his feed slot — the kit's little bowl, front-left of
   * his paws, exactly where his eyes go (attention's bowl target is
   * down-left). The first placement centred it at bottom 42, which hung a
   * black disc over his shins like it was strapped to his chest. Left slot
   * centre is 1/6 of the shelf width (three space-around slots), so this
   * stays put on any screen. zIndex 9 sits it over the kit (8): the meal
   * replaces the empty bowl icon for as long as he is eating.
   */
  bowl: { position: 'absolute', bottom: 3, left: '16.66%', marginLeft: -52, zIndex: 9 },
  ball: { position: 'absolute', bottom: 16, left: 24, zIndex: 6 },
});
