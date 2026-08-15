#!/usr/bin/env python3
"""Animated overlay sequences for the three historical layers.

Every element is staged individually with computed scale, contact
shadow, phase-offset micro-motion (breathing, sway, fire flicker,
walk drift), atmospheric wash by depth, and — where geometry allows —
occlusion patches cut from the plate itself.
"""
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
import numpy as np
import math
import os

W, H = 1920, 1080
FPS = 30
EL = "trailer/elements"
rng = np.random.default_rng(4)


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


def wash(el, amount, color=(235, 242, 248)):
    hz = Image.new("RGBA", el.size, (*color, 0))
    hz.putalpha(el.split()[3].point(lambda p: int(p * amount)))
    out = el.copy()
    out.alpha_composite(hz)
    return out


class Item:
    def __init__(self, img, cx, ground, h, motion="breath", phase=0.0,
                 flip=False, opacity=1.0, shadow=0.9, shadow_alpha=78,
                 drift=(0, 0)):
        w = int(img.width * h / img.height)
        self.im = img.resize((w, h), Image.LANCZOS)
        if flip:
            self.im = self.im.transpose(Image.FLIP_LEFT_RIGHT)
        if opacity < 1.0:
            self.im.putalpha(self.im.split()[3].point(
                lambda p: int(p * opacity)))
        self.cx, self.ground, self.h = cx, ground, h
        self.motion, self.phase = motion, phase
        self.shadow, self.shadow_alpha = shadow, shadow_alpha
        self.drift = drift  # total px over the whole sequence

    def frame(self, t, dur):
        im = self.im
        w, h = im.size
        dx = self.drift[0] * t / dur
        dy = self.drift[1] * t / dur
        if self.motion == "breath":
            sy = 1 + 0.006 * math.sin(2 * math.pi * 0.22 * t + self.phase)
            im = im.resize((w, max(int(h * sy), 1)))
        elif self.motion == "sway":
            sy = 1 + 0.005 * math.sin(2 * math.pi * 0.19 * t + self.phase)
            ang = 0.5 * math.sin(2 * math.pi * 0.11 * t + self.phase * 1.7)
            im = im.resize((w, max(int(h * sy), 1))).rotate(
                ang, resample=Image.BICUBIC, expand=False)
        elif self.motion == "bob":
            dy += 2.2 * math.sin(2 * math.pi * 0.24 * t + self.phase)
        # "still" -> none
        return im, int(self.cx + dx), int(self.ground + dy)


def shadow_layer(items):
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    for it in items:
        if it.shadow <= 0:
            continue
        sw = int(it.im.width * it.shadow)
        sh = max(int(sw * 0.11), 10)
        e = Image.new("RGBA", (sw + 60, sh + 60), (0, 0, 0, 0))
        ImageDraw.Draw(e).ellipse((30, 30, 30 + sw, 30 + sh),
                                  fill=(12, 10, 6, it.shadow_alpha))
        e = e.filter(ImageFilter.GaussianBlur(10))
        lay.alpha_composite(e, (it.cx - sw // 2 - 30,
                                it.ground - sh // 2 - 30))
    return lay


def render(outdir, items, dur, fire=None, occluder=None):
    """fire: (Item, glow_cx, glow_cy) with flicker; occluder: RGBA patch
    pasted on top of everything (plate geometry that sits nearer)."""
    os.makedirs(outdir, exist_ok=True)
    n = int(dur * FPS)
    shadows = shadow_layer(items + ([fire[0]] if fire else []))
    # smooth flicker curve
    fl = rng.normal(0, 1, n + 8)
    fl = np.convolve(fl, np.ones(7) / 7, mode="same")
    fl = 1.0 + 0.16 * fl / max(abs(fl).max(), 1e-6)
    for f in range(n):
        t = f / FPS
        frame = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        frame.alpha_composite(shadows)
        for it in items:
            im, cx, gy = it.frame(t, dur)
            frame.alpha_composite(im, (cx - im.width // 2, gy - im.height))
        if fire:
            it, gx, gy = fire
            im, cx, g = it.frame(t, dur)
            b = ImageEnhance.Brightness(im).enhance(float(fl[f]))
            # firelight pool flickers with the flames
            glow = Image.new("RGBA", (420, 240), (0, 0, 0, 0))
            gd = ImageDraw.Draw(glow)
            ga = int(46 * fl[f])
            for r, a in [(200, ga // 2), (140, ga), (90, int(ga * 1.5))]:
                gd.ellipse((210 - r, 120 - r // 2, 210 + r, 120 + r // 2),
                           fill=(255, 172, 84, a))
            glow = glow.filter(ImageFilter.GaussianBlur(24))
            frame.alpha_composite(glow, (gx - 210, gy - 120))
            frame.alpha_composite(b, (cx - im.width // 2, g - im.height))
        if occluder is not None:
            frame.alpha_composite(occluder)
        frame.save(f"{outdir}/{f:04d}.png")
    print(outdir, "rendered", n, "frames")


def ruins_occluder():
    """Feathered cut of the stone ruins pile from the settlement plate —
    pasted over the wagon so it sits behind real terrain."""
    plate = Image.open("work/pioneer_base.png").convert("RGBA")
    mask = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(mask)
    d.polygon([(1352, 908), (1360, 800), (1452, 758), (1600, 742),
               (1782, 758), (1856, 800), (1860, 908), (1352, 908)], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(3))
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    out.paste(plate, (0, 0), mask)
    return out


def scene_settlement(dur=8.0):
    """6805 @ 27s plate. Anchors: ~70px/m at y 650, ~165px/m at y 950.
    Camp distributed: fire circle mid-left, wagon+man right partially
    behind the ruins pile, woman walking between."""
    man = load(f"{EL}/p_man_crate.png")
    woman_s = load(f"{EL}/p_woman_seated.png")
    boy = load(f"{EL}/p_boy.png")
    woman = load(f"{EL}/p_woman_stand.png")
    wagon = load(f"{EL}/p_wagon_man.png")
    fire = load(f"{EL}/p_fire.png", blur=0.4)

    items = [
        Item(wagon, 1555, 872, 430, motion="still", shadow=0.8, shadow_alpha=60),
        Item(woman, 1205, 918, 292, motion="sway", phase=1.1),
        Item(man, 655, 1006, 208, motion="breath", phase=0.2),
        Item(woman_s, 985, 988, 152, motion="breath", phase=2.3),
        Item(boy, 852, 1002, 196, motion="breath", phase=3.9),
    ]
    f_item = Item(fire, 810, 1030, 190, motion="still", shadow=0.0)
    render("trailer/seq/settlement", items, dur, fire=(f_item, 810, 1000),
           occluder=ruins_occluder())


def scene_dakota(dur=8.0):
    """6808 @ 26s plate. Ladder: ~46px/m at the far path (y 650),
    ~95px/m at y 860, ~165px/m at y 1030. Inhabited, not posed:
    tipi+woman mid-right, solo tipi deeper, man foreground-left looking
    over the river, seated pair near, one figure walking mid-frame,
    family camp far across the river."""
    t_woman = load(f"{EL}/t_tipi_woman.png")
    t_solo = load(f"{EL}/t_tipi_solo.png")
    t_fam = load(f"{EL}/t_tipi_family.png")
    man = load(f"{EL}/t_man.png")
    stand = load(f"{EL}/b_woman_stand.png")
    pair = load(f"{EL}/b_pair_seated.png")
    back = load(f"{EL}/b_woman_back.png")

    items = [
        Item(wash(t_fam, 0.22), 300, 648, 118, motion="still", shadow=0.7,
             shadow_alpha=26),
        Item(wash(t_solo, 0.12), 1660, 792, 258, motion="still", shadow=0.8,
             shadow_alpha=40),
        Item(t_woman, 1400, 892, 336, motion="still", shadow=0.85,
             shadow_alpha=55),
        Item(wash(back, 0.06), 1105, 852, 172, motion="breath", phase=0.8),
        Item(stand, 545, 1046, 300, motion="sway", phase=2.0, drift=(26, 4)),
        Item(pair, 880, 1058, 250, motion="breath", phase=4.1),
        Item(man, 1585, 1150, 420, motion="sway", phase=0.3),
    ]
    render("trailer/seq/dakota", items, dur)


def scene_ice(dur=9.0):
    """Frozen 6682 plate. Anchors: far-bank people ~30px (1m ~ 17px);
    mid outcrop ~38px/m. Natural cold treatment happens in the grade —
    elements stay neutral here."""
    mam = load("assets_user/mammoth.png", desat=0.88, bright=0.96)
    saber = load("assets_user/sabertooth.png", desat=0.84, bright=0.66)

    items = [
        Item(wash(mam, 0.30), 1618, 300, 62, motion="bob", phase=0.4,
             flip=True, shadow=0.7, shadow_alpha=26, drift=(-14, 0)),
        Item(wash(mam, 0.26), 1752, 305, 55, motion="bob", phase=2.6,
             shadow=0.7, shadow_alpha=24, drift=(-9, 0)),
        Item(wash(mam, 0.10), 585, 388, 148, motion="bob", phase=1.2,
             flip=True, shadow=0.8, shadow_alpha=52, drift=(20, 0)),
        Item(wash(saber, 0.16, color=(205, 220, 235)), 300, 1135, 470,
             flip=True, motion="breath", phase=0.9, shadow=0.75,
             shadow_alpha=40),
    ]
    render("trailer/seq/ice", items, dur)


if __name__ == "__main__":
    scene_settlement()
    scene_dakota()
    scene_ice()
    print("all scenes rendered")
