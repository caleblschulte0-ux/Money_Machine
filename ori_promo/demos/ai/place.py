#!/usr/bin/env python3
"""Put a generated FIGURE on the real rock the camera actually saw.

This replaces holo.py for the single film. holo.py reduced every generated
image to cyan linework, and the operator's verdict on 2026-08-27 was that it
turned a family into "a little fucking dot". These figures stay figures: full
colour, full scale, standing on the real quartzite.

What makes a composite read as PRESENT rather than PASTED, in the order the
eye notices it:

  1. CONTACT SHADOW. Nothing else comes close. A figure with no shadow floats
     no matter how good the matte is. A soft ellipse under the feet, offset
     away from the sun, multiplied into the plate.
  2. SCALE against something real. The plates contain actual people, so a
     figure is sized by how tall a real adult is at the same depth, not by
     what looks nice.
  3. LIGHT MATCH. The generator lights everything its own way. The cutout is
     pulled toward the mean colour and exposure of the plate region it lands
     in, which kills the "sticker" look faster than any edge treatment.
  4. OCCLUSION. Where the depth map says the plate is nearer than the figure,
     the plate wins, so a figure behind a rock lip is cut by it.

The AR reveal is deliberately restrained: a rising resolve line with a thin
warm edge, over about half a second. It says "the glasses are drawing this"
without turning the figure back into a diagram.
"""
import os

import cv2
import numpy as np

CUT_DIR = "ai/era/cut"
GLOW = (150, 205, 245)          # BGR, warm-cool AR edge


def matte(src, cache=None):
    """rembg cutout -> RGBA uint8, cached on disk (the model load is ~19s).

    The cache sits NEXT TO THE SOURCE by default, not at a path relative to
    the working directory. A relative default silently writes a second copy
    of every cutout under whichever directory the renderer happened to be
    launched from, and then re-runs u2net because the first cache is not
    where this process is looking.
    """
    if cache is None:
        cache = os.path.join(os.path.dirname(os.path.abspath(src)), "cut")
    os.makedirs(cache, exist_ok=True)
    dst = os.path.join(cache, os.path.basename(src).rsplit(".", 1)[0] + ".png")
    if not os.path.exists(dst):
        from rembg import remove, new_session
        from PIL import Image
        sess = new_session("u2net")
        remove(Image.open(src).convert("RGBA"), session=sess).save(dst)
    im = cv2.imread(dst, cv2.IMREAD_UNCHANGED)
    if im.shape[2] == 3:
        im = np.dstack([im, np.full(im.shape[:2], 255, np.uint8)])
    return im


def defringe(rgba, px=2):
    """Pull the matte in and flood interior colour outward.

    u2net returns a soft edge that still carries a rim of the ORIGINAL
    background -- on the mammoth, cut from a pale studio grey and dropped
    onto snow, that rim read as a hard dark outline and made the whole
    composite look pasted. Two things fix it and both are needed: shrink the
    alpha by a pixel or two so the contaminated ring is simply not drawn,
    and dilate the interior colour outward underneath so the pixels that
    remain semi-transparent carry the SUBJECT's colour rather than the old
    background's.
    """
    a = rgba[..., 3]
    k = np.ones((3, 3), np.uint8)
    inner = cv2.erode(a, k, iterations=px)
    # interior colour spread outward, so the soft edge samples the subject
    solid = (inner > 200).astype(np.uint8)
    rgb = rgba[..., :3].copy()
    for _ in range(px + 2):
        d = cv2.dilate(solid, k)
        grow = (d > 0) & (solid == 0)
        blur = cv2.medianBlur(rgb, 5)
        rgb[grow] = blur[grow]
        solid = d
    out = rgba.copy()
    out[..., :3] = rgb
    out[..., 3] = cv2.GaussianBlur(inner, (0, 0), 0.8)
    return out


def trim(rgba, thresh=8):
    """Crop to the alpha bounding box, so `height_px` means the FIGURE."""
    a = rgba[..., 3]
    ys, xs = np.where(a > thresh)
    if len(ys) == 0:
        return rgba
    return rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def light_match(rgb, alpha, plate_patch, amount=0.55):
    """Pull the cutout's colour and exposure toward the plate it lands in.

    Mean-and-spread matching per channel, over the OPAQUE pixels only --
    including the transparent ones drags everything toward black and the
    figure comes out muddy. `amount` keeps some of the original grade so the
    figure does not dissolve into the background entirely.
    """
    m = alpha > 0.5
    if m.sum() < 50 or plate_patch.size == 0:
        return rgb
    out = rgb.astype(np.float32).copy()
    for c in range(3):
        s = out[..., c][m]
        d = plate_patch[..., c].astype(np.float32)
        ss, ds = s.std() + 1e-3, d.std() + 1e-3
        adj = (s - s.mean()) * (ds / ss) + d.mean()
        blend = s * (1 - amount) + adj * amount
        ch = out[..., c]
        ch[m] = np.clip(blend, 0, 255)
    return out


def shadow(plate, foot, w, h, sun=(-0.55, 0.35), strength=0.62):
    """Soft cast shadow PLUS a tight ambient-occlusion core under the feet.

    The first version drew one wide soft ellipse and it was nearly
    invisible against sunlit quartzite -- the figures still read as
    floating. Hard midday light does two separate things and they need
    drawing separately:

      CAST  a defined ellipse thrown away from the sun, short because the
            sun is high, and only lightly blurred because the light is hard.
      CORE  a small very dark patch immediately under the contact point,
            where no light reaches at all. This is the one the eye reads as
            "touching", and it has to be tight -- blur it wide and it turns
            back into the grey smudge that did not work.
    """
    H, W = plate.shape[:2]
    m = np.zeros((H, W), np.float32)

    ex, ey = int(w * 0.46), max(5, int(h * 0.045))
    cx = int(foot[0] + sun[0] * ex * 0.55)
    cy = int(foot[1] + sun[1] * ey * 1.1)
    cv2.ellipse(m, (cx, cy), (ex, ey), 0, 0, 360, 0.80, -1)
    m = cv2.GaussianBlur(m, (0, 0), max(3.0, ex * 0.11))

    core = np.zeros((H, W), np.float32)
    cex, cey = max(4, int(w * 0.30)), max(3, int(h * 0.016))
    cv2.ellipse(core, (int(foot[0]), int(foot[1])), (cex, cey), 0, 0, 360, 1.0, -1)
    core = cv2.GaussianBlur(core, (0, 0), max(2.0, cex * 0.22))

    m = np.clip(m + core * 0.85, 0, 1.0) * strength
    return plate * (1.0 - m[..., None])


def place(plate, rgba, foot, height_px, k=1.0, sun=(-0.55, 0.35),
          depth=None, subj_depth=0.55, reveal=True, match=0.55):
    """Composite one figure. `foot` is where its feet meet the ground.

    k drives the AR reveal: 0 nothing, 1 fully present.
    """
    if k <= 0:
        return plate
    fig = trim(defringe(rgba))
    fh, fw = fig.shape[:2]
    if fh < 2:
        return plate
    s = float(height_px) / fh
    nw, nh = max(2, int(fw * s)), max(2, int(height_px))
    fig = cv2.resize(fig, (nw, nh), interpolation=cv2.INTER_AREA)

    H, W = plate.shape[:2]
    x0 = int(foot[0] - nw / 2)
    y0 = int(foot[1] - nh)
    x1, y1 = x0 + nw, y0 + nh
    sx0, sy0 = max(0, -x0), max(0, -y0)
    dx0, dy0 = max(0, x0), max(0, y0)
    dx1, dy1 = min(W, x1), min(H, y1)
    if dx1 <= dx0 or dy1 <= dy0:
        return plate
    fig = fig[sy0:sy0 + (dy1 - dy0), sx0:sx0 + (dx1 - dx0)]

    out = shadow(plate, foot, nw, nh, sun, strength=0.52 * min(1.0, k * 1.4))

    patch = out[dy0:dy1, dx0:dx1]
    # `match` is per-subject on purpose. 0.55 is right for a FIGURE, which
    # is small and should take the colour of the rock it stands on. It is
    # wrong for a BUILDING: the mill lands against a lawn, and at 0.55 the
    # light match pulled seven storeys of stone green.
    rgb = light_match(fig[..., :3], fig[..., 3] / 255.0, patch, amount=match)
    a = (fig[..., 3:4].astype(np.float32) / 255.0)

    if reveal:
        # a resolve line rising from the feet
        yy = np.linspace(1.0, 0.0, fig.shape[0], dtype=np.float32)[:, None, None]
        edge = np.clip((k * 1.25 - yy) * 6.0, 0.0, 1.0)
        a = a * edge
        # thin warm rim on the resolve line itself
        band = np.clip(1.0 - np.abs(yy - k * 1.25) * 26.0, 0, 1) * (k < 0.92)
        rgb = rgb + np.float32(GLOW) * (band * (fig[..., 3:4] / 255.0) * 0.85)
    else:
        a = a * k

    out[dy0:dy1, dx0:dx1] = patch * (1 - a) + np.clip(rgb, 0, 255) * a

    if depth is not None:
        d = depth[dy0:dy1, dx0:dx1]
        near = np.clip((d - subj_depth) * 9.0, 0, 1)[..., None]
        out[dy0:dy1, dx0:dx1] = (out[dy0:dy1, dx0:dx1] * (1 - near)
                                 + patch * near)
    return out
