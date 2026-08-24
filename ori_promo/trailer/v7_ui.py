#!/usr/bin/env python3
"""r03 UI. Fixes r02's readability notes (zone traces too faint, hook
undersized, callouts illegible, brand card too diffuse) and adds the new
Falls Park beta route-map beat — drawn graphically, no photo, no AI."""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFilter
import numpy as np

sys.path.insert(0, "trailer")
from ui_kit import W, H, SS, font, canvas, WHITE
from v5_ui import text, soft, local_grad, _path_samples, ZONE_PATH
from v6_ui import WALK_PATH

OUT = "trailer/ui7"
os.makedirs(OUT, exist_ok=True)
FPS = 30


# ---------------------------------------------------------------- helpers
def stroked_trace(path, name, dash=7, dot=3.4, alpha=236, under=3.1):
    """r02: 'thicken the trace, raise contrast'. A dark under-stroke keeps
    the boundary readable over sunlit grass."""
    s = SS
    samples = _path_samples(path, 620)
    dark = Image.new("RGBA", (W * s, H * s), (0, 0, 0, 0))
    dd = ImageDraw.Draw(dark)
    for i, (x, y) in enumerate(samples):
        if (i // dash) % 2 == 0:
            dd.ellipse((x * s - under * s, y * s - under * s,
                        x * s + under * s, y * s + under * s),
                       fill=(6, 10, 14, 190))
    dark = dark.resize((W, H), Image.LANCZOS).filter(
        ImageFilter.GaussianBlur(2.2))
    img = Image.new("RGBA", (W * s, H * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for i, (x, y) in enumerate(samples):
        if (i // dash) % 2 == 0:
            d.ellipse((x * s - dot * s, y * s - dot * s,
                       x * s + dot * s, y * s + dot * s),
                      fill=(255, 253, 247, alpha))
    img = img.resize((W, H), Image.LANCZOS).filter(
        ImageFilter.GaussianBlur(0.5))
    out = canvas()
    out.alpha_composite(dark)
    out.alpha_composite(img)
    out.save(f"{OUT}/{name}.png")


def label(name, s_, size, center, y, scrim=None):
    img = canvas()
    if scrim:
        local_grad(img, *scrim)
    lay = canvas()
    d = ImageDraw.Draw(lay)
    text(d, (0, y), s_, font("semi", size), center=center)
    img.alpha_composite(soft(lay, blur=11, alpha=222))
    img.save(f"{OUT}/{name}.png")


# ------------------------------------------------------------ act 1 fixes
def hook():
    """r02: undersized against busy white water; localized scrim."""
    img = canvas()
    local_grad(img, 40, 520, 1240, 1040, 178)
    lay = canvas()
    d = ImageDraw.Draw(lay)
    text(d, (120, 632), "HISTORY,", font("semi", 106))
    text(d, (120, 758), "WHERE IT HAPPENED.", font("semi", 106))
    img.alpha_composite(soft(lay, blur=13))
    img.save(f"{OUT}/hook.png")


def mill_dot():
    """r02: the anchor dot must survive a normal laptop view."""
    s = SS
    ax, ay = 700, 420
    img = Image.new("RGBA", (W * s, H * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((ax * s - 9 * s, ay * s - 9 * s, ax * s + 9 * s, ay * s + 9 * s),
              fill=(*WHITE, 255))
    d.ellipse((ax * s - 24 * s, ay * s - 24 * s,
               ax * s + 24 * s, ay * s + 24 * s),
              outline=(*WHITE, 240), width=3 * s)
    d.line([(ax * s, (ay + 24) * s), (ax * s, (ay + 96) * s)],
           fill=(255, 255, 255, 210), width=2 * s)
    img = img.resize((W, H), Image.LANCZOS)
    out = canvas()
    out.alpha_composite(soft(img, blur=7, alpha=150))
    lay = canvas()
    d = ImageDraw.Draw(lay)
    text(d, (0, 528), "QUEEN BEE MILL", font("semi", 38), center=700)
    out.alpha_composite(soft(lay, blur=10, alpha=215))
    out.save(f"{OUT}/mill_dot.png")


# --------------------------------------------------------------- the map
RIVER = [(120, 980), (430, 880), (760, 760), (1060, 620), (1370, 470),
         (1720, 330), (1900, 286)]
ROUTE = [(330, 1042), (600, 962), (880, 868), (1078, 762), (1300, 640),
         (1536, 528), (1720, 456)]
NODES = [(0.20, "DAKOTA LIFE", -1), (0.54, "QUEEN BEE MILL", 1),
         (0.86, "GLACIAL EDGE", -1)]


def _curve(pts, n=460):
    """Smooth a polyline by repeated midpoint refinement."""
    cur = list(pts)
    for _ in range(4):
        nxt = [cur[0]]
        for a, b in zip(cur, cur[1:]):
            nxt.append(((a[0] * 3 + b[0]) / 4, (a[1] * 3 + b[1]) / 4))
            nxt.append(((a[0] + b[0] * 3) / 4, (a[1] + b[1] * 3) / 4))
        nxt.append(cur[-1])
        cur = nxt
    idx = np.linspace(0, len(cur) - 1, n).astype(int)
    return [cur[i] for i in idx]


def map_base():
    """A drawn site plan: river ribbon, falls mark, ground tone. No photo."""
    bg = np.zeros((H, W, 3), np.float32)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    r = np.sqrt(((xx - W * .5) / (W * .70)) ** 2 + ((yy - H * .5) / (H * .78)) ** 2)
    v = np.clip(30 - r * 24, 6, 30)
    bg[..., 0] = v * .92
    bg[..., 1] = v
    bg[..., 2] = v * 1.14
    img = Image.fromarray(bg.astype(np.uint8)).convert("RGBA")

    # park landmass + contour bands, so the field reads as a site plan
    land = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dl = ImageDraw.Draw(land)
    rpts = _curve(RIVER)
    for band, (off, al) in enumerate(((120, 26), (250, 18), (400, 12))):
        pl = [(x + off * 0.35, y + off) for x, y in rpts]
        pl += [(x - off * 0.35, y - off) for x, y in reversed(rpts)]
        dl.polygon(pl, outline=(150, 170, 188, al))
    land = land.filter(ImageFilter.GaussianBlur(2.0))
    img.alpha_composite(land)

    riv = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(riv)
    pts = _curve(RIVER)
    for i, (x, y) in enumerate(pts):
        w = 46 - 26 * (i / len(pts))
        d.ellipse((x - w, y - w * .5, x + w, y + w * .5),
                  fill=(96, 130, 158, 205))
    riv = riv.filter(ImageFilter.GaussianBlur(9))
    img.alpha_composite(riv)

    # the falls: a short bright break across the river
    fl = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(fl)
    fx, fy = pts[int(len(pts) * .52)]
    for k in range(-4, 5):
        d.line([(fx - 62, fy + k * 8 + 14), (fx + 62, fy + k * 8 - 14)],
               fill=(214, 230, 242, 178), width=3)
    img.alpha_composite(fl.filter(ImageFilter.GaussianBlur(1.4)))
    lab = canvas()
    dl = ImageDraw.Draw(lab)
    text(dl, (0, fy - 118), "THE FALLS", font("semi", 40),
         (206, 220, 232, 236), center=fx)
    img.alpha_composite(soft(lab, blur=9, alpha=170))
    img.convert("RGB").save(f"{OUT}/map_base.png")


def map_seq(dur=9.5):
    """Route draws 1.2-4.5s, nodes land, each pulses once 4.5-7.5s."""
    os.makedirs(f"{OUT}/mseq", exist_ok=True)
    pts = _curve(ROUTE)
    n = len(pts)
    fs = font("semi", 34)
    frames = int(dur * FPS)
    for f in range(frames):
        t = f / FPS
        img = canvas()
        d = ImageDraw.Draw(img)
        # progressive route
        prog = 0.0 if t < 0.7 else min((t - 0.7) / 3.4, 1.0)
        upto = int(prog * n)
        ghost = int(min(t / 0.6, 1.0) * 62)
        for i in range(0, n, 2):          # the planned route, dim
            x, y = pts[i]
            d.ellipse((x - 2, y - 2, x + 2, y + 2),
                      fill=(255, 253, 247, ghost))
        for i in range(upto):             # the drawn route, bright
            x, y = pts[i]
            a = 240 if i > upto - 26 else 208
            d.ellipse((x - 3.4, y - 3.4, x + 3.4, y + 3.4),
                      fill=(255, 253, 247, a))
        # nodes
        for k, (frac, name, side) in enumerate(NODES):
            if prog < frac:
                continue
            x, y = pts[int(frac * (n - 1))]
            appear = min((prog - frac) * 6, 1.0)
            rr = 9 * appear
            d.ellipse((x - rr, y - rr, x + rr, y + rr),
                      fill=(255, 253, 247, int(250 * appear)))
            d.ellipse((x - rr * 2.4, y - rr * 2.4, x + rr * 2.4, y + rr * 2.4),
                      outline=(255, 253, 247, int(200 * appear)), width=2)
            # one pulse, staggered per node
            pt0 = 4.5 + k * 0.85
            if pt0 <= t < pt0 + 1.15:
                p = (t - pt0) / 1.15
                pr = 22 + p * 118
                d.ellipse((x - pr, y - pr * .62, x + pr, y + pr * .62),
                          outline=(255, 253, 247, int(190 * (1 - p))), width=3)
            # label after its pulse starts
            if t >= pt0 - 0.1:
                la = min((t - (pt0 - 0.1)) * 3.2, 1.0)
                tw = d.textlength(name, font=fs)
                lx = x - tw - 40 if side < 0 else x + 40
                ly = y - 20
                d.line([(x + (-26 if side < 0 else 26), y),
                        (lx + (tw + 12 if side < 0 else -12), ly + 18)],
                       fill=(255, 255, 255, int(150 * la)), width=2)
                d.text((lx, ly), name, font=fs,
                       fill=(255, 255, 255, int(248 * la)))
        img.save(f"{OUT}/mseq/{f:04d}.png")
    print("map frames", frames)


# --------------------------------------------------------- product + end
def product_bits():
    """r02: two large sequential claims instead of three tiny ones."""
    for name, s_, y in (("p1", "SELF-CONTAINED", 858), ("p2", "LOCATION-AWARE", 858)):
        img = canvas()
        lay = canvas()
        d = ImageDraw.Draw(lay)
        text(d, (0, y), s_, font("semi", 54), center=W / 2)
        img.alpha_composite(soft(lay, blur=12, alpha=224))
        img.save(f"{OUT}/{name}.png")


def sync_pulse():
    """r02: proof of sync in screen space, not head-tracked markers."""
    os.makedirs(f"{OUT}/spulse", exist_ok=True)
    for f in range(26):
        p = f / 25
        img = canvas()
        d = ImageDraw.Draw(img)
        for cx in (742, 1178):
            rr = 16 + p * 96
            d.ellipse((cx - rr, 300 - rr * .5, cx + rr, 300 + rr * .5),
                      outline=(255, 253, 247, int(210 * (1 - p))), width=3)
        d.line([(742, 300), (1178, 300)],
               fill=(255, 253, 247, int(150 * min(p * 2, 1) * (1 - p))), width=2)
        img.save(f"{OUT}/spulse/{f:04d}.png")


def endcard():
    """r02: one consolidated card, beta line readable for 2s+."""
    img = canvas()
    d = ImageDraw.Draw(img)
    text(d, (0, 352), "OPEN RANGE", font("semi", 124), center=W / 2)
    text(d, (0, 498), "INTERACTIVE", font("semi", 124), center=W / 2)
    text(d, (0, 690), "The past, anchored to place.", font("med", 44),
         (228, 234, 240, 250), center=W / 2)
    text(d, (0, 806), "Falls Park Beta  ·  Sioux Falls, SD", font("med", 32),
         (176, 184, 192, 246), center=W / 2)
    img.save(f"{OUT}/endcard.png")


if __name__ == "__main__":
    hook()
    mill_dot()
    stroked_trace(ZONE_PATH, "zone1_trace")
    stroked_trace(WALK_PATH, "zone2_trace", dash=8, dot=4.0, under=3.6)
    label("zone1_label", "EXPERIENCE READY", 46, 1080, 726)
    label("zone2_label", "EXPERIENCE ZONE", 48, 700, 862)
    label("map_title", "FALLS PARK BETA", 56, W / 2, 128)
    label("map_final", "ONE PARK.  MULTIPLE TIME LAYERS.", 52, W / 2, 116)
    map_base()
    map_seq()
    product_bits()
    sync_pulse()
    endcard()
    print("v7 ui done")
