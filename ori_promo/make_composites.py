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
            ch[0].point(lambda p: int(p * 0.86)),
            ch[1].point(lambda p: int(p * 0.96)),
            ch[2].point(lambda p: min(int(p * 1.08), 255))))
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
    """6808 @ ~27s. Perspective ladder from the plate: far-path people
    measure ~80px (1m ~ 46px at y~650), rising to ~200px/m at the near
    lawn. Three depth planes, diagonal composition: camp mid-left past
    the path, an echo camp far-right on the bank, beadwork circle near-
    right in the foreground."""
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    tipis = load("assets_user/tipis.png")
    beadwork = load("assets_user/beadwork.png")
    # main camp mid-right lawn (adults ~190px at ~150px/m)
    place(canvas, tipis, 1430, 890, 330, shadow_alpha=65)
    # beadwork circle near-left foreground (seated ~200px)
    place(canvas, beadwork, 560, 1035, 295, shadow_alpha=75)
    canvas.save("work/overlays_h/scene_native.png")


def pioneer_scene():
    """6805 @ ~28s. Anchors: trash can ~75px at y~650 (1m ~ 70px),
    ~165px/m at y~950. Camp staged against the stone ruins pile so it
    belongs to the environment, with a warm firelight pool spilling
    onto the grass."""
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    pioneers = load("assets_user/pioneers.png")
    place(canvas, pioneers, 1180, 950, 440, shadow_alpha=70)
    # firelight spill on the grass under the campfire
    gw = int(1536 * 440 / 1024)
    fx, fy = int(1180 - gw / 2 + 0.48 * gw), int(950 - 0.10 * 440)
    glow = Image.new("RGBA", (520, 300), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for r, a in [(250, 26), (185, 40), (120, 60)]:
        gd.ellipse((260 - r, 150 - r // 2, 260 + r, 150 + r // 2),
                   fill=(255, 176, 88, a))
    glow = glow.filter(ImageFilter.GaussianBlur(28))
    canvas.alpha_composite(glow, (fx - 260, fy - 150))
    canvas.save("work/overlays_h/scene_pioneers.png")


def wash(el, amount, color=(232, 244, 252)):
    """Atmospheric perspective: haze between viewer and subject."""
    hz = Image.new("RGBA", el.size, (*color, 0))
    hz.putalpha(el.split()[3].point(lambda p: int(p * amount)))
    out = el.copy()
    out.alpha_composite(hz)
    return out


def ice_animals():
    """Frozen 6682 still, scaled from real anchors: people on the far
    bank measure ~30px, so 1m ~ 17px there; the mid rock outcrop is
    ~2.2x closer (1m ~ 38px). Depth hierarchy: distant herd on the far
    bank, hero mammoth crossing the mid outcrop, big low-key sabertooth
    prowling into frame as the near framing element."""
    canvas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    mam = load("assets_user/mammoth.png", desat=0.75, bright=0.95, cool=True)
    saber = load("assets_user/sabertooth.png", desat=0.72, bright=0.62, cool=True)

    # far herd on the upper bank (ground line y~300): 3.6m tall -> ~62px
    place(canvas, wash(mam, 0.34), 1620, 302, 62, flip=True, shadow_alpha=28)
    place(canvas, wash(mam, 0.30), 1755, 306, 55, shadow_alpha=24)
    # hero on the mid-left outcrop top (y~385): 3.6m -> ~145px
    place(canvas, wash(mam, 0.12), 585, 388, 148, flip=True, shadow_alpha=55)
    # near sabertooth: cold-washed into the duotone, prowling toward
    # the falls, partially cropped at bottom-left
    saber = wash(saber, 0.24, color=(150, 190, 225))
    place(canvas, saber, 300, 1135, 470, flip=True, shadow_alpha=40)
    canvas.save("work/overlays_h/animals_ice.png")


if __name__ == "__main__":
    native_scene()
    pioneer_scene()
    ice_animals()
    print("scene composites done")
