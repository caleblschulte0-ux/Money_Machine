#!/usr/bin/env python3
"""r177 evidence pack: full-film contact sheet for v35 "The Walkthrough",
pass 2 (r176's unequal EXPERIENCE rhythm fix).

Every ~1.4s across the 72.0s master, plus every chapter word, source-type,
disclosure, and end-card boundary -- same standard set for every round in
this handoff (r167, r171, r173, r175, ...). EXTRA_BOUNDS' experience-beat
entries are r177's new unequal boundaries (dak 38.0-42.2, bridge 42.2-42.7,
iceage 42.7-48.2, bridge 48.2-48.7, audio 48.7-54.0), replacing r175's
equal-thirds boundaries -- exactly the timing r176 rejected.
"""
import subprocess

import cv2
import numpy as np

W, H = 1920, 1080
MASTER = "../out/ORI_Walkthrough_master.mp4"
BEAT_BOUNDS = [0.0, 7.0, 16.0, 26.0, 38.0, 54.0, 64.0, 72.0]
# chapter words / source-type / disclosure boundaries, in film time
EXTRA_BOUNDS = [
    3.0,                          # arrive: chapter word -> modest title
    7.0, 10.5,                    # borrow: hardware -> worn-plate match cut
    19.0,                         # walk: chapter word clears
    32.0,                         # recognize: caption 1 -> caption 2
    38.0, 42.2, 42.45, 42.7, 45.0, 48.2, 48.45, 48.7, 51.0,
    # experience (r177): dak(38.0-42.2) -> bridge1(42.2-42.7) ->
    # iceage(42.7-48.2) -> bridge2(48.2-48.7) -> audio(48.7-54.0);
    # 42.45/48.45 sit inside each 0.5s bridge, 45.0/51.0 mid-hold
    57.0, 60.3, 64.0,             # return: site-based -> reusable -> updateable
    69.0,                         # close: end card appears
]


def grab(t):
    t = min(max(t, 0.0), 71.9)
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
                         list(np.arange(0.0, 72.0, 1.4)) + BEAT_BOUNDS + EXTRA_BOUNDS]))
    tile_w, tile_h = 384, 216
    cols = 10
    rows = (len(times) + cols - 1) // cols
    sheet = np.zeros((rows * tile_h, cols * tile_w, 3), np.uint8)
    for i, t in enumerate(times):
        f = cv2.resize(stamp(grab(t), t), (tile_w, tile_h))
        r, c = divmod(i, cols)
        sheet[r * tile_h:(r + 1) * tile_h, c * tile_w:(c + 1) * tile_w] = f
    cv2.imwrite("r177__claude__v35_walkthrough_pass2__contact.png", sheet)
    print(f"  contact sheet: {len(times)} frames, {cols}x{rows}")


if __name__ == "__main__":
    main()
