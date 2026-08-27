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
from spec_one import BEATS, FIGURES, LABELS, ICE, W, H, FPS, TOTAL

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
        for (src, foot, hpx, t0, build, sdep, mtch) in FIGURES.get(b, []):
            L.append(f"  {st+t0:5.1f}s  {os.path.basename(src)}")
            L.append(f"           feet at {foot}, {hpx}px tall, builds over {build:.1f}s")
            L.append(f"           light-match {mtch:.2f}, occlusion depth {sdep:.2f}")
    L.append("")
    L.append("ON-SCREEN COPY, VERBATIM")
    L.append("")
    for b, clip, tin, st, d, note in BEATS:
        v = LABELS.get(b)
        if v:
            L.append(f"  {st+v[3]:5.1f}s  \"{v[1]}\" / \"{v[2]}\"")
    L.append("")
    L.append(f"  the ice grade ramps in over {ICE['beat']} at "
             f"{ICE['in'][0]:.1f}–{ICE['in'][1]:.1f}s into the beat")
    L.append("")
    L.append("STANDING DISCLOSURE")
    L.append(f"    {disclosure()}")
    L.append("  shown on every beat that places generated imagery, and the")
    L.append("  end card carries VISUAL INTENTION ONLY.")
    L.append("  No date, no measurement, no attribution is asserted anywhere.")
    print("\n".join(L))


if __name__ == "__main__":
    main()
