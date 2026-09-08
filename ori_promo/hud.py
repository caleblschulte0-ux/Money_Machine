#!/usr/bin/env python3
"""Richer sci-fi HUD overlay elements -- operator request, 2026-09-08:
"ai overlays crazy... graphics to show how cool and futuristic this is."

This is a NEW, separate layer on top of arlabel.py/labelkit.py, not a
replacement. arlabel.py's own philosophy stays the line: every element
here is either (a) tied to something the AR system is plausibly doing
right now (scanning, locking, tracking) during a beat where the device
is ON, or (b) an obviously synthetic HUD widget (a telemetry readout, a
gyroscope glyph) that reads as INSTRUMENT DATA, not as a claim about the
real world -- never a decorative frame drawn around the whole picture.
render_e2.py's frame_cue() was deleted specifically because full-frame
corner brackets are "the single most recognisable amateur hi-tech
overlay cliche there is" -- nothing in here reintroduces that shape.

Color: this project's `CYAN`/`AMBER` constants (defined per-render-script,
passed in here) are warm gold tones after the BGR compositing flip, not
literal cyan -- every function takes `col` so the caller's own palette is
what actually renders; nothing here hardcodes a color.

All pure procedural drawing (PIL ImageDraw + numpy), no AI-generated
imagery -- consistent with the standing "Claude never generates images or
video; only ChatGPT does" rule. No Blender dependency (not installed in
this environment) -- the pseudo-3D gyroscope glyph is plain rotation/
perspective math done by hand, which is what actually gets Blender-style
"the AI is thinking in 3D" motion onto the frame without a 3D engine.
"""
import math

import numpy as np
from PIL import ImageDraw, ImageFont

_FONT_CACHE = {}


def mono(sz):
    if sz not in _FONT_CACHE:
        try:
            _FONT_CACHE[sz] = ImageFont.truetype(
                "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", sz)
        except OSError:
            _FONT_CACHE[sz] = ImageFont.load_default()
    return _FONT_CACHE[sz]


def ease(x):
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


def boot_pulse(d, t, dur, centre, col, ring_dur=0.6):
    """A single expanding ring + flash, timed to the first `ring_dur` of a
    beat -- the visual for "the device just switched on". Returns nothing;
    draws directly. Silent past ring_dur (call every frame, it self-gates).
    """
    if t > ring_dur:
        return
    k = ease(t / ring_dur)
    cx, cy = centre
    r = 8 + k * 150
    a = int(230 * (1 - k) ** 1.6)
    if a <= 0:
        return
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=col + (a,), width=3)
    r2 = 8 + k * 90
    a2 = int(255 * (1 - k) ** 1.2)
    if a2 > 0:
        d.ellipse([cx - r2, cy - r2, cx + r2, cy + r2], outline=col + (a2,), width=2)
    if k < 0.35:
        fa = int(120 * (1 - k / 0.35))
        d.ellipse([cx - 60, cy - 60, cx + 60, cy + 60], fill=col + (fa,))


def scan_sweep(d, t, dur, W, H, col, sweep_dur=0.9, band=46):
    """A bright horizontal line travelling once top -> bottom with a soft
    glow trail (faked with stacked, fading lines rather than a real
    Gaussian blur -- cheaper and plenty convincing at this thickness).
    Runs once at the start of a beat, then stops (self-gates on t).
    """
    if t > sweep_dur:
        return
    k = t / sweep_dur
    y = int(-band + k * (H + 2 * band))
    for j in range(band, 0, -4):
        a = int(150 * (1 - j / band) ** 2 * (1 - k * 0.15))
        if a <= 0:
            continue
        d.line([(0, y - j), (W, y - j)], fill=col + (a,), width=2)
        d.line([(0, y + j), (W, y + j)], fill=col + (a,), width=2)
    d.line([(0, y), (W, y)], fill=col + (235,), width=2)


def telemetry(d, t, t0, W, H, seed, col, corner="tr", label="TRACKING"):
    """A small, unobtrusive instrument readout -- NOT a frame around the
    subject. Ticking pseudo-coordinates + a confidence number climbing to
    a settled value, monospace, corner-anchored. `seed` varies the numbers
    per beat so two beats side by side don't show identical telemetry.
    """
    lt = t - t0
    if lt < 0:
        return
    k = ease(min(1.0, lt / 0.5))
    if k <= 0:
        return
    rng = np.random.RandomState(int(seed * 1000) % (2**31))
    base_lat = 43.5460 + rng.uniform(-0.0006, 0.0006)
    base_lon = -96.7313 + rng.uniform(-0.0006, 0.0006)
    jit = math.sin(t * 7.3 + seed) * 0.00004
    conf = min(99.6, 62.0 + lt * 46.0 + math.sin(t * 11.0) * 0.6)
    lines = [
        f"{label}",
        f"LAT {base_lat + jit:8.4f}",
        f"LON {base_lon + jit:8.4f}",
        f"CONF {conf:4.1f}%",
    ]
    f = mono(20)
    pad = 10
    lh = 24
    widths = [d.textlength(s, font=f) for s in lines]
    bw = max(widths) + pad * 2
    bh = lh * len(lines) + pad * 2
    margin = 64
    if corner == "tr":
        x0, y0 = W - margin - bw, margin
    elif corner == "tl":
        x0, y0 = margin, margin
    elif corner == "br":
        x0, y0 = W - margin - bw, H - margin - bh
    else:
        x0, y0 = margin, H - margin - bh
    a = int(200 * k)
    d.rectangle([x0, y0, x0 + bw, y0 + bh], fill=(6, 9, 12, int(a * 0.65)),
                outline=col + (a,), width=1)
    for i, s in enumerate(lines):
        fill = col + (a,) if i > 0 else col + (a,)
        d.text((x0 + pad, y0 + pad + i * lh), s, font=f, fill=fill)
    # a small blinking status dot beside the label line, top row
    if int(t * 4) % 2 == 0:
        dx, dy = x0 + pad + widths[0] + 10, y0 + pad + 9
        d.ellipse([dx - 4, dy - 4, dx + 4, dy + 4], fill=col + (a,))


def gyro_glyph(d, centre, t, radius, col, spin=1.4):
    """A small rotating three-ring gyroscope -- the pseudo-3D "the software
    is thinking in space" glyph. Built from plain rotation/perspective
    math (numpy), not a 3D engine: three ellipses, each a circle in its
    own tilted plane projected to 2D, spinning at different rates so the
    whole thing reads as a tumbling wireframe sphere rather than three
    flat rings.
    """
    cx, cy = centre
    n = 40
    ang = np.linspace(0, 2 * math.pi, n)
    rings = [
        (0.0, 1.0, t * spin),
        (math.pi / 3, 0.85, t * spin * 1.3 + 1.1),
        (math.pi * 2 / 3, 0.7, t * spin * 0.8 + 2.4),
    ]
    for tilt, scale, phase in rings:
        # circle in the ring's own plane (XY), then tilt about X and spin
        # about Y -- plain 3D rotation matrices, applied by hand
        rx = np.cos(ang) * radius * scale
        ry = np.sin(ang) * radius * scale
        rz = np.zeros_like(rx)
        # rotate the ring plane by `tilt` about the X axis
        ry2 = ry * math.cos(tilt) - rz * math.sin(tilt)
        rz2 = ry * math.sin(tilt) + rz * math.cos(tilt)
        # spin the whole ring about the Y axis by `phase`
        rx3 = rx * math.cos(phase) + rz2 * math.sin(phase)
        rz3 = -rx * math.sin(phase) + rz2 * math.cos(phase)
        # perspective: points further back (rz3 > 0, camera looks -Z) fade + shrink slightly
        depth = rz3 / (radius * 2.2)
        persp = 1.0 / (1.0 + depth * 0.9)
        px = cx + rx3 * persp
        py = cy + ry2 * persp
        alpha_scale = np.clip(0.35 + 0.65 * (1.0 - (depth + 1) / 2.0), 0.15, 1.0)
        pts = list(zip(px.tolist(), py.tolist()))
        for i in range(n - 1):
            a = int(210 * alpha_scale[i])
            if a <= 4:
                continue
            d.line([pts[i], pts[i + 1]], fill=col + (a,), width=2)
    # a steady core point at the centre -- the thing the rings orbit
    d.ellipse([cx - 3, cy - 3, cx + 3, cy + 3], fill=col + (230,))


def data_ticker(d, t, W, H, col, x=28, seed=0):
    """A thin vertical column of scrolling pseudo-hex characters at the
    frame edge -- a nod to "data is streaming", kept to one narrow column
    (not a full-frame matrix effect) so it reads as a HUD accessory, not
    wallpaper.
    """
    f = mono(16)
    rng = np.random.RandomState(int(seed * 97) % (2**31))
    chars = "0123456789ABCDEF"
    rows = H // 22
    scroll = (t * 40) % 22
    for r in range(rows):
        y = r * 22 - scroll
        if y < -22 or y > H:
            continue
        s = "".join(rng.choice(list(chars)) for _ in range(4))
        a = int(70 + 40 * math.sin(r * 1.3 + t * 2.0))
        a = max(20, min(110, a))
        d.text((x, y), s, font=f, fill=col + (a,))
