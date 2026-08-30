import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { AdventureState, adventureProgress, PLAN_REWARD } from '../game/adventure';
import { color, elevation, glyph, radius, space, type } from './theme';
import { TAP_MIN } from './layout';

interface Props {
  visible: boolean;
  onClose: () => void;
  adventure: AdventureState | null;
}

/**
 * The Plan is useful retention machinery, but it should not LOOK like retention
 * machinery. This is Barkly's crumpled little agenda now — three things he has
 * decided are important today, with the reward demoted to a scribble instead
 * of sitting in a KPI card above the actual fun.
 */
export default function AdventureSheet({ visible, onClose, adventure }: Props) {
  if (!adventure) return null;
  const progress = adventureProgress(adventure);
  const done = Boolean(adventure.completedAt);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessible={false}>
        <Pressable style={styles.sheet} onPress={() => {}} accessible={false}>
          <View style={styles.handle} />

          <View style={styles.note}>
            <View style={styles.tape} pointerEvents="none" />
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>BARKLY'S NOTE</Text>
                <Text style={styles.title}>{adventure.title}</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close Barkly's plan">
                <Text style={styles.close}>✕</Text>
              </Pressable>
            </View>

            <Text style={styles.subtitle}>{adventure.subtitle}</Text>

            <View style={styles.rule} />

            <View style={styles.goals}>
              {adventure.goals.map((goal, index) => (
                <View key={goal.id} style={styles.goal}>
                  <View style={[styles.checkbox, goal.done && styles.checkboxDone]}>
                    <Text style={[styles.checkboxText, goal.done && styles.checkboxTextDone]}>{goal.done ? '✓' : ''}</Text>
                  </View>
                  <View style={styles.goalCopy}>
                    <Text style={[styles.goalLabel, goal.done && styles.goalLabelDone]}>
                      {goal.label}
                    </Text>
                    <Text style={styles.goalDetail}>{goal.detail}</Text>
                  </View>
                  <Text style={styles.goalNumber}>{index + 1}</Text>
                </View>
              ))}
            </View>

            <View style={styles.rule} />

            {done ? (
              <View style={styles.verdict}>
                <Text style={styles.verdictStamp}>WE ACTUALLY DID IT</Text>
                <Text style={styles.verdictText}>Disturbingly productive. We should probably do something pointless now.</Text>
              </View>
            ) : (
              <View style={styles.bottomRow}>
                <Text style={styles.progressText}>{progress.done} crossed out · {progress.total - progress.done} questionable idea{progress.total - progress.done === 1 ? '' : 's'} left</Text>
                <Text style={styles.rewardScribble}>all 3 = +{PLAN_REWARD.coins}c / +{PLAN_REWARD.xp}xp</Text>
              </View>
            )}

            <Text style={styles.noPressure}>No streak. No guilt. If we get distracted, extremely on brand.</Text>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: color.scrim, justifyContent: 'flex-end' },
  sheet: { paddingHorizontal: space.lg, paddingBottom: space.xl },
  handle: { alignSelf: 'center', width: 54, height: 5, borderRadius: radius.pill, backgroundColor: color.inkOn, opacity: 0.65, marginBottom: space.md },
  note: {
    backgroundColor: color.card,
    borderRadius: radius.lg,
    paddingHorizontal: space.xl,
    paddingTop: space.xxl,
    paddingBottom: space.xl,
    borderWidth: 1,
    borderColor: color.line,
    transform: [{ rotate: '-0.35deg' }],
    ...elevation.sheet,
  },
  tape: {
    position: 'absolute',
    top: -9,
    left: '38%',
    width: 92,
    height: 20,
    borderRadius: radius.xs,
    backgroundColor: color.goldSoft,
    opacity: 0.72,
    transform: [{ rotate: '3deg' }],
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md },
  headerCopy: { flex: 1 },
  eyebrow: { ...type.micro, color: color.goldInk },
  title: { ...type.display, color: color.ink, marginTop: space.xs },
  close: { fontSize: glyph.close, lineHeight: TAP_MIN, width: TAP_MIN, height: TAP_MIN, textAlign: 'center', color: color.inkSoft },
  subtitle: { ...type.small, color: color.inkSoft, marginTop: space.sm },
  rule: { height: 1.5, backgroundColor: color.line, marginVertical: space.lg },
  goals: { gap: space.lg },
  goal: { minHeight: 62, flexDirection: 'row', alignItems: 'flex-start' },
  checkbox: { width: 28, height: 28, borderRadius: radius.xs, borderWidth: 2, borderColor: color.inkMid, alignItems: 'center', justifyContent: 'center', marginTop: space.xxs, transform: [{ rotate: '-2deg' }] },
  checkboxDone: { backgroundColor: color.goodWell, borderColor: color.good },
  checkboxText: { ...type.strong, color: color.inkSoft },
  checkboxTextDone: { color: color.good },
  goalCopy: { flex: 1, marginLeft: space.md },
  goalLabel: { ...type.strong, color: color.ink },
  goalLabelDone: { textDecorationLine: 'line-through', color: color.inkSoft },
  goalDetail: { ...type.small, color: color.inkSoft, marginTop: space.xs },
  goalNumber: { ...type.micro, color: color.inkSoft, marginLeft: space.sm, transform: [{ rotate: '5deg' }] },
  bottomRow: { gap: space.sm },
  progressText: { ...type.caption, color: color.inkMid },
  rewardScribble: { ...type.caption, color: color.goldInk, fontStyle: 'italic', textAlign: 'right', transform: [{ rotate: '-1deg' }] },
  noPressure: { ...type.caption, color: color.inkSoft, fontStyle: 'italic', textAlign: 'center', marginTop: space.lg },
  verdict: { borderRadius: radius.sm, borderWidth: 2, borderStyle: 'dashed', borderColor: color.goodLine, backgroundColor: color.goodWell, padding: space.lg, transform: [{ rotate: '0.5deg' }] },
  verdictStamp: { ...type.micro, color: color.good, textAlign: 'center' },
  verdictText: { ...type.small, color: color.inkMid, textAlign: 'center', marginTop: space.sm },
});
