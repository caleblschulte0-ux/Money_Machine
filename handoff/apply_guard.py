#!/usr/bin/env python3
"""r52: run the garment chroma guard over every Film B shot.

ORDER: high-key -> FINISH -> guard. The guard runs LAST in the picture chain.

It was first built to run before the finish, which is the intuitive place for
it -- correct the chroma, then apply the look. That does not hold, and the
measurement says why: at b11 the garment left the guard 8deg from source and
arrived at the master 43deg from it. The finish is what moves it. Halation
(halo) and lateral chromatic aberration (ca) both bleed bright surroundings
into dark neighbours, and b11's garment is a dark mass against blown falls
water. A correction applied upstream of that is simply overwritten.

Running the guard after the finish keeps every look decision intact -- the
guard never touches L*, so contrast, bloom density and vignette are exactly
what the finish produced -- and restores plate chroma inside the garment
class only, which is the one thing the finish had no business changing.

Film B's AR reconstructions are composited AFTER this pass, so the bronze
material is outside it by construction; r51 required that it not be touched.
"""
import os, sys, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.abspath("../finish"))
import numpy as np, cv2
from gradeB import W, H, FPS
from shotsB import SHOTS
from filmfinish import finish
import garmentguard as GG

OUT = os.environ.get("FILMB_OUT", "out2")
FINISH = dict(grain_amt=0.0, halo=0.11, blm=0.07, ca=0.35,
              vig=0.10, contrast=1.02, weave=0.0, crf=15)

def guard_video(proc, plate, dst):
    n = W*H*3
    dp = subprocess.Popen(["ffmpeg","-v","error","-i",proc,"-f","rawvideo",
        "-pix_fmt","bgr24","-"], stdout=subprocess.PIPE)
    dl = subprocess.Popen(["ffmpeg","-v","error","-i",plate,"-f","rawvideo",
        "-pix_fmt","bgr24","-"], stdout=subprocess.PIPE)
    enc = subprocess.Popen(["ffmpeg","-y","-loglevel","error","-f","rawvideo",
        "-pix_fmt","bgr24","-s",f"{W}x{H}","-r",str(FPS),"-i","-","-an",
        "-c:v","libx264","-preset","slow","-crf","13","-pix_fmt","yuv420p",dst],
        stdin=subprocess.PIPE)
    try:
        while True:
            a = dp.stdout.read(n); b = dl.stdout.read(n)
            if len(a) < n or len(b) < n: break
            pa = np.frombuffer(a, np.uint8).reshape(H,W,3)
            pb = np.frombuffer(b, np.uint8).reshape(H,W,3)
            enc.stdin.write(GG.apply(pa, pb).tobytes())
    finally:
        enc.stdin.close(); enc.wait()
        dp.stdout.close(); dp.wait(); dl.stdout.close(); dl.wait()

if __name__ == "__main__":
    only = sys.argv[1:] or None
    for sid, clip, tin, d, kind, clock in SHOTS:
        if clip is None: continue
        if only and sid not in only: continue
        f = f"{OUT}/{sid}_f.mp4"
        finish(f"{OUT}/{sid}_hk.mp4", f, **FINISH)
        guard_video(f, f"{OUT}/{sid}_raw.mp4", f"{OUT}/{sid}.mp4")
        print(f"  {sid} finish + guard", flush=True)
