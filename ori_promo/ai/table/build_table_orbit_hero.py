#!/usr/bin/env python3
"""Builds raw/IMG_TABLE1.MOV -- the `table` beat's plate, v3. Run from
the repo root:

    python3 ai/table/build_table_orbit_hero.py

SUPERSEDES build_table_turntable12.py the same day it shipped.
build_table_turntable.py (4-angle) and build_table_turntable12.py
(12-angle, uniform 0.5s holds) both kept, not deleted, per this repo's
own convention.

WHY. ChatGPT's r162 review of the 12-angle cut (r161) was specific:
"At [0.5s cadence] the viewer sees six separate static photographs, not
movement... 15 identical frames per angle mathematically confirms a
static hold for half a second." Right call -- a slideshow with 12 stops
instead of 4 is still a slideshow, just a longer one. The fix isn't more
angles, it's a different EDIT STRUCTURE: a fast orbit that reads as
rotation because it's fast, followed by a deliberate stop on the
strongest angles, which is what an actual product-reveal edit does (spin
to prove it's real and dimensional, then rest on the hero framing to let
the viewer actually look).

STRUCTURE, per r162's exact request:
  1. FAST ORBIT -- 11 angles, EXCLUDING the 270-degree/"front-top"
     anchor, at a uniform fast cadence (see CADENCE_FRAMES below).
  2. HERO HOLD -- the strongest front three-quarter angle (glasses_turn_a,
     0 degrees -- the ORIGINAL r146 anchor, chosen for the same reason it
     was chosen as anchor #1 in the first place), held long enough to
     actually be looked at.
  3. HERO INSERT -- the 270-degree overhead view, as its OWN beat, hard
     cut in and out. r162 was explicit that 270 is "a clear camera-
     position and elevation discontinuity... it cannot simultaneously
     count as one step in a continuous fixed-camera rotation" -- so it
     is not asked to pretend to be one. It closes the beat instead: the
     most visually distinct of all 12 angles is what the viewer's eye
     carries into the cut to `walk`, not a random ration of remaining
     seconds.

SENSOR-PANEL / TEMPLE CONTINUITY CHECK (r162 required this before
shipping -- "if the panel visibly swaps physical sides... remove the
offending frame and document it, do not conceal it with a blend").
Checked directly against all 12 full-resolution source frames, using the
one fixed, un-ambiguous reference point every image shares: the small
silver hinge visible on the PANEL-FREE temple. Tracked which temple
(foreground/background in each composition) carries the panel across
the whole sequence:

  0, 60, 90, 330 deg    -- panel on the temple receding AWAY from camera
                            (background), matching a front-of-object view
  120, 150, 180, 210,
  240, 300 deg          -- panel on the temple nearest camera (foreground)

That is not a swap bug. It is exactly what a single rigid object's fixed
physical side does under one continuously orbiting camera: whichever
temple is "far" while looking at the FRONT of the object becomes "near"
once the camera has orbited around to the BACK of it, and flips back
again completing the circle. The crossover happens once in each
direction (between 90-120 and between 300-330), which is the expected
count for one 360-degree pass, not a repeated flicker -- a real
discontinuity would show the panel changing sides between adjacent
close angles that ought to look almost identical (e.g. 0 vs 30), which
does not happen anywhere in this set. 270 deg (the overhead hero shot)
shows neither panel clearly, also expected: from directly above/in
front, both temples are foreshortened near edge-on.

No angle removed. All 12 delivered images are used somewhere in this cut.
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
HERO_HOLD = os.path.join(_HERE, "glasses_turn_a_chatgpt.jpg")   # 0 deg again -- the
                                                                 # strongest front 3/4
HERO_INSERT = os.path.join(_HERE, "glasses_turn_d_chatgpt.jpg")  # 270 deg overhead
DST = os.path.join(RAW, "IMG_TABLE1.MOV")

ORBIT_FRAME_HOLD = 5     # 0.167s/angle @ 30fps -- fast enough to read as motion,
                         # not a fractional-frame count. 11 x 5 = 55 frames (1.833s)
HERO_HOLD_FRAMES = 85    # 2.833s -- long enough to actually look at the hero angle
HERO_INSERT_FRAMES = 40  # 1.333s -- a deliberate closing beat, not a lingering study


def _scaled_input(path, n_frames, fps):
    return ["-loop", "1", "-t", f"{n_frames / fps:.4f}", "-i", path]


def build(fps=30):
    images = ORBIT + [HERO_HOLD, HERO_INSERT]
    holds = [ORBIT_FRAME_HOLD] * len(ORBIT) + [HERO_HOLD_FRAMES, HERO_INSERT_FRAMES]
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
          f"+ hero insert {HERO_INSERT_FRAMES/fps:.3f}s)")


if __name__ == "__main__":
    build()
