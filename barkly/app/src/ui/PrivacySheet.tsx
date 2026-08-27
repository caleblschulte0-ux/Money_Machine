/**
 * The parent screen.
 *
 * This is written for the adult who is deciding whether to let a child talk
 * to this thing, so it is plain, specific, and reachable in one tap from
 * Settings. It answers three questions in the order a parent asks them:
 * what leaves the phone, what is kept, and how do I stop it.
 *
 * It states what the SOFTWARE does. It deliberately makes no claim about
 * legal compliance — engineering controls are evidence for that argument,
 * never the argument itself, and a screen that says "COPPA compliant"
 * because a developer implemented some controls is the exact failure the
 * brief warns about. docs/PRIVACY.md carries the data-flow description that
 * counsel actually needs.
 */

import React, { useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import ParentalGate from './ParentalGate';

const INK = '#3E332A';
const INK_SOFT = '#7A6A55';
const CARD = '#FFFDF7';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Live truth, not a promise: is a real model configured in THIS build? */
  modelConfigured: boolean;
  /** Whether the microphone is usable here at all. */
  micAvailable: boolean;
  onForgetEverything: () => void;
}

function Item({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.item}>
      <Text style={styles.itemTitle}>{title}</Text>
      <Text style={styles.itemBody}>{children}</Text>
    </View>
  );
}

export default function PrivacySheet({
  visible,
  onClose,
  modelConfigured,
  micAvailable,
  onForgetEverything,
}: Props) {
  // The two things a child must not be able to do by tapping around.
  const [gate, setGate] = useState<'delete' | 'policy' | null>(null);

  const passGate = () => {
    const which = gate;
    setGate(null);
    if (which === 'delete') onForgetEverything();
    if (which === 'policy') {
      Linking.openURL('https://example.invalid/barkly-privacy').catch(() => {});
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>For parents</Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.lead}>
              Barkly is a character your child talks to. Here is exactly what that involves.
            </Text>

            <Text style={styles.section}>The microphone</Text>
            <Item title="Only while the button is held">
              {micAvailable
                ? 'Audio is captured only between pressing and releasing TALK. There is no always-on listening, no wake word, and no background recording. The dog visibly changes to a listening pose the entire time — if he is not listening, the microphone is not on.'
                : 'This build has no speech recognition available, so nothing is captured at all. Your child types to him instead.'}
            </Item>
            <Item title="The recording is never stored or sent">
              Speech is turned into text by your device&apos;s own speech recognition. The audio itself
              never leaves the phone and is not written to disk. Only the resulting text continues.
            </Item>

            <Text style={styles.section}>What leaves the phone</Text>
            <Item title={modelConfigured ? 'The words, and what he remembers' : 'Nothing — this build is offline'}>
              {modelConfigured
                ? 'To answer, Barkly sends the text of what was said, plus the short list of things he remembers about your child, to the service that generates his replies. That is the whole payload. No contacts, no location, no device identifiers beyond a random number generated on this phone so the service can stop one device making thousands of requests.'
                : 'This build has no dialogue service configured. Everything Barkly says comes from lines built into the app, and nothing your child types is sent anywhere.'}
            </Item>
            <Item title="No advertising, no analytics on conversations">
              Nothing your child says is used for advertising, sold, or fed into product analytics.
              There is no ad network in this app.
            </Item>

            <Text style={styles.section}>What is kept, and where</Text>
            <Item title="On this phone only">
              What Barkly knows about your child — a name, a favourite colour, things they did
              together — is stored in this app on this device. It is not synced, backed up to us,
              or readable by anyone else. You can see the complete list in Settings; it is not a
              summary, it is everything he has.
            </Item>

            <Text style={styles.section}>How to stop it</Text>
            <Item title="Forget everything">
              This permanently deletes every fact, memory and conversation, resets his personality
              drift, and gives the app a new random identifier — the same state as a fresh install.
              It happens immediately and cannot be undone.
            </Item>
            <Item title="Turn off the microphone">
              Deny or revoke microphone permission in your device settings. Barkly keeps working;
              your child types to him instead.
            </Item>

            <Pressable
              style={styles.danger}
              onPress={() => setGate('delete')}
              accessibilityRole="button"
              accessibilityLabel="Delete everything Barkly remembers"
            >
              <Text style={styles.dangerText}>Delete everything Barkly remembers</Text>
            </Pressable>

            <Text style={styles.fine}>
              This screen describes what the software does. It is not a legal statement and does
              not by itself establish compliance with any children&apos;s privacy law — that is a
              judgement for the publisher and their counsel, informed by this behaviour rather
              than replaced by it.
            </Text>

            <Pressable onPress={() => setGate('policy')} accessibilityRole="link">
              <Text style={styles.link}>Full privacy policy</Text>
            </Pressable>
            <Text style={styles.fine}>
              (Placeholder URL — the published policy replaces it before release.)
            </Text>
          </ScrollView>

          <ParentalGate
            visible={gate !== null}
            purpose={
              gate === 'delete'
                ? 'This permanently deletes everything Barkly remembers. It cannot be undone.'
                : 'This opens a web page outside the app.'
            }
            onPass={passGate}
            onCancel={() => setGate(null)}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(40,32,22,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#F6EEDC', borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '92%' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 8,
  },
  title: { fontSize: 22, fontWeight: '800', color: INK },
  close: { fontSize: 20, color: INK_SOFT, paddingHorizontal: 6 },
  body: { paddingHorizontal: 22, paddingBottom: 34 },
  lead: { fontSize: 15, lineHeight: 22, color: INK, marginBottom: 6 },
  section: {
    marginTop: 20,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: '#A8987C',
    textTransform: 'uppercase',
  },
  item: { backgroundColor: CARD, borderRadius: 16, padding: 14, marginBottom: 8 },
  itemTitle: { fontSize: 15, fontWeight: '700', color: INK, marginBottom: 4 },
  itemBody: { fontSize: 14, lineHeight: 20, color: INK_SOFT },
  danger: {
    marginTop: 20,
    backgroundColor: '#B3402E',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  dangerText: { color: '#FFF6EC', fontSize: 16, fontWeight: '800' },
  fine: { marginTop: 14, fontSize: 12, lineHeight: 18, color: '#9A8F7A' },
  link: { marginTop: 14, fontSize: 14, color: '#7A6A55', textDecorationLine: 'underline' },
});
