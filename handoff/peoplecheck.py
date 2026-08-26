#!/usr/bin/env python3
"""Film D is 'empty landscape only: no people'. This finds the figures.

Clothing is the tell: at this distance a person is a few dozen pixels, but a
SATURATED patch -- red, orange, blue -- against pale quartzite and green grass
is visually louder than its size suggests. A 13x21px figure in a red top was
sitting in d04 and I only caught it by eye after rendering the whole film.
"""
import subprocess, sys
import numpy as np, cv2

def figures(bgr, min_area=10):
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    hue = hsv[..., 0].astype(np.float32) * 2
    sat = hsv[..., 1].astype(np.float32) / 255
    val = hsv[..., 2].astype(np.float32) / 255
    warm = ((hue < 30) | (hue > 330)) & (sat > 0.45) & (val > 0.25)
    vivid = (hue > 180) & (hue < 300) & (sat > 0.55) & (val > 0.30)
    m = (warm | vivid).astype(np.uint8)
    n, _, stats, cent = cv2.connectedComponentsWithStats(m, 8)
    out = []
    for i in range(1, n):
        a = stats[i, cv2.CC_STAT_AREA]
        w, h = stats[i, cv2.CC_STAT_WIDTH], stats[i, cv2.CC_STAT_HEIGHT]
        if a >= min_area and 0.25 <= w / max(h, 1) <= 3.0:
            out.append((int(a), int(cent[i][0]), int(cent[i][1])))
    out.sort(reverse=True)
    return out

def scan(clip, times, raw="../raw"):
    rows = []
    for t in times:
        subprocess.run(["ffmpeg","-v","error","-y","-ss",f"{t}","-i",f"{raw}/IMG_{clip}.MOV",
                        "-frames:v","1","/tmp/_pc.png"], check=True)
        f = figures(cv2.imread("/tmp/_pc.png"))
        rows.append((t, f))
    return rows

if __name__ == "__main__":
    clip = sys.argv[1]
    times = [float(x) for x in sys.argv[2:]]
    for t, f in scan(clip, times):
        tag = "CLEAN" if not f else f"{len(f)} figure(s), largest {f[0][0]}px at {f[0][1]},{f[0][2]}"
        print(f"  IMG_{clip} @{t:5.1f}s  {tag}")
