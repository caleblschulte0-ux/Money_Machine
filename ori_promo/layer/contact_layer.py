#!/usr/bin/env python3
"""r185 evidence pack: full-film contact sheet for v37 "The World / The
Layer". Approximately one frame every 1.4s across the 74.0s master
(within r184's own requested 1.3-1.5s density), plus EXTRA_BOUNDS at
every disclosure entry/exit, every real-to-layer reset, every section
(and examples sub-part) transition, and the literal final frame -- all
per r184's own explicit contact-sheet requirement.
"""
import subprocess

import cv2
import numpy as np

W, H = 1920, 1080
MASTER = "../out/ORI_WorldLayer_master.mp4"
SECTION_BOUNDS = [0.0, 8.0, 20.0, 32.0, 40.0, 49.5, 54.0, 66.0, 74.0]
EXTRA_BOUNDS = [
    1.8, 4.2,                                  # hook: layer starts / fully revealed
    9.5, 12.2, 15.0, 19.0, 20.0,                # borrow: hardware in/hold, software swap, software out
    21.8, 23.0, 24.6,                           # recognize: zone-trace in, anchor-pulse in, captions
    33.0, 36.0, 40.0,                           # examples: historical disclosure in, hold, part boundary
                                                 # (IMG_DAK1.MOV is exactly 8.0s -- hist is 32.0-40.0, not
                                                 # 32.0-40.5; ice absorbs the other 0.5s below)
    41.0, 44.5, 49.5,                           # examples: ice disclosure in, hold, part boundary
    50.5, 52.0,                                 # examples: audio (no disclosure) reset + pulse
    57.0, 60.0, 63.0,                           # loop: word beats
    70.5, 73.9,                                 # close: end card appears / literal final frame
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
    cv2.imwrite("r185__claude__v37_world_layer__contact.png", sheet)
    print(f"  contact sheet: {len(times)} frames, {cols}x{rows}")


if __name__ == "__main__":
    main()
