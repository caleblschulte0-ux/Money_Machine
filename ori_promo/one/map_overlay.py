#!/usr/bin/env python3
"""The `map` beat: the operator's own site-map concept, on a real photo.

He gave a reference: an aerial-style photo of Falls Park with a colour
legend keyed to four zone types (his own words) --
  BLUE   = visual scenes
  PURPLE = audio narration
  ORANGE = ambient noise
  GREEN  = lookout points
His own file could not be re-sent into this session, and the one treatment
tried earlier (a darkened/blurred base photo with a synthetic dotted path
and a "DAKOTA LIFE" node label -- trailer/v7_ui.py's z_map.mp4 lineage) was
rejected outright: "that didn't work, I didn't like it." So this is NOT
that -- no synthetic path, no invented place-names, no darkening the photo
into illegibility.

THE PHOTO IS REAL, ORI'S OWN FOOTAGE. It is the clean upper portion of
IMG_6803 (the same clip `off` uses) -- shot from the observation tower,
before the wearer leans onto the rail, at the one moment the frame is
completely clear of him. No stock image, no generated satellite plate.

v23 REBUILD. Operator, on the v21/v22 version: "the map looks like shit."
Two separate problems, both fixed:
  1. THE PHOTO WAS A THUMBNAIL. It held its native crop height (365px) and
     let it float as a thin strip across the top third of the frame, with
     two thirds of the frame empty dark card below it. ai/map/
     build_map_plate.py now stretches that same real crop to fill nearly
     the whole visible window (720px) -- see that file's v23 note for why
     a stretch, not a re-crop.
  2. THE PINS AND LEGEND WERE THIN WIREFRAME. Outlined rings, a thin
     leader line, a plain dark rectangle for the legend. v23 gives each
     pin a soft glow (the same blurred-aura technique as the sync beat
     right after it, for visual consistency between the two) and moves
     the legend from a big separate panel to a compact floating card, the
     way a real map's legend sits ON the map rather than in a second
     panel underneath it.

Four pins, placed on real, identifiable features of THIS photo -- not
invented locations:
  the falls itself           -> BLUE   (visual scenes)
  the mill ruin building     -> PURPLE (audio narration)
  the river/rapids downstream -> ORANGE (ambient noise)
  the tower/path overlook     -> GREEN  (lookout points)
No new claim is made about what happens at each -- the legend names the
CATEGORY the operator gave, the pin says where on the real park that
category of zone would sit. Nothing here asserts a date, a measurement, an
attribution, or that this exact configuration is deployed today -- same
standing rule as the rest of the film.
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import labelkit as LK

INK = (250, 250, 248)
DIM = (198, 201, 203)

BLUE = (120, 176, 236)
PURPLE = (196, 162, 230)
ORANGE = (240, 168, 104)
GREEN = (150, 208, 158)

# (x, y) read directly off ai/map/park_map_plate.png (the v23, frame-filling
# plate -- NOT the old 365px-tall crop's coordinates), colour, on-frame tag,
# legend label, stagger t0 (seconds into beat)
PINS = [
    (1230, 650, BLUE,   "THE FALLS",     "VISUAL SCENES",   0.35),
    (140,  560, PURPLE, "THE MILL",      "AUDIO NARRATION", 0.65),
    (1620, 500, ORANGE, "THE RAPIDS",    "AMBIENT SOUND",   0.95),
    (390,  385, GREEN,  "THE OVERLOOK",  "LOOKOUT POINTS",  1.25),
]

LEGEND_XY = (90, 700)


def _ease(k):
    k = max(0.0, min(1.0, k))
    return k * k * (3 - 2 * k)


def _glow(x, y, col, k, r=46):
    if k <= 0.002:
        return None
    pad = int(r * 2.2)
    size = pad * 2
    layer = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(layer)
    d.ellipse((size / 2 - r, size / 2 - r, size / 2 + r, size / 2 + r),
              fill=int(200 * k))
    layer = layer.filter(ImageFilter.GaussianBlur(r * 0.5))
    rgba = Image.new("RGBA", (size, size), col + (0,))
    rgba.putalpha(layer)
    return rgba, (int(x - pad), int(y - pad))


def _pin(d, x, y, col, tag, k):
    if k <= 0.002:
        return
    a = int(255 * k)
    r = int(8 + 3 * (1.0 - k) * 2)          # settles from a slightly larger ring
    d.ellipse((x - r, y - r, x + r, y + r), fill=col + (a,))
    d.ellipse((x - r, y - r, x + r, y + r), outline=(255, 255, 255, int(a * 0.9)), width=2)
    lx, ly = x + 28, y + 36
    d.line([(x + 8, y + 8), (lx - 4, ly - 10)], fill=col + (int(a * 0.85),), width=2)
    f = LK.inter(27, "Bold")
    d.text((lx + 2, ly + 2), tag, font=f, fill=(5, 8, 10, int(a * 0.6)), anchor="lm")
    d.text((lx, ly), tag, font=f, fill=INK + (a,), anchor="lm")


def _legend(d, x0, y0, k):
    if k <= 0.002:
        return
    a = int(235 * k)
    rows = [(p[2], p[4]) for p in PINS]
    w = 380
    h = 34 * len(rows) + 58
    d.rounded_rectangle([x0 - 24, y0 - 46, x0 + w, y0 + h - 46], radius=14,
                        fill=(6, 9, 12, int(178 * k)),
                        outline=INK + (int(a * 0.35),), width=1)
    ftitle = LK.inter(28, "Bold")
    d.text((x0, y0 - 18), "EXPERIENCE ZONES", font=ftitle, fill=INK + (a,),
           anchor="lm")
    fsub = LK.mono(20)
    fy = y0 + 26
    for col, label in rows:
        d.ellipse((x0, fy - 8, x0 + 16, fy + 8), fill=col + (a,))
        d.text((x0 + 30, fy), label, font=fsub, fill=DIM + (int(a * 1.05),),
               anchor="lm")
        fy += 34


def draw_map(img, t, dur):
    """Called every frame of the `map` beat. Fades in, holds, fades out."""
    k_in = _ease(min(1.0, t / 0.5))
    k_out = _ease(min(1.0, max(0.0, (dur - 0.12 - t) / 0.45)))
    base_k = k_in * k_out
    if base_k <= 0.002:
        return

    for x, y, col, tag, label, t0 in PINS:
        pk = _ease(min(1.0, max(0.0, (t - t0) / 0.45))) * base_k
        glow = _glow(x, y, col, pk)
        if glow:
            layer, pos = glow
            img.alpha_composite(layer, pos)

    d = ImageDraw.Draw(img)
    for x, y, col, tag, label, t0 in PINS:
        pk = _ease(min(1.0, max(0.0, (t - t0) / 0.45))) * base_k
        _pin(d, x, y, col, tag, pk)
    lk = _ease(min(1.0, max(0.0, (t - 0.15) / 0.5))) * base_k
    _legend(d, LEGEND_XY[0], LEGEND_XY[1], lk)
