#!/usr/bin/env python3
"""Builds raw/IMG_TABLE1.MOV -- the REAL turntable version of the `table`
beat's plate. Run from the repo root:

    python3 ai/table/build_table_turntable.py

SUPERSEDES build_table_plate.py's single-image push+drift, the same day
it was written. That script's own header explained why: faking a 3D spin
out of ONE flat image would look exactly like what it is, which fails the
operator's explicit standard ("the more obviously real the overlays
look, the better"). r145 asked ChatGPT for genuine turntable angles for
exactly this reason; r146 delivered four, same pedestal, same lighting,
same design (glasses_turn_a.png front three-quarter, _b.png right
profile, _c.png rear three-quarter, _d.png front/top) -- so this builds
the real thing instead.

METHOD: four ffmpeg xfade dissolves chained in sequence (a -> b -> c ->
d), not a synthesized rotation -- there is no 3D model here, only four
real generated angles, so a cross-dissolve between them is the honest
way to suggest a turn without claiming a smoothness the source doesn't
have. 1672x941 sources (all four identical) scale cleanly to 1920x1080
with no crop needed -- already ~16:9.

TIMING: 4 images, 0.5s crossfade each of the 3 transitions, total beat
duration `dur` (default 6.0, matches spec_one.py's `table` beat). Solving
clip_dur*4 - transition*3 = dur for clip_dur so the math is exact rather
than approximate.
"""
import os
import subprocess

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(os.path.dirname(_HERE))
RAW = os.path.join(_ROOT, "raw")

IMAGES = [
    os.path.join(_HERE, "glasses_turn_a_chatgpt.jpg"),
    os.path.join(_HERE, "glasses_turn_b_chatgpt.jpg"),
    os.path.join(_HERE, "glasses_turn_c_chatgpt.jpg"),
    os.path.join(_HERE, "glasses_turn_d_chatgpt.jpg"),
]
DST = os.path.join(RAW, "IMG_TABLE1.MOV")

# JPEG q90, not the PNG ChatGPT delivered (r146) -- same 256KB storage-rule
# reason as ai/mam/build_mam_plate.py's own note. q90 was enough here (all
# four landed 136-181KB) without dropping to q60 the way the mammoth plate
# needed; these are flatter studio-lit product shots with less to compress.


def build(dur=6.0, fps=30, transition=0.5):
    n_img = len(IMAGES)
    clip_dur = (dur + (n_img - 1) * transition) / n_img

    cmd = ["ffmpeg", "-y", "-v", "error"]
    for img in IMAGES:
        cmd += ["-loop", "1", "-t", f"{clip_dur:.4f}", "-i", img]

    # Each input: scale to a shared canvas + fixed fps, required before xfade
    # (it needs constant, matching frame rate/size on every input stream).
    filt = [f"[{i}:v]scale=1920:1080,fps={fps},format=yuv420p[s{i}]" for i in range(n_img)]
    chain = "s0"
    off = clip_dur - transition
    for i in range(1, n_img):
        outlab = f"x{i}" if i < n_img - 1 else "vout"
        filt.append(f"[{chain}][s{i}]xfade=transition=fade:duration={transition}:offset={off:.4f}[{outlab}]")
        chain = outlab
        off += clip_dur - transition

    filter_complex = ";".join(filt)
    cmd += ["-filter_complex", filter_complex, "-map", "[vout]",
            "-t", str(dur), "-r", str(fps), "-pix_fmt", "yuv420p", DST]
    subprocess.run(cmd, check=True)
    print(f"  wrote {DST} ({dur}s, {n_img}-angle real turntable cross-dissolve)")


if __name__ == "__main__":
    build()
