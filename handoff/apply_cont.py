#!/usr/bin/env python3
"""r54: guard + bounded garment continuity offset, in ONE encode.

r53 ruled for option (b): for the garment class only, narrative continuity
supersedes r51's source-to-delivered hue target. This is a colour-timing pass
-- one constant Lab offset per shot, L* untouched, applied through a tracked
garment mask.

WHERE IT SITS. high-key -> finish -> (guard + offset) -> AR composite. It runs
off the r52 `_f` finish intermediates, so the v3 look is not re-derived and
cannot drift, and the guard and the offset share a single Lab round trip and a
single encode.

WHY NOT JUST POST-PROCESS THE v3 SHOTS. Because that costs an extra h.264
generation, and measured on b11 it moved the garment's L* by 0.70 -- not from
the Lab math, which preserves L* to 0.008, but purely from re-encoding a very
dark region. r53 requires L* untouched and pins mean luminance to within 0.01,
so a needless generation is not worth its convenience.

THE OFFSET IS CONSTANT WITHIN A SHOT. That is what colour timing means. The
garment's lighting changes within a shot as the subject turns, and that change
is real; only the shot-to-shot wardrobe identity is being corrected.

TRACKING. The gate box is carried through the shot by Lucas-Kanade optical
flow on features inside it, computed on a quarter-resolution grey copy of the
PLATE, outward in both directions from the verified seed frame.
"""
import os, sys, subprocess, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, cv2
from gradeB import W, H, FPS
from shotsB import SHOTS
from seedsB import SEEDS
import garmentguard as GG
import garmentmask as GM

OUT = os.environ.get("FILMB_OUT", "out2")
SC = 4


def _gray_stack(path):
    dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", path, "-vf",
        f"scale={W//SC}:{H//SC}", "-f", "rawvideo", "-pix_fmt", "gray", "-"],
        stdout=subprocess.PIPE)
    n = (W//SC)*(H//SC)
    out = []
    while True:
        b = dec.stdout.read(n)
        if len(b) < n:
            break
        out.append(np.frombuffer(b, np.uint8).reshape(H//SC, W//SC).copy())
    dec.stdout.close(); dec.wait()
    return out


def track_boxes(plate, seed_i, seed_box):
    g = _gray_stack(plate)
    n = len(g)
    seed_i = min(max(seed_i, 0), n-1)
    boxes = [None]*n
    boxes[seed_i] = tuple(int(round(v/SC)) for v in seed_box)
    for i in range(seed_i+1, n):
        boxes[i] = GM.track(g[i-1], g[i], boxes[i-1])
    for i in range(seed_i-1, -1, -1):
        boxes[i] = GM.track(g[i+1], g[i], boxes[i+1])
    return [tuple(int(v*SC) for v in b) for b in boxes]


def _grab(path, t):
    p = subprocess.run(["ffmpeg","-v","error","-ss",f"{t}","-i",path,
        "-frames:v","1","-f","rawvideo","-pix_fmt","bgr24","-"], capture_output=True)
    return np.frombuffer(p.stdout[:W*H*3], np.uint8).reshape(H, W, 3)


def run_shot(sid, da, db):
    """guard, then (if this shot has a garment) the continuity offset."""
    fin = f"{OUT}/{sid}_f.mp4"
    plate = f"{OUT}/{sid}_raw.mp4"
    dst = f"{OUT}/{sid}.mp4"
    s = SEEDS.get(sid)
    boxes, ref = None, None
    if s is not None and (da or db):
        boxes = track_boxes(plate, int(round(s["t"]*FPS)), s["gate"])
        ref = GM.patch_lab(_grab(plate, s["t"]), s["patch"])[:3]
    nb = W*H*3
    ds = subprocess.Popen(["ffmpeg","-v","error","-i",fin,"-f","rawvideo",
        "-pix_fmt","bgr24","-"], stdout=subprocess.PIPE)
    dp = subprocess.Popen(["ffmpeg","-v","error","-i",plate,"-f","rawvideo",
        "-pix_fmt","bgr24","-"], stdout=subprocess.PIPE)
    enc = subprocess.Popen(["ffmpeg","-y","-loglevel","error","-f","rawvideo",
        "-pix_fmt","bgr24","-s",f"{W}x{H}","-r",str(FPS),"-i","-","-an",
        "-c:v","libx264","-preset","slow","-crf","13","-pix_fmt","yuv420p",dst],
        stdin=subprocess.PIPE)
    i = 0
    try:
        while True:
            a = ds.stdout.read(nb); b = dp.stdout.read(nb)
            if len(a) < nb or len(b) < nb:
                break
            img = np.frombuffer(a, np.uint8).reshape(H, W, 3)
            pl = np.frombuffer(b, np.uint8).reshape(H, W, 3)
            out = GG.apply(img, pl)                       # r52 guard, unchanged
            if boxes is not None:
                m = GM.build(pl, boxes[min(i, len(boxes)-1)], ref)
                l = cv2.cvtColor(out, cv2.COLOR_BGR2LAB).astype(np.float32)
                l[..., 1] += m*da
                l[..., 2] += m*db
                adj = cv2.cvtColor(np.clip(l, 0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR)
                sel = m > 1e-3
                out = out.copy(); out[sel] = adj[sel]
            enc.stdin.write(out.tobytes())
            i += 1
    finally:
        enc.stdin.close(); enc.wait()
        ds.stdout.close(); ds.wait(); dp.stdout.close(); dp.wait()
    return i


if __name__ == "__main__":
    off = json.load(open("offsetsB.json"))
    only = sys.argv[1:] or None
    for sid, clip, tin, d, kind, clock in SHOTS:
        if clip is None or (only and sid not in only):
            continue
        da, db = off.get(sid, (0.0, 0.0))
        n = run_shot(sid, da, db)
        tag = (f"continuity da*{da:+6.2f} db*{db:+6.2f}" if (da or db)
               else "guard only -- no garment in frame")
        print(f"  {sid} {tag}  {n} frames", flush=True)
