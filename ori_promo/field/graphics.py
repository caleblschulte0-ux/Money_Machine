#!/usr/bin/env python3
"""v34 "The Field Guide" -- graphics kit.

r168's direction is explicit that this must not be v33 wearing a new
grade: "restrained field-guide graphics, map lines, numbered steps...
daylight palette... clean editorial rhythm." v33's language (labelkit.py,
hud.py) is dark-scrim HUD chips and glow-based sci-fi elements -- correct
for a cinematic AR-recognition film, wrong for a museum field guide.
Deliberately not reused here; this is its own small kit, built for what
this brief actually asks for: ink-on-paper clarity, not glowing chrome.

Palette: warm off-white card, near-black ink, one accent (a warm ochre,
the kind of color an actual printed park field guide uses for
call-outs) -- not this project's own AR-cyan or amber, which mean "the
device is doing something" everywhere else in this five-style slate.
A field guide's numbers and lines are printed, not projected.
"""
import os
from PIL import Image, ImageDraw, ImageFont

_FDIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                      "fonts", "inter", "extras", "ttf")

INK = (30, 28, 24)
PAPER = (250, 246, 236)
ACCENT = (176, 98, 34)      # warm ochre -- this film's own accent, not v33's
DIM = (110, 104, 92)
DISCLOSURE = (120, 114, 100)

_FONT_CACHE = {}


def font(weight, sz):
    key = (weight, sz)
    if key not in _FONT_CACHE:
        _FONT_CACHE[key] = ImageFont.truetype(f"{_FDIR}/Inter-{weight}.ttf", sz)
    return _FONT_CACHE[key]


def ease(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def fade_k(t, dur, in_t=0.35, out_margin=0.4):
    """Standard reveal/release envelope, shared by every card in this
    kit so the whole film has one consistent rhythm."""
    k = ease(min(1.0, t / in_t)) if in_t > 0 else 1.0
    k *= ease(min(1.0, max(0.0, (dur - out_margin - t) / 0.35)))
    return k


def text_with_shadow(d, xy, s, f, fill, anchor="la", shadow_alpha=60):
    x, y = xy
    d.text((x + 1, y + 2), s, font=f, fill=(0, 0, 0, shadow_alpha), anchor=anchor)
    d.text((x, y), s, font=f, fill=fill, anchor=anchor)


def title_card(img, t, dur, line1, line2=None, k=None):
    """Full-bleed opening/closing title: one or two centered lines on a
    soft paper panel, a thin rule above -- reads as a printed title page
    laid over the photo, not a HUD overlay. The panel is required, not
    decorative: real footage (waterfall foam, bright sky) washes out
    plain white text with only a drop-shadow, so a scrim is the only way
    the title stays legible across an actual outdoor daylight plate."""
    if k is None:
        k = fade_k(t, dur)
    if k <= 0:
        return
    d = ImageDraw.Draw(img, "RGBA")
    W, H = img.size
    a = int(255 * k)
    f1 = font("Bold", 64)
    f2 = font("Medium", 30)
    cy = H // 2 - (20 if line2 else 0)
    w1 = d.textlength(line1, font=f1)
    panel_w = w1 + 140
    panel_top = cy - 76
    panel_bot = cy + (86 if line2 else 40)
    d.rectangle([W // 2 - panel_w / 2, panel_top, W // 2 + panel_w / 2, panel_bot],
                fill=PAPER + (int(206 * k),))
    d.line([(W // 2 - 60, cy - 56), (W // 2 + 60, cy - 56)], fill=INK + (a,), width=3)
    text_with_shadow(d, (W // 2, cy), line1, f1, INK + (a,), anchor="mm", shadow_alpha=0)
    if line2:
        text_with_shadow(d, (W // 2, cy + 56), line2, f2, ACCENT + (int(a * 0.95),), anchor="mm", shadow_alpha=0)


def lower_card(img, t, dur, kicker, headline, k=None, side="l"):
    """The field guide's standing caption: a small ochre kicker word
    over a larger ink headline, bottom-left (or right), on a soft paper
    scrim -- the printed-page equivalent of a chyron."""
    if k is None:
        k = fade_k(t, dur)
    if k <= 0:
        return
    d = ImageDraw.Draw(img)
    W, H = img.size
    a = int(255 * k)
    fk = font("SemiBold", 26)
    fh = font("Bold", 52)
    kw = d.textlength(kicker.upper(), font=fk)
    hw = d.textlength(headline, font=fh)
    wid = max(kw, hw)
    x0 = 90 if side == "l" else W - 90 - wid
    y0 = H - 210
    d.rounded_rectangle([x0 - 28, y0 - 14, x0 + wid + 28, y0 + 108], radius=10,
                         fill=PAPER + (int(214 * k),))
    d.rectangle([x0 - 28, y0 - 14, x0 - 22, y0 + 108], fill=ACCENT + (a,))
    text_with_shadow(d, (x0, y0 + 4), kicker.upper(), fk, ACCENT + (a,), shadow_alpha=0)
    text_with_shadow(d, (x0, y0 + 40), headline, fh, INK + (a,), shadow_alpha=0)


def disclosure_tag(img, t, dur, text="PRODUCT VISUALIZATION", corner="bl", k=None,
                    no_fadeout=False):
    """Every generated/reconstructed frame in this film carries this --
    same standing discipline as every other style in the slate, drawn
    in this style's own paper-and-ink language instead of v33's dark
    HUD chip. Small, plain, unmistakable -- a museum label, not an
    alert."""
    if k is None:
        k = fade_k(t, dur, in_t=0.2, out_margin=(0.0 if no_fadeout else 0.35))
    if k <= 0:
        return
    d = ImageDraw.Draw(img)
    W, H = img.size
    a = int(235 * k)
    f = font("SemiBold", 24)
    tw = d.textlength(text, font=f)
    pad = 16
    if corner == "bl":
        x0, y0 = 40, H - 56
    elif corner == "br":
        x0, y0 = W - 40 - tw - pad * 2, H - 56
    else:
        x0, y0 = 40, 40
    d.rounded_rectangle([x0, y0, x0 + tw + pad * 2, y0 + 38], radius=8,
                         fill=PAPER + (int(200 * k),))
    d.rounded_rectangle([x0, y0, x0 + tw + pad * 2, y0 + 38], radius=8,
                         outline=DISCLOSURE + (a,), width=1)
    d.text((x0 + pad, y0 + 19), text, font=f, fill=DISCLOSURE + (a,), anchor="lm")


def step_strip(img, t, dur, steps, active_idx, k=None):
    """BORROW -> EXPLORE -> RETURN, numbered circles joined by a thin
    line, the active step filled in ochre. A printed-map legend, not a
    progress bar."""
    if k is None:
        k = fade_k(t, dur)
    if k <= 0:
        return
    d = ImageDraw.Draw(img)
    W, H = img.size
    a = int(255 * k)
    n = len(steps)
    cy = H - 150
    span = 640
    x0 = W // 2 - span // 2
    xs = [x0 + span * i / (n - 1) for i in range(n)]
    d.line([(xs[0], cy), (xs[-1], cy)], fill=INK + (int(a * 0.5),), width=2)
    fnum = font("Bold", 26)
    flab = font("SemiBold", 22)
    for i, (x, label) in enumerate(zip(xs, steps)):
        r = 26
        active = (i == active_idx)
        fill = ACCENT + (a,) if active else PAPER + (a,)
        outline = ACCENT + (a,) if active else INK + (int(a * 0.6),)
        d.ellipse([x - r, cy - r, x + r, cy + r], fill=fill, outline=outline, width=2)
        numcol = PAPER + (a,) if active else INK + (a,)
        d.text((x, cy), str(i + 1), font=fnum, fill=numcol, anchor="mm")
        lw = d.textlength(label.upper(), font=flab)
        d.text((x - lw / 2, cy + r + 14), label.upper(), font=flab,
               fill=(INK if active else DIM) + (a,), anchor="la")


def split_screen(frame_left, frame_right, t, dur, label_left, label_right, k=None):
    """HARDWARE / SOFTWARE -- a clean vertical split with a thin rule
    down the middle and one small caption per side. Composited BEFORE
    any card/disclosure is drawn on top."""
    import numpy as np
    H, W = frame_left.shape[:2]
    half = W // 2
    out = frame_left.copy()
    out[:, half:] = frame_right[:, half:]
    out_img = Image.fromarray(out[:, :, ::-1])
    if k is None:
        k = fade_k(t, dur)
    if k > 0:
        d = ImageDraw.Draw(out_img)
        a = int(255 * k)
        d.line([(half, 0), (half, H)], fill=PAPER + (a,), width=4)
        fk = font("Bold", 34)
        d.rectangle([half // 2 - 110, H - 96, half // 2 + 110, H - 52],
                    fill=PAPER + (int(214 * k),))
        d.text((half // 2, H - 74), label_left.upper(), font=fk,
               fill=INK + (a,), anchor="mm")
        d.rectangle([half + half // 2 - 110, H - 96, half + half // 2 + 110, H - 52],
                    fill=PAPER + (int(214 * k),))
        d.text((half + half // 2, H - 74), label_right.upper(), font=fk,
               fill=INK + (a,), anchor="mm")
    return np.array(out_img)[:, :, ::-1]


def map_zone_marker(img, t, dur, cx, cy, k=None):
    """A single soft ring closing in on a point, for "recognizes the
    experience zone" -- one clean mark, not a radar sweep or scan-line
    cliche. Ink-colored, not glowing."""
    if k is None:
        k = fade_k(t, dur, in_t=0.5)
    if k <= 0:
        return
    d = ImageDraw.Draw(img)
    a = int(220 * k)
    r = 70 - 30 * ease(min(1.0, t / 0.8))
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=INK + (a,), width=3)
    d.ellipse([cx - 5, cy - 5, cx + 5, cy + 5], fill=ACCENT + (a,))


def idea_card(img, t, dur, text, k=None):
    """One large, centered, single-idea card -- replaces the old
    summary_card thin dot-separated strip (r172's review: that strip put
    three ideas in type materially smaller than every other lower_card in
    the film, failing r168's own 'phone-readable, one idea per card'
    rule). Sized at least as large as lower_card's headline (52px) on
    purpose -- this is the film's closing thesis, it should not read as
    fine print."""
    if k is None:
        k = fade_k(t, dur)
    if k <= 0:
        return
    d = ImageDraw.Draw(img)
    W, H = img.size
    a = int(255 * k)
    f = font("Bold", 58)
    s = text.upper()
    tw = d.textlength(s, font=f)
    x0 = W // 2 - tw / 2
    y0 = H - 160
    d.rectangle([x0 - 40, y0 - 30, x0 + tw + 40, y0 + 46], fill=PAPER + (int(214 * k),))
    d.rectangle([x0 - 40, y0 - 30, x0 - 34, y0 + 46], fill=ACCENT + (a,))
    text_with_shadow(d, (W // 2, y0 + 8), s, f, INK + (a,), anchor="mm", shadow_alpha=0)


def audio_sync_glyph(img, t, dur, cx1, cy1, cx2, cy2, k=None):
    """Two points, one arcing tie-line between them, for "spatial audio,
    synchronized between visitors" -- a diagram of a relationship, not
    a photo of headphones."""
    if k is None:
        k = fade_k(t, dur)
    if k <= 0:
        return
    d = ImageDraw.Draw(img)
    a = int(230 * k)
    mx, my = (cx1 + cx2) / 2, min(cy1, cy2) - 70
    d.ellipse([cx1 - 10, cy1 - 10, cx1 + 10, cy1 + 10], fill=ACCENT + (a,))
    d.ellipse([cx2 - 10, cy2 - 10, cx2 + 10, cy2 + 10], fill=ACCENT + (a,))
    pts = []
    n = 24
    for i in range(n + 1):
        u = i / n
        x = (1 - u) ** 2 * cx1 + 2 * (1 - u) * u * mx + u ** 2 * cx2
        y = (1 - u) ** 2 * cy1 + 2 * (1 - u) * u * my + u ** 2 * cy2
        pts.append((x, y))
    d.line(pts, fill=INK + (int(a * 0.8),), width=2)
