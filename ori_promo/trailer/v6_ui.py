#!/usr/bin/env python3
"""Demo v2 (v6) UI — adds a second, larger experience zone painted on the
real foreground grass (IMG_6807) and a two-wearer shared-view beat
(IMG_6806 @9s). Everything else is reused from trailer/ui5."""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, "trailer")
from ui_kit import W, H, SS, font, canvas, WHITE
from v5_ui import text, soft, _path_samples

OUT = "trailer/ui6"
os.makedirs(OUT, exist_ok=True)

# Perspective oval traced on the real grass in front of the walker.
WALK_PATH = [(520, 800), (780, 782), (1090, 780), (1330, 796), (1476, 832),
             (1560, 900), (1424, 986), (1080, 1026), (700, 1020),
             (360, 976), (232, 906), (330, 840)]


def trace(path, name, dash=8, dot=2.4, alpha=214):
    s = SS
    samples = _path_samples(path)
    img = Image.new("RGBA", (W * s, H * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for i, (x, y) in enumerate(samples):
        if (i // dash) % 2 == 0:
            d.ellipse((x * s - dot * s, y * s - dot * s,
                       x * s + dot * s, y * s + dot * s),
                      fill=(255, 252, 245, alpha))
    img = img.resize((W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.6))
    out = canvas()
    out.alpha_composite(soft(img, blur=5, alpha=90))
    out.save(f"{OUT}/{name}.png")
    return samples


def pulse(path, name, frames=30):
    samples = _path_samples(path)
    n = len(samples)
    os.makedirs(f"{OUT}/{name}", exist_ok=True)
    s = SS
    for f in range(frames):
        t = f / (frames - 1)
        img = Image.new("RGBA", (W * s, H * s), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        head = int(t * n)
        for k in range(36):
            i = (head - k) % n
            a = int(232 * (1 - k / 36) * (1 if t < 0.94 else (1 - t) * 17))
            x, y = samples[i]
            d.ellipse((x * s - 3.2 * s, y * s - 3.2 * s,
                       x * s + 3.2 * s, y * s + 3.2 * s),
                      fill=(255, 252, 245, max(a, 0)))
        img.resize((W, H), Image.LANCZOS).save(f"{OUT}/{name}/{f:04d}.png")


def walk_zone():
    trace(WALK_PATH, "walk_trace")
    pulse(WALK_PATH, "wpulse")
    img = canvas()
    lay = canvas()
    d = ImageDraw.Draw(lay)
    text(d, (0, 872), "EXPERIENCE ZONE", font("semi", 42), center=880)
    img.alpha_composite(soft(lay, blur=10, alpha=212))
    img.save(f"{OUT}/walk_label.png")


# two wearers, IMG_6806 @9s: heads at roughly (1275,390) and (1800,525)
A_PT = (1275, 322)
B_PT = (1800, 462)


def dot(dr, p, r=6, ring=16):
    dr.ellipse((p[0] - r, p[1] - r, p[0] + r, p[1] + r), fill=(*WHITE, 250))
    dr.ellipse((p[0] - ring, p[1] - ring, p[0] + ring, p[1] + ring),
               outline=(*WHITE, 222), width=2)


def sync_two():
    s = SS
    for name, pt in (("sync2_a", A_PT), ("sync2_b", B_PT)):
        img = Image.new("RGBA", (W * s, H * s), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        dot(d, (pt[0] * s, pt[1] * s), 6 * s, 16 * s)
        img = img.resize((W, H), Image.LANCZOS)
        out = canvas()
        out.alpha_composite(soft(img, blur=5, alpha=105))
        out.save(f"{OUT}/{name}.png")

    # link: a shallow arc between the two anchors
    img = Image.new("RGBA", (W * s, H * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    steps = 90
    for i in range(steps):
        t = i / (steps - 1)
        x = A_PT[0] + (B_PT[0] - A_PT[0]) * t
        y = A_PT[1] + (B_PT[1] - A_PT[1]) * t - math.sin(t * math.pi) * 54
        if (i // 5) % 2 == 0:
            d.ellipse((x * s - 2.2 * s, y * s - 2.2 * s,
                       x * s + 2.2 * s, y * s + 2.2 * s),
                      fill=(255, 252, 245, 208))
    img = img.resize((W, H), Image.LANCZOS)
    out = canvas()
    out.alpha_composite(soft(img, blur=4, alpha=95))
    out.save(f"{OUT}/sync2_link.png")

    img = canvas()
    lay = canvas()
    d = ImageDraw.Draw(lay)
    text(d, (0, 150), "SEE IT TOGETHER.", font("semi", 66), center=W / 2)
    img.alpha_composite(soft(lay, blur=11, alpha=215))
    img.save(f"{OUT}/sync2_title.png")


if __name__ == "__main__":
    walk_zone()
    sync_two()
    print("v6 ui done")
