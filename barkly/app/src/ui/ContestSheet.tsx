/**
 * The duel HUD. Mechanics stay in game/contest.ts; this surface makes the
 * timing game read like a colorful dog-game moment instead of a white form.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, DimensionValue, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ContestRules,
  ContestState,
  freshContest,
  playRound,
  roundSpec,
  RoundSpec,
  verdictLine,
} from '../game/contest';
import { color, elevation, radius, space, type } from './theme';

interface Props {
  visible: boolean;
  rules: ContestRules | null;
  onDone: (state: ContestState) => void;
  onClose: () => void;
}

function duelPaint(kind: ContestRules['kind']): { main: string; edge: string } {
  if (kind === 'race') return { main: color.coral, edge: color.coralDeep };
  if (kind === 'dig') return { main: color.mint, edge: color.mintDeep };
  return { main: color.pop, edge: color.popDeep };
}

export default function ContestSheet({ visible, rules, onDone, onClose }: Props) {
  const [state, setState] = useState<ContestState | null>(null);
  const [spec, setSpec] = useState<RoundSpec | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const sweep = useRef(new Animated.Value(0)).current;
  const position = useRef(0);

  useEffect(() => {
    const id = sweep.addListener(({ value }) => { position.current = value; });
    return () => sweep.removeListener(id);
  }, [sweep]);

  useEffect(() => {
    if (!visible || !rules) return;
    const fresh = freshContest(rules);
    setState(fresh);
    setSpec(roundSpec(0));
    setFlash(null);
  }, [visible, rules]);

  useEffect(() => {
    if (!visible || !spec || !state || state.done) {
      sweep.stopAnimation();
      setRunning(false);
      return;
    }
    setRunning(true);
    sweep.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, { toValue: 1, duration: spec.sweepMs, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(sweep, { toValue: 0, duration: spec.sweepMs, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, spec, state, sweep]);

  if (!rules) return null;

  const tap = () => {
    if (!state || !spec || state.done || !running) return;
    setRunning(false);
    sweep.stopAnimation();
    const result = playRound(state, position.current, spec);
    setState(result.state);
    setFlash(result.line);
    if (result.state.done) {
      setTimeout(() => onDone(result.state), 1200);
    } else {
      setTimeout(() => {
        setSpec(roundSpec(result.state.round));
        setFlash(null);
      }, 950);
    }
  };

  const pct = (n: number) => `${Math.round(n * 100)}%` as DimensionValue;
  const kind = rules.kind === 'race' ? 'RACE' : rules.kind === 'dig' ? 'DIG-OFF' : 'FETCH DUEL';
  const paint = duelPaint(rules.kind);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.worldScrim} pointerEvents="none" />

        <View style={styles.scoreFloat} pointerEvents="none">
          <View style={[styles.duelBadge, { backgroundColor: paint.main, borderColor: paint.edge }]}>
            <View style={styles.badgeGloss} />
            <Text style={styles.eyebrow}>{kind} · VS {rules.opponent.toUpperCase()}</Text>
          </View>
          <View style={styles.score}>
            <View style={[styles.scorePod, { backgroundColor: color.lemon }]}>
              <Text style={styles.scoreName}>BARKLY</Text>
              <Text style={styles.scoreNumber}>{state?.you ?? 0}</Text>
            </View>
            <Text style={styles.scoreDash}>VS</Text>
            <View style={[styles.scorePod, { backgroundColor: color.violet }]}>
              <Text style={styles.scoreName}>{rules.opponent.toUpperCase()}</Text>
              <Text style={styles.scoreNumber}>{state?.them ?? 0}</Text>
            </View>
          </View>
        </View>

        <View style={styles.tray}>
          <LinearGradient colors={[paint.main, color.paper]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.trayPaint} pointerEvents="none" />
          <View style={[styles.trayEdge, { backgroundColor: paint.edge }]} pointerEvents="none" />
          <View style={styles.trayGloss} pointerEvents="none" />
          <View style={styles.handle} />

          <Text style={styles.title}>{state?.done ? verdictLine(state) : `ROUND ${Math.min((state?.round ?? 0) + 1, rules.rounds)} / ${rules.rounds}`}</Text>
          <Text style={styles.instruction}>{flash ?? (running ? 'Hit it when the marker crosses the yellow.' : ' ')}</Text>

          <Pressable
            style={({ pressed }) => [styles.track, pressed && running && styles.trackPressed]}
            onPress={tap}
            disabled={!running}
            accessibilityRole="button"
            accessibilityLabel="Tap when the marker is in the target"
          >
            <View style={styles.trackGloss} pointerEvents="none" />
            {spec && <View style={[styles.zone, { left: pct(spec.target - spec.halfWidth), width: pct(spec.halfWidth * 2) }]} />}
            {spec && <View style={[styles.zoneCore, { left: pct(spec.target - 0.006), width: '1.2%' as DimensionValue }]} />}
            <Animated.View style={[styles.marker, { left: sweep.interpolate({ inputRange: [0, 1], outputRange: ['0%', '98%'] }) }]} />
          </Pressable>

          <View style={styles.tapHint} pointerEvents="none">
            <Text style={styles.tapHintText}>{state?.done ? 'DUEL SETTLED' : running ? 'TAP!' : 'NICE'}</Text>
          </View>

          {state?.done ? (
            <Pressable style={({ pressed }) => [styles.primary, pressed && styles.pressed]} onPress={() => onDone(state)} accessibilityRole="button">
              <View style={styles.gloss} pointerEvents="none" />
              <Text style={styles.primaryText}>BACK TO BARKLY</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.cancel} onPress={onClose} accessibilityRole="button">
              <Text style={styles.cancelText}>not now</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  worldScrim: { ...StyleSheet.absoluteFill, backgroundColor: color.scrim, opacity: 0.26 },
  scoreFloat: { position: 'absolute', left: space.xl, right: space.xl, top: '11%', alignItems: 'center' },
  duelBadge: { borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: space.sm, borderWidth: 2, overflow: 'hidden', ...elevation.card },
  badgeGloss: { position: 'absolute', left: space.sm, right: space.sm, top: space.xxs, height: space.xs, borderRadius: radius.pill, backgroundColor: color.gloss },
  eyebrow: { ...type.micro, color: color.ink },
  score: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, marginTop: space.md },
  scorePod: { minWidth: 92, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm, alignItems: 'center', borderWidth: 2, borderColor: color.inkMid, ...elevation.toy },
  scoreName: { ...type.micro, color: color.inkSoft },
  scoreNumber: { ...type.display, color: color.ink, marginTop: space.xxs },
  scoreDash: { ...type.micro, color: color.inkOn, backgroundColor: color.ink, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: space.xs, overflow: 'hidden' },

  tray: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.xl, borderTopWidth: 2, borderColor: color.inkMid, overflow: 'visible', ...elevation.sheet },
  trayPaint: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  trayEdge: { position: 'absolute', left: space.lg, right: space.lg, bottom: -6, height: space.md, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  trayGloss: { position: 'absolute', left: space.xl, right: space.xl, top: space.xs, height: space.sm, borderRadius: radius.pill, backgroundColor: color.glossSoft },
  handle: { alignSelf: 'center', width: 50, height: 5, borderRadius: radius.pill, backgroundColor: color.inkMid, opacity: 0.55, marginBottom: space.md },
  title: { ...type.title, fontWeight: '900', color: color.ink, textAlign: 'center' },
  instruction: { ...type.small, minHeight: 40, color: color.inkMid, fontWeight: '700', textAlign: 'center', marginTop: space.sm },
  track: { height: 64, borderRadius: radius.lg, backgroundColor: color.ink, marginTop: space.sm, overflow: 'hidden', justifyContent: 'center', borderWidth: 2, borderColor: color.inkMid, ...elevation.toy },
  trackPressed: { transform: [{ scale: 0.99 }] },
  trackGloss: { position: 'absolute', left: space.md, right: space.md, top: space.xs, height: space.sm, borderRadius: radius.pill, backgroundColor: color.glossSoft },
  zone: { position: 'absolute', top: 0, bottom: 0, backgroundColor: color.lemon },
  zoneCore: { position: 'absolute', top: 0, bottom: 0, backgroundColor: color.card, opacity: 0.9 },
  marker: { position: 'absolute', top: space.xs, bottom: space.xs, width: 8, borderRadius: radius.pill, backgroundColor: color.coral },
  tapHint: { alignSelf: 'center', marginTop: -12, minWidth: 72, borderRadius: radius.pill, backgroundColor: color.card, borderWidth: 2, borderColor: color.inkMid, paddingHorizontal: space.md, paddingVertical: space.xs, alignItems: 'center', ...elevation.low },
  tapHintText: { ...type.micro, color: color.ink },
  primary: { backgroundColor: color.lemon, borderRadius: radius.pill, paddingVertical: space.lg, alignItems: 'center', marginTop: space.lg, overflow: 'hidden', borderWidth: 2, borderColor: color.lemonDeep, ...elevation.toy },
  gloss: { position: 'absolute', top: space.xs, left: space.lg, right: space.lg, height: space.sm, borderRadius: radius.pill, backgroundColor: color.gloss },
  primaryText: { ...type.strong, fontWeight: '900', color: color.ink },
  cancel: { alignItems: 'center', paddingVertical: space.md, marginTop: space.sm },
  cancelText: { ...type.small, color: color.inkSoft },
  pressed: { transform: [{ scale: 0.985 }] },
});
