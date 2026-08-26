/**
 * The home screen — Barkly's room. Barkly is the product: he owns the
 * screen, the UI stays out of his way. Controls: TALK (hold), PLAY, FEED,
 * SLEEP, and a small settings control. No currencies, no popups, no banners.
 */

import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useBarkly } from '../hooks/useBarkly';
import BarklyView from './BarklyView';
import SettingsSheet from './SettingsSheet';
import { BarklyState } from '../barkly/types';

const STATE_LABEL: Partial<Record<BarklyState, string>> = {
  listening: 'listening',
  thinking: 'thinking',
  annoyed: 'hmph.',
  sleepy: 'napping',
  hungry: 'hungry',
  eating: 'nom nom',
  playing: 'zoomies',
};

const INK = '#3E3428';
const INK_SOFT = '#8A7A5F';
const WALL = '#F3EBDA';
const FLOOR = '#E9DDC2';
const CARD = '#FFFDF7';
const ACCENT = '#D99A2B';

export default function BarklyRoom() {
  const barkly = useBarkly();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [typed, setTyped] = useState('');

  const { snapshot, actions, lastExchange, partialTranscript, error, busy, sttAvailable } = barkly;
  const listening = snapshot.state === 'listening';
  const stateLabel = STATE_LABEL[snapshot.state];

  const sendTyped = async () => {
    const text = typed;
    setTyped('');
    await barkly.submitText(text);
  };

  const bubbleText = listening && partialTranscript
    ? `“${partialTranscript}”`
    : lastExchange?.barklyText;

  return (
    <View style={styles.room}>
      {/* the room: wall + floor */}
      <View style={styles.wall} />
      <View style={styles.floor} />

      <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* header: name + settings */}
        <View style={styles.header}>
          <Text style={styles.wordmark}>Barkly</Text>
          <Pressable style={styles.gear} hitSlop={10} onPress={() => setSettingsOpen(true)}>
            <View style={styles.gearDot} />
            <View style={styles.gearDot} />
            <View style={styles.gearDot} />
          </Pressable>
        </View>

        {/* speech bubble */}
        <View style={styles.bubbleZone}>
          {bubbleText ? (
            <View style={styles.bubble}>
              {lastExchange && !listening && (
                <Text style={styles.bubbleYou} numberOfLines={1}>you said “{lastExchange.userText}”</Text>
              )}
              <Text style={styles.bubbleText} numberOfLines={4}>{bubbleText}</Text>
              <View style={styles.bubbleTail} />
            </View>
          ) : (
            <Text style={styles.hint}>
              {sttAvailable ? 'hold talk and say hi' : 'type something and say hi'}
            </Text>
          )}
          {error && <Text style={styles.error}>{error}</Text>}
        </View>

        {/* Barkly owns the middle of the screen */}
        <View style={styles.stageArea}>
          <View style={styles.rug} />
          <View style={styles.shadow} />
          <BarklyView state={snapshot.state} actions={actions} />
          {stateLabel && (
            <View style={styles.chip}>
              {(listening || snapshot.state === 'thinking') && <View style={styles.chipDot} />}
              <Text style={styles.chipText}>{stateLabel}</Text>
            </View>
          )}
        </View>

        {/* controls */}
        <View style={styles.controls}>
          {sttAvailable ? (
            <Pressable
              style={({ pressed }) => [
                styles.talk,
                listening && styles.talkActive,
                (busy || pressed) && styles.pressed,
                busy && styles.disabled,
              ]}
              disabled={busy}
              onPressIn={barkly.startTalk}
              onPressOut={barkly.stopTalk}
            >
              <View style={[styles.micDot, listening && styles.micDotLive]} />
              <Text style={styles.talkText}>{listening ? 'listening — release to send' : 'hold to talk'}</Text>
            </Pressable>
          ) : (
            <View style={styles.typeRow}>
              <TextInput
                style={styles.input}
                value={typed}
                onChangeText={setTyped}
                placeholder="say something to Barkly…"
                placeholderTextColor={INK_SOFT}
                editable={!busy}
                onSubmitEditing={sendTyped}
                returnKeyType="send"
              />
              <Pressable
                style={({ pressed }) => [styles.send, pressed && styles.pressed, (busy || !typed.trim()) && styles.disabled]}
                disabled={busy || !typed.trim()}
                onPress={sendTyped}
              >
                <Text style={styles.sendText}>talk</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.actionsRow}>
            <ActionButton label="play" onPress={barkly.play} disabled={busy} />
            <ActionButton label="feed" onPress={barkly.feed} disabled={busy} />
            <ActionButton
              label={snapshot.state === 'sleepy' ? 'wake' : 'sleep'}
              onPress={barkly.sleepToggle}
              disabled={busy}
            />
          </View>
        </View>
      </KeyboardAvoidingView>

      <SettingsSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        memory={barkly.memorySnapshot()}
        dialogueProviderName={barkly.dialogueProviderName}
        sttAvailable={sttAvailable}
        onForgetEverything={barkly.forgetEverything}
      />
    </View>
  );
}

function ActionButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const shadowCard = Platform.select({
  web: { boxShadow: '0 10px 24px rgba(74, 59, 42, 0.12)' } as object,
  default: {
    shadowColor: '#4A3B2A',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
});

const styles = StyleSheet.create({
  room: { flex: 1, backgroundColor: WALL },
  wall: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: WALL },
  floor: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '46%',
    backgroundColor: FLOOR,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
  },

  content: { flex: 1, paddingTop: 58, paddingBottom: 28, paddingHorizontal: 22 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { fontSize: 22, fontWeight: '800', color: INK, letterSpacing: 0.3 },
  gear: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: CARD,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 3,
    ...(shadowCard as object),
  },
  gearDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: INK_SOFT },

  bubbleZone: { minHeight: 108, justifyContent: 'flex-end', alignItems: 'center', marginTop: 8 },
  hint: { fontSize: 15, color: INK_SOFT, marginBottom: 16 },
  bubble: {
    maxWidth: '92%',
    backgroundColor: CARD,
    borderRadius: 22,
    borderBottomLeftRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 18,
    ...(shadowCard as object),
  },
  bubbleYou: { fontSize: 12, color: INK_SOFT, marginBottom: 5 },
  bubbleText: { fontSize: 17, fontWeight: '600', color: INK, lineHeight: 24 },
  bubbleTail: {
    position: 'absolute',
    bottom: -7,
    left: '48%',
    width: 16,
    height: 16,
    backgroundColor: CARD,
    borderRadius: 3,
    transform: [{ rotate: '45deg' }],
  },
  error: { marginTop: 8, fontSize: 13, color: '#B3402E', textAlign: 'center' },

  stageArea: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 26 },
  rug: {
    position: 'absolute',
    bottom: 8,
    width: 300,
    height: 64,
    borderRadius: 150,
    backgroundColor: '#E0CFa8',
    opacity: 0.5,
  },
  shadow: {
    position: 'absolute',
    bottom: 22,
    width: 230,
    height: 30,
    borderRadius: 115,
    backgroundColor: '#4A3B2A',
    opacity: 0.13,
  },
  chip: {
    position: 'absolute',
    bottom: -6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: CARD,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 13,
    ...(shadowCard as object),
  },
  chipDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: ACCENT },
  chipText: { fontSize: 13, fontWeight: '700', color: INK_SOFT },

  controls: { gap: 10 },
  talk: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: INK,
    borderRadius: 999,
    paddingVertical: 18,
    ...(shadowCard as object),
  },
  talkActive: { backgroundColor: '#B3402E' },
  micDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: ACCENT },
  micDotLive: { backgroundColor: '#FFD9CF' },
  talkText: { color: '#FBF6EA', fontWeight: '800', fontSize: 16, letterSpacing: 0.4 },

  typeRow: { flexDirection: 'row', gap: 10 },
  input: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 15,
    fontSize: 15,
    color: INK,
    ...(shadowCard as object),
  },
  send: {
    backgroundColor: INK,
    borderRadius: 999,
    paddingHorizontal: 24,
    justifyContent: 'center',
    ...(shadowCard as object),
  },
  sendText: { color: '#FBF6EA', fontWeight: '800', fontSize: 15, letterSpacing: 0.4 },

  actionsRow: { flexDirection: 'row', gap: 10 },
  action: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    ...(shadowCard as object),
  },
  actionPressed: { backgroundColor: '#F1E6CC', transform: [{ scale: 0.97 }] },
  pressed: { transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.45 },
  actionText: { fontWeight: '800', color: INK, fontSize: 15, letterSpacing: 0.4 },
});
