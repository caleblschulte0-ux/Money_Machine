/**
 * Everything anyone says, in one place, at the bottom of the screen.
 *
 * This replaces four separate floating things: his speech bubble anchored
 * over his head, his thought bubble, the NPC's bubble in its own band, and
 * the idle hint. Each had its own position, its own width, its own rules
 * about when it could appear, and a shared job of not landing on anybody's
 * face. They were negotiating for the same region of screen and the result
 * looked exactly like what it was.
 *
 * One panel, always in the same place, below the stage:
 *
 * - It can never cover him, because the stage ends where the panel starts.
 * - The eye learns one place to read, instead of tracking a bubble that moves
 *   with his head and changes size with the sentence.
 * - A conversation with another dog reads as a conversation — same panel, the
 *   speaker's name changes — rather than two bubbles at different altitudes.
 *
 * The tail is gone deliberately. A tail is what a bubble uses to say who is
 * talking; a panel says it with a name, which is legible at a glance and does
 * not need to point at anything.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { color, elevation, radius, space, type } from './theme';
import { DIALOGUE_HEIGHT, SPEECH_MAX_LINES } from './layout';

export type Speaker = { name: string; kind: 'barkly' | 'npc' } | null;

interface Props {
  /** Who is talking. Null for his inner voice or the idle hint. */
  speaker: Speaker;
  /** The line itself. Null shows the resting state. */
  line: string | null;
  /** Echoed back above the line, so you can see what he answered. */
  youSaid?: string | null;
  /** His unspoken thought — same panel, italic, no speaker. */
  thought?: string | null;
  /** What to show when nothing has been said yet. */
  hint: string;
  /** He is asleep: the panel goes quiet rather than nagging. */
  asleep?: boolean;
}

export default function DialoguePanel({ speaker, line, youSaid, thought, hint, asleep }: Props) {
  const shown = line ?? thought ?? null;
  const enter = useRef(new Animated.Value(1)).current;

  // A small settle on each new line. Enough to notice it changed, not enough
  // to make you wait for it.
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

  return (
    <View
      style={[styles.panel, !shown && styles.panelResting]}
      accessibilityLiveRegion="polite"
      /* Stable handle for scripts/overlap-check.mjs, which asserts this panel
         never intersects the stage — the "speech never covers a face" rule. */
      testID="dialogue-panel"
    >
      {shown ? (
        <Animated.View style={{ opacity: enter, transform: [{ translateY }] }}>
          {youSaid ? (
            <Text style={styles.youSaid} numberOfLines={1}>
              you said “{youSaid}”
            </Text>
          ) : speaker ? (
            <Text style={[styles.who, speaker.kind === 'npc' && styles.whoNpc]}>
              {speaker.name.toUpperCase()}
            </Text>
          ) : (
            <Text style={styles.who}>THINKING</Text>
          )}
          <Text
            style={[styles.line, !line && styles.thought]}
            numberOfLines={SPEECH_MAX_LINES}
          >
            {shown}
          </Text>
        </Animated.View>
      ) : (
        <View style={styles.restingWrap}>
          <Text style={styles.resting}>{asleep ? 'shh — he’s asleep' : hint}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * The panel is only a CARD when it has something in it. At rest it drops to
   * a transparent strip with a quiet line of text — a big empty white box
   * sitting there between sentences is exactly the dead weight that makes a
   * screen feel like a form.
   */
  panelResting: {
    backgroundColor: 'transparent',
    ...elevation.flat,
  },
  panel: {
    height: DIALOGUE_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    backgroundColor: color.card,
    ...elevation.card,
  },
  who: {
    ...type.micro,
    color: color.inkFaint,
    marginBottom: space.xs,
  },
  whoNpc: { color: color.warm },
  youSaid: {
    ...type.caption,
    color: color.inkFaint,
    marginBottom: space.xs,
  },
  line: {
    ...type.speech,
    color: color.ink,
  },
  thought: {
    fontStyle: 'italic',
    fontWeight: '400',
    color: color.inkSoft,
  },
  restingWrap: { alignItems: 'center' },
  resting: {
    ...type.body,
    color: color.inkFaint,
    textAlign: 'center',
  },
});
