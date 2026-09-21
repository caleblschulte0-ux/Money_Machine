"""Cheap appearance descriptors for re-identification (Phase 2, first rung).

An HSV colour histogram of the box is enough to tell an orange fish from a
blue one after an occlusion. It is not enough to tell two identical
neon tetras apart, and the similarity score is exposed so nobody pretends
otherwise. Deep re-id embeddings can replace ``describe`` without touching
the tracker.
"""

from __future__ import annotations

import cv2
import numpy as np

from fishai.types import BBox

_H_BINS, _S_BINS = 16, 8


def describe(image: np.ndarray, box: BBox) -> np.ndarray | None:
    """Return a normalised H/S histogram of the box interior, or None if empty."""
    h, w = image.shape[:2]
    x1, y1 = int(max(0, box.x1)), int(max(0, box.y1))
    x2, y2 = int(min(w, box.x2)), int(min(h, box.y2))
    if x2 - x1 < 2 or y2 - y1 < 2:
        return None
    crop = image[y1:y2, x1:x2]
    # Shrink the box a little so background pixels at the edges count less.
    inset_x, inset_y = int(crop.shape[1] * 0.15), int(crop.shape[0] * 0.15)
    if crop.shape[1] - 2 * inset_x >= 2 and crop.shape[0] - 2 * inset_y >= 2:
        crop = crop[inset_y : crop.shape[0] - inset_y, inset_x : crop.shape[1] - inset_x]
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    hist = cv2.calcHist([hsv], [0, 1], None, [_H_BINS, _S_BINS], [0, 180, 0, 256])
    cv2.normalize(hist, hist, alpha=1.0, norm_type=cv2.NORM_L1)
    return hist.flatten().astype(np.float32)


def similarity(a: np.ndarray | None, b: np.ndarray | None) -> float:
    """Histogram intersection in 0..1 (1 = identical distribution)."""
    if a is None or b is None:
        return 0.0
    return float(np.minimum(a, b).sum())


def blend(old: np.ndarray | None, new: np.ndarray | None, alpha: float = 0.1) -> np.ndarray | None:
    if old is None:
        return new
    if new is None:
        return old
    return (1.0 - alpha) * old + alpha * new
