#!/usr/bin/env python3
"""Cut the approved Barkly render into a puppet.

WHY THIS EXISTS. Every physical thing Barkly did used to be a transform on the
WHOLE dog: a head tilt rotated his legs, an ear flick was a full-body wobble, a
glance was impossible. One image can only move as one object, so his body
language topped out at bouncing and crossfading between poses.

WHAT IT IS NOT. It is not a redesign, and the build refuses to be one. The
layers are CUT from `renders/front.png` — the approved character, untouched —
and the acceptance test is that stacking them back up reproduces that file
pixel for pixel. If a cut or an inpaint changes what he looks like standing
still, this script fails and writes nothing.

    python3 scripts/build-rig.py [--check]

THE CUTS, and why each one is where it is:

  EARS      Everything outside the head dome, grown 18px back INTO the dome so
            each ear keeps a root to pivot on. The dome behind that root is
            rebuilt (it was never drawn — the ear was in front of it), which is
            what lets an ear swing without tearing a hole in his head.

  HEAD      The dome, face and jowls, down PAST the top of the collar. The
            overlap is the point: the collar belongs to the body and is drawn
            over the head's bottom edge, so the seam is never visible and he can
            cock his head without a gap opening at his neck.

  BODY      Collar, chest, legs — everything from the collar's top edge down,
            drawn OVER the head.

The dome is described parametrically rather than traced, because it really is a
rounded rectangle: flat top at y=67 between x=150 and x=270, straight sides at
x=89 and x=323 below y=106, elliptical corners between. Those numbers are
measured off the render, and `--check` re-measures them.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

APP = Path(__file__).resolve().parent.parent
RENDERS = APP / "assets" / "barkly" / "renders"
SRC = RENDERS / "front.png"
OUT = APP / "assets" / "barkly" / "rig"

# His face has variants — blink, heavy lids, wide, smile, squint, jaw open — and
# they are the same drawing with only the eyes or the mouth repainted (measured:
# every one of them differs from `front.png` only inside y 129..178 or y 262..300,
# nowhere near an ear or the collar). So the head is cut once and the cut is
# applied to each of them, and the rig keeps blinking and emoting exactly as the
# flat renderer did — it just does it on a head that can also turn.
FACES = ["blink", "half", "wide", "smile", "squint", "mouth_open"]

# The head dome, measured off the render. See the module docstring.
DOME_LEFT, DOME_RIGHT = 89, 323
DOME_TOP = 67
DOME_CORNER_Y = 106          # where the corner curve meets the straight sides
CORNER_RX = 61               # x=150 and x=270 are where the flat top ends
CORNER_RY = DOME_CORNER_Y - DOME_TOP

# How far the ear root reaches back into the dome. Enough to pivot on, little
# enough that a swing never exposes its far edge.
EAR_ROOT_BITE = 18
EAR_MAX_Y = 130              # no ear pixels below this; that is face

# The collar's top edge, so the head can tuck under it.
COLLAR_TOP = 296
HEAD_BOTTOM = 336            # how far the head reaches under the collar


def dome_mask(h: int, w: int) -> np.ndarray:
    """True inside the head silhouette, ears excluded."""
    ys, xs = np.mgrid[0:h, 0:w]
    inside = (xs >= DOME_LEFT) & (xs <= DOME_RIGHT) & (ys >= DOME_TOP)
    # Straight sides below the corners.
    body = inside & (ys >= DOME_CORNER_Y)
    # Flat top between the corners.
    flat = inside & (ys < DOME_CORNER_Y) & (xs >= DOME_LEFT + CORNER_RX) & (xs <= DOME_RIGHT - CORNER_RX)
    # Elliptical corners.
    lcx, rcx, cy = DOME_LEFT + CORNER_RX, DOME_RIGHT - CORNER_RX, DOME_CORNER_Y
    left = inside & (ys < cy) & (xs < lcx) & (((xs - lcx) / CORNER_RX) ** 2 + ((ys - cy) / CORNER_RY) ** 2 <= 1)
    right = inside & (ys < cy) & (xs > rcx) & (((xs - rcx) / CORNER_RX) ** 2 + ((ys - cy) / CORNER_RY) ** 2 <= 1)
    return body | flat | left | right


def grow(mask: np.ndarray, k: int) -> np.ndarray:
    """Dilate by k with a square kernel — no scipy dependency for four lines."""
    out = mask.copy()
    for _ in range(k):
        g = out.copy()
        g[1:, :] |= out[:-1, :]
        g[:-1, :] |= out[1:, :]
        g[:, 1:] |= out[:, :-1]
        g[:, :-1] |= out[:, 1:]
        out = g
    return out


def rebuild_dome(rgba: np.ndarray, hole: np.ndarray, known: np.ndarray) -> np.ndarray:
    """
    Redraw the top of his head where an ear was standing in front of it.

    Column by column, upward. That direction is not a detail — it is the whole
    trick. Two earlier versions got it wrong in ways that were invisible until
    an ear moved:

      ALONG THE ROW pulled from the nearest same-row pixel, which near the top
      of his skull is the cream blaze running up the middle of his face. It
      painted pale streaks across his head.

      GROWING INWARD from all sides averaged each new ring with the last, so by
      the time it reached the top it had diffused into a washed-out band.

    His head shades vertically and its colour changes horizontally — mustard at
    the sides, cream up the middle. So copying each column straight up from the
    last real pixel below it keeps both: the right colour for that column, the
    shading continuing the way it was going. A short vertical blur afterwards
    stops the copied row reading as a seam.
    """
    out = rgba.astype(float).copy()
    h, w, _ = rgba.shape
    for x in range(w):
        holes = np.nonzero(hole[:, x])[0]
        if len(holes) == 0:
            continue
        valid = np.nonzero(known[:, x])[0]
        if len(valid) == 0:
            continue
        for y in holes:
            below = valid[valid > y]
            above = valid[valid < y]
            src_y = below[0] if len(below) else above[-1]
            out[y, x] = out[src_y, x]

    # Soften the join, but only inside what we invented, and only its COLOUR.
    # Blurring the alpha too dragged transparency in from just above his head
    # and left the top edge of his skull dotted and moth-eaten.
    alpha = out[:, :, 3].copy()
    blurred = out.copy()
    for _ in range(3):
        stack = (np.roll(blurred, 1, axis=0) + blurred + np.roll(blurred, -1, axis=0)) / 3.0
        blurred = np.where(hole[:, :, None], stack, blurred)
    blurred[:, :, 3] = alpha
    return np.clip(blurred, 0, 255).astype(np.uint8)


def bleed(rgba: np.ndarray, rings: int = 6) -> np.ndarray:
    """
    Push each layer's COLOUR outward under its transparent margin.

    A cut layer is opaque right up to the cut and empty just past it. Scale that
    down and the filter samples across the boundary — into pixels that are
    (0,0,0,0) — so the edge blends toward nothing and a pale seam appears
    exactly where two layers meet. It traced the ear roots and the line of his
    jaw, and it only showed at display scale, never at 1:1.

    So the transparent pixels next to the cut are given the colour of the pixel
    beside them, over and over, a few rings deep. Alpha stays zero, so nothing
    composites differently and the pixel-for-pixel check still holds — the
    filter simply has real colour to find when it reaches past the edge.
    """
    out = rgba.astype(float)
    known = rgba[:, :, 3] > 0
    for _ in range(rings):
        acc = np.zeros_like(out[:, :, :3])
        cnt = np.zeros(out.shape[:2])
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            acc += np.roll(np.roll(out[:, :, :3], dy, axis=0), dx, axis=1) * np.roll(
                np.roll(known, dy, axis=0), dx, axis=1
            )[:, :, None]
            cnt += np.roll(np.roll(known, dy, axis=0), dx, axis=1)
        edge = ~known & (cnt > 0)
        if not edge.any():
            break
        out[:, :, :3][edge] = acc[edge] / cnt[edge][:, None]
        known = known | edge
    return np.clip(out, 0, 255).astype(np.uint8)


MARGIN = 6  # room for the colour bleed to live in


def trim(rgba: np.ndarray) -> tuple[np.ndarray, int, int]:
    """Crop to the opaque bounding box plus a margin; return it and where it sat."""
    ys, xs = np.nonzero(rgba[:, :, 3] > 0)
    if len(xs) == 0:
        raise SystemExit("a layer came out empty — the cuts no longer match the art")
    h, w, _ = rgba.shape
    x0 = max(0, int(xs.min()) - MARGIN)
    x1 = min(w, int(xs.max()) + 1 + MARGIN)
    y0 = max(0, int(ys.min()) - MARGIN)
    y1 = min(h, int(ys.max()) + 1 + MARGIN)
    return bleed(rgba)[y0:y1, x0:x1], x0, y0


def main() -> int:
    src = np.array(Image.open(SRC).convert("RGBA"))
    h, w, _ = src.shape
    opaque = src[:, :, 3] > 0

    ys, xs = np.mgrid[0:h, 0:w]
    dome = dome_mask(h, w)
    outside = opaque & ~dome & (ys < EAR_MAX_Y)
    # An ear may only bite into the SHOULDERS of the dome — the corner curves it
    # actually attaches to. Left unbounded, an 18px dilation from both ears met
    # in the middle and claimed the entire top of his skull, so his head layer
    # had a floating sliver above a twelve-row hole and every head-cock showed a
    # pale notch. Ears hinge at the corners; the flat top between them is always
    # head.
    shoulders = (xs < DOME_LEFT + CORNER_RX) | (xs > DOME_RIGHT - CORNER_RX)
    root_bite = grow(outside, EAR_ROOT_BITE) & dome & shoulders
    ear_area = (outside | root_bite) & opaque & (ys < EAR_MAX_Y)

    mid = (DOME_LEFT + DOME_RIGHT) // 2
    ear_l = ear_area & (xs < mid)
    ear_r = ear_area & (xs >= mid)

    # The head, with the dome rebuilt where the ear roots covered it.
    #
    # Where two layers overlap they must BOTH be solid, or compositing them
    # blends the same soft edge twice and his outline hardens exactly where the
    # seam is — the one artefact that would announce he had been cut up. So the
    # head only reaches down under the collar through pixels that are fully
    # opaque anyway, and stops at the collar's top edge everywhere else.
    # >= 250, not == 255. The render tops out at alpha 254, so testing for a
    # literal 255 was false almost everywhere — the layers ended up butting
    # edge-to-edge with a 31-pixel overlap between them instead of the thousands
    # intended, and every join showed a hairline seam once the browser scaled
    # them. It passed the pixel check the whole time, because at 1:1 an exact
    # tiling is exact.
    solid_src = src[:, :, 3] >= 250
    head_area = opaque & ~ear_area & ((ys < COLLAR_TOP) | ((ys < HEAD_BOTTOM) & solid_src))
    # His head keeps its OWN outline — the dome — rather than whatever shape is
    # left after the ears are taken out of it. Growing the ear cut 18px into the
    # dome to give each ear a root also chewed 18px out of his skull, and the
    # square-shouldered result was visible the moment an ear lifted off it.
    # Bounded to the head: the dome description has no floor of its own (his
    # sides run straight on down), so without this his chest and legs count as
    # "skull we have to rebuild" and end up inside the head layer.
    hidden = dome & (ys < HEAD_BOTTOM) & ~head_area & solid_src
    # Clipped to his own outline. Without this the head layer also keeps stray
    # slivers of ear that sit outside the dome — they are invisible at rest,
    # because the ear covers them, and they fly off the side of his skull the
    # moment it lifts.
    keep = (head_area | hidden) & (dome | (ys >= DOME_CORNER_Y))
    # Smear colour AND alpha: forcing the head opaque would harden his silhouette,
    # and the whole render is antialiased against nothing. A hard edge on a soft
    # character reads instantly as "this was cut up".


    body_area = opaque & (ys >= COLLAR_TOP)

    def cut_head(image: np.ndarray) -> np.ndarray:
        out = np.where(keep[:, :, None], image, 0).astype(np.uint8)
        out = rebuild_dome(out, hidden, head_area & dome)
        out[~keep] = 0
        return out

    layers = {}
    for name, mask in (
        ("body", body_area),
        ("head", None),          # already built above
        ("ear_l", ear_l),
        ("ear_r", ear_r),
    ):
        rgba = cut_head(src) if name == "head" else np.where(mask[:, :, None], src, 0).astype(np.uint8)
        piece, x0, y0 = trim(rgba)
        layers[name] = {"x": x0, "y": y0, "w": int(piece.shape[1]), "h": int(piece.shape[0]), "img": piece}

    for face in FACES:
        path = RENDERS / f"front_{face}.png"
        if not path.exists():
            print(f"  ! no front_{face}.png — the rig will fall back to his resting face")
            continue
        variant = np.array(Image.open(path).convert("RGBA"))
        if variant.shape != src.shape:
            raise SystemExit(f"front_{face}.png is not the same size as front.png")
        piece, x0, y0 = trim(cut_head(variant))
        # Same cut, so it must land in the same place, or the face would jump
        # sideways every time he blinks.
        if (x0, y0) != (layers["head"]["x"], layers["head"]["y"]):
            raise SystemExit(f"front_{face}.png cuts to a different box — his face would shift on blink")
        layers[f"head_{face}"] = {"x": x0, "y": y0, "w": int(piece.shape[1]), "h": int(piece.shape[0]), "img": piece}

    # ------------------------------------------------------------------ check
    # Stack them back up in draw order and demand the original back. This is the
    # promise that the rig is the approved character and not a new drawing.
    canvas = np.zeros_like(src, dtype=float)
    for name in ("head", "ear_l", "ear_r", "body"):
        L = layers[name]
        tile = L["img"].astype(float)
        sub = canvas[L["y"]:L["y"] + L["h"], L["x"]:L["x"] + L["w"]]
        a = (tile[:, :, 3:4] / 255.0)
        sub[:, :, :3] = tile[:, :, :3] * a + sub[:, :, :3] * (1 - a)
        sub[:, :, 3:4] = tile[:, :, 3:4] + sub[:, :, 3:4] * (1 - a)

    rebuilt = np.clip(canvas, 0, 255).astype(np.uint8)
    # Compare colour only where he is genuinely solid: an antialiased edge pixel
    # is a blend against nothing, and its RGB is meaningless at alpha 3.
    solid = src[:, :, 3] > 250
    diff = np.abs(rebuilt[:, :, :3].astype(int) - src[:, :, :3].astype(int)).max(axis=2)
    worst = int(diff[solid].max())
    off = int((diff[solid] > 2).sum())
    alpha_err = np.abs(rebuilt[:, :, 3].astype(int) - src[:, :, 3].astype(int))
    alpha_gap = int((alpha_err > 4).sum())
    print(f"rebuild: worst channel diff {worst}, {off} px over 2, {alpha_gap} px off on alpha")

    if worst > 8 or off > 400 or alpha_gap > 0:
        Image.fromarray(rebuilt).save("/tmp/rig-rebuilt.png")
        print("REFUSING to write: stacking the layers does not reproduce the render.", file=sys.stderr)
        print("That means a cut changed what he looks like. /tmp/rig-rebuilt.png is what came out.", file=sys.stderr)
        return 1

    if "--check" in sys.argv:
        print("check only — nothing written")
        return 0

    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {
        "source": "assets/barkly/renders/front.png",
        "canvas": {"w": w, "h": h},
        "generated": "scripts/build-rig.py",
        "layers": {},
    }
    for name, L in layers.items():
        Image.fromarray(L["img"]).save(OUT / f"{name}.png")
        manifest["layers"][name] = {k: L[k] for k in ("x", "y", "w", "h")}

    # Pivots, in canvas coordinates: where each part is hinged to its parent.
    manifest["pivots"] = {
        # Each ear hinges at its root, on the dome's shoulder.
        "ear_l": {"x": 128, "y": 104},
        "ear_r": {"x": 284, "y": 104},
        # The head turns on the neck, which is inside the collar.
        "head": {"x": (DOME_LEFT + DOME_RIGHT) / 2, "y": 318},
    }
    # The rebuilt shoulder, saved so the safe-swing measurement below can see
    # exactly which pixels were invented. Not shipped to the app.
    debug = np.zeros_like(src)
    debug[hidden] = (255, 0, 255, 255)
    piece, x0, y0 = trim(debug)
    Image.fromarray(piece).save(OUT / "_rebuilt-mask.png")
    manifest["rebuilt_mask"] = {"x": x0, "y": y0, "w": int(piece.shape[1]), "h": int(piece.shape[0])}

    (OUT / "rig.json").write_text(json.dumps(manifest, indent=2) + "\n")
    for name, L in layers.items():
        print(f"  {name:6s} {L['w']:3d}x{L['h']:3d} at ({L['x']},{L['y']})")
    print(f"wrote {OUT.relative_to(APP)}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
