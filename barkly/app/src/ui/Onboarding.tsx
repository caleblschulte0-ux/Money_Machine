/**
 * First launch. Not a tutorial — a meeting.
 *
 * The important continuity rule is literal now: the first Barkly you meet is
 * standing in the same Home scene he will still occupy after onboarding. The
 * old implementation said that in its comment while drawing a generic cream
 * gradient behind him; that tiny mismatch made onboarding feel like a splash
 * screen that happened to contain the dog.
 */

import React, { useEffect, useRef, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarklyRenderProps } from '../animation/renderer';
import {
  actionFor,
  advance,
  lineFor,
  needsInput,
  OnboardingState,
} from '../barkly/onboarding';
import { BodyAction } from '../barkly/types';
import { color, elevation, radius, space, type } from './theme';
import { HomeScene } from './scenes/Scenes';

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
    case 'teach':
      return ['EAR_PERK', 'HEAD_TILT'];
    // The payoff beat. He is mid-performance, not waiting politely -- this is
    // the one beat of onboarding the player is supposed to remember.
    case 'trick':
      return ['TAIL_WAG', 'EXCITED', 'MOUTH_MOVE'];
    case 'listening':
      return ['EAR_PERK', 'HEAD_TILT'];
    default:
      return [];
  }
}

export default function Onboarding({ state, micAvailable, onAdvance, Renderer }: Props) {
  const [typed, setTyped] = useState('');
  const [stageHeight, setStageHeight] = useState(420);
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(14)).current;
  const insets = useSafeAreaInsets();

  // Each line arrives rather than appears. The same fast, soft motion as the
  // room's dialogue panel, so onboarding does not establish a second visual
  // language that disappears five seconds later.
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
  const groundY = Math.max(250, stageHeight - 18);

  /*
   * THE PAYOFF HAS TO BE SEEN.
   *
   * Pressing the cue on the `trick` beat used to advance straight to the
   * microphone ask, so the player taught him a word and never watched it
   * work -- the one beat the whole meeting is built around, skipped by the
   * button that was supposed to trigger it. He now performs for a moment
   * first. The timing lives here rather than in the state machine because
   * that module is pure and the room's own speaking lifecycle is likewise
   * owned by the hook, not by the beat list.
   */
  const [performing, setPerforming] = useState(false);
  const performTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (performTimer.current) clearTimeout(performTimer.current); }, []);

  const go = (skip = false) => {
    onAdvance(advance(state, { input: typed, skip, micAvailable }));
    setTyped('');
  };

  const press = () => {
    if (step === 'trick' && state.cue && !performing) {
      setPerforming(true);
      performTimer.current = setTimeout(() => {
        setPerforming(false);
        go();
      }, 2400);
      return;
    }
    go();
  };

  return (
    <View style={styles.fill}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View
          style={[styles.stage, { paddingTop: Math.max(space.lg, insets.top + space.sm) }]}
          onLayout={(event) => setStageHeight(event.nativeEvent.layout.height)}
        >
          <HomeScene
            hour={new Date().getHours()}
            upgrades={[]}
            asleep={false}
            groundY={groundY}
            chromeBottom={0}
          />

          <Animated.View
            style={[styles.bubble, { opacity: fade, transform: [{ translateY: rise }] }]}
            accessibilityLiveRegion="polite"
          >
            <Text style={styles.line}>
              {performing ? 'I have tragically passed away.' : lineFor(state)}
            </Text>
            <View style={styles.tail} />
          </Animated.View>

          <View style={styles.dog}>
            <Renderer
              state={performing ? 'sleepy' : 'idle'}
              actions={performing ? ['SLEEP'] : actionsFor(state)}
            />
          </View>
        </View>

        <View style={[styles.controls, { paddingBottom: Math.max(space.xl, insets.bottom + space.md) }]}>
          {wantsInput && (
            <TextInput
              style={styles.input}
              value={typed}
              onChangeText={setTyped}
              placeholder={step === 'teach' ? 'a secret word' : 'your name'}
              placeholderTextColor={color.inkSoft}
              autoCapitalize={step === 'teach' ? 'characters' : 'words'}
              autoCorrect={false}
              maxLength={step === 'teach' ? 28 : 24}
              returnKeyType="done"
              onSubmitEditing={() => canContinue && press()}
              accessibilityLabel={
                step === 'teach'
                  ? 'Type a secret word to teach Barkly'
                  : 'Type your name for Barkly'
              }
            />
          )}

          <Pressable
            style={({ pressed }) => [
              styles.primary,
              pressed && canContinue && styles.primaryPressed,
              !canContinue && styles.primaryOff,
            ]}
            disabled={!canContinue || performing}
            onPress={press}
            accessibilityRole="button"
            accessibilityLabel={actionFor(step)}
          >
            {canContinue && <View style={styles.gloss} pointerEvents="none" />}
            {/*
              On the payoff beat the button is the CUE ITSELF, in their own
              word -- pressing "IRS" and watching him drop is the whole point,
              and a button that said "next" would have thrown that away.
            */}
            <Text style={styles.primaryText}>
              {step === 'trick' && state.cue ? state.cue : actionFor(step)}
            </Text>
          </Pressable>

          {/* Always available, never shouty. A child who will not type is
              not a child who should be stuck. */}
          {step !== 'greeting' && step !== 'delight' && step !== 'trick' && (
            <Pressable style={styles.skip} onPress={() => go(true)} accessibilityRole="button">
              <Text style={styles.skipText}>
                {step === 'listening' ? 'not right now' : 'skip'}
              </Text>
            </Pressable>
          )}

          <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {(['greeting', 'name', 'delight', 'teach', 'trick', 'listening'] as const).map((s) => (
              <View key={s} style={[styles.dot, s === step && styles.dotOn]} />
            ))}
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.paper },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' },
  bubble: {
    position: 'absolute',
    top: '9%',
    zIndex: 4,
    backgroundColor: color.card,
    borderRadius: radius.lg,
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
    width: '84%',
    maxWidth: 340,
    ...elevation.card,
  },
  line: { ...type.speech, color: color.ink, fontWeight: '700' },
  tail: {
    position: 'absolute',
    bottom: -8,
    left: '50%',
    marginLeft: -9,
    width: 18,
    height: 18,
    borderRadius: radius.xs / 2,
    backgroundColor: color.card,
    transform: [{ rotate: '45deg' }],
  },
  dog: { width: 300, height: 322, alignItems: 'center', justifyContent: 'flex-end', zIndex: 3, marginBottom: space.xs },
  controls: { backgroundColor: color.paper, paddingHorizontal: space.xl, paddingTop: space.lg, gap: space.md, borderTopWidth: 1, borderTopColor: color.line },
  input: {
    backgroundColor: color.card,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    ...type.speech,
    color: color.ink,
    ...elevation.low,
  },
  primary: {
    backgroundColor: color.pop,
    borderRadius: radius.pill,
    paddingVertical: space.lg,
    alignItems: 'center',
    overflow: 'hidden',
    ...elevation.card,
  },
  primaryPressed: { backgroundColor: color.popDeep, transform: [{ scale: 0.99 }] },
  primaryOff: { backgroundColor: color.fill, ...elevation.flat },
  gloss: { position: 'absolute', left: space.lg, right: space.lg, top: space.xs, height: 12, borderRadius: radius.pill, backgroundColor: color.inkOn, opacity: 0.4 },
  primaryText: { ...type.speech, color: color.ink, fontWeight: '800' },
  skip: { alignItems: 'center', paddingVertical: space.xs },
  skipText: { ...type.small, color: color.inkSoft },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: space.sm, marginTop: space.xxs },
  dot: { width: 6, height: 6, borderRadius: radius.pill, backgroundColor: color.line },
  dotOn: { backgroundColor: color.inkSoft, width: 18 },
});
