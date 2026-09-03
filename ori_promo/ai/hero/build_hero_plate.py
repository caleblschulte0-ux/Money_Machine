#!/usr/bin/env python3
"""Builds raw/IMG_HERO1.MOV -- the glasses hero-shot plate. Run from the
repo root:

    python3 ai/hero/build_hero_plate.py

WHY THIS BEAT EXISTS. Operator, repeatedly: "I did not see any three d
renderings of the glasses or any cool glasses hero shots." Then, directly:
"Yes get it do stop asking questions." The film never once shows the
product itself -- every beat is either real park footage or a historical
era. This is the one shot that is neither: a still of the glasses,
inserted right after the `prod` line ("we build what runs on them") so the
line has something to land on.

THE FACE PROBLEM. Every earlier attempt at this (ai/gen_glasses.py, three
different studio-product-photo prompt styles, 9 generations) came back as
a portrait of a woman wearing glasses despite an explicit "no person, no
face" instruction -- the free pollinations/flux model appears to key hard
off the word "glasses" toward its portrait training data no matter how the
prompt is qualified. The fix was not a better negative prompt, it was a
different CAMERA ANGLE: a flat-lay / top-down product shot structurally
has nowhere for a face to fit. glasses_hero_s12.png is the result -- a
plain, unbranded frame on a cloth pad, phone-corner visible in the
background for tech context, no person anywhere in frame.

WHY THE FRAME LOOKS LIKE ORDINARY EYEWEAR, NOT A SCI-FI VISOR. That is
deliberate, not a shortfall of the generator. Open Range Interactive does
not design the hardware (see one/vo_one.py's `prod` line) -- it licenses
software onto glasses sourced from somewhere else, the same way a real
consumer AR product (Ray-Ban Meta, etc.) looks like ordinary glasses from
the outside. A distinctive sci-fi frame would have invented a hardware
design this company does not have.

Same discipline as every other generated plate here: not hand-edited, a
committed source PNG plus a script that reproducibly turns it into the
clip the renderer reads, and it carries the same VISUALISATION label
every other generated image in this film does.
"""
import os
import subprocess

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(os.path.dirname(_HERE))
RAW = os.path.join(_ROOT, "raw")

SRC = os.path.join(_HERE, "glasses_hero_s12.png")
DST = os.path.join(RAW, "IMG_HERO1.MOV")


def build(dur=2.5, fps=30):
    # 1024x576 source -> 1920x1080 with a slow 1.0 -> 1.045 push, same
    # zoompan pattern as ai/map/build_map_plate.py and
    # ai/ice/build_ice_plate.py: lanczos upscale first so the zoom does not
    # compound the resampling softness, subtle enough over 2.5s that the
    # label (fixed screen-space, not tracked to content beyond the anchor
    # point) does not visibly drift off its mark.
    n = int(dur * fps)
    vf = (f"scale=2688:1512:flags=lanczos,"
          f"zoompan=z='min(1.0+0.006*on,1.045)':d={n}:x='iw/2-(iw/zoom/2)':"
          f"y='ih/2-(ih/zoom/2)':s=1920x1080:fps={fps}")
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-loop", "1", "-i", SRC, "-t", str(dur),
         "-vf", vf, "-r", str(fps), "-pix_fmt", "yuv420p", DST], check=True)
    print(f"  wrote {DST} ({dur}s, slow push-in)")


if __name__ == "__main__":
    build()
