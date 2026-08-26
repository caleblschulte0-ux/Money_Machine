#!/usr/bin/env python3
"""DEMO 4 machine-vision readouts: a 3-D read of the place, and a material read.

Both are computed from the picture and neither is available to a colourist,
which is the bar ChatGPT set in r63 and the reason the two earlier attempts
were thrown away:

  STREAMLINES from dense optical flow -- deleted. Farneback returned an
  essentially constant field on the river plate (raw magnitude p50 0.76 vs a
  camera motion of 0.95): whitewater decorrelates completely between frames at
  30fps, so the "flow" was the pan.
  MOTION FIELD from compensated frame difference -- deleted. It worked as a
  measurement (falls 10.5 levels vs static wall 2.9) but it drew teal smoke
  over dry rock, because handheld sub-pixel jitter lights up every high
  contrast texture. Rendered, it read as a colour grade. Exactly the failure
  we were trying to avoid.

What survives is depth. Depth Anything V2 Small returns a clean, stable
monocular depth map on this footage -- foreground rock near, treeline mid,
sky far -- and everything below is derived from it.

  RANGE SWEEP        one iso-depth surface moving from near to far. Where it
                     meets the terrain you get a contour that bends over every
                     rock. It is the shape of the place, drawn by the machine.
  TERRAIN BANDS      depth quantised into shells, boundaries drawn. Static
                     structure rather than a moving read.
  MATERIAL CLASSES   Lab colour plus depth, split into SKY / VEGETATION /
                     STONE, each region outlined and named where it actually
                     is. Water is deliberately absent -- see classify().
"""
import numpy as np, cv2

# THREE classes, not four. WATER was tried and cut: on this footage the river
# surface reflects the rock it runs over, so it is not separable by colour,
# luminance or texture. Four rules were measured against the river-shelf, the
# rapids and the falls plate and the best of them claimed 0.3-5.6% of the
# frame, mostly in the wrong places. A class that is wrong 90% of the time is
# worse than a class that is absent, because the demo would be showing the
# system confidently mislabelling a rock. So the system names what it can
# actually tell apart, and says nothing about the water.
SKY, VEG, ROCK = 0, 1, 3
CLASS_NAME = {SKY: "SKY", VEG: "VEGETATION", ROCK: "STONE / QUARTZITE"}
CLASS_COL = {SKY: (150, 200, 244), VEG: (150, 232, 190), ROCK: (244, 214, 150)}


def sweep_mask(depth, level, width=0.028):
    """The iso-depth contour: 1 where the sweep plane meets the surface."""
    return np.clip(1.0 - np.abs(depth - level) / width, 0, 1).astype(np.float32)


def band_edges(depth, n=7, blur=9.0, weight=3):
    """Boundaries of n depth shells -> float32 0..1 edge map.

    Rendered at blur 5.0 with a 3x3 dilate, these came out as thin teal
    squiggles that read as noise on textured rock rather than as contours of
    the landform. Heavier pre-blur makes them follow the SHAPE of the ground
    instead of chasing every boulder, and a thicker line survives the scale
    up to delivery size -- the same lesson strataD.py already learned at
    SMOOTH 8.0.
    """
    d = cv2.GaussianBlur(depth.astype(np.float32), (0, 0), blur)
    q = np.clip((d * n).astype(np.int16), 0, n - 1)
    e = np.zeros(q.shape, np.uint8)
    e[1:, :] |= (q[1:, :] != q[:-1, :]).astype(np.uint8)
    e[:, 1:] |= (q[:, 1:] != q[:, :-1]).astype(np.uint8)
    e = cv2.dilate(e, np.ones((weight, weight), np.uint8))
    return cv2.GaussianBlur(e.astype(np.float32), (0, 0), 1.4)


def classify(bgr, depth):
    """-> HxW uint8 of SKY/VEG/WATER/ROCK.

    Deliberately simple and inspectable: Lab colour for the material, depth to
    separate sky from everything else, and local luminance variance to tell
    flat water from textured stone. Every threshold below was set by rendering
    the result over the plate and looking at it.
    """
    lab = cv2.cvtColor(bgr.astype(np.uint8), cv2.COLOR_BGR2LAB).astype(np.float32)
    L = lab[..., 0] * (100.0 / 255.0)
    a = lab[..., 1] - 128.0
    b = lab[..., 2] - 128.0
    g = cv2.cvtColor(bgr.astype(np.uint8), cv2.COLOR_BGR2GRAY).astype(np.float32)
    m = cv2.blur(g, (17, 17))
    var = np.sqrt(np.maximum(0, cv2.blur(g * g, (17, 17)) - m * m))

    out = np.full(L.shape, ROCK, np.uint8)
    out[(a < -4)] = VEG                       # chlorophyll is the one strong signal
    out[(depth < 0.085) & (b < -6) & (L > 55)] = SKY
    _ = var                                   # kept: the water rule that failed used it
    # a class that survives one blur is a class; salt and pepper is not
    out = cv2.medianBlur(out, 15)
    return out


def regions(cls, min_frac=0.012):
    """-> [(class_id, mask_uint8, (cx,cy), area_frac)] for regions worth naming."""
    H, W = cls.shape
    tot = float(H * W)
    got = []
    for c in (VEG, ROCK, SKY):
        m = (cls == c).astype(np.uint8)
        n, lab, stats, cent = cv2.connectedComponentsWithStats(m, 8)
        for i in range(1, n):
            if stats[i, cv2.CC_STAT_AREA] / tot < min_frac:
                continue
            got.append((c, (lab == i).astype(np.uint8),
                        (float(cent[i][0]), float(cent[i][1])),
                        stats[i, cv2.CC_STAT_AREA] / tot))
    got.sort(key=lambda r: -r[3])
    return got


def outline(mask, W, H, thin=2):
    """Contours of a class mask, at delivery size, as point lists."""
    cs, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    sx, sy = W / mask.shape[1], H / mask.shape[0]
    out = []
    for c in cs:
        if cv2.contourArea(c) < 260:
            continue
        c = cv2.approxPolyDP(c, thin, True)
        pts = [(float(p[0][0]) * sx, float(p[0][1]) * sy) for p in c]
        if len(pts) >= 3:
            out.append(pts)
    return out


def inner_point(mask):
    """A point comfortably INSIDE the region -- a centroid can land in a hole,
    which is how the first pass put a WATER label on dry rock."""
    d = cv2.distanceTransform(mask, cv2.DIST_L2, 5)
    y, x = np.unravel_index(int(np.argmax(d)), d.shape)
    return float(x), float(y), float(d[y, x])
