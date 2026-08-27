import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SocialEncounter } from '../barkly/encounters';
import { NPCS } from '../world/npcs';

interface Props {
  encounter: SocialEncounter | null;
  busy: boolean;
  onChoose: (choiceId: string) => void;
  onClose: () => void;
}

const INK = '#3E3428';
const PAPER = '#FFF9EC';
const SOFT = '#8A7A5F';
const GOLD = '#C6952F';

export default function EncounterSheet({ encounter, busy, onChoose, onClose }: Props) {
  if (!encounter) return null;
  const npc = NPCS[encounter.npcId];

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.topline}>
            <View style={styles.eyebrowPill}>
              <Text style={styles.eyebrow}>{encounter.eyebrow}</Text>
            </View>
            <Pressable
              onPress={onClose}
              disabled={busy}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Leave this encounter for later"
            >
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <Text style={styles.npcName}>{npc.name}</Text>
          <Text style={styles.title}>{encounter.title}</Text>
          <Text style={styles.prompt}>{encounter.prompt}</Text>

          {/* Where this stands and what is next. Escalation you can see
              coming reads as a story; escalation you discover afterwards
              reads as a counter. */}
          {encounter.ladder && (
            <View style={styles.ladder} accessibilityLabel={`${npc.name}: ${encounter.ladder.stage.label}. ${encounter.ladder.hint}`}>
              <View style={styles.ladderRow}>
                <Text style={styles.ladderNow}>{encounter.ladder.stage.label}</Text>
                {encounter.ladder.nextLabel ? (
                  <Text style={styles.ladderNext}>next: {encounter.ladder.nextLabel}</Text>
                ) : null}
              </View>
              <View style={styles.meter}>
                <View
                  style={[
                    styles.meterFill,
                    encounter.ladder.kind === 'rival' ? styles.meterRival : styles.meterFriend,
                    { width: `${Math.round(encounter.ladder.fraction * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.ladderHint}>{encounter.ladder.hint}</Text>
            </View>
          )}

          <View style={styles.divider} />
          <Text style={styles.question}>What do you tell Barkly?</Text>

          <View style={styles.choices}>
            {encounter.choices.map((choice, index) => (
              <Pressable
                key={choice.id}
                style={({ pressed }) => [styles.choice, pressed && styles.choicePressed, busy && styles.disabled]}
                disabled={busy}
                onPress={() => onChoose(choice.id)}
                accessibilityRole="button"
                accessibilityLabel={`${choice.label}. ${choice.hint}`}
              >
                <View style={styles.choiceNumber}>
                  <Text style={styles.choiceNumberText}>{index + 1}</Text>
                </View>
                <View style={styles.choiceCopy}>
                  <Text style={styles.choiceLabel}>{choice.label}</Text>
                  <Text style={styles.choiceHint}>{choice.hint}</Text>
                </View>
                <Text style={styles.arrow}>›</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.footer}>
            This choice becomes part of Barkly's history. It can change friendships, rivalries and future stories.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  ladder: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EFE4CD' },
  ladderRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  ladderNow: { fontSize: 13.5, fontWeight: '900', color: INK },
  ladderNext: { fontSize: 11.5, color: SOFT },
  meter: { height: 6, borderRadius: 999, backgroundColor: '#EFE4CD', marginTop: 7, overflow: 'hidden' },
  meterFill: { height: 6, borderRadius: 999 },
  meterRival: { backgroundColor: '#C97B4B' },
  meterFriend: { backgroundColor: '#7FA35C' },
  ladderHint: { marginTop: 6, fontSize: 11.5, color: SOFT },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(29,24,18,0.58)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  sheet: {
    backgroundColor: PAPER,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
    shadowColor: '#2D241B',
    shadowOpacity: 0.25,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrowPill: { backgroundColor: '#F2E3B6', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  eyebrow: { fontSize: 9.5, fontWeight: '900', letterSpacing: 1.2, color: '#775913' },
  close: { fontSize: 19, color: SOFT, padding: 4 },
  npcName: { marginTop: 18, fontSize: 12, fontWeight: '900', color: GOLD, letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { marginTop: 4, fontSize: 28, lineHeight: 31, fontWeight: '900', color: INK, letterSpacing: -0.7 },
  prompt: { marginTop: 10, fontSize: 15, lineHeight: 22, color: '#625544' },
  divider: { height: 1, backgroundColor: '#E3D5B9', marginTop: 18, marginBottom: 15 },
  question: { fontSize: 11, fontWeight: '900', letterSpacing: 1.1, color: SOFT, textTransform: 'uppercase' },
  choices: { marginTop: 9, gap: 9 },
  choice: {
    minHeight: 70,
    borderRadius: 18,
    borderWidth: 1.3,
    borderColor: '#E5D8BF',
    backgroundColor: '#FFFDF7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  choicePressed: { transform: [{ scale: 0.985 }], backgroundColor: '#F7EEDC' },
  choiceNumber: { width: 32, height: 32, borderRadius: 16, backgroundColor: INK, alignItems: 'center', justifyContent: 'center' },
  choiceNumberText: { color: '#FFF8E9', fontSize: 13, fontWeight: '900' },
  choiceCopy: { flex: 1, marginLeft: 11 },
  choiceLabel: { fontSize: 15.5, fontWeight: '800', color: INK },
  choiceHint: { marginTop: 3, fontSize: 12.5, color: SOFT },
  arrow: { fontSize: 27, lineHeight: 30, color: '#B89B61', marginLeft: 8 },
  footer: { marginTop: 14, fontSize: 11.5, lineHeight: 17, color: '#A0937D', textAlign: 'center' },
  disabled: { opacity: 0.48 },
});
