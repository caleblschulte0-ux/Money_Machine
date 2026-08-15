#!/usr/bin/env python3
"""Overlay PNGs for the 1920x1080 ORI promo — refined design pass.

Design system: quiet HUD (thin strokes, tracked small caps, dark backing
pills), compact info cards with precise L-connectors, slim time-layer
chips, gradient scrim end card, crystalline frost border for the glacial
beat."""
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import numpy as np

W, H = 1920, 1080
ANTON = "/home/user/Shorts-pipeline/assets/fonts/Anton-Regular.ttf"
SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
SANS_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
CYAN = (99, 227, 220)
GLASS = (7, 12, 16, 168)
WHITE = (245, 250, 252)


def font(p, s):
    return ImageFont.truetype(p, s)


def tw(d, s, f, tracking=0):
    w = d.textbbox((0, 0), s, font=f)[2]
    return w + tracking * max(len(s) - 1, 0)


def ttext(d, pos, s, f, fill, tracking=0, stroke=0, stroke_fill=(6, 10, 12)):
    """Text with letter-spacing."""
    x, y = pos
    for ch in s:
        d.text((x, y), ch, font=f, fill=fill, stroke_width=stroke,
               stroke_fill=stroke_fill)
        x += d.textbbox((0, 0), ch, font=f)[2] + tracking


def shadowed(img, blur=12, alpha=120):
    a = img.split()[3].point(lambda p: min(p, alpha))
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sh.paste(Image.new("RGBA", img.size, (0, 0, 0, 255)), (0, 0), a)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.alpha_composite(sh, (4, 6))
    out.alpha_composite(img)
    return out


def label_pill(d, x, y, s, f, tracking=2, pad=(14, 8), align="left"):
    wdt = tw(d, s, f, tracking)
    if align == "right":
        x -= wdt + pad[0] * 2
    d.rounded_rectangle((x, y, x + wdt + pad[0] * 2, y + f.size + pad[1] * 2),
                        radius=8, fill=(6, 10, 13, 150))
    ttext(d, (x + pad[0], y + pad[1]), s, f, (*CYAN, 235), tracking)


def hook(fname):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f_t = font(ANTON, 148)
    y = 340
    for s in ["EVERY PLACE", "HAS A STORY"]:
        x = (W - tw(d, s, f_t, 4)) // 2
        ttext(d, (x, y), s, f_t, WHITE, tracking=4, stroke=7)
        y += 170
    d.rectangle(((W - 300) // 2, y + 26, (W + 300) // 2, y + 36), fill=CYAN)
    img.alpha_composite(shadowed(layer, blur=16))
    img.save(fname)


def brand(fname):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f_k = font(SANS_B, 28)
    f_big = font(ANTON, 104)
    f_sub = font(SANS, 36)
    y0 = 660
    s = "INTRODUCING"
    ttext(d, ((W - tw(d, s, f_k, 8)) // 2, y0), s, f_k, CYAN, tracking=8, stroke=5)
    s = "OPEN RANGE INTERACTIVE"
    x = (W - tw(d, s, f_big, 2)) // 2
    ttext(d, (x, y0 + 46), s, f_big, WHITE, tracking=2, stroke=7)
    s = "AR glasses built for travel"
    ttext(d, ((W - tw(d, s, f_sub, 1)) // 2, y0 + 192), s, f_sub,
          (225, 236, 240), tracking=1, stroke=5)
    img.alpha_composite(shadowed(layer, blur=14))
    img.save(fname)


def hud(fname):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    m, ln, wd = 52, 62, 4
    col = (*CYAN, 150)
    for (cx, cy, dx, dy) in [(m, m, 1, 1), (W - m, m, -1, 1),
                             (m, H - m, 1, -1), (W - m, H - m, -1, -1)]:
        d.line([(cx, cy), (cx + dx * ln, cy)], fill=col, width=wd)
        d.line([(cx, cy), (cx, cy + dy * ln)], fill=col, width=wd)
    cx, cy, r = W // 2, 580, 30
    for ang in range(0, 360, 90):
        d.arc((cx - r, cy - r, cx + r, cy + r), ang + 14, ang + 76,
              fill=(*CYAN, 140), width=3)
    d.ellipse((cx - 3, cy - 3, cx + 3, cy + 3), fill=(*CYAN, 170))
    f_s = font(SANS_B, 23)
    label_pill(d, m + 14, m + 12, "ORI VISION", f_s, tracking=3)
    label_pill(d, W - m - 14, m + 12, "SITE RECOGNIZED", f_s, tracking=3,
               align="right")
    img.save(fname)


def card(fname, kicker, title, sub, cx, top, anchor, card_w=560):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f_k = font(SANS_B, 22)
    f_t = font(ANTON, 48)
    f_s = font(SANS, 27)
    pad = 28
    x0, y0 = cx - card_w // 2, top
    th = (22 + 12) + (48 + 12) + 27
    x1, y1 = x0 + card_w, y0 + th + pad * 2
    d.rounded_rectangle((x0, y0, x1, y1), radius=14, fill=GLASS,
                        outline=(*CYAN, 165), width=2)
    ty = y0 + pad
    d.rectangle((x0 + pad, ty + 2, x0 + pad + 6, ty + 22), fill=CYAN)
    ttext(d, (x0 + pad + 18, ty), kicker, f_k, (*CYAN, 235), tracking=3)
    ty += 22 + 12
    ttext(d, (x0 + pad, ty), title, f_t, WHITE, tracking=1)
    ty += 48 + 12
    d.text((x0 + pad, ty), sub, font=f_s, fill=(208, 222, 226))
    ax, ay = anchor
    lx = min(max(ax, x0 + 40), x1 - 40)
    d.line([(lx, y1), (lx, ay)], fill=(*CYAN, 210), width=3)
    if abs(ax - lx) > 18:
        seg = [(lx, ay), (ax - 14, ay)] if ax > lx else [(ax + 14, ay), (lx, ay)]
        d.line(seg, fill=(*CYAN, 210), width=3)
    d.ellipse((ax - 11, ay - 11, ax + 11, ay + 11), outline=(*CYAN, 235), width=3)
    d.ellipse((ax - 3, ay - 3, ax + 3, ay + 3), fill=(*CYAN, 245))
    img.alpha_composite(shadowed(layer))
    img.save(fname)


def time_chip(fname, label):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f_t = font(ANTON, 42)
    wdt = tw(d, label, f_t, 2)
    pad_x, pad_y = 36, 16
    x0 = (W - wdt) // 2 - pad_x
    y0 = 86
    x1 = (W + wdt) // 2 + pad_x
    y1 = y0 + 42 + pad_y * 2
    d.rounded_rectangle((x0, y0, x1, y1), radius=12, fill=GLASS,
                        outline=(*CYAN, 165), width=2)
    ttext(d, ((W - wdt) // 2, y0 + pad_y - 1), label, f_t, (*CYAN, 240), tracking=2)
    gx, gy = x0 - 44, (y0 + y1) // 2
    for off in (0, 22):
        d.polygon([(gx + off, gy - 13), (gx + off, gy + 13), (gx + off - 18, gy)],
                  fill=(*CYAN, 210))
    img.alpha_composite(shadowed(layer))
    img.save(fname)


def endcard(fname):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    # vertical gradient scrim: darker at bottom for grounding
    grad = np.linspace(90, 170, H).astype(np.uint8)
    scrim = np.zeros((H, W, 4), np.uint8)
    scrim[..., 3] = grad[:, None]
    img.alpha_composite(Image.fromarray(scrim))
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f_big = font(ANTON, 116)
    f_tag = font(ANTON, 52)
    f_sub = font(SANS, 34)
    y = 320
    s = "OPEN RANGE INTERACTIVE"
    ttext(d, ((W - tw(d, s, f_big, 3)) // 2, y), s, f_big, WHITE, tracking=3, stroke=6)
    y += 158
    d.rectangle(((W - 430) // 2, y, (W + 430) // 2, y + 10), fill=CYAN)
    y += 56
    s = "SEE THE STORY WHERE YOU STAND"
    ttext(d, ((W - tw(d, s, f_tag, 4)) // 2, y), s, f_tag, (*CYAN, 255), tracking=4, stroke=5)
    y += 104
    s = "AR tourism glasses — coming soon"
    ttext(d, ((W - tw(d, s, f_sub, 1)) // 2, y), s, f_sub, (225, 236, 240), tracking=1, stroke=5)
    img.alpha_composite(shadowed(layer, blur=14))
    img.save(fname)


def frost_border(fname):
    """Crystalline frost creeping in from the frame edges."""
    rng = np.random.default_rng(3)
    noise = rng.random((H // 4, W // 4)).astype(np.float32)
    n = Image.fromarray((noise * 255).astype(np.uint8)).resize((W, H), Image.BILINEAR)
    n = n.filter(ImageFilter.GaussianBlur(3))
    n = np.asarray(n).astype(np.float32) / 255.0

    yy, xx = np.mgrid[0:H, 0:W]
    ex = np.minimum(xx, W - 1 - xx) / (W * 0.5)
    ey = np.minimum(yy, H - 1 - yy) / (H * 0.5)
    edge = 1.0 - np.clip(np.minimum(ex, ey) * 2.6, 0, 1)   # 1 at edges
    a = np.clip((n * 0.7 + 0.5) * edge ** 1.6, 0, 1)
    alpha = (a * 235).astype(np.uint8)

    frost = np.zeros((H, W, 4), np.uint8)
    frost[..., 0] = 226
    frost[..., 1] = 242
    frost[..., 2] = 252
    frost[..., 3] = alpha
    out = Image.fromarray(frost).filter(ImageFilter.GaussianBlur(1))
    out.save(fname)


if __name__ == "__main__":
    import os
    os.makedirs("work/overlays_h", exist_ok=True)
    O = "work/overlays_h"
    hook(f"{O}/hook.png")
    brand(f"{O}/brand.png")
    hud(f"{O}/hud.png")
    # 6796 @ ~47s: Queen Bee Mill marker mid-frame, the mill's quartzite
    # ruins behind the fence at frame-left — the dot pins the ruins.
    card(f"{O}/card_mill.png", "HISTORIC SITE", "QUEEN BEE MILL",
         "Built 1881 · Sioux quartzite ruins", cx=1420, top=110,
         anchor=(350, 470))
    # 6806 @ ~42s: falls left-of-center, viewer right — dot on the falls.
    card(f"{O}/card_river.png", "NATURAL FEATURE", "BIG SIOUX RIVER",
         "Falls avg. 7,400 gallons / second", cx=460, top=110,
         anchor=(855, 560))
    time_chip(f"{O}/chip_native.png", "TIME LAYER · DAKOTA ENCAMPMENT")
    time_chip(f"{O}/chip_1873.png", "TIME LAYER · 1873 · SETTLEMENT ERA")
    time_chip(f"{O}/chip_ice.png", "TIME LAYER · GLACIAL ERA")
    endcard(f"{O}/endcard.png")
    frost_border(f"{O}/frost.png")
    print("overlays_h v2 done")
