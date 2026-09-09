#!/usr/bin/env python3
"""Builds raw/IMG_TABLE1.MOV -- the 12-angle version of the `table` beat's
plate. Run from the repo root:

    python3 ai/table/build_table_turntable12.py

SUPERSEDES build_table_turntable.py's 4-angle wipe version (r153), the
same day it shipped an approved ghost-free cut. Not deleted -- kept per
this repo's own convention of leaving superseded versions on disk with
an honest header explaining why. That version's own docstring named its
remaining limitation directly: "a directional wipe between real
photographs... reads as discrete product photos rather than continuous
rotation. This remains the clearest editable blocker" (r157's phrasing,
confirmed again unchanged in r160's review of r159).

r160 (ChatGPT) delivered 8 new intermediate angles at 30-degree
increments (30/60/120/150/210/240/300/330) to bridge the four r146
anchors (a=0, b=90, c=180, d=270), completing a full 12-sample,
30-degree-step rotation.

NORMALIZATION CHECK (r160 required this before sequencing -- "normalize
crop, scale, pedestal horizon, and optical center... do not let the
camera appear to jump merely because the source framing differs").
Checked directly, not assumed: gridded reference overlays on all 12
full-resolution frames (Harris-corner auto-detection was tried first and
rejected -- it locks onto the glasses' own high-contrast edges, not the
low-contrast lit pedestal corner, and returned inconsistent noise).
Visual measurement of the pedestal's front corner across a0, 30, 60, b90,
120, 150, c180, 210, 240, 300, 330 placed it consistently within about
+/-20px of (800, 590) at this 1672x941 source size -- effectively the
same camera and pedestal for 11 of the 12 samples, exactly the case
build_table_turntable.py's own header already established ("1672x941
sources... scale cleanly to 1920x1080 with no crop needed"). No new
per-image crop was needed or added for those 11.

d270 (glasses_turn_d_chatgpt.jpg, the approved r146 "front/top" anchor)
is the one genuine outlier: a materially different, more overhead camera
angle, with the pedestal barely visible low in frame instead of the
large three-quarter box the other 11 share. This is not a new problem
this script introduces -- it is the same shot that was already part of
the approved 4-angle version, and it scaled with zero crop there too.
Rather than warp or crop d270 to fake a camera match it cannot honestly
have, this cut relies on the same tool that already proved safe at this
exact boundary in the 4-angle version: a hard cut, never a cross-dissolve
or morph, which does not claim continuous motion across the one angle
where the camera genuinely is not continuous. See r161's integration
report for the explicit statement of this on the record.

METHOD: plain sequential concat, HARD CUTS only, no xfade anywhere --
per r160's explicit instruction ("short sequential holds or clean cuts
at a consistent cadence. Do not morph, optical-flow, or cross-dissolve
distant geometry"). 12 images x 15 frames (0.5s @ 30fps) = 180 frames =
6.0s exactly, matching spec_one.py's `table` beat duration with no
remainder to fudge.

Does NOT repeat the first anchor (a/0-deg) at the end. ChatGPT's own
r160__chatgpt__glasses_turn_sequence_contact.png reference sheet ends by
repeating `a` to visually close the loop on a static print layout; that
has no equivalent value in a 6-second timed video that already completes
a full 0-330-degree, 12-sample rotation and then hard-cuts to the next
beat (`walk`) -- repeating the first frame would just be a second static
hold of an angle already shown, not new information. Documented here so
this is a stated choice, not a missed instruction.
"""
import os
import subprocess

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(os.path.dirname(_HERE))
RAW = os.path.join(_ROOT, "raw")

IMAGES = [
    os.path.join(_HERE, "glasses_turn_a_chatgpt.jpg"),      # 0
    os.path.join(_HERE, "glasses_turn_30_chatgpt.jpg"),      # 30
    os.path.join(_HERE, "glasses_turn_60_chatgpt.jpg"),      # 60
    os.path.join(_HERE, "glasses_turn_b_chatgpt.jpg"),       # 90
    os.path.join(_HERE, "glasses_turn_120_chatgpt.jpg"),     # 120
    os.path.join(_HERE, "glasses_turn_150_chatgpt.jpg"),     # 150
    os.path.join(_HERE, "glasses_turn_c_chatgpt.jpg"),       # 180
    os.path.join(_HERE, "glasses_turn_210_chatgpt.jpg"),     # 210
    os.path.join(_HERE, "glasses_turn_240_chatgpt.jpg"),     # 240
    os.path.join(_HERE, "glasses_turn_d_chatgpt.jpg"),       # 270
    os.path.join(_HERE, "glasses_turn_300_chatgpt.jpg"),     # 300
    os.path.join(_HERE, "glasses_turn_330_chatgpt.jpg"),     # 330
]
DST = os.path.join(RAW, "IMG_TABLE1.MOV")


def build(dur=6.0, fps=30):
    n_img = len(IMAGES)
    n = int(round(dur * fps))
    assert n % n_img == 0, f"{n} frames does not divide evenly across {n_img} images"
    hold = n // n_img  # frames per angle -- 15 at the current 6.0s/12/30fps

    cmd = ["ffmpeg", "-y", "-v", "error"]
    for img in IMAGES:
        cmd += ["-loop", "1", "-t", f"{hold / fps:.4f}", "-i", img]

    # Straight concat -- no xfade, no crossfade, no morph. Each input is
    # scaled to the shared canvas and trimmed to an exact frame count so
    # concat's output duration is exact, not approximate.
    filt = [
        f"[{i}:v]scale=1920:1080,fps={fps},trim=start_frame=0:end_frame={hold},setpts=PTS-STARTPTS[s{i}]"
        for i in range(n_img)
    ]
    concat_inputs = "".join(f"[s{i}]" for i in range(n_img))
    filt.append(f"{concat_inputs}concat=n={n_img}:v=1:a=0[vout]")

    cmd += ["-filter_complex", ";".join(filt), "-map", "[vout]",
            "-r", str(fps), "-pix_fmt", "yuv420p", DST]
    subprocess.run(cmd, check=True)
    print(f"  wrote {DST} ({dur}s, {n_img}-angle turntable, hard cuts every {hold/fps:.2f}s)")


if __name__ == "__main__":
    build()
