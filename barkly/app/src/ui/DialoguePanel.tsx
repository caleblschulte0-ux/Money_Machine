/**
 * One dialogue surface for Barkly, NPCs and thoughts.
 *
 * Phone rule: this is the emotional subtitle rail of the game, not a chat-app
 * bubble. It is deliberately chunky, tactile and character-coded while
 * staying short enough that Barkly still owns the screen above it.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { color, elevation, radius, space, type } from './theme';
import { DIALOGUE_GAP, DIALOGUE_HEIGHT, SPEECH_MAX_LINES } from './layout';

export type Speaker = { name: string; kind: 'barkly' | 'npc' } | null;

interface Props {
  speaker: Speaker;
  line: string | null;
  youSaid?: string | null;
  thought?: string | null;
  hint: string;
  asleep?: boolean;
}

function Bolt({ side }: { side: 'left' | 'right' }) {
  return (
    <View style={[styles.bolt, side === 'right' && styles.boltRight]} pointerEvents="none">
      <View style={styles.boltShine} />
    </View>
  );
}

export default function DialoguePanel({ speaker, line, youSaid, thought, hint, asleep }: Props) {
  const shown = line ?? thought ?? null;
  const enter = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!shown) return;
    enter.setValue(0);
    Animated.spring(enter, { toValue: 1, tension: 150, friction: 13, useNativeDriver: true }).start();
  }, [shown, enter]);

  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  const npc = speaker?.kind === 'npc';
  const thinking = Boolean(thought && !line);
  const shellTop = npc ? color.violet : thinking ? color.fill : color.lemon;
  const shellBottom = npc ? color.violetDeep : thinking ? color.pop : color.lemonDeep;
  const edge = npc ? color.violetDeep : thinking ? color.popDeep : color.lemonDeep;
  const badge = npc ? color.violetDeep : thinking ? color.popDeep : color.ink;

  return (
    <View style={[styles.panel, !shown && styles.panelResting]} accessibilityLiveRegion="polite" testID="dialogue-panel">
      {shown ? (
        <>
          <View style={[styles.deepEdge, { backgroundColor: edge }]} pointerEvents="none" />
          <LinearGradient colors={[shellTop, shellBottom]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.shell} pointerEvents="none" />
          <View style={styles.innerPlate} pointerEvents="none" />
          <View style={styles.gloss} pointerEvents="none" />
          <Bolt side="left" />
          <Bolt side="right" />
          {speaker ? <View style={[styles.tail, { backgroundColor: shellTop, borderColor: edge }]} pointerEvents="none" /> : null}

          <Animated.View style={[styles.copy, { opacity: enter, transform: [{ translateY }] }]}>
            <View style={styles.copyTop}>
              {youSaid ? (
                <View style={styles.youBadge}>
                  <Text style={styles.youSaid} numberOfLines={1}>YOU · “{youSaid}”</Text>
                </View>
              ) : speaker ? (
                <View style={[styles.badge, { backgroundColor: badge }]}>
                  <Text style={styles.who}>{speaker.name.toUpperCase()}</Text>
                </View>
              ) : (
                <View style={[styles.badge, { backgroundColor: color.popDeep }]}><Text style={styles.who}>BARKLY BRAIN</Text></View>
              )}
              <View style={[styles.statusPip, { backgroundColor: npc ? color.goldSoft : thinking ? color.card : color.coral }]} />
            </View>
            <Text style={[styles.line, !line && styles.thought]} numberOfLines={SPEECH_MAX_LINES}>{shown}</Text>
          </Animated.View>
        </>
      ) : (
        <View style={styles.restingWrap}>
          <View style={styles.restingPaw}>
            <View style={styles.pawPad} />
            <View style={[styles.toe, styles.toe1]} />
            <View style={[styles.toe, styles.toe2]} />
            <View style={[styles.toe, styles.toe3]} />
          </View>
          <Text style={styles.resting}>{asleep ? 'shh — Barkly is snoozing' : hint}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    height: DIALOGUE_HEIGHT,
    marginVertical: DIALOGUE_GAP,
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderRadius: radius.xl,
    overflow: 'visible',
    backgroundColor: 'transparent',
    ...elevation.toy,
  },
  panelResting: { ...elevation.flat },
  deepEdge: {
    position: 'absolute', left: 5, right: 5, top: 8, bottom: -7,
    borderRadius: radius.xl, transform: [{ translateY: 3 }],
  },
  shell: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: radius.xl, borderWidth: 2.5, borderColor: color.inkMid },
  innerPlate: {
    position: 'absolute', left: 8, right: 8, top: 8, bottom: 8,
    borderRadius: radius.lg, borderWidth: 1.5, borderColor: color.gloss, backgroundColor: color.glossSoft,
  },
  gloss: { position: 'absolute', left: 20, right: 20, top: 7, height: 9, borderRadius: radius.pill, backgroundColor: color.gloss },
  bolt: { position: 'absolute', left: 9, bottom: 9, width: 9, height: 9, borderRadius: radius.pill, backgroundColor: color.goldInk, borderWidth: 1, borderColor: color.inkMid },
  boltRight: { left: undefined, right: 9 },
  boltShine: { position: 'absolute', left: 2, top: 1.5, width: 3, height: 2, borderRadius: radius.xs, backgroundColor: color.goldSoft, opacity: 0.75 },
  tail: {
    position: 'absolute', top: -8, left: '48%', width: 18, height: 18,
    borderRadius: radius.xs, borderLeftWidth: 2.5, borderTopWidth: 2.5,
    transform: [{ rotate: '45deg' }],
  },
  copy: { paddingHorizontal: space.xs },
  copyTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.xs },
  badge: { alignSelf: 'flex-start', paddingHorizontal: space.md, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1, borderColor: color.glossSoft },
  who: { ...type.micro, color: color.inkOn, letterSpacing: 1.5 },
  youBadge: { maxWidth: '86%', backgroundColor: color.gloss, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 5 },
  youSaid: { ...type.caption, color: color.inkMid, fontWeight: '800' },
  statusPip: { width: 8, height: 8, borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.inkMid },
  line: { ...type.speech, color: color.ink, fontWeight: '800', letterSpacing: -0.1 },
  thought: { fontStyle: 'italic', fontWeight: '600', color: color.inkMid },
  restingWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.md, opacity: 0.72 },
  restingPaw: { width: 24, height: 21, position: 'relative' },
  pawPad: { position: 'absolute', left: 6, bottom: 0, width: 13, height: 11, borderRadius: radius.xs, backgroundColor: color.popDeep, transform: [{ rotate: '-5deg' }] },
  toe: { position: 'absolute', width: 6, height: 7, borderRadius: radius.xs, backgroundColor: color.pop },
  toe1: { left: 1, top: 4 },
  toe2: { left: 9, top: 0 },
  toe3: { right: 1, top: 4 },
  resting: { ...type.small, color: color.inkSoft, textAlign: 'center', fontWeight: '700' },
});
