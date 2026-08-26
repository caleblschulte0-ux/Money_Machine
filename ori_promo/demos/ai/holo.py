#!/usr/bin/env python3
"""Turn a generated illustration into an AR RECONSTRUCTION layer.

This module exists because of a safety rule, not a taste. The standing
constraint on this project is that AR content is a VISUALISATION and never
evidence: nothing may pass as a historical photograph, and no date, caption or
attribution may be asserted. Asking an image generator to obey that produced
four cinematic renders that obeyed none of it. So the rule is enforced HERE,
by a transform, on whatever image arrives -- ChatGPT's or mine.

What comes out cannot be mistaken for a photograph: it is structure only, in
one colour, on transparency, with the volume rendered as translucent shells.
It is also the correct look, because that is what a head-up display putting
something into a real place would actually be able to draw.

    layer = reconstruct(bgr)          # -> HxWx4 uint8, black transparent
    out   = composite(plate, layer, rect, k)   # additive, with an assemble-in

Nothing here raises on a bad image; a source that yields no structure returns
an empty layer, which composites to nothing.
"""
import numpy as np
import cv2

CYAN = (246, 226, 150)          # BGR -- cool white-cyan, matches the AR labels


def _structure(g):
    """Edges at two scales plus gradient magnitude, as one 0..1 map.

    Two scales because one is never right: fine Canny finds window mullions and
    misses the roofline, coarse Canny finds the roofline and drops the windows.
    """
    g = cv2.bilateralFilter(g, 7, 60, 60)
    fine = cv2.Canny(g, 45, 130)
    coarse = cv2.Canny(cv2.GaussianBlur(g, (0, 0), 2.6), 25, 80)
    gx = cv2.Sobel(g, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(g, cv2.CV_32F, 0, 1, ksize=3)
    mag = np.hypot(gx, gy)
    mag = mag / max(1e-6, float(np.percentile(mag, 99.0)))
    e = np.maximum(fine.astype(np.float32) / 255.0,
                   coarse.astype(np.float32) / 255.0 * 0.85)
    e = np.maximum(e, np.clip(mag - 0.30, 0, 1) * 0.65)
    return np.clip(e, 0, 1)


def _volume(g, shells=5):
    """Translucent interior shells, so the thing has body and not just an
    outline. Quantised luminance, each step drawn very faint."""
    b = cv2.GaussianBlur(g, (0, 0), 3.2).astype(np.float32) / 255.0
    q = np.clip((b * shells).astype(np.int16), 0, shells - 1).astype(np.float32)
    return (q / max(1, shells - 1)) * 0.30


def _subject_mask(g, e=None):
    """Where the subject is, so a plain generated background does not arrive as
    a rectangle of haze.

    DERIVED FROM STRUCTURE, not from Otsu. The first version thresholded
    luminance and flipped polarity when the result looked too bright. That
    guess was wrong whenever the subject was DARK against a light background:
    the water wheel came back with a mask covering 12% of the frame -- the
    stone wall behind it -- and the wheel itself composited to nothing. Where
    there are edges is where the subject is, and that holds either way round.
    """
    if e is None:
        e = _structure(g)
    m = (cv2.GaussianBlur(e, (0, 0), 9.0) > 0.035).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((31, 31), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((9, 9), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m, 8)
    keep = np.zeros(g.shape, np.float32)
    tot = float(g.size)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] / tot >= 0.015:
            keep[lab == i] = 1.0
    if keep.max() <= 0:
        keep[:] = 1.0
    return cv2.GaussianBlur(keep, (0, 0), 7.0)


def reconstruct(bgr, col=CYAN, scan=True):
    """-> HxWx4 uint8 reconstruction layer, transparent where there is nothing."""
    if bgr is None or bgr.size == 0:
        return np.zeros((1, 1, 4), np.uint8)
    g = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    e = _structure(g)
    v = _volume(g)
    sm = _subject_mask(g, e)
    # Structure carries this, not volume. The first mix ran edges 1.0 against
    # volume 0.55 with a 0.55 bloom on top, and over a sunlit plate the result
    # was an even haze in which the building could not be read at all. Volume
    # is now a hint under the lines rather than a partner to them.
    a = np.clip(e * 1.0 + v * 0.22, 0, 1) * sm
    a = np.clip(a + cv2.GaussianBlur(a, (0, 0), 4.0) * 0.30, 0, 1)
    a = np.clip((a - 0.10) / 0.90, 0, 1) ** 0.85
    if scan:
        h = a.shape[0]
        lines = 0.82 + 0.18 * np.sin(np.arange(h, dtype=np.float32) * np.pi / 2.6)
        a *= lines[:, None]
    rgb = np.zeros(bgr.shape, np.float32)
    rgb[..., 0] = col[0]; rgb[..., 1] = col[1]; rgb[..., 2] = col[2]
    # the brightest structure goes white, so it does not read as a flat tint
    hot = np.clip((a - 0.55) / 0.45, 0, 1)[..., None]
    rgb = rgb * (1 - hot) + np.float32([255, 255, 255]) * hot
    return np.dstack([rgb, np.clip(a * 255.0, 0, 255)]).astype(np.uint8)


def occupancy(layer, grow=13, blur=17):
    """A soft filled footprint of the reconstruction -- used to DIM the plate
    behind it. A head-up display darkens the world where it draws; without
    that, a translucent structure over a sunlit rock shelf simply loses."""
    a = layer[..., 3].astype(np.float32) / 255.0
    f = cv2.dilate(a, np.ones((grow, grow), np.uint8))
    f = cv2.GaussianBlur(f, (0, 0), blur)
    return np.clip(f * 1.7, 0, 1)


def composite(plate_bgr, layer, rect, k=1.0, build=1.0, gain=1.0, dim=0.78):
    """Add the reconstruction into the plate.

    rect  : (x, y, w, h) in plate pixels
    k     : 0..1 overall presence
    build : 0..1 assemble-in -- the structure resolves from the ground up, the
            way a system that is still solving would actually reveal it
    ADDITIVE, not alpha-over: a head-up display adds light to the scene, it
    does not punch a hole in it. Alpha-over is what made the earlier films'
    elements look like stickers.
    """
    if k <= 0 or layer is None or layer.size <= 4:
        return plate_bgr
    x, y, w, h = [int(v) for v in rect]
    H, W = plate_bgr.shape[:2]
    if w < 4 or h < 4:
        return plate_bgr
    lay = cv2.resize(layer, (w, h), interpolation=cv2.INTER_LINEAR)
    occ = cv2.resize(occupancy(layer), (w, h), interpolation=cv2.INTER_LINEAR)
    a = lay[..., 3].astype(np.float32) / 255.0
    if build < 1.0:
        yy = np.linspace(1.0, 0.0, h, dtype=np.float32)[:, None]   # 1 at top
        front = 1.0 - build
        reveal = np.clip((yy - front) * -8.0 + 1.0, 0, 1)
        a *= reveal
        occ *= reveal
        # a bright edge where it is currently resolving
        a += np.clip(1.0 - np.abs(yy - front) * 26.0, 0, 1) * 0.55
    a = np.clip(a * k * gain, 0, 1)
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(W, x + w), min(H, y + h)
    if x1 <= x0 or y1 <= y0:
        return plate_bgr
    sa = a[y0 - y:y1 - y, x0 - x:x1 - x][..., None]
    so = occ[y0 - y:y1 - y, x0 - x:x1 - x][..., None] * (dim * k)
    sr = lay[y0 - y:y1 - y, x0 - x:x1 - x, :3].astype(np.float32)
    sub = plate_bgr[y0:y1, x0:x1].astype(np.float32)
    plate_bgr[y0:y1, x0:x1] = np.clip(sub * (1.0 - so) + sr * sa * 1.15, 0, 255)
    return plate_bgr


def fit_rect(layer, centre, height, aspect_from_layer=True):
    """A rect of the given HEIGHT centred on a point, keeping the layer's
    aspect. Sizing by height is what keeps a building looking like a building
    when the source images come back at different shapes."""
    lh, lw = layer.shape[:2]
    ar = (lw / float(lh)) if aspect_from_layer and lh else 1.6
    w = height * ar
    return (centre[0] - w / 2.0, centre[1] - height / 2.0, w, height)
