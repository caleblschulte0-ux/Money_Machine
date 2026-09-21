#!/usr/bin/env python3
"""Per-frame global camera motion for a clip: |translation| in px (at 1920
wide) and rotation, estimated from LK flow on a half-res frame. Writes
work/motion/<clip>.npy as [t, dx, dy, deg]. Used to pick steady windows."""
import os
import sys

import cv2
import numpy as np

os.makedirs("work/motion", exist_ok=True)


def profile(path):
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    ok, prev = cap.read()
    if not ok:
        return None
    prev = cv2.cvtColor(cv2.resize(prev, (960, 540)), cv2.COLOR_BGR2GRAY)
    rows = [(0.0, 0.0, 0.0, 0.0)]
    i = 0
    pts = cv2.goodFeaturesToTrack(prev, 400, 0.01, 10)
    while True:
        ok, f = cap.read()
        if not ok:
            break
        i += 1
        g = cv2.cvtColor(cv2.resize(f, (960, 540)), cv2.COLOR_BGR2GRAY)
        dx = dy = deg = 0.0
        if pts is not None and len(pts) >= 8:
            nxt, st, _ = cv2.calcOpticalFlowPyrLK(prev, g, pts, None, winSize=(21, 21), maxLevel=3)
            okm = st.reshape(-1) == 1
            if okm.sum() >= 8:
                M, _ = cv2.estimateAffinePartial2D(pts[okm], nxt[okm], method=cv2.RANSAC, ransacReprojThreshold=2.0)
                if M is not None:
                    dx, dy = float(M[0, 2]) * 2, float(M[1, 2]) * 2
                    deg = float(np.degrees(np.arctan2(M[1, 0], M[0, 0])))
        rows.append((i / fps, dx, dy, deg))
        pts = cv2.goodFeaturesToTrack(g, 400, 0.01, 10)
        prev = g
    return np.array(rows, np.float32)


if __name__ == "__main__":
    for p in sys.argv[1:]:
        name = os.path.basename(p).split(".")[0]
        out = f"work/motion/{name}.npy"
        if os.path.exists(out):
            continue
        a = profile(p)
        np.save(out, a)
        mag = np.hypot(a[:, 1], a[:, 2])
        print(f"{name}: {len(a)} frames, mean |v|={mag.mean():.2f}px/f, p90={np.percentile(mag, 90):.2f}")
