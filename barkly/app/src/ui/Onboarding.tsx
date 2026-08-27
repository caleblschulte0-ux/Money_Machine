/**
 * First launch. Not a tutorial — a meeting.
 *
 * The whole screen is Barkly, at the same size and in the same room he lives
 * in the rest of the time, saying four things. There is no logo screen, no
 * feature carousel and no explanation of how buttons work, because the one
 * thing a stranger needs to believe in the first minute is that this is a
 * specific dog who noticed them.
 *
 * The beats and the rules live in barkly/onboarding.ts; this file is only how
 * they look. Every step can be skipped, and skipping only ever costs him the
 * name.
 */

import React, { useEffect, useRef, useState } from 'react';
import { color, elevation } from './theme';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { BarklyRenderProps } from '../animation/renderer';
import {
  actionFor,
  advance,
  lineFor,
  needsInput,
  OnboardingState,
} from '../barkly/onboarding';
import { BodyAction } from '../barkly/types';


interface Props {
  state: OnboardingState;
  /** Whether this device can hear at all — decides if the mic beat happens. */
  micAvailable: boolean;
  /** Called with the result of advancing; the hook does the remembering. */
  onAdvance: (result: ReturnType<typeof advance>) => void;
  Renderer: React.ComponentType<BarklyRenderProps>;
}

/** He is doing something on every beat — a still dog reads as a loading screen. */
function actionsFor(state: OnboardingState): BodyAction[] {
  switch (state.step) {
    case 'greeting':
      return ['HEAD_TILT', 'EAR_PERK'];
    case 'name':
      return ['EAR_PERK', 'MOUTH_MOVE'];
    case 'delight':
      return ['TAIL_WAG', 'EXCITED'];
    case 'listening':
      return ['EAR_PERK', 'HEAD_TILT'];
    default:
      return [];
  }
}

export default function Onboarding({ state, micAvailable, onAdvance, Renderer }: Props) {
  const [typed, setTyped] = useState('');
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(14)).current;

  // Each line arrives rather than appears. The same 260ms as the speech
  // bubble in the room, so the app already feels consistent.
  useEffect(() => {
    fade.setValue(0);
    rise.setValue(14);
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.spring(rise, { toValue: 0, friction: 7, tension: 60, useNativeDriver: true }),
    ]).start();
  }, [state.step, fade, rise]);

  const step = state.step;
  const wantsInput = needsInput(step);
  const canContinue = !wantsInput || typed.trim().length > 0;

  const go = (skip = false) => {
    onAdvance(advance(state, { input: typed, skip, micAvailable }));
    setTyped('');
  };

  return (
    <LinearGradient colors={[color.well, color.fill]} style={styles.fill}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.stage}>
          <Animated.View
            style={[styles.bubble, { opacity: fade, transform: [{ translateY: rise }] }]}
            accessibilityLiveRegion="polite"
          >
            <Text style={styles.line}>{lineFor(state)}</Text>
            <View style={styles.tail} />
          </Animated.View>

          <View style={styles.dog}>
            <Renderer state="idle" actions={actionsFor(state)} />
          </View>
        </View>

        <View style={styles.controls}>
          {wantsInput && (
            <TextInput
              style={styles.input}
              value={typed}
              onChangeText={setTyped}
              placeholder="your name"
              placeholderTextColor={color.inkFaint}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={24}
              returnKeyType="done"
              onSubmitEditing={() => canContinue && go()}
              accessibilityLabel="Type your name for Barkly"
            />
          )}

          <Pressable
            style={[styles.primary, !canContinue && styles.primaryOff]}
            disabled={!canContinue}
            onPress={() => go()}
            accessibilityRole="button"
            accessibilityLabel={actionFor(step)}
          >
            <Text style={styles.primaryText}>{actionFor(step)}</Text>
          </Pressable>

          {/* Always available, never shouty. A child who will not type is
              not a child who should be stuck. */}
          {step !== 'greeting' && step !== 'delight' && (
            <Pressable style={styles.skip} onPress={() => go(true)} accessibilityRole="button">
              <Text style={styles.skipText}>
                {step === 'listening' ? 'not right now' : 'skip'}
              </Text>
            </Pressable>
          )}

          <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no">
            {(['greeting', 'name', 'delight', 'listening'] as const).map((s) => (
              <View key={s} style={[styles.dot, s === step && styles.dotOn]} />
            ))}
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  // Centred, not bottom-aligned: he should meet you at eye level, not sit in
  // a pile of empty space at the bottom of a tall phone.
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  bubble: {
    backgroundColor: color.card,
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 16,
    maxWidth: 340,
    marginBottom: 18,
    ...elevation.card,
  },
  line: { fontSize: 20, lineHeight: 27, fontWeight: '700', color: color.ink },
  tail: {
    position: 'absolute',
    bottom: -9,
    left: '50%',
    marginLeft: -9,
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: color.card,
  },
  dog: { width: 260, height: 300, alignItems: 'center', justifyContent: 'flex-end' },
  controls: { paddingHorizontal: 26, paddingBottom: 34, gap: 12 },
  input: {
    backgroundColor: color.card,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 14,
    fontSize: 17,
    color: color.ink,
  },
  primary: {
    backgroundColor: color.ink,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryOff: { backgroundColor: color.inkFaint },
  primaryText: { color: color.card, fontSize: 17, fontWeight: '800' },
  skip: { alignItems: 'center', paddingVertical: 6 },
  skipText: { color: color.inkSoft, fontSize: 13 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 8, backgroundColor: color.line },
  dotOn: { backgroundColor: color.inkSoft, width: 18 },
});
