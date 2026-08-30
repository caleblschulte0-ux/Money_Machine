from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: Path, old: str, new: str) -> None:
    text = path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}: {old[:90]!r}")
    path.write_text(text.replace(old, new, 1))


layout = ROOT / "src/ui/layout.ts"
replace_once(
    layout,
    "export const DIALOGUE_HEIGHT = 96;\nexport const DIALOGUE_GAP = 6;\nexport const CONTROLS_HEIGHT = TAP_MIN + 14;\n",
    "export const DIALOGUE_HEIGHT = 96;\nexport const RESTING_DIALOGUE_HEIGHT = 34;\nexport const DIALOGUE_GAP = 3;\nexport const CONTROLS_HEIGHT = TAP_MIN + 6;\n\nexport function dialogueHeight(expanded: boolean): number {\n  return expanded ? DIALOGUE_HEIGHT : RESTING_DIALOGUE_HEIGHT;\n}\n",
)
replace_once(
    layout,
    "export function stageHeight(screenHeight: number, mode: LayoutMode = 'narrowPortrait'): number {\n  if (isLandscapeMode(mode)) return Math.max(230, screenHeight - STATUS_HEIGHT - 18);\n  return Math.max(\n    212,\n    screenHeight - CHROME_BOTTOM - DIALOGUE_HEIGHT - DIALOGUE_GAP * 2 - CONTROLS_HEIGHT - 18,\n  );\n}\n",
    "export function stageHeight(\n  screenHeight: number,\n  mode: LayoutMode = 'narrowPortrait',\n  dialogueExpanded = true,\n): number {\n  if (isLandscapeMode(mode)) return Math.max(230, screenHeight - STATUS_HEIGHT - 18);\n  return Math.max(\n    212,\n    screenHeight - CHROME_BOTTOM - dialogueHeight(dialogueExpanded) - DIALOGUE_GAP * 2 - CONTROLS_HEIGHT - 10,\n  );\n}\n",
)
replace_once(
    layout,
    "  mode: LayoutMode = 'narrowPortrait',\n): number {\n  const landscape = isLandscapeMode(mode);\n  const room = stageHeight(screenHeight, mode) - SPRITE_FOOT - (landscape ? 20 : NOTICE_BAND + 4);\n",
    "  mode: LayoutMode = 'narrowPortrait',\n  dialogueExpanded = true,\n): number {\n  const landscape = isLandscapeMode(mode);\n  const room = stageHeight(screenHeight, mode, dialogueExpanded) - SPRITE_FOOT - (landscape ? 20 : NOTICE_BAND + 4);\n",
)

room = ROOT / "src/ui/BarklyRoom.tsx"
replace_once(
    room,
    "  DIALOGUE_GAP,\n  DIALOGUE_HEIGHT,\n  PLACES_HEIGHT,\n",
    "  DIALOGUE_GAP,\n  DIALOGUE_HEIGHT,\n  RESTING_DIALOGUE_HEIGHT,\n  PLACES_HEIGHT,\n",
)
replace_once(
    room,
    "  const bottomPad = contentBottom(insets.bottom);\n  /**\n   * How big he is drawn.",
    "  const bottomPad = contentBottom(insets.bottom);\n  // The idle prompt should not permanently consume a full speech-card slot.\n  // Reclaim that room for the world until Barkly/NPC dialogue actually exists.\n  const dialogueExpanded = Boolean(\n    partialTranscript || lastExchange?.barklyText || barkly.thought || barkly.npcBubble || barkly.showcase\n  );\n  const dialogueHeightPx = dialogueExpanded ? DIALOGUE_HEIGHT : RESTING_DIALOGUE_HEIGHT;\n  /**\n   * How big he is drawn.",
)
replace_once(
    room,
    "  const spriteScale = scaleForScreen(screenH, stageW, layout);\n",
    "  const spriteScale = scaleForScreen(screenH, stageW, layout, dialogueExpanded);\n",
)
replace_once(
    room,
    "  const sceneBand = landscape ? screenH : screenH - DIALOGUE_HEIGHT - DIALOGUE_GAP * 2 - CONTROLS_HEIGHT + 8;\n",
    "  const sceneBand = landscape ? screenH : screenH - dialogueHeightPx - DIALOGUE_GAP * 2 - CONTROLS_HEIGHT + 8;\n",
)
replace_once(
    room,
    "  const groundY = topPad + chromeBottomPx + stageHeight(screenH, layout) - SPRITE_FOOT;\n",
    "  const groundY = topPad + chromeBottomPx + stageHeight(screenH, layout, dialogueExpanded) - SPRITE_FOOT;\n",
)
replace_once(
    room,
    "        style={[styles.horizon, { height: landscape ? 76 : DIALOGUE_HEIGHT + CONTROLS_HEIGHT + 48 }]}\n",
    "        style={[styles.horizon, { height: landscape ? 76 : dialogueHeightPx + CONTROLS_HEIGHT + 24 }]}\n",
)
replace_once(
    room,
    "            { height: stageHeight(screenH, layout) },\n",
    "            { height: stageHeight(screenH, layout, dialogueExpanded) },\n",
)
replace_once(
    room,
    "  stageArea: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 12 },\n",
    "  // Keep Barkly's feet out of the foreground care dock without throwing away\n  // the reclaimed world space below him.\n  stageArea: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 48 },\n",
)
replace_once(room, "  controls: { gap: 6 },\n", "  controls: { gap: 3 },\n")

panel = ROOT / "src/ui/DialoguePanel.tsx"
replace_once(
    panel,
    "import { DIALOGUE_GAP, DIALOGUE_HEIGHT, SPEECH_MAX_LINES } from './layout';\n",
    "import { DIALOGUE_GAP, DIALOGUE_HEIGHT, RESTING_DIALOGUE_HEIGHT, SPEECH_MAX_LINES } from './layout';\n",
)
replace_once(
    panel,
    "  panelResting: { ...elevation.flat },\n",
    "  panelResting: {\n    height: RESTING_DIALOGUE_HEIGHT,\n    marginVertical: 1,\n    paddingHorizontal: 0,\n    paddingVertical: 0,\n    ...elevation.flat,\n  },\n",
)

hero = ROOT / "__tests__/hero_layout.test.ts"
replace_once(
    hero,
    "  it('reserves real side rails in landscape', () => {\n    const mode = layoutMode(844, 390);\n    expect(navRailWidth(mode)).toBeGreaterThanOrEqual(80);\n    expect(interactionRailWidth(mode)).toBeGreaterThanOrEqual(220);\n    expect(stageHeight(390, mode)).toBeGreaterThan(280);\n  });\n\n});\n",
    "  it('reserves real side rails in landscape', () => {\n    const mode = layoutMode(844, 390);\n    expect(navRailWidth(mode)).toBeGreaterThanOrEqual(80);\n    expect(interactionRailWidth(mode)).toBeGreaterThanOrEqual(220);\n    expect(stageHeight(390, mode)).toBeGreaterThan(280);\n  });\n\n  it('gives idle portrait space back to the world', () => {\n    const active = stageHeight(844, 'narrowPortrait', true);\n    const idle = stageHeight(844, 'narrowPortrait', false);\n    expect(idle - active).toBeGreaterThanOrEqual(60);\n    expect(idle).toBeGreaterThan(600);\n  });\n\n});\n",
)

print("Applied compact Barkly lower-third layout patch.")
