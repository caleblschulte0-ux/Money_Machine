#!/usr/bin/env python3
"""v5 UI: 8 text moments total. Left-aligned two-line hook, segmented
terrain-conforming zone trace with traveling pulse, brighter product
stage, centered brand block."""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import math
import os
import sys

sys.path.insert(0, "trailer")
from ui_kit import W, H, SS, font, canvas, WHITE

OUT = "trailer/ui5"
os.makedirs(OUT, exist_ok=True)


def text(d, pos, s, f, fill=WHITE, center=None):
    x = pos[0] if center is None else center - d.textlength(s, font=f) / 2
    d.text((x, pos[1]), s, font=f, fill=fill)


def soft(img, blur=10, alpha=200):
    a = img.split()[3].point(lambda p: min(p, alpha))
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sh.paste(Image.new("RGBA", img.size, (6, 8, 10, 255)), (0, 0), a)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.alpha_composite(sh, (0, 3))
    out.alpha_composite(img)
    return out


def local_grad(img, x0, y0, x1, y1, alpha):
    grad = np.zeros((H, W, 4), np.uint8)
    yy, xx = np.mgrid[0:H, 0:W]
    inx = np.clip((xx - x0) / max(x1 - x0, 1), 0, 1)
    iny = np.clip((yy - y0) / max(y1 - y0, 1), 0, 1)
    m = np.minimum(np.minimum(inx, 1 - inx) * 3, 1) * \
        np.minimum(np.minimum(iny, 1 - iny) * 3, 1)
    grad[..., 3] = (m * alpha).astype(np.uint8)
    img.alpha_composite(Image.fromarray(grad))


def hook():
    """Two lines, left aligned, big."""
    img = canvas()
    local_grad(img, 60, 560, 1100, 1010, 150)
    lay = canvas()
    d = ImageDraw.Draw(lay)
    text(d, (120, 660), "HISTORY,", font("semi", 92))
    text(d, (120, 770), "WHERE IT HAPPENED.", font("semi", 92))
    img.alpha_composite(soft(lay, blur=12))
    img.save(f"{OUT}/hook.png")


def era(name, s_):
    img = canvas()
    lay = canvas()
    d = ImageDraw.Draw(lay)
    text(d, (120, 900), s_, font("semi", 52))
    img.alpha_composite(soft(lay, blur=11, alpha=215))
    img.save(f"{OUT}/{name}.png")


def anchor_dot(name, ax, ay):
    s = SS
    img = Image.new("RGBA", (W * s, H * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((ax * s - 6 * s, ay * s - 6 * s, ax * s + 6 * s, ay * s + 6 * s),
              fill=(*WHITE, 250))
    d.ellipse((ax * s - 16 * s, ay * s - 16 * s, ax * s + 16 * s, ay * s + 16 * s),
              outline=(*WHITE, 225), width=2 * s)
    img = img.resize((W, H), Image.LANCZOS)
    out = canvas()
    out.alpha_composite(soft(img, blur=5, alpha=110))
    out.save(f"{OUT}/{name}.png")


ZONE_PATH = [(790, 884), (950, 852), (1180, 848), (1330, 882), (1382, 926),
             (1292, 968), (1080, 986), (880, 962), (794, 924)]


def _path_samples(pts, n=560):
    """Evenly sample a closed smooth-ish path."""
    pts = pts + [pts[0]]
    segs = []
    total = 0
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        segs.append((a, b, L))
        total += L
    out = []
    for k in range(n):
        d = total * k / n
        acc = 0
        for a, b, L in segs:
            if acc + L >= d:
                t = (d - acc) / L
                out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
                break
            acc += L
    return out


def zone_assets():
    """Segmented terrain trace + traveling pulse sequence + label."""
    samples = _path_samples(ZONE_PATH)
    s = SS
    # static segmented perimeter
    img = Image.new("RGBA", (W * s, H * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    n = len(samples)
    for i in range(n):
        if (i // 8) % 2 == 0:      # dash pattern
            x, y = samples[i]
            d.ellipse((x * s - 2.2 * s, y * s - 2.2 * s,
                       x * s + 2.2 * s, y * s + 2.2 * s),
                      fill=(255, 252, 245, 215))
    img = img.resize((W, H), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.6))
    out = canvas()
    out.alpha_composite(soft(img, blur=5, alpha=90))
    out.save(f"{OUT}/zone_trace.png")

    # traveling pulse: bright arc running the loop once (26 frames)
    os.makedirs(f"{OUT}/zpulse", exist_ok=True)
    for f in range(26):
        t = f / 25
        img = Image.new("RGBA", (W * s, H * s), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        head = int(t * n)
        for k in range(34):
            i = (head - k) % n
            a = int(235 * (1 - k / 34) * (1 if t < 0.97 else (1 - t) * 30))
            x, y = samples[i]
            d.ellipse((x * s - 3 * s, y * s - 3 * s, x * s + 3 * s, y * s + 3 * s),
                      fill=(255, 252, 245, max(a, 0)))
        img.resize((W, H), Image.LANCZOS).save(f"{OUT}/zpulse/{f:04d}.png")

    img = canvas()
    lay = canvas()
    d = ImageDraw.Draw(lay)
    text(d, (0, 742), "EXPERIENCE READY", font("semi", 40), center=1080)
    img.alpha_composite(soft(lay, blur=10, alpha=210))
    img.save(f"{OUT}/zone_label.png")


def sync_bits():
    anchor_dot("sync_a", 855, 560)
    s = SS
    img = Image.new("RGBA", (W * s, H * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((905 * s - 4 * s, 560 * s - 4 * s, 905 * s + 4 * s, 560 * s + 4 * s),
              fill=(*WHITE, 245))
    img = img.resize((W, H), Image.LANCZOS)
    out = canvas()
    out.alpha_composite(soft(img, blur=4, alpha=100))
    out.save(f"{OUT}/sync_join.png")
    img = canvas()
    lay = canvas()
    d = ImageDraw.Draw(lay)
    text(d, (0, 150), "SEE IT TOGETHER.", font("semi", 66), center=W / 2)
    img.alpha_composite(soft(lay, blur=11, alpha=215))
    img.save(f"{OUT}/sync_title.png")


def release():
    img = canvas()
    lay = canvas()
    d = ImageDraw.Draw(lay)
    text(d, (0, 200), "ANY PLACE", font("semi", 64), center=1280)
    text(d, (0, 286), "WITH A STORY.", font("semi", 64), center=1280)
    img.alpha_composite(soft(lay, blur=12, alpha=215))
    img.save(f"{OUT}/release.png")


def product_stage():
    """Brighter product: lifted hero + soft backlight pool + reflection."""
    hero = Image.open("trailer/assets_v3/glasses_hero.png").convert("RGBA")
    r, g, b, a = hero.split()
    rgb = Image.merge("RGB", (r, g, b))
    rgb = rgb.point(lambda p: min(int(p * 1.32 + 14), 255))
    hero = Image.merge("RGBA", (*rgb.split(), a))
    tw = 1060
    hero = hero.resize((tw, int(hero.height * tw / hero.width)), Image.LANCZOS)

    # backlit stage
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    r2 = np.sqrt(((xx - W * 0.5) / (W * 0.62)) ** 2 +
                 ((yy - H * 0.52) / (H * 0.62)) ** 2)
    v = np.clip(46 - r2 * 40, 7, 46)
    bg = np.zeros((H, W, 3), dtype="uint8")
    bg[..., 0] = v * 0.94
    bg[..., 1] = v
    bg[..., 2] = v * 1.10
    Image.fromarray(bg).save(f"{OUT}/stage_bg.png")

    img = canvas()
    x = (W - hero.width) // 2
    y = 566 - hero.height // 2
    refl = hero.transpose(Image.FLIP_TOP_BOTTOM)
    fade = np.linspace(84, 0, refl.height).astype(np.uint8)
    ra = np.asarray(refl.split()[3]).astype(np.uint16)
    refl.putalpha(Image.fromarray((ra * fade[:, None] // 255).astype(np.uint8), "L"))
    refl = refl.filter(ImageFilter.GaussianBlur(3))
    img.alpha_composite(refl, (x, y + hero.height + 6))
    img.alpha_composite(hero, (x, y))
    img.save(f"{OUT}/hero.png")

    items = [
        ("c1", "SELF-CONTAINED", 640, 660, 400, 780, "right"),
        ("c2", "LOCATION AWARE", 600, 520, 430, 380, "right"),
        ("c3", "SPATIAL AUDIO", 1330, 640, 1500, 772, "left"),
    ]
    for name, s_, px, py, tx, ty, side in items:
        img = canvas()
        d = ImageDraw.Draw(img)
        d.ellipse((px - 5, py - 5, px + 5, py + 5), fill=(*WHITE, 245))
        d.line([(px, py), (tx, ty)], fill=(255, 255, 255, 185), width=2)
        f = font("semi", 33)
        lx = tx - d.textlength(s_, font=f) - 16 if side == "right" else tx + 16
        text(d, (lx, ty - 19), s_, f)
        img.save(f"{OUT}/{name}.png")


def brand():
    img = canvas()
    d = ImageDraw.Draw(img)
    text(d, (0, 356), "OPEN RANGE", font("semi", 124), center=W / 2)
    text(d, (0, 502), "INTERACTIVE", font("semi", 124), center=W / 2)
    img.save(f"{OUT}/wordmark.png")
    img = canvas()
    d = ImageDraw.Draw(img)
    text(d, (0, 700), "The past, anchored to place.", font("med", 42),
         (226, 232, 238, 250), center=W / 2)
    img.save(f"{OUT}/tagline.png")
    img = canvas()
    d = ImageDraw.Draw(img)
    text(d, (0, 954), "Falls Park Beta · Sioux Falls, SD", font("med", 26),
         (156, 164, 172, 245), center=W / 2)
    img.save(f"{OUT}/micro.png")


if __name__ == "__main__":
    hook()
    era("era_dakota", "DAKOTA LIFE")
    era("era_settle", "1870s SETTLEMENT")
    anchor_dot("mill_dot", 700, 420)
    zone_assets()
    sync_bits()
    release()
    product_stage()
    brand()
    print("v5 ui done")
