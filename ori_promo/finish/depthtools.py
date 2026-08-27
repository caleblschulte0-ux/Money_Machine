#!/usr/bin/env python3
"""Depth-aware shot treatment. Uses the Shorts-pipeline's own pinned
Depth Anything V2 Small (Apache-2.0), verified by SHA-256, loaded from this
scratchpad so nothing is written into that repo.

Why this exists: the first five cuts placed cut-out figures ON TOP of the
picture with a hard edge, a clean-plate sharpness that never matched the shot,
and no occlusion. That is the single biggest reason they read as amateur.
With a depth map we can put a figure AT a depth: everything nearer than it
covers it, it takes the defocus that distance implies, the plate's light wraps
onto its edge, and it carries the plate's own grain."""
import pathlib, subprocess, sys
import numpy as np, cv2

MODEL = pathlib.Path(__file__).resolve().parents[1] / "models" / "depth_anything_v2_small.onnx"
_SESS = None

def session():
    global _SESS
    if _SESS is None:
        import onnxruntime as ort
        so = ort.SessionOptions(); so.intra_op_num_threads = 4
        _SESS = ort.InferenceSession(str(MODEL), so, providers=["CPUExecutionProvider"])
    return _SESS

def depth(bgr, side=518):
    """0..1 depth, 1 = nearest. Matches the engine's own preprocessing."""
    h, w = bgr.shape[:2]
    n = (side // 14) * 14
    img = cv2.resize(bgr, (n, n), interpolation=cv2.INTER_AREA)
    x = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    mean = np.array([0.485, 0.456, 0.406], np.float32)
    std = np.array([0.229, 0.224, 0.225], np.float32)
    x = ((x - mean) / std).transpose(2, 0, 1)[None]
    s = session()
    d = s.run(None, {s.get_inputs()[0].name: x})[0][0]
    d = cv2.resize(d.astype(np.float32), (w, h), interpolation=cv2.INTER_CUBIC)
    lo, hi = float(np.percentile(d, 1)), float(np.percentile(d, 99))
    return np.clip((d - lo) / max(1e-6, hi - lo), 0, 1)

# ------------------------------------------------------------------ optics
def defocus(bgr, dep, focus=0.5, dof=0.30, max_blur=9.0, layers=5):
    """Real depth-of-field: blur grows with distance from the focal plane."""
    coc = np.clip(np.abs(dep - focus) / max(1e-4, dof), 0, 1)
    out = np.zeros_like(bgr, np.float32)
    wsum = np.zeros(bgr.shape[:2], np.float32)
    for i in range(layers):
        lo, hi = i/layers, (i+1)/layers
        r = max_blur * ((lo+hi)/2)**1.25
        b = bgr if r < 0.4 else cv2.GaussianBlur(bgr, (0,0), r)
        m = np.clip(1 - np.abs(coc - (lo+hi)/2)/(1.0/layers), 0, 1).astype(np.float32)
        out += b * m[...,None]; wsum += m
    wsum = np.maximum(wsum, 1e-4)[...,None]
    return out / wsum

def light_wrap(fg_rgba, plate_bgr, amount=0.32, radius=13):
    """the plate's light spills onto the element's edge, so it stops looking
    like a sticker"""
    a = fg_rgba[...,3:4].astype(np.float32)/255.0
    blur = cv2.GaussianBlur(a, (0,0), radius)
    if blur.ndim == 2: blur = blur[..., None]
    edge = np.clip(blur - a, 0, 1)
    wrap = cv2.GaussianBlur(plate_bgr, (0,0), radius) * edge * amount
    rgb = fg_rgba[...,:3].astype(np.float32) + wrap
    return np.dstack([np.clip(rgb,0,255), fg_rgba[...,3]]).astype(np.uint8)

def match_grain(fg_rgba, strength, rng):
    a = fg_rgba[...,3:4].astype(np.float32)/255.0
    h, w = fg_rgba.shape[:2]
    g = rng.normal(0,1,(h//2 or 1, w//2 or 1)).astype(np.float32)
    g = cv2.resize(cv2.GaussianBlur(g,(0,0),0.7),(w,h))[...,None]*strength*255
    rgb = fg_rgba[...,:3].astype(np.float32) + g*a
    return np.dstack([np.clip(rgb,0,255), fg_rgba[...,3]]).astype(np.uint8)

def composite_at_depth(plate_bgr, dep, fg_rgba, x, y, place_depth,
                       *, focus=0.5, dof=0.30, max_blur=9.0,
                       wrap=0.32, grain=0.014, rng=None):
    """Put an element AT a depth in the plate.
    x,y = feet centre. place_depth = 0..1 (1 nearest)."""
    rng = rng or np.random.default_rng(3)
    h, w = plate_bgr.shape[:2]
    fh, fw = fg_rgba.shape[:2]
    x0, y0 = int(x - fw/2), int(y - fh)
    sx0, sy0 = max(0,x0), max(0,y0)
    sx1, sy1 = min(w,x0+fw), min(h,y0+fh)
    if sx1 <= sx0 or sy1 <= sy0: return plate_bgr
    crop = fg_rgba[sy0-y0:sy1-y0, sx0-x0:sx1-x0].copy()
    under = plate_bgr[sy0:sy1, sx0:sx1]
    # the element takes the defocus its distance implies
    r = max_blur * min(1.0, abs(place_depth-focus)/max(1e-4,dof))**1.25
    if r > 0.4:
        rgb = cv2.GaussianBlur(crop[...,:3], (0,0), r)
        al  = cv2.GaussianBlur(crop[...,3],  (0,0), r)
        crop = np.dstack([rgb, al])
    crop = light_wrap(crop, under, wrap)
    crop = match_grain(crop, grain, rng)
    a = (crop[...,3:4].astype(np.float32)/255.0)
    # OCCLUSION: anything nearer than the element covers it
    near = (dep[sy0:sy1, sx0:sx1] > place_depth + 0.035).astype(np.float32)
    near = cv2.GaussianBlur(near, (0,0), 1.1)[...,None]
    a = a * (1.0 - near)
    out = plate_bgr.copy().astype(np.float32)
    out[sy0:sy1, sx0:sx1] = under*(1-a) + crop[...,:3].astype(np.float32)*a
    return out
