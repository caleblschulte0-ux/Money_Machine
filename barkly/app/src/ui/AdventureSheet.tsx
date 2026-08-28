import React from 'react';
import { color } from './theme';
import { TAP_MIN } from './layout';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { AdventureState, adventureProgress, PLAN_REWARD } from '../game/adventure';

interface Props {
  visible: boolean;
  onClose: () => void;
  adventure: AdventureState | null;
}


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
    backgroundColor: color.paper,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 19,
    paddingBottom: 28,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.7, color: color.goldInk },
  title: { marginTop: 3, maxWidth: 290, fontSize: 24, lineHeight: 28, fontWeight: '900', color: color.ink, letterSpacing: -0.5 },
  /**
   * The way out of a sheet, at a real tap size.
   *
   * Seven sheets each declared this separately and every one of them measured
   * about 23x22 — a 15-18px glyph with 4px of padding. Six of the seven even
   * carried a comment saying the X was "the labelled way out", which was true
   * and beside the point: it was the smallest target in the app, on the
   * control a child needs when they are stuck. layout.TAP_MIN, like the rest.
   */
  close: { fontSize: 18, lineHeight: TAP_MIN, width: TAP_MIN, height: TAP_MIN, textAlign: 'center', color: color.inkSoft },
  subtitle: { marginTop: 9, fontSize: 13, lineHeight: 20, color: color.inkSoft },
  progressCard: {
    marginTop: 17,
    backgroundColor: color.ink,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressDone: { backgroundColor: color.good },
  progressBig: { fontSize: 24, lineHeight: 27, fontWeight: '900', color: color.paper },
  progressSmall: { marginTop: 2, fontSize: 10, fontWeight: '900', letterSpacing: 1.3, color: color.line },
  progressRight: { alignItems: 'flex-end' },
  rewardLabel: { fontSize: 10, color: color.inkSoft },
  reward: { marginTop: 2, fontSize: 12, fontWeight: '800', color: color.goldSoft },
  goals: { marginTop: 14, gap: 9 },
  goal: {
    minHeight: 78,
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 12,
    backgroundColor: color.card,
    borderWidth: 1,
    borderColor: color.fill,
    flexDirection: 'row',
    alignItems: 'center',
  },
  goalDone: { backgroundColor: color.well, borderColor: color.line },
  check: { width: 34, height: 34, borderRadius: 18, backgroundColor: color.fill, alignItems: 'center', justifyContent: 'center' },
  checkDone: { backgroundColor: color.good },
  checkText: { fontSize: 13, fontWeight: '900', color: color.inkSoft },
  checkTextDone: { color: color.paper, fontSize: 15 },
  goalCopy: { flex: 1, marginLeft: 12 },
  goalLabel: { fontSize: 15, fontWeight: '800', color: color.ink },
  goalLabelDone: { textDecorationLine: 'line-through', color: color.inkSoft },
  goalDetail: { marginTop: 3, fontSize: 12, lineHeight: 17, color: color.inkSoft },
  verdict: { marginTop: 16, borderRadius: 18, padding: 15, backgroundColor: color.goodWell },
  verdictTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 1, color: color.inkMid, textTransform: 'uppercase' },
  verdictText: { marginTop: 5, fontSize: 13, lineHeight: 20, color: color.inkMid },
  footer: { marginTop: 15, fontSize: 12, lineHeight: 17, color: color.inkSoft, textAlign: 'center' },
});
