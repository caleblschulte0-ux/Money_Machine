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

HEADROOM BUG, v33 (r148, ChatGPT's review: both adults cropped at the top
of frame, 0:26-0:30). Root cause, found the hard way after two dead ends
(a top-anchored crop, then a static zoom=1.0 hold -- neither touched it,
history kept in earlier revisions of this file): dak_family_chatgpt.jpg's
own composition put both adults' eyes at ~12-13% of its frame height,
almost exactly where filmlook.py's standing 2.39:1 scope crop draws its
fixed top line (12.8%, every beat, any zoom including none). The photo
was framed tighter than this film's letterbox can carry, full stop.

FIRST FIX (r149, superseded): dak_family_chatgpt_padded.jpg -- shrink the
original 80% and center it over a blurred copy of itself to buy back
headroom. It worked, but the operator called it out directly ("that video
looks like shit") and named the visible border as one of the specifics.
It was always a stopgap, said so in its own header, and is gone now.

REAL FIX (r152): dak_family_v2_chatgpt.jpg, a clean ChatGPT regeneration
-- same three people, same location, reframed wider from the start so
there's no border to hide. Verified independently before this shipped,
not just taken on ChatGPT's word: reference gridlines drawn on the actual
file put both adults' head-tops at ~27-30% of frame height, comfortably
clear of the 12.8% line, with full bodies and feet inside the frame. No
inset, no seam, no synthesized content -- one photograph.

PUSH-IN RESTORED (operator: still marking "the AI overlays don't look
real/premium enough" as a live problem after the crop and border were
both fixed). A static hold next to `mam`'s slow push-in and every real
handheld beat's own camera motion made `dak` the one moment in the film
that visibly doesn't move -- which reads as "obviously a still image
being shown to you," working against realism rather than for it. Same
cap=1.06 as `mam`, verified safe against the NEW plate's real headroom
margin before shipping: at max zoom the crop removes ~2.83% off the top,
and dak_family_v2_chatgpt.jpg's head-top sits at ~27-30% -- miles clear
of both the 12.8% letterbox line and the push-in's own crop, unlike the
original asset this would have been unsafe on.
"""
import os
import subprocess

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(os.path.dirname(_HERE))
RAW = os.path.join(_ROOT, "raw")

SRC = os.path.join(_HERE, "dak_family_v2_chatgpt.jpg")
DST = os.path.join(RAW, "IMG_DAK1.MOV")


def build(dur=8.0, fps=30):
    n = int(dur * fps)
    cap = 1.06  # matches ai/mam/build_mam_plate.py -- see file header for the safety check
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
