#!/usr/bin/env python3
"""Footage QC: catch the shot that starts well and falls apart at the end.

The operator's note, and it is a real defect we shipped:

  "Some of that footage starts out good, but then the end of it, like, it
   doesn't cut off in time, and then you just need panning away weirdly, and
   it doesn't look professional."

Choosing an in-point by eye and a duration by the edit's needs means nobody
ever looks at the LAST second. This measures it.

For each candidate segment it estimates global frame-to-frame camera motion by
phase correlation on a downscaled grey copy, then reports:

  mid      median motion px/frame over the middle 50% of the segment
  tail     median motion px/frame over the last 25%
  ratio    tail / mid -- how much faster the camera is moving as we leave
  drift    total displacement from first frame to last, in px, as a fraction
           of frame width -- how far the composition has wandered
  peak     worst single-frame motion anywhere in the segment

FLAGS
  TAIL     tail motion is >=1.8x the middle AND above 2.0 px/frame -- the shot
           is accelerating away exactly where the cut lands
  DRIFT    the frame has travelled more than 18% of its width -- the shot you
           chose is not the shot you end on
  JOLT     a single-frame motion above 14 px -- a bump or a whip

A flag is not automatically fatal; a deliberate move can be all three. It means
LOOK AT THE LAST SECOND before shipping it.
"""
import subprocess, sys
import numpy as np, cv2

SC = 6                      # analyse at 320x180; camera motion is global


def motion(clip, tin, dur, raw="raw"):
    w, h = 1920//SC, 1080//SC
    p = subprocess.Popen(["ffmpeg","-v","error","-ss",str(tin),"-t",f"{dur:.2f}",
        "-i",f"{raw}/IMG_{clip}.MOV","-vf",f"scale={w}:{h}","-f","rawvideo",
        "-pix_fmt","gray","-"], stdout=subprocess.PIPE)
    n = w*h
    frames = []
    while True:
        b = p.stdout.read(n)
        if len(b) < n: break
        frames.append(np.frombuffer(b, np.uint8).reshape(h, w).astype(np.float32))
    p.stdout.close(); p.wait()
    if len(frames) < 8:
        return None
    win = cv2.createHanningWindow((w, h), cv2.CV_32F)
    d = []
    cum = np.zeros(2)
    for a, b in zip(frames[:-1], frames[1:]):
        (dx, dy), _ = cv2.phaseCorrelate(a, b, win)
        d.append(np.hypot(dx, dy)*SC)
        cum += (dx*SC, dy*SC)
    d = np.array(d)
    k = len(d)
    mid = float(np.median(d[k//4: 3*k//4]))
    tail = float(np.median(d[int(k*0.75):]))
    return dict(mid=mid, tail=tail, ratio=tail/max(mid, 0.15),
                drift=float(np.hypot(*cum))/1920.0, peak=float(d.max()))


def flags(m):
    f = []
    if m["ratio"] >= 1.8 and m["tail"] >= 2.0: f.append("TAIL")
    if m["drift"] >= 0.18: f.append("DRIFT")
    if m["peak"] >= 14.0:  f.append("JOLT")
    return f


def report(rows, raw="raw"):
    print(f"{'shot':22s} {'clip':6s} {'in':>6s} {'dur':>5s} "
          f"{'mid':>5s} {'tail':>5s} {'ratio':>6s} {'drift':>6s} {'peak':>5s}  flags")
    bad = []
    for name, clip, tin, dur in rows:
        m = motion(clip, tin, dur, raw)
        if m is None:
            print(f"{name:22s} {clip:6s} -- too short to measure"); continue
        fl = flags(m)
        if fl: bad.append((name, clip, tin, dur, fl))
        print(f"{name:22s} {clip:6s} {tin:6.1f} {dur:5.1f} "
              f"{m['mid']:5.2f} {m['tail']:5.2f} {m['ratio']:6.2f} "
              f"{m['drift']*100:5.1f}% {m['peak']:5.1f}  {','.join(fl)}")
    return bad
