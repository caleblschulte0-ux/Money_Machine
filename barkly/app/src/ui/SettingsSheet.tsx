/**
 * Settings — deliberately small: what Barkly remembers (with the delete-all
 * control the privacy posture requires), and which providers are live.
 */

import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MemoryState } from '../barkly/memory';
import { BarklyStats } from '../barkly/types';
import { Treasure } from '../world/stash';

interface Props {
  visible: boolean;
  onClose: () => void;
  memory: MemoryState;
  stats: BarklyStats;
  stash: Treasure[];
  dialogueProviderName: string;
  /** Which brain answered last, so an outage is visible rather than mysterious. */
  brain: { using: 'primary' | 'fallback'; breakerOpen: boolean; lastFailure?: string };
  modelConfigured: boolean;
  /** Which link of the voice chain last made a sound, and whether he is muted. */
  voice: { route: 'barkly' | 'device' | 'silent' | null; muted: boolean };
  sttAvailable: boolean;
  onForgetEverything: () => Promise<void>;
}

function StatBar({ label, value, invert }: { label: string; value: number; invert?: boolean }) {
  // For hunger, "full" is the good end — invert the display so full bars
  // always mean "he's doing great".
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
    onForgetEverything,
  } = props;
  const [wiping, setWiping] = useState(false);

  const confirmForget = () => {
    Alert.alert(
      'Forget everything?',
      "This permanently deletes Barkly's memory of you — conversations, facts, promises. He will start over.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forget',
          style: 'destructive',
          onPress: async () => {
            setWiping(true);
            await onForgetEverything();
            setWiping(false);
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Settings</Text>
            <Pressable onPress={onClose} hitSlop={12}>
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
              <Text key={t.id} style={styles.row}>{t.icon}  {t.name}</Text>
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

            <Text style={styles.section}>What Barkly knows about you</Text>
            {memory.userFacts.length === 0 && <Text style={styles.empty}>Nothing yet. Tell him your name.</Text>}
            {memory.userFacts.map((f) => (
              <Text key={f} style={styles.row}>• {f}</Text>
            ))}

            <Text style={styles.section}>What Barkly remembers doing with you</Text>
            {memory.barklyMemories.length === 0 && <Text style={styles.empty}>No shared memories yet.</Text>}
            {memory.barklyMemories.map((f) => (
              <Text key={f} style={styles.row}>• {f}</Text>
            ))}

            <Pressable style={styles.forget} onPress={confirmForget} disabled={wiping}>
              <Text style={styles.forgetText}>{wiping ? 'Forgetting…' : 'Forget everything'}</Text>
            </Pressable>
            <Text style={styles.note}>
              Audio is only captured while you hold TALK and never stored. Speech is
              recognized on this device; only the text is sent to the dialogue provider.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFF9EC',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    padding: 20,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: '#2E2A26' },
  close: { fontSize: 18, color: '#2E2A26' },
  scroll: { marginTop: 8 },
  section: { marginTop: 16, marginBottom: 6, fontSize: 13, fontWeight: '800', color: '#8B7B55', textTransform: 'uppercase' },
  row: { fontSize: 15, color: '#2E2A26', marginBottom: 4 },
  empty: { fontSize: 14, color: '#9A8F7A', fontStyle: 'italic' },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 7 },
  statLabel: { width: 56, fontSize: 13, fontWeight: '700', color: '#8B7B55' },
  statTrack: { flex: 1, height: 9, borderRadius: 5, backgroundColor: '#E8DCC0', overflow: 'hidden' },
  statFill: { height: 9, borderRadius: 5, backgroundColor: '#C6952F' },
  forget: {
    marginTop: 24,
    backgroundColor: '#B3402E',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  forgetText: { color: 'white', fontWeight: '800', fontSize: 15 },
  note: { marginTop: 14, marginBottom: 24, fontSize: 12, color: '#9A8F7A', lineHeight: 17 },
});
