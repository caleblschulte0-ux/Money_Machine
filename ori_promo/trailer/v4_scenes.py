#!/usr/bin/env python3
"""v4 reconstruction scenes.

Art direction: the historical material is presented as a premium
spatial reconstruction layer, not as fake photography. All elements in
a scene share ONE treatment (slight desat, compressed range, fine
per-frame reconstruction grain) so they read as a single volumetric
layer. Activation is a signature depth-front: an anchor locks, a soft
luminous ground front expands outward through space with fine
particles, and each element resolves — fully opaque, then inert.

Cinematic framing: plates are punched-in crops where the composition
needs it; figures are large (15-30% of frame height); few elements.
"""
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
import numpy as np
import math
import os
import subprocess

W, H = 1920, 1080
FPS = 30
A = "trailer/assets_v3"
rng = np.random.default_rng(12)


def plate_frame(src, ts, crop=None):
    """Grab a full-res frame; return (optionally cropped+upscaled) plate
    for element placement previews (video handled in build)."""
    out = "work/_plate_tmp.png"
    subprocess.run(["ffmpeg", "-v", "error", "-ss", str(ts), "-i", src,
                    "-frames:v", "1", out, "-y"])
    im = Image.open(out).convert("RGBA")
    if crop:
        im = im.crop(crop).resize((W, H), Image.LANCZOS)
    return im


def load(path, bright=1.0):
    im = Image.open(path).convert("RGBA")
    if bright != 1.0:
        r, g, b, a = im.split()
        rgb = ImageEnhance.Brightness(Image.merge("RGB", (r, g, b))).enhance(bright)
        im = Image.merge("RGBA", (*rgb.split(), a))
    return im.filter(ImageFilter.GaussianBlur(0.4))


def wash(el, amount, color=(233, 240, 246)):
    hz = Image.new("RGBA", el.size, (*color, 0))
    hz.putalpha(el.split()[3].point(lambda p: int(p * amount)))
    out = el.copy()
    out.alpha_composite(hz)
    return out


class El:
    def __init__(self, img, cx, ground, h, shadow=0.8, shadow_alpha=55,
                 depth_blur=0.0, washv=0.0):
        if washv:
            img = wash(img, washv)
        w = int(img.width * h / img.height)
        self.im = img.resize((w, h), Image.LANCZOS)
        if depth_blur:
            self.im = self.im.filter(ImageFilter.GaussianBlur(depth_blur))
        self.cx, self.ground = cx, ground
        sw = int(self.im.width * shadow)
        sh = max(int(sw * 0.11), 10)
        e = Image.new("RGBA", (sw + 70, sh + 70), (0, 0, 0, 0))
        ImageDraw.Draw(e).ellipse((35, 35, 35 + sw, 35 + sh),
                                  fill=(14, 12, 8, shadow_alpha))
        self.sh = e.filter(ImageFilter.GaussianBlur(14))


def unify(frame_rgba, grain):
    """One shared reconstruction treatment across the whole element
    layer: slight desat, compressed range, fine per-frame grain."""
    arr = np.asarray(frame_rgba).astype(np.int16)
    a = arr[..., 3]
    m = a > 0
    if not m.any():
        return frame_rgba
    rgb = arr[..., :3].astype(np.float32)
    lum = rgb.mean(axis=2, keepdims=True)
    rgb = lum + (rgb - lum) * 0.86          # desat
    rgb = 16 + rgb * 0.90                   # compress dynamic range
    g = grain[..., None]
    rgb = rgb + g
    out = arr.copy()
    out[..., :3] = np.clip(rgb, 0, 255).astype(np.int16)
    return Image.fromarray(out.astype(np.uint8), "RGBA")


def depth_front(draw_img, ax, ay, r, alpha, persp=0.26):
    """Soft luminous ground front expanding from the anchor, with fine
    particles along the arc."""
    if alpha <= 0 or r <= 4:
        return
    d = ImageDraw.Draw(draw_img)
    for k, aa in [(1.0, alpha), (0.965, int(alpha * 0.45))]:
        rr = r * k
        d.ellipse((ax - rr, ay - rr * persp, ax + rr, ay + rr * persp),
                  outline=(255, 255, 255, aa), width=3)
    n = 34
    for i in range(n):
        th = rng.uniform(0, 2 * math.pi)
        jitter = rng.uniform(-8, 8)
        px = ax + (r + jitter) * math.cos(th)
        py = ay + (r + jitter) * persp * math.sin(th)
        if 0 <= px < W and 0 <= py < H:
            sz = rng.uniform(0.8, 2.2)
            d.ellipse((px - sz, py - sz, px + sz, py + sz),
                      fill=(255, 255, 255, int(alpha * rng.uniform(0.3, 0.9))))


def render(outdir, els, dur, anchor, t0=1.0, front_dur=1.0, front_max=1700,
           fire=None, occluder=None, mist=None):
    """anchor=(ax,ay). Each element resolves when the front radius
    passes its ground point. Elements resolve instantly to solid."""
    os.makedirs(outdir, exist_ok=True)
    n = int(dur * FPS)
    ax, ay = anchor
    fl = rng.normal(0, 1, n + 8)
    fl = np.convolve(fl, np.ones(7) / 7, mode="same")
    fl = 1.0 + 0.15 * fl / max(abs(fl).max(), 1e-6)
    all_els = els + ([fire[0]] if fire else [])
    dists = {id(e): math.hypot(e.cx - ax, (e.ground - ay) * 2.0)
             for e in all_els}
    for f in range(n):
        t = f / FPS
        frame = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        prog = (t - t0) / front_dur
        r = front_max * max(min(prog, 1.0), 0.0) ** 0.8
        grain = rng.normal(0, 3.4, (H, W)).astype(np.float32)

        def resolved(e):
            return t >= t0 and dists[id(e)] <= r

        for e in els:
            if not resolved(e):
                continue
            frame.alpha_composite(
                e.sh, (e.cx - e.sh.width // 2 + int(e.im.height * 0.05),
                       e.ground - e.sh.height // 2))
            frame.alpha_composite(e.im, (e.cx - e.im.width // 2,
                                         e.ground - e.im.height))
        if fire is not None:
            fe, gx, gy = fire
            if resolved(fe):
                glow = Image.new("RGBA", (460, 250), (0, 0, 0, 0))
                gd = ImageDraw.Draw(glow)
                ga = int(38 * fl[f])
                for rr, aa in [(200, ga // 2), (140, ga), (90, int(ga * 1.4))]:
                    gd.ellipse((230 - rr, 125 - rr // 2, 230 + rr, 125 + rr // 2),
                               fill=(255, 172, 84, aa))
                glow = glow.filter(ImageFilter.GaussianBlur(24))
                frame.alpha_composite(glow, (gx - 230, gy - 125))
                b = ImageEnhance.Brightness(fe.im).enhance(float(fl[f]))
                frame.alpha_composite(b, (fe.cx - fe.im.width // 2,
                                          fe.ground - fe.im.height))
        frame = unify(frame, grain)
        # anchor lock + traveling front on top
        if t0 - 0.4 <= t < t0:
            aa = int(240 * (t - (t0 - 0.4)) / 0.4)
            d = ImageDraw.Draw(frame)
            d.ellipse((ax - 5, ay - 5, ax + 5, ay + 5), fill=(255, 255, 255, aa))
            d.ellipse((ax - 13, ay - 13, ax + 13, ay + 13),
                      outline=(255, 255, 255, int(aa * 0.7)), width=2)
        if 0.0 <= prog <= 1.15:
            fade = 1.0 if prog <= 1.0 else max(0.0, 1.0 - (prog - 1.0) / 0.15)
            depth_front(frame, ax, ay, r, int(150 * fade))
        if mist is not None:
            mx = int(18 * math.sin(2 * math.pi * 0.05 * t))
            frame.alpha_composite(mist, (mx, 0))
        if occluder is not None:
            frame.alpha_composite(occluder)
        frame.save(f"{outdir}/{f:04d}.png")
    print(outdir, n, "frames")


def ruins_occluder(crop=None):
    plate = Image.open("work/pioneer_base.png").convert("RGBA")
    mask = Image.new("L", plate.size, 0)
    d = ImageDraw.Draw(mask)
    d.polygon([(1352, 908), (1360, 800), (1452, 758), (1600, 742),
               (1782, 758), (1856, 800), (1860, 908), (1352, 908)], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(3))
    out = Image.new("RGBA", plate.size, (0, 0, 0, 0))
    out.paste(plate, (0, 0), mask)
    if crop:
        out = out.crop(crop).resize((W, H), Image.LANCZOS)
    return out


# 6808 punch-in for the Dakota close shot
DAKOTA_CROP = (700, 380, 1920, 1066)


def lerp_ladder(y, pts):
    """px per meter at screen y from a two-point ladder."""
    (y0, p0), (y1, p1) = pts
    t = (y - y0) / (y1 - y0)
    return p0 + (p1 - p0) * t


def dakota(dur=6.4):
    """Punched-in 6808: woman large right-of-center beside the real
    rocks, crouching figure at the water's edge, single tipi across the
    river. Three elements, three depths."""
    lad = [(560, 95), (990, 265)]  # crop-frame px/m
    woman = load(f"{A}/dakota_woman.png")
    crouch = load(f"{A}/dakota_crouch.png")
    tipi = load(f"{A}/tipi_big.png")
    els = [
        El(tipi, 430, 520, int(4.2 * lerp_ladder(520, lad) * 0.55),
           shadow=0.66, shadow_alpha=30, depth_blur=0.7, washv=0.16),
        El(crouch, 830, 775, int(1.05 * lerp_ladder(775, lad)),
           shadow=0.8, shadow_alpha=48, depth_blur=0.3, washv=0.07),
        El(woman, 1195, 952, int(1.65 * lerp_ladder(952, lad)),
           shadow=0.72, shadow_alpha=62),
    ]
    render("trailer/seq/v4_dakota", els, dur, anchor=(1195, 952), t0=1.1,
           front_max=1750)


def settlement_a(dur=4.2):
    """6805 wide: the wagon resolves behind the real stone ruins, the
    settler woman beside it. Two elements only."""
    wagon = load(f"{A}/wagon.png")
    woman = load(f"{A}/settler_woman.png")
    els = [
        El(wagon, 1520, 878, 360, shadow=0.75, shadow_alpha=40),
        El(woman, 1318, 858, 216, shadow=0.7, shadow_alpha=55),
    ]
    render("trailer/seq/v4_settle_a", els, dur, anchor=(1450, 890), t0=0.9,
           front_max=1500, occluder=ruins_occluder())


SETTLE_CROP = (470, 260, 1920, 1076)


def settlement_b(dur=4.0):
    """Punched-in toward the camp: campfire foreground, wagon+woman
    larger, oxen deeper. Continues the already-active reconstruction —
    short local front."""
    k = W / (SETTLE_CROP[2] - SETTLE_CROP[0])

    def cc(x, y):
        return (int((x - SETTLE_CROP[0]) * k), int((y - SETTLE_CROP[1]) * k))

    wagon = load(f"{A}/wagon.png")
    woman = load(f"{A}/settler_woman.png")
    oxen = load(f"{A}/oxen.png")
    fire = load(f"{A}/campfire.png")
    wx, wy = cc(1520, 878)
    ox, oy = cc(1080, 800)
    fx, fy = cc(905, 1010)
    px, py = cc(1318, 858)
    els = [
        El(oxen, ox, oy, int(178 * k), shadow=0.8, shadow_alpha=42,
           depth_blur=0.4, washv=0.08),
        El(wagon, wx, wy, int(360 * k), shadow=0.75, shadow_alpha=40),
        El(woman, px, py, int(216 * k), shadow=0.7, shadow_alpha=55),
    ]
    f_el = El(fire, fx, fy, int(140 * k), shadow=0.0, shadow_alpha=0)
    render("trailer/seq/v4_settle_b", els, dur, anchor=(fx, fy), t0=0.4,
           front_dur=0.7, front_max=2100, fire=(f_el, fx, fy - 20),
           occluder=ruins_occluder(crop=SETTLE_CROP))


def ice(dur=8.6):
    """Fauna layer for the frozen falls: ONE mammoth, discovered deep in
    the landscape on the mid outcrop, whole silhouette, low contrast,
    drifting mist band in front of its legs. No sabertooth."""
    mam = load(f"{A}/mammoth.png", bright=0.97)
    mam = wash(mam, 0.16)
    el = El(mam, 585, 390, 156, shadow=0.75, shadow_alpha=40, depth_blur=0.4)

    # mist band drifting in front of the mammoth's ground line
    noise = rng.random((40, 500)).astype(np.float32)
    band = Image.fromarray((noise * 255).astype(np.uint8)).resize(
        (2100, 90), Image.BILINEAR).filter(ImageFilter.GaussianBlur(18))
    mist = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ma = np.asarray(band).astype(np.float32)
    strip = np.zeros((90, 2100, 4), np.uint8)
    strip[..., 0] = 226
    strip[..., 1] = 233
    strip[..., 2] = 240
    yy = np.abs(np.linspace(-1, 1, 90))[:, None]
    strip[..., 3] = (np.clip(ma / 255 * (1 - yy ** 2), 0, 1) * 95).astype(np.uint8)
    mist.alpha_composite(Image.fromarray(strip).crop((0, 0, 1920, 90)), (0, 372))

    render("trailer/seq/v4_ice", [el], dur, anchor=(585, 400), t0=4.9,
           front_dur=0.9, front_max=900, mist=mist)


if __name__ == "__main__":
    dakota()
    settlement_a()
    settlement_b()
    ice()
    print("v4 scenes done")
