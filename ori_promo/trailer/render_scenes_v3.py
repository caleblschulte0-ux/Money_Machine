#!/usr/bin/env python3
"""v3 scene sequences — supplied individual assets only.

Compositing rules per the direction notes:
- perspective-derived scale from each plate's px/m ladder
- fore/mid/background staging, few elements
- directional contact shadows matching the plate sun (upper-left ->
  shadows offset screen-right)
- atmospheric wash increasing with depth
- AR activation = anchor dot, then a 0.42s left-to-right depth-scan
  reveal with a soft bright leading edge; the element resolves FULLY
  OPAQUE and then holds still (no cardboard bobbing)
- fire flickers in brightness only; the mammoth breathes at ~1px
"""
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
import numpy as np
import math
import os

W, H = 1920, 1080
FPS = 30
A = "trailer/assets_v3"
rng = np.random.default_rng(9)


def load(path, desat=1.0, bright=1.0, blur=0.5):
    im = Image.open(path).convert("RGBA")
    r, g, b, a = im.split()
    rgb = Image.merge("RGB", (r, g, b))
    if desat != 1.0:
        rgb = ImageEnhance.Color(rgb).enhance(desat)
    if bright != 1.0:
        rgb = ImageEnhance.Brightness(rgb).enhance(bright)
    out = Image.merge("RGBA", (*rgb.split(), a))
    if blur:
        out = out.filter(ImageFilter.GaussianBlur(blur))
    return out


def wash(el, amount, color=(233, 240, 246)):
    hz = Image.new("RGBA", el.size, (*color, 0))
    hz.putalpha(el.split()[3].point(lambda p: int(p * amount)))
    out = el.copy()
    out.alpha_composite(hz)
    return out


class El:
    def __init__(self, img, cx, ground, h, reveal=1.5, motion=None,
                 shadow=0.88, shadow_alpha=85, depth_blur=0.0):
        w = int(img.width * h / img.height)
        self.im = img.resize((w, h), Image.LANCZOS)
        if depth_blur:
            self.im = self.im.filter(ImageFilter.GaussianBlur(depth_blur))
        self.cx, self.ground, self.h = cx, ground, h
        self.reveal = reveal
        self.motion = motion
        self.shadow, self.shadow_alpha = shadow, shadow_alpha
        self._shadow_img = self._make_shadow()

    def _make_shadow(self):
        if self.shadow <= 0:
            return None
        sw = int(self.im.width * self.shadow)
        sh = max(int(sw * 0.115), 12)
        e = Image.new("RGBA", (sw + 70, sh + 70), (0, 0, 0, 0))
        # directional: offset ellipse toward screen-right (sun upper-left)
        ImageDraw.Draw(e).ellipse((35, 35, 35 + sw, 35 + sh),
                                  fill=(14, 12, 8, self.shadow_alpha))
        e = e.filter(ImageFilter.GaussianBlur(14))
        return e

    def draw(self, frame, t):
        r0 = self.reveal
        # pre-reveal anchor dot
        if r0 - 0.45 <= t < r0:
            a = int(230 * (t - (r0 - 0.45)) / 0.45)
            d = ImageDraw.Draw(frame)
            d.ellipse((self.cx - 5, self.ground - 5,
                       self.cx + 5, self.ground + 5), fill=(250, 251, 252, a))
            return
        if t < r0:
            return
        prog = min((t - r0) / 0.42, 1.0)
        im = self.im
        dy = 0
        if self.motion == "breathe" and prog >= 1.0:
            dy = 1.2 * math.sin(2 * math.pi * 0.1 * t)
        x0 = self.cx - im.width // 2
        y0 = int(self.ground - im.height + dy)
        # shadow tracks reveal
        if self._shadow_img is not None:
            sh = self._shadow_img
            if prog < 1.0:
                sh = sh.copy()
                sh.putalpha(sh.split()[3].point(lambda p: int(p * prog)))
            frame.alpha_composite(
                sh, (self.cx - sh.width // 2 + int(self.im.height * 0.055),
                     self.ground - sh.height // 2))
        if prog >= 1.0:
            frame.alpha_composite(im, (x0, y0))
            return
        # depth-scan reveal: left -> right hard mask + bright leading edge
        vis_w = max(int(im.width * prog), 1)
        part = im.crop((0, 0, vis_w, im.height))
        frame.alpha_composite(part, (x0, y0))
        edge_w = 18
        ex = min(vis_w, im.width - 1)
        strip = im.crop((max(ex - edge_w, 0), 0, ex, im.height))
        glow = Image.new("RGBA", strip.size, (255, 255, 255, 0))
        ga = strip.split()[3].point(lambda p: int(p * 0.33))
        glow.putalpha(ga)
        frame.alpha_composite(glow, (x0 + max(ex - edge_w, 0), y0))


def render(outdir, els, dur, fire=None, occluder=None):
    os.makedirs(outdir, exist_ok=True)
    n = int(dur * FPS)
    fl = rng.normal(0, 1, n + 8)
    fl = np.convolve(fl, np.ones(7) / 7, mode="same")
    fl = 1.0 + 0.15 * fl / max(abs(fl).max(), 1e-6)
    for f in range(n):
        t = f / FPS
        frame = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        for el in els:
            el.draw(frame, t)
        if fire is not None:
            el, gx, gy = fire
            r0 = el.reveal
            if t >= r0:
                prog = min((t - r0) / 0.42, 1.0)
                b = ImageEnhance.Brightness(el.im).enhance(float(fl[f]))
                if prog < 1.0:
                    vis = max(int(b.width * prog), 1)
                    b = b.crop((0, 0, vis, b.height))
                else:
                    glow = Image.new("RGBA", (460, 250), (0, 0, 0, 0))
                    gd = ImageDraw.Draw(glow)
                    ga = int(40 * fl[f])
                    for r, aa in [(210, ga // 2), (150, ga), (95, int(ga * 1.4))]:
                        gd.ellipse((230 - r, 125 - r // 2, 230 + r, 125 + r // 2),
                                   fill=(255, 172, 84, aa))
                    glow = glow.filter(ImageFilter.GaussianBlur(24))
                    frame.alpha_composite(glow, (gx - 230, gy - 125))
                frame.alpha_composite(b, (el.cx - el.im.width // 2,
                                          el.ground - el.im.height))
        if occluder is not None:
            frame.alpha_composite(occluder)
        frame.save(f"{outdir}/{f:04d}.png")
    print(outdir, n, "frames")


def ruins_occluder():
    plate = Image.open("work/pioneer_base.png").convert("RGBA")
    mask = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(mask)
    d.polygon([(1352, 908), (1360, 800), (1452, 758), (1600, 742),
               (1782, 758), (1856, 800), (1860, 908), (1352, 908)], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(3))
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    out.paste(plate, (0, 0), mask)
    return out


def dakota(dur=8.0):
    """6808 plate ladder: 1m ~ 46px @ y650, ~92px @ y860, ~165px @ y1030.
    Four elements, three depth planes."""
    trio = wash(load(f"{A}/tipi_trio.png"), 0.16)
    big = wash(load(f"{A}/tipi_big.png"), 0.08)
    woman = wash(load(f"{A}/dakota_woman.png"), 0.05)
    crouch = load(f"{A}/dakota_crouch.png")
    els = [
        El(trio, 285, 700, 175, reveal=1.5, shadow=0.62, shadow_alpha=26,
           depth_blur=0.7),
        El(big, 1495, 762, 300, reveal=1.2, shadow=0.66, shadow_alpha=34,
           depth_blur=0.4),
        El(woman, 1070, 856, 152, reveal=1.9, shadow=0.7, shadow_alpha=50),
        El(crouch, 640, 985, 158, reveal=2.3, shadow_alpha=80),
    ]
    render("trailer/seq/dakota", els, dur)


def settlement(dur=8.0):
    """6805 ladder: 1m ~ 70px @ y650, ~138px @ y880, ~175px @ y990."""
    wagon = load(f"{A}/wagon.png")
    oxen = wash(load(f"{A}/oxen.png"), 0.07)
    woman = load(f"{A}/settler_woman.png")
    man = load(f"{A}/settler_man.png")
    fire = load(f"{A}/campfire.png", blur=0.4)
    els = [
        El(wagon, 1520, 878, 360, reveal=1.3, shadow=0.75, shadow_alpha=42),
        El(oxen, 1150, 802, 178, reveal=1.7, shadow=0.8, shadow_alpha=44,
           depth_blur=0.4),
        El(woman, 1320, 858, 216, reveal=2.1, shadow_alpha=70),
        El(man, 690, 992, 312, reveal=1.9, shadow_alpha=85),
    ]
    f_el = El(fire, 900, 1008, 140, reveal=2.4, shadow=0.0)
    render("trailer/seq/settlement", els, dur, fire=(f_el, 900, 985),
           occluder=ruins_occluder())


def ice(dur=10.0):
    """Frozen 6682. Hero mammoth near-foreground left (1m ~ 155px there),
    sabertooth far on the right shelf (~62px/m). Snow drifts baked over
    the mammoth's feet so the ground claims it."""
    mam = load(f"{A}/mammoth.png", desat=0.9, bright=0.97)
    saber = wash(load(f"{A}/sabertooth.png", desat=0.85, bright=0.9), 0.22)

    mam_el = El(mam, 470, 1042, 540, reveal=5.0, motion="breathe",
                shadow=0.8, shadow_alpha=60)
    # snow drifts over the feet: painted onto the element itself
    im = mam_el.im.copy()
    d = ImageDraw.Draw(im)
    wI, hI = im.size
    for (fx, fy, rw, rh) in [(0.18, 0.985, 0.16, 0.045), (0.44, 0.995, 0.20, 0.04),
                             (0.74, 0.985, 0.17, 0.05)]:
        box = (int(wI * (fx - rw)), int(hI * (fy - rh)),
               int(wI * (fx + rw)), int(hI * (fy + rh)))
        d.ellipse(box, fill=(238, 244, 250, 205))
    mam_el.im = im.filter(ImageFilter.GaussianBlur(0.6))

    saber_el = El(saber, 1620, 618, 76, reveal=7.2, shadow_alpha=30,
                  depth_blur=0.6)
    render("trailer/seq/ice", [mam_el, saber_el], dur)


if __name__ == "__main__":
    dakota()
    settlement()
    ice()
    print("v3 scenes rendered")
