/**
 * The duel, on screen.
 *
 * A marker sweeps the track, a zone is the target, you tap. Three rounds,
 * faster and tighter each time. No instructions screen — the shape of it is
 * the instruction.
 *
 * The rules live in game/contest.ts; this file only animates them and reads
 * the marker's position at the instant of the tap. That split is why the
 * fairness is testable without rendering anything.
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

const INK = '#3E332A';
const INK_SOFT = '#7A6A55';
const CARD = '#FFFDF7';
const GOLD = '#C9A227';

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
  // The marker's live position. Animated.Value cannot be read synchronously
  // in a tap handler, so the listener keeps a plain number in step with it.
  const position = useRef(0);

  useEffect(() => {
    const id = sweep.addListener(({ value }) => {
      position.current = value;
    });
    return () => sweep.removeListener(id);
  }, [sweep]);

  // Fresh contest whenever one opens.
  useEffect(() => {
    if (!visible || !rules) return;
    const fresh = freshContest(rules);
    setState(fresh);
    setSpec(roundSpec(0));
    setFlash(null);
  }, [visible, rules]);

  // Sweep back and forth for the current round.
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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>
            {rules.kind === 'race' ? 'RACE' : rules.kind === 'dig' ? 'DIG-OFF' : 'FETCH DUEL'} · VS{' '}
            {rules.opponent.toUpperCase()}
          </Text>
          <Text style={styles.title}>
            {state?.done
              ? verdictLine(state)
              : `Round ${Math.min((state?.round ?? 0) + 1, rules.rounds)} of ${rules.rounds}`}
          </Text>

          {/* score — never colour alone, the numbers say it */}
          <View style={styles.score}>
            <Text style={styles.scoreSide}>Barkly {state?.you ?? 0}</Text>
            <Text style={styles.scoreDash}>—</Text>
            <Text style={styles.scoreSide}>
              {state?.them ?? 0} {rules.opponent}
            </Text>
          </View>

          {/* the track */}
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
            {spec && (
              <View style={[styles.zoneCore, { left: pct(spec.target - 0.006), width: '1.2%' as DimensionValue }]} />
            )}
            <Animated.View
              style={[
                styles.marker,
                { left: sweep.interpolate({ inputRange: [0, 1], outputRange: ['0%', '98%'] }) },
              ]}
            />
          </Pressable>

          <Text style={styles.flash} accessibilityLiveRegion="polite">
            {flash ?? (running ? 'Tap when the marker is in the gold.' : ' ')}
          </Text>

          {state?.done ? (
            <Pressable style={styles.primary} onPress={() => onDone(state)} accessibilityRole="button">
              <Text style={styles.primaryText}>done</Text>
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(40,32,22,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: { backgroundColor: CARD, borderRadius: 26, padding: 22, width: '100%', maxWidth: 360 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.3, color: '#A8987C' },
  title: { fontSize: 20, fontWeight: '800', color: INK, marginTop: 6, lineHeight: 26 },
  score: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 14 },
  scoreSide: { fontSize: 15, fontWeight: '800', color: INK },
  scoreDash: { fontSize: 15, color: INK_SOFT },
  track: {
    height: 54,
    borderRadius: 14,
    backgroundColor: '#EDE1C8',
    marginTop: 16,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  zone: { position: 'absolute', top: 0, bottom: 0, backgroundColor: '#F3DFA0' },
  zoneCore: { position: 'absolute', top: 0, bottom: 0, backgroundColor: GOLD, opacity: 0.55 },
  marker: { position: 'absolute', top: 4, bottom: 4, width: 8, borderRadius: 4, backgroundColor: INK },
  flash: { marginTop: 12, minHeight: 38, fontSize: 14, lineHeight: 19, color: INK_SOFT },
  primary: { backgroundColor: INK, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  primaryText: { color: '#FFFDF7', fontSize: 16, fontWeight: '800' },
  cancel: { alignItems: 'center', paddingVertical: 10 },
  cancelText: { color: INK_SOFT, fontSize: 14 },
});
