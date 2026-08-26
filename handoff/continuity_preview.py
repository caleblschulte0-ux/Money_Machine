#!/usr/bin/env python3
"""r52 evidence: what a garment CONTINUITY pass would cost, measured.

r51 asked for two things that are in tension, and the source measurement is
what shows it:

  1. a NUMERIC target -- source-to-delivered garment hue shift <= 15deg;
  2. a NARRATIVE goal -- the shirt should stop changing identity across the
     afternoon.

The garment guard delivers (1) by restoring plate chroma. It cannot deliver
(2), because the plate is not consistent either: across the eight proof beats
the UNGRADED garment measures Lab b* from +2.3 to -19.8 -- a dark matte shirt
in open shade taking a blue skylight fill that varies with where the subject
is standing. Matching the source perfectly reproduces that swing.

This script does not render anything and does not change the film. It runs the
exact delivered chain on the eight sample frames and reports, side by side:

  guard        what r52 ships -- source chroma restored
  continuity   the same guard plus a bounded per-shot Lab offset that moves
               each beat's garment toward the film's median garment chroma

so the trade can be ruled on with numbers instead of adjectives.
"""
import os, sys, itertools, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.abspath("../finish"))
import numpy as np, cv2
import filmfinish as F, garmentguard as GG
from proofB import frame, beats, load, stats, dhue

FIN = dict(halo=0.11, blm=0.07, ca=0.35, vig=0.10, contrast=1.02)
CAP = 10.0          # max Lab units a continuity pass would be allowed to move


def finish_frame(f, halo, blm, ca, vig, contrast):
    h, w = f.shape[:2]
    f = F.colour_split(f); f = F.filmic(f, contrast=contrast)
    f = F.halation(f, amount=halo); f = F.bloom(f, amount=blm)
    f = F.chroma_ab(f, ca)
    return np.clip(f * F.vignette_mask(w, h, vig), 0, 1)


def lab_of(bgr, ys, xs):
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)[ys, xs]
    return (lab[:, 0].mean()*100/255, lab[:, 1].mean()-128.0, lab[:, 2].mean()-128.0)


def hab(a, b):
    return float(np.degrees(np.arctan2(b, a)) % 360.0)


def spread(hs):
    return max(dhue(x, y) for x, y in itertools.combinations(hs, 2))


if __name__ == "__main__":
    S = load(); B = beats()
    src, guarded = {}, {}
    for ft, (sid, lt, why) in B.items():
        raw = frame(f"out2/{sid}_raw.mp4", lt)
        hk = frame(f"out2/{sid}_hk.mp4", lt).astype(np.float32)/255.0
        fin = (finish_frame(hk, **FIN)*255).astype(np.uint8)
        g = GG.apply(fin, raw)
        ys = np.array(S[sid]["garment"]["ys"]); xs = np.array(S[sid]["garment"]["xs"])
        src[ft] = lab_of(raw, ys, xs); guarded[ft] = (g, raw, ys, xs, lab_of(g, ys, xs))

    med_a = float(np.median([v[1] for v in src.values()]))
    med_b = float(np.median([v[2] for v in src.values()]))
    print(f"film median garment chroma in the plate: a* {med_a:+.2f}  b* {med_b:+.2f}")
    print(f"continuity offsets capped at +-{CAP:.0f} Lab units\n")
    print("  beat        SOURCE Lab        GUARD (r52 ships)          CONTINUITY (not shipped)")
    hs_g, hs_c, viol = [], [], []
    for ft, (sid, lt, why) in B.items():
        L0, a0, b0 = src[ft]
        g, raw, ys, xs, (Lg, ag, bg) = guarded[ft]
        da = float(np.clip(med_a - a0, -CAP, CAP))
        db = float(np.clip(med_b - b0, -CAP, CAP))
        lab = cv2.cvtColor(g, cv2.COLOR_LAB2BGR) if False else None
        # apply the offset only inside the class, exactly as a real pass would
        m = GG.mask(raw)[..., None]
        lg = cv2.cvtColor(g, cv2.COLOR_BGR2LAB).astype(np.float32)
        lg[..., 1] += m[..., 0]*da; lg[..., 2] += m[..., 0]*db
        c = cv2.cvtColor(np.clip(lg, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)
        Lc, ac, bc = lab_of(c, ys, xs)
        h0, hg, hc = hab(a0, b0), hab(ag, bg), hab(ac, bc)
        hs_g.append(hg); hs_c.append(hc)
        # r51's numeric target is measured in HSV degrees, so report that too
        s0 = stats(raw, ys, xs); sg = stats(g, ys, xs); sc = stats(c, ys, xs)
        dg, dc = dhue(s0["hue"], sg["hue"]), dhue(s0["hue"], sc["hue"])
        if dc > 15.0: viol.append((ft, sid, dc))
        print(f"  {ft:5.1f}s {sid}  a*{a0:+6.2f} b*{b0:+6.2f} | a*{ag:+6.2f} b*{bg:+6.2f} "
              f"src->dlv {dg:5.1f}deg | a*{ac:+6.2f} b*{bc:+6.2f} src->dlv {dc:5.1f}deg")
    print(f"\n  Lab hue spread across the 8 beats:  source {spread([hab(v[1],v[2]) for v in src.values()]):.0f}deg"
          f"   guard {spread(hs_g):.0f}deg   continuity {spread(hs_c):.0f}deg")
    print(f"  beats that would BREACH r51's 15deg source-fidelity target under continuity: "
          f"{len(viol)} of 8" + ("" if not viol else "  -> " +
          ", ".join(f"{s} {d:.0f}deg" for _, s, d in viol)))
