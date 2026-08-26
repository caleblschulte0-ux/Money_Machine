#!/usr/bin/env python3
"""r45's required correction: strata may only mark rock and ground.

r35 says terrain-only. At SMOOTH=8.0 the isolines became low-frequency, but they
still rode tree crowns, the water surface and the sky -- ChatGPT read that as
segmentation residue, correctly. This builds the material mask the effect is
allowed to draw inside.

EXCLUDED, per r45: sky, tree crowns and foliage, buildings and bridge, moving
water/ripple/foam, and people.
KEPT: large rock ledges, ground planes, terrain masses.

One attribution correction that goes back with the fix: the saturated blue at
0:45-0:51 is NOT mask residue. Measured on the plate BEFORE any strata, those
pixels sit at hue 224-242 deg with saturation 0.67-0.93 -- they are parked cars
in the lot behind the treeline, real content in the shot. The mask stops strata
from drawing over that band; it cannot remove the cars, and r45 requires the
framing be preserved.
"""
import numpy as np, cv2

def _smoothstep(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3.0 - 2.0 * x)

FAR_PCTL = 45.0   # the farthest 45% of each plate's own depth is background.
                  # A fixed absolute threshold does not transfer between plates:
                  # 0.16 excluded the d05 treeline perfectly but blocked 51% of
                  # d04 -- a wide flat landscape whose median depth is 0.143 --
                  # taking the rock flat with it. As a per-plate percentile, 45
                  # blocks the d04 treeline 100% and the d05 treeline 98.4%
                  # while leaving BOTH rock surfaces at 0% blocked. At 50 it
                  # starts eating d04's rock flat.


def terrain(bgr, depth=None, debug=False):
    """1.0 where strata may draw, 0.0 where they may not."""
    b = np.clip(bgr.astype(np.float32), 0, 1) if bgr.dtype != np.uint8 \
        else bgr.astype(np.float32) / 255.0
    hsv = cv2.cvtColor((b * 255).astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
    hue = hsv[..., 0] * 2.0
    sat = hsv[..., 1] / 255.0
    val = hsv[..., 2] / 255.0
    lum = 0.114*b[..., 0] + 0.587*b[..., 1] + 0.299*b[..., 2]
    H, W = lum.shape

    # foliage: green, with any real colour in it
    foliage = ((hue > 55) & (hue < 175) & (sat > 0.16)).astype(np.float32)
    # sky: bright, blue, and in the upper part of the frame
    ygrad = np.linspace(1.0, 0.0, H, dtype=np.float32)[:, None]
    sky = (((hue > 170) & (hue < 265) & (val > 0.62)).astype(np.float32)
           * np.repeat(ygrad, W, axis=1))
    # saturated non-mineral objects: cars, clothing, painted metal. Quartzite
    # never reaches this saturation.
    manmade = ((sat > 0.42) & ~((hue < 45) | (hue > 330))).astype(np.float32)
    # foam and specular water: only the genuinely blown white water.
    # At 0.80 this rule blocked 36.6% of the d04 plate -- sunlit pale quartzite
    # reads bright and colourless too, and over-blocking TERRAIN is a worse
    # failure here than under-blocking water. At 0.90 it takes 5.2%.
    foam = ((lum > 0.90) & (sat < 0.14)).astype(np.float32)
    # water: SMOOTH and bluish, at any brightness. Luminance is the wrong
    # discriminator and keying on it missed the biggest pool in d05 -- that
    # pool measures lum 0.685 while the rock ledge beside it is DARKER at
    # 0.386. What separates them is texture: the pool's local roughness is
    # 0.041, the ledge's is 0.140.
    m = cv2.blur(lum, (21, 21)); sq = cv2.blur(lum*lum, (21, 21))
    rough = np.sqrt(np.maximum(sq - m*m, 0.0))
    water = (((hue > 150) & (hue < 265) & (sat < 0.22) & (rough < 0.060))
             .astype(np.float32))

    # buildings, bridge, walls: long straight edges. Terrain has none.
    g = (lum * 255).astype(np.uint8)
    e = cv2.Canny(g, 60, 160)
    horiz = cv2.morphologyEx(e, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (61, 1)))
    vert = cv2.morphologyEx(e, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, 41)))
    built = cv2.dilate(np.maximum(horiz, vert), np.ones((25, 25), np.uint8)).astype(np.float32) / 255.0

    # FAR BACKGROUND, by depth. r47 found pale contours still describing the
    # d05 treeline and individual crowns, and on that plate NOTHING in colour
    # or texture separates distant foliage from rock: the treeline measures
    # hue 110 / sat 0.111 against a rock ledge at hue 134 / sat 0.114, and
    # their high-frequency energy is 8.5 against 8.6. Depth does separate them
    # cleanly -- treeline 0.067, rock ledge 0.294 -- so at FAR_DEPTH the
    # treeline is 100% excluded and the ledge 0%.
    far = np.zeros_like(lum)
    if depth is not None:
        d = cv2.resize(depth.astype(np.float32), (W, H)) if depth.shape != lum.shape \
            else depth.astype(np.float32)
        th = float(np.percentile(d, FAR_PCTL))
        far = 1.0 - _smoothstep((d - th * 0.55) / max(th * 0.9, 1e-3))

    block = np.clip(foliage + sky + manmade + foam + water + built + far, 0.0, 1.0)
    block = cv2.GaussianBlur(block, (0, 0), 5.0)
    keep = 1.0 - _smoothstep((block - 0.18) / 0.34)
    keep = cv2.GaussianBlur(keep, (0, 0), 7.0)
    if debug:
        return keep, dict(foliage=float(foliage.mean()), sky=float(sky.mean()),
                          manmade=float(manmade.mean()), foam=float(foam.mean()),
                          water=float(water.mean()), built=float(built.mean()),
                          far=float(far.mean()), keep=float(keep.mean()))
    return keep
