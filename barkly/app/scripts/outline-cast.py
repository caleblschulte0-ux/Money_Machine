#!/usr/bin/env python3
"""Give the cast the same dark contour every world prop now carries.

WHY THIS WRITES A SECOND COPY INSTEAD OF EDITING THE RENDERS.

`assets/barkly/renders/*` is locked canon: the approved concept sheet, and
`scripts/build-rig.py` refuses to write rig layers unless stacking reproduces
`renders/front.png` PIXEL FOR PIXEL. Adding an edge to those files would break
that gate and, worse, quietly move the thing every other check measures the
character against.

So the canon renders stay byte-identical and this writes outlined copies beside
them under `assets/barkly/outlined/`. The app loads the outlined ones; the rig,
the gate and every reference to the concept sheet still point at the originals.
The contour is a FINISH, applied to the shipped image, exactly the way
`promote-props.py` applies it to a prop -- and it uses that same function, so
the character's edge and the world's edge can never drift apart.

    python3 scripts/outline-cast.py           # write the outlined copies
    python3 scripts/outline-cast.py --check   # fail if any is stale
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets" / "barkly" / "renders"
OUT = ROOT / "assets" / "barkly" / "outlined"

# ONE contour recipe for the character and the world. Imported, not copied --
# a second implementation of an outline is how the dog ends up with a different
# edge from the bench he is sitting on.
_spec = importlib.util.spec_from_file_location("promote_props", Path(__file__).with_name("promote-props.py"))
_promote = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_promote)


def cast_files() -> list[Path]:
    return sorted(p for p in SOURCE.rglob("*.png"))


# Composited ON TOP of the body, so they take the padding and not the edge.
def is_overlay(src: Path) -> bool:
    return src.parent.name == "collars" or src.stem == "face"


def cast_pad() -> int:
    """One pad for the whole cast, from the body render's width.

    NOT per file, and NOT after a crop. Every expression is a full-body render
    of the same 416x520 canvas, and they are swapped in place -- crop each to
    its own alpha box and `front_smile` trims differently from `front_blink`,
    so his head jumps a pixel or two every time his face changes. Padding the
    whole canvas by the same amount leaves every file in exact register with
    every other, which is the only reason this is safe to do to the cast at all.
    """
    return _promote.contour_width(Image.open(SOURCE / "front.png").width)


def build(src: Path, pad: int) -> Image.Image:
    image = Image.open(src).convert("RGBA")
    if is_overlay(src):
        return _promote.padded(image, pad)
    return _promote.outlined(image, src.stem, pad=pad)


def main() -> int:
    check = "--check" in sys.argv
    pad = cast_pad()
    stale: list[str] = []
    for src in cast_files():
        target = OUT / src.relative_to(SOURCE)
        made = build(src, pad)
        target.parent.mkdir(parents=True, exist_ok=True)
        if check:
            if not target.exists():
                stale.append(f"{target.relative_to(ROOT)} missing")
                continue
            if Image.open(target).convert("RGBA").tobytes() != made.tobytes():
                stale.append(f"{target.relative_to(ROOT)} differs from its render")
            continue
        made.save(target)
        print(f"outlined  {target.relative_to(ROOT)}  {made.size[0]}x{made.size[1]}")
    if check and stale:
        print("STALE cast outlines -- run python3 scripts/outline-cast.py")
        for line in stale:
            print(f"  {line}")
        return 1
    if check:
        print(f"cast outlines match their renders ({len(cast_files())} files)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
