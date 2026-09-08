#!/usr/bin/env python3
"""Refuse a shipped prop whose surface is flat.

THE DEFECT THIS EXISTS TO CATCH. Every prop in the game takes its material
from one function in `tools/blender/world_prop_pack.py`, and for months that
function set a single flat colour and a single roughness. The result was a
hand-modelled plush dog standing in a world of untextured plastic: measured at
native resolution, Barkly carried 2.94 units of fine detail and the park hedge
carried 0.25 -- a factor of twelve between the hero and the thing he stands
next to. Nobody could see the number, so it survived every art pass.

It is measurable, so it is now gated.

HOW IT MEASURES. For each prop, the MEDIAN absolute deviation of luminance
from its own 1px Gaussian blur, over interior pixels only (a pixel whose whole
3x3 neighbourhood is opaque, so the alpha edge cannot be mistaken for texture).

The median, not the mean, and that is the whole design. The mean is dominated
by GEOMETRY: a shopfront's window mullions and awning stripes are a handful of
pixels with huge values, and they pushed the untextured store to 1.15 while the
untextured hedge sat at 0.25 -- so no single mean threshold could separate
"has a surface" from "has detailed geometry", and the first floor written here
would have passed two of the very props it was built to catch. Surface texture
is the opposite shape: a small deviation at nearly EVERY pixel. The median sees
only that. Measured across the props as they shipped before this existed, every
untextured one scores exactly 0.00 and every textured one scores 1.00 or more.

It is computed at NATIVE resolution deliberately: an earlier version of this
measurement normalised every prop to a fixed height, which upscaled a 638x21
paving course nineteen times and reported its detail as exactly 0.00 -- a
measurement artefact indistinguishable from a real flat render.

WHAT IT DOES NOT DO. It does not check that the texture is good, only that
there is one. Good is a judgement and it belongs to whoever is looking at the
render. This catches the specific regression of the surface layer silently
going away -- a reverted material(), a prop that stops routing through it, a
`surface="smooth"` applied to something that is not glass.
"""
from __future__ import annotations

import math
import re
import sys
from pathlib import Path

try:
    from PIL import Image, ImageFilter
except ImportError:  # pragma: no cover - the battery installs Pillow
    print("surface-check needs Pillow: pip install pillow")
    raise SystemExit(1)

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "tools" / "blender" / "world_prop_pack.py"
ASSETS = ROOT / "assets" / "world"

# Flat measures 0, textured measures 1 or more, so the floor is 1 and there is
# nothing to tune. It is a threshold on a quantity that is genuinely bimodal
# rather than a number picked to sit under today's worst prop.
#
# This is also why `scripts/promote-props.py` quantises WITHOUT dithering.
# Dither is pixel-scale noise, which is what this measures: dithered, the old
# untextured props score 1.00 too and the gate silently stops working.
FLOOR = 1.0

# Things with no surface by design. A cloud has no tooth, glass has no tooth,
# and a contact shadow is not an object -- putting grain on any of them looks
# like a fault, so they are exempt BY NAME and the list is short on purpose.
EXEMPT = {
    "sky/cloud": "a cloud has no tooth",
    "sky/cloud_far": "a cloud has no tooth",
    "beach/surf": "water; every one of its materials is deliberately smooth",
}


def destination(path: str) -> Path:
    location, name = path.split("/", 1)
    if location in ("item", "sky"):
        return ASSETS / location / f"{name}.png"
    return ASSETS / location / "props" / f"{name}.png"


def fine_detail(png: Path) -> tuple[float, int]:
    """Median deviation from a 1px blur across interior pixels."""
    image = Image.open(png).convert("RGBA")
    image = image.crop(image.getbbox())
    alpha = image.split()[3]
    grey = image.convert("L")
    width, height = image.size
    g, a = grey.load(), alpha.load()
    interior = [
        (x, y)
        for y in range(1, height - 1)
        for x in range(1, width - 1)
        if a[x, y] > 250
        and min(a[x + dx, y + dy] for dx in (-1, 0, 1) for dy in (-1, 0, 1)) > 250
    ]
    if len(interior) < 400:
        return math.nan, len(interior)
    blurred = grey.filter(ImageFilter.GaussianBlur(1)).load()
    deviations = sorted(abs(g[p] - blurred[p[0], p[1]]) for p in interior)
    return float(deviations[len(deviations) // 2]), len(interior)


def main() -> int:
    source = PACK.read_text(encoding="utf-8")
    block = source[source.index("BUILDERS = {"):]
    block = block[:block.index("\n}\n")]
    paths = sorted(re.findall(r'"([a-z_]+/[a-z_0-9]+)":', block))

    failures, skipped = [], []
    for path in paths:
        if path in EXEMPT:
            skipped.append(f"{path} ({EXEMPT[path]})")
            continue
        png = destination(path)
        if not png.exists():
            skipped.append(f"{path} (not shipped)")
            continue
        detail, interior = fine_detail(png)
        if math.isnan(detail):
            skipped.append(f"{path} ({interior}px interior, too thin to measure)")
            continue
        mark = "ok  " if detail >= FLOOR else "FLAT"
        print(f"  {mark}  {path:<24} {detail:5.2f}")
        if detail < FLOOR:
            failures.append((path, detail))

    if skipped:
        print("\nnot measured: " + ", ".join(skipped))
    if failures:
        print(
            f"\n{len(failures)} prop(s) below the {FLOOR} floor for fine surface "
            f"detail:\n"
            + "\n".join(f"  {path}  {detail:.2f}" for path, detail in failures)
            + "\n\nThe surface layer is how the world stops reading as plastic. "
            "Check that material() in tools/blender/world_prop_pack.py still "
            "builds its noise graph, that this prop's materials are not being "
            "inferred as \"smooth\", and that the render was promoted:\n"
            "  python3 scripts/promote-props.py --check"
        )
        return 1
    print(f"\nevery measured prop carries surface detail (median >= {FLOOR})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
