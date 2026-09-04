#!/usr/bin/env python3
"""Builds raw/IMG_SETTLE1.MOV -- the `settle` beat's plate. Run from repo
root:

    python3 ai/settle/build_settle_plate.py

Same v29 change as ai/dak/build_dak_plate.py, same reasoning: ChatGPT's
settler_family_chatgpt.jpg bakes the family AND a Falls-Park-like
background into one flat photograph rather than a transparent cutout, so
`settle` moves from a figure-composited-onto-real-footage beat to a fully
generated PLATE, exactly like `ice`. See build_dak_plate.py's docstring
for the full reasoning; it applies here unchanged.
"""
import os
import subprocess

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(os.path.dirname(_HERE))
RAW = os.path.join(_ROOT, "raw")

SRC = os.path.join(_HERE, "settler_family_chatgpt.jpg")
DST = os.path.join(RAW, "IMG_SETTLE1.MOV")


def build(dur=3.8, fps=30):
    n = int(dur * fps)
    vf = (f"scale=2688:1512:flags=lanczos,"
          f"zoompan=z='min(1.0+0.0035*on,1.045)':d={n}:x='iw/2-(iw/zoom/2)':"
          f"y='ih/2-(ih/zoom/2)':s=1920x1080:fps={fps}")
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-loop", "1", "-i", SRC, "-t", str(dur),
         "-vf", vf, "-r", str(fps), "-pix_fmt", "yuv420p", DST], check=True)
    print(f"  wrote {DST} ({dur}s, slow push-in)")


if __name__ == "__main__":
    build()
