#!/usr/bin/env python3
"""r41's one requested picture change: calm the over-saturated shadowed water.

r41 read the falls plate's blue as "the first colour accent the eye catches"
and asked for delivered saturation ~0.20-0.22, native hue preserved near 219deg,
luminance preserved, mask broadly feathered, no global blue desaturation.

Two notes on where it actually is. r41 placed it "immediately below and left of
the falls"; measured, that pool is sat 0.080 at hue 105deg -- green, and not the
problem. The saturated blue is to the RIGHT, in the shadowed rock-and-water at
the base of the columns, and it is stronger than the 0.254 first reported:
0.318 in the strip at the falls base, 0.254 beside the columns, against a whole
-frame mean of 0.202.

Applied to the PLATE, before parallax. That is what makes it temporally stable:
the mask is warped by the same move as the content it sits on, so no edge can
crawl. A mask applied per-frame downstream is what produces the crawling
boundary r41 warned about.

Saturation is reduced by scaling chroma toward the luminance axis, which holds
hue and luminance exactly -- it cannot shift the blue toward cyan the way a
naive HSV edit would.

Two things this deliberately does NOT do, both learned by measuring:

A texture gate was tried, on the theory that water is smooth and quartzite is
not. Measured, they do not separate: water runs 0.074-0.162 local contrast and
rock 0.086-0.150, near-total overlap -- the water is rippled and the shadowed
crevices are smoother than it. The gate was dropped rather than tuned.

And it does not try to exclude rock. What reads as the blue accent is largely
shadowed ROCK crevice, not water. That is safe to calm here precisely BECAUSE
chroma scaling leaves luminance untouched, and rock texture is luminance
detail: the crevices get less blue, not less textured. Verified, not assumed --
Laplacian variance under the mask is unchanged to 4 decimal places.
"""
import numpy as np, cv2

HUE_LO, HUE_HI = 170.0, 250.0    # the blue band to act on
HUE_SOFT       = 22.0            # smooth shoulders on the hue window
VAL_MAX        = 0.52            # only shadowed pixels
VAL_SOFT       = 0.14
SAT_FLOOR      = 0.16            # never act on pixels already calm
FEATHER        = 36              # px. r41 asked for a broad feather to stop a
                                 # temporal edge crawling; applying on the PLATE
                                 # already guarantees that, so this only has to
                                 # hide a spatial boundary. A sigma-28 feather
                                 # diluted the core to 0.37 and the correction
                                 # could not reach the target.
MASK_GAIN      = 4.0             # solidify the core; the broad feather alone
                                 # left the peak at 0.614 and the correction
                                 # too weak to reach r41's target

def _smoothstep(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3.0 - 2.0 * x)

def _spatial(H, W):
    """Broad window over the shadowed water right of the falls.

    Zero across the left third and the sky, so this is a LOCAL correction and
    not the global blue desaturation r41 forbade."""
    y, x = np.mgrid[0:H, 0:W].astype(np.float32)
    wx = _smoothstep((x - 0.26*W) / (0.10*W))
    wy = _smoothstep((y - 0.20*H) / (0.08*H)) * (1.0 - _smoothstep((y - 0.80*H) / (0.10*H)))
    return wx * wy

def mask(bgr):
    b = np.clip(bgr, 0, 1)
    hsv = cv2.cvtColor((b*255).astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
    hue = hsv[..., 0] * 2.0
    val = hsv[..., 2] / 255.0
    mx = b.max(2); mn = b.min(2)
    sat = (mx - mn) / np.maximum(mx, 1e-4)
    wh = _smoothstep((hue - (HUE_LO - HUE_SOFT)) / HUE_SOFT) * \
         (1.0 - _smoothstep((hue - (HUE_HI - HUE_SOFT)) / HUE_SOFT))
    wv = 1.0 - _smoothstep((val - (VAL_MAX - VAL_SOFT)) / VAL_SOFT)
    ws = _smoothstep((sat - SAT_FLOOR) / 0.10)
    m = np.clip(wh * wv * ws * MASK_GAIN, 0.0, 1.0) * _spatial(*b.shape[:2])
    return cv2.GaussianBlur(m, (0, 0), FEATHER / 3.0)

def apply(bgr, f):
    """Scale chroma toward the luminance axis by f inside the mask."""
    m = mask(bgr)[..., None]
    lum = (0.114*bgr[..., 0] + 0.587*bgr[..., 1] + 0.299*bgr[..., 2])[..., None]
    scaled = lum + (bgr - lum) * f
    return np.clip(bgr * (1.0 - m) + scaled * m, 0.0, 1.0), m[..., 0]
