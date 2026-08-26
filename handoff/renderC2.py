#!/usr/bin/env python3
"""FILM C r56: plates -> shot normalization -> the approved global finish.

r55 required the picture rebuilt to the r37/r39 commercial standard: native
1920x1080, real footage carrying the film, restrained shot-level technical
normalization before the global finish, and every adjustment listed per source.

NO PARALLAX ANYWHERE, AND THAT IS A DECISION, NOT AN OMISSION. r55 allows
conservative depth only on plates that support it and prefers a simple optical
hold where the depth evidence is weak. Every plate here is LIVE MOTION footage
with its own camera movement -- the parallax engine synthesises motion from a
STILL, so applying it would mean freezing a moving plate and re-animating it,
which is both a downgrade and exactly the rubber-sheeting r55 warns about on
architecture, fences and text. The plates move because the camera moved.
"""
import os, sys, subprocess, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.abspath("../finish"))
import numpy as np, cv2
from sourcesC import BEATS, W, H, FPS
import shotnorm as SN
from native_check import check as native_check
from filmfinish import finish

RAWD = "../raw"
OUT = "outC"

# Restrained. This is a commercial about an engineering standard, not a
# landscape trailer: less halation and less lateral aberration than Film D,
# no grain and no gate weave at all (same reasoning as Film B -- live footage).
FINISH = dict(grain_amt=0.0, halo=0.09, blm=0.06, ca=0.25,
              vig=0.14, contrast=1.03, weave=0.0, crf=14)


def sh(c):
    r = subprocess.run(c, capture_output=True, text=True)
    if r.returncode:
        print(" ".join(c)[:400]); sys.exit(r.stderr[-2500:])


def require_native():
    bad = []
    for beat, clip, tin, st, d, why in BEATS:
        r = native_check(f"{RAWD}/IMG_{clip}.MOV")
        if not r["ok"]:
            bad.append(f"{beat} IMG_{clip} ({r['upscale']}x)")
        dur = float(subprocess.run(["ffprobe","-v","error","-show_entries","format=duration",
            "-of","default=nw=1:nk=1",f"{RAWD}/IMG_{clip}.MOV"],
            capture_output=True,text=True).stdout.strip())
        if tin + d > dur + 0.05:
            bad.append(f"{beat} IMG_{clip} wants {tin}+{d}s of a {dur:.1f}s clip")
    if bad:
        raise SystemExit("REFUSED:\n  " + "\n  ".join(bad))
    print(f"  native + length: all {len(BEATS)} plates pass", flush=True)


def plate(beat, clip, tin, d):
    """The shot at native size. No stabilisation, no push, no crop."""
    dst = f"{OUT}/{beat}_raw.mp4"
    sh(["ffmpeg","-v","error","-y","-ss",str(tin),"-t",f"{d+0.4:.2f}",
        "-i",f"{RAWD}/IMG_{clip}.MOV","-an","-vf",f"scale={W}:{H}",
        "-t",f"{d:.2f}","-r",str(FPS),"-fps_mode","cfr",
        "-c:v","libx264","-crf","12","-pix_fmt","yuv420p",dst])
    return dst


def grab(path, t):
    p = subprocess.run(["ffmpeg","-v","error","-ss",str(t),"-i",path,"-frames:v","1",
                        "-f","rawvideo","-pix_fmt","bgr24","-"], capture_output=True)
    return np.frombuffer(p.stdout[:W*H*3], np.uint8).reshape(H, W, 3)


def sample(path, d, n=5):
    """Handheld swings through its own exposure; measure across the shot."""
    return [grab(path, d*(i+0.5)/n).astype(np.float32)/255.0 for i in range(n)]


def plan_all():
    """Two passes: measure every plate, agree one common black/white, move each
    plate onto it. The median is deliberately NOT matched -- see shotnorm.py."""
    stats, per = [], {}
    for beat, clip, tin, st, d, why in BEATS:
        ims = sample(f"{OUT}/{beat}_raw.mp4", d)
        s = [SN.measure(SN.deliver_region(im, aspect=16/9)) for im in ims]
        # Average ACROSS the samples per key, preserving shape. A plain
        # float(np.mean(...)) collapses shotnorm's per-CHANNEL black/white
        # arrays to a scalar, and _params then indexes a float.
        m = {}
        for k in s[0]:
            v = np.mean([np.asarray(x[k], dtype=np.float64) for x in s], axis=0)
            m[k] = v if getattr(v, "ndim", 0) else float(v)
        stats.append(m); per[beat] = m
    tgt, plans = SN.plan(stats)
    return tgt, {b[0]: p for b, p in zip(BEATS, plans)}, per


def apply_norm(src, dst, p):
    n = W*H*3
    dec = subprocess.Popen(["ffmpeg","-v","error","-i",src,"-f","rawvideo",
        "-pix_fmt","bgr24","-"], stdout=subprocess.PIPE)
    enc = subprocess.Popen(["ffmpeg","-y","-loglevel","error","-f","rawvideo",
        "-pix_fmt","bgr24","-s",f"{W}x{H}","-r",str(FPS),"-i","-","-an",
        "-c:v","libx264","-preset","slow","-crf","13","-pix_fmt","yuv420p",dst],
        stdin=subprocess.PIPE)
    try:
        while True:
            b = dec.stdout.read(n)
            if len(b) < n: break
            im = np.frombuffer(b, np.uint8).reshape(H, W, 3).astype(np.float32)/255.0
            enc.stdin.write((np.clip(SN.apply(im, p), 0, 1)*255).astype(np.uint8).tobytes())
    finally:
        enc.stdin.close(); enc.wait(); dec.stdout.close(); dec.wait()


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    require_native()
    for beat, clip, tin, st, d, why in BEATS:
        if os.path.exists(f"{OUT}/{beat}_raw.mp4") and "--replate" not in sys.argv:
            print(f"  {beat} plate present", flush=True); continue
        plate(beat, clip, tin, d)
        print(f"  {beat} plate IMG_{clip} @{tin}s {d}s", flush=True)
    tgt, plans, per = plan_all()
    lines = ["FILM C shot normalization -- technical only "
             "(veil/black, white balance, exposure, contrast). Median NOT matched.",
             f"  common target  black {tgt['black']:.4f}  white {tgt['white']:.4f}"]
    for beat, clip, tin, st, d, why in BEATS:
        p = plans[beat]
        apply_norm(f"{OUT}/{beat}_raw.mp4", f"{OUT}/{beat}_n.mp4", p)
        a = SN.measure(SN.deliver_region(grab(f"{OUT}/{beat}_n.mp4", d/2).astype(np.float32)/255.0))
        b4 = per[beat]
        lines.append(f"  {beat}  IMG_{clip} @{tin:.1f}s   {SN.describe(p)}")
        lines.append(f"        black {b4['lum_black']:.4f} -> {a['lum_black']:.4f}   "
                     f"white {b4['lum_white']:.4f} -> {a['lum_white']:.4f}   "
                     f"std {b4['lum_std']:.4f} -> {a['lum_std']:.4f}")
        print(f"  {beat} normalized", flush=True)
    sp = max(s['lum_black'] for s in per.values()) - min(s['lum_black'] for s in per.values())
    lines.append(f"  black-point spread across the 9 plates, before: {sp:.4f}")
    open(f"{OUT}/norm.txt","w").write("\n".join(lines)+"\n")
    print("\n".join(lines), flush=True)
    for beat, clip, tin, st, d, why in BEATS:
        finish(f"{OUT}/{beat}_n.mp4", f"{OUT}/{beat}_f.mp4", **FINISH)
        print(f"  {beat} finished", flush=True)
