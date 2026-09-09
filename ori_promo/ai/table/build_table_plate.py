#!/usr/bin/env python3
"""Builds raw/IMG_TABLE1.MOV -- the new `table` beat's plate. Run from the
repo root:

    python3 ai/table/build_table_plate.py

WHY THIS BEAT EXISTS. Operator, r145/v33: reject v32c outright ("that one
film fucked that, I didn't like how it was looking") and ask by name for
an Apple product-reveal beat -- the glasses come off, then cut to a
dedicated scene, glasses alone, spinning on a table. `hero` (9.0s in) is
a brief glance early in the film, right after the `prod` line -- it was
never meant to carry the full reveal, and never will; this is the second,
later look, positioned right after `off` (glasses come off) where the
narrative actually calls for it.

WHY IT DOES NOT SPIN YET. r145 also went out to ChatGPT asking for 3-4
turntable angles of this exact glasses design (same pedestal, same
lighting, rotated ~30-45 degrees apart) so a real rotation can be built by
cross-fading between genuinely different generated angles -- the only way
to make a spin read as "obviously real" rather than a flat photo faked
into moving, which is the operator's explicit standard here ("the more
obviously real ... the better"). Until those land, faking a 3D turn out
of ONE flat image (a skew/perspective warp) would look exactly like what
it is -- a still image being warped -- which is a worse result than not
spinning at all. So THIS pass gives the beat real screen time and a slow,
confident push+drift instead (the same restraint Apple itself uses on
static product shots), and ai/table/build_table_turntable.py (written the
moment the angles land) replaces this with the real cross-fade sequence.
Same non-destructive pattern as every other upgrade in this project: new
script, new output file, this one stays until it's superseded.

SOURCE: ai/hero/glasses_hero_chatgpt.jpg, the same ChatGPT-generated asset
`hero` already uses -- same object, same design, so the film shows one
consistent product, not two different-looking pairs of glasses.
"""
import os
import subprocess

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(os.path.dirname(_HERE))
RAW = os.path.join(_ROOT, "raw")

SRC = os.path.join(_ROOT, "ai", "hero", "glasses_hero_chatgpt.jpg")
DST = os.path.join(RAW, "IMG_TABLE1.MOV")


def build(dur=6.0, fps=30):
    # Slower, longer push than `hero`'s (cap 1.045 over 4.0s there; 1.09
    # over 6.0s here) plus a slight horizontal drift, so the two beats
    # read as "a glance" and "the full reveal" rather than the same move
    # held twice. Same lanczos-upscale-first pattern as build_hero_plate.py
    # so the push doesn't compound resampling softness on a source this
    # size.
    n = int(dur * fps)
    cap = 1.09
    rate = (cap - 1.0) / (n * 0.5)
    drift = 26  # total px of horizontal drift across the full duration
    vf = (f"scale=2688:1512:flags=lanczos,"
          f"zoompan=z='min(1.0+{rate}*on,{cap})':d={n}:"
          f"x='iw/2-(iw/zoom/2)+{drift}*(on/{n})':"
          f"y='ih/2-(ih/zoom/2)':s=1920x1080:fps={fps}")
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-loop", "1", "-i", SRC, "-t", str(dur),
         "-vf", vf, "-r", str(fps), "-pix_fmt", "yuv420p", DST], check=True)
    print(f"  wrote {DST} ({dur}s, slow push+drift -- pre-turntable pass)")


if __name__ == "__main__":
    build()
