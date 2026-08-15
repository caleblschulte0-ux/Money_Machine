#!/usr/bin/env python3
"""v5 reconstruction scenes — the historical layer is now an OBVIOUSLY
digital museum-grade reconstruction material:

  ~85% monochrome warm-limestone duotone, preserved surface detail,
  quantized depth-contour lines, fine point-cloud breakup at silhouette
  edges, subtle scan rows, fully opaque after resolve.

Shots are short glimpses; primary figures are 25-40% of frame height,
staged against real terrain with real-plate occlusion cuts.
"""
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
import numpy as np
import math
import os
import subprocess

W, H = 1920, 1080
FPS = 30
A = "trailer/assets_v3"
rng = np.random.default_rng(21)

BRONZE_DARK = np.array([54, 42, 30], np.float32)
AMBER_LIGHT = np.array([236, 214, 180], np.float32)


def material(img, chroma_keep=0.13, contour_bands=7):
    """Museum photogrammetry material: warm duotone over luminance with
    preserved detail, contour lines, scan rows, point-cloud edge."""
    im = img.convert("RGBA")
    arr = np.asarray(im).astype(np.float32)
    a = arr[..., 3]
    rgb = arr[..., :3]
    lum = (0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]) / 255.0
    # deepen self-shadowing slightly
    lum = np.clip(lum ** 1.12 * 1.05, 0, 1)
    duo = BRONZE_DARK[None, None] + (AMBER_LIGHT - BRONZE_DARK)[None, None] * lum[..., None]
    out_rgb = duo * (1 - chroma_keep) + rgb * chroma_keep
    # contour lines at luminance band boundaries
    q = np.floor(lum * contour_bands)
    edge = np.zeros_like(lum, bool)
    edge[1:, :] |= q[1:, :] != q[:-1, :]
    edge[:, 1:] |= q[:, 1:] != q[:, :-1]
    out_rgb[edge] *= 0.80
    # scan rows
    rows = (np.arange(arr.shape[0]) % 3 == 0)
    out_rgb[rows, :, :] *= 0.94
    # point-cloud breakup at silhouette edge
    am = Image.fromarray(a.astype(np.uint8), "L")
    inner = am.filter(ImageFilter.MinFilter(7))
    ring = np.asarray(am).astype(np.int16) - np.asarray(inner).astype(np.int16)
    ring_m = ring > 40
    noise = rng.random(a.shape)
    dots = ring_m & (noise > 0.45)
    new_a = a.copy()
    new_a[ring_m] = 0
    new_a[dots] = a[dots]
    out = np.dstack([np.clip(out_rgb, 0, 255), new_a]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def wash(el, amount, color=(233, 240, 246)):
    hz = Image.new("RGBA", el.size, (*color, 0))
    hz.putalpha(el.split()[3].point(lambda p: int(p * amount)))
    out = el.copy()
    out.alpha_composite(hz)
    return out


def load_mat(path, washv=0.0, blur=0.0, lift=1.0):
    im = material(Image.open(path))
    if lift != 1.0:
        r, g, b, a = im.split()
        rgb = Image.merge("RGB", (r, g, b)).point(
            lambda p: min(int(p * lift + 6), 255))
        im = Image.merge("RGBA", (*rgb.split(), a))
    if washv:
        im = wash(im, washv)
    if blur:
        im = im.filter(ImageFilter.GaussianBlur(blur))
    return im


class El:
    def __init__(self, img, cx, ground, h, shadow=0.78, shadow_alpha=55):
        w = int(img.width * h / img.height)
        self.im = img.resize((w, h), Image.LANCZOS)
        self.cx, self.ground = cx, ground
        sw = int(self.im.width * shadow)
        sh = max(int(sw * 0.11), 10)
        e = Image.new("RGBA", (sw + 70, sh + 70), (0, 0, 0, 0))
        ImageDraw.Draw(e).ellipse((35, 35, 35 + sw, 35 + sh),
                                  fill=(14, 12, 8, shadow_alpha))
        self.sh = e.filter(ImageFilter.GaussianBlur(14))


def depth_front(img, ax, ay, r, alpha, persp=0.26):
    if alpha <= 0 or r <= 4:
        return
    d = ImageDraw.Draw(img)
    for k, aa in [(1.0, alpha), (0.96, int(alpha * 0.4))]:
        rr = r * k
        d.ellipse((ax - rr, ay - rr * persp, ax + rr, ay + rr * persp),
                  outline=(255, 250, 240, aa), width=3)
    for _ in range(30):
        th = rng.uniform(0, 2 * math.pi)
        j = rng.uniform(-8, 8)
        px, py = ax + (r + j) * math.cos(th), ay + (r + j) * persp * math.sin(th)
        if 0 <= px < W and 0 <= py < H:
            sz = rng.uniform(0.8, 2.0)
            d.ellipse((px - sz, py - sz, px + sz, py + sz),
                      fill=(255, 250, 240, int(alpha * rng.uniform(0.3, 0.9))))


def render(outdir, els, dur, anchor, t0=0.5, front_dur=0.7, front_max=1700,
           occluder=None, mist=None, quiet=False, fade_resolve=0.5):
    """quiet=True: no front ring — elements fade-resolve gently (used for
    the distant mammoth discovery)."""
    os.makedirs(outdir, exist_ok=True)
    n = int(dur * FPS)
    ax, ay = anchor
    dists = {id(e): math.hypot(e.cx - ax, (e.ground - ay) * 2.0) for e in els}
    for f in range(n):
        t = f / FPS
        frame = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        prog = (t - t0) / front_dur
        r = front_max * max(min(prog, 1.0), 0.0) ** 0.8
        for e in els:
            if quiet:
                aal = min(max((t - t0) / fade_resolve, 0.0), 1.0)
                if aal <= 0:
                    continue
                im = e.im
                if aal < 1.0:
                    im = im.copy()
                    im.putalpha(im.split()[3].point(lambda p: int(p * aal)))
                sh = e.sh.copy()
                sh.putalpha(sh.split()[3].point(lambda p: int(p * aal)))
                frame.alpha_composite(sh, (e.cx - e.sh.width // 2,
                                           e.ground - e.sh.height // 2))
                frame.alpha_composite(im, (e.cx - e.im.width // 2,
                                           e.ground - e.im.height))
                continue
            if t < t0 or dists[id(e)] > r:
                continue
            frame.alpha_composite(e.sh, (e.cx - e.sh.width // 2 +
                                         int(e.im.height * 0.05),
                                         e.ground - e.sh.height // 2))
            frame.alpha_composite(e.im, (e.cx - e.im.width // 2,
                                         e.ground - e.im.height))
        if not quiet:
            if t0 - 0.35 <= t < t0:
                aa = int(240 * (t - (t0 - 0.35)) / 0.35)
                d = ImageDraw.Draw(frame)
                d.ellipse((ax - 5, ay - 5, ax + 5, ay + 5),
                          fill=(255, 250, 240, aa))
            if 0.0 <= prog <= 1.15:
                fd = 1.0 if prog <= 1.0 else max(0.0, 1 - (prog - 1) / 0.15)
                depth_front(frame, ax, ay, r, int(150 * fd))
        if mist is not None:
            frame.alpha_composite(mist, (int(14 * math.sin(0.3 * t)), 0))
        if occluder is not None:
            frame.alpha_composite(occluder)
        frame.save(f"{outdir}/{f:04d}.png")
    print(outdir, n, "frames")


def plate_occluder(src, ts, poly, crop=None, feather=3):
    """Cut real terrain from the plate itself as a foreground occluder.
    poly is in final-frame coordinates."""
    tmp = "work/_occ_tmp.png"
    subprocess.run(["ffmpeg", "-v", "error", "-ss", str(ts), "-i", src,
                    "-frames:v", "1", tmp, "-y"])
    plate = Image.open(tmp).convert("RGBA")
    if crop:
        plate = plate.crop(crop).resize((W, H), Image.LANCZOS)
    mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(mask).polygon(poly, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(feather))
    out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    out.paste(plate, (0, 0), mask)
    return out


def dakota_a(dur=3.4):
    """Over-the-shoulder POV (6804): the viewer in glasses looks at the
    real rock flats; one figure resolves ON the shelf, her feet behind
    the actual foreground rock ridge."""
    woman = load_mat(f"{A}/dakota_woman.png", washv=0.04, lift=1.16)
    els = [El(woman, 1240, 742, 300, shadow_alpha=44)]
    occ = plate_occluder("raw/IMG_6804.MOV", 23.5,
                        [(560, 1080), (600, 730), (900, 700),
                         (1300, 758), (1920, 838), (1920, 1080)])
    render("trailer/seq/v5_dak_a", els, dur, anchor=(1240, 720), t0=0.55,
           front_dur=0.65, front_max=1400, occluder=occ)


def dakota_b(dur=2.8):
    """Wide: a single tipi resolves deeper in the environment, on the
    real far-bank grass across the river."""
    tipi = load_mat(f"{A}/tipi_big.png", washv=0.15, blur=0.4, lift=1.1)
    els = [El(tipi, 1495, 755, 290, shadow=0.62, shadow_alpha=30)]
    render("trailer/seq/v5_dak_b", els, dur, anchor=(1495, 745), t0=0.35,
           front_dur=0.55, front_max=1100)


SETA_CROP = (700, 300, 1920, 986)


def settle_a(dur=3.2):
    """Queen Bee Mill area stones foreground — ONLY the wagon resolves,
    partly behind the real stone pile."""
    wagon = load_mat(f"{A}/wagon.png")
    els = [El(wagon, 1291, 905, 560, shadow=0.7, shadow_alpha=42)]
    occ = plate_occluder("raw/IMG_6805.MOV", 27.5,
                        [(1020, 1080), (1030, 800), (1180, 720),
                         (1420, 700), (1720, 726), (1860, 800),
                         (1870, 1080)],
                        crop=SETA_CROP)
    render("trailer/seq/v5_set_a", els, dur, anchor=(1300, 880), t0=0.5,
           front_dur=0.6, front_max=1400, occluder=occ)


SETB_CROP = (768, 336, 1920, 984)


def settle_b(dur=2.8):
    """Tighter: ONE settler beside part of the wagon."""
    woman = load_mat(f"{A}/settler_woman.png")
    wagon = load_mat(f"{A}/wagon.png")
    els = [El(wagon, 1253, 903, 600, shadow=0.7, shadow_alpha=40),
           El(woman, 917, 870, 360, shadow_alpha=52)]
    occ = plate_occluder("raw/IMG_6805.MOV", 31.9,
                        [(973, 1080), (983, 800), (1140, 700),
                         (1440, 680), (1780, 720), (1830, 1080)],
                        crop=SETB_CROP)
    render("trailer/seq/v5_set_b", els, dur, anchor=(917, 870), t0=0.35,
           front_dur=0.55, front_max=1300, occluder=occ)


def ice(dur=8.2):
    """Distant mammoth discovery: heavy atmosphere, low contrast, mist in
    front, quiet fade-resolve. No front ring, no label."""
    mam = load_mat(f"{A}/mammoth.png", washv=0.30, blur=0.8)
    el = El(mam, 585, 390, 140, shadow=0.7, shadow_alpha=30)
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
    strip[..., 3] = (np.clip(ma / 255 * (1 - yy ** 2), 0, 1) * 110).astype(np.uint8)
    mist.alpha_composite(Image.fromarray(strip).crop((0, 0, 1920, 90)), (0, 375))
    render("trailer/seq/v5_ice", [el], dur, anchor=(585, 400), t0=5.4,
           quiet=True, fade_resolve=0.7, mist=mist)


if __name__ == "__main__":
    dakota_a()
    dakota_b()
    settle_a()
    settle_b()
    ice()
    print("v5 scenes done")
