/**
 * Barkly's three physical play objects.
 *
 * These are not toolbar buttons. The previous pass got the interaction right
 * but still put the objects on a white UI card. This version treats the whole
 * thing as a LOW TOY DOCK sitting in the room: moulded base, recessed wells,
 * lower edge, contact shadows and larger object art. The Store's finish is the
 * benchmark; the dog is still the hero.
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
  return v.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
}

function Bowl() {
  return (
    <Svg width={78} height={56} viewBox="0 0 70 50">
      <Ellipse cx={35} cy={44} rx={27} ry={5} fill={DIORAMA.shadow} opacity={0.24} />
      <Circle cx={24} cy={14} r={5.6} fill={ITEM.biscuitEdge} />
      <Circle cx={41} cy={12} r={4.8} fill={ITEM.biscuit} />
      <Circle cx={33} cy={18} r={5.2} fill={ITEM.biscuitEdge} />
      <Ellipse cx={35} cy={23} rx={27} ry={8} fill={BRASS.edge} />
      <Ellipse cx={35} cy={20} rx={24} ry={7} fill={BRASS.mid} />
      <Path d="M8 22 a27 8 0 0 0 54 0 l-6 16 a21 6 0 0 1-42 0Z" fill={BRASS.polished} />
      <Path d="M13 28 Q35 38 57 28" stroke={BRASS.dark} strokeWidth={3} fill="none" opacity={0.46} />
      <Path d="M15 25 Q35 32 55 25" stroke={BRASS.light} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.82} />
      <Path d="M18 23 Q29 27 40 23" stroke={DIORAMA.white} strokeWidth={3.5} fill="none" strokeLinecap="round" opacity={0.52} />
    </Svg>
  );
}

function KitBall() {
  return (
    <Svg width={64} height={64} viewBox="0 0 54 54">
      <Ellipse cx={27} cy={49} rx={19} ry={4} fill={DIORAMA.shadow} opacity={0.22} />
      <Circle cx={27} cy={27} r={22} fill={BALL.edge} />
      <Circle cx={27} cy={24} r={21} fill={BALL.body} />
      <Path d="M6 21 C17 13 37 13 48 21" stroke={BALL.seam} strokeWidth={3.8} fill="none" />
      <Circle cx={18} cy={15} r={6.2} fill={BALL.gloss} opacity={0.48} />
      <Circle cx={16.2} cy={13.2} r={2.4} fill={BALL.gloss} opacity={0.8} />
    </Svg>
  );
}

function KitRope() {
  return (
    <Svg width={80} height={48} viewBox="0 0 68 40">
      <Ellipse cx={34} cy={35} rx={27} ry={4} fill={DIORAMA.shadow} opacity={0.2} />
      <Path d="M10 21 q11-12 24 0 q11 11 24 0" stroke={ITEM.ropeShade} strokeWidth={16} strokeLinecap="round" fill="none" />
      <Path d="M10 18 q11-10 24 0 q11 10 24 0" stroke={ITEM.rope} strokeWidth={10} strokeLinecap="round" fill="none" />
      <Path d="M11 15 q10-7 20 0" stroke={DIORAMA.white} strokeWidth={2.8} strokeLinecap="round" fill="none" opacity={0.38} />
      <Path d="M7 20 l-4-8 M7 20 l-4 8 M61 20 l4-8 M61 20 l4 8" stroke={ITEM.ropeShade} strokeWidth={4} strokeLinecap="round" />
    </Svg>
  );
}

function KitStick() {
  return (
    <Svg width={82} height={48} viewBox="0 0 70 40">
      <Ellipse cx={35} cy={35} rx={27} ry={4} fill={DIORAMA.shadow} opacity={0.2} />
      <Path d="M8 26 q17-11 33-6 q13 4 21-5" stroke={DIORAMA.woodDeep} strokeWidth={13} strokeLinecap="round" fill="none" />
      <Path d="M8 22 q17-9 33-5 q13 4 21-5" stroke={ITEM.stick} strokeWidth={11} strokeLinecap="round" fill="none" />
      <Path d="M10 18 q16-6 30-2" stroke={ITEM.stickLight} strokeWidth={3.4} strokeLinecap="round" fill="none" opacity={0.8} />
      <Path d="M25 18 l-8-9 M47 19 l8-10" stroke={ITEM.stick} strokeWidth={6.5} strokeLinecap="round" />
    </Svg>
  );
}

function KitBed({ asleep }: { asleep: boolean }) {
  return (
    <Svg width={84} height={58} viewBox="0 0 74 50">
      <Ellipse cx={37} cy={45} rx={31} ry={4.5} fill={DIORAMA.shadow} opacity={0.22} />
      <Ellipse cx={37} cy={29} rx={32} ry={15} fill={DIORAMA.bedEdge} />
      <Ellipse cx={37} cy={25} rx={31} ry={15} fill={ITEM.bedRim} />
      <Ellipse cx={37} cy={22} rx={27} ry={12} fill={ITEM.bed} />
      <Ellipse cx={37} cy={28} rx={21} ry={8} fill={ITEM.bedCushion} />
      <Path d="M6 25 a31 15 0 0 0 62 0 a31 18 0 0 1-62 0Z" fill={ITEM.bedRim} />
      <Path d="M17 17 Q37 9 57 17" stroke={DIORAMA.white} strokeWidth={3.5} fill="none" opacity={0.38} strokeLinecap="round" />
      {asleep && (
        <>
          <Path d="M50 10 h7 l-7 7 h7" stroke={DIORAMA.paleCream} strokeWidth={2.2} fill="none" strokeLinecap="round" />
          <Path d="M60 3 h4 l-4 4 h4" stroke={DIORAMA.paleCream} strokeWidth={1.6} fill="none" strokeLinecap="round" />
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
      onPressIn={() => Animated.spring(press, { toValue: 0.91, friction: 5, tension: 340, useNativeDriver: true }).start()}
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
      <View style={[styles.wellShadow, wanted && !disabled && styles.wellShadowWanted]} pointerEvents="none" />
      <View style={[styles.well, wanted && !disabled && styles.wellWanted]} pointerEvents="none">
        <View style={styles.wellGloss} />
      </View>
      <Animated.View style={[styles.art, { transform: [{ translateY: lift }, { scale: press }] }]}>{children}</Animated.View>
      {wanted && !disabled && <Text style={styles.label} numberOfLines={1}>{label}</Text>}
    </Pressable>
  );
}

export default function BarklyKit({ toyId, playLabel, asleep, wants, disabled, onPress }: Props) {
  return (
    <View style={styles.kit}>
      <View style={styles.dockShadow} pointerEvents="none" />
      <View style={styles.dock} pointerEvents="none">
        <View style={styles.dockGloss} />
        <View style={styles.dockFront} />
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
    left: 7,
    right: 7,
    bottom: -1,
    height: 76,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingHorizontal: space.xs,
    zIndex: 8,
  },
  dockShadow: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: -2,
    height: 24,
    borderRadius: radius.xl,
    backgroundColor: color.ink,
    opacity: 0.12,
  },
  dock: {
    position: 'absolute',
    left: 5,
    right: 5,
    bottom: 2,
    height: 46,
    borderRadius: radius.xl,
    backgroundColor: color.paper,
    borderWidth: 2,
    borderColor: color.line,
    overflow: 'hidden',
    ...elevation.low,
  },
  dockGloss: {
    position: 'absolute',
    left: 17,
    right: 17,
    top: 5,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: color.glossSoft,
  },
  dockFront: {
    position: 'absolute',
    left: 7,
    right: 7,
    bottom: 0,
    height: 8,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    backgroundColor: color.line,
  },
  slot: {
    minWidth: TAP_MIN + 26,
    minHeight: TAP_MIN + 20,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 2,
  },
  slotOff: { opacity: 0.4 },
  wellShadow: {
    position: 'absolute',
    bottom: 5,
    width: 80,
    height: 30,
    borderRadius: radius.lg,
    backgroundColor: color.ink,
    opacity: 0.12,
  },
  wellShadowWanted: { opacity: 0.18 },
  well: {
    position: 'absolute',
    bottom: 9,
    width: 80,
    height: 31,
    borderRadius: radius.lg,
    backgroundColor: color.fill,
    borderWidth: 1.5,
    borderColor: color.line,
    overflow: 'hidden',
  },
  wellWanted: { backgroundColor: color.goldWell, borderColor: color.gold },
  wellGloss: {
    position: 'absolute',
    left: 9,
    right: 9,
    top: 4,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: color.gloss,
    opacity: 0.72,
  },
  art: { alignItems: 'center', justifyContent: 'flex-end', height: 68, zIndex: 2 },
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