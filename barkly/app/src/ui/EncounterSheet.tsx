import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { BarklyProposal } from '../barkly/coauthor';
import { SocialEncounter } from '../barkly/encounters';
import { PersistentStory } from '../barkly/storyV2';
import { WorldIncident } from '../world/incidents';
import { LOCATIONS } from '../world/locations';
import { NPCS } from '../world/npcs';
import { color, elevation, glyph, radius, space, type } from './theme';
import { TAP_MIN } from './layout';

/**
 * What this sheet actually needs to draw. An NPC encounter and a world
 * incident are the same beat to a player -- something happened, Barkly wants
 * a call from you -- so they share one presentation instead of growing a
 * second sheet that drifts from this one.
 */
export interface ChoiceMoment {
  badge: string;
  /** `rival` paints it hot; `friend` paints it cool. */
  tone: 'rival' | 'friend';
  eyebrow: string;
  title: string;
  prompt: string;
  footnote?: string;
  choices: { id: string; label: string; hint: string }[];
  closeLabel: string;
}

/** An NPC encounter, as a moment. */
export function momentFromEncounter(encounter: SocialEncounter): ChoiceMoment {
  const npc = NPCS[encounter.npcId];
  return {
    badge: npc.name.toUpperCase(),
    tone: npc.relationship === 'rival' ? 'rival' : 'friend',
    eyebrow: encounter.eyebrow,
    title: encounter.title,
    prompt: encounter.prompt,
    footnote: encounter.ladder ? `${encounter.ladder.stage.label} · ${encounter.ladder.hint}` : undefined,
    choices: encounter.choices.map((c) => ({ id: c.id, label: c.label, hint: c.hint })),
    closeLabel: 'Leave this encounter for later',
  };
}

/**
 * A world incident, as a moment. The badge names the PLACE, because that is
 * what is different about these: nobody tapped anything and no dog walked up
 * -- the park itself had something to say about the life you two built.
 */
export function momentFromIncident(incident: WorldIncident): ChoiceMoment {
  const hot = incident.kind === 'rival-provokes' || incident.kind === 'treasure-chaos';
  return {
    badge: LOCATIONS[incident.location].name.toUpperCase(),
    tone: hot ? 'rival' : 'friend',
    eyebrow: incident.actor ? NPCS[incident.actor].name.toUpperCase() : 'OUT OF NOWHERE',
    title: incident.title,
    prompt: incident.barklyOpening,
    footnote: incident.setup,
    choices: incident.choices.map((c) => ({ id: c.id, label: c.label, hint: c.barklyLine })),
    closeLabel: 'Leave this for later',
  };
}

/**
 * A canon proposal, as a moment.
 *
 * Every other beat on this sheet asks the player to react to something the
 * world did. This one is the opposite direction: Barkly is asking for a
 * ruling on something HE decided, so the badge is his own name and the
 * choices are a yes and a no rather than a set of tactics.
 */
export const PROPOSAL_ACCEPT = 'accept';
export const PROPOSAL_REJECT = 'reject';

export function momentFromProposal(proposal: BarklyProposal): ChoiceMoment {
  const TITLES: Record<BarklyProposal['kind'], string> = {
    'object-name': 'He wants to name it',
    territory: 'He is claiming ground',
    signature: 'He says it is tradition now',
    'dog-nickname': 'He has renamed somebody',
  };
  return {
    badge: 'BARKLY',
    tone: 'friend',
    eyebrow: 'HE HAS A PROPOSAL',
    title: TITLES[proposal.kind],
    prompt: proposal.ask,
    footnote: `Whatever you say becomes part of your history together.`,
    choices: [
      { id: PROPOSAL_ACCEPT, label: 'Make it official', hint: proposal.proposedValue },
      { id: PROPOSAL_REJECT, label: 'Absolutely not', hint: 'He will take it badly, briefly.' },
    ],
    closeLabel: 'Not right now',
  };
}

/**
 * A fork in the ongoing saga, as a moment.
 *
 * The badge is the chapter, because that is what makes this one different: the
 * question is not about right now, it is about which story the last several
 * weeks turn out to have been. A choice marked `resolves` ends the saga, and
 * the hint says so plainly rather than springing it on the player.
 */
export function momentFromStory(story: PersistentStory): ChoiceMoment {
  const last = story.chapters[story.chapters.length - 1];
  return {
    badge: `CHAPTER ${story.chapters.length}`,
    tone: story.intensity >= 3 ? 'rival' : 'friend',
    eyebrow: story.title.toUpperCase(),
    title: 'Where does this go?',
    prompt: story.premise,
    footnote: last?.consequence ?? story.nextHook,
    choices: story.choices.map((choice) => ({
      id: choice.id,
      label: choice.label,
      hint: choice.resolves ? `Ends it. ${choice.consequence}` : choice.consequence,
    })),
    closeLabel: 'Let it keep going for now',
  };
}

interface Props {
  moment: ChoiceMoment | null;
  busy: boolean;
  onChoose: (choiceId: string) => void;
  onClose: () => void;
}

function choicePaint(index: number): { body: string; edge: string } {
  if (index % 3 === 0) return { body: color.pop, edge: color.popDeep };
  if (index % 3 === 1) return { body: color.lemon, edge: color.lemonDeep };
  return { body: color.violet, edge: color.violetDeep };
}

/**
 * A relationship moment, not a form. The world stays on screen and the choices
 * are loud physical cards at the bottom, more like toys tossed onto the scene
 * than rows in a settings sheet.
 */
export default function EncounterSheet({ moment, busy, onChoose, onClose }: Props) {
  if (!moment) return null;
  const rival = moment.tone === 'rival';

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.worldScrim} onPress={busy ? undefined : onClose} accessible={false} />

        <View style={styles.scenePrompt} pointerEvents="none">
          <View style={[styles.npcBadge, rival ? styles.npcBadgeRival : styles.npcBadgeFriend]}>
            <Text style={styles.npc}>{moment.badge}</Text>
          </View>
          <Text style={styles.prompt}>{moment.prompt}</Text>
        </View>

        <View style={styles.tray}>
          <LinearGradient
            colors={rival ? [color.coral, color.warmWell] : [color.mint, color.fill]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.trayPaint}
            pointerEvents="none"
          />
          <View style={styles.trayGloss} pointerEvents="none" />
          <View style={[styles.trayEdge, rival ? styles.trayEdgeRival : styles.trayEdgeFriend]} pointerEvents="none" />
          <View style={styles.trayHandle} />

          <View style={styles.topline}>
            <View style={styles.headingCopy}>
              <View style={styles.eyebrowPod}><Text style={styles.eyebrow}>{moment.eyebrow}</Text></View>
              <Text style={styles.title}>{moment.title}</Text>
              {moment.footnote && (
                <Text style={styles.relationshipLine} accessibilityLabel={`${moment.badge}: ${moment.footnote}`}>
                  {moment.footnote}
                </Text>
              )}
            </View>
            <Pressable
              style={styles.closeButton}
              onPress={onClose}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={moment.closeLabel}
            >
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <Text style={styles.question}>WHAT DO YOU TELL BARKLY?</Text>

          <View style={styles.choices}>
            {moment.choices.map((choice, index) => {
              const paint = choicePaint(index);
              return (
                <Pressable
                  key={choice.id}
                  style={({ pressed }) => [styles.choice, { backgroundColor: paint.body, borderColor: paint.edge }, pressed && styles.choicePressed, busy && styles.disabled]}
                  disabled={busy}
                  onPress={() => onChoose(choice.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${choice.label}. ${choice.hint}`}
                >
                  <View style={styles.choiceGloss} pointerEvents="none" />
                  <View style={[styles.choiceEdge, { backgroundColor: paint.edge }]} pointerEvents="none" />
                  <View style={styles.choiceNumber}>
                    <Text style={styles.choiceNumberText}>{index + 1}</Text>
                  </View>
                  <View style={styles.choiceCopy}>
                    <Text style={styles.choiceLabel}>{choice.label}</Text>
                    <Text style={styles.choiceHint}>{choice.hint}</Text>
                  </View>
                  <Text style={styles.arrow}>›</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  worldScrim: { ...StyleSheet.absoluteFill, backgroundColor: color.scrim, opacity: 0.32 },
  scenePrompt: { position: 'absolute', left: space.xl, right: space.xl, top: '15%', alignItems: 'center' },
  npcBadge: { borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.sm, borderWidth: 2, ...elevation.card },
  npcBadgeRival: { backgroundColor: color.coral, borderColor: color.coralDeep },
  npcBadgeFriend: { backgroundColor: color.mint, borderColor: color.mintDeep },
  npc: { ...type.micro, color: color.ink },
  prompt: { ...type.speech, color: color.inkOn, fontWeight: '900', textAlign: 'center', marginTop: space.sm, textShadowColor: color.ink, textShadowRadius: 8, textShadowOffset: { width: 0, height: 2 } },

  tray: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.xl, overflow: 'visible', borderTopWidth: 2, borderColor: color.inkMid, ...elevation.sheet },
  trayPaint: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  trayGloss: { position: 'absolute', left: space.xl, right: space.xl, top: space.xs, height: space.sm, borderRadius: radius.pill, backgroundColor: color.glossSoft },
  trayEdge: { position: 'absolute', left: space.lg, right: space.lg, bottom: -6, height: space.md, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  trayEdgeRival: { backgroundColor: color.coralDeep },
  trayEdgeFriend: { backgroundColor: color.mintDeep },
  trayHandle: { alignSelf: 'center', width: 50, height: 5, borderRadius: radius.pill, backgroundColor: color.inkMid, marginBottom: space.md, opacity: 0.6 },
  topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.md },
  headingCopy: { flex: 1 },
  eyebrowPod: { alignSelf: 'flex-start', backgroundColor: color.ink, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: space.xs },
  eyebrow: { ...type.micro, color: color.inkOn },
  title: { ...type.title, color: color.ink, marginTop: space.sm },
  relationshipLine: { ...type.caption, color: color.inkMid, marginTop: space.xs, fontWeight: '700' },
  closeButton: { width: TAP_MIN, height: TAP_MIN, borderRadius: radius.pill, backgroundColor: color.card, alignItems: 'center', justifyContent: 'center', ...elevation.low },
  close: { fontSize: glyph.close, lineHeight: TAP_MIN, width: TAP_MIN, height: TAP_MIN, textAlign: 'center', color: color.inkSoft },
  question: { ...type.micro, color: color.inkMid, marginTop: space.lg },
  choices: { marginTop: space.sm, gap: space.md },
  choice: { minHeight: 70, borderRadius: radius.md, borderWidth: 2, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, paddingVertical: space.sm, overflow: 'visible', ...elevation.card },
  choicePressed: { transform: [{ scale: 0.985 }] },
  choiceGloss: { position: 'absolute', left: space.md, right: space.md, top: space.xs, height: space.sm, borderRadius: radius.pill, backgroundColor: color.gloss },
  choiceEdge: { position: 'absolute', left: space.sm, right: space.sm, bottom: -5, height: space.sm, borderBottomLeftRadius: radius.sm, borderBottomRightRadius: radius.sm },
  choiceNumber: { width: 34, height: 34, borderRadius: radius.pill, backgroundColor: color.card, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: color.inkMid },
  choiceNumberText: { ...type.caption, color: color.ink, fontWeight: '900' },
  choiceCopy: { flex: 1, marginLeft: space.md },
  choiceLabel: { ...type.strong, color: color.ink, fontWeight: '900' },
  choiceHint: { ...type.caption, color: color.inkMid, marginTop: space.xs },
  arrow: { fontSize: glyph.arrow, lineHeight: 30, color: color.ink, marginLeft: space.sm },
  disabled: { opacity: 0.48 },
});
