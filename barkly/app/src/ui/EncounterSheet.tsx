import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SocialEncounter } from '../barkly/encounters';
import { NPCS } from '../world/npcs';
import { color, elevation, glyph, radius, space, type } from './theme';
import { TAP_MIN } from './layout';

interface Props {
  encounter: SocialEncounter | null;
  busy: boolean;
  onChoose: (choiceId: string) => void;
  onClose: () => void;
}

/**
 * Encounter v2 presentation.
 *
 * The old version replaced the dogs with a centered white form: title, meter,
 * three rows. The mechanics were good and the fiction disappeared exactly when
 * it mattered most.
 *
 * A full in-world cinematic belongs in BarklyRoom later. This intermediate
 * surface already fixes the biggest presentation mistake without touching the
 * encounter engine: the actual scene stays visible above, the relationship
 * meter is gone, and the choices arrive as a low dialogue tray over the world.
 */
export default function EncounterSheet({ encounter, busy, onChoose, onClose }: Props) {
  if (!encounter) return null;
  const npc = NPCS[encounter.npcId];

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          style={styles.worldScrim}
          onPress={busy ? undefined : onClose}
          accessible={false}
        />

        <View style={styles.scenePrompt} pointerEvents="none">
          <Text style={styles.npc}>{npc.name.toUpperCase()}</Text>
          <Text style={styles.prompt}>{encounter.prompt}</Text>
        </View>

        <View style={styles.tray}>
          <View style={styles.trayHandle} />
          <View style={styles.topline}>
            <View style={styles.headingCopy}>
              <Text style={styles.eyebrow}>{encounter.eyebrow}</Text>
              <Text style={styles.title}>{encounter.title}</Text>
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

          {encounter.ladder && (
            <Text style={styles.relationshipLine} accessibilityLabel={`${npc.name}: ${encounter.ladder.stage.label}. ${encounter.ladder.hint}`}>
              {encounter.ladder.stage.label} · {encounter.ladder.hint}
            </Text>
          )}

          <Text style={styles.question}>What do you tell Barkly?</Text>

          <View style={styles.choices}>
            {encounter.choices.map((choice, index) => (
              <Pressable
                key={choice.id}
                style={({ pressed }) => [
                  styles.choice,
                  pressed && styles.choicePressed,
                  busy && styles.disabled,
                ]}
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

          <Text style={styles.footer}>Whatever you pick becomes part of their history.</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  worldScrim: { ...StyleSheet.absoluteFill, backgroundColor: color.scrim, opacity: 0.42 },
  scenePrompt: {
    position: 'absolute',
    left: space.xl,
    right: space.xl,
    top: '17%',
    alignItems: 'center',
  },
  npc: { ...type.micro, color: color.inkOn, backgroundColor: color.ink, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs, overflow: 'hidden' },
  prompt: { ...type.speech, color: color.inkOn, fontWeight: '800', textAlign: 'center', marginTop: space.sm, textShadowColor: color.ink, textShadowRadius: 8, textShadowOffset: { width: 0, height: 2 } },

  tray: {
    backgroundColor: color.paper,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.xl,
    ...elevation.sheet,
  },
  trayHandle: { alignSelf: 'center', width: 50, height: 5, borderRadius: radius.pill, backgroundColor: color.line, marginBottom: space.md },
  topline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.md },
  headingCopy: { flex: 1 },
  eyebrow: { ...type.micro, color: color.goldInk },
  title: { ...type.title, color: color.ink, marginTop: space.xs },
  close: { fontSize: glyph.close, lineHeight: TAP_MIN, width: TAP_MIN, height: TAP_MIN, textAlign: 'center', color: color.inkSoft },
  relationshipLine: { ...type.caption, color: color.inkSoft, marginTop: space.sm, fontStyle: 'italic' },
  question: { ...type.micro, color: color.inkSoft, textTransform: 'uppercase', marginTop: space.lg },
  choices: { marginTop: space.sm, gap: space.sm },
  choice: {
    minHeight: 68,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: color.line,
    backgroundColor: color.card,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    ...elevation.low,
  },
  choicePressed: { transform: [{ scale: 0.985 }], backgroundColor: color.well },
  choiceNumber: { width: 32, height: 32, borderRadius: radius.pill, backgroundColor: color.ink, alignItems: 'center', justifyContent: 'center' },
  choiceNumberText: { ...type.caption, color: color.inkOn, fontWeight: '900' },
  choiceCopy: { flex: 1, marginLeft: space.md },
  choiceLabel: { ...type.strong, color: color.ink },
  choiceHint: { ...type.caption, color: color.inkSoft, marginTop: space.xs },
  arrow: { fontSize: glyph.arrow, lineHeight: 30, color: color.warmLine, marginLeft: space.sm },
  footer: { ...type.caption, color: color.inkSoft, textAlign: 'center', marginTop: space.md },
  disabled: { opacity: 0.48 },
});
