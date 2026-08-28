#!/usr/bin/env python3
"""The film look. Grade, grain, vignette, scope framing.

OPERATOR on v10: "it still looks like a middle school iMovie outside of
that [the AI overlays]."

He is right and the cause is not the graphics. Every frame in this film
has been UNGRADED PHONE FOOTAGE with vector art drawn on top. shotnorm
matches the plates to each other, which stops them flashing against one
another, but matching is not a LOOK -- it leaves midday iPhone video
exactly as midday iPhone video: flat, bright, blue-heavy in the sky,
clipped in the highlights, and dead in the shadows. Put a clean HUD over
that and you get a school project, because a school project is precisely
"unprocessed footage plus overlays".

Four things, in the order light actually meets a camera:

  GRADE     a filmic S-curve with a real toe and shoulder, so highlights
            roll off instead of clipping and the shadows have some depth
            in them. Then a gentle split-tone -- shadows a touch cooler,
            highlights a touch warmer -- which is what nearly every graded
            film does and what no phone does.
  VIGNETTE  barely there. It exists to stop the eye leaving the frame.
  GRAIN     fine and MOVING. Static grain reads as noise; moving grain
            reads as film, and it also breaks up the banding that a
            heavy grade leaves in a big flat sky.
  SCOPE     2.39:1. The single strongest signal in this list and the
            cheapest: nothing that arrives in a 2.39 frame gets mistaken
            for a phone video.

Applied per beat, not per shot, so the film is one piece of material.
"""
import numpy as np
import cv2

SCOPE = 2.39


# The tone curve, as explicit control points rather than a formula.
# FIRST ATTEMPT WAS AN UNCHARTED-STYLE FILMIC TONEMAP and it made the
# picture WORSE: those curves are built to compress HDR into a display
# range, so they lift the toe hard. Measured on the same frame it mapped
#   51 -> 66   102 -> 124   153 -> 173
# which is a contrast REDUCTION through the whole midtone, and the rock
# came back milkier than the ungraded phone footage. The problem here is
# the opposite of HDR compression: the source is flat, low-contrast SDR
# that needs depth put INTO it.
# So: shadows go down, mids stay honest, highlights roll off. Written as
# points so the mapping can be read and argued with instead of tuned by
# feel through an opaque formula.
# r92: "pale quartzite and water lose texture ... preserve another step of
# texture in the upper midtones/highlights". The shoulder was too hard --
# 191->202 and 229->237 pushed the bright rock and the falls toward the
# same pale value, so the two stopped being distinguishable. Softened at
# the top while the toe and the midtone contrast, which are what put depth
# into flat phone footage, stay exactly as they were.
_CP_X = np.float32([0.00, 0.05, 0.20, 0.40, 0.55, 0.75, 0.90, 1.00])
_CP_Y = np.float32([0.00, 0.028, 0.165, 0.395, 0.565, 0.772, 0.902, 0.972])


def _curve(x):
    return np.interp(x, _CP_X, _CP_Y).astype(np.float32)


def grade(bgr, strength=1.0, warm=1.0):
    """Filmic curve + split tone. bgr float 0..255, returns the same."""
    x = np.clip(bgr, 0, 255).astype(np.float32) / 255.0
    y = _curve(x)

    # split tone: cool the shadows, warm the highlights, by luminance
    lum = (0.114 * y[..., 0] + 0.587 * y[..., 1] + 0.299 * y[..., 2])[..., None]
    shadow = np.clip(1.0 - lum * 1.9, 0, 1)
    high = np.clip((lum - 0.42) * 1.7, 0, 1)
    y = y + shadow * np.float32([0.030, 0.006, -0.016]) * warm
    y = y + high * np.float32([-0.020, 0.004, 0.026]) * warm

    # SATURATION. r92: "at 11.9-14.0 seconds the grass is unnaturally
    # vivid ... reduce yellow-green saturation more strongly". The first
    # half is right; the second half is not implementable on this footage
    # and I tried before deciding that.
    # NO HUE KEY. Measured on the actual plates: the mown lawn sits at hue
    # 60-73 and the quartzite outcrop three metres from it at 38-138 --
    # they overlap. render_one already carries a note recording three
    # failed attempts to key vegetation on this footage for the ice grade,
    # for the same reason: this is high midday sun on yellow-green grass
    # beside warm pink rock, and nothing separates them by colour. A hue
    # band tuned to kill the lawn desaturates the rock with it.
    # So the lawn is tamed the only way that is honest here -- globally,
    # accepting slightly less colour in the rock as the price. That is the
    # same conclusion the ice grade reached by the same evidence.
    g = (0.114 * y[..., 0] + 0.587 * y[..., 1] + 0.299 * y[..., 2])[..., None]
    y = g + (y - g) * 0.88

    out = np.clip(y, 0, 1) * 255.0
    return bgr * (1.0 - strength) + out * strength


_GRAIN = None


def _grain_bank(h, w, n=12, seed=5):
    global _GRAIN
    if _GRAIN is None or _GRAIN[0].shape != (h, w):
        rng = np.random.default_rng(seed)
        # generated at half res and scaled up: real grain is not per-pixel
        bank = []
        for _ in range(n):
            g = rng.standard_normal((h // 2, w // 2)).astype(np.float32)
            g = cv2.GaussianBlur(g, (0, 0), 0.6)
            bank.append(cv2.resize(g, (w, h), interpolation=cv2.INTER_LINEAR))
        _GRAIN = bank
    return _GRAIN


_VIG = None


def _vignette(h, w):
    global _VIG
    if _VIG is None or _VIG.shape[:2] != (h, w):
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        cx, cy = w / 2.0, h / 2.0
        r = np.sqrt(((xx - cx) / cx) ** 2 + ((yy - cy) / cy) ** 2) / 1.4142
        _VIG = np.clip(1.0 - 0.30 * np.clip(r - 0.45, 0, 1) ** 1.7, 0, 1)[..., None]
    return _VIG


def finish(bgr, frame_i, grain=5.0, scope=SCOPE):
    """Vignette, moving grain, and the scope frame. Last thing that runs."""
    h, w = bgr.shape[:2]
    out = bgr * _vignette(h, w)
    if grain > 0:
        bank = _grain_bank(h, w)
        out = out + bank[frame_i % len(bank)][..., None] * grain
    out = np.clip(out, 0, 255)
    if scope:
        bar = int(round((h - w / scope) / 2.0))
        if bar > 0:
            out[:bar] = 0.0
            out[h - bar:] = 0.0
    return out


def safe_area(h, w, scope=SCOPE):
    """(top, bottom) of the visible image once the scope bars are on."""
    bar = int(round((h - w / scope) / 2.0))
    return bar, h - bar
