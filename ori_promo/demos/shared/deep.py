#!/usr/bin/env python3
"""DEMO 4 elements: a subsurface aperture, and readouts that show a MEASURED
value without asserting a fabricated one.

Two rules govern everything in here.

1. THE SUBSURFACE IS A VISUALISATION AND SAYS SO. Nothing below ground was
   photographed, so the aperture carries a VISUALISATION tag and the bands are
   named by MATERIAL, never by a depth, an age, or a date. The surface geology
   of this site -- glacial material over Sioux quartzite -- is the ordering
   shown. No number we cannot stand behind appears anywhere in the frame.

2. THE READOUTS SHOW REAL MEASUREMENTS WITH NO INVENTED UNITS. A meter that
   reads "2.4 m/s" would be a fabrication; a meter that reads a filled bar
   labelled RELATIVE SURFACE VELOCITY is the actual normalised magnitude of
   the optical flow we computed from the picture. It is honest and it still
   reads, at a glance, as an instrument.

The aperture's band direction is taken from the depth map's gradient at the
anchor, so the layers lie along the ground plane instead of across the screen.
That is the part a graphic pasted in an edit would not do.
"""
import numpy as np, cv2
from PIL import Image, ImageDraw

# Material ordering for this site, surface downward. Names only.
# Colours chosen so the four bands are four bands. The first set ran
# 168/150/196/142 in red and read as two. Sioux quartzite really is pink-red,
# which is also the rock in shot, so the deep bands tie to what the viewer can
# already see at the surface.
BANDS = [
    ("SOIL / GLACIAL TILL",   (148, 126,  96), 0.22),
    ("WEATHERED ZONE",        (186, 158, 130), 0.16),
    ("SIOUX QUARTZITE",       (206, 118,  98), 0.30),
    ("QUARTZITE / MASSIVE",   (124,  82,  78), 0.32),
]

RIM = (150, 232, 244)


def ground_angle(depth, centre, r=140):
    """Tilt of the ground plane at the anchor, from the depth map's gradient.

    Layers drawn perpendicular to the depth gradient lie ALONG the surface.
    Returns radians. Falls back to level when the patch is flat or off-frame.
    """
    h, w = depth.shape[:2]
    cx, cy = int(centre[0]), int(centre[1])
    x0, y0 = max(0, cx - r), max(0, cy - r)
    x1, y1 = min(w, cx + r), min(h, cy + r)
    if x1 - x0 < 16 or y1 - y0 < 16:
        return 0.0
    sub = cv2.GaussianBlur(depth[y0:y1, x0:x1].astype(np.float32), (0, 0), 9)
    gx = float(np.mean(cv2.Sobel(sub, cv2.CV_32F, 1, 0, ksize=5)))
    gy = float(np.mean(cv2.Sobel(sub, cv2.CV_32F, 0, 1, ksize=5)))
    if abs(gx) + abs(gy) < 1e-7:
        return 0.0
    # layers run perpendicular to the gradient
    a = float(np.arctan2(gx, -gy))
    # Keep it a TILT, not a rotation. At +-0.30 every test plate saturated the
    # clamp and the bands ran diagonally across the hole, which reads as a
    # tilted disc lying on the ground rather than a section through it.
    return float(np.clip(a, -0.12, 0.12))


def aperture(base_bgr, centre, r, k, angle=0.0, reveal=1.0, tint=(0, 0, 0)):
    """Open a window into the ground and fill it with material bands.

    The first build of this made a pale oval that read as a lens flare on a
    sidewalk -- a stain, not a hole. What was missing was THICKNESS: an
    interior dark enough to be a cavity, a shadow just inside the rim so the
    ground has an edge, and bands opaque enough to be material rather than a
    tint. Those three are the difference between a hole and a smudge.

    base_bgr : float32 HxWx3 picture, modified copy returned
    k        : 0..1 open amount (radius eases with it)
    reveal   : 0..1 how far down the bands have filled in
    """
    H, W = base_bgr.shape[:2]
    cx, cy = float(centre[0]), float(centre[1])
    rr = max(2.0, r * k)
    ry = rr * 0.72                                  # a hole in the ground, seen obliquely
    x0, y0 = int(max(0, cx - rr - 6)), int(max(0, cy - ry - 6))
    x1, y1 = int(min(W, cx + rr + 6)), int(min(H, cy + ry + 6))
    if x1 - x0 < 6 or y1 - y0 < 6:
        return base_bgr
    yy, xx = np.mgrid[y0:y1, x0:x1].astype(np.float32)
    ex = (xx - cx) / rr
    ey = (yy - cy) / ry
    rad = np.hypot(ex, ey)
    inside = np.clip((1.0 - rad) * max(4.0, ry * 0.30), 0, 1)      # hard edge, soft by 2-3px

    if inside.max() <= 0:
        return base_bgr

    # distance DOWN the layer stack, along the ground plane's normal
    ca, sa = np.cos(angle), np.sin(angle)
    depth_axis = ((yy - cy) * ca - (xx - cx) * sa) / max(1e-3, ry)  # -1 top .. +1 bottom
    # BOWL THE BANDS. Straight boundaries make a flat disc; a hole you look
    # into shows its far wall curving away at the sides, so the layers arc.
    depth_axis = depth_axis + 0.30 * (ex * ex)
    frac = np.clip((depth_axis + 1.0) / 2.0, 0, 1)

    fill = np.zeros((y1 - y0, x1 - x0, 3), np.float32)
    edge = np.zeros((y1 - y0, x1 - x0), np.float32)
    acc = 0.0
    for name, col, hgt in BANDS:
        lo, hi = acc, acc + hgt
        acc = hi
        m = ((frac >= lo) & (frac < hi)).astype(np.float32)
        fill += m[..., None] * np.array(col[::-1], np.float32)     # BGR
        if lo > 0.001:
            edge = np.maximum(edge, np.clip(1.0 - np.abs(frac - lo) * max(9.0, ry) / 2.0, 0, 1))
    # the far wall is lit, the bottom of the hole falls into shadow
    shade = 0.62 + 0.38 * np.clip(1.0 - frac * 1.15, 0, 1)
    fill *= shade[..., None]
    # bands fill in downward as the reading completes
    grow = np.clip((reveal - frac) * 7.0, 0, 1)
    fill *= np.clip(grow + 0.10, 0, 1)[..., None]
    edge *= grow

    sub = base_bgr[y0:y1, x0:x1]
    a = (inside * k)[..., None]
    cavity = sub * 0.10                                   # it is a HOLE
    body = cavity * 0.22 + fill * 0.78
    out = sub * (1 - a) + body * a
    # inner shadow: the ground has a thickness you are looking over
    lip = np.clip((rad - 0.86) / 0.14, 0, 1) * inside * k
    out *= (1.0 - 0.55 * lip)[..., None]
    # boundary lines between materials
    ea = (edge * inside * k)[..., None] * 0.95
    out = out * (1 - ea) + np.array(RIM[::-1], np.float32) * ea
    base_bgr[y0:y1, x0:x1] = out
    return base_bgr


def band_anchor(centre, r, k, angle, idx):
    """Where band `idx` sits on the aperture's right edge -- so its name can be
    joined to the actual band by a leader instead of floating in a legend."""
    cx, cy = float(centre[0]), float(centre[1])
    rr = max(2.0, r * k); ry = rr * 0.72
    acc = 0.0
    for j, (_, _, hgt) in enumerate(BANDS):
        if j == idx:
            mid = acc + hgt / 2.0
            break
        acc += hgt
    else:
        mid = 0.5
    d = mid * 2.0 - 1.0                                   # -1 top .. +1 bottom
    ca, sa = np.cos(angle), np.sin(angle)
    # a point on the band, pushed out to the ellipse edge on the right
    ex = float(np.sqrt(max(0.0, 1.0 - min(1.0, d * d)))) * 0.94
    px = cx + (ex * rr) * ca + (d * ry) * sa
    py = cy + (d * ry) * ca + (ex * rr) * sa
    return px, py


def rim(d, centre, r, k, col=RIM, a=235, ticks=24):
    """The window's edge, with ticks -- an instrument aperture, not a vignette."""
    cx, cy = centre
    rr = max(2.0, r * k)
    ry = rr * 0.72                       # must match aperture(); it did not, and
    al = int(a * k)                      # the rim sat outside the hole it framed
    d.ellipse([cx - rr, cy - ry, cx + rr, cy + ry], outline=col + (al,), width=3)
    for i in range(ticks):
        th = 2 * np.pi * i / ticks
        L = 12 if i % 6 else 22
        x0, y0 = cx + np.cos(th) * rr, cy + np.sin(th) * ry
        x1, y1 = cx + np.cos(th) * (rr + L), cy + np.sin(th) * (ry + L * 0.78)
        d.line([(x0, y0), (x1, y1)], fill=col + (int(al * 0.75),), width=2)


def meter(d, xy, w, label, value, k, f_lab, f_val, col=RIM,
          ink=(250, 250, 248), shadow=(5, 8, 10)):
    """A filled bar with a NAME and no unit. The fill is the real normalised
    measurement; there is no number on screen to be wrong about."""
    x, y = xy
    al = int(240 * k)
    sh = int(150 * k)
    d.text((x + 2, y + 2), label, font=f_lab, fill=shadow + (sh,), anchor="ls")
    d.text((x, y), label, font=f_lab, fill=ink + (al,), anchor="ls")
    by = y + 16
    d.rectangle([x + 2, by + 2, x + w + 2, by + 16], fill=shadow + (int(sh * 0.8),))
    d.rectangle([x, by, x + w, by + 14], outline=col + (int(al * 0.7),), width=2)
    fw = max(0.0, min(1.0, value)) * (w - 6) * k
    if fw > 1:
        d.rectangle([x + 3, by + 3, x + 3 + fw, by + 11], fill=col + (al,))
