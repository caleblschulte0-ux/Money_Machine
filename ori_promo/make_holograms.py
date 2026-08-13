#!/usr/bin/env python3
"""Silhouette projections for the time-layer beats.

The free image model can't do photoreal cutouts that hold up, but its
SILHOUETTES are clean — so the design leans into deliberate, stylized
'data projection' figures: solid warm-amber (1873) or ice-blue (glacial)
shapes with a soft rim glow and grounded contact shadows.
"""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

W, H = 1920, 1080


from rembg import remove

def silhouette_alpha(path, crop=None):
    """rembg foreground mask -> hard silhouette alpha, cropped to content."""
    img = Image.open(path).convert("RGBA")
    if crop:
        img = img.crop(crop)
    cut = remove(img)
    a = np.asarray(cut.split()[3]).astype(np.float32)
    alpha = np.clip((a - 90) * 4.0, 0, 255).astype(np.uint8)
    out = Image.fromarray(alpha, "L").filter(ImageFilter.MedianFilter(5))
    bbox = out.getbbox()
    return out.crop(bbox)


def tint_figure(alpha_img, color, glow_color, alpha_mul=0.92, glow=0.55):
    """Solid-color figure with a soft rim glow."""
    w, h = alpha_img.size
    fig = Image.new("RGBA", (w, h), (*color, 0))
    fig.putalpha(alpha_img.point(lambda p: int(p * alpha_mul)))
    pad = 30
    canvas = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    ga = Image.new("L", canvas.size, 0)
    ga.paste(alpha_img, (pad, pad))
    ga = ga.filter(ImageFilter.GaussianBlur(9)).point(lambda p: int(p * glow))
    gl = Image.new("RGBA", canvas.size, (*glow_color, 0))
    gl.putalpha(ga)
    canvas.alpha_composite(gl)
    canvas.alpha_composite(fig, (pad, pad))
    return canvas


def place(canvas, fig, x, ground_y, h, flip=False, opacity=1.0, shadow=True):
    w = int(fig.width * h / fig.height)
    el = fig.resize((w, h), Image.LANCZOS)
    if flip:
        el = el.transpose(Image.FLIP_LEFT_RIGHT)
    if opacity < 1.0:
        el.putalpha(el.split()[3].point(lambda p: int(p * opacity)))
    if shadow:
        sw, sh = int(w * 0.82), max(int(w * 0.12), 10)
        sc = Image.new("RGBA", (sw + 40, sh + 40), (0, 0, 0, 0))
        ImageDraw.Draw(sc).ellipse((20, 20, 20 + sw, 20 + sh),
                                   fill=(0, 0, 0, int(95 * opacity)))
        sc = sc.filter(ImageFilter.GaussianBlur(9))
        canvas.alpha_composite(sc, (x - sw // 2 - 20, ground_y - sh // 2 - 20))
    canvas.alpha_composite(el, (x - w // 2, ground_y - el.height))


AMBER = (236, 172, 92)
AMBER_GLOW = (255, 214, 140)
ICE = (26, 54, 82)
ICE_GLOW = (150, 205, 240)


def settlers():
    # photoreal generations -> rembg mask -> solid fill = clean shapes
    wagon = tint_figure(silhouette_alpha("ai/wagon2.png"), AMBER, AMBER_GLOW)
    rider = tint_figure(silhouette_alpha("ai/sil_rider.png"), AMBER, AMBER_GLOW)
    family = tint_figure(silhouette_alpha("ai/settlers_pair.png"), AMBER, AMBER_GLOW)

    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    # 6791 @ ~13s: caravan strung along the far rock shelf, above the
    # water line, all moving left-to-right.
    place(canvas, rider, 640, 640, 148)
    place(canvas, family, 950, 655, 138)
    place(canvas, wagon, 1300, 648, 150)
    canvas.save("work/overlays_h/settlers_holo.png")


def mammoths():
    m1 = tint_figure(silhouette_alpha("ai/sil_mammoth.png"), ICE, ICE_GLOW)
    m2 = tint_figure(silhouette_alpha("ai/sil_mammoth2.png"), ICE, ICE_GLOW)
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    # 6682 frozen frame: hero mammoth walks the bottom-left rock shelf;
    # a second, atmospheric one stands far off on the upper bank.
    place(canvas, m1, 360, 1058, 400)
    place(canvas, m2, 1560, 352, 128, flip=True, opacity=0.55, shadow=False)
    canvas.save("work/overlays_h/mammoths.png")


if __name__ == "__main__":
    settlers()
    mammoths()
    print("silhouette overlays done")
