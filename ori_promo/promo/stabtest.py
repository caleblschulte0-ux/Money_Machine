#!/usr/bin/env python3
"""Render a shot through prep_shot with given options and MEASURE the residual
shake on the output (same LK profiler as motion.py). Usage:
  stabtest.py <name> <src> <t_in> <dur> key=val ..."""
import os, sys
import numpy as np
sys.argv, args = sys.argv[:1], sys.argv[1:]
import build
from motion import profile
name, src, t_in, dur = args[0], args[1], float(args[2]), float(args[3])
opt = {}
for kv in args[4:]:
    k, v = kv.split("=", 1)
    opt[k] = eval(v)
build.SHOTS_DIR = "work/stabtest"; os.makedirs(build.SHOTS_DIR, exist_ok=True)
for ext in ("mp4", "wav"):
    p = f"work/stabtest/{name}.{ext}"
    if os.path.exists(p): os.remove(p)
build.prep_shot(name, src, t_in, dur, opt)
a = profile(f"work/stabtest/{name}.mp4")
v = np.hypot(a[:, 1], a[:, 2])
k = 15
sm = np.stack([np.convolve(a[:, i], np.ones(k) / k, mode="same") for i in (1, 2)], 1)
jit = np.hypot(a[:, 1] - sm[:, 0], a[:, 2] - sm[:, 1])
print(f"RESULT {name}: frames={len(a)} vel={v.mean():.2f} jitter p50={np.median(jit):.2f} p90={np.percentile(jit,90):.2f} max={jit.max():.2f}")
