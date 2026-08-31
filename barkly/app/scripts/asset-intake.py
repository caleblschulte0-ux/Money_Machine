#!/usr/bin/env python3
"""Normalize raw art into production-friendly PNGs.

Free/local-only pipeline: Pillow handles EXIF orientation, alpha trimming,
resizing, metadata stripping, and optimized PNG output. Nothing leaves CI.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from PIL import Image, ImageOps


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("source")
    p.add_argument("dest")
    p.add_argument("--max-edge", type=int, default=2048)
    p.add_argument("--trim", action="store_true")
    p.add_argument("--padding", type=int, default=0)
    p.add_argument("--report")
    return p.parse_args()


def alpha_bbox(image: Image.Image):
    if image.mode != "RGBA":
        return None
    return image.getchannel("A").getbbox()


def main() -> None:
    args = parse_args()
    source = Path(args.source)
    dest = Path(args.dest)
    if not source.exists():
        raise SystemExit(f"missing source asset: {source}")

    original_bytes = source.stat().st_size
    with Image.open(source) as opened:
        original_size = opened.size
        image = ImageOps.exif_transpose(opened).convert("RGBA")

    trimmed = False
    if args.trim:
        bbox = alpha_bbox(image)
        if bbox and bbox != (0, 0, image.width, image.height):
            image = image.crop(bbox)
            trimmed = True

    if args.padding > 0:
        image = ImageOps.expand(image, border=args.padding, fill=(0, 0, 0, 0))

    max_edge = max(image.size)
    resized = False
    if max_edge > args.max_edge:
        scale = args.max_edge / max_edge
        next_size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
        image = image.resize(next_size, Image.Resampling.LANCZOS)
        resized = True

    dest.parent.mkdir(parents=True, exist_ok=True)
    image.save(dest, format="PNG", optimize=True, compress_level=9)
    final_bytes = dest.stat().st_size

    report = {
        "source": str(source),
        "dest": str(dest),
        "originalSize": list(original_size),
        "finalSize": list(image.size),
        "originalBytes": original_bytes,
        "finalBytes": final_bytes,
        "savedPercent": round((1 - final_bytes / original_bytes) * 100, 1) if original_bytes else 0,
        "trimmed": trimmed,
        "resized": resized,
        "hasAlpha": image.getchannel("A").getextrema()[0] < 255,
    }

    if args.report:
        report_path = Path(args.report)
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report))


if __name__ == "__main__":
    main()
