import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { AdventureState, adventureProgress, PLAN_REWARD } from '../game/adventure';
import { color, elevation, glyph, radius, space, type } from './theme';
import { TAP_MIN } from './layout';

interface Props {
  visible: boolean;
  onClose: () => void;
  adventure: AdventureState | null;
}

function goalColor(index: number): string {
  if (index % 3 === 0) return color.fill;
  if (index % 3 === 1) return color.goodWell;
  return color.warmWell;
}

/** Barkly's plan is an object he made, not a retention dashboard. */
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
            <LinearGradient colors={[color.lemon, color.paper]} style={styles.noteFill} pointerEvents="none" />
            <View style={styles.noteEdge} pointerEvents="none" />
            <View style={styles.noteGloss} pointerEvents="none" />
            <View style={styles.tape} pointerEvents="none" />

            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <View style={styles.kickerPod}><Text style={styles.eyebrow}>BARKLY'S NOTE</Text></View>
                <Text style={styles.title}>{adventure.title}</Text>
              </View>
              <Pressable style={styles.closeButton} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close Barkly's plan">
                <Text style={styles.close}>✕</Text>
              </Pressable>
            </View>

            <Text style={styles.subtitle}>{adventure.subtitle}</Text>

            <View style={styles.goals}>
              {adventure.goals.map((goal, index) => (
                <View key={goal.id} style={[styles.goal, { backgroundColor: goalColor(index) }, goal.done && styles.goalDone]}>
                  <View style={[styles.checkbox, goal.done && styles.checkboxDone]}>
                    <Text style={[styles.checkboxText, goal.done && styles.checkboxTextDone]}>{goal.done ? '✓' : ''}</Text>
                  </View>
                  <View style={styles.goalCopy}>
                    <Text style={[styles.goalLabel, goal.done && styles.goalLabelDone]}>{goal.label}</Text>
                    <Text style={styles.goalDetail}>{goal.detail}</Text>
                  </View>
                  <View style={[styles.goalNumberPod, { backgroundColor: index === 0 ? color.pop : index === 1 ? color.mint : color.coral }]}>
                    <Text style={styles.goalNumber}>{index + 1}</Text>
                  </View>
                </View>
              ))}
            </View>

            {done ? (
              <View style={styles.verdict}>
                <Text style={styles.verdictStamp}>WE ACTUALLY DID IT</Text>
                <Text style={styles.verdictText}>Disturbingly productive. We should probably do something pointless now.</Text>
              </View>
            ) : (
              <View style={styles.bottomRow}>
                <Text style={styles.progressText}>{progress.done} crossed out · {progress.total - progress.done} questionable idea{progress.total - progress.done === 1 ? '' : 's'} left</Text>
                <View style={styles.rewardPod}><Text style={styles.rewardScribble}>ALL 3 = +{PLAN_REWARD.coins}c / +{PLAN_REWARD.xp}xp</Text></View>
              </View>
            )}

            <View style={styles.noPressurePod}>
              <Text style={styles.noPressure}>No streak. No guilt. Getting distracted is extremely on brand.</Text>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: color.scrim, justifyContent: 'flex-end' },
  sheet: { paddingHorizontal: space.lg, paddingBottom: space.xl },
  handle: { alignSelf: 'center', width: 54, height: 5, borderRadius: radius.pill, backgroundColor: color.inkOn, opacity: 0.75, marginBottom: space.md },
  note: {
    borderRadius: radius.xl,
    paddingHorizontal: space.xl,
    paddingTop: space.xxl,
    paddingBottom: space.xl,
    borderWidth: 2,
    borderColor: color.inkMid,
    transform: [{ rotate: '-0.25deg' }],
    overflow: 'visible',
    ...elevation.toy,
  },
  noteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: radius.xl },
  noteEdge: { position: 'absolute', left: space.md, right: space.md, bottom: -6, height: space.md, backgroundColor: color.lemonDeep, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  noteGloss: { position: 'absolute', left: space.lg, right: space.lg, top: space.xs, height: space.sm, backgroundColor: color.gloss, borderRadius: radius.pill },
  tape: { position: 'absolute', top: -10, left: '36%', width: 92, height: 22, borderRadius: radius.xs, backgroundColor: color.violet, opacity: 0.84, transform: [{ rotate: '3deg' }] },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md },
  headerCopy: { flex: 1 },
  kickerPod: { alignSelf: 'flex-start', backgroundColor: color.ink, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: space.xs },
  eyebrow: { ...type.micro, color: color.inkOn },
  title: { ...type.display, color: color.ink, marginTop: space.sm },
  closeButton: { width: TAP_MIN, height: TAP_MIN, borderRadius: radius.pill, backgroundColor: color.card, alignItems: 'center', justifyContent: 'center', ...elevation.low },
  close: { fontSize: glyph.close, lineHeight: TAP_MIN, width: TAP_MIN, height: TAP_MIN, textAlign: 'center', color: color.inkSoft },
  /*
   * ink, not inkMid. Both of these sit on the lemon note, where inkMid
   * measures 2.85:1 against a 4.5 requirement for body copy. Nothing had ever
   * checked this sheet -- the a11y harness only walked three of them until the
   * pass that added Food and Plan.
   */
  subtitle: { ...type.small, color: color.ink, marginTop: space.sm, fontWeight: '600' },
  goals: { gap: space.md, marginTop: space.lg },
  goal: { minHeight: 68, flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, padding: space.md, borderWidth: 1.5, borderColor: color.line, ...elevation.low },
  goalDone: { opacity: 0.82 },
  checkbox: { width: 28, height: 28, borderRadius: radius.xs, borderWidth: 2, borderColor: color.inkMid, backgroundColor: color.card, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-2deg' }] },
  checkboxDone: { backgroundColor: color.mint, borderColor: color.mintDeep },
  checkboxText: { ...type.strong, color: color.inkSoft },
  checkboxTextDone: { color: color.ink },
  goalCopy: { flex: 1, marginLeft: space.md },
  goalLabel: { ...type.strong, color: color.ink },
  goalLabelDone: { textDecorationLine: 'line-through', color: color.inkSoft },
  goalDetail: { ...type.small, color: color.inkSoft, marginTop: space.xs },
  goalNumberPod: { width: 28, height: 28, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', marginLeft: space.sm },
  goalNumber: { ...type.caption, fontWeight: '900', color: color.ink },
  bottomRow: { gap: space.sm, marginTop: space.lg },
  progressText: { ...type.caption, color: color.ink, fontWeight: '800' },
  rewardPod: { alignSelf: 'flex-end', backgroundColor: color.violet, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.sm, transform: [{ rotate: '-1deg' }], ...elevation.low },
  rewardScribble: { ...type.caption, color: color.ink, fontWeight: '900' },
  noPressurePod: { marginTop: space.lg, alignSelf: 'center', backgroundColor: color.fill, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.sm },
  noPressure: { ...type.caption, color: color.inkSoft, fontStyle: 'italic', textAlign: 'center' },
  verdict: { marginTop: space.lg, borderRadius: radius.md, borderWidth: 2, borderStyle: 'dashed', borderColor: color.good, backgroundColor: color.mint, padding: space.lg, transform: [{ rotate: '0.5deg' }], ...elevation.low },
  verdictStamp: { ...type.micro, color: color.ink, textAlign: 'center' },
  verdictText: { ...type.small, color: color.inkMid, textAlign: 'center', marginTop: space.sm, fontWeight: '600' },
});
