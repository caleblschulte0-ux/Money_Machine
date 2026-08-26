#!/usr/bin/env python3
"""Mean luminance of a delivered master, sampled every 0.5s.

This is the number r51 pinned Film B's high-key identity to (0.534 +- 0.01),
so it needs to be computed the same way every time: BT.601 grey of the decoded
frame, unweighted mean over the whole frame, averaged across samples.
"""
import subprocess, sys
import numpy as np, cv2

def mean_luminance(path, fps=2.0):
    """One sequential decode at `fps`, not one seek per sample. The seek-per-
    sample version took longer than the render it was measuring."""
    dec = subprocess.Popen(["ffmpeg","-v","error","-i",path,"-vf",f"fps={fps}",
        "-f","rawvideo","-pix_fmt","gray","-"], stdout=subprocess.PIPE)
    n = 1920*1080
    vals = []
    while True:
        b = dec.stdout.read(n)
        if len(b) < n: break
        vals.append(np.frombuffer(b, np.uint8).mean()/255.0)
    dec.stdout.close(); dec.wait()
    return float(np.mean(vals)), len(vals)


if __name__ == "__main__":
    m, n = mean_luminance(sys.argv[1])
    print(f"mean luminance {m:.4f} over {n} samples")
