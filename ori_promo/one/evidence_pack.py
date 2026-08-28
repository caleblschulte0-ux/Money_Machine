#!/usr/bin/env python3
"""The still pack a picture review actually needs, generated from the master.

The reviewer reads stills, not the MP4, so every round has to hand over the
same three things or the note comes back unanswerable: full-resolution
frames at the exact timestamps under discussion, and -- r94's request --
"one wider contact-sheet frame before and after each composite so the fix
can be judged in sequence", because a composite that looks right frozen can
still arrive wrong.

    python one/evidence_pack.py out/..._v14_send.mp4 v14 13.9 23.5

Timestamps default to the two composite beats. Each one gets a full-res PNG
and a three-up strip at t-1.5s, t, t+1.7s.
"""
import os
import subprocess
import sys

import cv2
import numpy as np

W, H = 1920, 1080


def grab(master, t):
    p = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", master,
                        "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"],
                       capture_output=True).stdout
    if len(p) < W * H * 3:
        raise SystemExit(f"no frame at {t}s in {master}")
    return np.frombuffer(p[:W * H * 3], np.uint8).reshape(H, W, 3).copy()


def stamp(f, t):
    cv2.rectangle(f, (0, H - 50), (150, H), (0, 0, 0), -1)
    cv2.putText(f, f"{t:5.1f}s", (10, H - 14), cv2.FONT_HERSHEY_SIMPLEX,
                0.9, (255, 255, 255), 2)
    return f


def main(master, tag, times):
    out = os.path.dirname(master) or "."
    for t in times:
        cv2.imwrite(f"{out}/{tag}_frame_{t:.1f}s.png", grab(master, t))
        print(f"  {tag}_frame_{t:.1f}s.png")
        seq = [max(0.0, t - 1.5), t, t + 1.7]
        tiles = [cv2.resize(stamp(grab(master, s), s), (860, 484)) for s in seq]
        cv2.imwrite(f"{out}/{tag}_sequence_{t:.1f}s.jpg", np.hstack(tiles),
                    [cv2.IMWRITE_JPEG_QUALITY, 92])
        print(f"  {tag}_sequence_{t:.1f}s.jpg  ({seq[0]:.1f} / {t:.1f} / {seq[2]:.1f}s)")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    ts = [float(x) for x in sys.argv[3:]] or [13.9, 23.5]
    main(sys.argv[1], sys.argv[2], ts)
