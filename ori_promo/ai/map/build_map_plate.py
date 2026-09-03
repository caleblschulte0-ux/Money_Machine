#!/usr/bin/env python3
"""Builds ai/map/park_map_plate.png -- the real photo base for the `map`
beat (one/map_overlay.py, one/spec_one.py). Run from the repo root:

    python3 ai/map/build_map_plate.py

WHY THIS EXISTS, RATHER THAN A COMMITTED PNG. Every other generated plate
in this project (ai/settlers.png, ai/iceage.png, ...) is reproducible from
a script (gen_ai.py) rather than carried as a binary nobody can re-derive.
This is the same discipline applied to a REAL photo instead of a generated
one: the plate is not hand-edited or hand-cropped in an image tool, it is
pulled from the raw clip at a fixed, documented timestamp, so the exact
same file comes out of a fresh checkout.

THE SOURCE FRAME. raw/IMG_6803.MOV, t=1.0s -- the same clip the `off` beat
uses two beats later, at the one moment in its 7.1s runtime before the
wearer leans onto the rail. Above y=365 the frame is completely clear of
him: mill ruin, the falls, the winding paths, green fields, the city
skyline. That crop is the ENTIRE photographic content of the plate --
nothing below y=365 in the source frame is used, because that is where he
is.

Below the photo, a soft defocused fade (a blurred, stretched echo of the
photo's own last rows, opacity ramping to zero) into the film's own dark
palette, where one/map_overlay.py draws the legend key. This is
deliberately NOT the same move as the darkened/blurred "minimalist map"
the operator rejected (trailer/v7_ui.py's z_map.mp4 lineage) -- that
treatment darkened the WHOLE photo into near-illegibility and drew a
synthetic path over it. Here the photo itself is never darkened or
degraded; only the card it sits in fades away beneath it.
"""
import os
import subprocess
import sys

import cv2
import numpy as np

_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(_ROOT, "raw")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "park_map_plate.png")

W, H = 1920, 1080
SRC_CLIP = "6803"
SRC_T = 1.0
PHOTO_H = 365          # crop above this row is clear of the wearer at SRC_T


def _grab_frame():
    r = subprocess.run(
        ["ffmpeg", "-v", "error", "-ss", str(SRC_T), "-i", f"{RAW}/IMG_{SRC_CLIP}.MOV",
         "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"],
        capture_output=True)
    if len(r.stdout) < W * H * 3:
        raise SystemExit(f"IMG_{SRC_CLIP}.MOV@{SRC_T}: expected {W}x{H} frame, "
                          f"got {len(r.stdout)} bytes")
    return np.frombuffer(r.stdout[:W * H * 3], np.uint8).reshape(H, W, 3).copy()


def build():
    frame = _grab_frame()
    photo = frame[0:PHOTO_H, 0:W].astype(np.float32)

    canvas = np.zeros((H, W, 3), np.float32)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    v = np.clip(22 - np.abs(yy - 540) / 1080 * 10, 6, 22)
    canvas[..., 0] = v * 0.95
    canvas[..., 1] = v
    canvas[..., 2] = v * 1.10

    y0 = 138          # lands the photo just inside the 2.39 scope bar
    canvas[y0:y0 + PHOTO_H, 0:W] = photo

    # soft defocused echo of the photo's own bottom rows, fading to 0
    src = photo[-120:]
    fade_h = 170
    stretched = cv2.resize(src, (W, fade_h), interpolation=cv2.INTER_LINEAR)
    stretched = cv2.GaussianBlur(stretched, (0, 0), 14)
    for i in range(fade_h):
        a = (1.0 - i / fade_h) ** 1.6
        canvas[y0 + PHOTO_H + i, 0:W] = (
            canvas[y0 + PHOTO_H + i, 0:W] * (1 - a) + stretched[i] * a)

    cv2.imwrite(OUT, canvas.astype(np.uint8))
    print(f"  wrote {OUT} ({W}x{H}, photo band y={y0}-{y0+PHOTO_H})")


SYNC_OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                        "park_sync_plate.png")


def build_sync():
    """A TIGHTER PUSH-IN on the same photo, for the group-sync beat.

    The sync beat sits directly after the map beat and says something new
    about the same ground, so it uses the same real photograph moved in
    closer rather than a second location -- a viewer reads that as "same
    park, closer look", where cutting to an unrelated plate would read as
    a new place. Cropping the middle also puts the two group clusters
    (one/sync_overlay.py) over open lawn and path, where dots and arcs are
    legible, instead of over the busy rock shelf.
    """
    frame = _grab_frame()
    # centre of the park layout, then scaled back up to full width
    crop = frame[40:PHOTO_H, 430:1500]
    band = cv2.resize(crop, (W, int(round(crop.shape[0] * W / crop.shape[1]))),
                      interpolation=cv2.INTER_CUBIC).astype(np.float32)
    bh = band.shape[0]

    canvas = np.zeros((H, W, 3), np.float32)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    v = np.clip(22 - np.abs(yy - 540) / 1080 * 10, 6, 22)
    canvas[..., 0] = v * 0.95
    canvas[..., 1] = v
    canvas[..., 2] = v * 1.10

    y0 = 138
    keep = min(bh, 942 - y0)
    canvas[y0:y0 + keep, 0:W] = band[:keep]

    src = band[max(0, keep - 120):keep]
    fade_h = min(170, H - (y0 + keep))
    if fade_h > 0 and src.shape[0] > 0:
        stretched = cv2.GaussianBlur(
            cv2.resize(src, (W, fade_h), interpolation=cv2.INTER_LINEAR), (0, 0), 14)
        for i in range(fade_h):
            a = (1.0 - i / fade_h) ** 1.6
            canvas[y0 + keep + i, 0:W] = (
                canvas[y0 + keep + i, 0:W] * (1 - a) + stretched[i] * a)

    cv2.imwrite(SYNC_OUT, canvas.astype(np.uint8))
    print(f"  wrote {SYNC_OUT} ({W}x{H}, photo band y={y0}-{y0+keep})")


def ensure_clip(dst=None, dur=8.0, fps=30, src=None):
    """The `map` beat reads raw/IMG_MAP1.MOV like any other plate --
    render_one.py has no path for a bare still image. This holds the built
    plate static for `dur` seconds so it exists as an ordinary clip; it is
    regenerated here rather than committed, same reasoning as the plate
    itself.
    """
    dst = dst or os.path.join(RAW, "IMG_MAP1.MOV")
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-loop", "1", "-i", src or OUT, "-t", str(dur),
         "-r", str(fps), "-pix_fmt", "yuv420p", dst], check=True)
    print(f"  wrote {dst} ({dur}s static hold)")


def ensure_sync_clip(dst=None, dur=8.0, fps=30):
    ensure_clip(dst or os.path.join(RAW, "IMG_MAP2.MOV"), dur, fps, src=SYNC_OUT)


if __name__ == "__main__":
    build()
    ensure_clip()
    build_sync()
    ensure_sync_clip()
