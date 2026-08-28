import React from 'react';
import { color } from './theme';
import { TAP_MIN } from './layout';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RelationshipProfile } from '../barkly/relationship';

interface Props {
  visible: boolean;
  onClose: () => void;
  profile: RelationshipProfile;
}


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

            {profile.story && (
              <>
                <Text style={styles.section}>Current saga</Text>
                <View style={styles.storyCard}>
                  <View style={styles.storyTop}>
                    <Text style={styles.storyKicker}>ONGOING</Text>
                    <Text style={styles.storyIntensity}>{'●'.repeat(profile.story.intensity)}</Text>
                  </View>
                  <Text style={styles.storyTitle}>{profile.story.title}</Text>
                  <Text style={styles.storyChapter}>{profile.story.chapter}</Text>
                  <Text style={styles.storyPremise}>{profile.story.premise}</Text>
                  <View style={styles.nextBeat}>
                    <Text style={styles.nextLabel}>NEXT BEAT</Text>
                    <Text style={styles.nextText}>{profile.story.nextHook}</Text>
                  </View>
                </View>
              </>
            )}

            <Text style={styles.section}>What you turned him into</Text>
            {profile.traits.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Still forming.</Text>
                <Text style={styles.emptyText}>No label yet. Keep doing things together and the Pack Book will call out the traits that actually become true.</Text>
              </View>
            ) : (
              profile.traits.map((trait) => (
                <TraitCard key={trait.id} label={trait.label} score={trait.score} detail={trait.detail} />
              ))
            )}

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
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(28,24,19,0.48)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '91%', backgroundColor: color.paper, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12 },
  eyebrow: { fontSize: 12, fontWeight: '900', letterSpacing: 2.1, color: color.goldInk },
  title: { marginTop: 2, fontSize: 24, fontWeight: '900', color: color.ink, letterSpacing: -0.4 },
  /**
   * The way out of a sheet, at a real tap size.
   *
   * Seven sheets each declared this separately and every one of them measured
   * about 23x22 — a 15-18px glyph with 4px of padding. Six of the seven even
   * carried a comment saying the X was "the labelled way out", which was true
   * and beside the point: it was the smallest target in the app, on the
   * control a child needs when they are stuck. layout.TAP_MIN, like the rest.
   */
  close: { fontSize: 18, lineHeight: TAP_MIN, width: TAP_MIN, height: TAP_MIN, textAlign: 'center', color: color.ink },
  scrollContent: { paddingBottom: 34 },

  hero: { backgroundColor: color.ink, borderRadius: 22, paddingHorizontal: 20, paddingVertical: 20, marginTop: 4 },
  stage: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5, color: color.goldSoft },
  archetype: { marginTop: 7, fontSize: 24, lineHeight: 32, fontWeight: '900', color: color.paper, letterSpacing: -0.7 },
  tagline: { marginTop: 7, fontSize: 15, lineHeight: 21, color: color.fill },
  bondTrack: { height: 7, borderRadius: 999, backgroundColor: color.inkMid, overflow: 'hidden', marginTop: 17 },
  bondFill: { height: 7, borderRadius: 999, backgroundColor: color.goldSoft },
  // `goldSoft`, because the hero card behind it is `color.ink`. It was
  // `inkSoft` — a DARK token on a DARK surface, 2.07:1 — which the contrast
  // test did not catch because that test only checked the light surfaces.
  // It checks both directions now.
  stageBlurb: { marginTop: 9, fontSize: 12, lineHeight: 18, color: color.goldSoft },

  explainer: { marginTop: 15, fontSize: 13, lineHeight: 20, color: color.inkSoft },
  section: { marginTop: 23, marginBottom: 9, fontSize: 12, fontWeight: '900', letterSpacing: 1.3, color: color.inkSoft, textTransform: 'uppercase' },

  storyCard: { borderRadius: 22, padding: 17, backgroundColor: color.line, borderWidth: 1.5, borderColor: color.warmLine },
  storyTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  storyKicker: { fontSize: 10, fontWeight: '900', letterSpacing: 1.7, color: color.goldInk },
  storyIntensity: { fontSize: 10, letterSpacing: 2, color: color.goldInk },
  storyTitle: { marginTop: 6, fontSize: 24, fontWeight: '900', color: color.ink, letterSpacing: -0.3 },
  storyChapter: { marginTop: 3, fontSize: 12, fontWeight: '900', letterSpacing: 0.8, color: color.goldInk, textTransform: 'uppercase' },
  storyPremise: { marginTop: 10, fontSize: 13, lineHeight: 20, color: color.inkMid },
  nextBeat: { marginTop: 13, borderTopWidth: 1, borderTopColor: color.goldSoft, paddingTop: 10 },
  nextLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.3, color: color.goldInk },
  nextText: { marginTop: 3, fontSize: 12, lineHeight: 18, fontWeight: '600', color: color.ink },

  traitCard: { backgroundColor: color.card, borderRadius: 18, padding: 14, marginBottom: 9 },
  traitHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  traitLabel: { fontSize: 15, fontWeight: '800', color: color.ink },
  traitScore: { fontSize: 13, fontWeight: '900', color: color.goldInk },
  traitTrack: { height: 6, borderRadius: 999, backgroundColor: color.fill, overflow: 'hidden', marginTop: 9 },
  traitFill: { height: 6, borderRadius: 999, backgroundColor: color.gold },
  traitDetail: { marginTop: 8, fontSize: 12, lineHeight: 18, color: color.inkSoft },

  emptyCard: { borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: color.line, padding: 16 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: color.ink },
  emptyText: { marginTop: 5, fontSize: 13, lineHeight: 19, color: color.inkSoft },
  emptyLine: { fontSize: 13, lineHeight: 20, color: color.inkSoft, fontStyle: 'italic' },

  loreCard: { backgroundColor: color.card, borderRadius: 18, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: color.fill },
  signatureCard: { borderColor: color.warmLine, borderWidth: 1.5 },
  loreHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  loreTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: color.ink },
  loreDetail: { marginTop: 4, fontSize: 13, lineHeight: 19, color: color.inkSoft },
  signature: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1, color: color.goldInk },

  memoryRow: { flexDirection: 'row', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: color.fill },
  memoryNumber: { width: 24, fontSize: 12, fontWeight: '900', letterSpacing: 1.1, color: color.inkSoft, paddingTop: 2 },
  memoryCopy: { flex: 1 },
  memoryText: { fontSize: 13, lineHeight: 20, fontWeight: '600', color: color.ink },
  memoryWhere: { marginTop: 3, fontSize: 12, color: color.inkSoft, textTransform: 'uppercase', letterSpacing: 0.7 },

  footerCard: { marginTop: 24, borderRadius: 18, padding: 17, backgroundColor: color.fill },
  footerTitle: { fontSize: 13, fontWeight: '900', color: color.ink },
  footerText: { marginTop: 6, fontSize: 13, lineHeight: 20, color: color.inkMid },
});
