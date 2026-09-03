import React from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RelationshipProfile, RelationshipLore } from '../barkly/relationship';
import { Treasure, TREASURES } from '../world/stash';
import { color, elevation, glyph, radius, space, type } from './theme';
import { TAP_MIN } from './layout';
import { NPC_ART } from './npcArt';
import TreasureIcon from './TreasureIcon';

const BARKLY_FACE = require('../../assets/barkly/renders/face.png');

/** Read from the list, never typed: adding a treasure must move the total. */
const TREASURE_TOTAL = TREASURES.length;

interface Props {
  visible: boolean;
  onClose: () => void;
  profile: RelationshipProfile;
  /** Everything he has dug up. Drawn here; it used to be text in Settings. */
  stash: Treasure[];
}

/**
 * Pack Book v2: relationship evidence, not analytics.
 *
 * The first version exposed the machinery — 73/100 trait scores, progress bars,
 * intensity dots, numbered memory rows, and a footer that literally explained
 * the product thesis. Accurate, but it made the most personal screen in Barkly
 * look like a dashboard.
 *
 * This pass keeps the SAME underlying state and throws away the spreadsheet
 * presentation. Traits are stamps. Memories are taped cards. Lore is a pile of
 * receipts. The current saga is "current drama." The player should be able to
 * glance at this and see a weird friendship, not reverse-engineer our scoring.
 */

function Tape({ side = 'left' }: { side?: 'left' | 'right' }) {
  return <View style={[styles.tape, side === 'right' && styles.tapeRight]} pointerEvents="none" />;
}

/**
 * Colour carries the KIND of a receipt, so the pile reads before it is read.
 * It used to alternate by index parity, which meant a beef file and a friend
 * file were the same colour half the time and the palette said nothing.
 */
const LORE_LOOK: Record<RelationshipLore['kind'], { fill: string; edge: string; kicker: string; tilt: string }> = {
  friendship: { fill: color.goodWell, edge: color.goodLine, kicker: color.good, tilt: '-0.5deg' },
  rivalry: { fill: color.dangerWell, edge: color.dangerLine, kicker: color.danger, tilt: '0.5deg' },
  treasure: { fill: color.goldWell, edge: color.gold, kicker: color.goldInk, tilt: '-0.4deg' },
  obsession: { fill: color.violetWell, edge: color.violet, kicker: color.violetDeep, tilt: '0.4deg' },
};

/**
 * The face or the object a receipt is about.
 *
 * An obsession has no subject art on purpose — it is an idea, not a thing —
 * and gets a drawn thought-spiral rather than a blank hole or a stock icon.
 */
function LoreSubject({ item }: { item: RelationshipLore }) {
  const look = LORE_LOOK[item.kind];
  const subject = item.subject;
  return (
    <View style={[styles.subjectFrame, { borderColor: look.edge, backgroundColor: color.card }]}>
      {subject?.art === 'npc' ? (
        <Image source={NPC_ART[subject.id]} style={styles.subjectPhoto} resizeMode="contain" />
      ) : subject?.art === 'treasure' ? (
        <TreasureIcon id={subject.id} size={38} />
      ) : (
        <View style={styles.spiral}>
          <View style={[styles.spiralRing, { borderColor: look.edge }]} />
          <View style={[styles.spiralRing, styles.spiralInner, { borderColor: look.kicker }]} />
        </View>
      )}
    </View>
  );
}

function TraitStamp({ label, detail, index }: { label: string; detail: string; index: number }) {
  return (
    <View style={[styles.stamp, index % 2 === 0 ? styles.stampLeft : styles.stampRight]}>
      <Text style={styles.stampKicker}>BARKLY IS</Text>
      <Text style={styles.stampLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.stampDetail}>{detail}</Text>
    </View>
  );
}

function loreLabel(item: RelationshipLore): string {
  switch (item.kind) {
    case 'friendship': return 'FRIEND FILE';
    case 'rivalry': return 'BEEF FILE';
    case 'treasure': return 'SACRED JUNK';
    case 'obsession': return 'CURRENT FIXATION';
  }
}

export default function PackBookSheet({ visible, onClose, profile, stash }: Props) {
  const stageDots = Array.from({ length: 5 }, (_, i) => i < profile.stage.level);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessible={false}>
        <Pressable style={styles.sheet} onPress={() => {}} accessible={false}>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>THE PACK BOOK</Text>
              <Text style={styles.title}>Us, apparently.</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close Pack Book"
            >
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            <View style={styles.cover}>
              <Tape />
              {/*
                The cover of the book about a specific dog now has the dog on
                it. Everything above this line was type on a dark card; the
                first thing a player saw on the most personal screen in the app
                was a headline.
              */}
              <View style={styles.coverTop}>
                <View style={styles.coverWords}>
                  <Text style={styles.coverKicker}>THIS PARTICULAR BARKLY</Text>
                  <Text style={styles.archetype}>{profile.archetype}</Text>
                </View>
                <View style={styles.portraitFrame}>
                  <Image
                    source={BARKLY_FACE}
                    style={styles.portrait}
                    resizeMode="contain"
                    accessibilityLabel="Barkly"
                  />
                </View>
              </View>
              <Text style={styles.tagline}>{profile.tagline}</Text>

              <View style={styles.stageRow} accessibilityLabel={`Pack stage ${profile.stage.label}`}>
                <Text style={styles.stageLabel}>{profile.stage.label}</Text>
                <View style={styles.stageDots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                  {stageDots.map((on, i) => <View key={i} style={[styles.stageDot, on && styles.stageDotOn]} />)}
                </View>
              </View>
              <Text style={styles.stageBlurb}>{profile.stage.blurb}</Text>
              <Text style={styles.marginNote}>Nobody picked this at signup. You caused it.</Text>
            </View>

            {profile.story && (
              <>
                <Text style={styles.section}>Current drama</Text>
                <View style={styles.dramaCard}>
                  <Tape side="right" />
                  <View style={styles.dramaTop}>
                    <Text style={styles.dramaKicker}>ONGOING SITUATION</Text>
                    <Text style={styles.dramaScribble}>do not make this worse</Text>
                  </View>
                  <Text style={styles.dramaTitle}>{profile.story.title}</Text>
                  <Text style={styles.dramaChapter}>{profile.story.chapter}</Text>
                  <Text style={styles.dramaPremise}>{profile.story.premise}</Text>
                  <View style={styles.nextCard}>
                    <Text style={styles.nextLabel}>WHAT'S HANGING OVER US</Text>
                    <Text style={styles.nextText}>{profile.story.nextHook}</Text>
                  </View>
                </View>
              </>
            )}

            <Text style={styles.section}>What you've turned him into</Text>
            {profile.traits.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Still becoming a problem.</Text>
                <Text style={styles.emptyText}>Keep talking, training, wandering around and making choices. The labels show up after they become true.</Text>
              </View>
            ) : (
              <View style={styles.stampPile}>
                {profile.traits.map((trait, index) => (
                  <TraitStamp key={trait.id} label={trait.label} detail={trait.detail} index={index} />
                ))}
              </View>
            )}

            <Text style={styles.section}>Our bits</Text>
            {profile.rituals.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No running bit yet.</Text>
                <Text style={styles.emptyText}>Teach Barkly something dumb and keep doing it. Repetition is how a command turns into lore.</Text>
              </View>
            ) : (
              profile.rituals.map((ritual, index) => (
                <View key={ritual.id} style={[styles.ritualCard, index % 2 === 0 ? styles.tiltLeft : styles.tiltRight]}>
                  <View style={styles.ritualHead}>
                    <Text style={styles.ritualCue}>“{ritual.cue}”</Text>
                    {ritual.signature && <Text style={styles.signature}>SIGNATURE BIT</Text>}
                  </View>
                  <Text style={styles.ritualTitle}>{ritual.title}</Text>
                  <Text style={styles.ritualDetail}>{ritual.detail}</Text>
                </View>
              ))
            )}

            <Text style={styles.section}>Receipts</Text>
            {profile.lore.length === 0 ? (
              <Text style={styles.emptyLine}>Friends, enemies, sacred junk and ridiculous fixations will leave receipts here.</Text>
            ) : (
              <View style={styles.receipts}>
                {profile.lore.map((item) => {
                  const look = LORE_LOOK[item.kind];
                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.receipt,
                        { backgroundColor: look.fill, borderColor: look.edge, transform: [{ rotate: look.tilt }] },
                      ]}
                    >
                      <LoreSubject item={item} />
                      <View style={styles.receiptWords}>
                        <Text style={[styles.receiptKicker, { color: look.kicker }]}>{loreLabel(item)}</Text>
                        <Text style={styles.receiptTitle}>{item.title}</Text>
                        <Text style={styles.receiptDetail}>{item.detail}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <Text style={styles.section}>The stash</Text>
            {/*
              This lived in SETTINGS as a bulleted list of names, which is
              where an app puts its cache size. It is the collectible spine of
              the game: 24 dug-up objects with the funniest writing in the
              product attached to them. Drawn, on a shelf, in the book about
              what the two of you have.
            */}
            {stash.length === 0 ? (
              <Text style={styles.emptyLine}>Empty. There is a dig spot at the park, and the sand at the beach gives things up too.</Text>
            ) : (
              <View style={styles.shelf}>
                <View style={styles.shelfGrid}>
                  {stash.map((t) => (
                    <View key={t.id} style={styles.find} accessibilityLabel={t.name}>
                      <View style={styles.findArt}>
                        <TreasureIcon id={t.id} size={40} />
                      </View>
                      <Text style={styles.findName} numberOfLines={3}>{t.name}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.shelfBoard} />
                <Text style={styles.shelfCount}>
                  {stash.length} of {TREASURE_TOTAL} things he refuses to give back
                </Text>
              </View>
            )}

            <Text style={styles.section}>Stuff we actually remember</Text>
            {profile.coreMemories.length === 0 ? (
              <Text style={styles.emptyLine}>Nothing has made the wall yet.</Text>
            ) : (
              <View style={styles.memoryWall}>
                {profile.coreMemories.map((memory, index) => (
                  <View key={memory.id} style={[styles.memoryCard, index % 2 === 0 ? styles.memoryLeft : styles.memoryRight]}>
                    <Tape side={index % 2 === 0 ? 'left' : 'right'} />
                    <Text style={styles.memoryKicker}>KEEP THIS ONE</Text>
                    <Text style={styles.memoryText}>{memory.what}</Text>
                    {memory.where && <Text style={styles.memoryWhere}>{memory.where}</Text>}
                  </View>
                ))}
              </View>
            )}

            <View style={styles.lastNote}>
              <Text style={styles.lastNoteText}>Someone else can download Barkly. They still won't have this mess.</Text>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: color.scrim, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '93%',
    backgroundColor: color.paper,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    ...elevation.sheet,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: space.md },
  eyebrow: { ...type.micro, color: color.goldInk },
  title: { ...type.display, color: color.ink, marginTop: space.xxs },
  close: { fontSize: glyph.close, lineHeight: TAP_MIN, width: TAP_MIN, height: TAP_MIN, textAlign: 'center', color: color.ink },
  scrollContent: { paddingBottom: space.xxl },

  cover: {
    marginTop: space.xs,
    backgroundColor: color.ink,
    borderRadius: radius.lg,
    paddingHorizontal: space.xl,
    paddingTop: space.xxl,
    paddingBottom: space.xl,
    transform: [{ rotate: '-0.35deg' }],
    ...elevation.card,
  },
  tape: {
    position: 'absolute',
    width: 76,
    height: 18,
    top: -8,
    left: 26,
    borderRadius: radius.xs,
    backgroundColor: color.goldSoft,
    opacity: 0.75,
    transform: [{ rotate: '-5deg' }],
  },
  tapeRight: { left: undefined, right: 24, transform: [{ rotate: '6deg' }] },
  coverTop: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  coverWords: { flex: 1, minWidth: 0 },
  portraitFrame: {
    width: 78,
    height: 78,
    borderRadius: radius.md,
    borderWidth: 3,
    borderColor: color.goldSoft,
    backgroundColor: color.violetDeep,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '2.5deg' }],
    ...elevation.card,
  },
  portrait: { width: '124%', height: '124%' },
  coverKicker: { ...type.micro, color: color.goldSoft },
  archetype: { ...type.display, color: color.paper, marginTop: space.sm },
  tagline: { ...type.body, color: color.inkOn, marginTop: space.sm },
  stageRow: { marginTop: space.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  stageLabel: { ...type.strong, color: color.goldSoft, textTransform: 'uppercase' },
  stageDots: { flexDirection: 'row', gap: space.xs },
  stageDot: { width: 10, height: 10, borderRadius: radius.pill, borderWidth: 1.5, borderColor: color.inkMid },
  stageDotOn: { backgroundColor: color.goldSoft, borderColor: color.goldSoft },
  stageBlurb: { ...type.small, color: color.inkOn, marginTop: space.sm },
  marginNote: { ...type.caption, color: color.goldSoft, marginTop: space.lg, fontStyle: 'italic', textAlign: 'right' },

  section: { ...type.micro, color: color.inkSoft, textTransform: 'uppercase', marginTop: space.xxl, marginBottom: space.md },

  dramaCard: { backgroundColor: color.warmWell, borderRadius: radius.lg, padding: space.lg, borderWidth: 1.5, borderColor: color.warmLine, ...elevation.low },
  dramaTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  dramaKicker: { ...type.micro, color: color.danger },
  dramaScribble: { ...type.caption, color: color.inkSoft, fontStyle: 'italic', transform: [{ rotate: '-2deg' }] },
  dramaTitle: { ...type.display, color: color.ink, marginTop: space.sm },
  dramaChapter: { ...type.caption, color: color.goldInk, textTransform: 'uppercase', marginTop: space.xs },
  dramaPremise: { ...type.small, color: color.inkMid, marginTop: space.md },
  nextCard: { marginTop: space.lg, paddingTop: space.md, borderTopWidth: 1.5, borderTopColor: color.warmLine },
  nextLabel: { ...type.micro, color: color.danger },
  nextText: { ...type.small, color: color.ink, fontWeight: '600', marginTop: space.xs },

  stampPile: { gap: space.md },
  stamp: { borderRadius: radius.sm, padding: space.lg, borderWidth: 2, borderStyle: 'dashed', backgroundColor: color.card, ...elevation.low },
  stampLeft: { borderColor: color.gold, transform: [{ rotate: '-0.7deg' }] },
  stampRight: { borderColor: color.goodLine, transform: [{ rotate: '0.7deg' }] },
  stampKicker: { ...type.micro, color: color.inkSoft },
  stampLabel: { ...type.title, color: color.ink, marginTop: space.xs },
  stampDetail: { ...type.small, color: color.inkSoft, marginTop: space.sm },

  emptyCard: { borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: color.line, padding: space.lg },
  emptyTitle: { ...type.strong, color: color.ink },
  emptyText: { ...type.small, color: color.inkSoft, marginTop: space.xs },
  emptyLine: { ...type.small, color: color.inkSoft, fontStyle: 'italic' },

  ritualCard: { backgroundColor: color.card, borderRadius: radius.md, padding: space.lg, marginBottom: space.sm, borderWidth: 1, borderColor: color.line, ...elevation.low },
  tiltLeft: { transform: [{ rotate: '-0.45deg' }] },
  tiltRight: { transform: [{ rotate: '0.45deg' }] },
  ritualHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  ritualCue: { ...type.strong, color: color.ink, flex: 1 },
  signature: { ...type.micro, color: color.goldInk, backgroundColor: color.goldWell, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: space.xs },
  ritualTitle: { ...type.small, color: color.inkMid, fontWeight: '700', marginTop: space.sm },
  ritualDetail: { ...type.caption, color: color.inkSoft, marginTop: space.xs },

  receipts: { gap: space.sm },
  receipt: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    borderRadius: radius.sm,
    padding: space.lg,
    borderWidth: 2,
    ...elevation.low,
  },
  receiptWords: { flex: 1, minWidth: 0 },
  subjectFrame: {
    width: 54,
    height: 54,
    flexShrink: 0,
    borderRadius: radius.sm,
    borderWidth: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** The renders are full-body; crop up so the face fills the frame. */
  subjectPhoto: { width: '150%', height: '150%', marginTop: '-26%' },
  spiral: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  spiralRing: { position: 'absolute', width: 30, height: 30, borderRadius: radius.pill, borderWidth: 3 },
  spiralInner: { width: 15, height: 15, borderWidth: 3 },
  receiptKicker: { ...type.micro },
  receiptTitle: { ...type.strong, color: color.ink, marginTop: space.xs },
  receiptDetail: { ...type.small, color: color.inkMid, marginTop: space.xs },

  shelf: { backgroundColor: color.well, borderRadius: radius.md, borderWidth: 2, borderColor: color.gold, padding: space.lg, ...elevation.low },
  shelfGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  find: { width: 74, alignItems: 'center' },
  findArt: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: color.card,
    borderWidth: 2,
    borderColor: color.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.low,
  },
  findName: { ...type.caption, color: color.goldInk, textAlign: 'center', marginTop: space.xs },
  shelfBoard: { height: 5, borderRadius: radius.pill, backgroundColor: color.gold, marginTop: space.lg },
  shelfCount: { ...type.caption, color: color.goldInk, marginTop: space.sm, textAlign: 'right', fontStyle: 'italic' },

  memoryWall: { gap: space.md },
  memoryCard: { backgroundColor: color.card, borderRadius: radius.xs, paddingHorizontal: space.lg, paddingTop: space.xl, paddingBottom: space.lg, borderWidth: 1, borderColor: color.line, ...elevation.card },
  memoryLeft: { marginRight: space.md, transform: [{ rotate: '-0.6deg' }] },
  memoryRight: { marginLeft: space.md, transform: [{ rotate: '0.6deg' }] },
  memoryKicker: { ...type.micro, color: color.goldInk },
  memoryText: { ...type.body, color: color.ink, fontWeight: '600', marginTop: space.sm },
  memoryWhere: { ...type.caption, color: color.inkSoft, textTransform: 'uppercase', marginTop: space.sm },

  lastNote: { marginTop: space.xxl, marginHorizontal: space.lg, borderTopWidth: 1.5, borderBottomWidth: 1.5, borderColor: color.line, paddingVertical: space.lg, transform: [{ rotate: '-0.5deg' }] },
  lastNoteText: { ...type.small, color: color.inkMid, fontStyle: 'italic', textAlign: 'center' },
});
