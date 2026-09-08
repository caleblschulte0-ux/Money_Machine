#!/usr/bin/env python3
"""Copy rendered props out of art-review/ and into the shipped assets.

WHY THIS IS A SCRIPT AND NOT A COPY COMMAND. The prop pack renders into
`art-review/world-props/` and the app loads from `assets/world/`, and until now
the step between them was somebody remembering to run `cp`. That is not a
theoretical gap: a material change was measured against `assets/` renders that
predated it by a day, twice, and both times the honest-looking answer was
"nothing changed" -- which is exactly what a real failure looks like.

So this refuses to promote a render that is OLDER than the builder that makes
it. A stale render is now an error with the command to fix it, instead of a
silent copy of yesterday's picture over today's.

It is deliberately blunt: ANY edit to the pack marks EVERY render stale, even
a one-word change that cannot affect most of them. That is not a bug to soften.
The pack is the single source of the whole world's look -- one shared camera,
one light rig, one material() -- so "which props does this edit change?" is a
question nobody can answer reliably by reading it, and the cheap wrong answer
ships a world rendered by two different versions of itself. A full pass is
about twelve minutes. Take the twelve minutes.

  python3 scripts/promote-props.py            # promote everything that is fresh
  python3 scripts/promote-props.py --check    # report only, change nothing
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "tools" / "blender" / "world_prop_pack.py"
RENDERS = ROOT / "art-review" / "world-props"
ASSETS = ROOT / "assets" / "world"

# Scene PLATES -- whole locations rendered as one lit picture -- come out of a
# different pack and ship into a different folder, but they are the same kind
# of thing: a render that has to become a shipped asset by a recipe nobody
# should be retyping. Which plates ship is decided by ScenePlate.tsx, not by
# what happens to be rendered: a plate can be built and held back on quality,
# and the beach one is.
SCENE_RENDERS = ROOT / "art-review" / "world-scenes"
SCENE_ASSETS = ASSETS / "scenes"
SCENE_SWITCH = ROOT / "src" / "ui" / "scenes" / "ScenePlate.tsx"

# Inventory art is shipped at a fixed icon width. Every `item/` prop in the
# shipped set is exactly 224px wide with its aspect preserved, and nothing else
# is capped -- world props keep whatever the 640px canvas trimmed to. Promoting
# items at full render size makes each one about four times the bytes for art
# that is never drawn above a couple of hundred pixels.
ITEM_WIDTH = 224

# Shipped palette depth. A render is true colour and most of that is spent on
# gradients no one can see: 256 colours takes a prop to about a third of its
# bytes with no visible banding, checked on the smoothest art in the game (a
# cloud and the window vista).
#
# WITHOUT DITHERING, and that is not a detail. Dithering trades banding for
# pixel-scale noise, and pixel-scale noise is exactly the signal
# `scripts/surface-check.py` measures to prove a prop is not flat -- dithered,
# the OLD untextured props measure as textured as the new ones, and the gate
# stops meaning anything. Measured: flat props quantised with dithering reach
# a median deviation of 1.0, the same as genuinely textured art; quantised
# without it they stay at exactly 0.0. So the size win is taken in the one way
# that does not counterfeit the thing being gated.
PALETTE = 256


def destination(path: str) -> Path:
    """Where a builder's render is loaded from by the app."""
    location, name = path.split("/", 1)
    # `item` and `sky` are loose files; every location keeps its props in one
    # folder. This mirrors the requires in src/ui/scenes -- if that ever moves,
    # this is the one place that has to follow it.
    if location in ("item", "sky"):
        return ASSETS / location / f"{name}.png"
    return ASSETS / location / "props" / f"{name}.png"


def build(render: Path, path: str, into: Path) -> tuple[int, int]:
    """Turn a raw render into exactly the file the app should ship.

    Trim to the alpha box, size inventory art to the icon width, then quantise.
    This is the ONLY place that knows the shipping recipe, so "has this already
    been promoted?" can be answered by building the candidate and comparing
    bytes -- an exact test, rather than a guess at what ImageMagick would do.
    """
    image = Image.open(render).convert("RGBA")
    box = image.getbbox()
    if box is None:
        raise ValueError(f"{path} rendered empty")
    trimmed = image.crop(box)
    if path.startswith("item/") and trimmed.width != ITEM_WIDTH:
        height = round(trimmed.height * ITEM_WIDTH / trimmed.width)
        trimmed = trimmed.resize((ITEM_WIDTH, height), Image.LANCZOS)
    trimmed.save(into)
    subprocess.run(
        ["convert", str(into), "-strip", "+dither", "-colors", str(PALETTE),
         "-define", "png:compression-level=9", str(into)],
        check=True,
    )
    return trimmed.size


def shipping_plates() -> list[str]:
    """The scenes ScenePlate.tsx can actually serve, read from its PLATE_ART."""
    source = SCENE_SWITCH.read_text(encoding="utf-8")
    block = source[source.index("const PLATE_ART"):]
    block = block[:block.index("};")]
    return sorted(re.findall(r"^\s*(\w+):\s*require", block, re.M))


def promote_scenes(check: bool) -> int:
    """Plates, and the manifest that says where the dog stands on them."""
    manifest = SCENE_RENDERS / "manifest.json"
    if not manifest.exists():
        print("no scene manifest rendered; skipping plates")
        return 0
    staging = SCENE_RENDERS / ".promote-staging.png"
    changed = []
    for name in shipping_plates():
        render = SCENE_RENDERS / f"{name}.png"
        if not render.exists():
            print(f"\nScenePlate ships '{name}' but {render.relative_to(ROOT)} "
                  f"has never been rendered.")
            return 1
        subprocess.run(
            ["convert", str(render), "-strip", "+dither", "-colors", str(PALETTE),
             "-define", "png:compression-level=9", str(staging)],
            check=True,
        )
        target = SCENE_ASSETS / f"{name}.png"
        if not target.exists() or target.read_bytes() != staging.read_bytes():
            if not check:
                target.write_bytes(staging.read_bytes())
            changed.append(name)
    staging.unlink(missing_ok=True)

    # The manifest is copied WHOLE, never filtered to the shipping plates: it
    # is the render record, and a partial copy is how a scene's anchors go
    # missing while everything still looks green.
    shipped_manifest = SCENE_ASSETS / "manifest.json"
    text = manifest.read_text(encoding="utf-8")
    if not shipped_manifest.exists() or shipped_manifest.read_text(encoding="utf-8") != text:
        if not check:
            shipped_manifest.write_text(text, encoding="utf-8")
        changed.append("manifest.json")
    for name in changed:
        print(f"{'would promote' if check else 'promoted'}  scene {name}")
    return 0


def builders() -> list[str]:
    source = PACK.read_text(encoding="utf-8")
    block = source[source.index("BUILDERS = {"):]
    block = block[:block.index("\n}\n")]
    return sorted(re.findall(r'"([a-z_]+/[a-z_0-9]+)":', block))


def main() -> int:
    check = "--check" in sys.argv[1:]
    pack_mtime = PACK.stat().st_mtime
    pending, stale, missing = [], [], []

    # DECIDE FIRST, COPY AFTER. Nothing is written until every prop has been
    # looked at, because the refusal below is only worth anything if it happens
    # before the files move.
    for path in builders():
        render = RENDERS / f"{path}.png"
        if not render.exists():
            missing.append(path)
            continue
        if render.stat().st_mtime < pack_mtime:
            stale.append(path)
            continue
        target = destination(path)
        if not target.parent.exists():
            missing.append(f"{path} (no {target.parent.relative_to(ROOT)})")
            continue
        pending.append((path, render, target))

    if stale:
        # Do not half-promote. If the pack has moved on, the props that happen
        # to be fresh are fresh by accident of which ones were re-rendered
        # last, and mixing them with the rest is how a world ends up lit two
        # different ways.
        if pending:
            print(
                f"refusing to promote {len(pending)} fresh render(s) while "
                f"{len(stale)} are stale -- a partial pass would ship a world "
                f"rendered by two versions of the pack.\n"
            )
        print(
            f"STALE ({len(stale)}) -- these renders predate the builder that "
            f"makes them:\n  {', '.join(stale)}\n\n"
            f"  PROP_ONLY={','.join(stale)} blender -b --python "
            f"tools/blender/world_prop_pack.py"
        )
        if missing:
            print(f"\nnever rendered ({len(missing)}): {', '.join(missing)}")
        return 1

    moved, written = [], []
    # TRIM TO THE ALPHA BOX, then quantise. The pack renders every prop on a
    # 640x640 transparent canvas; the app ships them trimmed and SIZES them
    # from their aspect ratio, so shipping the raw canvas silently makes every
    # prop square -- which is what broke twenty aspect locks in one commit.
    staging = ROOT / "art-review" / ".promote-staging.png"
    for path, render, target in pending:
        try:
            size = build(render, path, staging)
        except ValueError:
            missing.append(f"{path} (rendered empty)")
            continue
        if target.exists():
            was = Image.open(target).size
            if was != size:
                # The silhouette changed. That is legitimate when a builder is
                # edited and alarming when it is not, so it is reported rather
                # than waved through -- a prop that changes shape moves in the
                # scene, and the aspect locks in __tests__ have to be updated
                # with it.
                moved.append(f"{path}  {was[0]}x{was[1]} -> {size[0]}x{size[1]}")
            elif target.read_bytes() == staging.read_bytes():
                continue
        if not check:
            target.write_bytes(staging.read_bytes())
        written.append(path)
    staging.unlink(missing_ok=True)

    for path in written:
        print(f"{'would promote' if check else 'promoted'}  {path}")
    if moved:
        print(
            f"\nSILHOUETTE CHANGED ({len(moved)}) -- these props are a different "
            f"shape than the ones they replace, so anything that sizes them "
            f"from their aspect needs updating:\n  " + "\n  ".join(moved)
        )
    if missing:
        print(f"\nnever rendered ({len(missing)}): {', '.join(missing)}")
    if not written:
        print("props already match the renders")
    return promote_scenes(check)


if __name__ == "__main__":
    raise SystemExit(main())
