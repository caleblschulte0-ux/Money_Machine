#!/usr/bin/env python3
"""Sci-fi HUD overlay elements -- v2.

Operator, on v1 (gyro_glyph/telemetry/scan_sweep/data_ticker, boxed
readouts, blinking status dot, LAT/LON pseudo-coordinates, a hex-digit
"matrix" column): "all the videos are like a 2/10 ... [not the voice] ...
the graphics look tacky, not futuristic". v1 read as a hacker-movie
terminal bolted onto vacation footage -- boxes, borders, blinking dots,
and fake coordinate readouts are the exact "amateur hi-tech overlay"
vocabulary this project's own render_e2.py already names and rejects for
frame_cue() (corner brackets). Wrapping the same cliches in a different
shape did not fix that.

v2 is a rewrite, not a tune: fewer elements, each one doing real work,
built the way an actual consumer spatial-computing product's UI reads
(thin lines, real soft glow, no borders, no boxes, no blinking, no
invented telemetry) rather than a screensaver. Concretely:

  pulse_ring   one clean expanding ring, real glow, for "device just
               switched on" -- no filled flash, no double ring.
  orbit_halo   a single thin, slowly tilting ring around the anchor
               point during recognition -- not three overlapping
               ellipses (v1's "atom" glyph, which read as a toy icon).
  status_label one line of small-caps, letter-spaced text with real
               glow and no box/border/blinking dot -- a caption, not a
               terminal window.

GLOW IS REAL THIS TIME: each function draws its source shape onto its
own transparent scratch layer, Gaussian-blurs a copy of it, screens
that blurred copy under the crisp line. v1's "glow" was stacked fading
strokes (cheap, and it showed -- the elements read flat/graphic instead
of luminous). Functions here take the composited `img` (the RGBA layer
render_eN.py is building), not a bare ImageDraw, because a real blur
needs its own isolated layer to blur before it is composited back.

Still pure procedural drawing (PIL + numpy), no AI-generated imagery --
consistent with the standing "Claude never generates images or video;
only ChatGPT does" rule. No Blender dependency (not installed in this
environment).
"""
import math

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

_FONT_CACHE = {}


def mono(sz):
    if sz not in _FONT_CACHE:
        try:
            _FONT_CACHE[sz] = ImageFont.truetype(
                "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", sz)
        except OSError:
            _FONT_CACHE[sz] = ImageFont.load_default()
    return _FONT_CACHE[sz]


def ease(x):
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


def _screen_glow(img, draw_source, blur, gain=1.0):
    """draw_source(ImageDraw) draws onto a fresh transparent layer sized
    to `img`; that layer is Gaussian-blurred and screen-blended onto
    `img` in place. Returns nothing -- mutates img.
    """
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw_source(ImageDraw.Draw(layer))
    a = np.array(layer, dtype=np.float32)
    if a[..., 3].max() <= 0:
        return
    blurred = np.array(layer.filter(ImageFilter.GaussianBlur(blur)), dtype=np.float32)
    glow_rgb = blurred[..., :3] * (blurred[..., 3:4] / 255.0) * gain
    base = np.array(img, dtype=np.float32)
    # screen blend on the RGB channels only; alpha stays whatever the
    # crisp pass on top will set
    out_rgb = 255.0 - (255.0 - base[..., :3]) * (255.0 - np.clip(glow_rgb, 0, 255)) / 255.0
    base[..., :3] = out_rgb
    base[..., 3] = np.maximum(base[..., 3], blurred[..., 3] * 0.5)
    img.paste(Image.fromarray(np.clip(base, 0, 255).astype(np.uint8), "RGBA"), (0, 0))


def pulse_ring(img, t, dur, centre, col, ring_dur=0.7):
    """One clean expanding ring with a real glow -- "the device just
    switched on". Self-gates on t; call every frame of the beat.
    """
    if t > ring_dur:
        return
    k = ease(t / ring_dur)
    cx, cy = centre
    r = 6 + k * 130
    a = int(215 * (1 - k) ** 1.5)
    if a <= 2:
        return
    w = 2

    def src(d):
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=col + (a,), width=w + 3)

    _screen_glow(img, src, blur=7, gain=1.3)
    d = ImageDraw.Draw(img)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=col + (a,), width=w)


def orbit_halo(img, centre, t, radius, col, tilt=0.34, spin=0.6):
    """A single thin ring around the anchor point, gently tilted and
    slowly turning -- reads as "the system is holding a lock on this
    point in space" rather than a spinning toy. One shape, drawn once,
    with a real glow -- not three overlapping ellipses.
    """
    cx, cy = centre
    n = 64
    ang = np.linspace(0, 2 * math.pi, n)
    rx = np.cos(ang) * radius
    ry = np.sin(ang) * radius * (1.0 - tilt)
    phase = t * spin
    # rotate the flattened ellipse slowly about its own centre
    rxr = rx * math.cos(phase) - ry * math.sin(phase) * 0.15
    ryr = rx * math.sin(phase) * 0.15 + ry * math.cos(phase)
    px = (cx + rxr).tolist()
    py = (cy + ryr).tolist()
    pts = list(zip(px, py))

    def src(d):
        d.line(pts + [pts[0]], fill=col + (200,), width=2)

    _screen_glow(img, src, blur=5, gain=1.0)
    d = ImageDraw.Draw(img)
    d.line(pts + [pts[0]], fill=col + (170,), width=1)
    d.ellipse([cx - 2, cy - 2, cx + 2, cy + 2], fill=col + (220,))


def status_label(img, t, t0, W, H, text, col, corner="tl", size=22):
    """One line of small-caps, letter-spaced text with real glow --
    a caption, not a terminal window: no box, no border, no blinking
    status dot, no invented coordinates.
    """
    lt = t - t0
    if lt < 0:
        return
    k = ease(min(1.0, lt / 0.5))
    if k <= 0:
        return
    f = mono(size)
    letters = list(text.upper())
    sp = size * 0.42
    widths = []
    tmp = Image.new("RGBA", (4, 4))
    dtmp = ImageDraw.Draw(tmp)
    for ch in letters:
        widths.append(dtmp.textlength(ch, font=f))
    tw = sum(widths) + sp * max(0, len(letters) - 1)
    # xm/ytm/ybm: the 2.39:1 scope bars filmlook.finish() paints AFTER
    # this cover roughly the top/bottom 138px of a 1080-tall frame (see
    # filmlook.safe_area) -- v1's telemetry() used one flat 66px margin
    # on every side and its top-left text landed entirely inside that
    # bar, invisible in the final output. Margins here clear it.
    xm, ytm, ybm = 96, 168, 170
    if corner == "tr":
        x0, y0 = W - xm - tw, ytm
    elif corner == "tl":
        x0, y0 = xm, ytm
    elif corner == "br":
        x0, y0 = W - xm - tw, H - ybm
    else:
        x0, y0 = xm, H - ybm
    a = int(235 * k)

    def src(d):
        x = x0
        for ch, cw in zip(letters, widths):
            d.text((x, y0), ch, font=f, fill=col + (a,))
            x += cw + sp

    _screen_glow(img, src, blur=3, gain=0.9)
    d = ImageDraw.Draw(img)
    x = x0
    for ch, cw in zip(letters, widths):
        d.text((x, y0), ch, font=f, fill=col + (a,))
        x += cw + sp
    # a thin underline that draws in left-to-right -- the only "loading"
    # gesture kept from v1, because it reads as a status sweep rather
    # than a blinking light
    uk = ease(min(1.0, lt / 0.7))
    uy = y0 + size + 6
    d.line([(x0, uy), (x0 + tw * uk, uy)], fill=col + (int(140 * k),), width=1)
