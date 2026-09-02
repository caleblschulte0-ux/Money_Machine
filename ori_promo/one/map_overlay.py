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
Built in ai/map/park_map_plate.png: the real 1920x365 crop, laid into a
1920x1080 card with a soft defocused fade below it (not a hard crop, not a
darkening filter) down to the film's own dark palette, where the legend key
sits. That plate is a STATIC hold for the whole beat -- deliberately, so
every pin below can use a fixed pixel anchor instead of needing per-frame
tracking, which a photo card does not need and a moving plate would have
forced.

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

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import labelkit as LK

INK = (250, 250, 248)
DIM = (198, 201, 203)

BLUE = (120, 176, 236)
PURPLE = (186, 156, 224)
ORANGE = (238, 168, 108)
GREEN = (150, 208, 158)

# (x, y) in the FULL 1920x1080 plate (photo already offset to y=138..503),
# colour, short on-frame tag, legend label, stagger t0 (seconds into beat)
PINS = [
    (1295, 368, BLUE,   "THE FALLS",        "VISUAL SCENES",   0.35),
    (150,  318, PURPLE, "THE MILL",         "AUDIO NARRATION", 0.65),
    (1680, 380, ORANGE, "THE RAPIDS",       "AMBIENT SOUND",   0.95),
    (470,  278, GREEN,  "THE OVERLOOK",     "LOOKOUT POINTS",  1.25),
]

LEGEND_XY = (96, 760)


def _ease(k):
    k = max(0.0, min(1.0, k))
    return k * k * (3 - 2 * k)


def _pin(d, x, y, col, tag, k):
    if k <= 0.002:
        return
    a = int(255 * k)
    r = int(7 + 3 * (1.0 - k) * 2)          # settles from a slightly larger ring
    d.ellipse((x - r, y - r, x + r, y + r), outline=col + (a,), width=3)
    d.ellipse((x - 3, y - 3, x + 3, y + 3), fill=col + (a,))
    # short leader down-right to the tag, same vocabulary as LK's label leader
    lx, ly = x + 26, y + 34
    d.line([(x + 6, y + 6), (lx - 4, ly - 10)], fill=col + (int(a * 0.85),), width=2)
    f = LK.inter(24, "SemiBold")
    d.text((lx + 2, ly + 2), tag, font=f, fill=(5, 8, 10, int(a * 0.6)), anchor="lm")
    d.text((lx, ly), tag, font=f, fill=INK + (a,), anchor="lm")


def _legend(d, x0, y0, k):
    if k <= 0.002:
        return
    a = int(230 * k)
    rows = [(p[2], p[4]) for p in PINS]
    w = 420
    h = 34 * len(rows) + 56
    d.rectangle([x0 - 22, y0 - 44, x0 + w, y0 + h - 44],
                fill=(6, 9, 12, int(150 * k)))
    ftitle = LK.inter(30, "Bold")
    d.text((x0, y0 - 18), "EXPERIENCE ZONES", font=ftitle, fill=INK + (a,),
           anchor="lm")
    fsub = LK.mono(20)
    fy = y0 + 26
    for col, label in rows:
        d.ellipse((x0, fy - 8, x0 + 16, fy + 8), fill=col + (a,))
        d.text((x0 + 30, fy), label, font=fsub, fill=DIM + (int(a * 1.05),),
               anchor="lm")
        fy += 34


def draw_map(d, t, dur):
    """Called every frame of the `map` beat. Fades in, holds, fades out."""
    k_in = _ease(min(1.0, t / 0.5))
    k_out = _ease(min(1.0, max(0.0, (dur - 0.12 - t) / 0.45)))
    base_k = k_in * k_out
    if base_k <= 0.002:
        return
    for x, y, col, tag, label, t0 in PINS:
        pk = _ease(min(1.0, max(0.0, (t - t0) / 0.45))) * base_k
        _pin(d, x, y, col, tag, pk)
    lk = _ease(min(1.0, max(0.0, (t - 0.15) / 0.5))) * base_k
    _legend(d, LEGEND_XY[0], LEGEND_XY[1], lk)
