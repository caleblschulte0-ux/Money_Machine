#!/usr/bin/env python3
"""Is Barkly still the loudest thing in his own game?

THE TARGET THIS REPLACES. `docs/ART_DIRECTION.md` asked for `mean_sat` between
0.42 and 0.55. The world hit it -- the park plate measured 0.455 -- and the
operator rejected the result four times running ("hurts my eyes", "weak",
"weird", "I don't like any of them"). A mean cannot see the thing that was
broken: the park was 64.4% of one frame inside a single 0.10-wide saturation
band with 0.2% above 0.60. Not a loud world, a UNIFORM one, every shape
competing at the same volume -- and the only way to raise a mean that is
already mid is to push the middle harder, which is what each pass did.

WHAT IS MEASURED INSTEAD comes from the approved concept sheet, which states
the direction in words on its own face: a collectible toy, bold silhouette,
made to stand out on any shelf, over exactly three swatches. That is a
hierarchy claim, so these are hierarchy metrics.

  peak_sat_band  the biggest share of a frame inside one 0.10 saturation band.
                 A frame with no quiet parts has no loud parts.
  chroma_gap     Barkly's mean saturation minus the ground he stands on. This
                 is "stands out on any shelf" as a number, and it was +0.032 --
                 he was exactly as loud as his own background.
  dark_frac      pixels under value 0.20. The world had 0.0% of them.
  shadow_warm    share of the darkest 15% at a warm hue. The concept sheet is
                 98.4% warm and Barkly is 99.8%; the park was 4.4%, because the
                 fill lamp was painting every shadow in the game sky-blue.

    python3 scripts/art-hierarchy.py            # report
    python3 scripts/art-hierarchy.py --check    # non-zero if a floor is missed
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DOG = ROOT / "assets/barkly/renders/front.png"
PLATES = ROOT / "assets/world/scenes"

FLOORS = {
    "peak_sat_band": ("max", 45.0),   # percent of frame in one band
    "chroma_gap": ("min", 0.18),
    "dark_frac": ("min", 1.0),        # percent under value 0.20
    "shadow_warm": ("min", 40.0),     # percent of the darkest 15% that is warm
}


def _px(path, alpha_only=False):
    a = np.asarray(Image.open(path).convert("RGBA")).astype(np.float32) / 255.0
    rgb, al = a[..., :3], a[..., 3]
    keep = al > 0.5 if (alpha_only or al.min() <= 0.99) else np.ones_like(al, bool)
    return rgb[keep]


def _sat(px):
    mx, mn = px.max(1), px.min(1)
    return np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0.0)


def _hue(px):
    mx, mn = px.max(1), px.min(1)
    d = np.maximum(mx - mn, 1e-6)
    r, g, b = px[:, 0], px[:, 1], px[:, 2]
    h = np.where(mx == r, (g - b) / d % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4))
    return (h * 60.0) % 360.0


def measure(plate: Path, dog_px):
    px = _px(plate)
    sat, val = _sat(px), px.max(1)
    bands, _ = np.histogram(sat, bins=np.arange(0, 1.01, 0.10))
    dark = px[val < np.quantile(val, 0.15)]
    hs = _hue(dark)
    return {
        "peak_sat_band": 100.0 * bands.max() / bands.sum(),
        "chroma_gap": float(_sat(dog_px).mean() - sat.mean()),
        "dark_frac": 100.0 * float((val < 0.20).mean()),
        "shadow_warm": 100.0 * float(((hs < 70) | (hs > 330)).mean()),
    }


def main() -> int:
    check = "--check" in sys.argv
    dog_px = _px(DOG, alpha_only=True)
    plates = sorted(p for p in PLATES.glob("*.png"))
    if not plates:
        print("no scene plates -- run scripts/render-world.sh")
        return 1
    print(f"{'scene':10s} {'peak band':>10s} {'chroma gap':>11s} {'darks':>7s} {'warm shadow':>12s}")
    bad = []
    for plate in plates:
        m = measure(plate, dog_px)
        flags = ""
        for key, (kind, floor) in FLOORS.items():
            miss = m[key] > floor if kind == "max" else m[key] < floor
            if miss:
                flags += f"  {key} {m[key]:.2f} {'>' if kind == 'max' else '<'} {floor}"
                bad.append(f"{plate.stem}: {key} {m[key]:.2f}")
        print(f"{plate.stem:10s} {m['peak_sat_band']:9.1f}% {m['chroma_gap']:+11.3f} "
              f"{m['dark_frac']:6.1f}% {m['shadow_warm']:11.1f}%{flags}")
    if bad and check:
        print("\nBELOW THE FLOOR -- see docs/ART_DIRECTION.md (2026-09-13 amendment):")
        for b in bad:
            print(f"  {b}")
        return 1
    if not bad:
        print("\nevery scene clears the hierarchy floors")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
