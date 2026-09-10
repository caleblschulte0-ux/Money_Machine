#!/usr/bin/env python3
"""Builds raw/IMG_TABLE1.MOV -- the `table` beat's plate, v5. Run from
the repo root:

    python3 ai/table/build_table_orbit_hero_v3.py

SUPERSEDES build_table_orbit_hero_v2.py the same day it shipped. All
four earlier versions kept, not deleted, per this repo's convention.

WHY. v2's own order (orbit -> hardware hero -> plain hero hold -> 270
insert) and split (30/45 frames plain hero and 50/40 for the closer)
was this session's own guess at "adjacent to the fast orbit." r164's
review corrected it on two counts: the PLAIN front three-quarter hero
immediately after the fast orbit read too close to the old static-
catalogue problem the orbit was built to escape ("2.833 seconds on one
static product image is too long immediately after a 1.833-second rapid
sweep... restores the static-catalogue feeling"), and gave an EXACT
replacement allocation instead of a general direction. This version
follows it to the frame:

  1. FAST ORBIT (unchanged) -- 11 angles, 270 excluded, 5 frames each.
     40.600-42.433s in the assembled master. 55 frames (1.833s).
  2. PLAIN HERO HOLD -- glasses_turn_a (0 degrees). 42.433-44.100s.
     50 frames (1.667s).
  3. HARDWARE HERO -- active_hardware_hero_plate (r163 asset), NOW AFTER
     the plain hero hold, not immediately after the orbit as v2 had it.
     44.100-45.100s. 30 frames (1.000s), labeled PRODUCT VISUALIZATION
     for its full on-screen duration by the beat's one persistent label
     (spec_one.py's LABELS["table"], already active well before this
     segment begins).
  4. HERO INSERT -- 270-degree overhead, closing the beat.
     45.100-46.600s. 45 frames (1.500s).

Total 55 + 50 + 30 + 45 = 180 frames = 6.0s, matching spec_one.py's
`table` beat duration exactly -- the beat's absolute position in the
master (40.6-46.6s) is UNCHANGED from every version before this one.

Sensor-panel/temple continuity: unchanged from v3's original check (see
build_table_orbit_hero.py's own header for the full reasoning) -- this
version does not alter the orbit angles, their order, or introduce any
new angle; it only reorders and retimes the hero segments that follow.
"""
import os
import subprocess

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(os.path.dirname(_HERE))
RAW = os.path.join(_ROOT, "raw")

ORBIT = [
    os.path.join(_HERE, "glasses_turn_a_chatgpt.jpg"),    # 0
    os.path.join(_HERE, "glasses_turn_30_chatgpt.jpg"),    # 30
    os.path.join(_HERE, "glasses_turn_60_chatgpt.jpg"),    # 60
    os.path.join(_HERE, "glasses_turn_b_chatgpt.jpg"),     # 90
    os.path.join(_HERE, "glasses_turn_120_chatgpt.jpg"),   # 120
    os.path.join(_HERE, "glasses_turn_150_chatgpt.jpg"),   # 150
    os.path.join(_HERE, "glasses_turn_c_chatgpt.jpg"),     # 180
    os.path.join(_HERE, "glasses_turn_210_chatgpt.jpg"),   # 210
    os.path.join(_HERE, "glasses_turn_240_chatgpt.jpg"),   # 240
    os.path.join(_HERE, "glasses_turn_300_chatgpt.jpg"),   # 300
    os.path.join(_HERE, "glasses_turn_330_chatgpt.jpg"),   # 330
]
HERO_HOLD = os.path.join(_HERE, "glasses_turn_a_chatgpt.jpg")   # 0 deg, front 3/4
HARDWARE_HERO = os.path.join(_HERE, "active_hardware_hero_plate_chatgpt.jpg")  # r163
HERO_INSERT = os.path.join(_HERE, "glasses_turn_d_chatgpt.jpg")  # 270 deg overhead
DST = os.path.join(RAW, "IMG_TABLE1.MOV")

ORBIT_FRAME_HOLD = 5      # 0.167s/angle @ 30fps, unchanged from v3
HERO_HOLD_FRAMES = 50     # 1.667s -- r164 exact
HARDWARE_HERO_FRAMES = 30  # 1.000s -- r164 exact
HERO_INSERT_FRAMES = 45   # 1.500s -- r164 exact


def _scaled_input(path, n_frames, fps):
    return ["-loop", "1", "-t", f"{n_frames / fps:.4f}", "-i", path]


def build(fps=30):
    images = ORBIT + [HERO_HOLD, HARDWARE_HERO, HERO_INSERT]
    holds = ([ORBIT_FRAME_HOLD] * len(ORBIT)
             + [HERO_HOLD_FRAMES, HARDWARE_HERO_FRAMES, HERO_INSERT_FRAMES])
    total = sum(holds)

    cmd = ["ffmpeg", "-y", "-v", "error"]
    for img, hold in zip(images, holds):
        cmd += _scaled_input(img, hold, fps)

    filt = [
        f"[{i}:v]scale=1920:1080,fps={fps},trim=start_frame=0:end_frame={h},setpts=PTS-STARTPTS[s{i}]"
        for i, h in enumerate(holds)
    ]
    concat_inputs = "".join(f"[s{i}]" for i in range(len(images)))
    filt.append(f"{concat_inputs}concat=n={len(images)}:v=1:a=0[vout]")

    cmd += ["-filter_complex", ";".join(filt), "-map", "[vout]",
            "-r", str(fps), "-pix_fmt", "yuv420p", DST]
    subprocess.run(cmd, check=True)
    dur = total / fps
    print(f"  wrote {DST} ({dur:.3f}s: {len(ORBIT)}-angle fast orbit "
          f"@{ORBIT_FRAME_HOLD/fps:.3f}s + hero hold {HERO_HOLD_FRAMES/fps:.3f}s "
          f"+ hardware hero {HARDWARE_HERO_FRAMES/fps:.3f}s "
          f"+ hero insert {HERO_INSERT_FRAMES/fps:.3f}s)")


if __name__ == "__main__":
    build()
