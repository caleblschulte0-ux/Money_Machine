#!/usr/bin/env python3
"""Minimal spatial UI kit for the ORI trailer — Inter typography,
restrained Vision-Pro-adjacent design. Everything renders at 4x and
downsamples so hairlines stay crisp."""
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import math
import os

W, H = 1920, 1080
SS = 2  # supersample factor for hairline work
F = "fonts/inter/extras/ttf"
INTER = {
    "light": f"{F}/Inter-Light.ttf",
    "reg": f"{F}/Inter-Regular.ttf",
    "med": f"{F}/Inter-Medium.ttf",
    "semi": f"{F}/Inter-SemiBold.ttf",
    "disp": f"{F}/InterDisplay-Light.ttf",
}
WHITE = (250, 251, 252)
GREY = (196, 203, 209)
OUT = "trailer/ui"
os.makedirs(OUT, exist_ok=True)


def font(kind, size):
    return ImageFont.truetype(INTER[kind], size)


def tracked(d, pos, s, f, fill, tracking=0, anchor_center_x=None):
    if anchor_center_x is not None:
        wdt = sum(d.textbbox((0, 0), c, font=f)[2] for c in s) + tracking * (len(s) - 1)
        x = anchor_center_x - wdt / 2
    else:
        x = pos[0]
    y = pos[1]
    for ch in s:
        d.text((x, y), ch, font=f, fill=fill)
        x += d.textbbox((0, 0), ch, font=f)[2] + tracking


def soft(img, blur=7, alpha=165):
    """Small soft shadow behind UI so it reads on bright footage."""
    a = img.split()[3].point(lambda p: min(p, alpha))
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sh.paste(Image.new("RGBA", img.size, (8, 10, 12, 255)), (0, 0), a)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.alpha_composite(sh, (0, 2))
    out.alpha_composite(img)
    return out


def canvas():
    return Image.new("RGBA", (W, H), (0, 0, 0, 0))


# ---------- text overlays ----------

def locality(fname):
    img = canvas()
    lay = canvas()
    d = ImageDraw.Draw(lay)
    tracked(d, (96, 964), "FALLS PARK", font("med", 26), WHITE, tracking=6)
    tracked(d, (96, 1000), "SIOUX FALLS, SOUTH DAKOTA", font("reg", 19),
            (*GREY, 235), tracking=5)
    img.alpha_composite(soft(lay))
    img.save(fname)


def hook_title(fname):
    img = canvas()
    lay = canvas()
    d = ImageDraw.Draw(lay)
    tracked(d, (0, 682), "History, where it happened.", font("light", 64),
            WHITE, tracking=1, anchor_center_x=W / 2)
    img.alpha_composite(soft(lay, blur=9, alpha=200))
    img.save(fname)


def era_label(fname, line1, line2):
    img = canvas()
    lay = canvas()
    d = ImageDraw.Draw(lay)
    d.line([(W / 2 - 30, 918), (W / 2 + 30, 918)], fill=(*WHITE, 210), width=2)
    tracked(d, (0, 934), line1, font("med", 30), WHITE, tracking=3,
            anchor_center_x=W / 2)
    tracked(d, (0, 978), line2, font("reg", 21), (*GREY, 230), tracking=4,
            anchor_center_x=W / 2)
    img.alpha_composite(soft(lay))
    img.save(fname)


def anchor_label(fname, title, sub, ax, ay, label_dx=36, label_dy=-96):
    """Small dot + ring + hairline leader + two-line label. No panel."""
    s = SS
    img = Image.new("RGBA", (W * s, H * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    axs, ays = ax * s, ay * s
    d.ellipse((axs - 5 * s, ays - 5 * s, axs + 5 * s, ays + 5 * s),
              fill=(*WHITE, 245))
    d.ellipse((axs - 14 * s, ays - 14 * s, axs + 14 * s, ays + 14 * s),
              outline=(*WHITE, 190), width=int(1.4 * s))
    lx, ly = axs + label_dx * s, ays + label_dy * s
    d.line([(axs, ays - 15 * s), (axs, ly + 58 * s)], fill=(*WHITE, 160),
           width=int(1.2 * s))
    d.line([(axs, ly + 58 * s), (lx - 8 * s, ly + 58 * s)], fill=(*WHITE, 160),
           width=int(1.2 * s))
    img = img.resize((W, H), Image.LANCZOS)
    lay = canvas()
    d2 = ImageDraw.Draw(lay)
    tracked(d2, (ax + label_dx, ay + label_dy), title, font("semi", 36), WHITE,
            tracking=1)
    tracked(d2, (ax + label_dx, ay + label_dy + 48), sub, font("reg", 25),
            (*GREY, 245), tracking=2)
    out = canvas()
    out.alpha_composite(soft(img, blur=4, alpha=90))
    out.alpha_composite(soft(lay))
    out.save(fname)


def zone(fname, cx=1035, cy=942, rx=330, ry=84):
    """Ground-plane viewing boundary: hairline ellipse + faint fill +
    micro label."""
    s = SS
    img = Image.new("RGBA", (W * s, H * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    box = (s * (cx - rx), s * (cy - ry), s * (cx + rx), s * (cy + ry))
    d.ellipse(box, fill=(255, 255, 255, 26))
    d.ellipse(box, outline=(*WHITE, 240), width=int(2.3 * s))
    inner = (s * (cx - rx * 0.985), s * (cy - ry * 0.985),
             s * (cx + rx * 0.985), s * (cy + ry * 0.985))
    d.ellipse(inner, outline=(255, 255, 255, 60), width=int(3.5 * s))
    img = img.resize((W, H), Image.LANCZOS)
    lay = canvas()
    d2 = ImageDraw.Draw(lay)
    tracked(d2, (0, cy - ry - 70), "VIEWING ZONE", font("semi", 26), WHITE,
            tracking=8, anchor_center_x=cx)
    tracked(d2, (0, cy - ry - 36), "Experience ready", font("reg", 22),
            (*GREY, 235), tracking=2, anchor_center_x=cx)
    out = canvas()
    out.alpha_composite(soft(img, blur=4, alpha=70))
    out.alpha_composite(soft(lay))
    out.save(fname)


def sync_badge(fname):
    img = canvas()
    lay = canvas()
    d = ImageDraw.Draw(lay)
    x0, y0 = 1660, 88
    for i, c in enumerate([(*WHITE, 250), (*WHITE, 250)]):
        d.ellipse((x0 + i * 16, y0 + 6, x0 + 9 + i * 16, y0 + 15), fill=c)
    tracked(d, (x0 + 42, y0 - 2), "2 SYNCED", font("semi", 25), WHITE, tracking=4)
    tracked(d, (x0 - 1, y0 + 32), "Shared experience", font("reg", 20),
            (*GREY, 240), tracking=2)
    img.alpha_composite(soft(lay))
    img.save(fname)


def ring_seq(outdir, frames=28, cx=1035, cy=942, rx0=40, rx1=330, ry_ratio=0.255):
    """Activation pulse: expanding fading ground ellipse."""
    os.makedirs(outdir, exist_ok=True)
    for i in range(frames):
        t = i / (frames - 1)
        e = 1 - (1 - t) ** 3
        rx = rx0 + (rx1 - rx0) * e
        ry = rx * ry_ratio
        a = int(220 * (1 - t))
        s = SS
        img = Image.new("RGBA", (W * s, H * s), (0, 0, 0, 0))
        d = ImageDraw.Draw(img)
        d.ellipse((s * (cx - rx), s * (cy - ry), s * (cx + rx), s * (cy + ry)),
                  outline=(255, 255, 255, a), width=int(2 * s))
        img.resize((W, H), Image.LANCZOS).save(f"{outdir}/{i:04d}.png")


# ---------- product: glasses schematic ----------

def _rounded_lens(d, box, s, width):
    d.rounded_rectangle(box, radius=int(58 * s), outline=(*WHITE, 235),
                        width=width)


def glasses(fname):
    """Hairline technical hero of the glasses: front view + temple
    profile, drawn at 2x. Deliberately schematic — a design language,
    not a fake photo."""
    s = SS
    img = Image.new("RGBA", (W * s, H * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    w2 = int(2.2 * s)

    # front view, centered slightly left
    cx, cy = 860 * s, 470 * s
    lw, lh = 300 * s, 200 * s
    gap = 46 * s
    _rounded_lens(d, (cx - lw - gap // 2, cy - lh // 2, cx - gap // 2, cy + lh // 2), s, w2)
    _rounded_lens(d, (cx + gap // 2, cy - lh // 2, cx + lw + gap // 2, cy + lh // 2), s, w2)
    # bridge
    d.arc((cx - gap, cy - lh // 2 - 8 * s, cx + gap, cy - lh // 2 + 44 * s),
          200, 340, fill=(*WHITE, 235), width=w2)
    # hinges + temple stubs angled back
    for sx in (-1, 1):
        hx = cx + sx * (lw + gap // 2)
        d.line([(hx, cy - lh // 2 + 26 * s), (hx + sx * 58 * s, cy - lh // 2 + 14 * s)],
               fill=(*WHITE, 235), width=w2)
        # micro camera aperture at outer lens corner
        px = cx + sx * (lw + gap // 2 - 34 * s)
        d.ellipse((px - 5 * s, cy - lh // 2 + 24 * s, px + 5 * s,
                   cy - lh // 2 + 34 * s), outline=(*WHITE, 220), width=int(1.4 * s))

    # side profile, lower right — temple arm with battery/compute zone
    ox, oy = 1210 * s, 760 * s
    d.rounded_rectangle((ox, oy, ox + 88 * s, oy + 96 * s), radius=26 * s,
                        outline=(*WHITE, 220), width=w2)
    d.line([(ox + 88 * s, oy + 16 * s), (ox + 430 * s, oy + 26 * s)],
           fill=(*WHITE, 220), width=w2)
    d.line([(ox + 430 * s, oy + 26 * s), (ox + 470 * s, oy + 60 * s)],
           fill=(*WHITE, 220), width=w2)
    # compute zone hatch on temple
    for i in range(5):
        hx = ox + (180 + i * 22) * s
        d.line([(hx, oy + 8 * s), (hx - 10 * s, oy + 32 * s)],
               fill=(255, 255, 255, 120), width=int(1.2 * s))

    img = img.resize((W, H), Image.LANCZOS)

    lay = canvas()
    d2 = ImageDraw.Draw(lay)
    tracked(d2, (0, 150), "Everyday AR glasses", font("disp", 56), WHITE,
            tracking=1, anchor_center_x=W / 2)
    tracked(d2, (0, 226), "SELF-CONTAINED  ·  OFFLINE  ·  NO PHONE",
            font("med", 22), (*GREY, 240), tracking=6, anchor_center_x=W / 2)

    def callout(x, y, tx, ty, s1, s2=None):
        d2.line([(x, y), (tx, ty)], fill=(255, 255, 255, 130), width=1)
        d2.ellipse((x - 3, y - 3, x + 3, y + 3), fill=(*WHITE, 220))
        tracked(d2, (tx + 10, ty - 14), s1, font("med", 21), WHITE, tracking=2)
        if s2:
            tracked(d2, (tx + 10, ty + 14), s2, font("reg", 18), (*GREY, 225),
                    tracking=1)

    callout(788, 396, 520, 330, "Micro camera array", "location awareness")
    callout(1188, 560, 1330, 600, "Open-ear spatial audio")
    callout(1470, 795, 1560, 720, "On-device compute", "runs fully offline")
    callout(628, 566, 420, 660, "Clear prescription-ready lenses")

    out = canvas()
    out.alpha_composite(img)
    out.alpha_composite(lay)
    out.save(fname)


def product_bg(fname):
    """Dark studio gradient for the product + end scenes."""
    import numpy as np
    yy, xx = np.mgrid[0:H, 0:W].astype(float)
    cx, cy = W * 0.5, H * 0.42
    r = np.sqrt(((xx - cx) / (W * 0.75)) ** 2 + ((yy - cy) / (H * 0.8)) ** 2)
    v = np.clip(20 - r * 14, 4, 20)
    img = np.zeros((H, W, 3), dtype="uint8")
    img[..., 0] = v * 0.92
    img[..., 1] = v
    img[..., 2] = v * 1.12
    Image.fromarray(img).save(fname)


# ---------- map ----------

def falls_map(fname):
    s = SS
    img = Image.new("RGBA", (W * s, H * s), (11, 13, 16, 255))
    d = ImageDraw.Draw(img)

    # park area: soft plate
    d.rounded_rectangle((330 * s, 130 * s, 1590 * s, 950 * s), radius=40 * s,
                        fill=(16, 19, 23, 255))
    # river ribbon (Big Sioux, flowing S -> N through the falls)
    pts = [(690, 1010), (700, 870), (760, 740), (860, 640), (940, 560),
           (990, 470), (1010, 380), (1060, 270), (1140, 160), (1180, 60)]
    for wpx, col in [(58, (30, 40, 50, 255)), (44, (42, 58, 72, 255))]:
        d.line([(x * s, y * s) for x, y in pts], fill=col, width=wpx * s,
               joint="curve")
    # falls hatch
    for i, (fx, fy, fl) in enumerate([(952, 545, 34), (975, 512, 30), (995, 483, 26)]):
        d.line([((fx - fl) * s, fy * s), ((fx + fl) * s, fy * s)],
               fill=(225, 235, 242, 235), width=int(2.4 * s))

    # walking route
    route = [(760, 900), (820, 800), (900, 700), (960, 640), (1010, 590),
             (1080, 540), (1140, 470), (1160, 400), (1120, 330)]
    for i in range(len(route) - 1):
        x0, y0 = route[i]
        x1, y1 = route[i + 1]
        n = 7
        for k in range(0, n, 2):
            xa = x0 + (x1 - x0) * k / n
            ya = y0 + (y1 - y0) * k / n
            xb = x0 + (x1 - x0) * (k + 1) / n
            yb = y0 + (y1 - y0) * (k + 1) / n
            d.line([(xa * s, ya * s), (xb * s, yb * s)],
                   fill=(255, 255, 255, 150), width=int(1.6 * s))
    img = img.resize((W, H), Image.LANCZOS)

    lay = canvas()
    d2 = ImageDraw.Draw(lay)
    tracked(d2, (96, 96), "FALLS PARK", font("semi", 40), WHITE, tracking=6)
    tracked(d2, (96, 152), "BETA ROUTE — 5 EXPERIENCES · 0.9 MILE LOOP",
            font("reg", 21), (*GREY, 235), tracking=4)

    NODES = [
        (770, 890, "01", "Arrival — viewing zones"),
        (905, 695, "02", "Dakota encampment"),
        (975, 585, "03", "Falls overlook — glacial edge"),
        (1085, 528, "04", "Queen Bee Mill, 1881"),
        (1135, 385, "05", "City rises — 1873"),
    ]
    for x, y, num, label in NODES:
        d2.ellipse((x - 15, y - 15, x + 15, y + 15), outline=(*WHITE, 230),
                   width=2)
        d2.ellipse((x - 3, y - 3, x + 3, y + 3), fill=(*WHITE, 240))
        tracked(d2, (x + 30, y - 24), num, font("semi", 20), WHITE, tracking=1)
        tracked(d2, (x + 62, y - 22), label, font("reg", 22), (*GREY, 245),
                tracking=1)
    tracked(d2, (96, 966), "OFFLINE OPERATION — NO PARK INFRASTRUCTURE REQUIRED",
            font("med", 19), (*GREY, 210), tracking=4)

    out = Image.new("RGBA", (W, H), (11, 13, 16, 255))
    out.alpha_composite(img)
    out.alpha_composite(lay)
    out.convert("RGB").save(fname)


# ---------- end sequence ----------

def wordmark(fname):
    img = canvas()
    d = ImageDraw.Draw(img)
    tracked(d, (0, 448), "OPEN RANGE INTERACTIVE", font("semi", 74), WHITE,
            tracking=14, anchor_center_x=W / 2)
    d.line([(W / 2 - 210, 570), (W / 2 + 210, 570)], fill=(255, 255, 255, 140),
           width=1)
    img.save(fname)


def tagline(fname):
    img = canvas()
    d = ImageDraw.Draw(img)
    tracked(d, (0, 600), "The past, anchored to place.", font("light", 40),
            (*GREY, 250), tracking=2, anchor_center_x=W / 2)
    img.save(fname)


def end_micro(fname):
    img = canvas()
    d = ImageDraw.Draw(img)
    tracked(d, (0, 930), "FALLS PARK BETA — SIOUX FALLS, SOUTH DAKOTA",
            font("med", 20), (150, 158, 165, 235), tracking=6,
            anchor_center_x=W / 2)
    img.save(fname)


if __name__ == "__main__":
    locality(f"{OUT}/locality.png")
    hook_title(f"{OUT}/hook_title.png")
    era_label(f"{OUT}/era_dakota.png", "DAKOTA ENCAMPMENT",
              "The falls, before 1856")
    era_label(f"{OUT}/era_1873.png", "SETTLEMENT ERA — 1873",
              "A city rises in a decade")
    era_label(f"{OUT}/era_ice.png", "GLACIAL EDGE",
              "12,000 years before present")
    anchor_label(f"{OUT}/pin_mill.png", "Queen Bee Mill", "Built 1881 · ruins ahead",
                 470, 500, label_dx=42, label_dy=-118)
    zone(f"{OUT}/zone.png")
    sync_badge(f"{OUT}/sync.png")
    ring_seq("trailer/ui/ring")
    product_bg(f"{OUT}/product_bg.png")
    glasses(f"{OUT}/glasses.png")
    falls_map(f"{OUT}/map.png")
    wordmark(f"{OUT}/wordmark.png")
    tagline(f"{OUT}/tagline.png")
    end_micro(f"{OUT}/end_micro.png")
    print("ui kit done")
