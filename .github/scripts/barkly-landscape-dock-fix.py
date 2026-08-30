from pathlib import Path

path = Path("barkly/app/src/ui/BarklyKit.tsx")
text = path.read_text()
old = "  kit: { position: 'absolute', left: 7, right: 7, bottom: -1, height: 72,"
new = "  kit: { position: 'absolute', left: 7, right: 7, bottom: 0, height: 72,"
if old not in text:
    raise SystemExit("missing responsive Barkly kit anchor")
path.write_text(text.replace(old, new, 1))
