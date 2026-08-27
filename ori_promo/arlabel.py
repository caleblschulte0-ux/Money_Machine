#!/usr/bin/env python3
"""AR overlay elements that are ANCHORED TO THE REAL SCENE and tracked.

ChatGPT's r63 note, which is the most useful thing it has given us:

  "Causality is missing. B and D show effects without showing what triggers
   them... The capability must be named by the image itself. Historical figures
   can read as ghosts; strata can read as a colour grade. Each treatment needs
   one visual behaviour that ordinary editorial VFX would not explain."

That is the whole design problem, and this module is the answer to it. Three
behaviours, in order, that a colourist could not produce by grading:

  SCAN       an outline computed FROM THE FOOTAGE ITSELF -- Canny edges inside
             the target region, so it hugs the real object exactly and moves
             with it. It cannot be mistaken for a drawn shape because it is
             derived from the pixels.
  LOCK       a reticle that CONVERGES on the target and then settles. The
             convergence is the recognition happening; without it a label just
             appears and proves nothing.
  ANCHOR     a label joined to the anchor by a leader line, where BOTH move
             with the object as the camera moves. Registration is the proof
             that a system knows where the thing is in space.

Tracking is Lucas-Kanade on features inside the anchor patch, with the global
phase correlation as a fallback when the patch loses its features.
"""
import numpy as np, cv2

def track_anchor(frames_gray, pt, patch=90):
    """-> per-frame (x, y) for one anchor, starting at pt on frame 0."""
    x, y = pt
    out = [(float(x), float(y))]
    win = cv2.createHanningWindow((frames_gray[0].shape[1],
                                   frames_gray[0].shape[0]), cv2.CV_32F)
    cur = np.array([[float(x), float(y)]], np.float32)
    for a, b in zip(frames_gray[:-1], frames_gray[1:]):
        h, w = a.shape
        px, py = cur[0]
        x0, y0 = int(max(0, px-patch)), int(max(0, py-patch))
        x1, y1 = int(min(w, px+patch)), int(min(h, py+patch))
        moved = None
        if x1-x0 > 16 and y1-y0 > 16:
            m = np.zeros_like(a, np.uint8); m[y0:y1, x0:x1] = 255
            p0 = cv2.goodFeaturesToTrack(a, 60, 0.01, 4, mask=m)
            if p0 is not None and len(p0) >= 6:
                p1, st, _ = cv2.calcOpticalFlowPyrLK(a, b, p0, None,
                                                     winSize=(21, 21), maxLevel=3)
                ok = st.ravel() == 1
                if ok.sum() >= 6:
                    d = np.median(p1[ok].reshape(-1, 2) - p0[ok].reshape(-1, 2), axis=0)
                    moved = cur[0] + d
        if moved is None:                       # fall back to global motion
            (dx, dy), _ = cv2.phaseCorrelate(a.astype(np.float32),
                                             b.astype(np.float32), win)
            moved = cur[0] + np.array([dx, dy], np.float32)
        cur = np.array([moved], np.float32)
        out.append((float(cur[0][0]), float(cur[0][1])))
    return out


def scan_outline(bgr, centre, r=190, lo=60, hi=170):
    """Edges taken FROM THE PICTURE inside a radius -- machine vision, not art."""
    h, w = bgr.shape[:2]
    cx, cy = int(centre[0]), int(centre[1])
    x0, y0 = max(0, cx-r), max(0, cy-r)
    x1, y1 = min(w, cx+r), min(h, cy+r)
    m = np.zeros((h, w), np.uint8)
    if x1-x0 < 8 or y1-y0 < 8:
        return m
    sub = cv2.cvtColor(bgr[y0:y1, x0:x1], cv2.COLOR_BGR2GRAY)
    sub = cv2.bilateralFilter(sub, 7, 55, 55)
    e = cv2.Canny(sub, lo, hi)
    e = cv2.dilate(e, np.ones((2, 2), np.uint8))
    yy, xx = np.mgrid[y0:y1, x0:x1]
    fall = np.clip(1.0 - np.hypot(xx-cx, yy-cy)/float(r), 0, 1)
    m[y0:y1, x0:x1] = (e.astype(np.float32) * fall).astype(np.uint8)
    return m


def ease(x):
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x)**3


def reticle(d, centre, t, dur=0.55, start=170, end=64, col=(255, 255, 255), a=235):
    """Converges, then settles. The convergence IS the recognition."""
    k = ease(t/dur)
    s = start + (end-start)*k
    cx, cy = centre
    arm = s*0.34
    al = int(a * (0.35 + 0.65*k))
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = cx + sx*s/2, cy + sy*s/2
            d.line([(x, y), (x - sx*arm, y)], fill=col+(al,), width=3)
            d.line([(x, y), (x, y - sy*arm)], fill=col+(al,), width=3)
    return s
