#!/usr/bin/env python3
"""Lens Mode -- r231 (ChatGPT's strategy direction, following the
operator's flat rejection of every windowed_reveal build back to r196:
"you just put an image over an image and then soften the edges... not
Apple level production"). No separate photographic plate is ever
composited over real footage again, at any opacity, in any shape. There
is no window, card, border, or soft photo edge for anything real to have
to line up against, because there is no second image:

  1. The REAL frame itself is graded (desaturated, exposure-compressed)
     across its ENTIRE area -- one transformation, not a bounded region.
  2. A sparse contour field is derived from THAT SAME frame's own pixels
     (Canny edges on the real footage, not a foreign image), so its
     geometry is by construction the real scene's geometry.
  3. "Meaning" (the mammoth herd, and future eras/hardware) renders as a
     hand-drawn vector silhouette -- warm-white/orange, additive
     (screen) blended, materializing via a noise-threshold dissolve
     rather than a plain cross-fade -- never a photograph, never
     claiming to share the real camera's lighting or perspective.

Classical CV + hand-authored vector drawing throughout (cv2 Canny/
resize/blur, PIL ImageDraw polygons and bezier-sampled curves) -- the
same category of technique as graphics_layer.py's corner brackets and
rim glow, or data_learning/mascot_director.py's procedural rig. No AI
image generation anywhere in this module.
"""
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from graphics_layer import ease, full_bleed

WARM_FILL = (255, 214, 170)
WARM_LINE = (255, 150, 60)


# ---- procedural mammoth silhouette (vector, not photo-derived) --------

def _bezier(p0, p1, p2, n=24):
    t = np.linspace(0, 1, n)[:, None]
    p0, p1, p2 = np.array(p0), np.array(p1), np.array(p2)
    pts = (1 - t) ** 2 * p0 + 2 * (1 - t) * t * p1 + t ** 2 * p2
    return [tuple(p) for p in pts]


def _mammoth_points(cx, cy, scale, flip=False):
    s = scale

    def pt(x, y):
        x = x * (-1 if flip else 1)
        return (cx + x * s, cy + y * s)

    body = [pt(x, y) for x, y in [
        (-46, 4), (-44, -14), (-30, -30), (-10, -40), (14, -38),
        (28, -28), (33, -14), (34, 0), (30, 10), (14, 16),
        (-22, 16), (-42, 12),
    ]]
    head = [pt(x, y) for x, y in [
        (26, -22), (38, -24), (48, -16), (50, -2), (44, 8),
        (32, 8), (24, -4),
    ]]
    ear = [pt(x, y) for x, y in [
        (30, -16), (37, -24), (43, -19), (40, -10), (32, -8),
    ]]
    trunk = _bezier(pt(46, 6), pt(56, 16), pt(52, 30))
    trunk += _bezier(pt(52, 30), pt(48, 40), pt(38, 42))[1:]
    tusk_hi = _bezier(pt(40, 4), pt(58, 2), pt(68, -12))
    tusk_lo = _bezier(pt(38, 9), pt(54, 12), pt(62, 2))
    legs = []
    for lx, phase in [(-32, 0), (-10, 1), (12, 0), (28, 1)]:
        off = 5 if phase else -5
        legs.append([pt(x, y) for x, y in [
            (lx - 7, 10), (lx + 7, 10), (lx + 7 + off, 40), (lx - 7 + off, 40),
        ]])
    hump = _bezier(pt(-44, -14), pt(-14, -44), pt(16, -36))
    return {"body": body, "head": head, "ear": ear, "trunk": trunk,
            "tusk_hi": tusk_hi, "tusk_lo": tusk_lo, "legs": legs, "hump": hump}


def draw_mammoth(draw, cx, cy, scale, flip=False, fill=WARM_FILL + (255,),
                  line=WARM_LINE + (255,), width=3):
    g = _mammoth_points(cx, cy, scale, flip)
    for leg in g["legs"]:
        draw.polygon(leg, fill=fill)
    draw.polygon(g["body"], fill=fill)
    draw.polygon(g["head"], fill=fill)
    draw.polygon(g["ear"], fill=fill)
    draw.line(g["trunk"], fill=fill, width=max(2, int(9 * scale)), joint="curve")
    draw.line(g["hump"], fill=line, width=width, joint="curve")
    draw.line(g["tusk_hi"], fill=line, width=width, joint="curve")
    draw.line(g["tusk_lo"], fill=line, width=width, joint="curve")


# ---- whole-frame optical transform (operates on the REAL frame only) --

def lens_grade(world_bgr, amount):
    """Desaturate + compress exposure across the entire frame, blended by
    amount 0..1. amount<=0 returns the input untouched."""
    if amount <= 0.0:
        return world_bgr
    x = world_bgr.astype(np.float32)
    gray = x.mean(axis=2, keepdims=True)
    desat = x * 0.45 + gray * 0.55
    compressed = desat * 0.82 + 128.0 * 0.18
    return x * (1 - amount) + compressed * amount


def contour_field_layer(world_bgr, alpha_scale, w, h, color=WARM_LINE):
    """Sparse glowing contour lines derived directly from THIS frame's own
    pixels (downsampled Canny, then blurred) -- 'the glasses reading the
    scene,' never a foreign image. Deliberately faint and sparse so the
    frame stays mostly quiet (spec: >=80% visually quiet)."""
    if alpha_scale <= 0.0:
        return None
    src = np.clip(world_bgr, 0, 255).astype(np.uint8)
    small = cv2.resize(src, (max(1, w // 3), max(1, h // 3)), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    gray = cv2.bilateralFilter(gray, 5, 40, 40)
    edges = cv2.Canny(gray, 60, 140)
    edges = cv2.resize(edges, (w, h), interpolation=cv2.INTER_LINEAR)
    _, edges = cv2.threshold(edges, 40, 255, cv2.THRESH_BINARY)
    glow = cv2.GaussianBlur(edges, (0, 0), 2.2)
    a = (glow.astype(np.float32) / 255.0) * alpha_scale * 0.5
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[..., 0], rgba[..., 1], rgba[..., 2] = color
    rgba[..., 3] = np.clip(a * 255, 0, 255).astype(np.uint8)
    return rgba


_NOISE_CACHE = {}


def _reveal_noise(w, h, seed=7):
    key = (w, h, seed)
    if key in _NOISE_CACHE:
        return _NOISE_CACHE[key]
    rng = np.random.default_rng(seed)
    small = rng.random((14, 36)).astype(np.float32)
    noise = cv2.resize(small, (w, h), interpolation=cv2.INTER_CUBIC)
    noise = cv2.GaussianBlur(noise, (0, 0), 6)
    noise = (noise - noise.min()) / max(1e-6, (noise.max() - noise.min()))
    _NOISE_CACHE[key] = noise
    return noise


def _local_noise(bw, bh, seed=11, cell=14):
    """Noise sized relative to the shape's OWN bounding box (not the full
    frame) -- grain small enough that a dissolve is actually visible
    within a ~250px-wide silhouette, instead of one huge blob-scale patch
    that just reads as a plain opacity fade."""
    rng = np.random.default_rng(seed)
    gw, gh = max(2, bw // cell), max(2, bh // cell)
    small = rng.random((gh, gw)).astype(np.float32)
    noise = cv2.resize(small, (bw, bh), interpolation=cv2.INTER_CUBIC)
    noise = cv2.GaussianBlur(noise, (0, 0), max(1.0, cell * 0.25))
    lo, hi = noise.min(), noise.max()
    return (noise - lo) / max(1e-6, hi - lo)


def mammoth_reveal_layer(w, h, progress, anchor, scale=1.0):
    """One warm-white/orange 'memory form' (a small mammoth herd),
    materializing via a noise-threshold dissolve -- patches of the shape
    appear where local noise is lowest, spreading until the whole form
    is solid at progress=1 -- not a plain cross-fade of a raster."""
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas)
    cx, cy = anchor
    draw_mammoth(d, cx, cy, 1.05 * scale, width=4)
    draw_mammoth(d, cx - 165 * scale, cy + 18 * scale, 0.72 * scale, width=3)
    draw_mammoth(d, cx - 290 * scale, cy + 30 * scale, 0.46 * scale, width=2)

    shape_alpha = np.array(canvas)[..., 3].astype(np.float32) / 255.0
    ys, xs = np.where(shape_alpha > 0.01)
    if len(xs) == 0:
        return np.array(canvas)
    pad = 30
    x0, x1 = max(0, xs.min() - pad), min(w, xs.max() + pad)
    y0, y1 = max(0, ys.min() - pad), min(h, ys.max() + pad)

    noise_local = _local_noise(x1 - x0, y1 - y0)
    noise_full = np.ones((h, w), dtype=np.float32)
    noise_full[y0:y1, x0:x1] = noise_local

    band = 0.22
    reveal = np.clip((progress - noise_full) / band + 0.5, 0.0, 1.0)
    final_alpha = shape_alpha * reveal

    rgb = np.array(canvas.convert("RGB"))
    out_rgba = np.zeros((h, w, 4), dtype=np.uint8)
    out_rgba[..., :3] = rgb
    out_rgba[..., 3] = np.clip(final_alpha * 255, 0, 255).astype(np.uint8)

    glow_src = out_rgba.copy()
    glow_src[..., 3] = (glow_src[..., 3].astype(np.float32) * 0.35).astype(np.uint8)
    glow_img = Image.fromarray(glow_src, "RGBA").filter(ImageFilter.GaussianBlur(5))
    combo = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    combo.alpha_composite(glow_img)
    combo.alpha_composite(Image.fromarray(out_rgba, "RGBA"))
    return np.array(combo)


def screen_blend(base_rgb_uint8, overlay_rgba):
    """Additive-feeling screen blend, weighted by the overlay's own
    alpha -- content reads as projected light, never a pasted layer."""
    if overlay_rgba is None:
        return base_rgb_uint8
    ov = overlay_rgba.astype(np.float32)
    ov_rgb, ov_a = ov[..., :3] / 255.0, ov[..., 3:4] / 255.0
    base = base_rgb_uint8.astype(np.float32) / 255.0
    screened = 1 - (1 - base) * (1 - ov_rgb)
    out = base * (1 - ov_a) + screened * ov_a
    return np.clip(out * 255, 0, 255).astype(np.uint8)


# ---- hook proof composition (r231's exact 4-beat timing) ---------------

def hook_lens_frame(world_bgr, t, w, h, anchor=(950, 410), scale=1.15):
    """t in seconds over the hook's 8.0s. Returns a PIL RGBA image, ready
    for the existing primary_label/disclosure calls on top."""
    if t < 1.8:
        grade_amt = contour_amt = mammoth_p = 0.0
    elif t < 2.4:
        grade_amt = ease((t - 1.8) / 0.6)
        contour_amt = mammoth_p = 0.0
    elif t < 4.2:
        grade_amt = 1.0
        contour_amt = ease((t - 2.4) / 1.8)
        mammoth_p = 0.0
    elif t < 6.8:
        grade_amt = 1.0
        mammoth_p = ease((t - 4.2) / 2.6)
        contour_amt = max(0.35, 1.0 - 0.5 * mammoth_p)
    elif t < 8.0:
        r = ease((t - 6.8) / 1.2)
        mammoth_p = 1.0 - r
        contour_amt = 0.35 * (1 - r)
        grade_amt = 1.0 - r
    else:
        grade_amt = contour_amt = mammoth_p = 0.0

    graded = lens_grade(world_bgr, grade_amt)
    img = full_bleed(graded)
    base_rgb = np.array(img.convert("RGB"))

    contours = contour_field_layer(world_bgr, contour_amt, w, h)
    base_rgb = screen_blend(base_rgb, contours)

    if mammoth_p > 0.001:
        mam = mammoth_reveal_layer(w, h, mammoth_p, anchor, scale)
        base_rgb = screen_blend(base_rgb, mam)

    return Image.fromarray(base_rgb).convert("RGBA")
