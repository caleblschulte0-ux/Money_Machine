#!/usr/bin/env python3
"""Full-frame RGBA scene overlays from the user-supplied transparent
photoreal elements, with contact shadows and light matching. Each scene
is composited onto the footage BEFORE the beat's grade, so the grade
unifies plate and elements."""
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

W, H = 1920, 1080


def load(path, desat=0.94, bright=1.0, blur=0.5, cool=False):
    im = Image.open(path).convert("RGBA")
    r, g, b, a = im.split()
    rgb = Image.merge("RGB", (r, g, b))
    rgb = ImageEnhance.Color(rgb).enhance(desat)
    rgb = ImageEnhance.Brightness(rgb).enhance(bright)
    if cool:  # cold shift for the glacial beat
        ch = rgb.split()
        rgb = Image.merge("RGB", (
            ch[0].point(lambda p: int(p * 0.78)),
            ch[1].point(lambda p: int(p * 0.94)),
            ch[2].point(lambda p: min(int(p * 1.14), 255))))
        rgb = ImageEnhance.Color(rgb).enhance(0.55)
        rgb = ImageEnhance.Brightness(rgb).enhance(1.06)
    out = Image.merge("RGBA", (*rgb.split(), a))
    if blur:
        out = out.filter(ImageFilter.GaussianBlur(blur))
    return out


def place(canvas, el, cx, ground_y, target_h, flip=False, shadow_scale=0.86,
          shadow_alpha=80):
    w = int(el.width * target_h / el.height)
    im = el.resize((w, target_h), Image.LANCZOS)
    if flip:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    sw = int(w * shadow_scale)
    sh = max(int(sw * 0.10), 12)
    sc = Image.new("RGBA", (sw + 60, sh + 60), (0, 0, 0, 0))
    ImageDraw.Draw(sc).ellipse((30, 30, 30 + sw, 30 + sh),
                               fill=(10, 8, 5, shadow_alpha))
    sc = sc.filter(ImageFilter.GaussianBlur(11))
    canvas.alpha_composite(sc, (cx - sw // 2 - 30, ground_y - sh // 2 - 30))
    canvas.alpha_composite(im, (cx - w // 2, ground_y - im.height))


def native_scene():
    """6808 @ ~26s: big lawn foreground — the encampment sits on it."""
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    tipis = load("assets_user/tipis.png")
    beadwork = load("assets_user/beadwork.png")
    place(canvas, tipis, 1330, 1040, 520)
    place(canvas, beadwork, 400, 1066, 300)
    canvas.save("work/overlays_h/scene_native.png")


def pioneer_scene():
    """6805 @ ~27s: open lawn before the falls and mill house."""
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    pioneers = load("assets_user/pioneers.png")
    place(canvas, pioneers, 1080, 962, 470)
    canvas.save("work/overlays_h/scene_pioneers.png")


def ice_animals():
    """Frozen 6682 still: mammoth right foreground facing the falls,
    sabertooth on the left rocks facing it across the gorge."""
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    mammoth = load("assets_user/mammoth.png", cool=True)
    saber = load("assets_user/sabertooth.png", cool=True)
    place(canvas, mammoth, 1430, 1062, 500, shadow_alpha=60)
    place(canvas, saber, 330, 1000, 250, flip=True, shadow_alpha=60)
    canvas.save("work/overlays_h/animals_ice.png")


if __name__ == "__main__":
    native_scene()
    pioneer_scene()
    ice_animals()
    print("scene composites done")
