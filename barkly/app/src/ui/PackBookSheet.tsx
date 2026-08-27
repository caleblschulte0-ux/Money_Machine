import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RelationshipProfile } from '../barkly/relationship';

interface Props {
  visible: boolean;
  onClose: () => void;
  profile: RelationshipProfile;
}

const INK = '#3E3428';
const SOFT = '#8A7A5F';
const PAPER = '#FFF9EC';
const CARD = '#FFFDF7';
const GOLD = '#C6952F';

function TraitCard({ label, score, detail }: { label: string; score: number; detail: string }) {
  return (
    <View style={styles.traitCard}>
      <View style={styles.traitHead}>
        <Text style={styles.traitLabel}>{label}</Text>
        <Text style={styles.traitScore}>{score}</Text>
      </View>
      <View style={styles.traitTrack}>
        <View style={[styles.traitFill, { width: `${Math.max(5, score)}%` }]} />
      </View>
      <Text style={styles.traitDetail}>{detail}</Text>
    </View>
  );
}

export default function PackBookSheet({ visible, onClose, profile }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>THE PACK BOOK</Text>
              <Text style={styles.title}>Your Barkly</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close Pack Book">
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.hero}>
              <Text style={styles.stage}>PACK {profile.stage.level} · {profile.stage.label.toUpperCase()}</Text>
              <Text style={styles.archetype}>{profile.archetype}</Text>
              <Text style={styles.tagline}>{profile.tagline}</Text>
              <View style={styles.bondTrack}>
                <View style={[styles.bondFill, { width: `${profile.stage.progress * 100}%` }]} />
              </View>
              <Text style={styles.stageBlurb}>{profile.stage.blurb}</Text>
            </View>

            <Text style={styles.explainer}>
              Barkly does not pick a personality at signup. This is what he has become from the way you actually talk,
              train, explore and cause problems together.
            </Text>

            <Text style={styles.section}>What you turned him into</Text>
            {profile.traits.map((trait) => (
              <TraitCard key={trait.id} label={trait.label} score={trait.score} detail={trait.detail} />
            ))}

            <Text style={styles.section}>Private rituals</Text>
            {profile.rituals.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No ritual yet.</Text>
                <Text style={styles.emptyText}>
                  Teach Barkly a cue and use it a few times. Repeated tricks stop being “commands” and become part of your shared lore.
                </Text>
              </View>
            ) : (
              profile.rituals.map((ritual) => (
                <View key={ritual.id} style={[styles.loreCard, ritual.signature && styles.signatureCard]}>
                  <View style={styles.loreHead}>
                    <Text style={styles.loreTitle}>{ritual.title}</Text>
                    {ritual.signature && <Text style={styles.signature}>SIGNATURE</Text>}
                  </View>
                  <Text style={styles.loreDetail}>{ritual.detail}</Text>
                </View>
              ))
            )}

            <Text style={styles.section}>Our lore</Text>
            {profile.lore.length === 0 ? (
              <Text style={styles.emptyLine}>Recurring friends, enemies and sacred dirt objects will end up here.</Text>
            ) : (
              profile.lore.map((item) => (
                <View key={item.id} style={styles.loreCard}>
                  <Text style={styles.loreTitle}>{item.title}</Text>
                  <Text style={styles.loreDetail}>{item.detail}</Text>
                </View>
              ))
            )}

            <Text style={styles.section}>Core memories</Text>
            {profile.coreMemories.length === 0 ? (
              <Text style={styles.emptyLine}>Nothing has made the highlight reel yet.</Text>
            ) : (
              profile.coreMemories.map((memory, index) => (
                <View key={memory.id} style={styles.memoryRow}>
                  <Text style={styles.memoryNumber}>{String(index + 1).padStart(2, '0')}</Text>
                  <View style={styles.memoryCopy}>
                    <Text style={styles.memoryText}>{memory.what}</Text>
                    {memory.where && <Text style={styles.memoryWhere}>{memory.where}</Text>}
                  </View>
                </View>
              ))
            )}

            <View style={styles.footerCard}>
              <Text style={styles.footerTitle}>The point</Text>
              <Text style={styles.footerText}>
                Someone else can download Barkly. They cannot download this Barkly. The history, routines, grudges, friendships and weird little traditions only exist because you made them happen.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(28,24,19,0.48)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '91%',
    backgroundColor: PAPER,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 2.1, color: GOLD },
  title: { marginTop: 2, fontSize: 26, fontWeight: '900', color: INK, letterSpacing: -0.4 },
  close: { fontSize: 20, color: INK, padding: 4 },
  scrollContent: { paddingBottom: 34 },

  hero: {
    backgroundColor: INK,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginTop: 4,
  },
  stage: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: '#E2C471' },
  archetype: { marginTop: 7, fontSize: 29, lineHeight: 32, fontWeight: '900', color: '#FFF9EC', letterSpacing: -0.7 },
  tagline: { marginTop: 7, fontSize: 15, lineHeight: 21, color: '#E8DFC8' },
  bondTrack: { height: 7, borderRadius: 999, backgroundColor: '#665A49', overflow: 'hidden', marginTop: 17 },
  bondFill: { height: 7, borderRadius: 999, backgroundColor: '#E2C471' },
  stageBlurb: { marginTop: 9, fontSize: 12.5, lineHeight: 18, color: '#BFB39C' },

  explainer: { marginTop: 15, fontSize: 14, lineHeight: 20, color: SOFT },
  section: { marginTop: 23, marginBottom: 9, fontSize: 12, fontWeight: '900', letterSpacing: 1.3, color: '#7C694B', textTransform: 'uppercase' },

  traitCard: { backgroundColor: CARD, borderRadius: 18, padding: 14, marginBottom: 9 },
  traitHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  traitLabel: { fontSize: 16, fontWeight: '800', color: INK },
  traitScore: { fontSize: 13, fontWeight: '900', color: GOLD },
  traitTrack: { height: 6, borderRadius: 999, backgroundColor: '#EEE2CA', overflow: 'hidden', marginTop: 9 },
  traitFill: { height: 6, borderRadius: 999, backgroundColor: GOLD },
  traitDetail: { marginTop: 8, fontSize: 12.5, lineHeight: 18, color: SOFT },

  emptyCard: { borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#D9C9AA', padding: 16 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: INK },
  emptyText: { marginTop: 5, fontSize: 13, lineHeight: 19, color: SOFT },
  emptyLine: { fontSize: 13.5, lineHeight: 20, color: SOFT, fontStyle: 'italic' },

  loreCard: { backgroundColor: CARD, borderRadius: 17, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#EEE2CA' },
  signatureCard: { borderColor: '#C6A04A', borderWidth: 1.5 },
  loreHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  loreTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: INK },
  loreDetail: { marginTop: 4, fontSize: 13, lineHeight: 19, color: SOFT },
  signature: { fontSize: 9, fontWeight: '900', letterSpacing: 1.1, color: '#8A6817' },

  memoryRow: { flexDirection: 'row', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#EADFCB' },
  memoryNumber: { width: 24, fontSize: 11, fontWeight: '900', letterSpacing: 1.1, color: '#B49B69', paddingTop: 2 },
  memoryCopy: { flex: 1 },
  memoryText: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: INK },
  memoryWhere: { marginTop: 3, fontSize: 11.5, color: SOFT, textTransform: 'uppercase', letterSpacing: 0.7 },

  footerCard: { marginTop: 24, borderRadius: 20, padding: 17, backgroundColor: '#EDE1C8' },
  footerTitle: { fontSize: 14, fontWeight: '900', color: INK },
  footerText: { marginTop: 6, fontSize: 13.5, lineHeight: 20, color: '#655845' },
});
