#!/usr/bin/env python3
"""The `sync` beat: group sync, and the fact that groups do not bleed.

OPERATOR, on v21: "you never talk about the cool, like, features I
mentioned earlier, how we are going to make it so if you're in a group,
your stuff will sync. If you're not in a group, when you walk past another
group, your stuff will not overlap and it won't sound weird."
Then, on v22's first attempt: "that visualization of how the two groups
work, that sucked ass too."

v22 drew this as thin outlined rings pulsing from each of five individual
dots, plus a dashed fence line down the middle labelled NO OVERLAP. Kept
the right idea (two groups, one shared pulse each, a boundary between
them) and executed it like a wireframe diagram -- thin strokes, a literal
dashed fence, a caption that reads like a chart footnote. v23 keeps the
IDEA and rebuilds the EXECUTION:

  - each group is ONE soft glowing aura (a blurred colour wash under the
    group), not five thin rings -- the synchronisation reads as "these
    people share one field", which is the actual claim, rather than as
    five separate radar pings that happen to line up.
  - one clean pulse ring per group, thick and soft-edged, on the group's
    own clock -- still visibly desynchronised between the two groups
    (that IS the feature), just drawn once instead of per-member.
  - the boundary between them is NEGATIVE SPACE -- the two auras simply
    do not reach each other -- with a small centred pill tag instead of a
    dashed fence line and a chart-style caption.

Same content as before, nothing added: no user count, no range in feet,
no latency number, no claim this is running at Falls Park today. Still
squarely inside the end card's VISUAL INTENTION ONLY.

THE PLATE is ai/map/park_sync_plate.png -- the same real aerial photograph
as the `map` beat, pushed in on the middle of the park.
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import labelkit as LK

W, H = 1920, 1080
INK = (250, 250, 248)
DIM = (198, 201, 203)

MINE = (120, 206, 236)
THEIRS = (240, 172, 104)

GROUP_A = [(255, 405), (395, 455), (300, 520)]
GROUP_B = [(1175, 455), (1300, 515)]

A_LABEL = ("YOUR GROUP", "SAME STORY, SAME MOMENT")
B_LABEL = ("ANOTHER GROUP", "THEIRS STAYS THEIRS")


def _ease(k):
    k = max(0.0, min(1.0, k))
    return k * k * (3 - 2 * k)


def _centroid(pts):
    return sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)


def _radius(pts, cx, cy):
    return max(((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 for x, y in pts)


def _aura_layer(pts, col, k):
    """One soft blurred blob under a whole group -- not per-member rings."""
    if k <= 0.002:
        return None
    cx, cy = _centroid(pts)
    r = _radius(pts, cx, cy) + 90
    pad = 140
    x0, y0 = int(cx - r - pad), int(cy - r - pad)
    x1, y1 = int(cx + r + pad), int(cy + r + pad)
    lw, lh = x1 - x0, y1 - y0
    layer = Image.new("L", (lw, lh), 0)
    d = ImageDraw.Draw(layer)
    a = int(150 * k)
    d.ellipse((cx - r - x0, cy - r - y0 - r * 0.35,
               cx + r - x0, cy + r - y0 + r * 0.35), fill=a)
    layer = layer.filter(ImageFilter.GaussianBlur(r * 0.55))
    rgba = Image.new("RGBA", (lw, lh), col + (0,))
    rgba.putalpha(layer)
    return rgba, (x0, y0)


def _pulse_layer(pts, col, t, k, period=2.1):
    """ONE ring per group, on its own clock -- not one per member."""
    if k <= 0.002:
        return None
    cx, cy = _centroid(pts)
    r0 = _radius(pts, cx, cy) + 40
    rmax = r0 + 210
    ph = (t % period) / period
    r = r0 + (rmax - r0) * ph
    a = int(200 * k * (1.0 - ph) ** 1.3)
    if a <= 2:
        return None
    pad = 24
    size = int(2 * (r + pad))
    layer = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(layer)
    d.ellipse((size / 2 - r, size / 2 - r * 0.62, size / 2 + r, size / 2 + r * 0.62),
              outline=a, width=6)
    layer = layer.filter(ImageFilter.GaussianBlur(3))
    rgba = Image.new("RGBA", (size, size), col + (0,))
    rgba.putalpha(layer)
    return rgba, (int(cx - size / 2), int(cy - size / 2))


def _dot(d, x, y, col, k, r=10):
    a = int(255 * k)
    d.ellipse((x - r, y - r, x + r, y + r), fill=col + (a,))
    d.ellipse((x - r, y - r, x + r, y + r), outline=(255, 255, 255, int(a * 0.9)), width=2)


def _tag(d, xy, title, sub, col, k, anchor="ls"):
    if k <= 0.002:
        return
    a = int(252 * k)
    x, y = xy
    f1, f2 = LK.inter(38, "Bold"), LK.mono(23)
    d.text((x + 2, y + 2), title, font=f1, fill=(5, 8, 10, int(a * 0.6)), anchor=anchor)
    d.text((x, y), title, font=f1, fill=col + (a,), anchor=anchor)
    d.text((x + 2, y + 38), sub, font=f2, fill=DIM + (int(a * 0.92),), anchor=anchor)


def _pill(d, cx, cy, text, k):
    if k <= 0.002:
        return
    a = int(235 * k)
    f = LK.mono(21)
    tw = d.textlength(text, font=f)
    pad_x, pad_y = 22, 12
    w, h = tw + pad_x * 2, 34 + pad_y
    d.rounded_rectangle((cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2),
                        radius=h / 2, fill=(6, 9, 12, int(160 * k)),
                        outline=INK + (int(a * 0.5),), width=1)
    d.text((cx, cy + 1), text, font=f, fill=INK + (a,), anchor="mm")


def draw_sync(img, t, dur):
    k_in = _ease(min(1.0, t / 0.5))
    k_out = _ease(min(1.0, max(0.0, (dur - 0.12 - t) / 0.45)))
    k = k_in * k_out
    if k <= 0.002:
        return

    ka = _ease(min(1.0, max(0.0, (t - 0.25) / 0.6))) * k
    kb = _ease(min(1.0, max(0.0, (t - 1.5) / 0.6))) * k
    kbar = _ease(min(1.0, max(0.0, (t - 2.6) / 0.6))) * k

    for pts, col, kk, phase in ((GROUP_A, MINE, ka, 0.0), (GROUP_B, THEIRS, kb, 0.95)):
        aura = _aura_layer(pts, col, kk)
        if aura:
            layer, pos = aura
            img.alpha_composite(layer, pos)
        pulse = _pulse_layer(pts, col, t + phase, kk)
        if pulse:
            layer, pos = pulse
            img.alpha_composite(layer, pos)

    d = ImageDraw.Draw(img)
    for (x, y) in GROUP_A:
        _dot(d, x, y, MINE, ka)
    for (x, y) in GROUP_B:
        _dot(d, x, y, THEIRS, kb)

    if kbar > 0.002:
        cax, cay = _centroid(GROUP_A)
        cbx, cby = _centroid(GROUP_B)
        mx, my = (cax + cbx) / 2, (cay + cby) / 2 - 40
        _pill(d, mx, my, "SEPARATE — NEVER OVERLAPS", kbar)

    _tag(d, (140, 630), A_LABEL[0], A_LABEL[1], MINE, ka)
    _tag(d, (1130, 630), B_LABEL[0], B_LABEL[1], THEIRS, kb)
