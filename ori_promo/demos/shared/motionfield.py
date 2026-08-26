#!/usr/bin/env python3
"""LIVE MOTION FIELD -- an AR element measured from the footage each frame.

WHY THIS IS NOT STREAMLINES. The first build advected particles through dense
Farneback flow. Measured on the river plate (IMG_6791 @4.5s) the flow field
came back essentially CONSTANT: raw magnitude p50 0.76, p90 0.93, p99.9 1.05,
against a phase-correlated camera motion of hypot(0.79, 0.52) = 0.95. In other
words Farneback found no differential motion at all -- whitewater decorrelates
completely between frames at 30fps, so every vector was just the camera's own
move. Streamlines drawn from that would have been a pan detector wearing a
costume. Deleted rather than shipped.

What IS robustly measurable is CHANGE. Warp frame A onto frame B by the
global camera motion, subtract, and what remains is the scene moving on its
own: on that same plate the compensated difference is a mean of 13.2 levels,
concentrated exactly on the water, against 0.57 on the still ruin plate. So
this module draws that.

Two behaviours, deliberately different in character:

  SEGMENT   one boundary for the whole shot, from the MEDIAN activity. Steady.
            This is the system saying "that region is the moving thing."
  LIVE      isolines recomputed every frame inside the boundary. They boil,
            because the water does.

A colourist cannot produce either one, and pointing the same overlay at still
rock produces an empty frame -- which is the proof.
"""
import numpy as np, cv2

FW, FH = 720, 405


def compensated(frames_gray_full):
    """-> list of (FH,FW) float32 activity maps, camera motion removed."""
    small = [cv2.resize(g, (FW, FH), interpolation=cv2.INTER_AREA).astype(np.float32)
             for g in frames_gray_full]
    win = cv2.createHanningWindow((FW, FH), cv2.CV_32F)
    out = []
    for a, b in zip(small[:-1], small[1:]):
        # copies are MANDATORY: phaseCorrelate windows its inputs in place,
        # and these frames are each used twice
        (dx, dy), _ = cv2.phaseCorrelate(a.copy(), b.copy(), win)
        M = np.float32([[1, 0, dx], [0, 1, dy]])
        aw = cv2.warpAffine(a, M, (FW, FH), flags=cv2.INTER_LINEAR,
                            borderMode=cv2.BORDER_REPLICATE)
        d = np.abs(b - aw)
        # the warp cannot be trusted at the frame edge
        d[:6, :] = 0; d[-6:, :] = 0; d[:, :6] = 0; d[:, -6:] = 0
        out.append(cv2.GaussianBlur(d, (0, 0), 4.0))
    if out:
        out.append(out[-1])
    return out


# An ABSOLUTE scale, in luma levels, shared by every shot. The first build
# normalised each shot by its own 99.3rd percentile, and the result was that
# every plate came back 50-60% "active" -- including a static ruin wall whose
# real frame-to-frame change is 0.6 levels. A reading that rescales itself to
# whatever it is pointed at is not a reading, it is a decoration. Measured
# medians of the compensated difference, over 3s: main falls 10.5, river shelf
# 8.4, path with moving foliage 5.4, static ruin 2.9, static walkway 1.2. 26
# puts full-scale above the loudest of those and leaves the still plates dark.
SCALE_ABS = 26.0


def scale_of(acts):
    return SCALE_ABS


def segment(acts, scale, thr=0.38):
    """The steady boundary: median activity over the shot, thresholded."""
    if not acts:
        return np.zeros((FH, FW), np.uint8)
    med = np.median(np.stack(acts), axis=0) / scale
    m = (med > thr).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((13, 13), np.uint8))
    return m


def coverage(acts, scale, thr=0.38):
    if not acts:
        return 0.0
    return float((np.median(np.stack(acts), axis=0) / scale > thr).mean())


def draw_segment(d, mask, W, H, k, col=(150, 232, 244), a=225, min_area=900):
    """Trace the steady boundary at delivery size."""
    cs, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    sx, sy = W / FW, H / FH
    n = 0
    for c in cs:
        if cv2.contourArea(c) < min_area:
            continue
        pts = [(float(p[0][0]) * sx, float(p[0][1]) * sy) for p in c]
        if len(pts) < 3:
            continue
        # the boundary DRAWS ITSELF as the reading comes up, rather than popping
        cut = max(3, int(len(pts) * min(1.0, k * 1.25)))
        d.line(pts[:cut] + ([pts[0]] if cut >= len(pts) else []),
               fill=col + (int(a * min(1.0, k * 2.2)),), width=3, joint="curve")
        n += 1
    return n


def live_layer(act, scale, mask, W, H, col=(150, 232, 244),
               levels=(0.42, 0.62, 0.86), amp=1.0):
    """-> HxWx4 uint8 overlay of this frame's isolines, inside the boundary."""
    f = np.clip(act / scale, 0, 1.6) * mask
    rgba = np.zeros((FH, FW, 4), np.float32)
    for j, L in enumerate(levels):
        band = np.clip(1.0 - np.abs(f - L) / 0.07, 0, 1)
        rgba[..., 3] = np.maximum(rgba[..., 3], band * (150 + 34 * j))
    # a low wash so the region reads as filled, not just outlined
    rgba[..., 3] = np.maximum(rgba[..., 3], np.clip(f - 0.30, 0, 1) * 52)
    rgba[..., 3] *= amp
    rgba[..., 0] = col[0]; rgba[..., 1] = col[1]; rgba[..., 2] = col[2]
    big = cv2.resize(rgba, (W, H), interpolation=cv2.INTER_LINEAR)
    return np.clip(big, 0, 255).astype(np.uint8)


def level(act, scale, mask):
    """The number behind the meter: mean normalised activity inside the
    segment. Reported as a relative reading with no invented unit."""
    m = mask.astype(np.float32)
    s = m.sum()
    if s < 1:
        return 0.0
    return float(np.clip(((act / scale) * m).sum() / s, 0, 1))
