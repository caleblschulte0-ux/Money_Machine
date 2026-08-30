from pathlib import Path

p = Path('barkly/app/src/ui/BarklyRoom.tsx')
s = p.read_text()


def once(old: str, new: str, label: str) -> None:
    global s
    if old not in s:
        raise SystemExit(f'missing landscape fix fragment: {label}')
    s = s.replace(old, new, 1)

once(
    "style={[styles.tab, location === loc && styles.tabActive, areaLocked && styles.tabLocked]}",
    "style={[styles.tab, landscape && styles.tabLandscape, location === loc && styles.tabActive, areaLocked && styles.tabLocked]}",
    'tab style usage',
)

once(
    """  placesLandscape: {
    position: 'absolute',
    left: 0,
    top: STATUS_HEIGHT + 8,
    height: 'auto',
    marginTop: 0,
    zIndex: 30,
  },""",
    """  placesLandscape: {
    position: 'absolute',
    left: 0,
    top: STATUS_HEIGHT + 8,
    height: 248,
    marginTop: 0,
    zIndex: 30,
  },""",
    'places rail height',
)

once(
    "  tabsLandscape: { flex: 0, width: '100%', height: 'auto', flexDirection: 'column', padding: 4, gap: 4 },\n  tab: { flexGrow: 1, flexShrink: 1, flexDirection: 'row', minHeight: TAP_MIN, paddingHorizontal: 6, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },",
    "  tabsLandscape: { flex: 0, width: '100%', height: 248, flexDirection: 'column', padding: 4, gap: 4 },\n  tabLandscape: { flexGrow: 0, flexShrink: 0, width: '100%', height: TAP_MIN },\n  tab: { flexGrow: 1, flexShrink: 1, flexDirection: 'row', minHeight: TAP_MIN, paddingHorizontal: 6, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },",
    'landscape tab geometry',
)

p.write_text(s)
