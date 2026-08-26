#!/usr/bin/env python3
"""FILM C r56: composite the type over the finished plates and concat."""
import os, sys, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, cv2
import typeC
from sourcesC import BEATS, W, H, FPS, TOTAL

OUT = "outC"


def compose_beat(beat, d):
    src = f"{OUT}/{beat}_f.mp4"
    dst = f"{OUT}/{beat}_t.mp4"
    n = W*H*3
    dec = subprocess.Popen(["ffmpeg","-v","error","-i",src,"-f","rawvideo",
        "-pix_fmt","bgr24","-"], stdout=subprocess.PIPE)
    enc = subprocess.Popen(["ffmpeg","-y","-loglevel","error","-f","rawvideo",
        "-pix_fmt","bgr24","-s",f"{W}x{H}","-r",str(FPS),"-i","-","-an",
        "-c:v","libx264","-preset","slow","-crf","14","-pix_fmt","yuv420p",dst],
        stdin=subprocess.PIPE)
    i = 0
    try:
        while True:
            b = dec.stdout.read(n)
            if len(b) < n: break
            f = np.frombuffer(b, np.uint8).reshape(H, W, 3).astype(np.float32)
            ov, dark = typeC.compose(beat, i/FPS, d)
            a = dark[..., 3:4]/255.0
            f = f*(1 - a*0.85)
            a = ov[..., 3:4]/255.0
            f = f*(1 - a) + ov[..., :3][..., ::-1]*a
            enc.stdin.write(np.clip(f, 0, 255).astype(np.uint8).tobytes())
            i += 1
    finally:
        enc.stdin.close(); enc.wait(); dec.stdout.close(); dec.wait()
    return i


def dur(p):
    return float(subprocess.run(["ffprobe","-v","error","-show_entries","format=duration",
        "-of","default=nw=1:nk=1",p],capture_output=True,text=True).stdout.strip())


if __name__ == "__main__":
    for beat, clip, tin, st, d, why in BEATS:
        t = f"{OUT}/{beat}_t.mp4"
        if os.path.exists(t) and abs(dur(t) - d) < 0.05 and "--recomp" not in sys.argv:
            print(f"  {beat} type already composited", flush=True); continue
        n = compose_beat(beat, d)
        print(f"  {beat} type composited, {n} frames", flush=True)
    with open("concatC.txt","w") as fh:
        for beat, clip, tin, st, d, why in BEATS:
            fh.write(f"file '{os.path.abspath(OUT)}/{beat}_t.mp4'\n")
    subprocess.run(["ffmpeg","-v","error","-y","-f","concat","-safe","0","-i","concatC.txt",
        "-r",str(FPS),"-fps_mode","cfr","-c:v","libx264","-crf","14",
        "-pix_fmt","yuv420p",f"{OUT}/_pictureC.mp4"], check=True)
    got = dur(f"{OUT}/_pictureC.mp4")
    if abs(got - TOTAL) > 0.05:
        sys.exit(f"picture is {got:.3f}s, expected {TOTAL:.3f}s")
    print(f"  picture {got:.3f}s", flush=True)
