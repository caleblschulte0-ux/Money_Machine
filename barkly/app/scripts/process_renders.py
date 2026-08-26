#!/usr/bin/env python3
"""Process raw generated Barkly state renders into app-ready assets.

Usage: python3 scripts/process_renders.py <raw_dir>

For each PNG in <raw_dir>: remove the background (rembg), trim to content,
scale to a consistent character height, and write to
assets/barkly/renders/states/<name>.png. Prints a POSE_SIZE snippet for
BarklyPhotoView.tsx.

Dev-time tool; requires `pip install rembg pillow`.
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image
from rembg import remove

APP = Path(__file__).resolve().parent.parent
OUT = APP / "assets" / "barkly" / "renders" / "states"
TARGET_H = 620  # match the existing full-body cuts' scale ballpark


def main() -> int:
    raw_dir = Path(sys.argv[1])
    OUT.mkdir(parents=True, exist_ok=True)
    sizes = {}
    for p in sorted(raw_dir.glob("*.png")):
        im = Image.open(p)
        cut = remove(im)
        bbox = cut.getbbox()
        if bbox:
            l, t, r, b = bbox
            m = 6
            cut = cut.crop((max(0, l - m), max(0, t - m), min(cut.width, r + m), min(cut.height, b + m)))
        if cut.height > TARGET_H:
            ratio = TARGET_H / cut.height
            cut = cut.resize((int(cut.width * ratio), TARGET_H), Image.LANCZOS)
        dest = OUT / p.name
        cut.save(dest, optimize=True)
        sizes[p.stem] = cut.size
        print(f"{p.name}: {cut.size}, {dest.stat().st_size // 1024} KB")

    print("\n// POSE_SIZE entries (display at 40% of asset px):")
    for name, (w, h) in sizes.items():
        print(f"  {name}: {{ width: {round(w * 0.4)}, height: {round(h * 0.4)} }},")
    return 0


if __name__ == "__main__":
    sys.exit(main())
