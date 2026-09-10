#!/usr/bin/env python3
"""v36 "How the System Works" -- graphics kit: a dark animated system
map. Its own visual language (near-black field, cyan path, amber
place-nodes) -- not v33's HUD, not v34's paper panels, not v35's plain
white-on-real-footage minimalism.

fade_k is the same corrected formula v35's graphics_walk.py landed on
after finding a real bug in the shared pattern (see that file's own
header): out_margin alone does not hold opacity at 1.0 through the true
last frame -- the release ease always completes exactly at t=dur. A
genuine no_out flag (skip the release multiplier entirely) is what
actually holds. Reused here from the start, not re-discovered.
"""
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

_FDIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                      "fonts", "inter", "extras", "ttf")

W, H = 1920, 1080

BG = (14, 16, 19)              # near-black graphite, RGB
CYAN = (130, 225, 235)         # cool signal color -- the active path
AMBER = (232, 176, 118)        # warm accent -- physical-place nodes only
OFFWHITE = (232, 234, 236)
DIM = (58, 63, 70)             # unlit path / pending node

_FONT_CACHE = {}


def font(weight, sz):
    key = (weight, sz)
    if key not in _FONT_CACHE:
        _FONT_CACHE[key] = ImageFont.truetype(f"{_FDIR}/Inter-{weight}.ttf", sz)
    return _FONT_CACHE[key]


def ease(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def fade_k(t, dur, in_t=0.35, out_margin=0.4, no_out=False):
    """no_out=True skips the release multiplier entirely -- confirmed by
    direct calculation (v35's r175 finding) that zeroing out_margin alone
    still ramps to ~2.5% opacity one frame before the end."""
    k = ease(min(1.0, t / in_t)) if in_t > 0 else 1.0
    if not no_out:
        k *= ease(min(1.0, max(0.0, (dur - out_margin - t) / 0.35)))
    return k


def background():
    """A very slight radial vignette, near-black -- no grid (explicitly
    ruled out by r178)."""
    img = Image.new("RGB", (W, H), BG)
    # soft vignette: darker at corners
    vign = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(vign)
    cx, cy = W // 2, int(H * 0.46)
    maxr = int(math.hypot(W, H) * 0.6)
    for i in range(24):
        r = maxr - i * (maxr // 24)
        a = int(10 * (i / 24))
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=a)
    vign = vign.filter(ImageFilter.GaussianBlur(80))
    dark = Image.new("RGB", (W, H), (6, 7, 8))
    img = Image.composite(img, dark, vign)
    return img.convert("RGBA")


def _shadow_text(d, xy, s, f, fill, anchor="la"):
    x, y = xy
    d.text((x + 1, y + 1), s, font=f, fill=(0, 0, 0, min(255, int(fill[3] * 0.6)) if len(fill) > 3 else 140), anchor=anchor)
    d.text((x, y), s, font=f, fill=fill, anchor=anchor)


def path_length(points):
    return sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(points, points[1:]))


def point_at_fraction(points, frac):
    """Position along a polyline at cumulative-length fraction frac (0..1)."""
    total = path_length(points)
    if total <= 0:
        return points[0]
    target = total * max(0.0, min(1.0, frac))
    acc = 0.0
    for a, b in zip(points, points[1:]):
        seg = math.hypot(b[0] - a[0], b[1] - a[1])
        if acc + seg >= target:
            u = (target - acc) / seg if seg > 0 else 0.0
            return (a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u)
        acc += seg
    return points[-1]


def draw_path(img, points, lit_frac, glow=True, width=3, k=1.0):
    """The persistent path: DIM grey for its full length (so the whole
    intended route previews lightly), CYAN + glow up to lit_frac."""
    d = ImageDraw.Draw(img, "RGBA")
    dim_a = int(150 * k)
    d.line(points, fill=DIM + (dim_a,), width=width, joint="curve")
    if lit_frac <= 0:
        return
    tip = point_at_fraction(points, lit_frac)
    lit_pts = [points[0]]
    acc = 0.0
    total = path_length(points)
    target = total * lit_frac
    for a, b in zip(points, points[1:]):
        seg = math.hypot(b[0] - a[0], b[1] - a[1])
        if acc + seg >= target:
            lit_pts.append(tip)
            break
        lit_pts.append(b)
        acc += seg
    a = int(235 * k)
    if glow:
        glow_img = Image.new("RGBA", img.size, (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow_img)
        gd.line(lit_pts, fill=CYAN + (int(a * 0.9),), width=width + 6, joint="curve")
        glow_img = glow_img.filter(ImageFilter.GaussianBlur(6))
        img.alpha_composite(glow_img)
    d.line(lit_pts, fill=CYAN + (a,), width=width, joint="curve")
    d.ellipse([tip[0] - 5, tip[1] - 5, tip[0] + 5, tip[1] + 5], fill=CYAN + (a,))


def node_state_color(color_key, state):
    base = AMBER if color_key == "amber" else CYAN if color_key == "neutral" else OFFWHITE
    if state == "pending":
        return DIM
    return base


def draw_node(img, node, state, k=1.0, label_side="below", pulse=0.0,
              font_size=24, sub_label=None, sub_font_size=38, ring_r=20):
    """state: 'pending' (dim, no label) | 'active' (bright, pulsing ring)
    | 'done' (steady bright, label shown).

    r180's mobile-legibility pass: font_size and ring_r are now callable
    parameters (were hardcoded 24 / 20) so the loop section can draw
    52px primary node labels with an optional 30px sub_label ("reusable
    hardware" etc.) beneath, without changing any other section's
    call sites, which still get the original defaults."""
    x, y, label, color_key, kind = node
    d = ImageDraw.Draw(img, "RGBA")
    color = node_state_color(color_key, state)
    r = ring_r
    if state == "active":
        r = ring_r + int(6 * (0.5 + 0.5 * math.sin(pulse * math.pi * 2)))
    a = int(235 * k)
    d.ellipse([x - r, y - r, x + r, y + r], outline=color + (a,), width=3)
    if state in ("active", "done"):
        d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=color + (a,))
    if state == "done":
        f = font("SemiBold", font_size)
        fs = font("Medium", sub_font_size) if sub_label else None
        ly = y + r + 14 if label_side == "below" else y - r - 14
        anchor = "ma" if label_side == "below" else "md"
        w = d.textlength(label.upper(), font=f)
        sw = d.textlength(sub_label, font=fs) if sub_label else 0
        bw = max(w, sw)
        pad = 10
        box_h = font_size + 10 + (sub_font_size + 8 if sub_label else 0)
        if label_side == "below":
            d.rectangle([x - bw / 2 - pad, ly - 4, x + bw / 2 + pad, ly + box_h],
                        fill=(8, 9, 11, int(160 * k)))
            _shadow_text(d, (x, ly + font_size * 0.5 + 2), label.upper(), f, OFFWHITE + (a,), anchor="mm")
            if sub_label:
                _shadow_text(d, (x, ly + font_size + 12 + sub_font_size * 0.5), sub_label, fs,
                             CYAN + (int(a * 0.9),), anchor="mm")
        else:
            d.rectangle([x - bw / 2 - pad, ly - box_h, x + bw / 2 + pad, ly + 4],
                        fill=(8, 9, 11, int(160 * k)))
            _shadow_text(d, (x, ly - box_h + font_size * 0.5 + 2), label.upper(), f, OFFWHITE + (a,), anchor="mm")
            if sub_label:
                _shadow_text(d, (x, ly - 8 - int(font_size * 0.275)), sub_label, fs,
                             CYAN + (int(a * 0.9),), anchor="mm")


def small_aperture(img, content_rgb_float, cx, cy, r, ring_color, k=1.0):
    """A circular real-footage/plate inset on the dark map field, with a
    soft glow ring in the node's color. The WHOLE source frame is scaled
    down to "cover" the aperture (CSS background-size:cover) and
    center-cropped to a square, so the inset shows the whole subject
    small -- not an unscaled peek at whatever pixels happened to sit at
    (cx,cy) in the full 1920x1080 source, which is what masking the
    source directly at that position did (a real bug: the first hwsw
    render showed an unrecognizable sliver of the glasses plate instead
    of the glasses)."""
    content = Image.fromarray(np.clip(content_rgb_float, 0, 255).astype(np.uint8)[:, :, ::-1])
    d0 = 2 * r
    cw, ch = content.size
    scale = d0 / min(cw, ch)
    rw, rh = int(round(cw * scale)), int(round(ch * scale))
    content = content.resize((rw, rh), Image.LANCZOS)
    left, top = (rw - d0) // 2, (rh - d0) // 2
    content = content.crop((left, top, left + d0, top + d0))

    mask = Image.new("L", (d0, d0), 0)
    md = ImageDraw.Draw(mask)
    md.ellipse([0, 0, d0, d0], fill=int(255 * k))
    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([cx - r - 4, cy - r - 4, cx + r + 4, cy + r + 4], outline=ring_color + (int(220 * k),), width=4)
    glow = glow.filter(ImageFilter.GaussianBlur(3))
    img.paste(content.convert("RGBA"), (cx - r, cy - r), mask)
    img.alpha_composite(glow)
    d = ImageDraw.Draw(img, "RGBA")
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=ring_color + (int(235 * k),), width=2)


def rect_aperture(img, content_rgb_float, cx, cy, w, h, ring_color, k=1.0, radius=28):
    """A rounded-rectangle real-footage inset -- r180's replacement for
    the persistent PLACE circle, which the review judged too small/
    decorative ("a tiny persistent location circle does not satisfy
    real Falls Park footage appears in every major section and does not
    become decorative background"). Same cover-scale-then-crop logic as
    small_aperture, just a rounded rect instead of a circle."""
    content = Image.fromarray(np.clip(content_rgb_float, 0, 255).astype(np.uint8)[:, :, ::-1])
    cw, ch = content.size
    scale = max(w / cw, h / ch)
    rw, rh = int(round(cw * scale)), int(round(ch * scale))
    content = content.resize((rw, rh), Image.LANCZOS)
    left, top = (rw - w) // 2, (rh - h) // 2
    content = content.crop((left, top, left + w, top + h))

    x0, y0 = cx - w // 2, cy - h // 2
    mask = Image.new("L", (w, h), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, w, h], radius=radius, fill=int(255 * k))
    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.rounded_rectangle([x0 - 4, y0 - 4, x0 + w + 4, y0 + h + 4], radius=radius + 4,
                          outline=ring_color + (int(220 * k),), width=4)
    glow = glow.filter(ImageFilter.GaussianBlur(3))
    img.paste(content.convert("RGBA"), (x0, y0), mask)
    img.alpha_composite(glow)
    d = ImageDraw.Draw(img, "RGBA")
    d.rounded_rectangle([x0, y0, x0 + w, y0 + h], radius=radius, outline=ring_color + (int(235 * k),), width=2)


def full_bleed(content_rgb_float):
    """Edge-to-edge real footage -- map elements are drawn ON TOP of this
    by the caller, not masked into it."""
    return Image.fromarray(np.clip(content_rgb_float, 0, 255).astype(np.uint8)[:, :, ::-1]).convert("RGBA")


def dim_overlay(img, k):
    if k <= 0:
        return
    d = ImageDraw.Draw(img, "RGBA")
    d.rectangle([0, 0, W, H], fill=(6, 7, 8, int(140 * k)))


def system_diagram_tag(img, k=1.0, font_size=38):
    """"SYSTEM DIAGRAM" -- r178's own explicit instruction: label the
    map sequence so it cannot be mistaken for evidence of a deployed
    interface. Held continuously while the map is dominant, discreet
    corner, same "no shared fade envelope" discipline as a disclosure
    tag. font_size is callable; r183 raised the default from 20 to 38
    (r182's own minimum) so every call site -- with or without an
    explicit override -- renders uniformly at 38px."""
    d = ImageDraw.Draw(img, "RGBA")
    text = "SYSTEM DIAGRAM"
    f = font("Medium", font_size)
    lh = int(font_size * 1.1)
    tw = d.textlength(text, font=f)
    x, y = W - 36 - tw, H - 32 - lh
    a = int(190 * k)
    d.rectangle([x - 4, y - 4, x + tw + 4, y + lh + 4], fill=(8, 9, 11, int(120 * k)))
    _shadow_text(d, (x, y), text, f, OFFWHITE + (a,))


def disclosure(img, text="PRODUCT VISUALIZATION", corner="tr", k=1.0, font_size=22):
    """Held continuously by construction (k defaults to 1.0, no fade
    envelope) -- same discipline as graphics_walk.py's disclosure().
    font_size is now callable (r180's mobile-legibility pass wants
    disclosures at least 38px in the dark-field sections); default 22
    is unchanged so place/zone/close render exactly as before."""
    d = ImageDraw.Draw(img, "RGBA")
    f = font("SemiBold", font_size)
    lh = int(font_size * 1.05)
    tw = d.textlength(text, font=f)
    pad = max(4, int(font_size * 0.18))
    if corner == "tr":
        x, y = W - 40 - tw, 40
    elif corner == "tl":
        x, y = 40, 40
    else:
        x, y = W - 40 - tw, H - 40 - lh
    a = int(230 * k)
    d.rectangle([x - pad, y - pad, x + tw + pad, y + lh + pad], fill=(0, 0, 0, int(150 * k)))
    _shadow_text(d, (x, y), text, f, OFFWHITE + (a,))
    d.line([(x, y + lh + 5), (x + tw, y + lh + 5)], fill=CYAN + (int(200 * k),), width=1)


def caption(img, t, dur, text, k=None, y_frac=0.88, font_size=40):
    """font_size is now callable (r180 wants primary captions at least
    52px in the dark-field sections); default 40 is unchanged so
    place/zone/close render exactly as before."""
    if k is None:
        k = fade_k(t, dur)
    if k <= 0:
        return
    d = ImageDraw.Draw(img, "RGBA")
    f = font("SemiBold", font_size)
    s = text.upper()
    tw = d.textlength(s, font=f)
    x, y = W / 2, H * y_frac
    pad = 14
    box_h = font_size * 0.75
    a = int(240 * k)
    d.rectangle([x - tw / 2 - pad, y - box_h, x + tw / 2 + pad, y + box_h], fill=(8, 9, 11, int(150 * k)))
    _shadow_text(d, (x, y), s, f, OFFWHITE + (a,), anchor="mm")


def section_label(img, t, dur, text, k=None):
    """Small top-left label naming the current section (THE PLACE, etc.)
    -- same weight/placement idea across every section for consistency."""
    if k is None:
        k = fade_k(t, dur, in_t=0.3, out_margin=0.5)
    if k <= 0:
        return
    d = ImageDraw.Draw(img, "RGBA")
    f = font("SemiBold", 28)
    a = int(235 * k)
    d.rectangle([0, 0, 420, 84], fill=(8, 9, 11, int(140 * k)))
    _shadow_text(d, (40, 42), text.upper(), f, OFFWHITE + (a,), anchor="lm")


def end_card(img, t, dur, line1, line2, k=None):
    if k is None:
        k = fade_k(t, dur, in_t=0.4, no_out=True)
    if k <= 0:
        return
    d = ImageDraw.Draw(img, "RGBA")
    a = int(250 * k)
    f1 = font("Bold", 54)
    f2 = font("Medium", 28)
    cy = H // 2 - 16
    w1 = d.textlength(line1, font=f1)
    w2 = d.textlength(line2, font=f2)
    w = max(w1, w2)
    d.rectangle([W // 2 - w / 2 - 32, cy - 52, W // 2 + w / 2 + 32, cy + 72],
                fill=(6, 7, 8, int(160 * k)))
    _shadow_text(d, (W // 2, cy), line1, f1, OFFWHITE + (a,), anchor="mm")
    _shadow_text(d, (W // 2, cy + 48), line2, f2, CYAN + (int(a * 0.9),), anchor="mm")
