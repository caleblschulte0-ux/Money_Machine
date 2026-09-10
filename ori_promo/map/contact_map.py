#!/usr/bin/env python3
"""r183 evidence pack: full-film contact sheet for v36 "How the System
Works", pass 3 (r182's sole requirement: the "SYSTEM DIAGRAM" tag raised
to 38px uniformly in every section). Every ~1.3s across the 74.0s master,
plus every node-arrival, disclosure, and end-card boundary -- same
standard set every round in this handoff has used (r167, r171, r175,
r177, r181, ...). EXTRA_BOUNDS already carried representative timestamps
in every section (place, hwsw, zone, examples, loop, close) plus the
literal final frame from r181 -- kept unchanged here since r182 asked for
exactly that coverage, just now showing the tag at its corrected size in
each one.
"""
import subprocess

import cv2
import numpy as np

W, H = 1920, 1080
MASTER = "../out/ORI_SystemMap_master.mp4"
SECTION_BOUNDS = [0.0, 7.0, 18.0, 31.0, 49.0, 63.0, 74.0]
EXTRA_BOUNDS = [
    2.0, 6.0,                                  # place: map begins / node appears
    10.0, 11.5, 12.5, 14.5, 16.0, 17.0,         # hwsw: dense HARDWARE + SOFTWARE coverage
    21.0, 24.5,                                # zone: ZONE arrival / caption swap
    33.0, 34.5, 36.0, 39.0, 41.5, 43.5, 45.5, 47.5, 48.5,
    # examples: dense coverage of all three large states + both disclosure boundaries
    49.0, 50.5, 52.5, 54.0, 56.0, 57.5, 59.5, 61.0, 62.8,
    # loop: every node arrival + the final caption
    70.5, 73.9,                                # close: end card appears / literal final frame
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
                         list(np.arange(0.0, 74.0, 1.3)) + SECTION_BOUNDS + EXTRA_BOUNDS]))
    tile_w, tile_h = 384, 216
    cols = 10
    rows = (len(times) + cols - 1) // cols
    sheet = np.zeros((rows * tile_h, cols * tile_w, 3), np.uint8)
    for i, t in enumerate(times):
        f = cv2.resize(stamp(grab(t), t), (tile_w, tile_h))
        r, c = divmod(i, cols)
        sheet[r * tile_h:(r + 1) * tile_h, c * tile_w:(c + 1) * tile_w] = f
    cv2.imwrite("r183__claude__v36_system_map_pass3__contact.png", sheet)
    print(f"  contact sheet: {len(times)} frames, {cols}x{rows}")


if __name__ == "__main__":
    main()
