#!/usr/bin/env python3
"""Builds raw/IMG_ICE1.MOV -- the ice-age wide plate. Run from repo root:

    python3 ai/ice/build_ice_plate.py

WHY THE WIDE ICE BEAT IS A GENERATED PLATE NOW, v22.

OPERATOR on v21: "you did not fix the ice age at all. It still looks like
shit." Correct, and the cause was structural rather than a tuning miss.
Every previous version of the `ice` beat was the SUMMER plate wearing a
procedural cold grade (desaturate, push blue, key snow onto flat lit
surfaces, fog the distance -- see render_one.ice_grade). That treatment
can make a summer photograph look COLD. It cannot make it look like an ICE
AGE, because what is underneath is still a mown lawn, a car park, full
deciduous canopy and running water. The operator has stood at Falls Park
in winter; he is comparing it against the real thing and it does not hold.

So the wide beat now uses a generated ice-age valley, labelled
VISUALISATION exactly like every other generated image in this film, and
never presented as documentary footage of the park.

WHAT IS *NOT* CHANGING, deliberately. `mam` and `now` -- the two beats
that carry the wearer and the mammoth -- keep the REAL Falls Park plate
with the procedural ice grade. That is the whole point of the film: the
wearer is standing in the actual place, and the past arrives around him.
Replacing those with a generated valley would break the one claim the
film is built on. The generated plate is the wide "the whole valley
freezes" establishing shot only; the moment the wearer is on screen, the
ground under him is the real ground.

MOTION. The source is a still, and a four-second locked still in the
middle of a film reads as a stall. A slow push-in gives it life, and the
renderer's snowfall pass (see GEN_ICE in render_one.py) puts weather in
front of it. The label's anchor is optical-flow tracked like every other
label, so it rides the push-in without extra work.
"""
import os
import subprocess

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(os.path.dirname(_HERE))
RAW = os.path.join(_ROOT, "raw")

# iceage_wide2_s11: of the six generated, the only one in a believable
# NEUTRAL palette (the wide3 pair came back pink/violet, and wide_s3 teal)
# and the only one whose landform -- a broad valley of snow-covered rock
# shelves with a frozen cascade at the back -- resembles the real place
# rather than an alpine canyon.
SRC = os.path.join(_HERE, "iceage_wide2_s11.png")
DST = os.path.join(RAW, "IMG_ICE1.MOV")


def build(dur=7.0, fps=30):
    # 1024x576 source -> 1920x1080 with a slow 1.0 -> 1.06 push. lanczos on
    # the upscale, then zoompan on the already-upscaled frame so the zoom
    # does not compound the resampling softness.
    n = int(dur * fps)
    vf = (f"scale=2688:1512:flags=lanczos,"
          f"zoompan=z='min(1.0+0.00055*on,1.06)':d={n}:x='iw/2-(iw/zoom/2)':"
          f"y='ih/2-(ih/zoom/2)':s=1920x1080:fps={fps}")
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-loop", "1", "-i", SRC, "-t", str(dur),
         "-vf", vf, "-r", str(fps), "-pix_fmt", "yuv420p", DST], check=True)
    print(f"  wrote {DST} ({dur}s, slow push-in)")


if __name__ == "__main__":
    build()
