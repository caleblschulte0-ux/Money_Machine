#!/usr/bin/env python3
"""Builds raw/IMG_TABLE1.MOV -- the `table` beat's plate, v4. Run from
the repo root:

    python3 ai/table/build_table_orbit_hero_v2.py

SUPERSEDES build_table_orbit_hero.py (v3, fast orbit + 2-hold structure)
the same day it shipped. All three earlier versions kept, not deleted,
per this repo's convention.

WHY. ChatGPT's r163 asset round delivered `active_hardware_hero_plate`
-- the same glasses design, same studio pedestal, but with a restrained
white status light and a faint internal lens reflection: a credible
"this is active smart hardware" cue that v3's plain orbit + hero-hold-
on-`a` never had. r163's exact instruction: use it as a short 0.8-1.2s
hero hold, "adjacent to the fast orbit," taking the time from static
hero holds, NOT from the 0.18s orbit cadence.

STRUCTURE, all hard cuts, zero morphing (unchanged principle from v3):

  1. FAST ORBIT (unchanged from v3) -- 11 angles, 270 excluded,
     ORBIT_FRAME_HOLD each. 11 x 5 = 55 frames (1.833s).
  2. HARDWARE HERO -- the NEW active_hardware_hero_plate, immediately
     after the orbit ("adjacent to" it, per r163). 30 frames (1.0s) --
     inside the requested 0.8-1.2s window.
  3. HERO HOLD -- glasses_turn_a (0 degrees, the plain front three-
     quarter), now SHORTENED to make room for #2, not removed --
     r162's "restrained hero holds on the strongest front three-quarter
     ... views" still stands, it just isn't the only hero moment
     anymore. 45 frames (1.5s).
  4. HERO INSERT -- the 270-degree overhead view, closing the beat, hard
     cut in and out, still not folded into the orbit (r162's finding
     that 270 is a genuine camera-position discontinuity is unchanged
     by this round). 50 frames (1.667s) -- slightly MORE than v3's
     1.333s, since it is still the beat's closing button and deserves
     at least as much weight as before.

Total 55 + 30 + 45 + 50 = 180 frames = 6.0s, matching spec_one.py's
`table` beat duration exactly, no remainder.

DISCLOSURE: every frame in this beat is generated. LABELS["table"]
(spec_one.py) was upgraded this round from "VISUALIZATION" to the exact
phrase ChatGPT specified for the new plate, "PRODUCT VISUALIZATION" --
one persistent label already covers the whole beat, so the wording
needs to be true for its entire run, and this is at least as accurate
for the studio orbit renders as the wording it replaces.

Sensor-panel/temple continuity: unchanged from v3's check (see that
file's own header for the full reasoning) -- this version does not
alter the orbit angles or their order, only redistributes the
hero-hold time that follows them.
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
HARDWARE_HERO = os.path.join(_HERE, "active_hardware_hero_plate_chatgpt.jpg")  # NEW r164
HERO_HOLD = os.path.join(_HERE, "glasses_turn_a_chatgpt.jpg")   # 0 deg, front 3/4
HERO_INSERT = os.path.join(_HERE, "glasses_turn_d_chatgpt.jpg")  # 270 deg overhead
DST = os.path.join(RAW, "IMG_TABLE1.MOV")

ORBIT_FRAME_HOLD = 5      # 0.167s/angle @ 30fps, unchanged from v3
HARDWARE_HERO_FRAMES = 30  # 1.0s -- inside r163's 0.8-1.2s window
HERO_HOLD_FRAMES = 45     # 1.5s -- shortened from v3's 85 to make room
HERO_INSERT_FRAMES = 50   # 1.667s -- slightly more than v3's 40


def _scaled_input(path, n_frames, fps):
    return ["-loop", "1", "-t", f"{n_frames / fps:.4f}", "-i", path]


def build(fps=30):
    images = ORBIT + [HARDWARE_HERO, HERO_HOLD, HERO_INSERT]
    holds = ([ORBIT_FRAME_HOLD] * len(ORBIT)
             + [HARDWARE_HERO_FRAMES, HERO_HOLD_FRAMES, HERO_INSERT_FRAMES])
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
          f"@{ORBIT_FRAME_HOLD/fps:.3f}s + hardware hero "
          f"{HARDWARE_HERO_FRAMES/fps:.3f}s + hero hold {HERO_HOLD_FRAMES/fps:.3f}s "
          f"+ hero insert {HERO_INSERT_FRAMES/fps:.3f}s)")


if __name__ == "__main__":
    build()
