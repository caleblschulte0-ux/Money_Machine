#!/usr/bin/env python3
"""Re-render NAMED BEATS of Demo 4 without redoing the whole film.

The normalization plan is recomputed from all five plates every time, exactly
as render4.py computes it, so a re-rendered beat is graded against the same
common black and white as the beats it sits next to. Re-normalising one shot
in isolation is how a film ends up with a cut that flashes.

    python3 rebeat.py b1 b2
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.abspath(".."))
sys.path.insert(0, os.path.abspath("../finish"))
import numpy as np
import shotnorm as SN
import render4 as R
from spec4 import BEATS

OUT = R.OUT

if __name__ == "__main__":
    want = set(sys.argv[1:])
    if not want:
        raise SystemExit("name the beats to re-render, e.g. rebeat.py b1 b2")
    live = [b for b in BEATS if b[1]]
    stats = []
    for b, clip, tin, st, d, note in live:
        src = f"{OUT}/{b}_raw.mp4"
        if not os.path.exists(src):
            R.plate(b, clip, tin, d)
        fr = R.read_frames(src)
        ims = [fr[j] for j in (5, min(30, len(fr) - 1), min(60, len(fr) - 1))]
        s = [SN.measure(SN.deliver_region(i.astype(np.float32) / 255.0, aspect=16 / 9))
             for i in ims]
        m = {}
        for k in s[0]:
            v = np.mean([np.asarray(x[k], dtype=np.float64) for x in s], axis=0)
            m[k] = v if getattr(v, "ndim", 0) else float(v)
        stats.append(m)
    tgt, plans = SN.plan(stats)
    print(f"  common black {tgt['black']:.4f} white {tgt['white']:.4f}", flush=True)
    for (b, clip, tin, st, d, note), p in zip(live, plans):
        if b not in want:
            continue
        fr = R.read_frames(f"{OUT}/{b}_raw.mp4")
        nf = [(np.clip(SN.apply(f.astype(np.float32) / 255.0, p), 0, 1) * 255).astype(np.uint8)
              for f in fr]
        ov = R.compose(b, d, nf)
        R.encode(ov, f"{OUT}/{b}_t.mp4")
        print(f"  {b} re-rendered ({len(ov)} frames)  {SN.describe(p)}", flush=True)
