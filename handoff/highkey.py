#!/usr/bin/env python3
"""Film B's HIGH-KEY signature, restored after normalization.

The rebuild normalized every shot to a common black and white -- correct, and
it is what lets one finish carry the film -- but that plus the finish's toe and
vignette dropped the film's mean luminance from 0.590 (v1) to 0.464. Film B's
doctrine is "warm, HIGH-KEY ... a home movie with a good eye", and v1 carried
that in an explicit curve: 0 -> 0.058, 0.5 -> 0.532, 1 -> 0.978, which lifts the
blacks off the floor and pushes the midtone up.

Normalization is technical and identity-neutral. This is the identity, applied
after it, exactly as Film D keeps its cool grade and Film B its warm one. Same
control points as v1 so the look is the film's own, not a new invention.

Applied to LUMINANCE with the gain carried to all three channels, so it lifts
without shifting hue -- the same discipline as shotnorm and filmfinish.
"""
import numpy as np

# v1's curve, verbatim
PTS = [(0.0, 0.058), (0.5, 0.532), (1.0, 0.978)]

def _curve(x):
    xs = np.array([p[0] for p in PTS], np.float32)
    ys = np.array([p[1] for p in PTS], np.float32)
    return np.interp(np.clip(x, 0, 1), xs, ys).astype(np.float32)

def apply(bgr):
    lum = np.maximum(0.114*bgr[...,0] + 0.587*bgr[...,1] + 0.299*bgr[...,2], 1e-4)
    out = _curve(lum)
    return np.clip(bgr * (out / lum)[..., None], 0.0, 1.0)
