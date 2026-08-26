#!/usr/bin/env python3
"""Find every clean 4s window in every MOV, using the shotqc gate.

A window is CLEAN when shotqc.flags() is empty: no TAIL (accelerating away at
the cut), no DRIFT (composition wandered >18% of frame width), no JOLT.

This is the tool that decides which footage a demo is allowed to use. Written
after the operator's note that shots "start out good, but then the end of it
... doesn't cut off in time" -- and after shotqc proved him right on two
already-locked films (Film C: 6 of 9 plates flagged, one at 76.4% drift).
"""
import json, subprocess, sys
import numpy as np
from shotqc import motion, flags

STEP = 1.0
DUR  = 4.0

def dur_of(clip):
    r = subprocess.run(["ffprobe","-v","error","-show_entries","format=duration",
        "-of","csv=p=0",f"raw/IMG_{clip}.MOV"], capture_output=True, text=True)
    try: return float(r.stdout.strip())
    except Exception: return 0.0

def rotation(clip):
    r = subprocess.run(["ffprobe","-v","error","-select_streams","v:0",
        "-show_entries","stream_side_data=rotation","-of","csv=p=0",
        f"raw/IMG_{clip}.MOV"], capture_output=True, text=True)
    for tok in r.stdout.replace("\n",",").split(","):
        try: return int(float(tok))
        except Exception: pass
    return 0

def main(clips):
    out = {}
    for c in clips:
        d = dur_of(c)
        rot = rotation(c)
        if d < DUR + 1.0:
            out[c] = dict(dur=d, rot=rot, windows=[]); print(f"{c}  {d:5.1f}s rot={rot:4d}  too short"); continue
        wins = []
        t = 0.5
        while t + DUR <= d - 0.3:
            m = motion(c, t, DUR)
            if m is not None and not flags(m):
                wins.append([round(t,1), round(m["mid"],2), round(m["drift"]*100,1)])
            t += STEP
        out[c] = dict(dur=d, rot=rot, windows=wins)
        print(f"{c}  {d:5.1f}s rot={rot:4d}  clean={len(wins):3d}", flush=True)
    json.dump(out, open("winscan.json","w"), indent=1)
    print("WROTE winscan.json")

if __name__ == "__main__":
    clips = sys.argv[1:] or [l.strip() for l in subprocess.run(
        ["bash","-c","ls raw/*.MOV | sed 's/.*IMG_//;s/\\.MOV//'"],
        capture_output=True, text=True).stdout.split()]
    main(clips)
