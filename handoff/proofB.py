#!/usr/bin/env python3
"""r52: the same-pixel source / normalized / delivered proof for Film B.

Film B's plate stage does no stabilisation, no push and no crop, so a fixed
set of pixel coordinates addresses the same content at every stage of the
chain -- that is what makes a "same-pixel" comparison honest here.

THE SAMPLE IS A FROZEN PIXEL SET, NOT A RECTANGLE. In b02 the visitor is
about 80px wide in a 1920px frame and the shirt carries a large white print;
any rectangle big enough to measure catches print and skin, which is exactly
how a garment reading drifts for reasons that have nothing to do with the
grade. So each sample is an ROI intersected with its material class as
measured ON THE UNTOUCHED PLATE, frozen to `sampleB.json`, and then applied
identically to source, normalized and delivered. The plate defines the set
once; no stage gets to re-choose its own pixels.

  b02  film 14.5s  (shot 11.5-17.5, 3.0s in)
  b06  film 38.0s  (shot 34.0-40.0, 4.0s in)
  b11  film 69.0s  (shot 66.0-71.5, 3.0s in)

CORRECTION TO THE r50 PACK: those three samples were published there as
30.0s / 40.0s / 63.0s. The measurements were taken at the correct frames;
the film times printed beside them were wrong. The correct times are above.
"""
import os, sys, subprocess, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, cv2
import garmentguard as GG

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 1920, 1080

# The film times this pack proves at, and why each one is here.
#
# r51 asked for proof at 0:30.0, 0:40.0, 0:46.5-0:51.5 and 1:03.0-1:15.0. Those
# times came from the r50 pack, where I labelled the b02/b06/b11 samples
# 30.0 / 40.0 / 63.0s. THOSE LABELS WERE WRONG. The measurements were taken at
# the right frames; the film times printed beside them were not. 0:30.0 is b05,
# the overlook plaza; 0:40.0 is the first frame of b07. So this proves at BOTH
# sets: the three beats r51 meant, and the four it literally asked for, each
# resolved to the shot it actually falls in.
BEAT_TIMES = [
    (14.5, "b02 -- the beat published in r50 as 30.0s. CORRECTED."),
    (30.0, "b05 -- r51's literal 0:30.0."),
    (38.0, "b06 -- the beat published in r50 as 40.0s. CORRECTED."),
    (40.0, "b07 -- r51's literal 0:40.0, which is b07's first frame."),
    (49.0, "b08 -- centre of r51's 0:46.5-0:51.5."),
    (63.0, "b10 -- start of r51's 1:03.0-1:15.0."),
    (69.0, "b11 -- the beat published in r50 as 63.0s. CORRECTED."),
    (75.0, "b12 -- end of r51's 1:03.0-1:15.0."),
]


def _timeline():
    """film time -> (shot id, seconds into that shot), from the edit itself."""
    from shotsB import SHOTS
    t, out = 0.0, []
    for sid, clip, tin, d, kind, clock in SHOTS:
        out.append((sid, t, t + d)); t += d
    return out


def beats():
    tl = _timeline()
    r = {}
    for ft, why in BEAT_TIMES:
        for sid, a, b in tl:
            if a <= ft < b:
                r[ft] = (sid, round(ft - a, 3), why); break
    return r


# ROIs, one per shot, placed by eye against a coordinate-gridded zoom of that
# shot's plate and checked by crop before use. The garment ROI brackets the
# visitor; the foliage ROI brackets greenery well inside the frame.
ROI = {
    "b02": {"garment": (830, 455,  80,  90),  "foliage": (1450, 740, 160, 140)},
    "b05": {"garment": (1378, 325, 78, 145),  "foliage": (10, 546, 100, 100)},
    "b06": {"garment": (1400, 750, 110, 100), "foliage": (150, 390, 160, 110)},
    "b07": {"garment": (775, 385, 95, 120),   "foliage": (1508, 999, 70, 70)},
    "b08": {"garment": (30, 870, 340, 200),   "foliage": (420, 640, 280, 180)},
    "b10": {"garment": (1150, 530, 200, 190), "foliage": (1550, 845, 70, 70)},
    "b11": {"garment": (1360, 600, 120, 130), "foliage": (930, 360, 160, 120)},
    "b12": {"garment": (1670, 245, 200, 155), "foliage": (300, 940, 300, 130)},
}
GARMENT_T = 0.60      # GG.mask() on the plate


def frame(src, t):
    p = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(t), "-i", src,
                        "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"],
                       capture_output=True)
    return np.frombuffer(p.stdout[:W*H*3], np.uint8).reshape(H, W, 3)


def _class(plate, kind, roi):
    x, y, w, h = roi
    sub = plate[y:y+h, x:x+w]
    if kind == "garment":
        m = GG.mask(sub) >= GARMENT_T
    else:
        hsv = cv2.cvtColor(sub, cv2.COLOR_BGR2HSV).astype(np.float32)
        hue, sat, val = hsv[..., 0]*2.0, hsv[..., 1]/255.0, hsv[..., 2]/255.0
        m = (hue > 60) & (hue < 160) & (sat > 0.28) & (val > 0.20)
    ys, xs = np.nonzero(m)
    return (ys + y).tolist(), (xs + x).tolist()


def freeze(out_dir):
    """Measure every sample's pixel set on the plate, once, and store it."""
    s = {}
    for ft, (sid, lt, why) in beats().items():
        plate = frame(f"{out_dir}/{sid}_raw.mp4", lt)
        s[sid] = {}
        for kind, roi in ROI[sid].items():
            ys, xs = _class(plate, kind, roi)
            s[sid][kind] = {"roi": list(roi), "ys": ys, "xs": xs}
            print(f"  {sid} {kind:8s} roi={roi}  {len(ys)} px "
                  f"({100.0*len(ys)/(roi[2]*roi[3]):.0f}% of roi)", flush=True)
    json.dump(s, open(os.path.join(HERE, "sampleB.json"), "w"))
    return s


def load():
    return json.load(open(os.path.join(HERE, "sampleB.json")))


def stats(bgr, ys, xs):
    p = bgr[np.array(ys), np.array(xs)].reshape(-1, 1, 3)
    hsv = cv2.cvtColor(p, cv2.COLOR_BGR2HSV).astype(np.float32).reshape(-1, 3)
    hue, sat = hsv[:, 0]*2.0, hsv[:, 1]/255.0
    lum = cv2.cvtColor(p, cv2.COLOR_BGR2GRAY).astype(np.float32).ravel()/255.0
    wgt = np.maximum(sat, 1e-3)               # an unsaturated pixel has no hue
    a = np.deg2rad(hue)
    hm = np.rad2deg(np.arctan2(float((np.sin(a)*wgt).sum()),
                               float((np.cos(a)*wgt).sum()))) % 360.0
    return dict(hue=float(hm), sat=float(sat.mean()), lum=float(lum.mean()),
                n=int(len(ys)))


def dhue(a, b):
    d = abs(a - b) % 360.0
    return d if d <= 180.0 else 360.0 - d


def table(master, out_dir="out2", norm_suffix="_hk"):
    s = load()
    rows = []
    for ft, (sid, lt, why) in beats().items():
        src = frame(f"{out_dir}/{sid}_raw.mp4", lt)
        nrm = frame(f"{out_dir}/{sid}{norm_suffix}.mp4", lt)
        dlv = frame(master, ft)
        r = {"shot": sid, "film_s": ft, "why": why, "samples": {}}
        for kind, d in s[sid].items():
            ys, xs = d["ys"], d["xs"]
            a, b, c = stats(src, ys, xs), stats(nrm, ys, xs), stats(dlv, ys, xs)
            r["samples"][kind] = dict(px=a["n"], roi=d["roi"],
                                      source=a, normalized=b, delivered=c,
                                      dhue=round(dhue(a["hue"], c["hue"]), 1),
                                      dsat=round(c["sat"] - a["sat"], 3))
        rows.append(r)
        g, f = r["samples"]["garment"], r["samples"]["foliage"]
        print(f"  {ft:5.1f}s {sid} | garment {g['px']:6d}px hue {g['source']['hue']:5.0f}"
              f"->{g['delivered']['hue']:5.0f} d{g['dhue']:5.1f}deg sat {g['dsat']:+.3f}"
              f" | foliage {f['px']:6d}px hue {f['source']['hue']:5.0f}"
              f"->{f['delivered']['hue']:5.0f} d{f['dhue']:5.1f}deg sat {f['dsat']:+.3f}",
              flush=True)
    return rows


if __name__ == "__main__":
    OUT = os.environ.get("FILMB_OUT", "out2")
    if sys.argv[1] == "freeze":
        freeze(OUT)
    else:
        rows = table(sys.argv[1], OUT, os.environ.get("FILMB_NORM", "_hk"))
        json.dump(rows, open(sys.argv[2] if len(sys.argv) > 2 else "proofB.json", "w"), indent=1)
