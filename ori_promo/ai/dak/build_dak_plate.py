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

HEADROOM FIX, v33 (r148, ChatGPT's review of the v33 delivery: both
adults cropped at the top of frame, 0:26-0:30). The root cause is NOT a
zoompan bug -- a first read of it that way was wrong, and cost real time
chasing it (see git history on this file for the dead ends: a top-anchored
crop, then a static zoom=1.0 hold, neither one touched the actual problem
because neither one is it). Measured properly with reference gridlines
drawn on dak_family_chatgpt.jpg itself: the man's and woman's head-tops
sit at ~8% of the source's own frame height, and their EYES sit right at
~12-13% -- almost exactly where filmlook.py's standing 2.39:1 scope crop
draws its fixed top line (12.8% of frame height, every beat, not
something to special-case away). The image was simply framed tighter than
this film's letterbox can carry, at ANY zoom level including 1.0 -- the
earlier "frame 0 looks clean" read was a judgment call made without a
precise reference line, and it was wrong.

THE FIX: dak_family_chatgpt_padded.jpg, built by build_padded_source()
below FROM dak_family_chatgpt.jpg (the original ChatGPT asset stays
untouched and is still the one committed as the source of record) --
shrinks the whole photo to 80% and centers it (nudged 6% further down)
over a heavily gaussian-blurred copy of the same photo filling the full
canvas behind it. That moves the head-top to ~24% of frame height, clear
of the 12.8% line with real margin, without inventing new content:
every pixel in the padded canvas comes from this same photo, just blurred
for the border. The border reads as a soft vignette, not a seam, and this
beat's static hold (no zoom) means it never has to survive being pushed
in on, which is the one thing that would have made a soft border obvious.
Verified against the actual render output, not just the source image --
see the commit this shipped in for the checked frames.
"""
import os
import subprocess

from PIL import Image, ImageFilter

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(os.path.dirname(_HERE))
RAW = os.path.join(_ROOT, "raw")

SRC_ORIG = os.path.join(_HERE, "dak_family_chatgpt.jpg")
SRC = os.path.join(_HERE, "dak_family_chatgpt_padded.jpg")
DST = os.path.join(RAW, "IMG_DAK1.MOV")


def build_padded_source(shrink=0.80, down_bias=0.06, blur=40):
    im = Image.open(SRC_ORIG).convert("RGB")
    w, h = im.size
    small = im.resize((int(w * shrink), int(h * shrink)), Image.LANCZOS)
    sw, sh = small.size
    bg = im.resize((w, h), Image.LANCZOS).filter(ImageFilter.GaussianBlur(blur))
    canvas = bg.copy()
    ox = (w - sw) // 2
    oy = (h - sh) // 2 + int(h * down_bias)
    canvas.paste(small, (ox, oy))
    canvas.save(SRC, quality=92)
    print(f"  wrote {SRC} (shrink={shrink}, head-top now ~24% of frame height)")


def build(dur=8.0, fps=30):
    if not os.path.exists(SRC):
        build_padded_source()
    n = int(dur * fps)
    cap = 1.0  # static hold -- a push-in would carry the soft border into view, see header
    rate = (cap - 1.0) / (n * 0.5)  # 0.0 -- zoom stays exactly 1.0 for the whole plate
    vf = (f"scale=2688:1512:flags=lanczos,"
          f"zoompan=z='min(1.0+{rate}*on,{cap})':d={n}:x='iw/2-(iw/zoom/2)':"
          f"y='ih/2-(ih/zoom/2)':s=1920x1080:fps={fps}")
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-loop", "1", "-i", SRC, "-t", str(dur),
         "-vf", vf, "-r", str(fps), "-pix_fmt", "yuv420p", DST], check=True)
    print(f"  wrote {DST} ({dur}s, static hold, no push-in)")


if __name__ == "__main__":
    build()
