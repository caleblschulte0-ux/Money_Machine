#!/usr/bin/env python3
"""Create side-by-side / overlay / difference panels for approved art targets.

This is deliberately optional: if no approved reference exists yet, CI records
that fact instead of failing. Once a target image is added, every art run emits
a comparison panel automatically.
"""
from __future__ import annotations

import argparse
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageOps


def args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--actual", required=True)
    p.add_argument("--reference", required=True)
    p.add_argument("--out", required=True)
    return p.parse_args()


def fit(im: Image.Image, size: tuple[int, int]) -> Image.Image:
    return ImageOps.fit(im.convert("RGB"), size, method=Image.Resampling.LANCZOS)


def label(canvas: Image.Image, text: str, x: int, y: int) -> None:
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((x, y, x + 170, y + 32), 10, fill=(30, 24, 20))
    draw.text((x + 10, y + 7), text, fill=(255, 247, 232), font=ImageFont.load_default())


def main() -> None:
    a = args()
    actual_path = Path(a.actual)
    reference_path = Path(a.reference)
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)

    if not actual_path.exists():
        raise SystemExit(f"missing actual screenshot: {actual_path}")
    if not reference_path.exists():
        out.with_suffix(".txt").write_text(
            "No approved Barkly art target is committed yet. Add the approved Home target at "
            f"{reference_path} and this comparison will become automatic.\n",
            encoding="utf-8",
        )
        print("reference missing; wrote guidance instead of failing")
        return

    with Image.open(actual_path) as ai, Image.open(reference_path) as ri:
        w, h = ai.size
        actual = ai.convert("RGB")
        reference = fit(ri, (w, h))

    overlay = Image.blend(reference, actual, 0.5)
    diff = ImageChops.difference(reference, actual)
    diff = ImageOps.autocontrast(diff)

    gutter = 16
    title_h = 48
    canvas = Image.new("RGB", (w * 2 + gutter * 3, h * 2 + gutter * 3 + title_h), (22, 18, 15))
    positions = [
        (reference, "approved target", gutter, title_h + gutter),
        (actual, "actual app", w + gutter * 2, title_h + gutter),
        (overlay, "50/50 overlay", gutter, h + title_h + gutter * 2),
        (diff, "pixel difference", w + gutter * 2, h + title_h + gutter * 2),
    ]
    for image, text, x, y in positions:
        canvas.paste(image, (x, y))
        label(canvas, text, x + 10, y + 10)

    ImageDraw.Draw(canvas).text((gutter, 16), "Barkly approved-reference comparison", fill=(255, 247, 232), font=ImageFont.load_default())
    canvas.save(out, format="PNG", optimize=True)
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
