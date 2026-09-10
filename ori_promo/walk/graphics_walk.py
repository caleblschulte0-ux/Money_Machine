#!/usr/bin/env python3
"""v35 "The Walkthrough" -- graphics kit.

r174 is explicit: "small white chapter words, a thin progress line, and
concise lower captions only when needed. No fake headset HUD, sci-fi
reticle, scan effect, or sales dashboard" -- and just as explicitly NOT
v33's scope-crop/HUD grammar (labelkit.py/hud.py) and NOT v34's paper
panels, numbered field-guide diagrams, split screens, or ochre palette
(field/graphics.py). This is its own third, small kit.

Palette: plain white text on real footage, a soft drop shadow for
legibility (the ONE lesson carried over from v34's own r171 bug -- a
title with only a 1-2px shadow washed out against bright water; a
slightly stronger shadow plus a very thin low-opacity gradient strip
behind text is the minimum needed to stay legible on real daylight
footage without becoming a panel/card in its own right).
"""
import os
from PIL import Image, ImageDraw, ImageFont

_FDIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                      "fonts", "inter", "extras", "ttf")

WHITE = (255, 255, 255)
DIM = (225, 225, 225)

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
    """no_out=True SKIPS the release multiplier entirely rather than just
    zeroing out_margin -- zeroing the margin alone still ramps the ease
    curve down to exactly 0 at t=dur (confirmed by direct calculation:
    ~2.5% opacity one frame before the end, not the "held through the
    literal last frame" a caller actually wants). Skipping the multiplier
    is the only way k genuinely stays at 1.0 all the way to dur."""
    k = ease(min(1.0, t / in_t)) if in_t > 0 else 1.0
    if not no_out:
        k *= ease(min(1.0, max(0.0, (dur - out_margin - t) / 0.35)))
    return k


def _shadow_text(d, xy, s, f, fill, anchor="la"):
    x, y = xy
    d.text((x + 1, y + 2), s, font=f, fill=(0, 0, 0, int(fill[3] * 0.7) if len(fill) > 3 else 160), anchor=anchor)
    d.text((x, y), s, font=f, fill=fill, anchor=anchor)


def _bottom_gradient(img, k, height=170):
    """A very thin, low-opacity dark gradient at the frame's bottom edge --
    just enough for white text to hold contrast against bright sky/water,
    without becoming a panel. Only drawn while a caption is visible."""
    if k <= 0:
        return
    W, H = img.size
    grad = Image.new("RGBA", (1, height), (0, 0, 0, 0))
    for y in range(height):
        a = int(120 * k * (y / height) ** 1.6)
        grad.putpixel((0, y), (0, 0, 0, a))
    grad = grad.resize((W, height))
    img.alpha_composite(grad, (0, H - height))


def chapter_word(img, t, dur, word, k=None):
    """A single small white chapter word -- ARRIVE / WALK / RETURN -- top
    left, understated. Not a title card, not a full-screen brand moment."""
    if k is None:
        k = fade_k(t, dur, in_t=0.3, out_margin=0.5)
    if k <= 0:
        return
    d = ImageDraw.Draw(img, "RGBA")
    a = int(235 * k)
    f = font("SemiBold", 30)
    d.rectangle([0, 0, 420, 90], fill=(0, 0, 0, int(70 * k)))
    _shadow_text(d, (44, 44), word.upper(), f, WHITE + (a,), anchor="lm")


def modest_title(img, t, dur, text, k=None):
    """"OPEN RANGE INTERACTIVE" as a small, restrained title -- NOT a
    full-screen brand card (that's v33's/v34's move, not this one's).
    Lower-left, same visual weight as a chapter word."""
    if k is None:
        k = fade_k(t, dur, in_t=0.4, out_margin=0.4)
    if k <= 0:
        return
    _bottom_gradient(img, k, height=140)
    d = ImageDraw.Draw(img, "RGBA")
    a = int(245 * k)
    f = font("Bold", 40)
    W, H = img.size
    _shadow_text(d, (44, H - 56), text.upper(), f, WHITE + (a,), anchor="lm")


def caption(img, t, dur, text, k=None, side="l"):
    """One concise lower caption, one idea, plain white text over a thin
    gradient -- the closest thing this kit has to v34's lower_card, but
    without a panel, kicker, or accent bar."""
    if k is None:
        k = fade_k(t, dur)
    if k <= 0:
        return
    _bottom_gradient(img, k, height=150)
    d = ImageDraw.Draw(img, "RGBA")
    W, H = img.size
    a = int(245 * k)
    f = font("SemiBold", 42)
    s = text.upper()
    if side == "l":
        _shadow_text(d, (44, H - 64), s, f, WHITE + (a,), anchor="lm")
    else:
        w = d.textlength(s, font=f)
        _shadow_text(d, (W - 44 - w, H - 64), s, f, WHITE + (a,), anchor="lm")


def disclosure(img, t, dur, text="PRODUCT VISUALIZATION", corner="tr", k=None):
    """Held CONTINUOUSLY for the whole interval, by design (r174's
    editorial acceptance criterion #4) -- no shared fade envelope. Small,
    plain, unmistakable: white text, thin white rule beneath, no panel."""
    if k is None:
        k = 1.0
    d = ImageDraw.Draw(img, "RGBA")
    W, H = img.size
    a = int(235 * k)
    f = font("SemiBold", 24)
    tw = d.textlength(text, font=f)
    pad = 4
    if corner == "tr":
        x, y = W - 40 - tw, 40
    elif corner == "tl":
        x, y = 40, 40
    elif corner == "br":
        x, y = W - 40 - tw, H - 60
    else:
        x, y = 40, H - 60
    d.rectangle([x - pad, y - pad, x + tw + pad, y + 24 + pad], fill=(0, 0, 0, int(90 * k)))
    _shadow_text(d, (x, y), text, f, WHITE + (a,))
    d.line([(x, y + 30), (x + tw, y + 30)], fill=WHITE + (int(180 * k),), width=1)


def progress_line(img, frac, visible_k=1.0):
    """A thin line across the very bottom edge, filling left-to-right as
    the film advances ARRIVE -> RETURN. Not v34's numbered step strip --
    no circles, no labels, just distance traveled."""
    if visible_k <= 0:
        return
    d = ImageDraw.Draw(img, "RGBA")
    W, H = img.size
    y = H - 6
    a = int(160 * visible_k)
    d.line([(0, y), (W, y)], fill=WHITE + (int(a * 0.35),), width=2)
    d.line([(0, y), (W * max(0.0, min(1.0, frac)), y)], fill=WHITE + (a,), width=3)


def sync_glyph(img, t, dur, cx1, cy1, cx2, cy2, k=None):
    """Two points, one thin tie-line -- the shared-spatial-audio diagram,
    same idea as v34's audio_sync_glyph but drawn in this kit's own plain
    white language, no ochre."""
    if k is None:
        k = fade_k(t, dur)
    if k <= 0:
        return
    d = ImageDraw.Draw(img, "RGBA")
    a = int(230 * k)
    mx, my = (cx1 + cx2) / 2, min(cy1, cy2) - 70
    d.ellipse([cx1 - 9, cy1 - 9, cx1 + 9, cy1 + 9], fill=WHITE + (a,))
    d.ellipse([cx2 - 9, cy2 - 9, cx2 + 9, cy2 + 9], fill=WHITE + (a,))
    pts = []
    n = 24
    for i in range(n + 1):
        u = i / n
        x = (1 - u) ** 2 * cx1 + 2 * (1 - u) * u * mx + u ** 2 * cx2
        y = (1 - u) ** 2 * cy1 + 2 * (1 - u) * u * my + u ** 2 * cy2
        pts.append((x, y))
    d.line(pts, fill=WHITE + (int(a * 0.85),), width=2)


def end_card(img, t, dur, line1, line2, k=None):
    """Two lines, centered, plain white -- the film's closing moment.
    Still not a full-screen brand card in v33's/v34's sense: no scrim
    box larger than the text needs, no rule, no logo mark. Held through
    the literal last rendered frame -- out_margin=0, no release fade --
    this is the film's final image; a card that fades to blank before the
    clip actually ends would leave a dead tail with nothing on screen.
    Same "hold to the real last frame" principle r172 required for v34's
    disclosure tag."""
    if k is None:
        k = fade_k(t, dur, in_t=0.4, no_out=True)
    if k <= 0:
        return
    d = ImageDraw.Draw(img, "RGBA")
    W, H = img.size
    a = int(250 * k)
    f1 = font("Bold", 52)
    f2 = font("Medium", 28)
    cy = H // 2 - 16
    w1 = d.textlength(line1, font=f1)
    w2 = d.textlength(line2, font=f2)
    w = max(w1, w2)
    d.rectangle([W // 2 - w / 2 - 30, cy - 50, W // 2 + w / 2 + 30, cy + 70],
                fill=(0, 0, 0, int(110 * k)))
    _shadow_text(d, (W // 2, cy), line1, f1, WHITE + (a,), anchor="mm")
    _shadow_text(d, (W // 2, cy + 46), line2, f2, DIM + (int(a * 0.92),), anchor="mm")
