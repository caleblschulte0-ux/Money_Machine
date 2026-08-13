#!/usr/bin/env python3
"""Procedural snowfall overlay (5s, 1920x1080, white on black) for the
glacial-era beat — screen-blended over the graded footage."""
import numpy as np
import subprocess

W, H, FPS, DUR = 1920, 1080, 30, 5.0
N = 420
rng = np.random.default_rng(7)

x = rng.uniform(0, W, N)
y = rng.uniform(0, H, N)
depth = rng.uniform(0.35, 1.0, N)          # far flakes: small, slow, dim
vy = 90 + 240 * depth
vx = rng.uniform(-28, 28, N)
size = (1.0 + 2.6 * depth).astype(int)
bright = (120 + 130 * depth).astype(np.uint8)
phase = rng.uniform(0, 6.28, N)

p = subprocess.Popen(
    ["ffmpeg", "-v", "error", "-f", "rawvideo", "-pix_fmt", "gray",
     "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
     "-c:v", "libx264", "-preset", "fast", "-crf", "18",
     "-pix_fmt", "yuv420p", "work/snow.mp4", "-y"],
    stdin=subprocess.PIPE)

dt = 1.0 / FPS
for f in range(int(DUR * FPS)):
    t = f * dt
    frame = np.zeros((H, W), np.uint8)
    fx = (x + vx * t + 18 * depth * np.sin(1.7 * t + phase)) % W
    fy = (y + vy * t) % H
    for i in range(N):
        xi, yi, s = int(fx[i]), int(fy[i]), size[i]
        frame[max(yi - s, 0):yi + s, max(xi - s, 0):xi + s] = bright[i]
    p.stdin.write(frame.tobytes())
p.stdin.close()
p.wait()
print("snow.mp4 done")
