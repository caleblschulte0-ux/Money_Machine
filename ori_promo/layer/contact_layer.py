#!/usr/bin/env python3
"""r191 evidence pack: full-film contact sheet for v37 "The World / The
Layer", typography legibility pass 2 (r190's finding on r189: removing
the hard boxes was the right direction, but plain white type with only
a soft halo washed out over pale sky/snow/bright concrete/bright hair.
graphics_layer.py's disclosure()/caption()/end_card() gained a stronger
local feathered scrim, a front-loaded bottom-edge gradient, and a crisp
keyline stroke under the soft halo -- still boxless, now legible over
any background). Same 1.4s base density plus the standing EXTRA_BOUNDS
from r187/r189, PLUS r190's own requested dense samples at every
timestamp its review flagged: 5.6/7.0 (hook disclosure), 16.8/18.2
(borrow disclosure over hair/sky), 22.8/24.0/30.8 (recognize captions
over grass), 33.6/39.2 (historical disclosure/caption), 42.8/49.0 (ice
age disclosure over sky/snow), 66.0/69.2 (close caption over concrete),
70.6/73.9 (end card, including the literal final frame).
"""
import subprocess

import cv2
import numpy as np

W, H = 1920, 1080
MASTER = "../out/ORI_WorldLayer_master.mp4"
SECTION_BOUNDS = [0.0, 8.0, 20.0, 32.0, 40.0, 49.5, 54.0, 66.0, 74.0]
EXTRA_BOUNDS = [
    1.8, 4.2,                                  # hook: layer starts / fully revealed
    5.6, 7.0,                                  # hook: disclosure over pale sky/snow (r190)
    9.5, 12.2, 15.0, 19.0, 20.0,                # borrow: hardware in/hold, software swap, software out
    16.8, 18.2,                                 # borrow: disclosure over bright hair/sky (r190)
    20.0, 20.2, 21.0, 21.9,                     # recognize: label entry / full 72px hold / exit (r186)
    21.8, 23.0, 24.6,                           # recognize: zone-trace in, anchor-pulse in, captions
    22.8, 24.0, 30.8,                           # recognize: captions over bright grass/concrete (r190)
    33.0, 36.0, 40.0,                           # examples: historical disclosure in, hold, part boundary
                                                 # (IMG_DAK1.MOV is exactly 8.0s -- hist is 32.0-40.0, not
                                                 # 32.0-40.5; ice absorbs the other 0.5s below)
    33.6, 39.2,                                  # examples: historical disclosure/caption vs river rock (r190)
    41.0, 44.5, 49.5,                           # examples: ice disclosure in, hold, part boundary
    42.8, 49.0,                                  # examples: ice disclosure over pale sky/snow (r190)
    50.5, 52.0,                                 # examples: audio (no disclosure) reset + pulse
    57.0, 60.0, 63.0,                           # loop: word beats
    66.0, 69.2,                                  # close: definition caption over sunlit concrete (r190)
    70.5, 70.6, 73.9,                            # close: end card appears / literal final frame
]


def grab(t):
    t = min(max(t, 0.0), 73.9)
    p = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", MASTER,
                        "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"],
                       capture_output=True).stdout
    if len(p) < W * H * 3:
        raise SystemExit(f"no frame at {t}s")
    return np.frombuffer(p[:W * H * 3], np.uint8).reshape(H, W, 3).copy()


def stamp(f, t):
    f = f.copy()
    cv2.rectangle(f, (0, H - 46), (150, H), (0, 0, 0), -1)
    cv2.putText(f, f"{t:5.1f}s", (8, H - 12), cv2.FONT_HERSHEY_SIMPLEX,
                0.85, (255, 255, 255), 2)
    return f


def main():
    times = sorted(set([round(x, 2) for x in
                         list(np.arange(0.0, 74.0, 1.4)) + SECTION_BOUNDS + EXTRA_BOUNDS]))
    tile_w, tile_h = 384, 216
    cols = 10
    rows = (len(times) + cols - 1) // cols
    sheet = np.zeros((rows * tile_h, cols * tile_w, 3), np.uint8)
    for i, t in enumerate(times):
        f = cv2.resize(stamp(grab(t), t), (tile_w, tile_h))
        r, c = divmod(i, cols)
        sheet[r * tile_h:(r + 1) * tile_h, c * tile_w:(c + 1) * tile_w] = f
    cv2.imwrite("r191__claude__v37_world_layer_typography_pass2__contact.png", sheet)
    print(f"  contact sheet: {len(times)} frames, {cols}x{rows}")


if __name__ == "__main__":
    main()
