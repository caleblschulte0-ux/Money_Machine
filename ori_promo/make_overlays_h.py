#!/usr/bin/env python3
"""Overlay PNGs for the HORIZONTAL (1920x1080) cut of the ORI promo."""
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1920, 1080
ANTON = "/home/user/Shorts-pipeline/assets/fonts/Anton-Regular.ttf"
SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
SANS_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
CYAN = (79, 227, 219)
CYAN_DIM = (79, 227, 219, 200)
GLASS = (8, 14, 18, 180)
WHITE = (255, 255, 255)


def font(p, s):
    return ImageFont.truetype(p, s)


def tw(d, s, f):
    return d.textbbox((0, 0), s, font=f)[2]


def corner_brackets(d, box, ln=80, w=7, color=(*CYAN, 235), gap=0):
    x0, y0, x1, y1 = box
    x0, y0, x1, y1 = x0 - gap, y0 - gap, x1 + gap, y1 + gap
    for (cx, cy, dx, dy) in [(x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)]:
        d.line([(cx, cy), (cx + dx * ln, cy)], fill=color, width=w)
        d.line([(cx, cy), (cx, cy + dy * ln)], fill=color, width=w)


def shadowed(img, blur=14, alpha=140):
    a = img.split()[3].point(lambda p: min(p, alpha))
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sh.paste(Image.new("RGBA", img.size, (0, 0, 0, 255)), (0, 0), a)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.alpha_composite(sh, (5, 8))
    out.alpha_composite(img)
    return out


def hook(fname):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f_t = font(ANTON, 150)
    y = 330
    for s in ["EVERY PLACE", "HAS A STORY"]:
        x = (W - tw(d, s, f_t)) // 2
        d.text((x, y), s, font=f_t, fill=WHITE, stroke_width=10, stroke_fill=(6, 10, 12))
        y += 172
    d.rectangle(((W - 340) // 2, y + 24, (W + 340) // 2, y + 38), fill=CYAN)
    img.alpha_composite(shadowed(layer, blur=18))
    img.save(fname)


def brand(fname):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f_small = font(SANS_B, 34)
    f_big = font(ANTON, 110)
    f_sub = font(SANS, 40)
    y0 = 640
    s = "INTRODUCING"
    d.text(((W - tw(d, s, f_small)) // 2, y0), s, font=f_small, fill=CYAN,
           stroke_width=6, stroke_fill=(6, 10, 12))
    s = "OPEN RANGE INTERACTIVE"
    d.text(((W - tw(d, s, f_big)) // 2, y0 + 52), s, font=f_big, fill=WHITE,
           stroke_width=9, stroke_fill=(6, 10, 12))
    s = "AR glasses built for travel"
    d.text(((W - tw(d, s, f_sub)) // 2, y0 + 200), s, font=f_sub,
           fill=(222, 234, 238), stroke_width=6, stroke_fill=(6, 10, 12))
    img.alpha_composite(shadowed(layer, blur=16))
    img.save(fname)


def hud(fname):
    import math
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    corner_brackets(d, (56, 56, W - 56, H - 56), ln=90, w=7)
    cx, cy = W // 2, 600
    r = 46
    for ang in range(0, 360, 90):
        d.arc((cx - r, cy - r, cx + r, cy + r), ang + 12, ang + 78,
              fill=(*CYAN, 190), width=5)
    d.ellipse((cx - 5, cy - 5, cx + 5, cy + 5), fill=(*CYAN, 210))
    f_s = font(SANS_B, 30)
    d.text((78, 76), "ORI VISION", font=f_s, fill=(*CYAN, 255),
           stroke_width=5, stroke_fill=(6, 10, 12, 230))
    s = "SITE RECOGNIZED"
    d.text((W - 78 - tw(d, s, f_s), 76), s, font=f_s, fill=(*CYAN, 255),
           stroke_width=5, stroke_fill=(6, 10, 12, 230))
    img.save(fname)


def card(fname, kicker, title, sub, cx, top, anchor, card_w=640):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f_k = font(SANS_B, 27)
    f_t = font(ANTON, 56)
    f_s = font(SANS, 30)
    pad = 30
    x0, y0 = cx - card_w // 2, top
    th = (27 + 12) + (56 + 14) + 30
    x1, y1 = x0 + card_w, y0 + th + pad * 2
    d.rounded_rectangle((x0, y0, x1, y1), radius=24, fill=GLASS,
                        outline=CYAN_DIM, width=3)
    corner_brackets(d, (x0 - 12, y0 - 12, x1 + 12, y1 + 12), ln=40, w=5)
    ty = y0 + pad
    d.rectangle((x0 + pad, ty + 3, x0 + pad + 7, ty + 27), fill=CYAN)
    d.text((x0 + pad + 20, ty), kicker, font=f_k, fill=CYAN)
    ty += 27 + 12
    d.text((x0 + pad, ty), title, font=f_t, fill=WHITE)
    ty += 56 + 14
    d.text((x0 + pad, ty), sub, font=f_s, fill=(210, 224, 228))
    ax, ay = anchor
    lx = min(max(ax, x0 + 50), x1 - 50)
    d.line([(lx, y1), (lx, ay)], fill=CYAN, width=4)
    if abs(ax - lx) > 20:  # L-connector when the dot sits off to one side
        d.line([(lx, ay), (ax - 16, ay)] if ax > lx else [(ax + 16, ay), (lx, ay)],
               fill=CYAN, width=4)
    d.ellipse((ax - 12, ay - 12, ax + 12, ay + 12), outline=CYAN, width=4)
    d.ellipse((ax - 4, ay - 4, ax + 4, ay + 4), fill=CYAN)
    img.alpha_composite(shadowed(layer))
    img.save(fname)


def time_chip(fname, label):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f_t = font(ANTON, 52)
    w = tw(d, label, f_t)
    pad_x, pad_y = 46, 22
    x0 = (W - w) // 2 - pad_x
    y0 = 92
    x1 = (W + w) // 2 + pad_x
    y1 = y0 + 52 + pad_y * 2
    d.rounded_rectangle((x0, y0, x1, y1), radius=18, fill=GLASS,
                        outline=CYAN_DIM, width=3)
    d.text(((W - w) // 2, y0 + pad_y - 2), label, font=f_t, fill=CYAN)
    # small "rewind" glyph left of the pill
    gx = x0 - 64
    gy = (y0 + y1) // 2
    for off in (0, 30):
        d.polygon([(gx + off, gy - 20), (gx + off, gy + 20), (gx + off - 26, gy)],
                  fill=(*CYAN, 235))
    img.alpha_composite(shadowed(layer))
    img.save(fname)


def endcard(fname):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 120))
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f_big = font(ANTON, 120)
    f_tag = font(ANTON, 58)
    f_sub = font(SANS, 38)
    y = 300
    s = "OPEN RANGE INTERACTIVE"
    d.text(((W - tw(d, s, f_big)) // 2, y), s, font=f_big, fill=WHITE,
           stroke_width=9, stroke_fill=(6, 10, 12))
    y += 160
    d.rectangle(((W - 460) // 2, y, (W + 460) // 2, y + 12), fill=CYAN)
    y += 60
    s = "SEE THE STORY WHERE YOU STAND"
    d.text(((W - tw(d, s, f_tag)) // 2, y), s, font=f_tag, fill=CYAN,
           stroke_width=6, stroke_fill=(6, 10, 12))
    y += 110
    s = "AR tourism glasses — coming soon"
    d.text(((W - tw(d, s, f_sub)) // 2, y), s, font=f_sub, fill=(222, 234, 238),
           stroke_width=6, stroke_fill=(6, 10, 12))
    img.alpha_composite(shadowed(layer, blur=16))
    img.save(fname)


if __name__ == "__main__":
    import os
    os.makedirs("work/overlays_h", exist_ok=True)
    O = "work/overlays_h"
    hook(f"{O}/hook.png")
    brand(f"{O}/brand.png")
    hud(f"{O}/hud.png")
    # 6806 @ ~42s: mill house upper-left, person right — card top-left,
    # anchor on the mill.
    card(f"{O}/card_mill.png", "HISTORIC SITE", "QUEEN BEE MILL",
         "Built 1881 · Sioux quartzite ruins", cx=440, top=140,
         anchor=(855, 560))
    # 6804 @ ~24.5s: face left, rapids right — card top-right, anchor rapids.
    card(f"{O}/card_river.png", "NATURAL FEATURE", "BIG SIOUX RIVER",
         "Falls avg. 7,400 gallons / second", cx=1460, top=140,
         anchor=(1300, 500))
    time_chip(f"{O}/chip_1873.png", "TIME LAYER · 1873 · SETTLEMENT ERA")
    time_chip(f"{O}/chip_ice.png", "TIME LAYER · GLACIAL ERA")
    endcard(f"{O}/endcard.png")
    print("overlays_h done")
