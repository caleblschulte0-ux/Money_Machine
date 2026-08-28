/**
 * His stuff, on the floor in front of him — and the reason there is no longer
 * a PLAY | FEED | SLEEP row.
 *
 * The old main screen ended in three identical pills. They worked, and they
 * made the whole app feel like a control panel bolted to a dog: you were not
 * playing with him, you were operating him. A button row is also the most
 * generic thing a screen can end with — every app has one, so it tells you
 * nothing about this one.
 *
 * These are the same three verbs as objects that exist in the world. You feed
 * him by tapping HIS BOWL. You play by picking up HIS TOY. You put him to bed
 * by tapping HIS BED. They sit nearer the camera than he does, which is also
 * the foreground layer the scenes never had.
 *
 * Two things that are not negotiable, and are why this is a component rather
 * than three inline Pressables:
 *
 *   THEY ARE STILL CONTROLS. Every one carries a role, a label and a hint, and
 *   measures at least 44x44 — scripts/a11y-check.mjs holds that. "Direct
 *   manipulation" must not mean "invisible to a screen reader", which is the
 *   usual way this trade goes wrong.
 *
 *   THEY SAY WHAT THEY ARE. A child needs to know the bowl is tappable, so
 *   each one carries a small word underneath in the same in-world label style
 *   the dogs' names use, and lifts slightly when it is the useful thing to do
 *   (he is hungry; he is tired). Discoverability was the button row's one real
 *   advantage and it is not worth giving up.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { color, radius, space, type } from './theme';
import { TAP_MIN } from './layout';
import { BALL, BRASS, ITEM } from './scenes/artPalette';

export type KitAction = 'feed' | 'play' | 'sleep';

interface Props {
  /** Which toy he owns, so the play object IS the thing you bought. */
  toyId: string | null;
  /** The word under the play object — "fetch", "tug", "waves". */
  playLabel: string;
  asleep: boolean;
  /** He would like something. The matching object lifts and brightens. */
  wants: KitAction | null;
  disabled: boolean;
  onPress(action: KitAction): void;
}

/** A slow lift, so "he wants this" reads without a badge or a colour alone. */
function useNudge(active: boolean) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      Animated.timing(v, { toValue: 0, duration: 220, useNativeDriver: true }).start();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 780, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 780, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, v]);
  return v.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });
}

function Bowl() {
  return (
    <Svg width={52} height={40} viewBox="0 0 52 40">
      <Circle cx={19} cy={13} r={4.4} fill={ITEM.biscuitEdge} />
      <Circle cx={30} cy={11} r={3.6} fill={ITEM.biscuit} />
      <Circle cx={25} cy={15} r={4} fill={ITEM.biscuitEdge} />
      <Ellipse cx={26} cy={19} rx={19} ry={5.6} fill={BRASS.shade} />
      <Path d="M7 19 a19 5.6 0 0 0 38 0 l -4.4 12.6 a15 4.6 0 0 1 -29.2 0 Z" fill={BRASS.mid} />
      <Path d="M11 22 a15 4 0 0 0 30 0 l -1.4 4 a14 4 0 0 1 -27.2 0 Z" fill={BRASS.pale} opacity={0.6} />
    </Svg>
  );
}

function KitBall() {
  return (
    <Svg width={44} height={44} viewBox="0 0 44 44">
      <Circle cx={22} cy={23} r={17} fill={BALL.body} />
      <Path d="M5 20 C13 12 31 12 39 20" stroke={BALL.seam} strokeWidth={3} fill="none" />
      <Circle cx={15} cy={15} r={4.6} fill={BALL.gloss} opacity={0.34} />
    </Svg>
  );
}

function KitRope() {
  return (
    <Svg width={52} height={30} viewBox="0 0 52 30">
      <Path d="M9 15 q8 -8 17 0 q8 8 17 0" stroke={ITEM.rope} strokeWidth={11} strokeLinecap="round" fill="none" />
      <Path d="M9 15 q8 -8 17 0 q8 8 17 0" stroke={ITEM.ropeShade} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.55} />
      <Path d="M6 15 l -3 -6 M6 15 l -3 6 M46 15 l 3 -6 M46 15 l 3 6" stroke={ITEM.ropeShade} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

/** Nothing bought yet: a stick, which every dog already owns. */
function KitStick() {
  // Bark brown, not `ropeShade` — the first version was the same value as the
  // floor it lies on, so the middle of the shelf read as empty.
  return (
    <Svg width={54} height={30} viewBox="0 0 54 30">
      <Path d="M5 19 q13 -8 25 -4 q11 4 19 -3" stroke={ITEM.stick} strokeWidth={9} strokeLinecap="round" fill="none" />
      <Path d="M5 19 q13 -8 25 -4 q11 4 19 -3" stroke={ITEM.stickLight} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.7} />
      <Path d="M19 14 l -6 -6 M36 15 l 6 -7" stroke={ITEM.stick} strokeWidth={5.5} strokeLinecap="round" />
    </Svg>
  );
}

function KitBed({ asleep }: { asleep: boolean }) {
  // A bowl-shaped bed seen from the front: a deep back wall, a cushion, and a
  // near rim in front of it. The first version was three flat ellipses and
  // read as a plate.
  return (
    <Svg width={56} height={40} viewBox="0 0 56 40">
      <Path d="M6 24 a22 12 0 0 1 44 0 v-6 a22 12 0 0 0 -44 0 Z" fill={ITEM.bedRim} />
      <Ellipse cx={28} cy={18} rx={22} ry={11} fill={ITEM.bed} />
      <Ellipse cx={28} cy={21} rx={17} ry={7.5} fill={ITEM.bedCushion} />
      <Path d="M6 22 a22 11 0 0 0 44 0 l -1 6 a22 11 0 0 1 -42 0 Z" fill={ITEM.bedRim} />
      {asleep && (
        <>
          <Path d="M38 11 h7 l-7 7 h7" stroke={ITEM.bed} strokeWidth={2.2} fill="none" strokeLinecap="round" />
          <Path d="M47 4 h4 l-4 4 h4" stroke={ITEM.bed} strokeWidth={1.6} fill="none" strokeLinecap="round" />
        </>
      )}
    </Svg>
  );
}

function KitObject({
  action,
  label,
  hint,
  wanted,
  disabled,
  onPress,
  children,
}: {
  action: KitAction;
  label: string;
  hint: string;
  wanted: boolean;
  disabled: boolean;
  onPress(a: KitAction): void;
  children: React.ReactNode;
}) {
  const lift = useNudge(wanted && !disabled);
  const press = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPressIn={() => Animated.spring(press, { toValue: 0.9, friction: 5, tension: 320, useNativeDriver: true }).start()}
      onPressOut={() => Animated.spring(press, { toValue: 1, friction: 5, tension: 320, useNativeDriver: true }).start()}
      onPress={() => onPress(action)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      testID={`kit-${action}`}
      style={[styles.slot, disabled && styles.slotOff]}
    >
      <Animated.View style={[styles.art, { transform: [{ translateY: lift }, { scale: press }] }]}>
        {children}
      </Animated.View>
      {/* Drawn AFTER, under the art, so each thing sits on the floor rather
          than hovering over it — the same fix the other dogs needed. */}
      <View style={styles.contact} pointerEvents="none" />
      {/*
        The word appears when he WANTS this, not permanently.
        
        Three always-on captions under three recognisable objects is the
        button row growing back with pictures on it. A child knows a food
        bowl; what a child does not know is which one to reach for right now,
        and that is exactly when the word shows up. Screen readers get the
        label unconditionally, from accessibilityLabel above.
      */}
      {wanted && !disabled && (
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export default function BarklyKit({ toyId, playLabel, asleep, wants, disabled, onPress }: Props) {
  return (
    <View style={styles.kit}>
      <KitObject
        action="feed"
        label="food"
        hint="His bowl. Tap it to choose what he eats."
        wanted={wants === 'feed'}
        disabled={disabled}
        onPress={onPress}
      >
        <Bowl />
      </KitObject>

      <KitObject
        action="play"
        label={playLabel}
        hint={
          toyId === 'toy_rope'
            ? 'His rope. Take one end — he will not let go.'
            : toyId === 'toy_ball'
              ? 'His ball. Throw it and he will bring it back. Probably.'
              : 'Whatever he can find. It is usually a stick.'
        }
        wanted={wants === 'play'}
        disabled={disabled}
        onPress={onPress}
      >
        {toyId === 'toy_rope' ? <KitRope /> : toyId === 'toy_ball' ? <KitBall /> : <KitStick />}
      </KitObject>

      <KitObject
        action="sleep"
        label={asleep ? 'wake' : 'bed'}
        hint={asleep ? 'Wake him up. He will have opinions.' : 'His bed. Tap it and he will go and lie down.'}
        wanted={wants === 'sleep'}
        disabled={disabled}
        onPress={onPress}
      >
        <KitBed asleep={asleep} />
      </KitObject>
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * A shelf along the front of the stage. Nearer the camera than he is, which
   * is what makes it read as the floor in front of him rather than a toolbar
   * that happens to contain pictures.
   */
  kit: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    // Sized to sit entirely BELOW his feet — see layout.SPRITE_FOOT. When the
    // shelf was taller than that gap the middle object landed between his
    // front paws, which is the one place on the screen nothing may sit.
    height: 58,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingHorizontal: space.sm,
    zIndex: 8,
  },
  slot: {
    minWidth: TAP_MIN + 16,
    minHeight: TAP_MIN + 8,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4,
  },
  slotOff: { opacity: 0.4 },
  art: { alignItems: 'center', justifyContent: 'flex-end', height: 46 },
  contact: {
    position: 'absolute',
    bottom: 2,
    width: 42,
    height: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(62,52,40,0.16)',
  },
  /**
   * The same treatment the dogs' names use: the world labels itself dark, on
   * the ground, under the thing it names. Chrome is light and sits on top of
   * the world; these are not chrome.
   */
  label: {
    position: 'absolute',
    bottom: -2,
    ...type.micro,
    color: color.inkOn,
    backgroundColor: 'rgba(62,52,40,0.42)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
});
