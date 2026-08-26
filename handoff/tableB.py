#!/usr/bin/env python3
"""r54: the source / r52-guard / r54-continuity garment table r53 asked for."""
import os, sys, itertools, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, cv2
from proofB import frame, beats, load, dhue

def lab_mean(bgr, ys, xs):
    l = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)[np.array(ys), np.array(xs)]
    return (float(l[:,0].mean()*100/255), float(l[:,1].mean()-128.0), float(l[:,2].mean()-128.0))

def hab(a,b): return float(np.degrees(np.arctan2(b,a))%360.0)
def spread(h): return max(dhue(x,y) for x,y in itertools.combinations(h,2))

if __name__ == "__main__":
    v3, v4 = sys.argv[1], sys.argv[2]
    S = load(); out = "out2"
    print(f"{'beat':12s} {'':>4s}   {'SOURCE (plate)':^26s}   {'r52 GUARD (v3)':^26s}   {'r54 CONTINUITY (v4)':^26s}")
    print(f"{'':12s} {'px':>6s}   {'a*':>6s}{'b*':>7s}{'C*':>6s}{'hue':>7s}   "
          f"{'a*':>6s}{'b*':>7s}{'C*':>6s}{'hue':>7s}   {'a*':>6s}{'b*':>7s}{'C*':>6s}{'hue':>7s}")
    hs = {"src": [], "v3": [], "v4": []}
    rows = []
    for ft,(sid,lt,why) in beats().items():
        ys, xs = S[sid]["garment"]["ys"], S[sid]["garment"]["xs"]
        vals = {}
        for k, im in (("src", frame(f"{out}/{sid}_raw.mp4", lt)),
                      ("v3", frame(v3, ft)), ("v4", frame(v4, ft))):
            L,a,b = lab_mean(im, ys, xs)
            vals[k] = (L,a,b,float(np.hypot(a,b)),hab(a,b))
            hs[k].append(hab(a,b))
        line = f"{ft:6.1f}s {sid}  {len(ys):6d}"
        for k in ("src","v3","v4"):
            L,a,b,C,h = vals[k]
            line += f"   {a:+6.2f}{b:+7.2f}{C:6.2f}{h:7.1f}"
        print(line)
        rows.append(dict(film_s=ft, shot=sid, px=len(ys),
                         **{k: dict(zip(("L","a","b","C","hue"), v)) for k,v in vals.items()}))
    print()
    for k,label in (("src","source (plate)"),("v3","r52 guard    "),("v4","r54 continuity")):
        print(f"  film-wide Lab hue spread, {label}: {spread(hs[k]):5.1f} deg")
    print(f"\n  r53 target: r54 continuity spread <= 25 deg  ->  "
          f"{'PASS' if spread(hs['v4'])<=25 else 'FAIL'}")
    json.dump(rows, open("tableB.json","w"), indent=1)
