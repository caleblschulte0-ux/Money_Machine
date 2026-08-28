/**
 * Settings — what Barkly knows, remembers and has been taught, plus provider
 * status and privacy controls. Learned tricks are visible and individually
 * deletable: behavior should never become hidden state.
 *
 * Developer controls are compiled behind EXPO_PUBLIC_BARKLY_DEV=1. A normal
 * production build has no UI path to grants/unlocks, even though the hook keeps
 * the tooling available for explicitly configured development builds.
 */

import React, { useState } from 'react';
import { color } from './theme';
import { TAP_MIN } from './layout';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ParentalGate from './ParentalGate';
import PrivacySheet from './PrivacySheet';
import { MemoryState } from '../barkly/memory';
import { BarklyStats } from '../barkly/types';
import { Treasure } from '../world/stash';
import { DEFAULT_SHAPE, PITCH_RANGE, RATE_RANGE, VoiceShape } from '../providers/tts/expoSpeechTts';

/**
 * Dev tools are OPT-OUT, not opt-in.
 *
 * They were briefly gated behind EXPO_PUBLIC_BARKLY_DEV === '1', which meant
 * an ordinary build had no way to reach the toggle at all — re-creating the
 * exact soft-lock the operator asked to be rid of ("don't soft lock me out of
 * stuff"). The concern behind that gate is real: a shipped App Store build
 * should not carry a button that unlocks the whole game. So the concern is
 * kept, and moved to where it belongs — the release build sets
 * EXPO_PUBLIC_BARKLY_HIDE_DEV=1, and release-preflight REQUIRES it. Every
 * other build, including the operator's, has the toggle.
 */
const DEV_TOOLS_VISIBLE = process.env.EXPO_PUBLIC_BARKLY_HIDE_DEV !== '1';


interface Props {
  visible: boolean;
  onClose: () => void;
  memory: MemoryState;
  stats: BarklyStats;
  stash: Treasure[];
  dialogueProviderName: string;
  brain: { using: 'primary' | 'fallback'; breakerOpen: boolean; lastFailure?: string };
  modelConfigured: boolean;
  voice: { route: 'barkly' | 'device' | 'silent' | null; muted: boolean };
  sttAvailable: boolean;
  /** Remove one learned fact/trick without wiping everything. */
  onForgetFact?: (id: string) => Promise<void>;
  devMode: boolean;
  onSetDevMode: (on: boolean) => void;
  showcase: boolean;
  onSetShowcase: (on: boolean) => void;
  voices: { id: string; name: string; language: string }[];
  voiceShape: VoiceShape;
  onSetVoiceShape: (next: Partial<VoiceShape>) => void;
  onPreviewVoice: () => void;
  onGrantCoins: (n: number) => void;
  onGrantLevel: (n: number) => void;
  onGrantEverything: () => void;
  onForgetEverything: () => Promise<void>;
}

/** A plain +/- stepper. No slider dependency, and it is reachable by name. */
function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const step = 0.04;
  const shown = `${Math.round(value * 100)}%`;
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <Pressable
        style={styles.stepperBtn}
        onPress={() => onChange(Math.max(min, Number((value - step).toFixed(2))))}
        accessibilityRole="button"
        accessibilityLabel={`${label} down`}
      >
        <Text style={styles.stepperBtnText}>−</Text>
      </Pressable>
      <Text style={styles.stepperValue}>{shown}</Text>
      <Pressable
        style={styles.stepperBtn}
        onPress={() => onChange(Math.min(max, Number((value + step).toFixed(2))))}
        accessibilityRole="button"
        accessibilityLabel={`${label} up`}
      >
        <Text style={styles.stepperBtnText}>+</Text>
      </Pressable>
    </View>
  );
}

function StatBar({ label, value, invert }: { label: string; value: number; invert?: boolean }) {
  const shown = invert ? 100 - value : value;
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statTrack}>
        <View style={[styles.statFill, { width: `${Math.max(4, shown)}%` }]} />
      </View>
    </View>
  );
}

export default function SettingsSheet(props: Props) {
  const {
    visible,
    onClose,
    memory,
    stats,
    stash,
    dialogueProviderName,
    brain,
    modelConfigured,
    voice,
    sttAvailable,
    onForgetFact,
    onForgetEverything,
    devMode,
    onSetDevMode,
    showcase,
    onSetShowcase,
    voices,
    voiceShape,
    onSetVoiceShape,
    onPreviewVoice,
    onGrantCoins,
    onGrantLevel,
    onGrantEverything,
  } = props;
  const [wiping, setWiping] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);

  const doForget = async () => {
    setWiping(true);
    await onForgetEverything();
    setWiping(false);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            {/*
        Tapping the dimmed area closes the sheet.

        Five bottom sheets shipped without it. The backdrop looks tappable,
        every other app on the phone behaves that way, and the only way out was
        a 15px ✕ in the corner — which is also the smallest tap target in the
        app. `accessible={false}` keeps it out of the screen-reader order; the
        ✕ is the labelled way out.
      */}
      <Pressable style={styles.backdrop} onPress={onClose} accessible={false}>
        <Pressable style={styles.sheet} onPress={() => {}} accessible={false}>
          <View style={styles.header}>
            <Text style={styles.title}>Settings</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close settings">
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.scroll}>
            <Text style={styles.section}>How Barkly is doing</Text>
            <StatBar label="mood" value={stats.mood} />
            <StatBar label="energy" value={stats.energy} />
            <StatBar label="tummy" value={stats.hunger} invert />
            <StatBar label="bond" value={stats.affection} />

            <Text style={styles.section}>Barkly's stash</Text>
            {stash.length === 0 && <Text style={styles.empty}>Nothing yet. There's a dig spot at the park…</Text>}
            {stash.map((t) => (
              // The names ARE the joke — "a rock that looks like a duck",
              // "a very old sandwich (do not ask)". They carried an emoji each,
              // which was both the system's drawing rather than ours and a
              // second, worse punchline in front of the first.
              <Text key={t.id} style={styles.row}>· {t.name}</Text>
            ))}

            <Text style={styles.section}>Providers</Text>
            <Text style={styles.row}>Dialogue: {dialogueProviderName}</Text>
            <Text style={styles.row}>
              Brain:{' '}
              {!modelConfigured
                ? 'offline Barkly (no model configured in this build)'
                : brain.using === 'primary'
                  ? 'live model'
                  : brain.breakerOpen
                    ? 'offline Barkly (resting after a few failures)'
                    : 'offline Barkly (last answer)'}
            </Text>
            {brain.lastFailure && <Text style={styles.empty}>Last hiccup: {brain.lastFailure}</Text>}
            <Text style={styles.row}>
              Speech input: {sttAvailable ? 'on-device recognition' : 'keyboard (mic needs a dev build)'}
            </Text>
            <Text style={styles.row}>
              Voice:{' '}
              {voice.muted
                ? 'muted'
                : voice.route === 'barkly'
                  ? "Barkly's own voice"
                  : voice.route === 'device'
                    ? 'device voice (his own is unavailable)'
                    : voice.route === 'silent'
                      ? 'silent — no speech engine here'
                      : 'not used yet'}
            </Text>

            <Text style={styles.section}>His voice</Text>
            <Text style={styles.voiceBlurb}>
              He was pitched a third of an octave up, which the speech engines do by resampling —
              that is where the chipmunk came from. Pick a voice and set how he sounds; tap “hear it”
              after each change.
            </Text>

            <View style={styles.voiceList}>
              <Pressable
                style={[styles.voiceRow, !voiceShape.voiceId && styles.voiceRowOn]}
                onPress={() => onSetVoiceShape({ voiceId: undefined })}
                accessibilityRole="radio"
                accessibilityState={{ selected: !voiceShape.voiceId }}
                accessibilityLabel="Voice: best available, chosen automatically"
              >
                <Text style={styles.voiceName}>Best available</Text>
                <Text style={styles.voiceLang}>auto</Text>
              </Pressable>
              {voices.slice(0, 8).map((v) => (
                <Pressable
                  key={v.id}
                  style={[styles.voiceRow, voiceShape.voiceId === v.id && styles.voiceRowOn]}
                  onPress={() => onSetVoiceShape({ voiceId: v.id })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: voiceShape.voiceId === v.id }}
                  accessibilityLabel={`Voice: ${v.name}`}
                >
                  <Text style={styles.voiceName} numberOfLines={1}>{v.name}</Text>
                  <Text style={styles.voiceLang}>{v.language}</Text>
                </Pressable>
              ))}
              {voices.length === 0 && (
                <Text style={styles.empty}>This device has not told us what voices it has.</Text>
              )}
            </View>

            <Stepper
              label="Pitch"
              value={voiceShape.pitch}
              min={PITCH_RANGE.min}
              max={PITCH_RANGE.max}
              onChange={(pitch) => onSetVoiceShape({ pitch })}
            />
            <Stepper
              label="Speed"
              value={voiceShape.rate}
              min={RATE_RANGE.min}
              max={RATE_RANGE.max}
              onChange={(rate) => onSetVoiceShape({ rate })}
            />
            <Pressable style={styles.hearIt} onPress={onPreviewVoice} accessibilityRole="button" accessibilityLabel="Hear it">
              <Text style={styles.hearItText}>hear it</Text>
            </Pressable>
            <Pressable
              style={styles.voiceReset}
              onPress={() => onSetVoiceShape({ voiceId: undefined, ...DEFAULT_SHAPE })}
              accessibilityRole="button"
              accessibilityLabel="Reset his voice to the default"
            >
              <Text style={styles.voiceResetText}>reset to default</Text>
            </Pressable>

            {DEV_TOOLS_VISIBLE && (
              <>
                <Text style={styles.section}>Developer</Text>
                <Pressable
                  style={[styles.devRow, devMode && styles.devRowOn]}
                  onPress={() => onSetDevMode(!devMode)}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: devMode }}
                  accessibilityLabel="Dev mode: unlock every area and shop item"
                >
                  <View style={styles.devRowText}>
                    <Text style={styles.devTitle}>Dev mode</Text>
                    <Text style={styles.devBlurb}>
                      Every area and shop item open, and everything free. Your real coins and level are
                      untouched — turning it off puts you back exactly where you were.
                    </Text>
                  </View>
                  <Text style={styles.devState}>{devMode ? 'ON' : 'off'}</Text>
                </Pressable>

                <Pressable
                  style={[styles.devRow, showcase && styles.devRowOn]}
                  onPress={() => onSetShowcase(!showcase)}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: showcase }}
                  accessibilityLabel="Everything at once: show every popup together to check the spacing"
                >
                  <View style={styles.devRowText}>
                    <Text style={styles.devTitle}>Everything at once</Text>
                    <Text style={styles.devBlurb}>
                      Forces every popup on screen together — a notice, his speech, a thought, an NPC
                      bubble, the state chip and an error — so you can see whether anything collides.
                    </Text>
                  </View>
                  <Text style={styles.devState}>{showcase ? 'ON' : 'off'}</Text>
                </Pressable>

                {devMode && (
                  <View style={styles.devGrants}>
                    <Pressable style={styles.grant} onPress={() => onGrantCoins(1000)} accessibilityRole="button">
                      <Text style={styles.grantText}>+1000 coins</Text>
                    </Pressable>
                    <Pressable style={styles.grant} onPress={() => onGrantLevel(7)} accessibilityRole="button">
                      <Text style={styles.grantText}>Level 7</Text>
                    </Pressable>
                    <Pressable style={styles.grant} onPress={onGrantEverything} accessibilityRole="button">
                      <Text style={styles.grantText}>Give me everything</Text>
                    </Pressable>
                  </View>
                )}
              </>
            )}

            <Text style={styles.section}>What Barkly knows about you</Text>
            {memory.facts.length === 0 && <Text style={styles.empty}>Nothing yet. Tell him your name.</Text>}
            {memory.facts.map((f) => (
              <View key={f.id} style={styles.factRow}>
                <Text style={styles.factText}>
                  • {f.subject === 'person' ? '' : `${f.subject}: `}
                  {f.key.replace(/_/g, ' ')} — {f.value}
                </Text>
                {onForgetFact && (
                  <Pressable
                    hitSlop={10}
                    onPress={() => void onForgetFact(f.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Make Barkly forget: ${f.key.replace(/_/g, ' ')} ${f.value}`}
                  >
                    <Text style={styles.factForget}>forget</Text>
                  </Pressable>
                )}
              </View>
            ))}

            <Text style={styles.section}>Tricks you taught Barkly</Text>
            {memory.trainingRules.length === 0 && (
              <Text style={styles.empty}>None yet. Try: “When I say intruder alert, act terrified.”</Text>
            )}
            {memory.trainingRules.map((rule) => (
              <View key={rule.id} style={styles.factRow}>
                <Text style={styles.factText}>
                  • “{rule.cue}” → {rule.instruction}
                  {rule.timesTriggered > 0 ? ` · used ${rule.timesTriggered}×` : ''}
                </Text>
                {onForgetFact && (
                  <Pressable
                    hitSlop={10}
                    onPress={() => void onForgetFact(rule.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Make Barkly forget the trick ${rule.cue}`}
                  >
                    <Text style={styles.factForget}>forget</Text>
                  </Pressable>
                )}
              </View>
            ))}

            <Text style={styles.section}>What Barkly remembers doing with you</Text>
            {memory.barklyMemories.length === 0 && <Text style={styles.empty}>No shared memories yet.</Text>}
            {memory.barklyMemories.map((f) => (
              <Text key={f} style={styles.row}>• {f}</Text>
            ))}

            <Pressable
              style={styles.forget}
              onPress={() => setGateOpen(true)}
              disabled={wiping}
              accessibilityRole="button"
            >
              <Text style={styles.forgetText}>{wiping ? 'Forgetting…' : 'Forget everything'}</Text>
            </Pressable>

            <Pressable style={styles.parents} onPress={() => setPrivacyOpen(true)} accessibilityRole="button">
              <Text style={styles.parentsText}>For parents: microphone, data and deletion</Text>
            </Pressable>

            <Text style={styles.note}>
              Audio is only captured while you hold TALK and never stored. Speech is
              recognized on this device; only the text is sent to the dialogue provider.
            </Text>
          </ScrollView>

          <ParentalGate
            visible={gateOpen}
            purpose="This permanently deletes everything Barkly remembers. It cannot be undone."
            onPass={() => {
              setGateOpen(false);
              void doForget();
            }}
            onCancel={() => setGateOpen(false)}
          />
          <PrivacySheet
            visible={privacyOpen}
            onClose={() => setPrivacyOpen(false)}
            modelConfigured={modelConfigured}
            micAvailable={sttAvailable}
            onForgetEverything={() => {
              setPrivacyOpen(false);
              void doForget();
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: color.paper,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    padding: 20,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: color.ink },
  /**
   * The way out of a sheet, at a real tap size.
   *
   * Seven sheets each declared this separately and every one of them measured
   * about 23x22 — a 15-18px glyph with 4px of padding. Six of the seven even
   * carried a comment saying the X was "the labelled way out", which was true
   * and beside the point: it was the smallest target in the app, on the
   * control a child needs when they are stuck. layout.TAP_MIN, like the rest.
   */
  close: { fontSize: 18, lineHeight: TAP_MIN, width: TAP_MIN, height: TAP_MIN, textAlign: 'center', color: color.ink },
  scroll: { marginTop: 8 },
  section: { marginTop: 16, marginBottom: 6, fontSize: 13, fontWeight: '800', color: color.inkSoft, textTransform: 'uppercase' },
  row: { fontSize: 15, color: color.ink, marginBottom: 4 },
  empty: { fontSize: 13, color: color.inkSoft, fontStyle: 'italic' },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 7 },
  statLabel: { width: 56, fontSize: 13, fontWeight: '700', color: color.inkSoft },
  statTrack: { flex: 1, height: 9, borderRadius: 8, backgroundColor: color.line, overflow: 'hidden' },
  statFill: { height: 9, borderRadius: 8, backgroundColor: color.gold },
  forget: {
    marginTop: 24,
    backgroundColor: color.brand,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    minHeight: TAP_MIN,
    justifyContent: 'center',
  },
  forgetText: { color: color.inkOn, fontWeight: '800', fontSize: 15 },
  factRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  factText: { flex: 1, fontSize: 13, color: color.inkMid, lineHeight: 21 },
  // A 31x20 'forget' link next to each remembered fact — the control that
  // deletes something Barkly knows about you, at two-thirds the minimum tap
  // size. Destructive and hard to hit is the worst pair.
  factForget: {
    fontSize: 12,
    color: color.brand,
    lineHeight: TAP_MIN,
    minWidth: TAP_MIN,
    textAlign: 'center',
  },
  voiceBlurb: { fontSize: 12, lineHeight: 17, color: color.inkSoft, marginBottom: 10 },
  voiceList: { gap: 6, marginBottom: 12 },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: color.well,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  voiceRowOn: { borderColor: color.ink, backgroundColor: color.inkOn },
  voiceName: { flex: 1, fontSize: 13, fontWeight: '700', color: color.ink },
  voiceLang: { fontSize: 12, color: color.inkSoft },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  stepperLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: color.ink },
  stepperBtn: {
    width: TAP_MIN,
    height: TAP_MIN,
    borderRadius: 12,
    backgroundColor: color.fill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: { fontSize: 17, fontWeight: '900', color: color.ink },
  stepperValue: { minWidth: 52, textAlign: 'center', fontSize: 13, fontWeight: '800', color: color.ink },
  hearIt: {
    alignSelf: 'flex-start',
    marginTop: 4,
    minHeight: TAP_MIN,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: color.ink,
  },
  hearItText: { color: color.card, fontSize: 13, fontWeight: '800' },
  voiceReset: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    minHeight: TAP_MIN,
    justifyContent: 'center',
  },
  voiceResetText: { fontSize: 13, color: color.inkSoft, textDecorationLine: 'underline' },
  devRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: color.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  devRowOn: { borderColor: color.gold },
  devRowText: { flex: 1 },
  devTitle: { fontSize: 15, fontWeight: '700', color: color.ink },
  devBlurb: { fontSize: 13, lineHeight: 19, color: color.inkSoft, marginTop: 3 },
  devState: { fontSize: 13, fontWeight: '800', color: color.goldInk },
  devGrants: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  grant: { backgroundColor: color.fill, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  grantText: { fontSize: 13, fontWeight: '700', color: color.inkMid },
  parents: {
    marginTop: 10,
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: color.fill,
    minHeight: TAP_MIN,
    justifyContent: 'center',
  },
  parentsText: { fontSize: 15, fontWeight: '700', color: color.inkMid },
  note: { marginTop: 14, marginBottom: 24, fontSize: 12, color: color.inkSoft, lineHeight: 17 },
});
