#!/usr/bin/env python3
"""r54: the garment mask the continuity offset is allowed to touch.

WHY THIS IS NOT garmentguard.mask(). r52's guard restored PLATE chroma inside
the "dark and chromatic" class, which is safe however broad the class is: it
only ever moves a pixel back toward what the camera saw. r54 applies a bounded
Lab OFFSET, which moves pixels AWAY from the plate, so the same class is not
acceptable -- it covers 6-32% of the frame per shot and takes in fences, the
ruin wall, shaded stone, dark glass, leaf shadow and, in b10, the SECOND
VISITOR, all of which r53 puts out of bounds.

Two things were tried and rejected on measurement before this one:
  - picking the class's connected component at a seed. The opened component
    still swallowed the ruin wall in b02/b04, the second visitor in b10, and
    the red shorts in b12.
  - a pure Lab-neighbourhood gate, no geometry. Measured across the eight
    proof beats, 18-37% of the NON-garment class already sits within 8 Lab
    units of the garment, so this would have recoloured stone wholesale.

What works is the conjunction of three weak tests, none sufficient alone:

  gate   a tracked soft box around the garment -- optical flow carries it
         through the shot, so it excludes anything far from the subject
  class  garmentguard's dark-and-chromatic test, which excludes sky, skin,
         grass, sunlit stone and water
  near   Lab distance to THIS shot's verified garment patch, which excludes
         the red shorts, hair, and background of a different colour that
         happens to fall inside the gate

Every shot's result is looked at before it is used. A mask nobody inspected is
exactly the mistake r52 made with its sample boxes, and it is not repeated.
"""
import numpy as np, cv2
import garmentguard as GG

CLASS_T   = 0.45
LAB_R     = 13.0      # Lab units; soft
LAB_SOFT  = 5.0
L_WEIGHT  = 0.35      # lightness counts, but only a third as much as chroma.
                      # One garment spans L* 2-30 within a single shot as it
                      # turns through its own shading (b00 does exactly that),
                      # and a full-weight L* term drops the shaded half of the
                      # shirt out of the mask. A per-shot constant offset
                      # applied to half a shirt is a two-tone shirt, which is
                      # worse than the defect being corrected.
GATE_FEAT = 26.0      # px of softness on the gate edge
FEATHER   = 6.0
MAXPTS    = 220


def _smoothstep(x):
    x = np.clip(x, 0.0, 1.0)
    return x*x*(3.0 - 2.0*x)


def lab(bgr):
    l = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    return l[..., 0]*(100.0/255.0), l[..., 1]-128.0, l[..., 2]-128.0


def patch_lab(plate, patch):
    """Lab centroid of the CLEAN garment inside the verified patch."""
    x, y, w, h = patch
    sub = plate[y:y+h, x:x+w]
    m = GG.mask(sub) >= 0.60
    L, a, b = lab(sub)
    if m.sum() < 50:
        m = np.ones_like(m)
    return float(L[m].mean()), float(a[m].mean()), float(b[m].mean()), int(m.sum())


def gate_mask(shape, box):
    x, y, w, h = box
    g = np.zeros(shape[:2], np.float32)
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(shape[1], x+w), min(shape[0], y+h)
    if x1 <= x0 or y1 <= y0:
        return g
    g[y0:y1, x0:x1] = 1.0
    return cv2.GaussianBlur(g, (0, 0), GATE_FEAT/3.0)


def build(plate, box, ref):
    """ref = (L,a,b) of this shot's garment. -> feathered float mask."""
    L, a, b = lab(plate)
    d = np.sqrt((L_WEIGHT*(L-ref[0]))**2 + (a-ref[1])**2 + (b-ref[2])**2)
    near = 1.0 - _smoothstep((d - (LAB_R - LAB_SOFT))/LAB_SOFT)
    cls = np.clip(GG.mask(plate)/max(CLASS_T, 1e-6), 0, 1)
    m = gate_mask(plate.shape, box) * cls * near
    return cv2.GaussianBlur(m, (0, 0), FEATHER/3.0)


def track(prev_gray, gray, box):
    """Carry the gate box with the picture. Translation + median scale."""
    x, y, w, h = box
    roi = np.zeros(prev_gray.shape, np.uint8)
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(prev_gray.shape[1], x+w), min(prev_gray.shape[0], y+h)
    if x1 - x0 < 8 or y1 - y0 < 8:
        return box
    roi[y0:y1, x0:x1] = 255
    p0 = cv2.goodFeaturesToTrack(prev_gray, MAXPTS, 0.01, 6, mask=roi)
    if p0 is None or len(p0) < 8:
        return box
    p1, st, _ = cv2.calcOpticalFlowPyrLK(prev_gray, gray, p0, None,
                                         winSize=(21, 21), maxLevel=3)
    if p1 is None:
        return box
    ok = st.ravel() == 1
    if ok.sum() < 8:
        return box
    A, B = p0[ok].reshape(-1, 2), p1[ok].reshape(-1, 2)
    dx, dy = np.median(B - A, axis=0)
    ca, cb = A.mean(0), B.mean(0)
    ra = np.linalg.norm(A - ca, axis=1); rb = np.linalg.norm(B - cb, axis=1)
    keep = ra > 3.0
    s = float(np.median(rb[keep]/ra[keep])) if keep.sum() >= 6 else 1.0
    s = float(np.clip(s, 0.94, 1.07))
    cx, cy = x + w/2 + dx, y + h/2 + dy
    w2, h2 = w*s, h*s
    return (int(round(cx - w2/2)), int(round(cy - h2/2)),
            int(round(w2)), int(round(h2)))
