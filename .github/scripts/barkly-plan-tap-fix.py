from pathlib import Path

path = Path("barkly/app/src/ui/BarklyRoom.tsx")
text = path.read_text()
old = """  planChip: {
    minWidth: 42,
    height: TAP_MIN - 6,
    paddingHorizontal: 8,"""
new = """  planChip: {
    minWidth: TAP_MIN,
    height: TAP_MIN,
    paddingHorizontal: 8,"""
if old not in text:
    raise SystemExit("missing responsive plan chip geometry")
path.write_text(text.replace(old, new, 1))
