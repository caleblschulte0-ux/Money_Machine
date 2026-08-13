#!/usr/bin/env python3
"""Cut the AI settler elements out of their backgrounds and bake the
'AR hologram' overlay: warm ghost tone, soft glow, scanlines, then
composite them standing on the real rock flats (full 1920x1080 RGBA
overlay for ffmpeg)."""
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
from rembg import remove

W, H = 1920, 1080


def cutout(path):
    img = Image.open(path).convert("RGBA")
    out = remove(img)
    bbox = out.getbbox()
    return out.crop(bbox)


def hologram(img, alpha=0.80):
    """Warm 'memory projection' ghost: sepia lean, lifted glow, scanlines."""
    img = img.convert("RGBA")
    r, g, b, a = img.split()
    rgb = Image.merge("RGB", (r, g, b))
    rgb = ImageEnhance.Color(rgb).enhance(0.55)
    rgb = ImageEnhance.Brightness(rgb).enhance(1.18)
    # warm tint
    warm = Image.new("RGB", rgb.size, (255, 214, 150))
    rgb = Image.blend(rgb, warm, 0.22)
    out = Image.merge("RGBA", (*rgb.split(), a))

    # scanlines cut into alpha
    sl = out.load()
    for y in range(0, out.height, 4):
        for x in range(out.width):
            pr, pg, pb, pa = sl[x, y]
            sl[x, y] = (pr, pg, pb, int(pa * 0.55))

    # global transparency
    a2 = out.split()[3].point(lambda p: int(p * alpha))
    out.putalpha(a2)

    # soft glow behind the figure
    glow_a = out.split()[3].filter(ImageFilter.GaussianBlur(10))
    glow = Image.new("RGBA", out.size, (255, 226, 170, 0))
    glow.putalpha(glow_a.point(lambda p: int(p * 0.5)))
    canvas = Image.new("RGBA", out.size, (0, 0, 0, 0))
    canvas.alpha_composite(glow)
    canvas.alpha_composite(out)
    return canvas


def place(canvas, element, x, y, h):
    w = int(element.width * h / element.height)
    el = element.resize((w, h), Image.LANCZOS)
    canvas.alpha_composite(el, (x - w // 2, y - el.height))


def main():
    wagon = hologram(cutout("ai/wagon2.png"))
    rider = hologram(cutout("ai/riders.png"))
    pair = hologram(cutout("ai/settlers_pair.png"))

    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    # 6791 @ ~14s: rock flats run mid-frame; river channel center-left.
    # Mid-ground figures ~y620-700, ground line rises to the right.
    place(canvas, wagon, 1310, 680, 215)   # wagon crossing, center-right
    place(canvas, rider, 720, 690, 175)    # rider ahead of it, center-left
    place(canvas, pair, 990, 705, 160)     # family walking between
    canvas.save("work/overlays_h/settlers_holo.png")
    print("settlers_holo.png done")


if __name__ == "__main__":
    main()
