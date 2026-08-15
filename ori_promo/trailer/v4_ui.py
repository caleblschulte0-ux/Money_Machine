#!/usr/bin/env python3
"""v4 UI: confident hierarchy, normal tracking, localized scrims.
Animated map (route draws progressively). Zone made clearly visible.
Sync expressed visually + SEE IT TOGETHER."""
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import numpy as np
import os
import sys

sys.path.insert(0, "trailer")
from ui_kit import W, H, SS, font, canvas, WHITE

OUT = "trailer/ui4"
os.makedirs(OUT, exist_ok=True)


def text(d, pos, s, f, fill=WHITE, tracking=0, center=None):
    if center is not None:
        wdt = d.textlength(s, font=f) + tracking * max(len(s) - 1, 0)
        x = center - wdt / 2
    else:
        x = pos[0]
    y = pos[1]
    if tracking == 0:
        d.text((x, y), s, font=f, fill=fill)
    else:
        for ch in s:
            d.text((x, y), ch, font=f, fill=fill)
            x += d.textlength(ch, font=f) + tracking


def soft(img, blur=10, alpha=200):
    a = img.split()[3].point(lambda p: min(p, alpha))
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sh.paste(Image.new("RGBA", img.size, (6, 8, 10, 255)), (0, 0), a)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.alpha_composite(sh, (0, 3))
    out.alpha_composite(img)
    return out


def scrim(img, y0, y1, alpha):
    grad = np.zeros((H, W, 4), np.uint8)
    yy = np.arange(H)
    mid, half = (y0 + y1) / 2, (y1 - y0) / 2
    a = np.clip(1 - np.abs(yy - mid) / half, 0, 1) ** 1.35 * alpha
    grad[..., 3] = a[:, None].astype(np.uint8)
    img.alpha_composite(Image.fromarray(grad))


def hook():
    img = canvas()
    scrim(img, 520, 900, 130)
    lay = canvas()
    d = ImageDraw.Draw(lay)
    text(d, (0, 620), "History, where it happened.", font("semi", 76),
         center=W / 2)
    img.alpha_composite(soft(lay))
    img.save(f"{OUT}/hook.png")


def label_block(name, line1, line2, y=880):
    img = canvas()
    scrim(img, y - 40, min(y + 190, 1080), 120)
    lay = canvas()
    d = ImageDraw.Draw(lay)
    text(d, (0, y), line1, font("semi", 44), center=W / 2)
    text(d, (0, y + 64), line2, font("med", 26), (226, 232, 238, 240),
         tracking=1, center=W / 2)
    img.alpha_composite(soft(lay))
    img.save(f"{OUT}/{name}.png")


def small_anchor(name, ax, ay, label=None):
    s = SS
    img = Image.new("RGBA", (W * s, H * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((ax * s - 6 * s, ay * s - 6 * s, ax * s + 6 * s, ay * s + 6 * s),
              fill=(*WHITE, 250))
    d.ellipse((ax * s - 16 * s, ay * s - 16 * s, ax * s + 16 * s, ay * s + 16 * s),
              outline=(*WHITE, 230), width=2 * s)
    img = img.resize((W, H), Image.LANCZOS)
    out = canvas()
    out.alpha_composite(soft(img, blur=5, alpha=110))
    if label:
        lay = canvas()
        d2 = ImageDraw.Draw(lay)
        text(d2, (ax + 34, ay - 58), label[0], font("semi", 34))
        text(d2, (ax + 34, ay - 12), label[1], font("med", 24),
             (226, 232, 238, 235))
        out.alpha_composite(soft(lay))
    out.save(f"{OUT}/{name}.png")


def zone_labels():
    """Clearly visible zone perimeter + two label states."""
    cx, cy, rx, ry = 1080, 912, 315, 80
    s = SS
    ring = Image.new("RGBA", (W * s, H * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(ring)
    box = (s * (cx - rx), s * (cy - ry), s * (cx + rx), s * (cy + ry))
    d.ellipse(box, fill=(255, 255, 255, 44))
    d.ellipse(box, outline=(*WHITE, 255), width=3 * s)
    ring = ring.resize((W, H), Image.LANCZOS)
    base = canvas()
    base.alpha_composite(soft(ring, blur=6, alpha=110))
    base.save(f"{OUT}/zone_ring.png")

    for name, txt in [("zone_t1", "VIEWING ZONE"), ("zone_t2", "EXPERIENCE READY")]:
        img = canvas()
        lay = canvas()
        d2 = ImageDraw.Draw(lay)
        text(d2, (0, cy - ry - 78), txt, font("semi", 36), center=cx)
        img.alpha_composite(soft(lay))
        img.save(f"{OUT}/{name}.png")


def sync_assets():
    """Viewer markers + connecting pulse + SEE IT TOGETHER."""
    # marker A above near viewer's sightline anchor (the falls)
    small_anchor("sync_a", 855, 560)
    # marker B — the second viewer's anchor lock, same world point,
    # drawn as a joining ring
    s = SS
    img = Image.new("RGBA", (W * s, H * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((855 * s - 26 * s, 560 * s - 26 * s, 855 * s + 26 * s,
               560 * s + 26 * s), outline=(*WHITE, 210), width=2 * s)
    img = img.resize((W, H), Image.LANCZOS)
    out = canvas()
    out.alpha_composite(soft(img, blur=5, alpha=100))
    out.save(f"{OUT}/sync_b.png")

    img = canvas()
    scrim(img, 120, 330, 110)
    lay = canvas()
    d2 = ImageDraw.Draw(lay)
    text(d2, (0, 168), "See it together.", font("semi", 64), center=W / 2)
    img.alpha_composite(soft(lay))
    img.save(f"{OUT}/sync_title.png")


def release_lines():
    for name, txt, y in [("rel_1", "ONE PARK.", 210),
                         ("rel_2", "ANY PLACE WITH A STORY.", 300)]:
        img = canvas()
        lay = canvas()
        d = ImageDraw.Draw(lay)
        text(d, (0, y), txt, font("semi", 58), center=1280)
        img.alpha_composite(soft(lay, blur=12, alpha=210))
        img.save(f"{OUT}/{name}.png")


def wordmark_block():
    img = canvas()
    d = ImageDraw.Draw(img)
    text(d, (0, 380), "OPEN RANGE", font("semi", 118), center=W / 2, tracking=2)
    text(d, (0, 520), "INTERACTIVE", font("semi", 118), center=W / 2, tracking=2)
    img.save(f"{OUT}/wordmark.png")
    img = canvas()
    d = ImageDraw.Draw(img)
    text(d, (0, 700), "The past, anchored to place.", font("med", 42),
         (226, 232, 238, 250), center=W / 2)
    img.save(f"{OUT}/tagline.png")
    img = canvas()
    d = ImageDraw.Draw(img)
    text(d, (0, 952), "FALLS PARK BETA — SIOUX FALLS, SD", font("med", 24),
         (150, 158, 166, 240), tracking=2, center=W / 2)
    img.save(f"{OUT}/micro.png")


def product_pieces():
    img = canvas()
    d = ImageDraw.Draw(img)
    text(d, (0, 132), "Everyday AR glasses", font("semi", 64), center=W / 2)
    img.save(f"{OUT}/prod_title.png")
    items = [
        ("prod_c1", "SELF-CONTAINED", 620, 645, 380, 760, "right"),
        ("prod_c2", "LOCATION AWARE", 585, 520, 500, 392, "right"),
        ("prod_c3", "SPATIAL AUDIO", 1300, 640, 1470, 756, "left"),
    ]
    for name, s_, px, py, tx, ty, side in items:
        img = canvas()
        d = ImageDraw.Draw(img)
        d.ellipse((px - 5, py - 5, px + 5, py + 5), fill=(*WHITE, 245))
        d.line([(px, py), (tx, ty)], fill=(255, 255, 255, 180), width=2)
        f = font("semi", 30)
        wdt = d.textlength(s_, font=f) + 3 * (len(s_) - 1)
        lx = tx - wdt - 14 if side == "right" else tx + 14
        text(d, (lx, ty - 17), s_, f, tracking=3)
        img.save(f"{OUT}/{name}.png")


def map_seq(frames=138):
    """Cinematic map: dark neutral, river linework, route draws
    progressively, nodes pop as reached, three names appear."""
    outdir = f"{OUT}/map"
    os.makedirs(outdir, exist_ok=True)
    s = SS
    base = Image.new("RGBA", (W * s, H * s), (12, 14, 18, 255))
    d = ImageDraw.Draw(base)
    pts = [(690, 1010), (700, 870), (760, 740), (860, 640), (940, 560),
           (990, 470), (1010, 380), (1060, 270), (1140, 160), (1180, 60)]
    for wpx, col in [(66, (36, 46, 58, 255)), (50, (62, 84, 108, 255))]:
        d.line([(x * s, y * s) for x, y in pts], fill=col, width=wpx * s,
               joint="curve")
    for (fx, fy, fl) in [(952, 545, 36), (975, 512, 32), (995, 483, 28)]:
        d.line([((fx - fl) * s, fy * s), ((fx + fl) * s, fy * s)],
               fill=(232, 240, 246, 255), width=3 * s)
    base = base.resize((W, H), Image.LANCZOS)

    route = [(760, 900), (820, 800), (900, 700), (960, 640), (1010, 590),
             (1080, 540), (1140, 470), (1160, 400), (1120, 330)]
    seglens = [math_hypot(route[i], route[i + 1]) for i in range(len(route) - 1)]
    total = sum(seglens)
    NODES = [(760, 900, None), (900, 700, "DAKOTA LIFE"),
             (1010, 590, "GLACIAL EDGE"), (1085, 528, "QUEEN BEE MILL"),
             (1120, 330, None)]

    fnt_t = font("semi", 58)
    fnt_s = font("med", 27)
    fnt_n = font("semi", 28)

    for f in range(frames):
        t = f / (frames - 1)
        img = base.copy()
        d = ImageDraw.Draw(img)
        drawn = total * min(t / 0.62, 1.0)
        acc = 0
        for i in range(len(route) - 1):
            if drawn <= acc:
                break
            x0, y0 = route[i]
            x1, y1 = route[i + 1]
            seg = seglens[i]
            frac = min((drawn - acc) / seg, 1.0)
            xe = x0 + (x1 - x0) * frac
            ye = y0 + (y1 - y0) * frac
            d.line([(x0, y0), (xe, ye)], fill=(255, 255, 255, 240), width=3)
            acc += seg
        # nodes pop as route reaches them
        acc = 0
        node_d = []
        for x, y, _ in NODES:
            best = 0
            run = 0
            for i in range(len(route) - 1):
                x0, y0 = route[i]
                if (x0, y0) == (x, y):
                    best = run
                run += seglens[i]
            if (route[-1][0], route[-1][1]) == (x, y):
                best = total
            node_d.append(best)
        for (x, y, label), nd in zip(NODES, node_d):
            if drawn >= nd - 1:
                d.ellipse((x - 14, y - 14, x + 14, y + 14),
                          outline=(255, 255, 255, 250), width=3)
                d.ellipse((x - 4, y - 4, x + 4, y + 4), fill=(255, 255, 255, 250))
        # sequential labels
        for (x, y, label), nd, delay in zip(NODES, node_d, [0, .30, .45, .58, 1]):
            if label and t > delay + 0.10:
                a = int(min((t - delay - 0.10) / 0.12, 1) * 255)
                lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
                dl = ImageDraw.Draw(lay)
                text(dl, (x + 32, y - 16), label, fnt_n, (255, 255, 255, a),
                     tracking=2)
                img.alpha_composite(lay)
        # titles
        a1 = int(min(max((t - 0.04) / 0.10, 0), 1) * 255)
        lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        dl = ImageDraw.Draw(lay)
        text(dl, (96, 96), "FALLS PARK BETA", fnt_t, (255, 255, 255, a1))
        text(dl, (96, 178), "5 EXPERIENCES · 0.9 MILE LOOP", fnt_s,
             (208, 216, 224, a1), tracking=2)
        img.alpha_composite(lay)
        img.convert("RGB").save(f"{outdir}/{f:04d}.png")
    print("map seq done")


def math_hypot(a, b):
    import math
    return math.hypot(b[0] - a[0], b[1] - a[1])


if __name__ == "__main__":
    hook()
    label_block("lbl_dakota", "DAKOTA LIFE", "Before the modern city")
    label_block("lbl_settle", "SETTLEMENT ERA", "The city takes shape")
    label_block("lbl_ice", "DEEP TIME", "The glacial edge, 12,000 years ago")
    small_anchor("anchor_mill", 700, 420, label=("Queen Bee Mill", "Built 1881"))
    zone_labels()
    sync_assets()
    release_lines()
    wordmark_block()
    product_pieces()
    map_seq()
    print("v4 ui done")
