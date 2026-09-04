/**
 * One dialogue surface for Barkly, NPCs and thoughts.
 *
 * VISUALS ARE FROZEN. This pass changes only turn staging: when an NPC line is
 * queued at the same moment Barkly starts speaking, Barkly owns the rail first.
 * The other dog is never voiced. Its bubble appears after Barkly finishes and
 * remains for a word-count-based reading dwell even if the controller's older
 * fixed timer has already cleared the source bubble.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { color, elevation, radius, space, type } from './theme';
import { DIALOGUE_GAP, DIALOGUE_HEIGHT, RESTING_DIALOGUE_HEIGHT, SPEECH_MAX_LINES, TAP_MIN } from './layout';
import { pageDwellMs, paginateSpeech } from './speechPages';
import { getVoiceActivity, subscribeVoiceActivity } from '../audio/voiceActivity';
import { npcReadMs } from '../world/npcExchange';

export type Speaker = { name: string; kind: 'barkly' | 'npc' } | null;

interface Props {
  speaker: Speaker;
  line: string | null;
  youSaid?: string | null;
  thought?: string | null;
  hint: string;
  asleep?: boolean;
  /** Compact Talk/Type controls live inside the response surface. */
  actions?: React.ReactNode;
  /**
   * HOW MANY of them, so the text is narrowed by exactly as much as they take.
   *
   * `copyWithActions` reserved a flat 96px -- room for two buttons -- on EVERY
   * line, for the whole life of the panel. On the web build the microphone is
   * not available and only one button is drawn, so a third of the reserved
   * strip was empty; measured on a 360px phone the text column was 156px of a
   * 304px bubble. Half the bubble was padding for a button that was not there.
   */
  actionSlots?: number;
}

interface QueuedNpc {
  name: string;
  line: string;
}

export default function DialoguePanel({ speaker, line, youSaid, thought, hint, asleep, actions, actionSlots = 2 }: Props) {
  const [voice, setVoice] = useState(getVoiceActivity);
  const [queuedNpc, setQueuedNpc] = useState<QueuedNpc | null>(null);
  const [npcReady, setNpcReady] = useState(false);
  const npcDwellTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const npcGraceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousSpeaking = useRef(voice.speaking);
  const suppressedBarklyLine = useRef<string | null>(null);

  useEffect(() => subscribeVoiceActivity(setVoice), []);

  useEffect(() => () => {
    if (npcDwellTimer.current) clearTimeout(npcDwellTimer.current);
    if (npcGraceTimer.current) clearTimeout(npcGraceTimer.current);
  }, []);

  // Capture the NPC response as soon as the controller offers it, but do not
  // automatically show it. npcTalk currently creates the bubble just before
  // it calls Barkly's speak(); this grace window lets that voice claim the
  // first beat without a one-frame flash of the response.
  useEffect(() => {
    if (speaker?.kind !== 'npc' || !line) return;
    setQueuedNpc({ name: speaker.name, line });
    setNpcReady(false);
    if (npcDwellTimer.current) clearTimeout(npcDwellTimer.current);
    if (npcGraceTimer.current) clearTimeout(npcGraceTimer.current);
    npcGraceTimer.current = setTimeout(() => {
      if (!getVoiceActivity().speaking) {
        setNpcReady(true);
        npcDwellTimer.current = setTimeout(() => {
          setNpcReady(false);
          setQueuedNpc(null);
        }, npcReadMs(line));
      }
    }, 180);
  }, [speaker?.kind, speaker?.name, line]);

  // Barkly entering the voice engine always wins the floor. When that exact
  // utterance ends, the cached NPC response receives a fresh reading window.
  useEffect(() => {
    const wasSpeaking = previousSpeaking.current;
    previousSpeaking.current = voice.speaking;

    if (voice.speaking && queuedNpc) {
      if (npcGraceTimer.current) clearTimeout(npcGraceTimer.current);
      if (npcDwellTimer.current) clearTimeout(npcDwellTimer.current);
      setNpcReady(false);
      if (voice.line) suppressedBarklyLine.current = voice.line;
      return;
    }

    if (wasSpeaking && !voice.speaking && queuedNpc) {
      setNpcReady(true);
      if (npcDwellTimer.current) clearTimeout(npcDwellTimer.current);
      npcDwellTimer.current = setTimeout(() => {
        setNpcReady(false);
        setQueuedNpc(null);
      }, npcReadMs(queuedNpc.line));
    }
  }, [voice.speaking, voice.line, queuedNpc]);

  // Once the controller produces a genuinely new Barkly line, normal dialogue
  // resumes. This prevents his pre-NPC line from popping back into the panel
  // after the NPC response disappears.
  useEffect(() => {
    if (speaker?.kind !== 'barkly' || !line) return;
    if (suppressedBarklyLine.current && line !== suppressedBarklyLine.current) {
      suppressedBarklyLine.current = null;
    }
  }, [speaker?.kind, line]);

  const voiceOwnsNpcTurn = Boolean(queuedNpc && voice.speaking && voice.line);
  const visibleNpc = queuedNpc && npcReady ? queuedNpc : null;
  const suppressOldBarkly = speaker?.kind === 'barkly' && line && line === suppressedBarklyLine.current && !voice.speaking;

  const visibleSpeaker: Speaker = voiceOwnsNpcTurn
    ? { name: 'Barkly', kind: 'barkly' }
    : visibleNpc
      ? { name: visibleNpc.name, kind: 'npc' }
      : speaker?.kind === 'npc'
        ? null
        : suppressOldBarkly
          ? null
          : speaker;

  const visibleLine = voiceOwnsNpcTurn
    ? voice.line
    : visibleNpc
      ? visibleNpc.line
      : speaker?.kind === 'npc'
        ? null
        : suppressOldBarkly
          ? null
          : line;

  const visibleYouSaid = visibleSpeaker?.kind === 'barkly' && !voiceOwnsNpcTurn ? youSaid : null;
  const said = visibleLine ?? thought ?? null;
  const enter = useRef(new Animated.Value(1)).current;

  /*
   * HE GETS TO FINISH HIS SENTENCE.
   *
   * The bubble is a fixed height (on purpose -- see layout.conversationReserve;
   * a bubble that grows moves the ground under him every time he speaks) and
   * the text is clamped to SPEECH_MAX_LINES, so anything longer was ellipsised
   * and the rest of the line simply never appeared, while the VOICE went on
   * saying all of it. Found in a real screenshot: "Biscuit is here. Dat's my
   * pack family, so obviously we have …".
   *
   * Long lines are now paged, split at sentence and clause seams, and advanced
   * on a reading-speed timer. A line that fits -- most of them -- is one page
   * and behaves exactly as it did before.
   */
  const pages = React.useMemo(() => (said ? paginateSpeech(said) : []), [said]);
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [said]);
  useEffect(() => {
    if (pages.length < 2 || page >= pages.length - 1) return undefined;
    const timer = setTimeout(() => setPage((p) => Math.min(p + 1, pages.length - 1)), pageDwellMs(pages[page]));
    return () => clearTimeout(timer);
  }, [pages, page]);
  const shown = pages.length ? pages[Math.min(page, pages.length - 1)] : null;

  useEffect(() => {
    if (!shown) return;
    enter.setValue(0);
    Animated.timing(enter, {
      toValue: 1,
      duration: 190,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [shown, enter]);

  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [7, 0] });
  const scale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] });
  const npc = visibleSpeaker?.kind === 'npc';
  const thinking = Boolean(thought && !visibleLine);

  const shell = npc ? color.violet : thinking ? color.fill : color.lemon;
  const edge = npc ? color.violetDeep : thinking ? color.popDeep : color.lemonDeep;
  const speakerInk = npc ? color.violetDeep : thinking ? color.popDeep : color.ink;

  return (
    <View style={[styles.panel, !shown && styles.panelResting]} accessibilityLiveRegion="polite" testID="dialogue-panel">
      {shown ? (
        <>
          <View style={[styles.edge, { backgroundColor: edge }]} pointerEvents="none" />
          <View style={[styles.shell, { backgroundColor: shell, borderColor: color.inkMid }]} pointerEvents="none" />
          <View style={styles.innerRim} pointerEvents="none" />
          <View style={styles.highlight} pointerEvents="none" />
          <View style={styles.glint} pointerEvents="none" />
          <View style={styles.bottomSheen} pointerEvents="none" />
          {visibleSpeaker ? <View style={[styles.tail, { backgroundColor: shell, borderColor: color.inkMid }]} pointerEvents="none" /> : null}

          <Animated.View
            style={[
              styles.copy,
              // The real width of what is sitting there: each button is TAP_MIN
              // wide, with the row's own gap and its 10px inset from the edge.
              actions ? { paddingRight: actionSlots * TAP_MIN + (actionSlots - 1) * 4 + 14 } : null,
              { opacity: enter, transform: [{ translateY }, { scale }] },
            ]}
          >
            {/*
              The speaker line, with the page counter on it.

              The dots started under the text and a three-line page pushed them
              out of the fixed-height panel -- the exact page that most needs
              to say "there is more". Up here they sit in a row that always
              exists and always has room, and read as "1 of 2" next to who is
              talking.
            */}
            <View style={styles.badgeRow}>
            {visibleYouSaid ? (
              <View style={styles.youBadge}>
                <Text style={styles.youSaid} numberOfLines={1}>YOU · “{visibleYouSaid}”</Text>
              </View>
            ) : visibleSpeaker ? (
              <View style={[styles.badge, { borderColor: speakerInk }]}>
                <View style={[styles.speakerPip, { backgroundColor: speakerInk }]} />
                <Text style={[styles.who, { color: speakerInk }]}>{visibleSpeaker.name.toUpperCase()}</Text>
              </View>
            ) : (
              <View style={[styles.badge, { borderColor: color.popDeep }]}>
                <View style={[styles.speakerPip, { backgroundColor: color.popDeep }]} />
                {/* popInk, not popDeep: see theme. The pip is decoration and
                    may stay bright; the WORD has to be readable. */}
                <Text style={[styles.who, { color: color.popInk }]}>BARKLY BRAIN</Text>
              </View>
            )}
            {/*
              There is more coming. Without this a paged line reads as him
              being interrupted and then starting again; one dot per page says
              "still talking" in the space a word would take. Decorative only —
              the panel is a polite live region, so each page is announced as
              it appears, and the dots are hidden from the reader.
            */}
            {pages.length > 1 ? (
              <View style={styles.pages} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                {pages.map((p, i) => (
                  <View key={`${i}-${p.slice(0, 8)}`} style={[styles.pageDot, i === page && styles.pageDotOn]} />
                ))}
              </View>
            ) : null}
            </View>

            <Text style={[styles.line, !visibleLine && styles.thought]} numberOfLines={SPEECH_MAX_LINES}>{shown}</Text>
          </Animated.View>
          {actions ? <View style={styles.actions}>{actions}</View> : null}
        </>
      ) : (
        <View style={styles.restingWrap}>
          <View style={styles.paw}>
            <View style={styles.pad} />
            <View style={[styles.toe, styles.toe1]} />
            <View style={[styles.toe, styles.toe2]} />
            <View style={[styles.toe, styles.toe3]} />
          </View>
          <Text style={styles.resting}>{asleep ? 'shh — Barkly is snoozing' : hint}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    height: DIALOGUE_HEIGHT,
    marginVertical: DIALOGUE_GAP,
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    paddingVertical: space.sm,
    borderRadius: radius.lg,
    overflow: 'visible',
    backgroundColor: 'transparent',
    ...elevation.card,
  },
  panelResting: {
    height: RESTING_DIALOGUE_HEIGHT,
    marginVertical: 1,
    paddingHorizontal: 0,
    paddingVertical: 0,
    ...elevation.flat,
  },
  edge: {
    position: 'absolute',
    left: 4,
    right: 4,
    top: 6,
    bottom: -6,
    borderRadius: radius.lg,
    opacity: 0.95,
  },
  shell: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: radius.lg,
    borderWidth: 2,
  },
  innerRim: {
    position: 'absolute',
    left: 5,
    right: 5,
    top: 5,
    bottom: 5,
    borderRadius: radius.lg - 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
  },
  highlight: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    top: 6,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: color.gloss,
  },
  glint: {
    position: 'absolute',
    left: space.xl + 5,
    top: 7,
    width: 54,
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.78)',
  },
  bottomSheen: {
    position: 'absolute',
    left: space.xl,
    right: space.xl,
    bottom: 6,
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  tail: {
    position: 'absolute',
    top: -7,
    left: '48%',
    width: 16,
    height: 16,
    borderRadius: radius.xs,
    borderLeftWidth: 2,
    borderTopWidth: 2,
    transform: [{ rotate: '45deg' }],
  },
  copy: { paddingHorizontal: space.xs },
  actions: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    gap: 4,
    zIndex: 4,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    marginBottom: space.xs,
    /*
     * 0.92, not 0.78. This badge floats over the live world, so at 0.78 the
     * contrast of the label depended on whatever the scene happened to be
     * doing behind it -- which became a moving target the day the room got
     * ambient light. A speaker label should not be legible only on a good
     * frame.
     */
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  speakerPip: { width: 6, height: 6, borderRadius: radius.pill },
  who: { ...type.micro },
  youBadge: {
    alignSelf: 'flex-start',
    maxWidth: '88%',
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    marginBottom: space.xs,
  },
  youSaid: { ...type.caption, color: color.inkMid },
  line: { ...type.speech, color: color.ink },
  /*
   * Sits in the copy flow rather than absolutely, so it can never land on top
   * of a control -- the overlap gate measures real boxes and an absolutely
   * positioned decoration is exactly how something ends up over the composer.
   */
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  pages: { flexDirection: 'row', gap: 4 },
  pageDot: { width: 5, height: 5, borderRadius: radius.pill, backgroundColor: color.inkMid, opacity: 0.3 },
  pageDotOn: { opacity: 0.9 },
  thought: { fontStyle: 'italic', color: color.inkMid },
  restingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    opacity: 0.72,
  },
  paw: { width: 23, height: 20, position: 'relative' },
  pad: {
    position: 'absolute',
    left: 6,
    bottom: 0,
    width: 12,
    height: 10,
    borderRadius: radius.xs,
    backgroundColor: color.popDeep,
  },
  toe: { position: 'absolute', width: 6, height: 6, borderRadius: radius.pill, backgroundColor: color.pop },
  toe1: { left: 1, top: 4 },
  toe2: { left: 9, top: 0 },
  toe3: { right: 1, top: 4 },
  resting: { ...type.small, color: color.inkSoft, textAlign: 'center', fontWeight: '700' },
});
