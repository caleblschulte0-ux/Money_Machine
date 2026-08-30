/**
 * One dialogue surface for Barkly, NPCs and thoughts.
 *
 * The important cosmetic rule here is that this must not look like a white
 * web card. When somebody is speaking it becomes a chunky toy-console panel:
 * colored shell, molded lower edge, shine, and a speaker badge. At rest it
 * disappears so the dog keeps the screen.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
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

export default function DialoguePanel({ speaker, line, youSaid, thought, hint, asleep }: Props) {
  const shown = line ?? thought ?? null;
  const enter = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!shown) return;
    enter.setValue(0);
    Animated.timing(enter, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [shown, enter]);

  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });
  const npc = speaker?.kind === 'npc';
  const thinking = Boolean(thought && !line);
  const shell = npc ? color.violet : thinking ? color.fill : color.lemon;
  const edge = npc ? color.violetDeep : thinking ? color.popDeep : color.lemonDeep;

  return (
    <View
      style={[styles.panel, !shown && styles.panelResting]}
      accessibilityLiveRegion="polite"
      testID="dialogue-panel"
    >
      {shown ? (
        <>
          <LinearGradient
            colors={[shell, color.paper]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.shell}
            pointerEvents="none"
          />
          <View style={[styles.lowerEdge, { backgroundColor: edge }]} pointerEvents="none" />
          <View style={styles.gloss} pointerEvents="none" />
          {speaker ? <View style={[styles.tail, { backgroundColor: shell }]} pointerEvents="none" /> : null}

          <Animated.View style={{ opacity: enter, transform: [{ translateY }] }}>
            {youSaid ? (
              <View style={styles.badgeSoft}>
                <Text style={styles.youSaid} numberOfLines={1}>
                  YOU SAID · “{youSaid}”
                </Text>
              </View>
            ) : speaker ? (
              <View style={[styles.badge, npc && styles.badgeNpc]}>
                <Text style={[styles.who, npc && styles.whoNpc]}>{speaker.name.toUpperCase()}</Text>
              </View>
            ) : (
              <View style={styles.badgeSoft}>
                <Text style={styles.who}>BARKLY BRAIN</Text>
              </View>
            )}
            <Text style={[styles.line, !line && styles.thought]} numberOfLines={SPEECH_MAX_LINES}>
              {shown}
            </Text>
          </Animated.View>
        </>
      ) : (
        <View style={styles.restingWrap}>
          <View style={styles.restingDot} />
          <Text style={styles.resting}>{asleep ? 'shh — he’s asleep' : hint}</Text>
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
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    overflow: 'visible',
    borderWidth: 2,
    borderColor: color.inkMid,
    backgroundColor: color.card,
    ...elevation.toy,
  },
  panelResting: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    ...elevation.flat,
  },
  shell: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.lg,
  },
  lowerEdge: {
    position: 'absolute',
    left: space.sm,
    right: space.sm,
    bottom: -5,
    height: space.sm,
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
    opacity: 0.9,
  },
  gloss: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    top: space.xs,
    height: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.gloss,
  },
  tail: {
    position: 'absolute',
    top: -7,
    left: '46%',
    width: 18,
    height: 18,
    borderRadius: radius.xs / 2,
    borderLeftWidth: 2,
    borderTopWidth: 2,
    borderColor: color.inkMid,
    transform: [{ rotate: '45deg' }],
  },
  badge: {
    alignSelf: 'flex-start',
    marginBottom: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    backgroundColor: color.ink,
  },
  badgeNpc: { backgroundColor: color.violetDeep },
  badgeSoft: {
    alignSelf: 'flex-start',
    marginBottom: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    backgroundColor: color.card,
  },
  who: { ...type.micro, color: color.inkOn },
  whoNpc: { color: color.card },
  youSaid: { ...type.caption, color: color.inkSoft },
  line: { ...type.speech, color: color.ink },
  thought: { fontStyle: 'italic', fontWeight: '400', color: color.inkSoft },
  restingWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  restingDot: { width: space.sm, height: space.sm, borderRadius: radius.pill, backgroundColor: color.pop },
  resting: { ...type.body, color: color.inkSoft, textAlign: 'center' },
});
