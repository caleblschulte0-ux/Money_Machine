/**
 * One dialogue surface for Barkly, NPCs and thoughts.
 *
 * CRISP PASS:
 * This is game dialogue, not a chat card and not a toy covered in decorative
 * chrome. One confident solid surface, one edge, one highlight, strong type.
 * The dog remains the hero above it.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
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

export default function DialoguePanel({ speaker, line, youSaid, thought, hint, asleep }: Props) {
  const shown = line ?? thought ?? null;
  const enter = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!shown) return;
    enter.setValue(0);
    Animated.timing(enter, {
      toValue: 1,
      duration: 190,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [shown, enter]);

  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });
  const scale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] });
  const npc = speaker?.kind === 'npc';
  const thinking = Boolean(thought && !line);

  const shell = npc ? color.violet : thinking ? color.fill : color.lemon;
  const edge = npc ? color.violetDeep : thinking ? color.popDeep : color.lemonDeep;
  const speakerInk = npc ? color.violetDeep : thinking ? color.popDeep : color.ink;

  return (
    <View
      style={[styles.panel, !shown && styles.panelResting]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={shown ? `${speaker?.name ?? 'Barkly thought'}: ${shown}` : undefined}
      testID="dialogue-panel"
    >
      {shown ? (
        <>
          <View style={[styles.edge, { backgroundColor: edge }]} pointerEvents="none" />
          <View style={[styles.shell, { backgroundColor: shell, borderColor: color.inkMid }]} pointerEvents="none" />
          <View style={styles.innerRim} pointerEvents="none" />
          <View style={styles.highlight} pointerEvents="none" />
          <View style={styles.glint} pointerEvents="none" />
          <View style={styles.bottomSheen} pointerEvents="none" />
          {speaker ? <View style={[styles.tail, { backgroundColor: shell, borderColor: color.inkMid }]} pointerEvents="none" /> : null}

          <Animated.View style={[styles.copy, { opacity: enter, transform: [{ translateY }, { scale }] }]}>
            {youSaid ? (
              <View style={styles.youBadge}>
                <Text style={styles.youSaid} numberOfLines={1}>YOU · “{youSaid}”</Text>
              </View>
            ) : speaker ? (
              <View style={[styles.badge, { borderColor: speakerInk }]}>
                <View style={[styles.speakerDot, { backgroundColor: speakerInk }]} />
                <Text style={[styles.who, { color: speakerInk }]}>{speaker.name.toUpperCase()}</Text>
              </View>
            ) : (
              <View style={[styles.badge, { borderColor: color.popDeep }]}>
                <View style={[styles.speakerDot, { backgroundColor: color.popDeep }]} />
                <Text style={[styles.who, { color: color.popDeep }]}>BARKLY BRAIN</Text>
              </View>
            )}
            <Text style={[styles.line, !line && styles.thought]} numberOfLines={SPEECH_MAX_LINES}>{shown}</Text>
          </Animated.View>
        </>
      ) : (
        <View style={styles.restingWrap}>
          <View style={styles.paw}>
            <View style={styles.pad} />
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
    borderRadius: radius.lg,
    overflow: 'visible',
    backgroundColor: 'transparent',
    ...elevation.card,
  },
  panelResting: { ...elevation.flat },
  edge: {
    position: 'absolute',
    left: 4,
    right: 4,
    top: 5,
    bottom: -5,
    borderRadius: radius.lg,
  },
  shell: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: radius.lg,
    borderWidth: 2,
  },
  /** Thin inset rim makes the panel read as a molded game surface, not a flat card. */
  innerRim: {
    position: 'absolute',
    left: 5,
    right: 5,
    top: 5,
    bottom: 5,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.glossSoft,
  },
  /** One controlled specular edge: enough gloss to feel premium without frosting the whole card. */
  highlight: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    top: 6,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: color.gloss,
  },
  glint: {
    position: 'absolute',
    left: space.xl,
    top: 12,
    width: 34,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: color.glossSoft,
    transform: [{ rotate: '-5deg' }],
  },
  bottomSheen: {
    position: 'absolute',
    left: space.xl,
    right: space.xl,
    bottom: 7,
    height: 2,
    borderRadius: radius.pill,
    backgroundColor: color.glossSoft,
    opacity: 0.6,
  },
  tail: {
    position: 'absolute',
    top: -7,
    left: '48%',
    width: 16,
    height: 16,
    borderRadius: radius.xs,
    borderLeftWidth: 2,
    borderTopWidth: 2,
    transform: [{ rotate: '45deg' }],
  },
  copy: { paddingHorizontal: space.xs },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    marginBottom: space.xs,
    backgroundColor: color.card,
    ...elevation.low,
  },
  speakerDot: { width: 6, height: 6, borderRadius: radius.pill },
  who: { ...type.micro },
  youBadge: {
    alignSelf: 'flex-start',
    maxWidth: '88%',
    backgroundColor: color.card,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    marginBottom: space.xs,
    ...elevation.low,
  },
  youSaid: { ...type.caption, color: color.inkMid },
  line: { ...type.speech, color: color.ink },
  thought: { fontStyle: 'italic', color: color.inkMid },
  restingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    opacity: 0.72,
  },
  paw: { width: 23, height: 20, position: 'relative' },
  pad: {
    position: 'absolute',
    left: 6,
    bottom: 0,
    width: 12,
    height: 10,
    borderRadius: radius.xs,
    backgroundColor: color.popDeep,
  },
  toe: { position: 'absolute', width: 6, height: 6, borderRadius: radius.pill, backgroundColor: color.pop },
  toe1: { left: 1, top: 4 },
  toe2: { left: 9, top: 0 },
  toe3: { right: 1, top: 4 },
  resting: { ...type.small, color: color.inkSoft, textAlign: 'center', fontWeight: '700' },
});
