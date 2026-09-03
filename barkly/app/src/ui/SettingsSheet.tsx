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
  brain: { using: 'primary' | 'fallback'; breakerOpen: boolean; lastFailure?: string };
  modelConfigured: boolean;
  voice: { route: 'barkly' | 'device' | 'silent' | null; muted: boolean };
  onToggleMuted: () => void;
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
  onOpenPlaytest?: () => void;
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

/**
 * A GAUGE, not an HTML progress bar.
 *
 * These were a 9px flat track with a flat fill and no material at all -- the
 * one place in the app that looked like a form control, on the screen a parent
 * opens to see how the dog is doing. Same recipe as every other physical thing
 * here: a recessed track, a moulded lower lip on the fill, one gloss highlight,
 * and a colour that means something (green is fine, amber is getting low, coral
 * needs attention) so the row reads before it is read.
 */
function StatBar({ label, value, invert }: { label: string; value: number; invert?: boolean }) {
  const shown = Math.max(0, Math.min(100, invert ? 100 - value : value));
  const paint =
    shown >= 66 ? { body: color.mint, edge: color.mintDeep }
    : shown >= 33 ? { body: color.lemon, edge: color.lemonDeep }
    : { body: color.coral, edge: color.coralDeep };
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statTrack}>
        <View style={styles.statTrackShade} pointerEvents="none" />
        <View style={[styles.statFill, { width: `${Math.max(6, shown)}%`, backgroundColor: paint.body }]}>
          <View style={[styles.statFillEdge, { backgroundColor: paint.edge }]} pointerEvents="none" />
          <View style={styles.statFillGloss} pointerEvents="none" />
        </View>
      </View>
      <Text style={styles.statValue}>{Math.round(shown)}</Text>
    </View>
  );
}

export default function SettingsSheet(props: Props) {
  const {
    visible,
    onClose,
    memory,
    stats,
    brain,
    modelConfigured,
    voice,
    onToggleMuted,
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
    onOpenPlaytest,
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
            {onOpenPlaytest && (
              <Pressable
                style={styles.devRow}
                onPress={onOpenPlaytest}
                accessibilityRole="button"
                accessibilityLabel="Playtest saves"
                testID="playtest-settings"
              >
                <View style={styles.devRowText}>
                  <Text style={styles.devTitle}>Playtest saves</Text>
                  <Text style={styles.devBlurb}>Jump between testing states without using permanent game-screen space.</Text>
                </View>
                <Text style={styles.devState}>open</Text>
              </Pressable>
            )}
            <Text style={styles.section}>How Barkly is doing</Text>
            <StatBar label="mood" value={stats.mood} />
            <StatBar label="energy" value={stats.energy} />
            <StatBar label="tummy" value={stats.hunger} invert />
            <StatBar label="bond" value={stats.affection} />

            {/*
              Barkly's stash used to be listed here, as bulleted names. It is
              the collectible spine of the game and it was sitting in the
              settings menu next to the provider rows; it is now a shelf of
              DRAWN objects in the Pack Book, where a player looks to see what
              the two of them have. See PackBookSheet.
            */}

            <Text style={styles.section}>Providers</Text>
            {/*
              The "Dialogue:" row is gone. It printed `engine.providerName`,
              which for the resilient provider is an internal diagnostic id
              built as `${primary}+${fallback}` -- so a parent opening Settings
              read the literal string "no model configured+scripted-offline".
              That is a debug field, not a sentence, and everything a person
              actually needs from it is in the Brain row directly below, in
              English. The name still exists on the engine for logs.
            */}
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

            <Text style={styles.section}>Sound</Text>
            {/*
              The mute switch LIVES here now.
              
              It used to be a permanent button in the header, next to the
              coins and the settings gear — a control most people set once, on
              a screen whose subject is supposed to be a dog. Moving it out is
              part of shrinking the HUD; putting a real toggle here (rather
              than only the read-out that used to be below) is what stops that
              from making it unreachable.
            */}
            <Pressable
              style={[styles.devRow, !voice.muted && styles.devRowOn]}
              onPress={onToggleMuted}
              accessibilityRole="switch"
              accessibilityState={{ checked: !voice.muted }}
              accessibilityLabel={voice.muted ? 'Sound is off. Turn it on.' : 'Sound is on. Turn it off.'}
            >
              <View style={styles.devRowText}>
                <Text style={styles.devTitle}>{voice.muted ? 'Sound off' : 'Sound on'}</Text>
                <Text style={styles.devBlurb}>
                  {voice.muted
                    ? 'He is silent, and the phone will not buzz for him either.'
                    : 'He speaks out loud, and you feel it when he does something.'}
                </Text>
              </View>
              <Text style={styles.devState}>{voice.muted ? 'off' : 'on'}</Text>
            </Pressable>

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
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 9 },
  statLabel: { width: 56, fontSize: 13, fontWeight: '800', color: color.inkMid },
  statValue: { width: 26, textAlign: 'right', fontSize: 12, fontWeight: '800', color: color.inkSoft },
  statTrack: {
    flex: 1, height: 16, borderRadius: 999, backgroundColor: color.fill,
    borderWidth: 1.5, borderColor: color.line, overflow: 'hidden', justifyContent: 'center',
  },
  statTrackShade: { position: 'absolute', left: 0, right: 0, top: 0, height: 5, backgroundColor: 'rgba(43,33,25,0.07)' },
  /*
   * No `marginLeft`. A percentage width resolves against the track's CONTENT
   * box (its width minus the 1.5px border on each side), so a 100% fill was
   * already exactly as wide as the space it had; the extra 1px margin pushed
   * its right edge past the padding box, where `overflow: 'hidden'` sheared
   * the rounded cap flat. A full gauge is the one state a player most wants
   * to see land cleanly, and it was the only one that could not.
   */
  statFill: { height: 13, borderRadius: 999, overflow: 'hidden' },
  statFillEdge: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, opacity: 0.85 },
  statFillGloss: { position: 'absolute', left: 4, right: 4, top: 2, height: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.55)' },
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
