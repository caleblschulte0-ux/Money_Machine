/**
 * Barkly's three physical play objects.
 *
 * These are not toolbar buttons. They live in his world and need to feel like
 * objects a kid can reach for: solid materials, clean contact shadows, simple
 * highlights and enough scale to read before any text does.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { color, elevation, radius, space, type } from './theme';
import { TAP_MIN } from './layout';
import { BALL, BRASS, DIORAMA, ITEM } from './scenes/artPalette';

export type KitAction = 'feed' | 'play' | 'sleep';

interface Props {
  toyId: string | null;
  playLabel: string;
  asleep: boolean;
  wants: KitAction | null;
  disabled: boolean;
  onPress(action: KitAction): void;
}

function useNudge(active: boolean) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      Animated.timing(v, { toValue: 0, duration: 180, useNativeDriver: true }).start();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 680, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 680, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, v]);
  return v.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });
}

function Bowl() {
  return (
    <Svg width={70} height={50} viewBox="0 0 64 46">
      <Ellipse cx={32} cy={38} rx={24} ry={4.5} fill={DIORAMA.shadow} opacity={0.22} />
      <Circle cx={23} cy={14} r={5.2} fill={ITEM.biscuitEdge} />
      <Circle cx={37} cy={12} r={4.4} fill={ITEM.biscuit} />
      <Circle cx={31} cy={17} r={4.7} fill={ITEM.biscuitEdge} />
      <Ellipse cx={32} cy={21} rx={24} ry={7} fill={BRASS.dark} />
      <Ellipse cx={32} cy={20} rx={20} ry={5.2} fill={BRASS.mid} />
      <Path d="M8 21 a24 7 0 0 0 48 0 l-5 14 a19 5 0 0 1-38 0Z" fill={BRASS.polished} />
      <Path d="M14 25 Q32 32 50 25" stroke={BRASS.light} strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.8} />
      <Path d="M17 24 Q27 27 37 24" stroke={DIORAMA.white} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.45} />
    </Svg>
  );
}

function KitBall() {
  return (
    <Svg width={58} height={58} viewBox="0 0 50 50">
      <Ellipse cx={25} cy={44} rx={17} ry={3.5} fill={DIORAMA.shadow} opacity={0.2} />
      <Circle cx={25} cy={25} r={20} fill={BALL.body} />
      <Path d="M5 22 C15 13 35 13 45 22" stroke={BALL.seam} strokeWidth={3.5} fill="none" />
      <Circle cx={17} cy={16} r={5.5} fill={BALL.gloss} opacity={0.42} />
      <Circle cx={15.5} cy={14.5} r={2.2} fill={BALL.gloss} opacity={0.72} />
    </Svg>
  );
}

function KitRope() {
  return (
    <Svg width={72} height={42} viewBox="0 0 62 36">
      <Ellipse cx={31} cy={31} rx={25} ry={3.4} fill={DIORAMA.shadow} opacity={0.18} />
      <Path d="M10 18 q10-10 21 0 q10 10 21 0" stroke={ITEM.ropeShade} strokeWidth={14} strokeLinecap="round" fill="none" />
      <Path d="M10 16 q10-9 21 0 q10 9 21 0" stroke={ITEM.rope} strokeWidth={9} strokeLinecap="round" fill="none" />
      <Path d="M11 13 q9-6 18 0" stroke={DIORAMA.white} strokeWidth={2.4} strokeLinecap="round" fill="none" opacity={0.3} />
      <Path d="M7 18 l-4-7 M7 18 l-4 7 M55 18 l4-7 M55 18 l4 7" stroke={ITEM.ropeShade} strokeWidth={3.5} strokeLinecap="round" />
    </Svg>
  );
}

function KitStick() {
  return (
    <Svg width={74} height={42} viewBox="0 0 64 36">
      <Ellipse cx={32} cy={31} rx={25} ry={3.4} fill={DIORAMA.shadow} opacity={0.18} />
      <Path d="M7 23 q16-10 30-5 q12 4 20-4" stroke={ITEM.stick} strokeWidth={11} strokeLinecap="round" fill="none" />
      <Path d="M8 20 q16-7 29-3" stroke={ITEM.stickLight} strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.7} />
      <Path d="M23 17 l-7-8 M43 18 l7-9" stroke={ITEM.stick} strokeWidth={6} strokeLinecap="round" />
    </Svg>
  );
}

function KitBed({ asleep }: { asleep: boolean }) {
  return (
    <Svg width={76} height={52} viewBox="0 0 68 46">
      <Ellipse cx={34} cy={40} rx={28} ry={4} fill={DIORAMA.shadow} opacity={0.2} />
      <Ellipse cx={34} cy={25} rx={29} ry={14} fill={ITEM.bedRim} />
      <Ellipse cx={34} cy={22} rx={25} ry={11} fill={ITEM.bed} />
      <Ellipse cx={34} cy={27} rx={20} ry={8} fill={ITEM.bedCushion} />
      <Path d="M5 25 a29 14 0 0 0 58 0 a29 17 0 0 1-58 0Z" fill={ITEM.bedRim} />
      <Path d="M15 18 Q34 10 53 18" stroke={DIORAMA.white} strokeWidth={3} fill="none" opacity={0.3} strokeLinecap="round" />
      {asleep && (
        <>
          <Path d="M47 11 h7 l-7 7 h7" stroke={DIORAMA.paleCream} strokeWidth={2.2} fill="none" strokeLinecap="round" />
          <Path d="M56 4 h4 l-4 4 h4" stroke={DIORAMA.paleCream} strokeWidth={1.6} fill="none" strokeLinecap="round" />
        </>
      )}
    </Svg>
  );
}

function KitObject({ action, label, hint, wanted, disabled, onPress, children }: {
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
      onPressIn={() => Animated.spring(press, { toValue: 0.9, friction: 5, tension: 340, useNativeDriver: true }).start()}
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
      <View style={[styles.pad, wanted && !disabled && styles.padWanted]} pointerEvents="none">
        <View style={styles.padHighlight} />
      </View>
      <Animated.View style={[styles.art, { transform: [{ translateY: lift }, { scale: press }] }]}>{children}</Animated.View>
      {wanted && !disabled && <Text style={styles.label} numberOfLines={1}>{label}</Text>}
    </Pressable>
  );
}

export default function BarklyKit({ toyId, playLabel, asleep, wants, disabled, onPress }: Props) {
  return (
    <View style={styles.kit}>
      <View style={styles.dock} pointerEvents="none">
        <View style={styles.dockEdge} />
        <View style={styles.dockGloss} />
      </View>

      <KitObject action="feed" label="food" hint="His bowl. Tap it to choose what he eats." wanted={wants === 'feed'} disabled={disabled} onPress={onPress}>
        <Bowl />
      </KitObject>

      <KitObject
        action="play"
        label={playLabel}
        hint={toyId === 'toy_rope' ? 'His rope. Take one end — he will not let go.' : toyId === 'toy_ball' ? 'His ball. Throw it and he will bring it back. Probably.' : 'Whatever he can find. It is usually a stick.'}
        wanted={wants === 'play'}
        disabled={disabled}
        onPress={onPress}
      >
        {toyId === 'toy_rope' ? <KitRope /> : toyId === 'toy_ball' ? <KitBall /> : <KitStick />}
      </KitObject>

      <KitObject action="sleep" label={asleep ? 'wake' : 'bed'} hint={asleep ? 'Wake him up. He will have opinions.' : 'His bed. Tap it and he will go and lie down.'} wanted={wants === 'sleep'} disabled={disabled} onPress={onPress}>
        <KitBed asleep={asleep} />
      </KitObject>
    </View>
  );
}

const styles = StyleSheet.create({
  kit: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 0,
    height: 72,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingHorizontal: space.xs,
    zIndex: 8,
  },
  dock: {
    position: 'absolute',
    left: 5,
    right: 5,
    bottom: 1,
    height: 43,
    borderRadius: radius.xl,
    backgroundColor: color.card,
    borderWidth: 2,
    borderColor: color.line,
    ...elevation.low,
  },
  dockEdge: {
    position: 'absolute',
    left: 9,
    right: 9,
    bottom: -4,
    height: 8,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    backgroundColor: color.line,
  },
  dockGloss: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 5,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: color.glossSoft,
  },
  slot: {
    minWidth: TAP_MIN + 24,
    minHeight: TAP_MIN + 18,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 3,
  },
  slotOff: { opacity: 0.38 },
  pad: {
    position: 'absolute',
    bottom: 7,
    width: 74,
    height: 30,
    borderRadius: radius.lg,
    backgroundColor: color.fill,
    borderWidth: 1.5,
    borderColor: color.line,
  },
  padWanted: { backgroundColor: color.goldWell, borderColor: color.gold },
  padHighlight: {
    position: 'absolute',
    left: 9,
    right: 9,
    top: 4,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: color.gloss,
    opacity: 0.65,
  },
  art: { alignItems: 'center', justifyContent: 'flex-end', height: 62, zIndex: 2 },
  label: {
    position: 'absolute',
    bottom: -3,
    ...type.micro,
    color: color.inkOn,
    backgroundColor: color.ink,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
    zIndex: 3,
  },
});
