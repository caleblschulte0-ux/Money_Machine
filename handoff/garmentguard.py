#!/usr/bin/env python3
"""r52: Film-B-only chroma continuity guard for the subject's garment.

r51: "the same visitor's dark shirt visibly changes identity across the
afternoon -- brown/purple, blue, burgundy, and near-black". In a one-person,
one-visit chronology that reads as wardrobe discontinuity. The remedy must be
local to Film B; the global normalization stage stays untouched (r49, r51).

WHAT THIS DOES
Works in CIE Lab. Keeps the pipeline's L* exactly -- so normalized luminance,
the high-key restoration and shot-to-shot black/white restraint are all
preserved -- and restores the SOURCE a*/b* chroma inside one narrow class:
dark, meaningfully saturated pixels, as defined on the untouched plate.

WHAT IT DELIBERATELY IS NOT
Not a global hue rotation. Not a per-shot creative grade. Not a saturation
reduction. The class is defined on the plate by lightness and chroma only, so
skin, stone, sky, the clock cards and the high-key identity are outside it and
are not touched.

THE CLASS IS NOT LITERALLY "GARMENT" AND THE ORDER DEPENDS ON THAT.
It is "dark and chromatic", which is what the garment is and what a shadowed
leaf gap in a tree canopy also is: b06's foliage sample measures a mean class
weight of 0.645. That is why this runs AFTER the finish, not before it. Run
before, the guard restores plate chroma into those leaf gaps and the finish
then carries it, and b06's foliage lands 9.0deg off source against a 5deg
limit. Run after, the same leak costs 0.6deg (2.5 -> 3.1) because nothing
amplifies it downstream, and the garment -- which the finish's halation and
lateral aberration were dragging 43deg off source at b11 -- lands at 3.1deg.
Narrowing the class to exclude foliage was not necessary and would have cost
coverage on the garment itself, which is the thing being corrected.

Film B's AR reconstructions are composited after this pass, so the bronze
material cannot be affected by construction.
"""
import numpy as np, cv2

L_MAX      = 46.0    # Lab L*: the garment class is dark
L_SOFT     = 14.0
C_MIN      = 3.0     # Lab CHROMA, which is absolute. A dark pixel with high
                     # RELATIVE saturation has LOW absolute chroma: this
                     # garment measures Lab C of 5-10 while reading HSV sat
                     # 0.44. A first threshold of 12 caught only 6-10% of it.
C_SOFT     = 2.0
FEATHER    = 9.0     # px, so the boundary cannot crawl or cut out
STRENGTH   = 1.0

def _smoothstep(x):
    x = np.clip(x, 0.0, 1.0)
    return x * x * (3.0 - 2.0 * x)

def mask(plate_bgr):
    """The garment class, defined on the SOURCE plate."""
    lab = cv2.cvtColor(plate_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    L = lab[..., 0] * (100.0 / 255.0)
    a = lab[..., 1] - 128.0
    b = lab[..., 2] - 128.0
    C = np.sqrt(a*a + b*b)
    m_dark = 1.0 - _smoothstep((L - (L_MAX - L_SOFT)) / L_SOFT)
    m_chr  = _smoothstep((C - C_MIN) / C_SOFT)
    m = m_dark * m_chr
    return cv2.GaussianBlur(m, (0, 0), FEATHER / 3.0)

def apply(proc_bgr, plate_bgr, strength=STRENGTH):
    """Pipeline L*, source a*/b*, inside the class only."""
    m = (mask(plate_bgr) * strength)[..., None]
    lp = cv2.cvtColor(plate_bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    lq = cv2.cvtColor(proc_bgr,  cv2.COLOR_BGR2LAB).astype(np.float32)
    out = lq.copy()
    out[..., 1:] = lq[..., 1:] * (1.0 - m) + lp[..., 1:] * m   # L* untouched
    return cv2.cvtColor(np.clip(out, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)
