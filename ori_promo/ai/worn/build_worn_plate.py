#!/usr/bin/env python3
"""Builds raw/IMG_WORN1.MOV -- the `worn` beat's plate (spec_one.py, new
r164). Run from the repo root:

    python3 ai/worn/build_worn_plate.py

WHY THIS BEAT EXISTS. r162's operator lead-review pass named it as the
single biggest structural gap: "the product is never shown worn." That
is not fixable in code -- it needs either a reshoot or a new generated
asset, and this session said so plainly rather than faking either.
ChatGPT answered with `product_worn_falls_park_plate` (r163): a
photorealistic photograph of a visitor wearing this film's own glasses
design at this film's own location (Falls Park), sensor panel visible,
matching the established product design exactly.

SAME PLATE PATTERN as ai/dak/build_dak_plate.py and
ai/mam/build_mam_plate.py -- one complete generated photograph, a slow
zoompan push-in (cap=1.06, same rate math), no compositing pipeline
(ai/place.py's matte/light-match/shadow work is for a CUTOUT figure
placed onto separate real footage; this is one whole image, same
tradeoff `dak`/`mam`/`ice` already made). NOT added to spec_one.py's
JITTER_BEATS -- that treatment was reasoned through specifically for
dak/mam's longer, otherwise-dead-still holds; this beat is 1.5s and a
plain push-in is enough motion to avoid reading as a static insert
without reflexively copying a treatment this beat doesn't need.

DISCLOSURE: LABELS["worn"] carries the exact phrase ChatGPT specified
for this asset, "PRODUCT VISUALIZATION" -- not the plain "VISUALIZATION"
every other plate uses, per r163's explicit instruction not to
understate what this is. Drawn as a plain recon_block (no leader line,
no cyan) -- render_one.py's own draw_label() dispatch already keeps
"worn" out of RECOGNITION_LABELS, so this is automatic, not a change
made here.
"""
import os
import subprocess

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(os.path.dirname(_HERE))
RAW = os.path.join(_ROOT, "raw")

SRC = os.path.join(_HERE, "product_worn_falls_park_plate_chatgpt.jpg")
DST = os.path.join(RAW, "IMG_WORN1.MOV")


def build(dur=1.5, fps=30):
    n = int(dur * fps)
    cap = 1.06  # matches ai/dak, ai/mam -- see those files' own safety checks
    rate = (cap - 1.0) / (n * 0.5)  # cap reached at ~50% of the beat
    vf = (f"scale=2688:1512:flags=lanczos,"
          f"zoompan=z='min(1.0+{rate}*on,{cap})':d={n}:x='iw/2-(iw/zoom/2)':"
          f"y='ih/2-(ih/zoom/2)':s=1920x1080:fps={fps}")
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-loop", "1", "-i", SRC, "-t", str(dur),
         "-vf", vf, "-r", str(fps), "-pix_fmt", "yuv420p", DST], check=True)
    print(f"  wrote {DST} ({dur}s, slow push-in)")


if __name__ == "__main__":
    build()
