#!/usr/bin/env python3
"""v3 UI pass: same design language, projection-room legibility.
Weights up (Medium/SemiBold over footage), 2-3px lines, larger labels,
brighter map, product scene built around the supplied photoreal
glasses hero."""
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import numpy as np
import os
import sys

sys.path.insert(0, "trailer")
from ui_kit import (W, H, SS, font, tracked, canvas, WHITE, GREY)

OUT = "trailer/ui"


def soft(img, blur=9, alpha=190):
    a = img.split()[3].point(lambda p: min(p, alpha))
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sh.paste(Image.new("RGBA", img.size, (8, 10, 12, 255)), (0, 0), a)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.alpha_composite(sh, (0, 3))
    out.alpha_composite(img)
    return out


def scrim_band(img, y0, y1, alpha=95):
    """Soft dark gradient band to seat text on bright footage."""
    grad = np.zeros((H, W, 4), np.uint8)
    yy = np.arange(H)
    mid, half = (y0 + y1) / 2, (y1 - y0) / 2
    a = np.clip(1 - np.abs(yy - mid) / half, 0, 1) ** 1.4 * alpha
    grad[..., 3] = a[:, None].astype(np.uint8)
    img.alpha_composite(Image.fromarray(grad))


def hook_title():
    img = canvas()
    scrim_band(img, 560, 850, 110)
    lay = canvas()
    d = ImageDraw.Draw(lay)
    tracked(d, (0, 640), "History, where it happened.", font("semi", 70),
            WHITE, tracking=1, anchor_center_x=W / 2)
    img.alpha_composite(soft(lay))
    img.save(f"{OUT}/hook_title.png")


def locality():
    img = canvas()
    lay = canvas()
    d = ImageDraw.Draw(lay)
    tracked(d, (96, 940), "FALLS PARK", font("semi", 32), WHITE, tracking=7)
    tracked(d, (96, 986), "SIOUX FALLS, SOUTH DAKOTA", font("med", 22),
            (*WHITE, 235), tracking=5)
    img.alpha_composite(soft(lay))
    img.save(f"{OUT}/locality.png")


def era_label(name, line1, line2):
    img = canvas()
    scrim_band(img, 880, 1050, 100)
    lay = canvas()
    d = ImageDraw.Draw(lay)
    d.line([(W / 2 - 44, 912), (W / 2 + 44, 912)], fill=(*WHITE, 235), width=3)
    tracked(d, (0, 930), line1, font("semi", 37), WHITE, tracking=3,
            anchor_center_x=W / 2)
    tracked(d, (0, 982), line2, font("med", 25), (*WHITE, 225), tracking=3,
            anchor_center_x=W / 2)
    img.alpha_composite(soft(lay))
    img.save(f"{OUT}/{name}.png")


def anchor_pin(name, title, sub, ax, ay, label_dx=46, label_dy=-140):
    s = SS
    img = Image.new("RGBA", (W * s, H * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    axs, ays = ax * s, ay * s
    d.ellipse((axs - 6 * s, ays - 6 * s, axs + 6 * s, ays + 6 * s),
              fill=(*WHITE, 250))
    d.ellipse((axs - 17 * s, ays - 17 * s, axs + 17 * s, ays + 17 * s),
              outline=(*WHITE, 220), width=2 * s)
    ly = ays + label_dy * s
    d.line([(axs, ays - 18 * s), (axs, ly + 66 * s)], fill=(*WHITE, 210),
           width=2 * s)
    d.line([(axs, ly + 66 * s), (axs + (label_dx - 10) * s, ly + 66 * s)],
           fill=(*WHITE, 210), width=2 * s)
    img = img.resize((W, H), Image.LANCZOS)
    lay = canvas()
    d2 = ImageDraw.Draw(lay)
    tracked(d2, (ax + label_dx, ay + label_dy), title, font("semi", 40),
            WHITE, tracking=1)
    tracked(d2, (ax + label_dx, ay + label_dy + 54), sub, font("med", 27),
            (*WHITE, 230), tracking=1)
    out = canvas()
    out.alpha_composite(soft(img, blur=6, alpha=120))
    out.alpha_composite(soft(lay))
    out.save(f"{OUT}/{name}.png")


def zone():
    cx, cy, rx, ry = 1080, 912, 310, 78
    s = SS
    img = Image.new("RGBA", (W * s, H * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    box = (s * (cx - rx), s * (cy - ry), s * (cx + rx), s * (cy + ry))
    d.ellipse(box, fill=(255, 255, 255, 34))
    d.ellipse(box, outline=(*WHITE, 250), width=int(2.6 * s))
    img = img.resize((W, H), Image.LANCZOS)
    lay = canvas()
    d2 = ImageDraw.Draw(lay)
    tracked(d2, (0, cy - ry - 84), "VIEWING ZONE", font("semi", 31), WHITE,
            tracking=8, anchor_center_x=cx)
    tracked(d2, (0, cy - ry - 42), "Experience ready", font("med", 25),
            (*WHITE, 235), tracking=2, anchor_center_x=cx)
    out = canvas()
    out.alpha_composite(soft(img, blur=5, alpha=90))
    out.alpha_composite(soft(lay))
    out.save(f"{OUT}/zone.png")


def sync_block():
    """Readable shared-experience block, left side over sky, plus viewer
    dots handled in-shot."""
    img = canvas()
    lay = canvas()
    d = ImageDraw.Draw(lay)
    x0, y0 = 128, 120
    for i in range(2):
        d.ellipse((x0 + i * 24, y0 + 10, x0 + 13 + i * 24, y0 + 23),
                  fill=(*WHITE, 250))
    tracked(d, (x0 + 66, y0), "SHARED EXPERIENCE", font("semi", 34), WHITE,
            tracking=4)
    tracked(d, (x0, y0 + 52), "2 viewers synchronized", font("med", 25),
            (*WHITE, 235), tracking=1)
    img.alpha_composite(soft(lay))
    img.save(f"{OUT}/sync.png")


def falls_map():
    s = SS
    img = Image.new("RGBA", (W * s, H * s), (13, 16, 21, 255))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((300 * s, 120 * s, 1620 * s, 952 * s), radius=36 * s,
                        fill=(26, 32, 40, 255))
    pts = [(690, 1010), (700, 870), (760, 740), (860, 640), (940, 560),
           (990, 470), (1010, 380), (1060, 270), (1140, 160), (1180, 60)]
    for wpx, col in [(64, (44, 58, 74, 255)), (48, (74, 100, 128, 255))]:
        d.line([(x * s, y * s) for x, y in pts], fill=col, width=wpx * s,
               joint="curve")
    for (fx, fy, fl) in [(952, 545, 36), (975, 512, 32), (995, 483, 28)]:
        d.line([((fx - fl) * s, fy * s), ((fx + fl) * s, fy * s)],
               fill=(235, 242, 248, 255), width=3 * s)
    route = [(760, 900), (820, 800), (900, 700), (960, 640), (1010, 590),
             (1080, 540), (1140, 470), (1160, 400), (1120, 330)]
    for i in range(len(route) - 1):
        x0, y0 = route[i]
        x1, y1 = route[i + 1]
        n = 7
        for k in range(0, n, 2):
            xa, ya = x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n
            xb, yb = x0 + (x1 - x0) * (k + 1) / n, y0 + (y1 - y0) * (k + 1) / n
            d.line([(xa * s, ya * s), (xb * s, yb * s)],
                   fill=(255, 255, 255, 235), width=int(2.6 * s))
    img = img.resize((W, H), Image.LANCZOS)

    lay = canvas()
    d2 = ImageDraw.Draw(lay)
    tracked(d2, (96, 92), "FALLS PARK BETA", font("semi", 48), WHITE,
            tracking=6)
    tracked(d2, (96, 158), "0.9 MILE EXPERIENCE LOOP — 5 LOCATIONS",
            font("med", 25), (*WHITE, 235), tracking=4)
    NODES = [
        (760, 900, "ARRIVAL"),
        (900, 700, "DAKOTA LIFE"),
        (975, 585, "GLACIAL EDGE"),
        (1085, 528, "QUEEN BEE MILL"),
        (1135, 385, "SETTLEMENT"),
    ]
    for x, y, label in NODES:
        d2.ellipse((x - 16, y - 16, x + 16, y + 16), outline=(*WHITE, 250),
                   width=3)
        d2.ellipse((x - 4, y - 4, x + 4, y + 4), fill=(*WHITE, 250))
        tracked(d2, (x + 34, y - 17), label, font("semi", 27), WHITE,
                tracking=3)
    tracked(d2, (96, 962), "OFFLINE OPERATION — NO PARK INFRASTRUCTURE REQUIRED",
            font("med", 23), (*WHITE, 215), tracking=4)
    out = Image.new("RGBA", (W, H), (13, 16, 21, 255))
    out.alpha_composite(img)
    out.alpha_composite(lay)
    out.convert("RGB").save(f"{OUT}/map.png")


def schematic_lines():
    """Hairline-only schematic (no text) used as a brief intro layer."""
    s = SS
    img = Image.new("RGBA", (W * s, H * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    w2 = int(2.4 * s)
    cx, cy = 960 * s, 560 * s
    lw, lh = 310 * s, 205 * s
    gap = 48 * s
    for sx in (-1, 1):
        x0 = cx + (gap // 2 if sx > 0 else -lw - gap // 2)
        d.rounded_rectangle((x0, cy - lh // 2, x0 + lw, cy + lh // 2),
                            radius=int(60 * s), outline=(255, 255, 255, 200),
                            width=w2)
    d.arc((cx - gap, cy - lh // 2 - 8 * s, cx + gap, cy - lh // 2 + 46 * s),
          200, 340, fill=(255, 255, 255, 200), width=w2)
    for sx in (-1, 1):
        hx = cx + sx * (lw + gap // 2)
        d.line([(hx, cy - lh // 2 + 28 * s),
                (hx + sx * 60 * s, cy - lh // 2 + 14 * s)],
               fill=(255, 255, 255, 200), width=w2)
    img.resize((W, H), Image.LANCZOS).save(f"{OUT}/schematic.png")


def product_title():
    img = canvas()
    d = ImageDraw.Draw(img)
    tracked(d, (0, 138), "Everyday AR glasses", font("semi", 60), WHITE,
            tracking=1, anchor_center_x=W / 2)
    tracked(d, (0, 226), "SELF-CONTAINED  ·  OFFLINE  ·  NO PHONE",
            font("med", 24), (*WHITE, 230), tracking=6, anchor_center_x=W / 2)
    img.save(f"{OUT}/product_title.png")


def product_callouts():
    """Four separate callout overlays anchored around the hero glasses
    (hero drawn at ~1000px wide, center 960x585)."""
    items = [
        ("callout_1", "LOCATION AWARE", 585, 520, 500, 392, "right"),
        ("callout_2", "ON-DEVICE COMPUTE", 1340, 520, 1408, 392, "left"),
        ("callout_3", "SPATIAL AUDIO", 1300, 640, 1470, 756, "left"),
        ("callout_4", "SELF-CONTAINED", 620, 645, 360, 760, "right"),
    ]
    for name, text, px, py, tx, ty, side in items:
        img = canvas()
        d = ImageDraw.Draw(img)
        d.ellipse((px - 5, py - 5, px + 5, py + 5), fill=(*WHITE, 245))
        d.line([(px, py), (tx, ty)], fill=(255, 255, 255, 170), width=2)
        f = font("semi", 28)
        wdt = sum(d.textbbox((0, 0), c, font=f)[2] for c in text) + 4 * (len(text) - 1)
        lx = tx - wdt - 14 if side == "right" else tx + 14
        tracked(d, (lx, ty - 16), text, f, WHITE, tracking=4)
        img.save(f"{OUT}/{name}.png")


def wordmark():
    img = canvas()
    d = ImageDraw.Draw(img)
    tracked(d, (0, 430), "OPEN RANGE INTERACTIVE", font("semi", 92), WHITE,
            tracking=12, anchor_center_x=W / 2)
    d.line([(W / 2 - 260, 578), (W / 2 + 260, 578)],
           fill=(255, 255, 255, 170), width=2)
    img.save(f"{OUT}/wordmark.png")


def tagline():
    img = canvas()
    d = ImageDraw.Draw(img)
    tracked(d, (0, 616), "The past, anchored to place.", font("med", 44),
            (*WHITE, 245), tracking=2, anchor_center_x=W / 2)
    img.save(f"{OUT}/tagline.png")


def end_micro():
    img = canvas()
    d = ImageDraw.Draw(img)
    tracked(d, (0, 924), "FALLS PARK BETA — SIOUX FALLS, SOUTH DAKOTA",
            font("med", 24), (176, 184, 192, 245), tracking=6,
            anchor_center_x=W / 2)
    img.save(f"{OUT}/end_micro.png")


def glasses_hero_plate():
    """Supplied photoreal glasses centered on the dark stage, subtle
    floor reflection."""
    hero = Image.open("trailer/assets_v3/glasses_hero.png").convert("RGBA")
    target_w = 1010
    hero = hero.resize((target_w, int(hero.height * target_w / hero.width)),
                       Image.LANCZOS)
    img = canvas()
    x = (W - hero.width) // 2
    y = 585 - hero.height // 2
    refl = hero.transpose(Image.FLIP_TOP_BOTTOM)
    fade = np.linspace(70, 0, refl.height).astype(np.uint8)
    ra = np.asarray(refl.split()[3]).astype(np.uint16)
    ra = (ra * fade[:, None] // 255).astype(np.uint8)
    refl.putalpha(Image.fromarray(ra, "L"))
    refl = refl.filter(ImageFilter.GaussianBlur(3))
    img.alpha_composite(refl, (x, y + hero.height + 8))
    img.alpha_composite(hero, (x, y))
    img.save(f"{OUT}/glasses_plate.png")


if __name__ == "__main__":
    hook_title()
    locality()
    era_label("era_dakota", "DAKOTA ENCAMPMENT", "The falls, before 1856")
    era_label("era_1873", "SETTLEMENT ERA — 1873", "A city rises in a decade")
    era_label("era_ice", "GLACIAL EDGE", "12,000 years before present")
    anchor_pin("pin_mill", "Queen Bee Mill", "Built 1881 · ruins ahead",
               700, 420)
    zone()
    sync_block()
    falls_map()
    schematic_lines()
    product_title()
    product_callouts()
    wordmark()
    tagline()
    end_micro()
    glasses_hero_plate()
    print("ui v3 done")
