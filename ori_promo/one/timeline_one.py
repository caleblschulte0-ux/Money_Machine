#!/usr/bin/env python3
"""Emit the handoff timeline for the single film FROM ITS SPEC.

Same rule as timelines.py for the five: a reviewer must never be asked to
check a film against a hand-typed description of it. Everything below is
read out of spec_one.py and out of the renderer's own disclosure literal.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, "..")

import shotqc
from spec_one import (BEATS, LABELS, ICE, TITLES, UI_OFF, figures,
                      W, H, FPS, TOTAL)

RAW = "../raw"


def disclosure():
    src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                            "render_one.py")).read()
    import re
    m = re.search(r'^\s*s = "([A-Z][^"]*)"\s*$', src, re.M)
    if not m:
        raise SystemExit("render_one.py: disclosure literal not found")
    return m.group(1)


def main():
    L = []
    L.append('ORI — "WHAT THIS PLACE WAS"')
    L.append("Lead capability: this place, shown in the times it has been")
    L.append(f"Running time {TOTAL:.3f}s   {W}x{H} @ {FPS} fps")
    L.append("")
    L.append("This file is GENERATED from the spec the renderer reads.")
    L.append("")
    L.append(f"Establishing montage: {', '.join(sorted(UI_OFF))} — no device UI")
    L.append("")
    L.append("SHOT LIST — film time, source, and the footage-gate reading at")
    L.append("the EXACT duration cut. A flagged plate is not cut, full stop.")
    L.append("")
    for b, clip, tin, st, d, note in BEATS:
        if clip is None:
            L.append(f"  {st:5.1f}–{st+d:5.1f}  {b:<5} (held)          {note}")
            continue
        m = shotqc.motion(clip, tin, d, raw=RAW)
        g = "unmeasurable"
        if m:
            f = shotqc.flags(m)
            g = (f"mot {m['mid']:.2f} tail {m['tail']:.2f} ratio {m['ratio']:.2f} "
                 f"drift {m['drift']*100:.1f}% peak {m['peak']:.1f}  "
                 f"{'PASS' if not f else ','.join(f)}")
        L.append(f"  {st:5.1f}–{st+d:5.1f}  {b:<5} IMG_{clip} @{tin:5.1f}s")
        L.append(f"                       {note}")
        L.append(f"                       gate: {g}")
    L.append("")
    L.append("FIGURES PLACED — the generated imagery, and where it stands")
    L.append("")
    for b, clip, tin, st, d, note in BEATS:
        for (src, foot, hpx, t0, build, sdep, mtch, toff) in figures(b):
            L.append(f"  {st+t0:5.1f}s  {os.path.basename(src)}")
            L.append(f"           feet at {foot}, {hpx}px tall, builds over {build:.1f}s")
            L.append(f"           light-match {mtch:.2f}, occlusion depth {sdep:.2f}")
            if toff is not None:
                L.append(f"           LEAVES at {st+toff:5.1f}s, gone by {st+toff+0.3:.1f}s")
    L.append("")
    L.append("ON-SCREEN COPY, VERBATIM")
    L.append("")
    for b, clip, tin, st, d, note in BEATS:
        v = LABELS.get(b)
        if v:
            L.append(f"  {st+v[3]:5.1f}s  \"{v[1]}\" / \"{v[2]}\"")
    L.append("")
    for b, clip, tin, st, d, note in BEATS:
        v = TITLES.get(b)
        if v:
            L.append(f"  {st+v[2]:5.1f}s  \"{v[0]}\" / \"{v[1]}\"   (the film's "
                     f"own voice, not an AR label — no reticle, no leader)")
    L.append("")
    # ICE IS A DICT KEYED BY BEAT and always has been. This read
    # ICE['beat'] / ICE['in'], which are not keys of anything -- so the
    # timeline generator raised KeyError the moment anyone ran it, and it
    # had been that way since the file was written. A generated handoff
    # document that has never been generated is not a document.
    _starts = {b: st for b, clip, tin, st, d, note in BEATS}
    for b, (direction, a0, a1) in ICE.items():
        L.append(f"  the ice grade ramps {direction.upper()} over {b} at "
                 f"{_starts[b]+a0:.1f}–{_starts[b]+a1:.1f}s film time")
    L.append("")
    L.append("STANDING DISCLOSURE")
    L.append(f"    {disclosure()}")
    L.append("  shown on every beat that places generated imagery, and the")
    L.append("  end card carries VISUAL INTENTION ONLY.")
    L.append("  No date, no measurement, no attribution is asserted anywhere.")
    print("\n".join(L))


if __name__ == "__main__":
    main()
