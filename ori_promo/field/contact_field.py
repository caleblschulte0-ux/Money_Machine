#!/usr/bin/env python3
"""r171 evidence pack: full-film contact sheet for v34 "The Field Guide".

Every ~1.4s across the 70.0s master, plus the exact boundary of every
disclosure tag and every beat transition -- same standard r170/r168 set
for v33's r167 contact sheet.
"""
import subprocess
import sys

import cv2
import numpy as np

W, H = 1920, 1080
MASTER = "../out/ORI_Field_Guide_master.mp4"
BEAT_BOUNDS = [0.0, 6.0, 15.0, 23.0, 35.0, 49.0, 60.0, 70.0]
DISCLOSURE_BOUNDS = [6.0, 15.0, 20.0, 23.0, 35.0, 39.67, 44.33, 49.0]


def grab(t):
    t = min(max(t, 0.0), 69.9)
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
                         list(np.arange(0.0, 70.0, 1.4)) + BEAT_BOUNDS + DISCLOSURE_BOUNDS]))
    tile_w, tile_h = 384, 216
    cols = 10
    rows = (len(times) + cols - 1) // cols
    sheet = np.zeros((rows * tile_h, cols * tile_w, 3), np.uint8)
    for i, t in enumerate(times):
        f = cv2.resize(stamp(grab(t), t), (tile_w, tile_h))
        r, c = divmod(i, cols)
        sheet[r * tile_h:(r + 1) * tile_h, c * tile_w:(c + 1) * tile_w] = f
    cv2.imwrite("r171__claude__v34_field_guide__contact.png", sheet)
    print(f"  contact sheet: {len(times)} frames, {cols}x{rows}")


if __name__ == "__main__":
    main()
