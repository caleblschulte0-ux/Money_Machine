#!/usr/bin/env python3
"""Per-clip steadiness + focus profile -> steady, sharp windows.
jitter = |v - smooth(v)| (hand shake, px/frame at 1920w), from work/motion/*.npy
focus  = Laplacian variance on a 480px-wide grey frame, sampled every 3rd frame
Writes work/windows/<clip>.npy [t, jitter, focus] and prints the best windows."""
import glob, os, sys
import cv2, numpy as np
os.makedirs("work/windows", exist_ok=True)

def focus_profile(path, step=3):
    cap = cv2.VideoCapture(path); fps = cap.get(cv2.CAP_PROP_FPS) or 30
    rows = []; i = 0
    while True:
        ok = cap.grab()
        if not ok: break
        if i % step == 0:
            ok, f = cap.retrieve()
            g = cv2.cvtColor(cv2.resize(f, (480, 270)), cv2.COLOR_BGR2GRAY)
            rows.append((i / fps, cv2.Laplacian(g, cv2.CV_64F).var()))
        i += 1
    return np.array(rows, np.float32)

def smooth(x, k):
    k = max(1, k | 1); return np.convolve(x, np.ones(k) / k, mode="same")

for p in sys.argv[1:]:
    if not os.path.exists(p): print("missing", p); continue
    name = os.path.basename(p).split(".")[0]
    out = f"work/windows/{name}.npy"
    m = np.load(f"work/motion/{name}.npy")
    if os.path.exists(out):
        w = np.load(out)
    else:
        fp = focus_profile(p)
        t = m[:, 0]
        jit = np.hypot(m[:, 1] - smooth(m[:, 1], 15), m[:, 2] - smooth(m[:, 2], 15))
        foc = np.interp(t, fp[:, 0], fp[:, 1])
        w = np.stack([t, jit, foc], 1).astype(np.float32); np.save(out, w)
    t, jit, foc = w.T
    fps = 30; L = int(3.0 * fps)
    if len(t) <= L: 
        print(f"{name}: short ({t[-1]:.1f}s) jit={jit.mean():.2f} foc={np.median(foc):.0f}"); continue
    # window score: p90 jitter (lower better), min focus relative to clip's p90 focus
    fref = np.percentile(foc, 90)
    best = []
    for s in range(0, len(t) - L, 15):
        j90 = np.percentile(jit[s:s+L], 90); fmin = foc[s:s+L].min() / max(fref, 1e-6)
        vel = np.hypot(m[s:s+L, 1], m[s:s+L, 2]).mean()
        best.append((j90, fmin, vel, t[s]))
    best.sort()
    print(f"{name}: {t[-1]:.1f}s  clip p90 jitter={np.percentile(jit,90):.2f}  focus p90={fref:.0f}")
    seen = []
    for j90, fmin, vel, ts in best:
        if any(abs(ts - x) < 3.0 for x in seen): continue
        seen.append(ts)
        print(f"   t={ts:5.1f}  jit90={j90:.2f}  focus={fmin:.2f}  vel={vel:.1f}px/f")
        if len(seen) >= 5: break
