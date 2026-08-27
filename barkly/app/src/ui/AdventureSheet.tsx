import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { AdventureState, adventureProgress, PLAN_REWARD } from '../game/adventure';

interface Props {
  visible: boolean;
  onClose: () => void;
  adventure: AdventureState | null;
}

const INK = '#3E3428';
const SOFT = '#8A7A5F';
const PAPER = '#FFF9EC';
const GOLD = '#C6952F';

export default function AdventureSheet({ visible, onClose, adventure }: Props) {
  if (!adventure) return null;
  const progress = adventureProgress(adventure);
  const done = Boolean(adventure.completedAt);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
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
            <View>
              <Text style={styles.eyebrow}>TODAY'S PLAN</Text>
              <Text style={styles.title}>{adventure.title}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close Barkly's plan">
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <Text style={styles.subtitle}>{adventure.subtitle}</Text>

          <View style={[styles.progressCard, done && styles.progressDone]}>
            <View>
              <Text style={styles.progressBig}>{progress.done}/{progress.total}</Text>
              <Text style={styles.progressSmall}>{done ? 'PLAN COMPLETE' : 'DONE'}</Text>
            </View>
            <View style={styles.progressRight}>
              <Text style={styles.rewardLabel}>finish all three</Text>
              <Text style={styles.reward}>+{PLAN_REWARD.coins} coins · +{PLAN_REWARD.xp} xp</Text>
            </View>
          </View>

          <View style={styles.goals}>
            {adventure.goals.map((goal, index) => (
              <View key={goal.id} style={[styles.goal, goal.done && styles.goalDone]}>
                <View style={[styles.check, goal.done && styles.checkDone]}>
                  <Text style={[styles.checkText, goal.done && styles.checkTextDone]}>{goal.done ? '✓' : index + 1}</Text>
                </View>
                <View style={styles.goalCopy}>
                  <Text style={[styles.goalLabel, goal.done && styles.goalLabelDone]}>{goal.label}</Text>
                  <Text style={styles.goalDetail}>{goal.detail}</Text>
                </View>
              </View>
            ))}
          </View>

          {done ? (
            <View style={styles.verdict}>
              <Text style={styles.verdictTitle}>Barkly's verdict</Text>
              <Text style={styles.verdictText}>Disturbingly productive. We should probably do something pointless now.</Text>
            </View>
          ) : (
            <Text style={styles.footer}>
              This is a session arc, not a streak. Skip it, ignore it, get distracted. Tomorrow Barkly makes a different plan.
            </Text>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(29,24,18,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: PAPER,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 19,
    paddingBottom: 28,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.7, color: GOLD },
  title: { marginTop: 3, maxWidth: 290, fontSize: 24, lineHeight: 28, fontWeight: '900', color: INK, letterSpacing: -0.5 },
  close: { fontSize: 20, color: SOFT, padding: 4 },
  subtitle: { marginTop: 9, fontSize: 14, lineHeight: 20, color: SOFT },
  progressCard: {
    marginTop: 17,
    backgroundColor: INK,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressDone: { backgroundColor: '#5B6B3D' },
  progressBig: { fontSize: 26, lineHeight: 27, fontWeight: '900', color: '#FFF9EC' },
  progressSmall: { marginTop: 2, fontSize: 8.5, fontWeight: '900', letterSpacing: 1.3, color: '#DCCB9C' },
  progressRight: { alignItems: 'flex-end' },
  rewardLabel: { fontSize: 10, color: '#C5BBA8' },
  reward: { marginTop: 2, fontSize: 12.5, fontWeight: '800', color: '#F1D77E' },
  goals: { marginTop: 14, gap: 9 },
  goal: {
    minHeight: 78,
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 12,
    backgroundColor: '#FFFDF7',
    borderWidth: 1,
    borderColor: '#E8DCC5',
    flexDirection: 'row',
    alignItems: 'center',
  },
  goalDone: { backgroundColor: '#F0EAD9', borderColor: '#D6C7A8' },
  check: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#EDE1C8', alignItems: 'center', justifyContent: 'center' },
  checkDone: { backgroundColor: '#667848' },
  checkText: { fontSize: 13, fontWeight: '900', color: '#7A684D' },
  checkTextDone: { color: '#FFF9EC', fontSize: 16 },
  goalCopy: { flex: 1, marginLeft: 12 },
  goalLabel: { fontSize: 15.5, fontWeight: '800', color: INK },
  goalLabelDone: { textDecorationLine: 'line-through', color: '#7D7567' },
  goalDetail: { marginTop: 3, fontSize: 12.5, lineHeight: 17, color: SOFT },
  verdict: { marginTop: 16, borderRadius: 18, padding: 15, backgroundColor: '#E7ECD9' },
  verdictTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 1, color: '#59643D', textTransform: 'uppercase' },
  verdictText: { marginTop: 5, fontSize: 14, lineHeight: 20, color: '#4A503B' },
  footer: { marginTop: 15, fontSize: 11.5, lineHeight: 17, color: '#A09480', textAlign: 'center' },
});
