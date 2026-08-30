from pathlib import Path


def once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing expected fragment: {label}")
    return text.replace(old, new, 1)


# Central responsive geometry. The world owns the viewport while Barkly and the
# interaction chrome live in a bounded protected stage.
Path("barkly/app/src/ui/layout.ts").write_text(
    """/**
 * Responsive screen geometry for Barkly.
 *
 * More screen reveals more world. It does not make Barkly or the HUD grow
 * without bound. Portrait uses two shallow top rows; landscape moves location
 * navigation and conversation controls into side rails around a center stage.
 */
export const CONTENT_TOP = 12;
export const CONTENT_BOTTOM = 12;

export function contentTop(insetTop: number): number {
  return insetTop > 0 ? insetTop + 8 : CONTENT_TOP;
}
export function contentBottom(insetBottom: number): number {
  return insetBottom > 0 ? insetBottom + 8 : CONTENT_BOTTOM;
}

export const TAP_MIN = 44;
export const STATUS_HEIGHT = TAP_MIN;
export const PLACES_HEIGHT = TAP_MIN + 4;
export const CHROME_BOTTOM = STATUS_HEIGHT + PLACES_HEIGHT + 6;

export type LayoutMode = 'narrowPortrait' | 'widePortrait' | 'phoneLandscape' | 'tabletLandscape';

export function layoutMode(width: number, height: number): LayoutMode {
  const landscape = width > height;
  const tablet = Math.min(width, height) >= 600;
  if (landscape) return tablet ? 'tabletLandscape' : 'phoneLandscape';
  return width >= 600 ? 'widePortrait' : 'narrowPortrait';
}

export function isLandscapeMode(mode: LayoutMode): boolean {
  return mode === 'phoneLandscape' || mode === 'tabletLandscape';
}

export function chromeBottom(mode: LayoutMode = 'narrowPortrait'): number {
  return isLandscapeMode(mode) ? STATUS_HEIGHT + 6 : CHROME_BOTTOM;
}

export function noticeTop(top: number, mode: LayoutMode = 'narrowPortrait'): number {
  return top + chromeBottom(mode) + 4;
}
export const NOTICE_MAX_HEIGHT = 38;

export const DIALOGUE_HEIGHT = 96;
export const DIALOGUE_GAP = 6;
export const CONTROLS_HEIGHT = TAP_MIN + 14;
export const SPEECH_MAX_LINES = 3;

export function contentFrameWidth(width: number, mode: LayoutMode): number {
  if (mode === 'narrowPortrait') return width;
  if (mode === 'widePortrait') return Math.min(620, Math.max(560, width - 40));
  if (mode === 'phoneLandscape') return Math.max(540, width - 24);
  return Math.min(1120, Math.max(760, width - 48));
}

export function navRailWidth(mode: LayoutMode): number {
  return mode === 'tabletLandscape' ? 112 : mode === 'phoneLandscape' ? 92 : 0;
}

export function interactionRailWidth(mode: LayoutMode): number {
  return mode === 'tabletLandscape' ? 300 : mode === 'phoneLandscape' ? 250 : 0;
}

export function stageWidth(width: number, mode: LayoutMode): number {
  if (mode === 'narrowPortrait') return width;
  if (mode === 'widePortrait') return Math.min(560, width - 40);
  const gutters = mode === 'tabletLandscape' ? 64 : 52;
  const available = width - navRailWidth(mode) - interactionRailWidth(mode) - gutters;
  const cap = mode === 'tabletLandscape' ? 620 : 430;
  return Math.max(mode === 'tabletLandscape' ? 360 : 210, Math.min(cap, available));
}

export function stageHeight(screenHeight: number, mode: LayoutMode = 'narrowPortrait'): number {
  if (isLandscapeMode(mode)) return Math.max(230, screenHeight - STATUS_HEIGHT - 18);
  return Math.max(
    212,
    screenHeight - CHROME_BOTTOM - DIALOGUE_HEIGHT - DIALOGUE_GAP * 2 - CONTROLS_HEIGHT - 18,
  );
}

export const SPRITE_HEIGHT = 322;
export const SPRITE_FOOT = 78;
export const NOTICE_BAND = 4 + NOTICE_MAX_HEIGHT;
const SPRITE_BODY_WIDTH = 244;

export function spriteScale(
  screenHeight: number,
  stageWidthPx = 390,
  mode: LayoutMode = 'narrowPortrait',
): number {
  const landscape = isLandscapeMode(mode);
  const room = stageHeight(screenHeight, mode) - SPRITE_FOOT - (landscape ? 20 : NOTICE_BAND + 4);
  const byWidth = (stageWidthPx * 0.82) / SPRITE_BODY_WIDTH;
  const minScale = landscape
    ? screenHeight < 430 ? 0.62 : 0.72
    : screenHeight < 590 ? 0.60 : screenHeight < 680 ? 0.66 : 0.72;
  const cap = mode === 'tabletLandscape' ? 1.25 : mode === 'widePortrait' ? 1.34 : mode === 'phoneLandscape' ? 1.05 : 1.42;
  return Math.max(minScale, Math.min(cap, room / SPRITE_HEIGHT, byWidth));
}

export type NoticeKind = 'error' | 'degraded' | 'promotion' | 'reward';
export const NOTICE_PRIORITY: NoticeKind[] = ['error', 'degraded', 'promotion', 'reward'];
"""
)

room_path = Path("barkly/app/src/ui/BarklyRoom.tsx")
room = room_path.read_text()

room = once(room, "import { asyncStorageStore } from '../storage/asyncStorageStore';\n", "", "async store import")
room = once(room, "import { activeSlot } from '../dev/saveSlots';\n", "", "active slot import")
room = once(
    room,
    "  CHROME_BOTTOM,\n  CONTROLS_HEIGHT,",
    "  chromeBottom,\n  contentFrameWidth,\n  CONTROLS_HEIGHT,",
    "responsive imports one",
)
room = once(
    room,
    "  contentBottom,\n  contentTop,\n  noticeTop,",
    "  contentBottom,\n  contentTop,\n  interactionRailWidth,\n  isLandscapeMode,\n  layoutMode,\n  navRailWidth,\n  noticeTop,",
    "responsive imports two",
)
room = once(
    room,
    "  SPRITE_FOOT,\n  stageHeight,",
    "  SPRITE_FOOT,\n  stageHeight,\n  stageWidth,",
    "responsive imports three",
)

room = once(
    room,
    "  const { height: screenH, width: screenW } = useWindowDimensions();\n",
    "  const { height: screenH, width: screenW } = useWindowDimensions();\n"
    "  const layout = layoutMode(screenW, screenH);\n"
    "  const landscape = isLandscapeMode(layout);\n"
    "  const widePortrait = layout === 'widePortrait';\n"
    "  const frameW = contentFrameWidth(screenW, layout);\n"
    "  const stageW = stageWidth(screenW, layout);\n"
    "  const navW = navRailWidth(layout);\n"
    "  const interactionW = interactionRailWidth(layout);\n"
    "  const chromeBottomPx = chromeBottom(layout);\n",
    "layout calculations",
)
room = once(room, "  const spriteScale = scaleForScreen(screenH, screenW);", "  const spriteScale = scaleForScreen(screenH, stageW, layout);", "bounded sprite")
room = once(
    room,
    "  const sceneBand = screenH - DIALOGUE_HEIGHT - DIALOGUE_GAP * 2 - CONTROLS_HEIGHT + 8;",
    "  const sceneBand = landscape ? screenH : screenH - DIALOGUE_HEIGHT - DIALOGUE_GAP * 2 - CONTROLS_HEIGHT + 8;",
    "scene band",
)
room = once(
    room,
    "  const groundY = topPad + CHROME_BOTTOM + stageHeight(screenH) - SPRITE_FOOT;",
    "  const groundY = topPad + chromeBottomPx + stageHeight(screenH, layout) - SPRITE_FOOT;",
    "ground line",
)

room = once(
    room,
    "  const [playtestOpen, setPlaytestOpen] = useState(false);\n"
    "  const [slotName, setSlotName] = useState<string | null>(null);\n"
    "  useEffect(() => {\n"
    "    if (!playtest) return;\n"
    "    void activeSlot(asyncStorageStore).then((s) => setSlotName(s?.name ?? null));\n"
    "  }, [playtest, playtestOpen]);",
    "  const [playtestOpen, setPlaytestOpen] = useState(false);",
    "playtest badge state",
)

room = once(
    room,
    "        {location === 'home' && <HomeScene hour={hour} upgrades={barkly.placedHome} asleep={asleep} groundY={groundY} chromeBottom={topPad + CHROME_BOTTOM} />}",
    "        {location === 'home' && <HomeScene hour={hour} upgrades={barkly.placedHome} asleep={asleep} groundY={groundY} chromeBottom={topPad + chromeBottomPx} />}",
    "home chrome",
)
room = once(room, "        style={styles.chromeScrim}", "        style={[styles.chromeScrim, { height: chromeBottomPx + 78 }]}", "chrome scrim")
room = once(
    room,
    "        style={styles.horizon}",
    "        style={[styles.horizon, { height: landscape ? 76 : DIALOGUE_HEIGHT + CONTROLS_HEIGHT + 48 }]}",
    "horizon",
)
room = once(
    room,
    "      <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>",
    "      <KeyboardAvoidingView\n"
    "        style={[styles.content, { maxWidth: frameW, paddingHorizontal: landscape ? 12 : widePortrait ? 20 : 16 }]}\n"
    "        behavior={Platform.OS === 'ios' ? 'padding' : undefined}\n"
    "      >",
    "content frame",
)
room = once(
    room,
    "          <View style={[styles.noticeLayer, { top: noticeTop(topPad) }]} pointerEvents=\"box-none\">",
    "          <View\n"
    "            style={[\n"
    "              styles.noticeLayer,\n"
    "              { top: noticeTop(topPad, layout) },\n"
    "              landscape ? { left: navW + 12, right: interactionW + 12 } : { left: 22, right: 22 },\n"
    "            ]}\n"
    "            pointerEvents=\"box-none\"\n"
    "          >",
    "notice safe zone",
)

# Remove the permanent TEST chip, then make the location rail responsive.
places = room.index("        <View style={styles.places}>")
start = room.index("          {playtest && (\n", places)
marker = "          )}\n          <View style={styles.tabs}>"
end = room.index(marker, start)
room = room[:places] + room[places:].replace(
    "        <View style={styles.places}>",
    "        <View style={[styles.places, landscape && styles.placesLandscape, landscape && { width: navW }]}>",
    1,
)
places = room.index("        <View style={[styles.places")
start = room.index("          {playtest && (\n", places)
end = room.index(marker, start)
room = room[:start] + "          <View style={[styles.tabs, landscape && styles.tabsLandscape]}>" + room[end + len(marker):]

plan_old = """          })}
          </View>
          {barkly.adventure && (
            <Pressable
              style={[styles.planChip, planComplete && styles.planChipDone]}
              onPress={() => openOnly(setPlanOpen)}
              accessibilityRole="button"
              accessibilityLabel={`Barkly's plan. ${planDone} of ${planTotal} complete. ${
                planComplete ? 'All done.' : barkly.adventure.goals.find((g) => !g.done)?.label ?? ''
              }`}
            >
              <Text style={[styles.planChipText, planComplete && styles.planChipTextDone]}>
                {planDone}/{planTotal}
              </Text>
            </Pressable>
          )}
        </View>"""
plan_new = """          })}
          {barkly.adventure && (
            <Pressable
              style={[styles.planChip, planComplete && styles.planChipDone, landscape && styles.planChipLandscape]}
              onPress={() => openOnly(setPlanOpen)}
              accessibilityRole="button"
              accessibilityLabel={`Barkly's plan. ${planDone} of ${planTotal} complete. ${
                planComplete ? 'All done.' : barkly.adventure.goals.find((g) => !g.done)?.label ?? ''
              }`}
            >
              <Text style={[styles.planChipText, planComplete && styles.planChipTextDone]}>
                {planDone}/{planTotal}
              </Text>
            </Pressable>
          )}
          </View>
        </View>"""
room = once(room, plan_old, plan_new, "integrated plan counter")

room = once(
    room,
    "        <View style={[styles.stageArea, { height: stageHeight(screenH) }]>",
    "        <View\n"
    "          style={[\n"
    "            styles.stageArea,\n"
    "            { height: stageHeight(screenH, layout) },\n"
    "            landscape\n"
    "              ? { marginLeft: navW + 8, marginRight: interactionW + 8 }\n"
    "              : { width: '100%', maxWidth: stageW, alignSelf: 'center' },\n"
    "          ]}\n"
    "        >",
    "protected stage",
)

room = once(
    room,
    "        <DialoguePanel\n",
    "        <View\n"
    "          style={[\n"
    "            styles.interactionStack,\n"
    "            landscape && styles.interactionStackLandscape,\n"
    "            landscape ? { width: interactionW } : { maxWidth: stageW },\n"
    "          ]}\n"
    "        >\n"
    "        <DialoguePanel\n",
    "interaction wrapper",
)
close_keyboard = "        </View>\n      </KeyboardAvoidingView>"
idx = room.rfind(close_keyboard)
if idx < 0:
    raise SystemExit("missing keyboard close")
room = room[:idx] + "        </View>\n        </View>\n      </KeyboardAvoidingView>" + room[idx + len(close_keyboard):]

room = once(
    room,
    "        onForgetEverything={barkly.forgetEverything}\n      />",
    "        onForgetEverything={barkly.forgetEverything}\n"
    "        onOpenPlaytest={playtest ? () => { setSettingsOpen(false); setPlaytestOpen(true); } : undefined}\n"
    "      />",
    "settings playtest entry",
)

for old, new, label in [
    ("  chromeScrim: { position: 'absolute', left: 0, right: 0, top: 0, height: CHROME_BOTTOM + 92 },", "  chromeScrim: { position: 'absolute', left: 0, right: 0, top: 0 },", "scrim style"),
    ("    height: DIALOGUE_HEIGHT + CONTROLS_HEIGHT + 56,", "    height: DIALOGUE_HEIGHT + CONTROLS_HEIGHT + 48,", "horizon style"),
    ("  content: { flex: 1, paddingHorizontal: 22 },", "  content: { flex: 1, width: '100%', alignSelf: 'center', paddingHorizontal: 16 },", "content style"),
    ("  headerButtons: { flexDirection: 'row', gap: 7 },", "  headerButtons: { flexDirection: 'row', gap: 6 },", "header gap"),
    ("  walletTap: { flex: 1, marginHorizontal: 8 },", "  walletTap: { flex: 1 },", "wallet margin"),
    ("  tabs: { flex: 1, flexDirection: 'row', marginTop: 10, backgroundColor: 'rgba(255,253,247,0.85)', borderRadius: 999, padding: 4, gap: 2, ...elevation.card },", "  tabs: { flex: 1, height: TAP_MIN, flexDirection: 'row', backgroundColor: 'rgba(255,253,247,0.90)', borderRadius: 999, padding: 3, gap: 2, ...elevation.card },", "tabs style"),
    ("  stageArea: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 22 },", "  stageArea: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 12 },", "stage style"),
    ("  controls: { gap: 9 },", "  controls: { gap: 6 },", "control gap"),
    ("  talk: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: color.pop, borderRadius: 999, paddingVertical: 18, overflow: 'hidden', ...elevation.card },", "  talk: { flex: 1, minHeight: TAP_MIN, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: color.pop, borderRadius: 999, paddingVertical: 12, overflow: 'hidden', ...elevation.card },", "talk style"),
]:
    room = once(room, old, new, label)

room = once(
    room,
    """  playtest: {
    marginTop: 10,
    minHeight: TAP_MIN,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: color.ink,
  },
  playtestText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8, color: color.inkOn },
""",
    "",
    "dead playtest styles",
)
room = once(
    room,
    """  places: {
    height: PLACES_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.sm,
  },""",
    """  places: {
    height: PLACES_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  placesLandscape: {
    position: 'absolute',
    left: 0,
    top: STATUS_HEIGHT + 8,
    height: 'auto',
    marginTop: 0,
    zIndex: 30,
  },""",
    "places style",
)
room = once(
    room,
    """  planChip: {
    minWidth: 46,
    height: TAP_MIN,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: color.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.low,
  },""",
    """  planChip: {
    minWidth: 42,
    height: TAP_MIN - 6,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    backgroundColor: color.goldWell,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.flat,
  },
  planChipLandscape: { width: '100%', height: TAP_MIN, marginTop: 2 },""",
    "plan style",
)
room = once(
    room,
    "  tab: { flexGrow: 1, flexShrink: 1, flexDirection: 'row', minHeight: TAP_MIN, paddingHorizontal: 6, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },",
    "  tabsLandscape: { flex: 0, width: '100%', height: 'auto', flexDirection: 'column', padding: 4, gap: 4 },\n"
    "  tab: { flexGrow: 1, flexShrink: 1, flexDirection: 'row', minHeight: TAP_MIN, paddingHorizontal: 6, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },",
    "landscape tabs style",
)
room = once(
    room,
    """  noticeLayer: {
    position: 'absolute',
    left: 22,
    right: 22,
    height: NOTICE_MAX_HEIGHT,""",
    """  noticeLayer: {
    position: 'absolute',
    height: NOTICE_MAX_HEIGHT,""",
    "notice sides",
)
room = once(
    room,
    "  controls: { gap: 6 },",
    "  interactionStack: { width: '100%', alignSelf: 'center' },\n"
    "  interactionStackLandscape: { position: 'absolute', right: 0, top: STATUS_HEIGHT + 8, bottom: 0, justifyContent: 'flex-end', paddingBottom: 2 },\n"
    "  controls: { gap: 6 },",
    "interaction styles",
)
room_path.write_text(room)

# Slightly denser bottom chrome on portrait, without shrinking touch targets.
dialogue_path = Path("barkly/app/src/ui/DialoguePanel.tsx")
dialogue = dialogue_path.read_text()
dialogue = once(dialogue, "    paddingVertical: space.md,", "    paddingVertical: space.sm,", "dialogue padding")
dialogue_path.write_text(dialogue)

kit_path = Path("barkly/app/src/ui/BarklyKit.tsx")
kit = kit_path.read_text()
for old, new, label in [
    ("  kit: { position: 'absolute', left: 7, right: 7, bottom: -1, height: 78,", "  kit: { position: 'absolute', left: 7, right: 7, bottom: -1, height: 72,", "kit height"),
    ("bottom: -3, height: 25,", "bottom: -3, height: 22,", "dock shadow"),
    ("bottom: 2, height: 48,", "bottom: 2, height: 44,", "dock height"),
    ("minHeight: TAP_MIN + 20,", "minHeight: TAP_MIN + 16,", "slot height"),
    ("height: 68, zIndex: 2", "height: 62, zIndex: 2", "art height"),
]:
    kit = once(kit, old, new, label)
kit_path.write_text(kit)

# Playtest controls move into Settings rather than occupying the game HUD.
settings_path = Path("barkly/app/src/ui/SettingsSheet.tsx")
settings = settings_path.read_text()
settings = once(settings, "  onForgetEverything: () => Promise<void>;\n}", "  onForgetEverything: () => Promise<void>;\n  onOpenPlaytest?: () => void;\n}", "settings prop")
settings = once(settings, "    onGrantEverything,\n  } = props;", "    onGrantEverything,\n    onOpenPlaytest,\n  } = props;", "settings destructure")
settings = once(
    settings,
    "          <ScrollView style={styles.scroll}>\n            <Text style={styles.section}>How Barkly is doing</Text>",
    """          <ScrollView style={styles.scroll}>
            {onOpenPlaytest && (
              <Pressable
                style={styles.devRow}
                onPress={onOpenPlaytest}
                accessibilityRole="button"
                accessibilityLabel="Playtest saves"
                testID="playtest-settings"
              >
                <View style={styles.devRowText}>
                  <Text style={styles.devTitle}>Playtest saves</Text>
                  <Text style={styles.devBlurb}>Jump between testing states without using permanent game-screen space.</Text>
                </View>
                <Text style={styles.devState}>open</Text>
              </Pressable>
            )}
            <Text style={styles.section}>How Barkly is doing</Text>""",
    "settings entry",
)
settings_path.write_text(settings)

# Acceptance follows Settings -> Playtest saves, while keeping a badge fallback
# for old artifacts.
acceptance_path = Path("barkly/app/scripts/playtest-acceptance.mjs")
acceptance = acceptance_path.read_text()
acceptance = once(
    acceptance,
    """async function loadPreset(id) {
  await dismissAnything();
  const badge = byId('playtest-badge');
  if (!(await badge.count())) {
    await page.screenshot({ path: `/tmp/acceptance-no-badge-${id}.png` });
    return false;
  }
  await badge.click();
  await settle(800);""",
    """async function openPlaytestPanel() {
  const badge = byId('playtest-badge');
  if (await badge.count()) {
    await badge.click();
    await settle(800);
    return true;
  }
  const settings = page.getByRole('button', { name: 'Settings' }).first();
  if (!(await settings.count())) return false;
  await settings.click();
  await settle(600);
  const entry = page.getByRole('button', { name: 'Playtest saves' }).first();
  if (!(await entry.count())) return false;
  await entry.click();
  await settle(800);
  return true;
}

async function playtestEntryReachable() {
  const settings = page.getByRole('button', { name: 'Settings' }).first();
  if (!(await settings.count())) return false;
  await settings.click();
  await settle(500);
  const entry = page.getByRole('button', { name: 'Playtest saves' }).first();
  const ok = (await entry.count()) > 0;
  const close = page.getByRole('button', { name: 'Close settings' }).first();
  if (await close.count()) await close.click();
  await settle(500);
  return ok;
}

async function loadPreset(id) {
  await dismissAnything();
  if (!(await openPlaytestPanel())) {
    await page.screenshot({ path: `/tmp/acceptance-no-playtest-entry-${id}.png` });
    return false;
  }""",
    "acceptance open",
)
acceptance = once(
    acceptance,
    "check('24. playtest badge present on the playtest build', (await byId('playtest-badge').count()) > 0);",
    "check('24. playtest saves reachable from Settings', await playtestEntryReachable());",
    "acceptance initial check",
)
acceptance_path.write_text(acceptance)

overlap_path = Path("barkly/app/scripts/overlap-check.mjs")
overlap = overlap_path.read_text()
overlap = once(
    overlap,
    "  '360x568,360x600,360x640,375x667,390x720,390x844,412x915,430x932',",
    "  '360x568,360x640,390x844,430x932,667x375,844x390,768x1024,1024x768,820x1180,1180x820,1366x1024',",
    "responsive viewport matrix",
)
overlap = once(overlap, "  if (notice && size.height <= 720) {", "  if (notice && size.height <= 720 && size.height >= size.width) {", "portrait clear line")
overlap_path.write_text(overlap)

hero_path = Path("barkly/app/__tests__/hero_layout.test.ts")
hero = hero_path.read_text()
hero = once(hero, "  PLACES_HEIGHT,\n  STATUS_HEIGHT,", "  PLACES_HEIGHT,\n  STATUS_HEIGHT,\n  interactionRailWidth,\n  layoutMode,\n  navRailWidth,", "hero imports one")
hero = once(hero, "  spriteScale,\n  stageHeight,", "  spriteScale,\n  stageHeight,\n  stageWidth,", "hero imports two")
final_close = "\n});\n"
idx = hero.rfind(final_close)
if idx < 0:
    raise SystemExit("missing hero test close")
hero = hero[:idx] + """

  it('classifies four responsive layout modes', () => {
    expect(layoutMode(390, 844)).toBe('narrowPortrait');
    expect(layoutMode(768, 1024)).toBe('widePortrait');
    expect(layoutMode(844, 390)).toBe('phoneLandscape');
    expect(layoutMode(1024, 768)).toBe('tabletLandscape');
  });

  it('uses tablet width for world rather than inflating Barkly', () => {
    const mode = layoutMode(1024, 768);
    const width = stageWidth(1024, mode);
    const scale = spriteScale(768, width, mode);
    expect(width).toBeLessThan(1024 * 0.7);
    expect(scale).toBeLessThanOrEqual(1.25);
  });

  it('reserves real side rails in landscape', () => {
    const mode = layoutMode(844, 390);
    expect(navRailWidth(mode)).toBeGreaterThanOrEqual(80);
    expect(interactionRailWidth(mode)).toBeGreaterThanOrEqual(220);
    expect(stageHeight(390, mode)).toBeGreaterThan(280);
  });
""" + hero[idx:]
hero_path.write_text(hero)
