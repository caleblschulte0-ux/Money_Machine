#!/usr/bin/env python3
"""The `sync` beat: group sync, and the fact that groups do not bleed.

OPERATOR, on v21: "you never talk about the cool, like, features I
mentioned earlier, how we are going to make it so if you're in a group,
your stuff will sync. If you're not in a group, when you walk past another
group, your stuff will not overlap and it won't sound weird."

He gave me this feature in his own product answers and I filed it as
BLOCKED because no clip in the 34 shows two wearers together -- then said
so in a handoff round as if that settled it. It does not. The feature is
about what the SOFTWARE does with two groups in one park; it does not need
a photograph of two people to be explained, it needs a diagram. This is
the diagram.

WHAT IT SHOWS, and nothing more than what he said:
  - one group, three wearers, tied together with sync arcs and a shared
    pulse: inside a group everyone is on the same beat.
  - a second group nearby, on its own pulse, its own colour.
  - the gap between them drawn as a boundary that neither pulse crosses,
    labelled so the point is unmissable: the two groups do not overlap and
    do not bleed into each other.
No number of simultaneous users, no range in feet, no latency claim, no
statement that this is running at Falls Park today. The end card's VISUAL
INTENTION ONLY covers the whole film and this is squarely inside it.

THE PLATE is ai/map/park_sync_plate.png -- the same real aerial photograph
as the `map` beat, pushed in on the middle of the park. Same ground, new
information layer, which is why the two beats sit next to each other.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import labelkit as LK

INK = (250, 250, 248)
DIM = (198, 201, 203)

# your group / the other group. Deliberately far apart in hue so the
# "these are two separate things" reading survives the film's grade.
MINE = (120, 226, 238)
THEIRS = (238, 186, 120)

# wearers in each group, in plate pixels
# Placed on real ground, read off the plate: GROUP_A stands on the open
# lawn and path on the left, GROUP_B over on the rock shelf by the falls
# where visitors actually gather. Both clusters sit in the MIDDLE of the
# photo band (y 138-721), not at its bottom edge -- the first pass put
# them at y 470-608 with their captions at 700-760, which pushed the
# captions off the photograph and into the fade, where they were
# unreadable.
GROUP_A = [(255, 405), (395, 455), (300, 520)]
GROUP_B = [(1175, 455), (1300, 515)]

A_LABEL = ("YOUR GROUP", "SAME STORY, SAME MOMENT")
B_LABEL = ("ANOTHER GROUP", "THEIRS STAYS THEIRS")


def _ease(k):
    k = max(0.0, min(1.0, k))
    return k * k * (3 - 2 * k)


def _dot(d, x, y, col, k, r=14):
    a = int(255 * k)
    d.ellipse((x - r, y - r, x + r, y + r), outline=col + (a,), width=3)
    d.ellipse((x - 4, y - 4, x + 4, y + 4), fill=col + (a,))


def _pulse(d, pts, col, t, k, period=1.9, rmax=155):
    """Concentric rings leaving each member, on ONE shared clock.

    The shared clock is the whole point: every ring in a group starts at
    the same instant, so the group reads as synchronised rather than as
    three independent emitters. The other group runs the same code on a
    phase offset, so it is visibly on its own beat.
    """
    ph = (t % period) / period
    for rings in (0, 1):
        f = ph + rings * 0.5
        if f > 1.0:
            f -= 1.0
        r = 16 + rmax * f
        a = int(210 * k * (1.0 - f) ** 1.5)
        if a <= 2:
            continue
        for (x, y) in pts:
            d.ellipse((x - r, y - r * 0.62, x + r, y + r * 0.62),
                      outline=col + (a,), width=2)


def _ties(d, pts, col, k):
    """Lines between members of one group -- the sync itself."""
    a = int(190 * k)
    for i in range(len(pts)):
        for j in range(i + 1, len(pts)):
            d.line([pts[i], pts[j]], fill=col + (a,), width=2)


def _tag(d, xy, title, sub, col, k, anchor="ls"):
    if k <= 0.002:
        return
    a = int(252 * k)
    x, y = xy
    f1, f2 = LK.inter(36, "Bold"), LK.mono(22)
    d.text((x + 2, y + 2), title, font=f1, fill=(5, 8, 10, int(a * 0.6)), anchor=anchor)
    d.text((x, y), title, font=f1, fill=col + (a,), anchor=anchor)
    d.text((x + 2, y + 36), sub, font=f2, fill=DIM + (int(a * 0.92),), anchor=anchor)


def _barrier(d, k, t):
    """The boundary the two groups' audio does not cross.

    Drawn as a dashed vertical seam between the clusters with a short
    caption. It is the negative space that carries the feature -- "these
    do not reach each other" is hard to show by drawing something, so it
    is shown by drawing the line nothing crosses.
    """
    if k <= 0.002:
        return
    a = int(150 * k)
    x = 760
    y0, y1 = 250, 600
    step = 22
    y = y0
    while y < y1:
        d.line([(x, y), (x, min(y + 11, y1))], fill=INK + (a,), width=2)
        y += step
    f = LK.mono(22)
    s = "NO OVERLAP"
    w = d.textlength(s, font=f)
    d.rectangle([x - w / 2 - 16, y1 + 14, x + w / 2 + 16, y1 + 54],
                fill=(6, 9, 12, int(165 * k)))
    d.text((x, y1 + 34), s, font=f, fill=INK + (a,), anchor="mm")


def draw_sync(d, t, dur):
    k_in = _ease(min(1.0, t / 0.5))
    k_out = _ease(min(1.0, max(0.0, (dur - 0.12 - t) / 0.45)))
    k = k_in * k_out
    if k <= 0.002:
        return

    ka = _ease(min(1.0, max(0.0, (t - 0.25) / 0.5))) * k
    kb = _ease(min(1.0, max(0.0, (t - 1.35) / 0.5))) * k
    kbar = _ease(min(1.0, max(0.0, (t - 2.3) / 0.5))) * k

    _pulse(d, GROUP_A, MINE, t, ka)
    _ties(d, GROUP_A, MINE, ka)
    for (x, y) in GROUP_A:
        _dot(d, x, y, MINE, ka)

    # +0.95s of phase, so the second group is visibly NOT on your beat
    _pulse(d, GROUP_B, THEIRS, t + 0.95, kb)
    _ties(d, GROUP_B, THEIRS, kb)
    for (x, y) in GROUP_B:
        _dot(d, x, y, THEIRS, kb)

    _barrier(d, kbar, t)

    _tag(d, (150, 605), A_LABEL[0], A_LABEL[1], MINE, ka)
    _tag(d, (1140, 605), B_LABEL[0], B_LABEL[1], THEIRS, kb)
