/**
 * The home screen — Barkly's room. Barkly is the product: he owns the
 * screen, the UI stays out of his way. Controls: TALK (hold), PLAY, FEED,
 * SLEEP, and a small settings gear. No currencies, no popups, no banners.
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

const STATE_LABEL: Record<BarklyState, string> = {
  idle: '',
  listening: 'listening…',
  thinking: 'thinking…',
  speaking: '',
  happy: '',
  excited: '',
  annoyed: 'hmph.',
  sleepy: 'napping',
  hungry: 'hungry',
  playing: '',
  eating: 'nom nom',
};

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

  return (
    <KeyboardAvoidingView
      style={styles.room}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* settings gear — the only chrome */}
      <Pressable style={styles.gear} hitSlop={10} onPress={() => setSettingsOpen(true)}>
        <Text style={styles.gearText}>⚙︎</Text>
      </Pressable>

      {/* caption area: what was said */}
      <View style={styles.captions}>
        {listening && partialTranscript ? (
          <Text style={styles.userLine} numberOfLines={2}>“{partialTranscript}”</Text>
        ) : lastExchange ? (
          <>
            <Text style={styles.userLine} numberOfLines={2}>You: “{lastExchange.userText}”</Text>
            <Text style={styles.barklyLine} numberOfLines={4}>{lastExchange.barklyText}</Text>
          </>
        ) : (
          <Text style={styles.hint}>
            {sttAvailable ? 'Hold TALK and say hi to Barkly.' : 'Type something and say hi to Barkly.'}
          </Text>
        )}
        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      {/* Barkly owns the middle of the screen */}
      <View style={styles.stage}>
        <BarklyView state={snapshot.state} actions={actions} />
        <View style={styles.ground} />
        {!!stateLabel && <Text style={styles.stateLabel}>{stateLabel}</Text>}
      </View>

      {/* controls */}
      {sttAvailable ? (
        <Pressable
          style={[styles.talk, listening && styles.talkActive, busy && styles.talkDisabled]}
          disabled={busy}
          onPressIn={barkly.startTalk}
          onPressOut={barkly.stopTalk}
        >
          <Text style={styles.talkText}>{listening ? 'LISTENING — release to send' : 'HOLD TO TALK'}</Text>
        </Pressable>
      ) : (
        <View style={styles.typeRow}>
          <TextInput
            style={styles.input}
            value={typed}
            onChangeText={setTyped}
            placeholder="Say something to Barkly…"
            placeholderTextColor="#9A8F7A"
            editable={!busy}
            onSubmitEditing={sendTyped}
            returnKeyType="send"
          />
          <Pressable style={[styles.send, (busy || !typed.trim()) && styles.talkDisabled]} disabled={busy || !typed.trim()} onPress={sendTyped}>
            <Text style={styles.sendText}>TALK</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.actionsRow}>
        <ActionButton label="PLAY" onPress={barkly.play} disabled={busy} />
        <ActionButton label="FEED" onPress={barkly.feed} disabled={busy} />
        <ActionButton
          label={snapshot.state === 'sleepy' ? 'WAKE' : 'SLEEP'}
          onPress={barkly.sleepToggle}
          disabled={busy}
        />
      </View>

      <SettingsSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        memory={barkly.memorySnapshot()}
        dialogueProviderName={barkly.dialogueProviderName}
        sttAvailable={sttAvailable}
        onForgetEverything={barkly.forgetEverything}
      />
    </KeyboardAvoidingView>
  );
}

function ActionButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed, disabled && styles.talkDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  room: { flex: 1, backgroundColor: '#F6EDD9', paddingTop: 64, paddingBottom: 36, paddingHorizontal: 20 },
  gear: { position: 'absolute', top: 58, right: 20, zIndex: 10 },
  gearText: { fontSize: 24, color: '#8B7B55' },

  captions: { minHeight: 96, justifyContent: 'flex-end' },
  hint: { fontSize: 15, color: '#9A8F7A', textAlign: 'center' },
  userLine: { fontSize: 14, color: '#8B7B55', textAlign: 'center', marginBottom: 6 },
  barklyLine: { fontSize: 17, fontWeight: '600', color: '#2E2A26', textAlign: 'center', lineHeight: 23 },
  error: { marginTop: 6, fontSize: 13, color: '#B3402E', textAlign: 'center' },

  stage: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 40 },
  ground: {
    position: 'absolute',
    bottom: 8,
    width: 260,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(46,42,38,0.08)',
  },
  stateLabel: { position: 'absolute', bottom: -14, fontSize: 13, color: '#8B7B55', fontStyle: 'italic' },

  talk: {
    backgroundColor: '#2E2A26',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 18,
  },
  talkActive: { backgroundColor: '#B3402E' },
  talkDisabled: { opacity: 0.45 },
  talkText: { color: '#F6EDD9', fontWeight: '800', fontSize: 16, letterSpacing: 1 },

  typeRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  input: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#2E2A26',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#2E2A26',
  },
  send: {
    backgroundColor: '#2E2A26',
    borderRadius: 14,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  sendText: { color: '#F6EDD9', fontWeight: '800' },

  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  action: {
    flex: 1,
    backgroundColor: '#D9A441',
    borderWidth: 2,
    borderColor: '#2E2A26',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  actionPressed: { backgroundColor: '#B8862F' },
  actionText: { fontWeight: '800', color: '#2E2A26', letterSpacing: 1 },
});
