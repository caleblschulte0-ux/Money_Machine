#!/usr/bin/env python3
"""Take generated prop art and make it app-ready. The other half of the swap.

`scripts/prop-briefs.py` writes the prompts; this takes what comes back and
drops it into the app. There are no app changes on either side of that,
because `assets/world/manifest.json` already states the whole contract --
"modular transparent props; app owns scene composition", each entry a file, a
displayWidth and an anchor. A transparent PNG is a transparent PNG whether a
Blender script or an image model made it.

    python3 scripts/ingest-art.py raw/              # ingest a directory
    python3 scripts/ingest-art.py raw/ --dry-run    # say what it would do

Input files are named `<place>__<prop>.png` -- `park__tree.png` becomes
`assets/world/park/tree.png`. A name that is not already a manifest key is
REFUSED rather than guessed at: a prop the app has never heard of will not
render, and silently writing one is how you spend an afternoon wondering why
nothing changed.

Background removal uses rembg if it is installed; a generated image on a plain
light background usually also cuts cleanly on luminance alone, so there is a
fallback that needs no extra dependency. Either way the result is trimmed to
its content and left at full resolution -- `displayWidth` in the manifest is
what sizes it on screen, and it is deliberately NOT touched here, so swapping a
prop's art cannot silently change the composition around it.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
WORLD = ROOT / "assets" / "world"
MANIFEST = WORLD / "manifest.json"


def cut_out(im: Image.Image) -> Image.Image:
    """Transparent cut-out. rembg when available, luminance key when not."""
    try:
        from rembg import remove           # noqa: PLC0415
        return remove(im.convert("RGBA"))
    except Exception:
        pass
    # Fallback: the briefs ask for a plain light background, so key off the
    # corners. Conservative -- it only removes what is close to the sampled
    # background AND connected to the border, so a cream-coloured part of the
    # prop itself survives.
    rgba = im.convert("RGBA")
    a = np.asarray(rgba).astype(np.int16)
    corners = np.concatenate([a[:8, :8, :3].reshape(-1, 3),
                              a[:8, -8:, :3].reshape(-1, 3),
                              a[-8:, :8, :3].reshape(-1, 3),
                              a[-8:, -8:, :3].reshape(-1, 3)])
    bg = corners.mean(0)
    near = np.abs(a[..., :3] - bg).sum(2) < 42
    # Only background CONNECTED TO THE BORDER is removed, so a cream-coloured
    # part of the prop itself survives -- the palette's cream and the plain
    # light backdrop are close enough that a plain colour key eats the dog's
    # own chest. Connected-component labelling rather than a hand-rolled flood
    # fill: the Python version of this took minutes on a single 400x300 image.
    from scipy import ndimage                       # noqa: PLC0415
    labels, _ = ndimage.label(near)
    border = set(labels[0].tolist()) | set(labels[-1].tolist())
    border |= set(labels[:, 0].tolist()) | set(labels[:, -1].tolist())
    border.discard(0)
    keep = np.isin(labels, list(border)) if border else np.zeros_like(near)
    out = np.asarray(rgba).copy()
    out[..., 3] = np.where(keep, 0, out[..., 3])
    return Image.fromarray(out, "RGBA")


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    raw = Path(sys.argv[1])
    dry = "--dry-run" in sys.argv
    assets = json.loads(MANIFEST.read_text())["assets"]

    files = sorted(raw.glob("*.png"))
    if not files:
        print(f"no PNGs in {raw}")
        return 1
    done, refused = 0, []
    for src in files:
        key = src.stem.replace("__", "/")
        if key not in assets:
            refused.append(f"{src.name} -> '{key}' is not a manifest key")
            continue
        dest = WORLD / assets[key]["file"]
        cut = cut_out(Image.open(src))
        bbox = cut.getbbox()
        if bbox:
            cut = cut.crop(bbox)
        opaque = (np.asarray(cut)[..., 3] > 128).mean()
        note = "" if 0.08 < opaque < 0.97 else "   <-- CHECK: cut-out looks wrong"
        print(f"{'would write' if dry else 'wrote'} {assets[key]['file']:34s} "
              f"{cut.width}x{cut.height}  {100 * opaque:4.1f}% opaque{note}")
        if not dry:
            dest.parent.mkdir(parents=True, exist_ok=True)
            cut.save(dest)
        done += 1
    for r in refused:
        print(f"REFUSED {r}")
    if refused:
        print("\nA prop the app has never heard of will not render. Name files "
              "<place>__<prop>.png\nusing a key from assets/world/manifest.json "
              "-- `python3 scripts/prop-briefs.py --list-missing` lists them.")
    print(f"\n{done} ingested, {len(refused)} refused."
          f"{'  (dry run -- nothing written)' if dry else ''}")
    if not dry and done:
        print("displayWidth and anchor are left alone on purpose: swapping a "
              "prop's art\nshould not silently move everything around it. "
              "Check a scene, then commit.")
    return 1 if refused else 0


if __name__ == "__main__":
    raise SystemExit(main())
