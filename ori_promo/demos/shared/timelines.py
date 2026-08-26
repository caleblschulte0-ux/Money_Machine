#!/usr/bin/env python3
"""Emit the handoff timeline for a film FROM ITS SPEC.

Written after r50 published wrong film-time labels for Film B -- 30.0 / 40.0 /
63.0 against a real 14.5 / 38.0 / 69.0 -- because the numbers were typed by
hand into a text file while the truth lived in a Python table. Anything a
reviewer is asked to check against has to be generated from the same source
the renderer reads, or it will eventually describe a film that does not exist.

    python3 timelines.py 2 > r68__claude__demo2__timeline.txt
"""
import importlib
import subprocess
import sys

TITLES = {
    "1": ("THROUGH THE GLASS", "live recognition and in-place labelling"),
    "2": ("WHAT STOOD HERE", "historical reconstruction"),
    "3": ("THEN AND NOW", "time under the viewer's control"),
    "4": ("DEEP TIME", "depth, material classes and what is under the ground"),
    "5": ("THE TOUR", "two viewers, different content, one shared mark"),
}


import os

RAW = "raw" if os.path.isdir("raw") else "../raw"


def gate_row(clip, tin, dur):
    sys.path.insert(0, ".")
    sys.path.insert(0, "finish")
    import shotqc
    m = shotqc.motion(clip, tin, dur, raw=RAW)
    if m is None:
        return "unmeasurable"
    f = shotqc.flags(m)
    return (f"mot {m['mid']:.2f} tail {m['tail']:.2f} ratio {m['ratio']:.2f} "
            f"drift {m['drift']*100:.1f}% peak {m['peak']:.1f}  "
            f"{'PASS' if not f else ','.join(f)}")


def main(n):
    sys.path.insert(0, f"film{n}")
    spec = importlib.import_module(f"spec{n}")
    title, cap = TITLES[n]
    L = []
    L.append(f"DEMO {n} — \"{title}\"")
    L.append(f"Lead capability: {cap}")
    L.append(f"Running time {spec.TOTAL:.3f}s   {spec.W}x{spec.H} @ {spec.FPS} fps")
    L.append("")
    L.append("This file is GENERATED from the spec the renderer reads. It cannot")
    L.append("drift from the film the way a hand-typed timeline can, and did.")
    L.append("")
    L.append("SHOT LIST — film time, source, and the footage-gate reading at the")
    L.append("EXACT duration cut. A flagged plate is not cut, full stop.")
    L.append("")
    for b, clip, tin, st, d, note in spec.BEATS:
        if clip is None:
            L.append(f"  {st:6.1f}–{st+d:5.1f}  {b:5s}  (held)            {note}")
            continue
        L.append(f"  {st:6.1f}–{st+d:5.1f}  {b:5s}  IMG_{clip} @ {tin:5.1f}s")
        L.append(f"                       {note}")
        L.append(f"                       gate: {gate_row(clip, tin, d)}")
    L.append("")
    L.append("ON-SCREEN COPY, VERBATIM")
    L.append("")
    for name, table in (("labels", getattr(spec, "LABELS", {})),
                        ("anchors", getattr(spec, "ANCHORS", {})),
                        ("marks", getattr(spec, "MARKS", {}))):
        if not table:
            continue
        for beat, v in table.items():
            st = next(x[3] for x in spec.BEATS if x[0] == beat)
            rows = v if isinstance(v, list) else [v]
            for r in rows:
                if len(r) == 6:            # demo 5 marks carry a profile first
                    prof, pt, ti, sub, t0, off = r
                    L.append(f"  {st+t0:6.1f}s  [{prof}] \"{ti}\" / \"{sub}\"")
                else:
                    pt, ti, sub, t0, off = r
                    L.append(f"  {st+t0:6.1f}s  \"{ti}\" / \"{sub}\"")
    for beat, v in getattr(spec, "PLACES", {}).items():
        st = next(x[3] for x in spec.BEATS if x[0] == beat)
        for key, ctr, hgt, t0, bs in v:
            L.append(f"  {st+t0:6.1f}s  reconstruction {key} assembles over {bs:.1f}s "
                     f"at {ctr}, {hgt}px tall")
    past = getattr(spec, "PAST", {})
    for beat, v in past.items():
        if not v:
            continue
        st = next(x[3] for x in spec.BEATS if x[0] == beat)
        L.append(f"  {st:6.1f}s  past side of the seam carries {v[0]} at {v[1]}, {v[2]}px")
    L.append("")
    L.append("STANDING DISCLOSURE")
    L.append("  Any beat carrying a reconstruction shows, for its whole length:")
    L.append("    VISUAL INTENTION ONLY — RECONSTRUCTION, NOT A PHOTOGRAPH")
    L.append("  and the end card carries VISUAL INTENTION ONLY.")
    L.append("  No date, no measurement, no attribution is asserted anywhere in")
    L.append("  any of the five films.")
    print("\n".join(L))


if __name__ == "__main__":
    main(sys.argv[1])
