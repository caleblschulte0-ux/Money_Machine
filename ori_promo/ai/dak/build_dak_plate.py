#!/usr/bin/env python3
"""Builds raw/IMG_DAK1.MOV -- the `dak` beat's plate. Run from repo root:

    python3 ai/dak/build_dak_plate.py

WHY THIS BEAT CHANGED FROM A COMPOSITE TO A PLATE, v29. Every earlier
version of `dak` (dak_s17.jpg and predecessors) was a transparent cutout
of a figure, composited by ai/place.py onto the REAL IMG_6804 footage --
matte, light-match, cast shadow, occlusion, the works. dak_family_chatgpt.jpg
is a different KIND of asset: ChatGPT generated a complete photograph --
the family AND a Falls Park-like background baked into one flat image,
not a cutout with an alpha channel. Running that through the old
compositing pipeline would mean rembg cutting a person-shaped hole out of
it and pasting that onto the ACTUAL park footage underneath -- two
different generated/real rock textures fighting in one frame, which is
worse than either alone.

So `dak` now works exactly like `ice`: a fully generated PLATE, not a
figure standing on real footage. The wearer beats (`mam`, `now`)
deliberately still use the real ground -- this is the same tradeoff `ice`
already made, and the same rule applies here: the moment the wearer is on
screen, the ground under him is real; the wide/era establishing shots are
allowed to be a generated whole.

Same push-in pattern as every other generated plate here.

DURATION DOUBLED, v31 restart: 4.0s -> 8.0s (the operator's "burn down and
restart, Apple promo video" instruction -- every era beat gets real time
to register instead of a glance). The zoom RATE is now derived from dur,
not hardcoded, so the push-in still covers roughly the first half of the
beat and holds for the second half -- the old fixed rate (0.0035/frame)
would have hit its cap in the first 0.4s of an 8s beat and sat frozen for
the remaining 7.6, which reads as a stuck frame, not a held one.
"""
import os
import subprocess

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(os.path.dirname(_HERE))
RAW = os.path.join(_ROOT, "raw")

SRC = os.path.join(_HERE, "dak_family_chatgpt.jpg")
DST = os.path.join(RAW, "IMG_DAK1.MOV")


def build(dur=8.0, fps=30):
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
