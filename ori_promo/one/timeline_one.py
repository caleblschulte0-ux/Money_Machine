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
                      SCRUB_STOPS, SCRUB_KEYS, W, H, FPS, TOTAL)

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
    # Only when there IS one. v8 has no montage, and this printed
    # "Establishing montage:  — no device UI" -- an empty list stated as a
    # fact about the film.
    if UI_OFF:
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
        for (src, foot, hpx, t0, build, sdep, mtch, toff, shw, ct) in figures(b):
            L.append(f"  {st+t0:5.1f}s  {os.path.basename(src)}")
            L.append(f"           feet at {foot}, {hpx}px tall, builds over {build:.1f}s")
            L.append(f"           light-match {mtch:.2f}, occlusion depth {sdep:.2f}, "
                     f"shadow {shw:.2f}, contact "
                     + ("tied to shadow" if ct is None else f"{ct:.2f}"))
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
    for b, (i0, i1, o0, o1) in ICE.items():
        # An in-envelope that has already finished before the beat starts
        # is the spec's way of saying "this beat opens fully iced" -- it is
        # NOT a ramp, and printing it as one put the ramp a second before
        # the beat it belongs to.
        if i1 <= 0:
            L.append(f"  {b} opens ALREADY at full ice — the era did not "
                     f"re-arrive between two shots of it")
        else:
            L.append(f"  the ice grade ramps IN over {b} at "
                     f"{_starts[b]+i0:.1f}–{_starts[b]+i1:.1f}s film time")
        if o0 is not None:
            L.append(f"  and thaws back OUT at "
                     f"{_starts[b]+o0:.1f}–{_starts[b]+o1:.1f}s, so the cut off "
                     f"this beat lands between two present-day frames")
    L.append("")
    # THE ERA RAIL. It is the mechanism the film now turns on, and a
    # reviewer checking the cut against this document would not have known
    # it existed. A generated timeline that omits the load-bearing element
    # is the same failure as one that describes a rule the code dropped.
    L.append("")
    L.append("THE ERA RAIL — the scrub the wearer drives. The marker moves")
    L.append("FIRST; the world answers behind it. That ordering is the whole")
    L.append("point, so it is stated here as times you can check.")
    L.append("")
    L.append("  stops: " + "  ".join(f"{lab} @{p:.2f}" for lab, p in SCRUB_STOPS))
    for t, p in SCRUB_KEYS:
        lab = next((l for l, q in SCRUB_STOPS if abs(q - p) < 1e-6), f"{p:.2f}")
        L.append(f"  {t:5.1f}s  marker at {lab}")
    L.append("")

    # NARRATION. Read out of vo_one.py, not retyped -- an earlier round
    # had me appending the script to the UPLOADED copy of this file by
    # hand, which turns a generated document into a hand-written one that
    # still claims to be generated.
    try:
        import vo_one
        L.append("NARRATION, VERBATIM (synthesized offline, piper en_US-ryan;")
        L.append("no licensed or cloned voice. Location audio removed entirely.)")
        L.append("")
        for beat, off, text in vo_one.LINES:
            st = next(b[3] for b in BEATS if b[0] == beat)
            L.append(f"  {st + off:5.1f}s  \"{text}\"")
        L.append("")
        L.append("  No date, no measurement, no attribution, and no claim about")
        L.append("  what is deployed today — the same standard as the copy above.")
        L.append("")
    except Exception as e:                      # never fail the timeline over VO
        L.append(f"NARRATION: could not be read from vo_one.py ({e})")
        L.append("")

    # THE LOOK. New in v12 and it touches every frame in the film, so a
    # reviewer checking the cut against this document has to be told it
    # exists. Read from filmlook, not retyped -- same rule as the rail
    # and the narration.
    try:
        import filmlook as _FL
        bar_t, bar_b = _FL.safe_area(H, W)
        L.append("THE LOOK — applied to every frame, not per shot")
        L.append("")
        L.append(f"  scope        {_FL.SCOPE}:1  (bars above {bar_t} and below {bar_b})")
        pts = "  ".join(f"{int(x*255)}->{int(y*255)}"
                        for x, y in zip(_FL._CP_X, _FL._CP_Y))
        L.append(f"  tone curve   {pts}")
        L.append("  plus split tone (cool shadows, warm highlights), fine")
        L.append("  MOVING grain, and a light vignette. The plate is graded")
        L.append("  BEFORE anything is drawn on it, so the HUD stays crisp")
        L.append("  while the footage stops looking like a phone.")
        L.append("")
    except Exception as e:
        L.append(f"THE LOOK: could not be read from filmlook.py ({e})")
        L.append("")

    L.append("STANDING DISCLOSURE")
    L.append(f"    {disclosure()}")
    # The renderer's tag tracks the FIGURES, not the beat (v6). Saying
    # "on every beat that places generated imagery" was true of the old
    # rule and would now be a generated file describing code that no
    # longer exists.
    L.append("  shown WHILE GENERATED IMAGERY IS ON SCREEN — the tag follows the")
    L.append("  figures, not the beat, so it clears when the last one leaves and")
    L.append("  the film's final unmodified frames carry no claim about imagery")
    L.append("  that is not there. The end card carries VISUAL INTENTION ONLY as")
    L.append("  its own separate disclosure.")
    L.append("  No date, no measurement, no attribution is asserted anywhere.")
    print("\n".join(L))


if __name__ == "__main__":
    main()
