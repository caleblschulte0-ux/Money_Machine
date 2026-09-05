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

Below the photo, a short fade into the film's own dark palette (the
photo's own last row, sharp, dissolved by opacity alone -- see build()'s
comment for why this is NOT a blur), where one/map_overlay.py draws the
legend key. This is deliberately NOT the same move as the darkened/
blurred "minimalist map" the operator rejected (trailer/v7_ui.py's
z_map.mp4 lineage) -- that treatment darkened the WHOLE photo into
near-illegibility and drew a synthetic path over it. Here the photo
itself is never darkened, blurred, or degraded; only the card it sits in
fades away beneath it.
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
CROP_H = 365           # crop above this row is clear of the wearer at SRC_T
PHOTO_H = 720          # the BUILT plate's photo band height -- see v23 note

# v23: THE MAP LOOKED LIKE A THUMBNAIL, NOT A MAP. Operator: "the map looks
# like shit." v21/v22 held the real crop at its native 365px and let it sit
# as a thin strip across the top third of the frame, with the bottom two
# thirds empty dark card waiting for a legend -- next to nothing to look
# at. The photo itself was never the complaint (it is real, un-degraded
# footage); the PRESENTATION was a small picture floating in a mostly
# empty frame, which reads as unfinished, not as a map.
# Fix: the crop is stretched vertically (2x, 365 -> 720) to fill nearly
# the whole 2.39 visible window (138-942) instead of a third of it. This
# is an ANAMORPHIC stretch, not a crop -- cropping to fill height would
# have thrown away either the mill (left edge) or the rapids (right edge),
# since between them the four landmarks already span the crop's full
# width. A stretch keeps all four in frame at the cost of slightly taller
# proportions on the buildings, which a moving-grain, vignetted, graded
# frame does not make obvious. The legend moves from a separate dark
# section below the photo to a compact inset card OVER the photo's own
# calm grass area (see one/map_overlay.py) -- a floating key, the way a
# real map's legend sits on the map, not a second slide underneath it.


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
    crop = frame[0:CROP_H, 0:W]
    crop = cv2.bilateralFilter(crop, 7, 40, 40)
    photo = cv2.resize(crop.astype(np.float32), (W, PHOTO_H), interpolation=cv2.INTER_CUBIC)

    canvas = np.zeros((H, W, 3), np.float32)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    v = np.clip(22 - np.abs(yy - 540) / 1080 * 10, 6, 22)
    canvas[..., 0] = v * 0.95
    canvas[..., 1] = v
    canvas[..., 2] = v * 1.10

    y0 = 138          # lands the photo just inside the 2.39 scope bar
    canvas[y0:y0 + PHOTO_H, 0:W] = photo

    # A short fade into the dark below, so the photo's bottom edge does not
    # end on a hard line. This USED TO stretch+Gaussian-blur a 40-row echo
    # of the photo across the full fade band -- which reads fine directly
    # under the legend card (LEGEND_XY, one/map_overlay.py) but the legend
    # only covers the left third of the frame, so across the other two
    # thirds it was a band of grass and trees going visibly OUT OF FOCUS
    # for no reason anything on screen explains. Every real-footage beat
    # in this film runs sharp right up to a hard scope-bar cut; a plate
    # that goes soft first, alone, reads as a rendering defect, not a
    # deliberate look. A first fix (dissolving the photo's own last ROW,
    # unblurred, into the dark) traded that for a different artifact: one
    # row repeated across 60 rows stretches whatever fine texture sits on
    # it (a fence line, grass blades) into a vertical barcode pattern --
    # still reads as broken, just a different way. A real vignette is not
    # a picture that goes soft OR streaky at its edge, it is a picture
    # that goes DARK -- so this fades to the photo's own MEAN colour (one
    # flat tone, no texture to stretch, no blur to go soft) instead of any
    # texture sample at all.
    fade_h = min(60, H - (y0 + PHOTO_H))
    if fade_h > 0:
        mean_color = photo[-24:].reshape(-1, 3).mean(axis=0)
        for i in range(fade_h):
            a = (1.0 - i / fade_h) ** 1.6
            canvas[y0 + PHOTO_H + i, 0:W] = (
                canvas[y0 + PHOTO_H + i, 0:W] * (1 - a) + mean_color * a)

    cv2.imwrite(OUT, canvas.astype(np.uint8))
    print(f"  wrote {OUT} ({W}x{H}, photo band y={y0}-{y0+PHOTO_H}, "
          f"stretched from {CROP_H}px)")


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
    # centre of the park layout, then filled to nearly the whole visible
    # window -- same v23 fix as build(), same reasoning: fill the frame,
    # don't leave two thirds of it empty waiting for a legend.
    crop = frame[40:CROP_H, 430:1500]
    crop = cv2.bilateralFilter(crop, 7, 40, 40)
    band = cv2.resize(crop.astype(np.float32), (W, PHOTO_H), interpolation=cv2.INTER_CUBIC)

    canvas = np.zeros((H, W, 3), np.float32)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    v = np.clip(22 - np.abs(yy - 540) / 1080 * 10, 6, 22)
    canvas[..., 0] = v * 0.95
    canvas[..., 1] = v
    canvas[..., 2] = v * 1.10

    y0 = 138
    canvas[y0:y0 + PHOTO_H, 0:W] = band

    # Same fix as build()'s fade -- see that function's comment. Fades to
    # the plate's own mean colour (flat, no texture), not a blurred or
    # unblurred sample of it -- either of those stretches whatever texture
    # sits on the sampled rows into an artifact of its own.
    fade_h = min(60, H - (y0 + PHOTO_H))
    if fade_h > 0:
        mean_color = band[-24:].reshape(-1, 3).mean(axis=0)
        for i in range(fade_h):
            a = (1.0 - i / fade_h) ** 1.6
            canvas[y0 + PHOTO_H + i, 0:W] = (
                canvas[y0 + PHOTO_H + i, 0:W] * (1 - a) + mean_color * a)

    cv2.imwrite(SYNC_OUT, canvas.astype(np.uint8))
    print(f"  wrote {SYNC_OUT} ({W}x{H}, photo band y={y0}-{y0+PHOTO_H})")


def ensure_clip(dst=None, dur=8.0, fps=30, src=None):
    """The `map` beat reads raw/IMG_MAP1.MOV like any other plate --
    render_one.py has no path for a bare still image.

    v24: A HELD FRAME, NOT A STATIC ONE. The operator's brutal-honest read
    on v23: map and sync, back to back, are 12+ seconds of camera motion
    ZERO -- the single biggest reason that stretch of the film reads as
    stalled. A plain loop of the still plate is exactly that: nothing
    moves for the whole beat. This adds a SLOW, SUBTLE push-in (1.00 ->
    1.045 zoom over the clip) via zoompan, the same technique already
    used for the ice-age plate (ai/ice/build_ice_plate.py).
    The pins/legend are drawn in render_one.py as a FIXED screen-space
    overlay, not tracked to the plate -- a zoom this small (4.5% over
    5-6s) drifts a pin at most ~15-20px from its landmark by the beat's
    end, which the pin's own soft glow absorbs. Full per-frame tracking
    was not worth it for a push this subtle.
    """
    dst = dst or os.path.join(RAW, "IMG_MAP1.MOV")
    n = int(dur * fps)
    vf = (f"scale=2688:1512:flags=lanczos,"
          f"zoompan=z='min(1.0+0.0075*on,1.045)':d={n}:x='iw/2-(iw/zoom/2)':"
          f"y='ih/2-(ih/zoom/2)':s={W}x{H}:fps={fps}")
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-loop", "1", "-i", src or OUT, "-t", str(dur),
         "-vf", vf, "-r", str(fps), "-pix_fmt", "yuv420p", dst], check=True)
    print(f"  wrote {dst} ({dur}s, slow push-in)")


def ensure_sync_clip(dst=None, dur=8.0, fps=30):
    ensure_clip(dst or os.path.join(RAW, "IMG_MAP2.MOV"), dur, fps, src=SYNC_OUT)


if __name__ == "__main__":
    build()
    ensure_clip()
    build_sync()
    ensure_sync_clip()
