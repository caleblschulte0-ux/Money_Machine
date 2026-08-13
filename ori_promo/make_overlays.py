#!/usr/bin/env python3
"""Draw every overlay PNG for the Open Range Interactive promo.

All art is generated: AR HUD cards, hook title, brand lower-third, end card.
Fonts: Anton (Shorts-pipeline assets) for display, DejaVu Sans for body.
Canvas is always 1080x1920 RGBA so ffmpeg overlays land at 0,0.
"""
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1080, 1920
ANTON = "/home/user/Shorts-pipeline/assets/fonts/Anton-Regular.ttf"
SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
SANS_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
CYAN = (79, 227, 219)
CYAN_DIM = (79, 227, 219, 200)
GLASS = (8, 14, 18, 175)
WHITE = (255, 255, 255)

def font(path, size):
    return ImageFont.truetype(path, size)

def text_w(draw, s, f):
    return draw.textbbox((0, 0), s, font=f)[2]


def rounded_glass(draw, box, radius=28, fill=GLASS, outline=CYAN_DIM, width=3):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def corner_brackets(draw, box, ln=46, w=6, color=CYAN, gap=14):
    x0, y0, x1, y1 = box
    x0, y0, x1, y1 = x0 - gap, y0 - gap, x1 + gap, y1 + gap
    for (cx, cy, dx, dy) in [(x0, y0, 1, 1), (x1, y0, -1, 1), (x0, y1, 1, -1), (x1, y1, -1, -1)]:
        draw.line([(cx, cy), (cx + dx * ln, cy)], fill=color, width=w)
        draw.line([(cx, cy), (cx, cy + dy * ln)], fill=color, width=w)


def shadow_layer(img, blur=14, alpha=140):
    a = img.split()[3].point(lambda p: min(p, alpha))
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    black = Image.new("RGBA", img.size, (0, 0, 0, 255))
    sh.paste(black, (0, 0), a)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.alpha_composite(sh, (6, 10))
    out.alpha_composite(img)
    return out


def ar_card(fname, kicker, title, sub, cx, card_top, anchor_xy, card_w=760):
    """HUD card with ORI chip, title, subtitle, corner brackets and a
    connector line running to an anchor dot on the subject."""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    f_k = font(SANS_B, 30)
    f_t = font(ANTON, 64)
    f_s = font(SANS, 34)

    pad = 36
    x0 = cx - card_w // 2
    th = 0
    th += 30 + 14        # kicker
    th += 64 + 16        # title
    th += 34             # sub
    y0 = card_top
    y1 = y0 + th + pad * 2
    x1 = x0 + card_w

    card = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    cd = ImageDraw.Draw(card)
    rounded_glass(cd, (x0, y0, x1, y1))
    corner_brackets(cd, (x0, y0, x1, y1))

    ty = y0 + pad
    cd.rectangle((x0 + pad, ty + 4, x0 + pad + 8, ty + 30), fill=CYAN)
    cd.text((x0 + pad + 22, ty), kicker, font=f_k, fill=CYAN)
    ty += 30 + 14
    cd.text((x0 + pad, ty), title, font=f_t, fill=WHITE)
    ty += 64 + 16
    cd.text((x0 + pad, ty), sub, font=f_s, fill=(210, 224, 228))

    ax, ay = anchor_xy
    lx = min(max(ax, x0 + 60), x1 - 60)
    cd.line([(lx, y1), (lx, ay - 16)], fill=CYAN, width=4)
    cd.ellipse((ax - 13, ay - 13, ax + 13, ay + 13), outline=CYAN, width=4)
    cd.ellipse((ax - 4, ay - 4, ax + 4, ay + 4), fill=CYAN)

    img.alpha_composite(shadow_layer(card))
    img.save(fname)


def hook_title(fname):
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    lines = ["EVERY PLACE", "HAS A STORY"]
    f_t = font(ANTON, 150)
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    y = 360
    for s in lines:
        w = text_w(d, s, f_t)
        x = (W - w) // 2
        d.text((x, y), s, font=f_t, fill=WHITE, stroke_width=10, stroke_fill=(6, 10, 12))
        y += 172
    d2 = ImageDraw.Draw(layer)
    bar_w = 320
    d2.rectangle(((W - bar_w) // 2, y + 26, (W + bar_w) // 2, y + 40), fill=CYAN)
    img.alpha_composite(shadow_layer(layer, blur=18))
    img.save(fname)


def brand_intro(fname):
    """Lower third: brand name + product line, boot-up styling."""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f_small = font(SANS_B, 34)
    f_big = font(ANTON, 92)
    f_sub = font(SANS, 40)

    y0 = 1290
    s = "INTRODUCING"
    w = text_w(d, s, f_small)
    d.text(((W - w) // 2, y0), s, font=f_small, fill=CYAN, stroke_width=6, stroke_fill=(6, 10, 12))
    s = "OPEN RANGE"
    w = text_w(d, s, f_big)
    d.text(((W - w) // 2, y0 + 52), s, font=f_big, fill=WHITE, stroke_width=8, stroke_fill=(6, 10, 12))
    s = "INTERACTIVE"
    w = text_w(d, s, f_big)
    d.text(((W - w) // 2, y0 + 158), s, font=f_big, fill=WHITE, stroke_width=8, stroke_fill=(6, 10, 12))
    s = "AR glasses built for travel"
    w = text_w(d, s, f_sub)
    d.text(((W - w) // 2, y0 + 288), s, font=f_sub, fill=(222, 234, 238), stroke_width=6, stroke_fill=(6, 10, 12))
    img.alpha_composite(shadow_layer(layer, blur=16))
    img.save(fname)


def hud_frame(fname, band=(40, 600, 1040, 1330)):
    """Viewfinder hugging the letterboxed video band: corner brackets +
    reticle + status text. Sells 'you are looking through the glasses'."""
    import math
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = band
    corner_brackets(d, (x0, y0, x1, y1), ln=84, w=7, color=(*CYAN, 235), gap=0)
    cx, cy = W // 2, (y0 + y1) // 2 + 40
    r = 44
    for ang in range(0, 360, 90):
        d.arc((cx - r, cy - r, cx + r, cy + r), ang + 12, ang + 78,
              fill=(*CYAN, 200), width=5)
    d.ellipse((cx - 5, cy - 5, cx + 5, cy + 5), fill=(*CYAN, 220))
    f_s = font(SANS_B, 30)
    d.text((x0 + 6, y0 - 52), "ORI VISION", font=f_s, fill=(*CYAN, 255),
           stroke_width=5, stroke_fill=(6, 10, 12, 230))
    s = "SITE RECOGNIZED"
    w = text_w(d, s, f_s)
    d.text((x1 - 6 - w, y0 - 52), s, font=f_s, fill=(*CYAN, 255),
           stroke_width=5, stroke_fill=(6, 10, 12, 230))
    img.save(fname)


def end_card(fname):
    # Soft dark scrim so the lockup pops off busy footage.
    img = Image.new("RGBA", (W, H), (0, 0, 0, 120))
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f_big = font(ANTON, 104)
    f_tag = font(ANTON, 56)
    f_sub = font(SANS, 38)
    f_chip = font(SANS_B, 34)

    y = 640
    for s in ["OPEN RANGE", "INTERACTIVE"]:
        w = text_w(d, s, f_big)
        d.text(((W - w) // 2, y), s, font=f_big, fill=WHITE, stroke_width=8, stroke_fill=(6, 10, 12))
        y += 122
    bar_w = 430
    d.rectangle(((W - bar_w) // 2, y + 18, (W + bar_w) // 2, y + 30), fill=CYAN)
    y += 78
    s = "SEE THE STORY"
    w = text_w(d, s, f_tag)
    d.text(((W - w) // 2, y), s, font=f_tag, fill=CYAN, stroke_width=6, stroke_fill=(6, 10, 12))
    y += 70
    s = "WHERE YOU STAND"
    w = text_w(d, s, f_tag)
    d.text(((W - w) // 2, y), s, font=f_tag, fill=CYAN, stroke_width=6, stroke_fill=(6, 10, 12))
    y += 118
    s = "AR tourism glasses — coming soon"
    w = text_w(d, s, f_sub)
    d.text(((W - w) // 2, y), s, font=f_sub, fill=(222, 234, 238), stroke_width=6, stroke_fill=(6, 10, 12))
    img.alpha_composite(shadow_layer(layer, blur=16))
    img.save(fname)


if __name__ == "__main__":
    import os
    os.makedirs("work/overlays", exist_ok=True)
    hook_title("work/overlays/hook.png")
    brand_intro("work/overlays/brand.png")
    hud_frame("work/overlays/hud.png")
    ar_card("work/overlays/card_mill.png", "HISTORIC SITE", "QUEEN BEE MILL",
            "Built 1881 · Sioux quartzite ruins", cx=540, card_top=300,
            anchor_xy=(300, 900))
    ar_card("work/overlays/card_river.png", "NATURAL FEATURE", "BIG SIOUX RIVER",
            "Falls avg. 7,400 gallons / second", cx=540, card_top=300,
            anchor_xy=(720, 940))
    ar_card("work/overlays/card_walk.png", "WAYFINDING", "SCENIC OVERLOOK",
            "Historic downtown · 5 min walk", cx=540, card_top=300,
            anchor_xy=(640, 980))
    end_card("work/overlays/endcard.png")
    print("overlays done")
