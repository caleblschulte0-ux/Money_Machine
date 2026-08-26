/**
 * Settings — deliberately small: what Barkley remembers (with the delete-all
 * control the privacy posture requires), and which providers are live.
 */

import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MemoryState } from '../barkley/memory';

interface Props {
  visible: boolean;
  onClose: () => void;
  memory: MemoryState;
  dialogueProviderName: string;
  sttAvailable: boolean;
  onForgetEverything: () => Promise<void>;
}

export default function SettingsSheet(props: Props) {
  const { visible, onClose, memory, dialogueProviderName, sttAvailable, onForgetEverything } = props;
  const [wiping, setWiping] = useState(false);

  const confirmForget = () => {
    Alert.alert(
      'Forget everything?',
      "This permanently deletes Barkley's memory of you — conversations, facts, promises. He will start over.",
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
            <Text style={styles.section}>Providers</Text>
            <Text style={styles.row}>Dialogue: {dialogueProviderName}</Text>
            <Text style={styles.row}>
              Speech input: {sttAvailable ? 'on-device recognition' : 'keyboard (mic needs a dev build)'}
            </Text>

            <Text style={styles.section}>What Barkley knows about you</Text>
            {memory.userFacts.length === 0 && <Text style={styles.empty}>Nothing yet. Tell him your name.</Text>}
            {memory.userFacts.map((f) => (
              <Text key={f} style={styles.row}>• {f}</Text>
            ))}

            <Text style={styles.section}>What Barkley remembers doing with you</Text>
            {memory.barkleyMemories.length === 0 && <Text style={styles.empty}>No shared memories yet.</Text>}
            {memory.barkleyMemories.map((f) => (
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
