/**
 * Stage props that temporarily enter Barkly's world.
 *
 * These sit next to the hero character, so they cannot be the flat leftovers
 * while the Store and Barkly look finished. Every temporary prop now uses the
 * same material recipe as the permanent toy dock: contact shadow, dark lower
 * edge, saturated body, one controlled highlight.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { CARE_DOCK_HEIGHT } from './layout';
import { BRASS, DIORAMA, ITEM } from './scenes/artPalette';

const BALL_ART = require('../../assets/world/item/toy_ball.png');
const DIG_MOUND = require('../../assets/world/park/props/dig_mound.png');
const SAND_MOUND = require('../../assets/world/beach/props/sand_mound.png');

/*
 * Widths, and the renders' OWN aspects -- never a typed height.
 *
 * MOUND_W/47 was the first version and it was wrong: the mound render is
 * 529x165, so drawing it 118x47 squashed it by 22%, and nothing caught that
 * because a typed height cannot be checked against anything. These are held
 * against the real files by __tests__/scene_surfaces.test.ts.
 */
const MOUND_W = 118;
const DIG_MOUND_ASPECT = 530 / 169;
const SAND_MOUND_ASPECT = 530 / 169;
const BALL_W = 50;
const BALL_ASPECT = 224 / 209;

/**
 * The spark that says the ground is being worked. It belonged to the drawn
 * mounds; the renders are objects and have no idea anything is happening to
 * them, so it moved out here and sits over either of them.
 */
function DigSparks() {
  return (
    <Svg width={112} height={24} viewBox="0 0 112 24" style={styles.digSparks} pointerEvents="none">
      <Path d="M23 21l-4-9M58 12V1M91 22l6-8" stroke={DIORAMA.goldLight} strokeWidth={3.2} strokeLinecap="round" />
    </Svg>
  );
}

function useSpringIn(): Animated.Value {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
  }, [v]);
  return v;
}

/**
 * THE BOWL EMPTIES WHEN HE EATS FROM IT, NOT WHEN IT IS PUT DOWN.
 *
 * These three timers used to start the moment the bowl mounted. But the bowl
 * is served immediately and Barkly does not enter the `eating` state until
 * his line has finished -- measured at ~3.6s later. So the food drained away
 * while he stood in the middle of the room, and by the time he actually ate
 * there was nothing left. Worse, the bowl was usually pulled before 4.2s, so
 * the emptier stages and the crumbs at the bottom -- all of which are drawn
 * below -- had almost certainly never been seen by anybody.
 */
export function FoodBowl({ food = 'dinner', eating = false }: { food?: string; eating?: boolean }) {
  const inV = useSpringIn();
  const [left, setLeft] = React.useState(3);
  React.useEffect(() => {
    if (!eating) return;
    // Aligned with the three head-dips in BarklyRoom: each bite takes a piece.
    const t1 = setTimeout(() => setLeft(2), 900);
    const t2 = setTimeout(() => setLeft(1), 1800);
    const t3 = setTimeout(() => setLeft(0), 2700);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [eating]);

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
      {/* The same ball the shop sells and the tray holds. */}
      <Image source={BALL_ART} style={styles.ballArt} resizeMode="contain" />
    </Animated.View>
  );
}

/**
 * THE DIG SITE IS A PROP NOW.
 *
 * It was a hard-edged half-disc with a flat brown crescent under it, a dark
 * oval and two eyebrow strokes -- which reads as a croissant, or a closed eye,
 * and it sat on the park screen the whole time you are there, next to a
 * rendered bench under a rendered tree. Modelled instead: spoil heaped in a
 * horseshoe with the open side toward you and a real pit in the middle, from
 * the same pack and the same light rig as everything else in the park.
 *
 * Same shape at the beach in wet sand, with ripples instead of clods.
 */
export function DigMound({ active = false }: { active?: boolean }) {
  return (
    <>
      <Image source={DIG_MOUND} style={styles.digMound} resizeMode="contain" />
      {active && <DigSparks />}
    </>
  );
}

/** Same material treatment for the beach's wet-sand search spot. */
export function WetSandMound({ active = false }: { active?: boolean }) {
  return (
    <>
      <Image source={SAND_MOUND} style={styles.sandMound} resizeMode="contain" />
      {active && <DigSparks />}
    </>
  );
}

const styles = StyleSheet.create({
  /* The sparks ride over the top of this. */
  // One shape per FILE. The two mounds come off the same builder and have
  // always measured the same, but a single MOUND_ASPECT could not be resolved
  // to a render by `npm run check:aspects` -- it matched both -- so it was the
  // one lock in the app nothing was checking.
  digMound: { width: MOUND_W, height: MOUND_W / DIG_MOUND_ASPECT },
  sandMound: { width: MOUND_W, height: MOUND_W / SAND_MOUND_ASPECT },
  digSparks: { position: 'absolute', top: -18, left: 3 },
  ballArt: { width: BALL_W, height: BALL_W / BALL_ASPECT },
  /*
   * ABOVE THE CARE RACK, AND WITHIN REACH.
   *
   * At `bottom: -2` the bowl sat on the stage floor -- which is BEHIND the
   * care dock, foreground scenery 68px tall that deliberately crosses his
   * paws. So the meal was served half-buried under the furniture, in the
   * bottom-left corner, a long way from a dog standing centre stage. Raised
   * clear of the rack and brought in towards him, so a child can see the dog,
   * the bowl and the gap between them close.
   */
  bowl: { position: 'absolute', bottom: CARE_DOCK_HEIGHT - 4, left: '31%', marginLeft: -66, zIndex: 9 },
  ball: { position: 'absolute', bottom: 16, left: 24, zIndex: 6 },
});
