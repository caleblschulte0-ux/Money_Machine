#!/usr/bin/env python3
"""Drifting glacier fog overlay (5s, 1920x1080, gray on black, screen-
blended). Heavy at the top of frame — it buries the modern skyline."""
import numpy as np
import subprocess
from PIL import Image, ImageFilter

W, H, FPS, DUR = 1920, 1080, 30, 5.0
rng = np.random.default_rng(11)

# Big smooth noise field, twice frame width, scrolled over time.
FW = W * 2
base = rng.random((H // 8, FW // 8)).astype(np.float32)
field = np.asarray(
    Image.fromarray((base * 255).astype(np.uint8))
    .resize((FW, H), Image.BILINEAR)
    .filter(ImageFilter.GaussianBlur(60))).astype(np.float32) / 255.0
field2 = np.asarray(
    Image.fromarray((rng.random((H // 16, FW // 16)) * 255).astype(np.uint8))
    .resize((FW, H), Image.BILINEAR)
    .filter(ImageFilter.GaussianBlur(90))).astype(np.float32) / 255.0

# vertical weight: dense fog band at top (hides buildings), wisps below
yy = np.linspace(0, 1, H)[:, None].astype(np.float32)
vweight = np.clip(1.85 - 3.4 * yy, 0, 1) ** 0.6 * 1.0 + 0.18 * np.exp(-((yy - 0.62) / 0.16) ** 2)

p = subprocess.Popen(
    ["ffmpeg", "-v", "error", "-f", "rawvideo", "-pix_fmt", "gray",
     "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
     "-c:v", "libx264", "-preset", "fast", "-crf", "18",
     "-pix_fmt", "yuv420p", "work/fog.mp4", "-y"],
    stdin=subprocess.PIPE)

for f in range(int(DUR * FPS)):
    t = f / FPS
    o1 = int(28 * t) % W
    o2 = int(-18 * t) % W
    lay = 0.62 * field[:, o1:o1 + W] + 0.5 * field2[:, o2:o2 + W]
    frame = np.clip((lay * 0.55 + 0.45) * vweight * 255 * 1.25, 0, 250).astype(np.uint8)
    p.stdin.write(frame.tobytes())
p.stdin.close()
p.wait()
print("fog.mp4 done")
