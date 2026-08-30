from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one match, found {count}: {old[:120]!r}")
    path.write_text(text.replace(old, new, 1))


def write_new(path: Path, content: str) -> None:
    if path.exists():
        raise SystemExit(f"{path}: already exists")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)


# ---------------------------------------------------------------------------
# Turn arbitration: a player explicitly opening Talk/Type owns the floor for
# long enough that queued/autonomous chatter cannot immediately grab it back.
write_new(
    ROOT / "src/barkly/conversationTurn.ts",
    """/** Turn arbitration shared by the UI and Barkly's autonomous speech. */
export const PLAYER_FLOOR_GRACE_MS = 30_000;

export function nextPlayerFloorUntil(now: number): number {
  return now + PLAYER_FLOOR_GRACE_MS;
}

export function autonomousSpeechAllowed(
  now: number,
  playerFloorUntil: number,
  conversationHeld: boolean,
): boolean {
  return !conversationHeld && now >= playerFloorUntil;
}
""",
)

write_new(
    ROOT / "__tests__/conversation_turn.test.ts",
    """import {
  PLAYER_FLOOR_GRACE_MS,
  autonomousSpeechAllowed,
  nextPlayerFloorUntil,
} from '../src/barkly/conversationTurn';

describe('conversation turn arbitration', () => {
  it('gives an explicit player action a real quiet window', () => {
    const now = 10_000;
    expect(nextPlayerFloorUntil(now)).toBe(now + PLAYER_FLOOR_GRACE_MS);
    expect(PLAYER_FLOOR_GRACE_MS).toBeGreaterThanOrEqual(20_000);
  });

  it('never lets autonomous speech talk over a held conversation', () => {
    expect(autonomousSpeechAllowed(100_000, 0, true)).toBe(false);
  });

  it('does not let autonomous chatter immediately steal the floor back', () => {
    const until = nextPlayerFloorUntil(1_000);
    expect(autonomousSpeechAllowed(until - 1, until, false)).toBe(false);
    expect(autonomousSpeechAllowed(until, until, false)).toBe(true);
  });
});
""",
)

# ---------------------------------------------------------------------------
# Controller: make the existing interruption primitive actually own Talk/Type,
# and gate autonomous lines after player intent.
hook = ROOT / "src/hooks/useBarkly.ts"
replace_once(
    hook,
    "import { bronx } from '../barkly/dialect';\n",
    "import { bronx } from '../barkly/dialect';\nimport { autonomousSpeechAllowed, nextPlayerFloorUntil } from '../barkly/conversationTurn';\n",
)
replace_once(
    hook,
    "  startTalk(): Promise<void>;\n  stopTalk(): Promise<void>;\n  cancelTalk(): Promise<void>;\n  submitText(text: string): Promise<void>;\n",
    "  /** Explicit player intent wins over Barkly's interruptible speech. */\n  claimConversationTurn(): boolean;\n  startTalk(): Promise<boolean>;\n  stopTalk(): Promise<void>;\n  cancelTalk(): Promise<void>;\n  submitText(text: string): Promise<void>;\n",
)
replace_once(
    hook,
    "  const conversationHeldRef = useRef(conversationHeld);\n  conversationHeldRef.current = conversationHeld;\n\n  const [muted, setMutedState] = useState(false);\n",
    "  const conversationHeldRef = useRef(conversationHeld);\n  conversationHeldRef.current = conversationHeld;\n  const [playerFloorUntil, setPlayerFloorUntil] = useState(0);\n  const playerFloorUntilRef = useRef(0);\n\n  const [muted, setMutedState] = useState(false);\n",
)
replace_once(
    hook,
    "      dispatch({ type: 'SPEAK_START' });\n      try {\n        await voiceEngine.speak(line);\n      } catch {}\n      dispatch({ type: 'SPEAK_END' });\n      setReplyActions([]);\n      if (opts.after) dispatch(opts.after);\n",
    "      dispatch({ type: 'SPEAK_START' });\n      let interrupted = false;\n      try {\n        const result = await voiceEngine.speak(line);\n        interrupted = result.interrupted;\n      } catch {}\n      dispatch({ type: 'SPEAK_END' });\n      setReplyActions([]);\n      // If the player cut him off, do not fire a post-line reaction as though\n      // the interrupted line completed. The player owns the turn now.\n      if (opts.after && !interrupted) dispatch(opts.after);\n",
)
replace_once(
    hook,
    "  const claimTurn = useCallback((): boolean => {\n    if (busy || activeEncounter) return false;\n    const state = snapshotRef.current.state;\n    if (isLocked(state)) return false;\n    if (isInterruptible(state)) {\n      try {\n        voiceEngine.stop();\n      } catch {}\n      dispatch({ type: 'SPEAK_END' });\n      setReplyActions([]);\n    }\n    return true;\n  }, [activeEncounter, busy, dispatch, voiceEngine]);\n",
    "  const claimTurn = useCallback((): boolean => {\n    if (busy || activeEncounter || pendingContest) return false;\n    const state = snapshotRef.current.state;\n    if (isLocked(state)) return false;\n\n    // A deliberate player action owns the conversational floor. This is not a\n    // mute: Barkly can answer the player normally, but queued greetings,\n    // thoughts and initiative cannot immediately start another unprompted beat.\n    const until = nextPlayerFloorUntil(Date.now());\n    playerFloorUntilRef.current = until;\n    setPlayerFloorUntil(until);\n\n    // Whatever autonomous/previous line was occupying the shared surface gets\n    // out of the way immediately. A tap on Type should reveal an input, not an\n    // old sentence that keeps fighting for the same pixels.\n    setThought(null);\n    setLastExchange(null);\n    setNpcBubble(null);\n    if (npcBubbleTimer.current) clearTimeout(npcBubbleTimer.current);\n\n    if (isInterruptible(state)) {\n      try {\n        voiceEngine.stop();\n      } catch {}\n      dispatch({ type: 'SPEAK_END' });\n      setReplyActions([]);\n    }\n    return true;\n  }, [activeEncounter, busy, dispatch, pendingContest, voiceEngine]);\n",
)
replace_once(
    hook,
    "    if (conversationHeld) return;\n    // ...and then it waits a beat longer.\n",
    "    if (conversationHeld) return;\n    // Explicit player intent gets a quiet window. If a queued line exists,\n    // keep it queued and wake this effect after the window instead of dropping\n    // it or letting it steal the input surface back.\n    const now = Date.now();\n    if (!autonomousSpeechAllowed(now, playerFloorUntil, false)) {\n      const remaining = Math.max(25, playerFloorUntil - now + 25);\n      const wake = setTimeout(() => {\n        if (playerFloorUntilRef.current === playerFloorUntil) playerFloorUntilRef.current = 0;\n        setPlayerFloorUntil((current) => (current === playerFloorUntil ? 0 : current));\n      }, remaining);\n      return () => clearTimeout(wake);\n    }\n    // ...and then it waits a beat longer.\n",
)
replace_once(
    hook,
    "  }, [pendingGreeting, conversationHeld, speak]);\n",
    "  }, [pendingGreeting, conversationHeld, playerFloorUntil, speak]);\n",
)
replace_once(
    hook,
    "        if (IDLE_STATES.includes(snapshotRef.current.state) && !conversationHeldRef.current) {\n",
    "        if (\n          IDLE_STATES.includes(snapshotRef.current.state) &&\n          autonomousSpeechAllowed(Date.now(), playerFloorUntilRef.current, conversationHeldRef.current)\n        ) {\n",
)
replace_once(
    hook,
    "        if (quiet && !conversationHeldRef.current) {\n",
    "        if (\n          quiet &&\n          autonomousSpeechAllowed(Date.now(), playerFloorUntilRef.current, conversationHeldRef.current)\n        ) {\n",
)
replace_once(
    hook,
    "  const startTalk = useCallback(async () => {\n    if (busy || activeEncounter) return;\n    setError(null);\n    if (!permissionGranted.current) {\n      try {\n        permissionGranted.current = await providers.stt.requestPermissions();\n      } catch {\n        permissionGranted.current = false;\n      }\n      if (!permissionGranted.current) {\n        sayMishap('mic_denied');\n        return;\n      }\n    }\n    dispatch({ type: 'TALK_START' });\n    setPartialTranscript('');\n    try {\n      await providers.stt.start({ onPartial: setPartialTranscript });\n    } catch {\n      dispatch({ type: 'TALK_FAILED' });\n      sayMishap('mic_broken');\n    }\n  }, [activeEncounter, busy, dispatch, providers, sayMishap]);\n",
    "  const startTalk = useCallback(async (): Promise<boolean> => {\n    // This used to skip claimTurn(), so microphone capture could begin while\n    // Barkly's TTS kept talking. Talk now uses the same floor arbitration as\n    // every other player action: his interruptible line stops first.\n    if (!claimTurn()) return false;\n    setError(null);\n    if (!permissionGranted.current) {\n      try {\n        permissionGranted.current = await providers.stt.requestPermissions();\n      } catch {\n        permissionGranted.current = false;\n      }\n      if (!permissionGranted.current) {\n        sayMishap('mic_denied');\n        return false;\n      }\n    }\n    dispatch({ type: 'TALK_START' });\n    setPartialTranscript('');\n    try {\n      await providers.stt.start({ onPartial: setPartialTranscript });\n      return true;\n    } catch {\n      dispatch({ type: 'TALK_FAILED' });\n      sayMishap('mic_broken');\n      return false;\n    }\n  }, [claimTurn, dispatch, providers, sayMishap]);\n",
)
replace_once(
    hook,
    "  const submitText = useCallback(\n    async (text: string) => {\n      if (busy || activeEncounter || !text.trim()) return;\n      await runExchange(text.trim());\n    },\n    [activeEncounter, busy, runExchange],\n  );\n",
    "  const submitText = useCallback(\n    async (text: string) => {\n      if (!text.trim() || !claimTurn()) return;\n      await runExchange(text.trim());\n    },\n    [claimTurn, runExchange],\n  );\n",
)
replace_once(
    hook,
    "    startTalk,\n    stopTalk,\n",
    "    claimConversationTurn: claimTurn,\n    startTalk,\n    stopTalk,\n",
)

# ---------------------------------------------------------------------------
# Geometry: one conversation surface replaces permanent dialogue+composer rows.
layout = ROOT / "src/ui/layout.ts"
replace_once(
    layout,
    "export const DIALOGUE_HEIGHT = 96;\nexport const RESTING_DIALOGUE_HEIGHT = 34;\nexport const DIALOGUE_GAP = 3;\nexport const CONTROLS_HEIGHT = TAP_MIN + 6;\n\nexport function dialogueHeight(expanded: boolean): number {\n  return expanded ? DIALOGUE_HEIGHT : RESTING_DIALOGUE_HEIGHT;\n}\n",
    "export const DIALOGUE_HEIGHT = 96;\nexport const RESTING_DIALOGUE_HEIGHT = 34;\nexport const DIALOGUE_GAP = 3;\nexport const CONTROLS_HEIGHT = TAP_MIN + 6;\nexport const IDLE_CONVERSATION_HEIGHT = TAP_MIN;\n\nexport function dialogueHeight(expanded: boolean): number {\n  return expanded ? DIALOGUE_HEIGHT : RESTING_DIALOGUE_HEIGHT;\n}\n\nexport function conversationHeight(dialogueExpanded: boolean, composerExpanded = false): number {\n  if (dialogueExpanded) return DIALOGUE_HEIGHT;\n  if (composerExpanded) return CONTROLS_HEIGHT;\n  return IDLE_CONVERSATION_HEIGHT;\n}\n",
)
replace_once(
    layout,
    "export function stageHeight(\n  screenHeight: number,\n  mode: LayoutMode = 'narrowPortrait',\n  dialogueExpanded = true,\n): number {\n  if (isLandscapeMode(mode)) return Math.max(230, screenHeight - STATUS_HEIGHT - 18);\n  return Math.max(\n    212,\n    screenHeight - CHROME_BOTTOM - dialogueHeight(dialogueExpanded) - DIALOGUE_GAP * 2 - CONTROLS_HEIGHT - 10,\n  );\n}\n",
    "export function stageHeight(\n  screenHeight: number,\n  mode: LayoutMode = 'narrowPortrait',\n  dialogueExpanded = true,\n  composerExpanded = false,\n): number {\n  if (isLandscapeMode(mode)) return Math.max(230, screenHeight - STATUS_HEIGHT - 18);\n  return Math.max(\n    212,\n    screenHeight - CHROME_BOTTOM - conversationHeight(dialogueExpanded, composerExpanded) - DIALOGUE_GAP * 2 - 10,\n  );\n}\n",
)
replace_once(
    layout,
    "  mode: LayoutMode = 'narrowPortrait',\n  dialogueExpanded = true,\n): number {\n  const landscape = isLandscapeMode(mode);\n  const room = stageHeight(screenHeight, mode, dialogueExpanded) - SPRITE_FOOT - (landscape ? 20 : NOTICE_BAND + 4);\n",
    "  mode: LayoutMode = 'narrowPortrait',\n  dialogueExpanded = true,\n  composerExpanded = false,\n): number {\n  const landscape = isLandscapeMode(mode);\n  const room = stageHeight(screenHeight, mode, dialogueExpanded, composerExpanded) - SPRITE_FOOT - (landscape ? 20 : NOTICE_BAND + 4);\n",
)

# ---------------------------------------------------------------------------
# Dialogue panel: response and player takeover buttons physically share one card.
panel = ROOT / "src/ui/DialoguePanel.tsx"
replace_once(
    panel,
    "  hint: string;\n  asleep?: boolean;\n}\n",
    "  hint: string;\n  asleep?: boolean;\n  /** Compact Talk/Type controls live inside the response surface. */\n  actions?: React.ReactNode;\n}\n",
)
replace_once(
    panel,
    "export default function DialoguePanel({ speaker, line, youSaid, thought, hint, asleep }: Props) {\n",
    "export default function DialoguePanel({ speaker, line, youSaid, thought, hint, asleep, actions }: Props) {\n",
)
replace_once(
    panel,
    "          <Animated.View style={[styles.copy, { opacity: enter, transform: [{ translateY }, { scale }] }]}>\n",
    "          <Animated.View style={[styles.copy, actions && styles.copyWithActions, { opacity: enter, transform: [{ translateY }, { scale }] }]}>\n",
)
replace_once(
    panel,
    "            <Text style={[styles.line, !visibleLine && styles.thought]} numberOfLines={SPEECH_MAX_LINES}>{shown}</Text>\n          </Animated.View>\n        </>\n",
    "            <Text style={[styles.line, !visibleLine && styles.thought]} numberOfLines={SPEECH_MAX_LINES}>{shown}</Text>\n          </Animated.View>\n          {actions ? <View style={styles.actions}>{actions}</View> : null}\n        </>\n",
)
replace_once(
    panel,
    "  copy: { paddingHorizontal: space.xs },\n",
    "  copy: { paddingHorizontal: space.xs },\n  copyWithActions: { paddingRight: 96 },\n  actions: {\n    position: 'absolute',\n    right: 10,\n    bottom: 10,\n    flexDirection: 'row',\n    gap: 4,\n    zIndex: 4,\n  },\n",
)

# ---------------------------------------------------------------------------
# Room: compact idle buttons; Type/listen expand only on demand; responses use
# the same DialoguePanel surface and keep takeover buttons visible.
room = ROOT / "src/ui/BarklyRoom.tsx"
replace_once(
    room,
    "  RESTING_DIALOGUE_HEIGHT,\n  PLACES_HEIGHT,\n",
    "  IDLE_CONVERSATION_HEIGHT,\n  PLACES_HEIGHT,\n",
)
replace_once(
    room,
    "  /** The keyboard is a choice, not a fallback — see the input block below. */\n  const [typing, setTyping] = useState(false);\n",
    "  /** One surface, three player modes. Idle is only two compact buttons. */\n  const [conversationMode, setConversationMode] = useState<'idle' | 'voice' | 'type'>('idle');\n",
)
replace_once(
    room,
    "  // The idle prompt should not permanently consume a full speech-card slot.\n  // Reclaim that room for the world until Barkly/NPC dialogue actually exists.\n  const dialogueExpanded = Boolean(\n    partialTranscript || lastExchange?.barklyText || barkly.thought || barkly.npcBubble || barkly.showcase\n  );\n  const dialogueHeightPx = dialogueExpanded ? DIALOGUE_HEIGHT : RESTING_DIALOGUE_HEIGHT;\n",
    "  // One adaptive conversation surface. With nobody talking and no composer\n  // open, only the two 44px Talk/Type buttons reserve space. A response or an\n  // explicitly opened composer expands into that same slot.\n  const responseVisible = Boolean(lastExchange?.barklyText || barkly.thought || barkly.npcBubble || barkly.showcase);\n  const composerExpanded = conversationMode !== 'idle' || listening || snapshot.state === 'thinking';\n  const dialogueExpanded = responseVisible && !composerExpanded;\n  const conversationHeightPx = dialogueExpanded\n    ? DIALOGUE_HEIGHT\n    : composerExpanded\n      ? CONTROLS_HEIGHT\n      : IDLE_CONVERSATION_HEIGHT;\n",
)
replace_once(
    room,
    "  const spriteScale = scaleForScreen(screenH, stageW, layout, dialogueExpanded);\n  /** How tall the world is: everything above the dialogue panel. */\n  const sceneBand = landscape ? screenH : screenH - dialogueHeightPx - DIALOGUE_GAP * 2 - CONTROLS_HEIGHT + 8;\n",
    "  const spriteScale = scaleForScreen(screenH, stageW, layout, dialogueExpanded, composerExpanded);\n  /** How tall the world is: everything above the one adaptive conversation slot. */\n  const sceneBand = landscape ? screenH : screenH - conversationHeightPx - DIALOGUE_GAP * 2 + 8;\n",
)
replace_once(
    room,
    "  const groundY = topPad + chromeBottomPx + stageHeight(screenH, layout, dialogueExpanded) - SPRITE_FOOT;\n",
    "  const groundY = topPad + chromeBottomPx + stageHeight(screenH, layout, dialogueExpanded, composerExpanded) - SPRITE_FOOT;\n",
)
replace_once(
    room,
    "  const sendTyped = async () => {\n    const text = typed;\n    setTyped('');\n    await barkly.submitText(text);\n  };\n",
    "  const openTyping = () => {\n    if (!barkly.claimConversationTurn()) return;\n    setConversationMode('type');\n  };\n\n  const startVoice = async () => {\n    const started = await barkly.startTalk();\n    setConversationMode(started ? 'voice' : 'idle');\n  };\n\n  const finishVoice = async () => {\n    setConversationMode('idle');\n    await barkly.stopTalk();\n  };\n\n  const switchVoiceToType = async () => {\n    await barkly.cancelTalk();\n    if (barkly.claimConversationTurn()) setConversationMode('type');\n  };\n\n  const sendTyped = async () => {\n    const text = typed.trim();\n    if (!text) return;\n    setTyped('');\n    setConversationMode('idle');\n    await barkly.submitText(text);\n  };\n",
)
replace_once(
    room,
    "  const bubbleText = showcase\n    ? 'The longest thing he can say, at three full lines, so the tallest bubble this app can produce is the one being measured right here.'\n    : listening && partialTranscript\n      ? `“${partialTranscript}”`\n      : lastExchange?.barklyText;\n",
    "  const bubbleText = showcase\n    ? 'The longest thing he can say, at three full lines, so the tallest bubble this app can produce is the one being measured right here.'\n    : lastExchange?.barklyText;\n",
)
replace_once(
    room,
    "        style={[styles.horizon, { height: landscape ? 76 : dialogueHeightPx + CONTROLS_HEIGHT + 24 }]}\n",
    "        style={[styles.horizon, { height: landscape ? 76 : conversationHeightPx + 24 }]}\n",
)
replace_once(
    room,
    "            { height: stageHeight(screenH, layout, dialogueExpanded) },\n",
    "            { height: stageHeight(screenH, layout, dialogueExpanded, composerExpanded) },\n",
)
old_interaction = """        <View
          style={[
            styles.interactionStack,
            landscape && styles.interactionStackLandscape,
            landscape ? { width: interactionW } : { maxWidth: stageW },
          ]}
        >
        <DialoguePanel
          speaker={
            npcBubble
              ? { name: NPCS[npcBubble.id].name, kind: 'npc' }
              : bubbleText
                ? { name: 'Barkly', kind: 'barkly' }
                : null
          }
          line={npcBubble ? npcBubble.line : bubbleText ?? null}
          youSaid={!npcBubble && lastExchange && !listening && lastExchange.userText !== '' ? lastExchange.userText : null}
          thought={barkly.thought}
          hint={sttAvailable ? 'hold talk and say hi' : 'type something and say hi'}
          asleep={asleep}
        />

        <View style={styles.controls}>
          {sttAvailable && !typing ? (
            <View style={styles.typeRow}>
              <Pressable
                style={({ pressed }) => [styles.talk, listening && styles.talkActive, (locked || pressed) && styles.pressed, locked && styles.disabled]}
                disabled={locked}
                onPressIn={barkly.startTalk}
                onPressOut={barkly.stopTalk}
                accessibilityRole="button"
                accessibilityLabel={listening ? 'Listening. Release to send.' : 'Hold to talk to Barkly'}
                accessibilityState={{ disabled: locked, busy: listening }}
              >
                <View style={styles.gloss} pointerEvents="none" />
                <View style={[styles.micDot, listening && styles.micDotLive]} />
                <Text style={styles.talkText}>{listening ? 'listening — release to send' : 'hold to talk'}</Text>
              </Pressable>
              <Pressable
                style={styles.swap}
                onPress={() => setTyping(true)}
                accessibilityRole="button"
                accessibilityLabel="Type to Barkly instead"
              >
                <KeyboardGlyph />
              </Pressable>
            </View>
          ) : (
            <View style={styles.typeRow}>
              <TextInput
                style={styles.input}
                value={typed}
                onChangeText={setTyped}
                placeholder="say something to Barkly…"
                placeholderTextColor={color.inkSoft}
                editable={!locked}
                onSubmitEditing={sendTyped}
                returnKeyType="send"
                accessibilityLabel="Say something to Barkly"
                accessibilityHint="Type a message, then press talk."
              />
              {sttAvailable && (
                <Pressable
                  style={styles.swap}
                  onPress={() => setTyping(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Talk to Barkly out loud instead"
                >
                  <View style={styles.micDot} />
                </Pressable>
              )}
              <Pressable
                style={({ pressed }) => [styles.send, pressed && styles.pressed, (locked || !typed.trim()) && styles.sendIdle]}
                disabled={locked || !typed.trim()}
                onPress={sendTyped}
                accessibilityRole="button"
                accessibilityLabel="Talk to Barkly"
                accessibilityState={{ disabled: locked || !typed.trim() }}
              >
                {!(locked || !typed.trim()) && <View style={styles.gloss} pointerEvents="none" />}
                <Text style={[styles.sendText, (locked || !typed.trim()) && styles.sendTextIdle]}>talk</Text>
              </Pressable>
            </View>
          )}
        </View>
        </View>
"""
new_interaction = """        <View
          style={[
            styles.interactionStack,
            landscape && styles.interactionStackLandscape,
            landscape ? { width: interactionW } : { maxWidth: stageW },
          ]}
          testID="conversation-dock"
        >
          {dialogueExpanded ? (
            <DialoguePanel
              speaker={
                npcBubble
                  ? { name: NPCS[npcBubble.id].name, kind: 'npc' }
                  : bubbleText
                    ? { name: 'Barkly', kind: 'barkly' }
                    : null
              }
              line={npcBubble ? npcBubble.line : bubbleText ?? null}
              youSaid={!npcBubble && lastExchange && lastExchange.userText !== '' ? lastExchange.userText : null}
              thought={barkly.thought}
              hint=""
              asleep={asleep}
              actions={
                <>
                  {sttAvailable && (
                    <Pressable
                      style={({ pressed }) => [styles.responseAction, pressed && styles.pressed, locked && styles.disabled]}
                      disabled={locked}
                      onPress={() => void startVoice()}
                      accessibilityRole="button"
                      accessibilityLabel="Talk to Barkly"
                    >
                      <View style={styles.micDot} />
                    </Pressable>
                  )}
                  <Pressable
                    style={({ pressed }) => [styles.responseAction, pressed && styles.pressed, locked && styles.disabled]}
                    disabled={locked}
                    onPress={openTyping}
                    accessibilityRole="button"
                    accessibilityLabel="Type to Barkly"
                  >
                    <KeyboardGlyph />
                  </Pressable>
                </>
              }
            />
          ) : snapshot.state === 'thinking' ? (
            <View style={styles.waitingDock}>
              <View style={styles.chipDot} />
              <Text style={styles.waitingText}>Barkly's thinking…</Text>
            </View>
          ) : conversationMode === 'type' ? (
            <View style={styles.controls}>
              <View style={styles.typeRow}>
                <TextInput
                  style={styles.input}
                  value={typed}
                  onChangeText={setTyped}
                  placeholder="say something to Barkly…"
                  placeholderTextColor={color.inkSoft}
                  editable={!locked}
                  autoFocus
                  onSubmitEditing={sendTyped}
                  returnKeyType="send"
                  accessibilityLabel="Say something to Barkly"
                  accessibilityHint="Type a message, then press send."
                />
                <Pressable
                  style={styles.swap}
                  onPress={() => { setTyped(''); setConversationMode('idle'); }}
                  accessibilityRole="button"
                  accessibilityLabel="Close typing"
                >
                  <Text style={styles.closeComposer}>×</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.send, pressed && styles.pressed, (locked || !typed.trim()) && styles.sendIdle]}
                  disabled={locked || !typed.trim()}
                  onPress={() => void sendTyped()}
                  accessibilityRole="button"
                  accessibilityLabel="Send to Barkly"
                  accessibilityState={{ disabled: locked || !typed.trim() }}
                >
                  {!(locked || !typed.trim()) && <View style={styles.gloss} pointerEvents="none" />}
                  <Text style={[styles.sendText, (locked || !typed.trim()) && styles.sendTextIdle]}>send</Text>
                </Pressable>
              </View>
            </View>
          ) : conversationMode === 'voice' || listening ? (
            <View style={styles.controls}>
              <View style={styles.typeRow}>
                <Pressable
                  style={({ pressed }) => [styles.talk, styles.talkActive, pressed && styles.pressed]}
                  onPress={() => void finishVoice()}
                  accessibilityRole="button"
                  accessibilityLabel="Listening. Tap to send."
                  accessibilityState={{ busy: true }}
                >
                  <View style={styles.gloss} pointerEvents="none" />
                  <View style={[styles.micDot, styles.micDotLive]} />
                  <Text style={styles.talkText}>{partialTranscript || 'listening — tap to send'}</Text>
                </Pressable>
                <Pressable
                  style={styles.swap}
                  onPress={() => void switchVoiceToType()}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel voice and type instead"
                >
                  <KeyboardGlyph />
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.compactControls}>
              {sttAvailable && (
                <Pressable
                  style={({ pressed }) => [styles.compactAction, pressed && styles.pressed, locked && styles.disabled]}
                  disabled={locked}
                  onPress={() => void startVoice()}
                  accessibilityRole="button"
                  accessibilityLabel="Talk to Barkly"
                >
                  <View style={styles.micDot} />
                  <Text style={styles.compactActionText}>talk</Text>
                </Pressable>
              )}
              <Pressable
                style={({ pressed }) => [styles.compactAction, pressed && styles.pressed, locked && styles.disabled]}
                disabled={locked}
                onPress={openTyping}
                accessibilityRole="button"
                accessibilityLabel="Type to Barkly"
              >
                <KeyboardGlyph />
                <Text style={styles.compactActionText}>type</Text>
              </Pressable>
            </View>
          )}
        </View>
"""
replace_once(room, old_interaction, new_interaction)
replace_once(
    room,
    "  interactionStack: { width: '100%', alignSelf: 'center' },\n",
    "  interactionStack: { width: '100%', alignSelf: 'center', minHeight: TAP_MIN },\n",
)
replace_once(
    room,
    "  controls: { gap: 3 },\n",
    "  controls: { gap: 3, minHeight: TAP_MIN, justifyContent: 'center' },\n  compactControls: {\n    minHeight: TAP_MIN,\n    flexDirection: 'row',\n    justifyContent: 'center',\n    alignItems: 'center',\n    gap: 10,\n  },\n  compactAction: {\n    height: TAP_MIN,\n    minWidth: 86,\n    paddingHorizontal: 14,\n    borderRadius: radius.pill,\n    backgroundColor: color.card,\n    flexDirection: 'row',\n    alignItems: 'center',\n    justifyContent: 'center',\n    gap: 8,\n    ...elevation.low,\n  },\n  compactActionText: { ...type.caption, fontWeight: '900', color: color.ink },\n  responseAction: {\n    width: TAP_MIN,\n    height: TAP_MIN,\n    borderRadius: radius.pill,\n    backgroundColor: color.card,\n    alignItems: 'center',\n    justifyContent: 'center',\n    ...elevation.low,\n  },\n  waitingDock: {\n    height: TAP_MIN,\n    alignSelf: 'center',\n    minWidth: 180,\n    borderRadius: radius.pill,\n    backgroundColor: color.card,\n    flexDirection: 'row',\n    alignItems: 'center',\n    justifyContent: 'center',\n    gap: 8,\n    ...elevation.low,\n  },\n  waitingText: { ...type.caption, fontWeight: '800', color: color.inkSoft },\n  closeComposer: { fontSize: 24, lineHeight: 26, fontWeight: '700', color: color.inkSoft },\n",
)

# ---------------------------------------------------------------------------
# Geometry contract now measures the single adaptive slot.
hero = ROOT / "__tests__/hero_layout.test.ts"
replace_once(
    hero,
    "    expect(idle - active).toBeGreaterThanOrEqual(60);\n    expect(idle).toBeGreaterThan(600);\n",
    "    expect(idle - active).toBeGreaterThanOrEqual(45);\n    expect(idle).toBeGreaterThan(650);\n",
)

# ---------------------------------------------------------------------------
# Browser gates: the idle room no longer always contains a dialogue card/input.
a11y = ROOT / "scripts/a11y-check.mjs"
replace_once(
    a11y,
    "if (!(await page.locator('[data-testid=\"dialogue-panel\"]').first().count())) {\n",
    "if (!(await page.locator('[data-testid=\"conversation-dock\"]').first().count())) {\n",
)

overlap = ROOT / "scripts/overlap-check.mjs"
replace_once(overlap, "  ['input', 'input'],\n", "")
replace_once(overlap, "const NEVER_OVER_THE_DOG = ['dialogue', 'notice', 'input'];\n", "const NEVER_OVER_THE_DOG = ['dialogue', 'notice'];\n")

no_playtest = ROOT / "scripts/no-playtest-check.mjs"
replace_once(
    no_playtest,
    "  const reached = await page.locator('[data-testid=\"dialogue-panel\"]').first().count();\n",
    "  const reached = await page.locator('[data-testid=\"conversation-dock\"]').first().count();\n",
)

acceptance = ROOT / "scripts/playtest-acceptance.mjs"
replace_once(
    acceptance,
    "    await page.waitForSelector('[data-testid=\"dialogue-panel\"]', { timeout: 25_000 });\n",
    "    await page.waitForSelector('[data-testid=\"conversation-dock\"]', { timeout: 25_000 });\n",
)
replace_once(
    acceptance,
    "check('1-2. opens and gets through onboarding', (await byId('dialogue-panel').count()) > 0);\ncheck('24. playtest saves reachable from Settings', await playtestEntryReachable());\n\n// 3. talk to him\nconst input = page.locator('input:visible').first();\nif (await input.count()) {\n",
    "check('1-2. opens and gets through onboarding', (await byId('conversation-dock').count()) > 0);\ncheck('24. playtest saves reachable from Settings', await playtestEntryReachable());\n\n// 3. The player must be able to take the floor even if Barkly started talking\n// on his own. Type is deterministic in headless Chromium, unlike microphone STT.\nconst takeFloor = page.getByRole('button', { name: 'Type to Barkly' }).first();\nconst canTakeFloor = (await takeFloor.count()) > 0 && (await takeFloor.isEnabled());\nif (canTakeFloor) {\n  await takeFloor.click();\n  await settle(350);\n}\nconst input = page.locator('input:visible').first();\ncheck('3a. player can take the floor', canTakeFloor && (await input.count()) > 0);\nif (await input.count()) {\n",
)

print('Applied Barkly turn-aware conversation dock patch.')
