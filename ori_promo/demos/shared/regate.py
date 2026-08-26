#!/usr/bin/env python3
"""Re-measure every plate we have already gated, with the phaseCorrelate
in-place-window bug fixed. Prints OLD (buggy) beside NEW so the size of the
error is on the record instead of being quietly replaced."""
import sys
import numpy as np, cv2
import shotqc

def buggy_motion(clip, tin, dur, raw="raw"):
    """The exact code as it stood before the fix, kept as an oracle."""
    import subprocess
    SC = shotqc.SC
    w, h = 1920//SC, 1080//SC
    p = subprocess.Popen(["ffmpeg","-v","error","-ss",str(tin),"-t",f"{dur:.2f}",
        "-i",f"{raw}/IMG_{clip}.MOV","-vf",f"scale={w}:{h}","-f","rawvideo",
        "-pix_fmt","gray","-"], stdout=subprocess.PIPE)
    n = w*h; frames = []
    while True:
        b = p.stdout.read(n)
        if len(b) < n: break
        frames.append(np.frombuffer(b, np.uint8).reshape(h, w).astype(np.float32))
    p.stdout.close(); p.wait()
    if len(frames) < 8: return None
    win = cv2.createHanningWindow((w, h), cv2.CV_32F)
    d = []; cum = np.zeros(2)
    for a, b in zip(frames[:-1], frames[1:]):
        (dx, dy), _ = cv2.phaseCorrelate(a, b, win)     # the bug, on purpose
        d.append(np.hypot(dx, dy)*SC); cum += (dx*SC, dy*SC)
    d = np.array(d); k = len(d)
    mid = float(np.median(d[k//4: 3*k//4]))
    tail = float(np.median(d[int(k*0.75):]))
    return dict(mid=mid, tail=tail, ratio=tail/max(mid,0.15),
                drift=float(np.hypot(*cum))/1920.0, peak=float(d.max()))

DEMO1 = [("open","6805",4.5,3.5),("b1","6796",8.5,7.0),("b2","6798",6.5,7.0),
         ("b3","6794",10.5,7.0),("b4","6791",4.5,5.0)]

if __name__ == "__main__":
    print(f"{'shot':10s} {'clip':6s} {'in':>5s} {'dur':>4s} | "
          f"{'OLD mid':>7s} {'OLD drift':>9s} {'OLD peak':>8s} {'OLD flags':>12s} | "
          f"{'NEW mid':>7s} {'NEW drift':>9s} {'NEW peak':>8s} {'NEW flags':>12s}")
    for name, clip, tin, dur in DEMO1:
        o = buggy_motion(clip, tin, dur)
        n = shotqc.motion(clip, tin, dur)
        of = ",".join(shotqc.flags(o)) or "-"
        nf = ",".join(shotqc.flags(n)) or "-"
        print(f"{name:10s} {clip:6s} {tin:5.1f} {dur:4.1f} | "
              f"{o['mid']:7.2f} {o['drift']*100:8.1f}% {o['peak']:8.1f} {of:>12s} | "
              f"{n['mid']:7.2f} {n['drift']*100:8.1f}% {n['peak']:8.1f} {nf:>12s}", flush=True)
