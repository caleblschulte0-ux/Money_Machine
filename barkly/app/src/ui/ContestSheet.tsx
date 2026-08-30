/**
 * The duel, on screen.
 *
 * The tested timing mechanic stays exactly where it belongs: game/contest.ts.
 * This pass changes only presentation. A contest used to replace Barkly and his
 * opponent with a centered white timing card, so the most game-like moment in
 * the app looked the least like the game. The world now remains visible and
 * the timing input sits low like a contest HUD.
 *
 * A future BarklyRoom pass should animate the dogs and ball from each result;
 * this component is deliberately the bridge, not the final cinematic system.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, DimensionValue, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
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

export default function ContestSheet({ visible, rules, onDone, onClose }: Props) {
  const [state, setState] = useState<ContestState | null>(null);
  const [spec, setSpec] = useState<RoundSpec | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const sweep = useRef(new Animated.Value(0)).current;
  // Animated.Value cannot be read synchronously in a tap handler, so the
  // listener keeps a plain number in step with it.
  const position = useRef(0);

  useEffect(() => {
    const id = sweep.addListener(({ value }) => {
      position.current = value;
    });
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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.worldScrim} pointerEvents="none" />

        <View style={styles.scoreFloat} pointerEvents="none">
          <Text style={styles.eyebrow}>{kind} · VS {rules.opponent.toUpperCase()}</Text>
          <View style={styles.score}>
            <Text style={styles.scoreSide}>Barkly {state?.you ?? 0}</Text>
            <Text style={styles.scoreDash}>—</Text>
            <Text style={styles.scoreSide}>{state?.them ?? 0} {rules.opponent}</Text>
          </View>
        </View>

        <View style={styles.tray}>
          <View style={styles.handle} />
          <Text style={styles.title}>
            {state?.done
              ? verdictLine(state)
              : `Round ${Math.min((state?.round ?? 0) + 1, rules.rounds)} of ${rules.rounds}`}
          </Text>
          <Text style={styles.instruction}>{flash ?? (running ? 'Hit it when the marker crosses the gold.' : ' ')}</Text>

          <Pressable
            style={styles.track}
            onPress={tap}
            disabled={!running}
            accessibilityRole="button"
            accessibilityLabel="Tap when the marker is in the target"
          >
            {spec && (
              <View
                style={[
                  styles.zone,
                  {
                    left: pct(spec.target - spec.halfWidth),
                    width: pct(spec.halfWidth * 2),
                  },
                ]}
              />
            )}
            {spec && <View style={[styles.zoneCore, { left: pct(spec.target - 0.006), width: '1.2%' as DimensionValue }]} />}
            <Animated.View
              style={[
                styles.marker,
                { left: sweep.interpolate({ inputRange: [0, 1], outputRange: ['0%', '98%'] }) },
              ]}
            />
          </Pressable>

          {state?.done ? (
            <Pressable style={styles.primary} onPress={() => onDone(state)} accessibilityRole="button">
              <View style={styles.gloss} pointerEvents="none" />
              <Text style={styles.primaryText}>back to Barkly</Text>
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
  worldScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: color.scrim, opacity: 0.34 },
  scoreFloat: { position: 'absolute', left: space.xl, right: space.xl, top: '13%', alignItems: 'center' },
  eyebrow: { ...type.micro, color: color.inkOn, backgroundColor: color.ink, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs, overflow: 'hidden' },
  score: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.md, marginTop: space.sm, backgroundColor: color.card, borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: space.sm, ...elevation.card },
  scoreSide: { ...type.strong, color: color.ink },
  scoreDash: { ...type.strong, color: color.inkSoft },

  tray: { backgroundColor: color.paper, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.xl, ...elevation.sheet },
  handle: { alignSelf: 'center', width: 50, height: 5, borderRadius: radius.pill, backgroundColor: color.line, marginBottom: space.md },
  title: { ...type.title, color: color.ink, textAlign: 'center' },
  instruction: { ...type.small, minHeight: 40, color: color.inkSoft, textAlign: 'center', marginTop: space.sm },
  track: { height: 58, borderRadius: radius.sm, backgroundColor: color.fill, marginTop: space.sm, overflow: 'hidden', justifyContent: 'center', borderWidth: 1, borderColor: color.line },
  zone: { position: 'absolute', top: 0, bottom: 0, backgroundColor: color.goldWell },
  zoneCore: { position: 'absolute', top: 0, bottom: 0, backgroundColor: color.gold, opacity: 0.7 },
  marker: { position: 'absolute', top: space.xs, bottom: space.xs, width: 8, borderRadius: radius.pill, backgroundColor: color.ink },
  primary: { backgroundColor: color.pop, borderRadius: radius.pill, paddingVertical: space.lg, alignItems: 'center', marginTop: space.lg, overflow: 'hidden', ...elevation.card },
  gloss: { position: 'absolute', top: space.xs, left: space.lg, right: space.lg, height: 12, borderRadius: radius.pill, backgroundColor: color.inkOn, opacity: 0.4 },
  primaryText: { ...type.strong, color: color.ink },
  cancel: { alignItems: 'center', paddingVertical: space.md, marginTop: space.sm },
  cancelText: { ...type.small, color: color.inkSoft },
});
