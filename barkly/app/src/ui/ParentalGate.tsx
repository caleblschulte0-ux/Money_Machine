/**
 * A parental gate: a small arithmetic challenge in front of the two actions a
 * child should not be able to take by tapping around — permanently deleting
 * everything Barkly remembers, and leaving the app for the web.
 *
 * It is a speed bump, not security. The point is that a six-year-old cannot
 * do it accidentally, and the honest framing matters: calling this
 * "verification" would be a lie, because an eleven-year-old solves it in two
 * seconds. It is the standard the platforms ask for and no more.
 *
 * The numbers are generated fresh each time so the answer cannot be learned.
 */

import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

const INK = '#3E332A';
const INK_SOFT = '#7A6A55';

interface Props {
  visible: boolean;
  /** What is behind the gate, shown so an adult knows what they are approving. */
  purpose: string;
  onPass: () => void;
  onCancel: () => void;
}

/** Two-digit numbers: past counting on fingers, well short of a real barrier. */
function challenge() {
  const a = 11 + Math.floor(Math.random() * 78);
  const b = 11 + Math.floor(Math.random() * 78);
  return { a, b, answer: a + b };
}

export default function ParentalGate({ visible, purpose, onPass, onCancel }: Props) {
  const [q, setQ] = useState(challenge);
  const [typed, setTyped] = useState('');
  const [wrong, setWrong] = useState(false);

  // A fresh sum every time it opens, so the answer cannot be memorised.
  useEffect(() => {
    if (visible) {
      setQ(challenge());
      setTyped('');
      setWrong(false);
    }
  }, [visible]);

  const submit = () => {
    if (Number(typed.trim()) === q.answer) {
      onPass();
    } else {
      setWrong(true);
      setQ(challenge());
      setTyped('');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Ask a grown-up</Text>
          <Text style={styles.purpose}>{purpose}</Text>

          <Text style={styles.sum} accessibilityLabel={`What is ${q.a} plus ${q.b}?`}>
            {q.a} + {q.b} = ?
          </Text>

          <TextInput
            style={[styles.input, wrong && styles.inputWrong]}
            value={typed}
            onChangeText={(t) => {
              setTyped(t);
              setWrong(false);
            }}
            keyboardType="number-pad"
            maxLength={4}
            autoFocus
            onSubmitEditing={submit}
            accessibilityLabel="Answer"
          />
          {/* Never colour alone: the message says what the border implies. */}
          {wrong && <Text style={styles.wrongText}>Not quite. Here is a different one.</Text>}

          <Pressable style={styles.primary} onPress={submit} accessibilityRole="button">
            <Text style={styles.primaryText}>continue</Text>
          </Pressable>
          <Pressable style={styles.cancel} onPress={onCancel} accessibilityRole="button">
            <Text style={styles.cancelText}>cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(40,32,22,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: { backgroundColor: '#FFFDF7', borderRadius: 24, padding: 24, width: '100%', maxWidth: 340 },
  title: { fontSize: 20, fontWeight: '800', color: INK },
  purpose: { fontSize: 14, lineHeight: 20, color: INK_SOFT, marginTop: 6 },
  sum: { fontSize: 30, fontWeight: '800', color: INK, textAlign: 'center', marginTop: 20 },
  input: {
    marginTop: 14,
    backgroundColor: '#F3EAD6',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    paddingVertical: 12,
    fontSize: 22,
    textAlign: 'center',
    color: INK,
  },
  inputWrong: { borderColor: '#B3402E' },
  wrongText: { marginTop: 8, fontSize: 13, color: '#B3402E', textAlign: 'center' },
  primary: {
    marginTop: 16,
    backgroundColor: INK,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#FFFDF7', fontSize: 16, fontWeight: '800' },
  cancel: { marginTop: 6, alignItems: 'center', paddingVertical: 8 },
  cancelText: { color: INK_SOFT, fontSize: 14 },
});
