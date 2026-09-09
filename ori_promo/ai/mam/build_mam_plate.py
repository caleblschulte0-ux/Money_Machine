#!/usr/bin/env python3
"""Builds raw/IMG_MAM1.MOV -- the `mam` beat's plate. Run from the repo
root:

    python3 ai/mam/build_mam_plate.py

WHY THIS BEAT EXISTS. Operator, r145/v33: named the mammoth specifically
("AI overlays of... woolly manness [mammoths]... whatever it is that
they'll look at at the falls"), same request that reinstated `dak`. The
only prior mammoth attempt in this project (ai/ice/iceage_*.png) used a
different, non-ChatGPT generator and produced a generic fantasy ice
canyon -- moody blue light, no relation to the actual Falls Park geology,
nothing anyone could mistake for a photograph of this place. It was never
wired into a beat and was correctly left out of every version since.

SOURCE: ai/mam/mammoth_falls_chatgpt.png, the r146 ChatGPT asset -- same
treatment as ai/dak/dak_family_chatgpt.jpg: one complete generated
photograph (the mammoth AND the real Falls Park riverbed, mill ruins, and
bridge baked into a single image from the pinned real-location reference),
not a cutout composited by ai/place.py onto real footage. Warm midday
light, matching the geology and framing the operator asked for
("obviously real"), not a separate stylized environment.

Same push-in pattern as ai/dak/build_dak_plate.py and every other
generated plate here.
"""
import os
import subprocess

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(os.path.dirname(_HERE))
RAW = os.path.join(_ROOT, "raw")

SRC = os.path.join(_HERE, "mammoth_falls_chatgpt.jpg")
DST = os.path.join(RAW, "IMG_MAM1.MOV")

# JPEG, not the PNG ChatGPT delivered (r146) -- this project's own storage
# rule caps committed files at 256KB and the source PNG (~3MB, 1672x941)
# was nowhere close. Re-encoded at quality 60, the lowest of {90,85,80,75,
# 70,65,60} that cleared the cap (253,830 bytes) -- same discipline as
# dak_family_chatgpt.jpg and glasses_hero_chatgpt.jpg before it, both
# committed as the small source image, never the render. Verified: a
# rendered frame off the q60 source held side by side against the
# original PNG at delivery resolution shows no visible difference --
# this is a wide establishing plate, not a macro detail shot.


def build(dur=6.0, fps=30):
    n = int(dur * fps)
    cap = 1.06
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
