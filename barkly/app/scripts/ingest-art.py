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
SCENES = WORLD / "scenes"


def _briefs():
    """prop-briefs.py, loaded as a module: ONE list of what art exists, shared
    by the tool that writes the prompts and the tool that files the results,
    so they cannot disagree about which props are real (they did: the brief
    for home/bed existed and this script would have refused its image)."""
    import importlib.util
    spec = importlib.util.spec_from_file_location("prop_briefs", ROOT / "scripts" / "prop-briefs.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def key_magenta(im: Image.Image) -> Image.Image:
    """Remove the #FF00FF key everywhere -- scene skies and window panes.

    Nothing in this world's palette is magenta, so the key can be global
    rather than border-connected. Soft at the edge (a model anti-aliases the
    boundary into pinkish blends) and de-spilled: pixels near the key lose the
    magenta cast they picked up instead of keeping a pink fringe.
    """
    a = np.asarray(im.convert("RGBA")).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # distance from pure magenta: high R and B, low G
    magentaness = np.clip(((r + b) / 2 - g) / 255.0, 0, 1) * np.clip(np.minimum(r, b) / 255.0 * 1.6, 0, 1)
    alpha = a[..., 3] * (1 - np.clip((magentaness - 0.45) / 0.35, 0, 1))
    spill = np.clip((magentaness - 0.15) / 0.3, 0, 1)
    avg = (r + b) / 2
    a[..., 0] = r - (r - np.minimum(r, g + 0.25 * (avg - g))) * spill
    a[..., 2] = b - (b - np.minimum(b, g + 0.25 * (avg - g))) * spill
    a[..., 3] = alpha
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA")


def ingest_plate(src: Path, name: str, dry: bool) -> bool:
    """A scene plate: fit to the manifest's frame without moving its anchors.

    The brief asks for 9:16. Scaled to 1792 tall and centre-cropped to 768
    wide, every VERTICAL position is preserved exactly -- the horizon and the
    spot the dog stands on are vertical measurements -- and only the edges
    the brief warned about are trimmed.
    """
    m = json.loads((SCENES / "manifest.json").read_text())["scenes"].get(name)
    if not m:
        print(f"REFUSED scene__{name}.png -> no scene '{name}' in assets/world/scenes/manifest.json")
        return False
    W, H = m["width"], m["height"]
    im = Image.open(src).convert("RGBA")
    scale = H / im.height
    if im.width * scale < W:
        print(f"REFUSED scene__{name}.png -> {im.width}x{im.height} is narrower than {W}:{H}; ask for 9:16")
        return False
    im = im.resize((round(im.width * scale), H), Image.LANCZOS)
    left = (im.width - W) // 2
    im = key_magenta(im.crop((left, 0, left + W, H)))
    al = np.asarray(im)[..., 3]
    hz = int(m["anchors"]["horizon"]["y"] * H)
    sx, sy = int(m["anchors"]["stand"]["x"] * W), int(m["anchors"]["stand"]["y"] * H)
    sky_clear = float((al[: max(1, hz - 20)] < 20).mean())
    ground_solid = float((al[hz + 20:] > 235).mean())
    stand_ok = al[sy, sx] > 235
    notes = []
    if sky_clear < 0.80: notes.append(f"only {100*sky_clear:.0f}% of the sky keyed out -- was it flat magenta?")
    if ground_solid < 0.90: notes.append(f"only {100*ground_solid:.0f}% of the ground is solid -- magenta in the scene?")
    if not stand_ok: notes.append("the dog's standing spot is not solid ground")
    # A bad PROP is a warning; a bad PLATE is a refusal. A plate whose sky did
    # not key paints over the app's own sky -- the hour, the light, the haze --
    # for the whole location, and that is not something to find by looking.
    if notes and "--force" not in sys.argv:
        print(f"REFUSED scene__{name}.png -> {'; '.join(notes)}  (regenerate it, or pass --force)")
        return False
    flag = ("   <-- FORCED: " + "; ".join(notes)) if notes else ""
    print(f"{'would write' if dry else 'wrote'} scenes/{m['file']:24s} {W}x{H}  sky clear {100*sky_clear:.0f}%  ground solid {100*ground_solid:.0f}%{flag}")
    if not dry:
        im.save(SCENES / m["file"])
    return True


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
    assets = _briefs()._sources()

    files = sorted(raw.glob("*.png"))
    if not files:
        print(f"no PNGs in {raw}")
        return 1
    done, refused = 0, []
    for src in files:
        key = src.stem.replace("__", "/")
        if key.startswith("scene/"):
            if ingest_plate(src, key.split("/", 1)[1], dry):
                done += 1
            else:
                refused.append(f"{src.name} -> see above")
            continue
        if key not in assets:
            refused.append(f"{src.name} -> '{key}' is not a manifest key")
            continue
        dest = ROOT / assets[key]["path"]
        cut = key_magenta(cut_out(Image.open(src)))
        bbox = cut.getbbox()
        if bbox:
            cut = cut.crop(bbox)
        opaque = (np.asarray(cut)[..., 3] > 128).mean()
        note = "" if 0.08 < opaque < 0.97 else "   <-- CHECK: cut-out looks wrong"
        print(f"{'would write' if dry else 'wrote'} {assets[key]['path']:48s} "
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
