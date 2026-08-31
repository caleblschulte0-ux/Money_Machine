import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { color, elevation, radius, space, type } from './theme';
import { CARE_DOCK_HEIGHT, INTERACTION_GUTTER, TAP_MIN } from './layout';
import { BALL, BRASS, DIORAMA, ITEM } from './scenes/artPalette';

export type KitAction = 'feed' | 'play' | 'sleep';

type Props = {
  toyId: string | null;
  playLabel: string;
  asleep: boolean;
  wants: KitAction | null;
  disabled: boolean;
  onPress(action: KitAction): void;
};

function useNudge(active: boolean) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      Animated.timing(v, { toValue: 0, duration: 160, useNativeDriver: true }).start();
      return;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 620, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 620, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [active, v]);
  return v.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
}

function Bowl() {
  return <Svg width={76} height={55} viewBox="0 0 70 50">
    <Ellipse cx={35} cy={44} rx={27} ry={5} fill={DIORAMA.shadow} opacity={0.22} />
    <Circle cx={25} cy={14} r={5.5} fill={ITEM.biscuitEdge} />
    <Circle cx={41} cy={12} r={4.8} fill={ITEM.biscuit} />
    <Ellipse cx={35} cy={22} rx={27} ry={8} fill={BRASS.edge} />
    <Ellipse cx={35} cy={20} rx={24} ry={7} fill={BRASS.mid} />
    <Path d="M8 22 a27 8 0 0 0 54 0 l-6 16 a21 6 0 0 1-42 0Z" fill={BRASS.polished} />
    <Path d="M15 25 Q35 32 55 25" stroke={BRASS.light} strokeWidth={5} fill="none" strokeLinecap="round" opacity={0.82} />
    <Path d="M18 23 Q29 27 40 23" stroke={DIORAMA.white} strokeWidth={3.4} fill="none" strokeLinecap="round" opacity={0.5} />
  </Svg>;
}

function Ball() {
  return <Svg width={64} height={64} viewBox="0 0 54 54">
    <Ellipse cx={27} cy={49} rx={19} ry={4} fill={DIORAMA.shadow} opacity={0.22} />
    <Circle cx={27} cy={27} r={22} fill={BALL.edge} />
    <Circle cx={27} cy={24} r={21} fill={BALL.body} />
    <Path d="M6 21 C17 13 37 13 48 21" stroke={BALL.seam} strokeWidth={3.8} fill="none" />
    <Circle cx={18} cy={15} r={6.2} fill={BALL.gloss} opacity={0.48} />
  </Svg>;
}

function Rope() {
  return <Svg width={80} height={48} viewBox="0 0 68 40">
    <Ellipse cx={34} cy={35} rx={27} ry={4} fill={DIORAMA.shadow} opacity={0.2} />
    <Path d="M10 21 q11-12 24 0 q11 11 24 0" stroke={ITEM.ropeShade} strokeWidth={16} strokeLinecap="round" fill="none" />
    <Path d="M10 18 q11-10 24 0 q11 10 24 0" stroke={ITEM.rope} strokeWidth={10} strokeLinecap="round" fill="none" />
    <Path d="M11 15 q10-7 20 0" stroke={DIORAMA.white} strokeWidth={2.8} strokeLinecap="round" fill="none" opacity={0.38} />
  </Svg>;
}

function Stick() {
  return <Svg width={82} height={48} viewBox="0 0 70 40">
    <Ellipse cx={35} cy={35} rx={27} ry={4} fill={DIORAMA.shadow} opacity={0.2} />
    <Path d="M8 26 q17-11 33-6 q13 4 21-5" stroke={DIORAMA.woodDeep} strokeWidth={13} strokeLinecap="round" fill="none" />
    <Path d="M8 22 q17-9 33-5 q13 4 21-5" stroke={ITEM.stick} strokeWidth={11} strokeLinecap="round" fill="none" />
    <Path d="M10 18 q16-6 30-2" stroke={ITEM.stickLight} strokeWidth={3.4} strokeLinecap="round" fill="none" opacity={0.8} />
  </Svg>;
}

function Waves() {
  return <Svg width={82} height={52} viewBox="0 0 76 46">
    <Ellipse cx={38} cy={40} rx={28} ry={4} fill={DIORAMA.shadow} opacity={0.18} />
    <Path d="M4 29 Q17 14 30 28 T56 27 T74 27" stroke={DIORAMA.aquaDeep} strokeWidth={12} fill="none" strokeLinecap="round" />
    <Path d="M4 25 Q17 10 30 24 T56 23 T74 23" stroke={DIORAMA.aqua} strokeWidth={9} fill="none" strokeLinecap="round" />
    <Path d="M8 21 Q18 12 28 21" stroke={DIORAMA.white} strokeWidth={3.5} fill="none" strokeLinecap="round" opacity={0.7} />
  </Svg>;
}

function Bed({ asleep }: { asleep: boolean }) {
  return <Svg width={84} height={58} viewBox="0 0 74 50">
    <Ellipse cx={37} cy={45} rx={31} ry={4.5} fill={DIORAMA.shadow} opacity={0.22} />
    <Ellipse cx={37} cy={29} rx={32} ry={15} fill={DIORAMA.bedEdge} />
    <Ellipse cx={37} cy={25} rx={31} ry={15} fill={ITEM.bedRim} />
    <Ellipse cx={37} cy={22} rx={27} ry={12} fill={ITEM.bed} />
    <Ellipse cx={37} cy={28} rx={21} ry={8} fill={ITEM.bedCushion} />
    <Path d="M17 17 Q37 9 57 17" stroke={DIORAMA.white} strokeWidth={3.5} fill="none" opacity={0.38} strokeLinecap="round" />
    {asleep && <Path d="M50 10 h7 l-7 7 h7" stroke={DIORAMA.paleCream} strokeWidth={2.2} fill="none" strokeLinecap="round" />}
  </Svg>;
}

function Slot({ action, label, hint, wanted, disabled, onPress, children }: {
  action: KitAction; label: string; hint: string; wanted: boolean; disabled: boolean;
  onPress(a: KitAction): void; children: React.ReactNode;
}) {
  const lift = useNudge(wanted && !disabled);
  const press = useRef(new Animated.Value(1)).current;
  return <Pressable
    onPressIn={() => Animated.spring(press, { toValue: 0.91, friction: 5, tension: 340, useNativeDriver: true }).start()}
    onPressOut={() => Animated.spring(press, { toValue: 1, friction: 5, tension: 320, useNativeDriver: true }).start()}
    onPress={() => onPress(action)} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}
    accessibilityHint={hint} accessibilityState={{ disabled }} testID={`kit-${action}`}
    style={[styles.slot, disabled && styles.off]}>
    <View style={[styles.wellShadow, wanted && styles.wellShadowWanted]} pointerEvents="none" />
    <View style={[styles.well, wanted && styles.wellWanted]} pointerEvents="none"><View style={styles.wellGloss} /></View>
    <Animated.View style={[styles.art, { transform: [{ translateY: lift }, { scale: press }] }]}>{children}</Animated.View>
    {wanted && !disabled && <Text style={styles.label}>{label}</Text>}
  </Pressable>;
}

export default function BarklyKit({ toyId, playLabel, asleep, wants, disabled, onPress }: Props) {
  const action = playLabel.toLowerCase();
  const visual = action.includes('tug') ? 'rope'
    : action.includes('fetch') || action.includes('throw') ? 'ball'
      : action.includes('wave') || action.includes('chasing') ? 'waves'
        : toyId === 'toy_rope' ? 'rope' : toyId === 'toy_ball' ? 'ball' : 'stick';
  const hint = visual === 'rope' ? 'His rope. Take one end — he will not let go.'
    : visual === 'ball' ? 'His ball. Throw it and he will bring it back. Probably.'
      : visual === 'waves' ? 'Tap to let him charge the waves.'
        : 'Whatever he can find. It is usually a stick.';

  return <View style={styles.kit}>
    <View style={styles.dockShadow} pointerEvents="none" />
    <View style={styles.dock} pointerEvents="none">
      <View style={styles.dockGloss} />
      <View style={styles.dockFront} />
      <View style={[styles.rivet, styles.rivetLeft]} />
      <View style={[styles.rivet, styles.rivetRight]} />
    </View>
    <Slot action="feed" label="food" hint="His bowl. Tap it to choose what he eats." wanted={wants === 'feed'} disabled={disabled} onPress={onPress}><Bowl /></Slot>
    <Slot action="play" label={playLabel} hint={hint} wanted={wants === 'play'} disabled={disabled} onPress={onPress}>
      {visual === 'rope' ? <Rope /> : visual === 'ball' ? <Ball /> : visual === 'waves' ? <Waves /> : <Stick />}
    </Slot>
    <Slot action="sleep" label={asleep ? 'wake' : 'bed'} hint={asleep ? 'Wake him up.' : 'His bed.'} wanted={wants === 'sleep'} disabled={disabled} onPress={onPress}><Bed asleep={asleep} /></Slot>
  </View>;
}

const styles = StyleSheet.create({
  kit: {
    position: 'absolute',
    left: INTERACTION_GUTTER,
    right: INTERACTION_GUTTER,
    bottom: 0,
    height: CARE_DOCK_HEIGHT,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingHorizontal: space.xs,
    zIndex: 8,
  },
  dockShadow: { position: 'absolute', left: 13, right: 13, bottom: -2, height: 20, borderRadius: radius.xl, backgroundColor: DIORAMA.shadow, opacity: 0.26 },
  dock: { position: 'absolute', left: 4, right: 4, bottom: 2, height: 42, borderRadius: radius.md, backgroundColor: DIORAMA.woodMid, borderWidth: 2.5, borderColor: DIORAMA.woodDeep, overflow: 'hidden', ...elevation.low },
  dockGloss: { position: 'absolute', left: 18, right: 18, top: 5, height: 5, borderRadius: radius.pill, backgroundColor: DIORAMA.woodShine, opacity: 0.76 },
  dockFront: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 10, borderTopWidth: 2, borderTopColor: DIORAMA.woodWarm, backgroundColor: DIORAMA.woodDeep },
  rivet: { position: 'absolute', bottom: 3, width: 6, height: 6, borderRadius: radius.xs, backgroundColor: BRASS.mid, borderWidth: 1, borderColor: BRASS.edge },
  rivetLeft: { left: 12 },
  rivetRight: { right: 12 },
  slot: { minWidth: TAP_MIN + 26, minHeight: TAP_MIN + 10, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 2 },
  off: { opacity: 0.4 },
  wellShadow: { position: 'absolute', bottom: 5, width: 82, height: 29, borderRadius: radius.lg, backgroundColor: DIORAMA.shadow, opacity: 0.28 },
  wellShadowWanted: { opacity: 0.38 },
  well: { position: 'absolute', bottom: 9, width: 82, height: 29, borderRadius: radius.lg, backgroundColor: DIORAMA.cream, borderWidth: 2, borderColor: DIORAMA.woodDeep, overflow: 'hidden' },
  wellWanted: { backgroundColor: DIORAMA.goldGlowSoft, borderColor: BRASS.dark },
  wellGloss: { position: 'absolute', left: 10, right: 10, top: 4, height: 4, borderRadius: radius.pill, backgroundColor: DIORAMA.white, opacity: 0.64 },
  art: { alignItems: 'center', justifyContent: 'flex-end', height: 58, zIndex: 2 },
  label: { position: 'absolute', bottom: -2, ...type.micro, color: color.inkOn, backgroundColor: color.ink, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, overflow: 'hidden', zIndex: 3 },
});
