#!/usr/bin/env python3
"""v37 "THE WORLD / THE LAYER" -- graphics kit: a bright editorial
transformation grammar. Its own visual language (daylight footage, one
coral accent, directional wipes) -- not v33's premium HUD, not v34's
paper panels, not v35's plain white-on-real-footage minimalism, not
v36's dark technical field.

fade_k carries v35/v36's own corrected formula from the start: a
genuine no_out flag that skips the release multiplier entirely (out_margin
alone does not hold opacity at 1.0 through the true last frame -- the
release ease always completes exactly at t=dur). Not re-discovered here,
reused because it is already known-correct.

Every font size below already starts at r184's own stated minimum
(primary labels 72px+, captions 52px+, disclosures/secondary 38px+) --
v36 needed three review rounds to reach its own late-supplied minimums;
this style gives them to itself on the first pass.
"""
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

_FDIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                      "fonts", "inter", "extras", "ttf")

W, H = 1920, 1080

ACCENT = (235, 66, 58)           # coral-red, RGB -- the ONE saturated
                                  # accent: wipe seams, zone-trace
                                  # brackets, the anchor pulse, and
                                  # primary-label scrim boxes only.
                                  # Never body/caption text color itself.
OFFWHITE = (245, 246, 248)
DARKSCRIM = (10, 10, 12)

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
    """no_out=True skips the release multiplier entirely -- v35/v36's own
    finding, carried in from the start: zeroing out_margin alone still
    ramps to ~2.5% opacity one frame before the end, because the release
    ease always completes exactly at t=dur regardless of out_margin."""
    k = ease(min(1.0, t / in_t)) if in_t > 0 else 1.0
    if not no_out:
        k *= ease(min(1.0, max(0.0, (dur - out_margin - t) / 0.35)))
    return k


def _shadow_text(d, xy, s, f, fill, anchor="la"):
    x, y = xy
    d.text((x + 1, y + 1), s, font=f, fill=(0, 0, 0, min(255, int(fill[3] * 0.6)) if len(fill) > 3 else 140), anchor=anchor)
    d.text((x, y), s, font=f, fill=fill, anchor=anchor)


def full_bleed(content_rgb_float):
    """Edge-to-edge real footage -- every overlay in this style is drawn
    ON TOP of this by the caller, never masked into it. content_rgb_float
    is a BGR float array (the pipeline's own convention, matching
    ffmpeg's rawvideo bgr24 output)."""
    return Image.fromarray(np.clip(content_rgb_float, 0, 255).astype(np.uint8)[:, :, ::-1]).convert("RGBA")


def wipe_reveal(world_bgr, layer_bgr, progress, direction="ltr", edge=90):
    """The core recurring device: WORLD (real footage) transforming into
    LAYER (a plate or a different real-footage still) across a moving,
    softly-feathered boundary, with a coral seam line drawn at the
    boundary while it's mid-sweep. direction in {"ltr","ttb","diag"} so
    no two reveals in the film move the same way (r184's own explicit
    "distinct reveal directions" requirement for the examples, applied
    everywhere a wipe is used). progress 0.0 = pure world, 1.0 = pure
    layer; boundary sweeps from fully off one edge to fully off the
    other, so both ends are naturally feathered.

    Both inputs are the same HxWx3 BGR array (uint8 or float, either
    works -- see the progress<=0/>=1 shortcuts below). Returns a PIL RGBA
    image ready for further caption/label drawing on top.

    progress<=0.0 or >=1.0 skip the blend entirely and hand the relevant
    frame straight to full_bleed(), which is cheap even on uint8 input
    (clip+astype is a near-no-op there). Converting a whole clip's worth
    of frames to float32 up front measured ~35s of genuine CPU-bound
    work for 240 1920x1080 frames on this machine -- most frames in most
    sections have progress at a hard 0 or 1 and never needed that
    conversion at all; only the actual transition window (a couple of
    seconds) does the float math, and only for the two frames it touches
    each call, not a whole preloaded clip."""
    if progress <= 0.0:
        return full_bleed(world_bgr)
    if progress >= 1.0:
        return full_bleed(layer_bgr)
    h, w = world_bgr.shape[:2]
    if direction == "ltr":
        coord = np.tile(np.arange(w, dtype=np.float32), (h, 1))
        extent = float(w)
    elif direction == "ttb":
        coord = np.tile(np.arange(h, dtype=np.float32).reshape(h, 1), (1, w))
        extent = float(h)
    elif direction == "diag":
        xs = np.arange(w, dtype=np.float32).reshape(1, w) * (h / w)
        ys = np.arange(h, dtype=np.float32).reshape(h, 1)
        coord = xs + ys
        extent = float(coord.max())
    else:
        raise ValueError(direction)
    boundary = progress * (extent + 2 * edge) - edge
    alpha = np.clip((boundary - coord) / edge, 0.0, 1.0)
    alpha3 = alpha[:, :, None]
    out = world_bgr.astype(np.float32) * (1.0 - alpha3) + layer_bgr.astype(np.float32) * alpha3
    img = full_bleed(out)
    if 0.0 < progress < 1.0:
        d = ImageDraw.Draw(img, "RGBA")
        if direction == "ltr":
            x = int(boundary)
            d.line([(x, 0), (x, h)], fill=ACCENT + (235,), width=5)
        elif direction == "ttb":
            y = int(boundary)
            d.line([(0, y), (w, y)], fill=ACCENT + (235,), width=5)
        else:
            pts = []
            for x in range(-40, w + 40, 32):
                y = boundary - x * (h / w)
                if -80 <= y <= h + 80:
                    pts.append((x, y))
            if len(pts) >= 2:
                d.line(pts, fill=ACCENT + (235,), width=5)
    return img


def primary_label(img, text, k=1.0, y_frac=0.14, font_size=84, accent_bg=True):
    """A big bold idea label (r184's own 72px+ minimum, given headroom
    here). accent_bg=True (the "THE WORLD"/"THE LAYER" hook toggle and
    each beat's own opening label) puts it in the one saturated accent
    color -- the film's single reserved use of ACCENT as a fill rather
    than a line/stroke. accent_bg=False falls back to the same dark
    scrim every other text element uses, for a label that shouldn't
    compete with an accent-colored graphic already on screen."""
    d = ImageDraw.Draw(img, "RGBA")
    f = font("Black", font_size)
    s = text.upper()
    tw = d.textlength(s, font=f)
    x, y = W / 2, H * y_frac
    pad = 26
    box_h = font_size * 0.72
    a = int(235 * k)
    if accent_bg:
        d.rectangle([x - tw / 2 - pad, y - box_h, x + tw / 2 + pad, y + box_h],
                    fill=ACCENT + (int(230 * k),))
        _shadow_text(d, (x, y), s, f, (255, 255, 255, a), anchor="mm")
    else:
        d.rectangle([x - tw / 2 - pad, y - box_h, x + tw / 2 + pad, y + box_h],
                    fill=DARKSCRIM + (int(190 * k),))
        _shadow_text(d, (x, y), s, f, OFFWHITE + (a,), anchor="mm")


def caption(img, t, dur, text, k=None, y_frac=0.88, font_size=52):
    """r184's own 52px+ minimum for explanatory captions, given from the
    start. Same dark-scrim-behind-off-white-text legibility pattern
    every prior style uses, since it works over any footage."""
    if k is None:
        k = fade_k(t, dur)
    if k <= 0:
        return
    d = ImageDraw.Draw(img, "RGBA")
    f = font("SemiBold", font_size)
    s = text.upper()
    tw = d.textlength(s, font=f)
    x, y = W / 2, H * y_frac
    pad = 16
    box_h = font_size * 0.75
    a = int(240 * k)
    d.rectangle([x - tw / 2 - pad, y - box_h, x + tw / 2 + pad, y + box_h], fill=DARKSCRIM + (int(160 * k),))
    _shadow_text(d, (x, y), s, f, OFFWHITE + (a,), anchor="mm")


def disclosure(img, text="PRODUCT VISUALIZATION", corner="tr", k=1.0, font_size=38):
    """Held continuously by construction (k defaults to 1.0, no fade
    envelope) for the plate's ENTIRE visible interval -- r184's own
    explicit acceptance test. font_size defaults to r184's own 38px
    minimum from the start."""
    d = ImageDraw.Draw(img, "RGBA")
    f = font("Medium", font_size)
    tw = d.textlength(text, font=f)
    lh = int(font_size * 1.1)
    margin = 36
    if corner == "tr":
        x, y = W - margin - tw, margin
    elif corner == "tl":
        x, y = margin, margin
    elif corner == "br":
        x, y = W - margin - tw, H - margin - lh
    else:
        x, y = margin, H - margin - lh
    a = int(190 * k)
    d.rectangle([x - 4, y - 4, x + tw + 4, y + lh + 4], fill=DARKSCRIM + (int(120 * k),))
    _shadow_text(d, (x, y), text, f, OFFWHITE + (a,))


def zone_trace(img, cx, cy, w, h, k=1.0, bracket_len_frac=0.22):
    """Four corner brackets (camera-autofocus/AR-bounding-box language)
    marking a recognized zone -- simpler and clearer at speed than a
    hand-drawn perimeter, and deliberately NOT v36's node/path rig,
    which r184 asks this style to avoid entirely."""
    d = ImageDraw.Draw(img, "RGBA")
    x0, y0, x1, y1 = cx - w // 2, cy - h // 2, cx + w // 2, cy + h // 2
    seg = int(min(w, h) * bracket_len_frac)
    a = int(235 * k)
    lw = 6
    for (px, py), (sx, sy) in [((x0, y0), (1, 1)), ((x1, y0), (-1, 1)),
                               ((x0, y1), (1, -1)), ((x1, y1), (-1, -1))]:
        d.line([(px, py), (px + sx * seg, py)], fill=ACCENT + (a,), width=lw)
        d.line([(px, py), (px, py + sy * seg)], fill=ACCENT + (a,), width=lw)


def anchor_pulse(img, cx, cy, k=1.0, phase=0.0):
    """A small filled core plus an expanding, fading ring (radar-ping) --
    representing content anchoring to an exact point in the real
    landscape. phase 0..1 loops continuously while shown."""
    d = ImageDraw.Draw(img, "RGBA")
    r0 = 9
    a = int(235 * k)
    d.ellipse([cx - r0, cy - r0, cx + r0, cy + r0], fill=ACCENT + (a,))
    ring_r = int(16 + phase * 46)
    ring_a = int(a * (1.0 - phase))
    if ring_a > 0:
        d.ellipse([cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r],
                  outline=ACCENT + (ring_a,), width=3)


def loop_word(img, primary, sub, k=1.0, font_size=88, sub_font_size=44):
    """The loop section's own device: real footage plus two or three
    large words at a time -- r184's explicit instruction, "not a system
    diagram." One word pair on screen at once, never four nodes at once
    the way v36's loop did."""
    d = ImageDraw.Draw(img, "RGBA")
    f = font("Black", font_size)
    fs = font("Medium", sub_font_size)
    y = H * 0.5
    w1 = d.textlength(primary, font=f)
    w2 = d.textlength(sub, font=fs) if sub else 0
    bw = max(w1, w2)
    pad = 30
    box_h = font_size * 0.78 + (sub_font_size * 0.9 if sub else 0)
    a = int(235 * k)
    ytop = y - box_h / 2 - 10
    ybot = y + box_h / 2 + 10
    d.rectangle([W / 2 - bw / 2 - pad, ytop, W / 2 + bw / 2 + pad, ybot], fill=DARKSCRIM + (int(195 * k),))
    py = y - (sub_font_size * 0.5 + 6) if sub else y
    _shadow_text(d, (W / 2, py), primary, f, OFFWHITE + (a,), anchor="mm")
    if sub:
        _shadow_text(d, (W / 2, y + font_size * 0.42 + 8), sub, fs, ACCENT + (int(a * 0.95),), anchor="mm")


def end_card(img, t, dur, line1, line2, k=None):
    """The same true no-fade path v35's r175 round landed on: k defaults
    to fade_k(..., no_out=True) so opacity is held at exactly 1.0 through
    the true final frame, not ~97.5% one frame early."""
    if k is None:
        k = fade_k(t, dur, in_t=0.6, no_out=True)
    if k <= 0:
        return
    d = ImageDraw.Draw(img, "RGBA")
    f1 = font("Black", 64)
    f2 = font("SemiBold", 34)
    w1 = d.textlength(line1, font=f1)
    w2 = d.textlength(line2, font=f2)
    bw = max(w1, w2)
    x, y = W / 2, H * 0.5
    pad = 36
    box_h = 64 + 34 + 30
    a = int(255 * k)
    d.rectangle([x - bw / 2 - pad, y - box_h / 2, x + bw / 2 + pad, y + box_h / 2],
                fill=DARKSCRIM + (int(225 * k),))
    _shadow_text(d, (x, y - 22), line1, f1, (255, 255, 255, a), anchor="mm")
    _shadow_text(d, (x, y + 34), line2, f2, ACCENT + (a,), anchor="mm")
