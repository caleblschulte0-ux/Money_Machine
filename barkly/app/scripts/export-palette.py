#!/usr/bin/env python3
"""Write the world palette into TypeScript, so `src/` and Blender share one.

WHY THIS EXISTS. `tools/blender/palette.py` states that nothing outside it
names a colour, and `tests/palette_source.test.ts` enforces that -- for
`tools/blender`. It stopped at the language boundary. On the other side of
that boundary `src/ui/scenes/artPalette.ts` held 236 hand-named colours at
mean saturation 0.526, which is the same 255-unrelated-decisions disease
palette.py was written to cure, in a second file, for the half of the picture
the renderer does not draw.

That stayed invisible while the two happened to be equally loud. The moment
the world's field dropped to 0.26 the app's sky, its ground haze and its whole
HUD became the loudest thing on screen -- louder than Barkly, who is the one
object the concept sheet says has to stand out. A character cannot pop off a
background that is quiet if the furniture in front of him is not.

So the families cross the boundary instead of being retyped. This file is
GENERATED; edit `tools/blender/palette.py` and re-run:

    python3 scripts/export-palette.py            # write
    python3 scripts/export-palette.py --check    # fail if stale (CI)
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools" / "blender"))
import palette  # noqa: E402

OUT = ROOT / "src" / "ui" / "scenes" / "worldPalette.ts"
STEPS = ("deep", "shade", "base", "lit", "pop")

HEADER = """/**
 * THE WORLD'S PALETTE, IN TYPESCRIPT. Generated -- do not edit.
 *
 * Source of truth is `tools/blender/palette.py`; this is the same families and
 * the same five-step ramp, emitted so that what `src/` paints and what Blender
 * renders cannot drift apart. Regenerate with:
 *
 *     python3 scripts/export-palette.py
 *
 * `__tests__/palette_export.test.ts` fails if this file is stale, which is the
 * only thing that makes "one palette" true rather than aspirational.
 */
"""


def render() -> str:
    out = [HEADER, "export type ToneStep = " +
           " | ".join(f"'{s}'" for s in STEPS) + ";\n",
           "/** Every family, deep to pop. */",
           "export const TONE = {"]
    for name in palette.FAMILIES:
        cells = ", ".join(f"{s}: '{palette.tone(name, s)}'" for s in STEPS)
        out.append(f"  {name}: {{ {cells} }},")
    out.append("} as const;\n")
    out.append("export type ToneFamily = keyof typeof TONE;\n")
    out.append("/** One colour, the same call shape the render packs use. */")
    out.append("export function tone(family: ToneFamily, step: ToneStep = 'base'): string {")
    out.append("  return TONE[family][step];")
    out.append("}")
    return "\n".join(out) + "\n"


def main() -> int:
    text = render()
    if "--check" in sys.argv:
        if not OUT.exists():
            print(f"MISSING {OUT.relative_to(ROOT)} -- run scripts/export-palette.py")
            return 1
        if OUT.read_text() != text:
            print(f"STALE {OUT.relative_to(ROOT)} -- tools/blender/palette.py has "
                  f"moved since it was written. Run scripts/export-palette.py")
            return 1
        print("worldPalette.ts is current with tools/blender/palette.py")
        return 0
    OUT.write_text(text)
    print(f"wrote {OUT.relative_to(ROOT)}  ({len(palette.FAMILIES)} families x {len(STEPS)} steps)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
