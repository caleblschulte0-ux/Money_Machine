#!/usr/bin/env python3
"""r54: the control sets -- material r53 put OUT of bounds for the correction.

r53: "report the maximum observed change for at least one verified control set
each of foliage, skin, water/stone, and AR bronze."

Each control is a frozen pixel set, placed by eye and checked by crop, exactly
like the garment proof sets. The AR bronze set is not hand-placed: it is
DERIVED, as the footprint where the AR composite actually differs from the
pre-AR shot, so it cannot miss the reconstruction or accidentally include the
plate around it.

The controls are measured on the DELIVERED masters -- r52's v3 against r54's
v4 -- because that is the question: did the continuity pass change anything it
was not allowed to change? Some change is expected and is not the correction:
both masters are h.264 encodes, so every pixel moves a little.
"""
import os, sys, json, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, cv2
from proofB import frame, load, beats

HERE = os.path.dirname(os.path.abspath(__file__))

# name -> (shot, seconds into shot, film seconds, ROI)
BOXES = {
    "skin  (b09 forearm)":   ("b09", 3.75, 55.25, (880, 720,  50, 110)),
    "water (b11 falls)":     ("b11", 3.00, 69.00, (430, 700, 160, 120)),
    "stone (b06 curved wall)": ("b06", 4.00, 38.00, (700, 940, 220, 110)),
    "stone (b11 dark ledge)": ("b11", 3.00, 69.00, (980, 860, 180, 110)),
    # r53 named these three explicitly as out of bounds.
    "2nd visitor (b10)":     ("b10", 4.00, 63.00, (1600, 480, 190, 420)),
    # the clock is drawn into the PLATE at x=74, y=h-104, and is only up
    # between 0.55s and 2.75s into a shot -- hence the 1.60s sample.
    "clock card (b05)":      ("b05", 1.60, 29.60, (60, 940, 240, 60)),
    "end card (b13)":        (None,  0.00, 79.50, (0, 0, 1920, 1080)),
}
AR = {"bronze (b09 reconstruction)": ("b09", 3.75, 55.25),
      "bronze (b04 reconstruction)": ("b04", 3.00, 25.00)}
AR_T = 14          # min per-pixel BGR difference to count as overlay


def freeze(out="out2"):
    s = {}
    for name, (sid, lt, ft, (x, y, w, h)) in BOXES.items():
        ys, xs = np.mgrid[y:y+h, x:x+w]
        s[name] = dict(film_s=ft, ys=ys.ravel().tolist(), xs=xs.ravel().tolist())
        print(f"  {name:28s} {w*h:6d} px", flush=True)
    for name, (sid, lt, ft) in AR.items():
        pre = frame(f"{out}/{sid}_v3.mp4", lt).astype(int)
        post = frame(f"{out}/{sid}_ar.mp4", lt).astype(int)
        m = np.abs(post-pre).max(axis=2) >= AR_T
        m = cv2.erode(m.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool)
        ys, xs = np.nonzero(m)
        s[name] = dict(film_s=ft, ys=ys.tolist(), xs=xs.tolist())
        print(f"  {name:28s} {len(ys):6d} px  (derived from the AR footprint)", flush=True)
    json.dump(s, open(os.path.join(HERE, "controlB.json"), "w"))
    return s


def lab_mean(bgr, ys, xs):
    l = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)[np.array(ys), np.array(xs)]
    return (float(l[:, 0].mean()*100/255), float(l[:, 1].mean()-128.0),
            float(l[:, 2].mean()-128.0))


def compare(m_a, m_b):
    """Lab change on every control, master A -> master B."""
    s = json.load(open(os.path.join(HERE, "controlB.json")))
    rows = []
    for name, d in s.items():
        ft = d["film_s"]
        a = lab_mean(frame(m_a, ft), d["ys"], d["xs"])
        b = lab_mean(frame(m_b, ft), d["ys"], d["xs"])
        rows.append((name, len(d["ys"]), a, b,
                     b[0]-a[0], b[1]-a[1], b[2]-a[2]))
    # foliage comes from the r52 proof sets, already frozen and accepted
    S = load()
    for ft, (sid, lt, why) in beats().items():
        d = S[sid]["foliage"]
        a = lab_mean(frame(m_a, ft), d["ys"], d["xs"])
        b = lab_mean(frame(m_b, ft), d["ys"], d["xs"])
        rows.append((f"foliage ({sid} @{ft:.1f}s)", len(d["ys"]), a, b,
                     b[0]-a[0], b[1]-a[1], b[2]-a[2]))
    return rows


if __name__ == "__main__":
    if sys.argv[1] == "freeze":
        freeze()
    else:
        rows = compare(sys.argv[1], sys.argv[2])
        print(f"{'control':32s} {'px':>7s}   dL*     da*     db*")
        for name, n, a, b, dL, da, db in rows:
            print(f"  {name:30s} {n:7d}  {dL:+6.3f} {da:+6.3f} {db:+6.3f}")
        print(f"\n  MAXIMUM |dL*| {max(abs(r[4]) for r in rows):.3f}   "
              f"|da*| {max(abs(r[5]) for r in rows):.3f}   "
              f"|db*| {max(abs(r[6]) for r in rows):.3f}")
