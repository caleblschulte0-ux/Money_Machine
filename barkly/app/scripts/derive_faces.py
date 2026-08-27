#!/usr/bin/env python3
"""Derive Barkly's expression and sleep frames from the approved renders.

The concept sheet gives us one front-facing Barkly. Every other face the app
shows -- blinking, half-lidded, squinting -- is derived from it here, so the
character is never redrawn and the frames stay reproducible instead of being
one-off edits nobody can regenerate.

Technique: pull the brow down over the eye. The band of fur directly ABOVE
each eye is compressed into the top of the eye box, feathered at both edges
so it melts into the existing brow rather than sitting on his face as a
rectangle. That was the first attempt and it looked exactly like a pasted
rectangle; the top feather is what fixed it.

It also derives the LYING DOWN frame. The sheet only gives us a standing side
view with the eyes shut, and shipping that as "asleep" looked exactly like
what it was: a dog standing up with his eyes closed, hovering over a bed. The
legs are found by scanning the alpha for the row where the silhouette splits
into two separate runs -- measured, not guessed, because guessing at 0.66 ate
his torso on the first attempt.

Usage: python3 scripts/derive_faces.py
Requires: pillow.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image

APP = Path(__file__).resolve().parent.parent
RENDERS = APP / "assets" / "barkly" / "renders"
SRC = RENDERS / "front.png"

# Eye boxes in front.png (416x520), measured from the render itself.
EYES = [(110, 128, 172, 182), (246, 128, 308, 182)]

# How far the lid comes down, as a fraction of eye height.
VARIANTS = {
    "front_squint": 0.34,  # annoyed
    "front_half": 0.55,    # mid-blink, and heavy-lidded when hungry
}


def close_lids(im: Image.Image, frac: float) -> Image.Image:
    out = im.copy()
    for (left, top, right, bottom) in EYES:
        cover = int((bottom - top) * frac)
        if cover < 2:
            continue
        # A source band taller than the coverage: compressing a longer
        # gradient keeps the brow's shading continuous instead of banding.
        band = int(cover * 1.8)
        src = im.crop((left, max(0, top - band), right, top)).resize(
            (right - left, cover), Image.LANCZOS
        )

        alpha = src.getchannel("A").copy()
        px = alpha.load()
        bottom_fade = max(1, int(cover * 0.35))  # the lid line
        top_fade = max(1, int(cover * 0.6))      # melt into the brow
        for y in range(cover):
            k = 1.0
            if y < top_fade:
                k = min(k, y / top_fade)
            if y > cover - bottom_fade:
                k = min(k, (cover - y) / bottom_fade)
            if k >= 1.0:
                continue
            for x in range(right - left):
                px[x, y] = int(px[x, y] * k)
        src.putalpha(alpha)
        out.paste(src, (left, top), src)
    return out


def leg_top(im: Image.Image) -> int:
    """The row where the silhouette splits into separate legs."""
    w, h = im.size
    px = im.getchannel("A").load()
    for y in range(int(h * 0.7), h):
        runs, inrun = 0, False
        for x in range(w):
            on = px[x, y] > 40
            if on and not inrun:
                runs += 1
            inrun = on
        if runs >= 2:
            return y
    return int(h * 0.86)


def lie_down(im: Image.Image) -> Image.Image:
    """Settle a standing side view into a lying pose.

    Squash the legs so the belly reaches the ground, then spread the whole
    body slightly -- a settled animal is wider and shorter than a standing
    one. The remaining stub of leg is hidden by the bed rim, which the room
    draws IN FRONT of him; that occlusion is the other half of the effect and
    neither half works alone.
    """
    w, h = im.size
    top = leg_top(im)
    body, legs = im.crop((0, 0, w, top)), im.crop((0, top, w, h))
    squashed = legs.resize((w, max(1, int(legs.height * 0.30))), Image.LANCZOS)
    out = Image.new("RGBA", (w, body.height + squashed.height), (0, 0, 0, 0))
    out.paste(body, (0, 0))
    out.paste(squashed, (0, body.height))
    return out.resize((int(out.width * 1.05), int(out.height * 0.94)), Image.LANCZOS)


def main() -> int:
    im = Image.open(SRC).convert("RGBA")
    for name, frac in VARIANTS.items():
        dest = RENDERS / f"{name}.png"
        close_lids(im, frac).save(dest, optimize=True)
        print(f"{dest.name}: {dest.stat().st_size // 1024} KB")

    sleeper = Image.open(RENDERS / "side_sleep.png").convert("RGBA")
    dest = RENDERS / "side_lie.png"
    lying = lie_down(sleeper)
    lying.save(dest, optimize=True)
    print(f"{dest.name}: {lying.size}, {dest.stat().st_size // 1024} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
