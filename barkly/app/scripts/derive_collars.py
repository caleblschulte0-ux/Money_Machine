#!/usr/bin/env python3
"""
Derive a real, shaded collar overlay for each colour you can buy.

The collar used to be a translucent RECTANGLE — `borderRadius: 5`, opacity
0.6 — laid across a rendered clay dog. Nothing about a flat coloured bar
belongs on that art: it had square ends, no curvature, no shading, and it sat
on top of the buckle. It looked exactly like what it was.

The art already contains a beautifully lit collar. So instead of drawing over
it, this takes the leather pixels out of the render and REHUES them, keeping
every highlight and shadow the original had. The buckle and the tag are
metal, so they are left alone.

Output: one RGBA PNG per collar, the same dimensions as the source render and
transparent everywhere except the leather. The app lays it over the sprite at
identical size, so it lines up at any scale and rides the same transform — no
positioning constants to drift.

    python scripts/derive_collars.py

Regenerate whenever the render or the collar palette changes, and commit the
result. The colours come from STORE in src/game/progression.ts; a test holds
the two in step.
"""

from __future__ import annotations

import colorsys
import os
import sys

from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(HERE)
RENDERS = os.path.join(APP, "assets", "barkly", "renders")
SOURCE = os.path.join(RENDERS, "front.png")
OUT_DIR = os.path.join(RENDERS, "collars")

# Must match the `color` values on the collar items in game/progression.ts.
COLLARS = {
    "red": "#B3402E",
    "blue": "#3E6E9C",
    "green": "#4E7A46",
    "gold": "#C9A227",
}

# The collar band, as a fraction of the image height. Measured off the render:
# the wide dark run sits between 57% and 71%, well clear of the muzzle above.
BAND_TOP, BAND_BOTTOM = 0.565, 0.715

# Leather is dark; the buckle and the name tag are bright metal. Everything at
# or below this luma inside the band is treated as strap.
LEATHER_MAX_LUMA = 96
# ...except pixels this yellow, which are the buckle catching the light.
METAL_MIN_WARMTH = 26


def luma(r: int, g: int, b: int) -> float:
    return 0.299 * r + 0.587 * g + 0.114 * b


def is_leather(r: int, g: int, b: int, a: int) -> bool:
    if a < 40:
        return False
    if luma(r, g, b) > LEATHER_MAX_LUMA:
        return False
    # Warm metal reads darker than you would think in shadow; keep it out.
    if r - b > METAL_MIN_WARMTH and r > 90:
        return False
    return True


def rehue(r: int, g: int, b: int, target: tuple[int, int, int]) -> tuple[int, int, int]:
    """Take the target's hue and saturation, keep the pixel's own lightness.

    This is what preserves the modelling. The strap's shadow stays a shadow and
    its highlight stays a highlight; only the colour of the leather changes.
    """
    _, l, _ = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    th, _, ts = colorsys.rgb_to_hls(*[c / 255 for c in target])
    # The source leather is very dark, so lift it into a range where a hue is
    # actually visible, while keeping the relative shading intact.
    lifted = 0.20 + l * 1.55
    nr, ng, nb = colorsys.hls_to_rgb(th, min(0.92, lifted), ts)
    return int(nr * 255), int(ng * 255), int(nb * 255)


def main() -> int:
    if not os.path.exists(SOURCE):
        print(f"missing {SOURCE}", file=sys.stderr)
        return 2
    src = Image.open(SOURCE).convert("RGBA")
    w, h = src.size
    px = src.load()

    top, bottom = int(h * BAND_TOP), int(h * BAND_BOTTOM)
    mask = Image.new("L", (w, h), 0)
    mp = mask.load()
    count = 0
    for y in range(top, bottom):
        for x in range(w):
            r, g, b, a = px[x, y]
            if is_leather(r, g, b, a):
                mp[x, y] = 255
                count += 1
    if count < 500:
        print(f"only {count} leather pixels found — the band or the threshold is wrong", file=sys.stderr)
        return 1

    # ERODE, then soften. Without the erode, the blur pushes partial alpha out
    # over the anti-aliased pixels BETWEEN the strap and the fur — which then
    # get rehued and read as a dotted red fringe tracing the whole collar. The
    # recoloured area has to stay strictly inside the leather.
    mask = mask.filter(ImageFilter.MinFilter(3))
    mask = mask.filter(ImageFilter.GaussianBlur(0.7))
    # Rebind: `filter` returns a NEW image, so the old pixel accessor still
    # pointed at the unfiltered mask and neither of those lines did anything.
    mp = mask.load()

    os.makedirs(OUT_DIR, exist_ok=True)
    for name, hex_colour in COLLARS.items():
        target = tuple(int(hex_colour[i : i + 2], 16) for i in (1, 3, 5))
        out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        op = out.load()
        for y in range(top, bottom):
            for x in range(w):
                m = mp[x, y]
                if m == 0:
                    continue
                r, g, b, _ = px[x, y]
                nr, ng, nb = rehue(r, g, b, target)
                op[x, y] = (nr, ng, nb, m)
        path = os.path.join(OUT_DIR, f"front_{name}.png")
        out.save(path)
        print(f"wrote {os.path.relpath(path, APP)}  ({count} px)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
