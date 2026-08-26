#!/usr/bin/env python3
"""r54: simulate the continuity offset on the eight frozen proof frames.

Runs the real delivered chain -- high-key -> finish -> guard -> offset -- on
single frames, so a target can be chosen on measurement instead of on a guess,
before committing to a 35-minute render.
"""
import sys, os, itertools, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.abspath("../finish"))
import numpy as np, cv2
import filmfinish as F, garmentguard as GG, garmentmask as GM
from proofB import frame, beats, load, stats, dhue
from seedsB import SEEDS

FIN = dict(halo=0.11, blm=0.07, ca=0.35, vig=0.10, contrast=1.02)
CAP = 10.0


def finish_frame(f, halo, blm, ca, vig, contrast):
    h, w = f.shape[:2]
    f = F.colour_split(f); f = F.filmic(f, contrast=contrast)
    f = F.halation(f, amount=halo); f = F.bloom(f, amount=blm)
    f = F.chroma_ab(f, ca)
    return np.clip(f * F.vignette_mask(w, h, vig), 0, 1)


def apply_offset(bgr, m, da, db):
    l = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    l[..., 1] += m*da
    l[..., 2] += m*db
    return cv2.cvtColor(np.clip(l, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)


def shot_refs(out="out2"):
    r = {}
    for sid, s in SEEDS.items():
        if s is None:
            continue
        im = frame(f"{out}/{sid}_raw.mp4", s["t"])
        L, a, b, n = GM.patch_lab(im, s["patch"])
        r[sid] = (L, a, b)
    return r


def offsets(refs, ta, tb, cap=CAP):
    return {sid: (float(np.clip(ta-a, -cap, cap)), float(np.clip(tb-b, -cap, cap)))
            for sid, (L, a, b) in refs.items()}


def lab_mean(bgr, ys, xs):
    l = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)[ys, xs]
    return (l[:, 0].mean()*100/255, l[:, 1].mean()-128.0, l[:, 2].mean()-128.0)


def hab(a, b):
    return float(np.degrees(np.arctan2(b, a)) % 360.0)


def spread(hs):
    return max(dhue(x, y) for x, y in itertools.combinations(hs, 2))


def simulate(off, out="out2"):
    S = load(); rows = []
    for ft, (sid, lt, why) in beats().items():
        raw = frame(f"{out}/{sid}_raw.mp4", lt)
        hk = frame(f"{out}/{sid}_hk.mp4", lt).astype(np.float32)/255.0
        fin = (finish_frame(hk, **FIN)*255).astype(np.uint8)
        g = GG.apply(fin, raw)
        s = SEEDS[sid]
        ref = GM.patch_lab(raw, s["patch"])[:3]
        m = GM.build(raw, s["gate"], ref)
        da, db = off[sid]
        c = apply_offset(g, m, da, db)
        ys = np.array(S[sid]["garment"]["ys"]); xs = np.array(S[sid]["garment"]["xs"])
        rows.append(dict(ft=ft, sid=sid, cov=float(m[ys, xs].mean()),
                         src=lab_mean(raw, ys, xs), guard=lab_mean(g, ys, xs),
                         cont=lab_mean(c, ys, xs),
                         hsv_src=stats(raw, ys, xs), hsv_cont=stats(c, ys, xs)))
    return rows


if __name__ == "__main__":
    refs = shot_refs()
    med = (float(np.median([v[1] for v in refs.values()])),
           float(np.median([v[2] for v in refs.values()])))
    anch = (refs["b00"][1], refs["b00"][2])
    cands = {"median": med, "anchor": anch,
             "midway": ((med[0]+anch[0])/2, (med[1]+anch[1])/2),
             "median_b_shifted_warm": (med[0], med[1]+3.0)}
    for name, (ta, tb) in cands.items():
        off = offsets(refs, ta, tb)
        rows = simulate(off)
        hs = [hab(r["cont"][1], r["cont"][2]) for r in rows]
        hs0 = [hab(r["src"][1], r["src"][2]) for r in rows]
        worst = max(dhue(r["hsv_src"]["hue"], r["hsv_cont"]["hue"]) for r in rows)
        print(f"\ntarget {name:24s} a*{ta:+5.2f} b*{tb:+6.2f}")
        print(f"  Lab hue spread  source {spread(hs0):5.1f} -> continuity {spread(hs):5.1f} deg"
              f"   (r53 limit 25)")
        print(f"  worst src->delivered HSV hue move {worst:5.1f} deg   "
              f"b00 offset da*{off['b00'][0]:+.2f} db*{off['b00'][1]:+.2f}")
        for r in rows:
            print(f"    {r['ft']:5.1f}s {r['sid']} cov {100*r['cov']:5.1f}%  "
                  f"src a*{r['src'][1]:+6.2f} b*{r['src'][2]:+7.2f}  ->  "
                  f"cont a*{r['cont'][1]:+6.2f} b*{r['cont'][2]:+7.2f}  hue {hab(r['cont'][1],r['cont'][2]):6.1f}")
