#!/usr/bin/env python3
"""Do any two labels that are on screen together overlap?

WHY THIS EXISTS. Demo 5's b1 shipped with "MILL HOUSE" and "TWO VIEWERS"
intersecting over a 122x42 region -- two large translucent panels crossing
each other at the top of frame. Nothing caught it. The specs hold anchors
and offsets, not boxes, so the collision is invisible in the source; it only
appears once the type is measured, and by then it is a rendered frame that
somebody has to happen to look at. ChatGPT's r69 note that Demo 5 "is still
dense" was this, seen from the outside without a name for it.

Reproduces labelkit.block()'s geometry exactly -- same fonts, same clamps,
same scrim padding, same optional tag chip. If block() changes, this must
change with it, which is the price of measuring instead of guessing.

Beat-relative appear times are compared within a beat only: two labels in
different beats are never on screen together. Anchors track, so a box drifts
a little from the position checked here; this catches what the spec designs
in, which is the class that ships.

    python3 labelfit.py            # all five films
    python3 labelfit.py 5          # one film
"""
import os
import sys
from PIL import Image, ImageDraw
import labelkit as LK

W, H = 1920, 1080


def box_of(anchor, off, title, sub, d, tag=None):
    ax, ay = anchor
    bx, by = ax + off[0], ay + off[1]
    f1, f2, f3 = LK.inter(LK.TITLE_PX), LK.mono(LK.SUB_PX), LK.mono(LK.TAG_PX)
    tw = d.textlength(title, font=f1)
    sw = sum(d.textlength(c, font=f2) for c in sub) + 4.0 * max(0, len(sub) - 1)
    x0 = bx if bx >= ax else bx - tw
    x0 = min(max(x0, 92.0), W - 92.0 - max(tw, sw))
    by = min(max(by, 176.0), H - 196.0)
    wid = max(tw, sw)
    b = [x0 - 26, by - LK.TITLE_PX - 12, x0 + wid + 26, by + LK.SUB_PX + 24]
    if tag:
        cw = d.textlength(tag, font=f3) + 28
        b = [min(b[0], x0 - 4), by - LK.TITLE_PX - 56,
             max(b[2], x0 + cw), b[3]]
    return b


def overlap(a, b):
    x = min(a[2], b[2]) - max(a[0], b[0])
    y = min(a[3], b[3]) - max(a[1], b[1])
    return (x, y) if x > 0 and y > 0 else None


def _spec(n):
    """Load film N's spec by PATH, not by name.

    The five specs are all called spec<N> and live in sibling directories, so
    an import-by-name picks up whichever one is on sys.path first and then
    silently reuses it from sys.modules for every later film. Checking five
    films against one film's labels would have reported a clean sweep.
    """
    import importlib.util
    root = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(root, f"film{n}", f"spec{n}.py")
    sp = importlib.util.spec_from_file_location(f"_labelfit_spec{n}", path)
    m = importlib.util.module_from_spec(sp)
    sp.loader.exec_module(m)
    return m


def collect(n, d):
    """-> {beat: [(name, appear_t, box)]}"""
    spec = _spec(n)
    out = {}
    for beat, v in getattr(spec, "LABELS", {}).items():
        anc, title, sub, t0, off = v
        out.setdefault(beat, []).append((f"label:{title}", t0,
                                         box_of(anc, off, title, sub, d)))
    for beat, marks in getattr(spec, "MARKS", {}).items():
        for m in marks:
            who, anc, title, sub, t0, off = m
            prof = spec.PROFILES[who]
            tag = f"VIEWER {who} · {prof['track']}"
            out.setdefault(beat, []).append((f"mark {who}:{title}", t0,
                                             box_of(anc, off, title, sub, d, tag)))
    return out


def main(films):
    d = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
    bad = 0
    for n in films:
        for beat, items in sorted(collect(n, d).items()):
            for i in range(len(items)):
                for j in range(i + 1, len(items)):
                    (n1, t1, b1), (n2, t2, b2) = items[i], items[j]
                    o = overlap(b1, b2)
                    if o:
                        bad += 1
                        print(f"DEMO {n} {beat}: {n1} x {n2}  "
                              f"overlap {o[0]:.0f}x{o[1]:.0f}px "
                              f"(appear {t1}s / {t2}s)")
            for name, t, b in items:
                if b[0] < 0 or b[2] > W or b[1] < 0 or b[3] > H:
                    bad += 1
                    print(f"DEMO {n} {beat}: {name} OFF-FRAME "
                          f"[{b[0]:.0f},{b[1]:.0f},{b[2]:.0f},{b[3]:.0f}]")
    print(f"\n{bad} problem(s)")
    return bad


if __name__ == "__main__":
    a = sys.argv[1:] or list("12345")
    sys.exit(1 if main(a) else 0)
