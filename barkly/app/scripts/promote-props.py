#!/usr/bin/env python3
"""Copy rendered props out of art-review/ and into the shipped assets.

WHY THIS IS A SCRIPT AND NOT A COPY COMMAND. The prop pack renders into
`art-review/world-props/` and the app loads from `assets/world/`, and until now
the step between them was somebody remembering to run `cp`. That is not a
theoretical gap: a material change was measured against `assets/` renders that
predated it by a day, twice, and both times the honest-looking answer was
"nothing changed" -- which is exactly what a real failure looks like.

So this refuses to promote a render made by a DIFFERENT VERSION of the builder
that makes it. A stale render is now an error with the command to fix it,
instead of a silent copy of yesterday's picture over today's.

It compares a sha256 of the pack, recorded into the render directory at render
time, and NOT modification times. Times were the first version and they are
wrong in both directions: `git rebase`, `git checkout` and a fresh clone all
rewrite a source file's mtime without changing a byte of it, which marked 49
renders stale and cost a fifteen-minute re-render to produce identical files;
and a `git stash pop` can restore an OLDER pack with a NEWER time, which the
mtime check waves straight through. The hash is the question anyone actually
means: was this render made by this builder?

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

import hashlib
import os
import re
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageFilter

# The contour's colour comes from the same palette as everything else it will
# sit next to. `ink.deep` is the world's darkest neutral.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools" / "blender"))
from palette import tone  # noqa: E402

_ink = tone("ink", "deep")
CONTOUR_RGB = tuple(int(_ink[i:i + 2], 16) for i in (1, 3, 5))

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / "tools" / "blender" / "world_prop_pack.py"
RENDERS = ROOT / "art-review" / "world-props"
ASSETS = ROOT / "assets" / "world"

# THE HOME PACK SHIPS THROUGH HERE TOO, and did not until 2026-09-09.
#
# `home_prop_pack.py` renders the chair, the lamp, the bed and the shelf, and
# whatever moved those four into assets/ was not this script -- so when the
# contour was added, the four biggest objects in the room the player STARTS in
# shipped with no ink edge while the rug and the panelling beside them had one.
# Measured, not guessed: the leftmost opaque pixel of rug.png was (13, 17, 35),
# the ink, and of chair.png was (169, 69, 77), its own upholstery.
#
# That is the whole "these are two games" problem in one room, produced by a
# second promotion path nobody remembered existed. There is one recipe now.
HOME_PACK = ROOT / "tools" / "blender" / "home_prop_pack.py"
HOME_RENDERS = ROOT / "art-review" / "home-props"

# And the window frame, for the same reason, found the same way. A second
# WORKFLOW -- barkly-home-prop-render.yml -- was still carrying its own copy of
# the recipe: four hand-listed props, an inline `convert -trim`, and `cp`. No
# quantise and no contour, so on every push the two render workflows overwrote
# each other's home art (CI commits 181aa5a then 64cd288, four files at four
# times the bytes and back again). It is deleted; its two packs render from the
# one workflow and promote through here.
ARCH_PACK = ROOT / "tools" / "blender" / "home_architecture.py"
ARCH_RENDERS = ROOT / "art-review" / "home-architecture"

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


# THE CONTOUR.
#
# The operator's reference art -- Brawl Stars -- carries a dark contour around
# every object, and our world had none anywhere. It is the single biggest
# remaining reason a prop of ours dropped into one of their frames reads as
# belonging to a different game: theirs are drawn objects with an edge, ours
# were untrimmed renders floating on whatever is behind them.
#
# Baked here rather than drawn in the app because this is the ONE place that
# knows the shipping recipe, and because an outline stacked at runtime is four
# extra draws per prop on a phone. Baked, it costs nothing and it cannot drift
# from prop to prop.
#
# Soft things are exempt. A hard edge on a cloud, a haze or a contact shadow is
# not a contour, it is a mistake -- those are atmosphere, and atmosphere has no
# edge.
CONTOUR_EXEMPT = ("sky/",)
CONTOUR_EXEMPT_WORDS = ("shadow", "haze", "glow", "surf")


def contour_width(width: int) -> int:
    """How heavy the edge is, from the asset's own width.

    A constant pixel count would give the storefront a hairline and the
    treat icon a bruise: they ship at 640 and 224. Proportional keeps the
    weight even once the app has scaled them back to the same world.
    """
    return max(3, round(width * 0.011))


def padded(image: "Image.Image", pad: int) -> "Image.Image":
    """The image on a canvas `pad` bigger on every side.

    Separated from `outlined` because some art has to GROW WITHOUT AN EDGE: the
    collar overlays and the face patch are composited on top of the body, so
    they must take exactly the same padding the body takes or they slide, and
    they must not take a contour or the dog wears a dark ring on his chest.
    """
    canvas = Image.new("RGBA", (image.width + pad * 2, image.height + pad * 2), (0, 0, 0, 0))
    canvas.paste(image, (pad, pad))
    return canvas


def outlined(image: "Image.Image", path: str, pad: int | None = None) -> "Image.Image":
    """The image over a dilated dark copy of its own alpha."""
    if path.startswith(CONTOUR_EXEMPT) or any(w in path for w in CONTOUR_EXEMPT_WORDS):
        return image
    if pad is None:
        pad = contour_width(image.width)
    canvas = padded(image, pad)
    alpha = canvas.getchannel("A")
    # MaxFilter takes an odd window; a pad of n needs 2n+1 to reach n pixels.
    grown = alpha.filter(ImageFilter.MaxFilter(pad * 2 + 1))
    ink = Image.new("RGBA", canvas.size, CONTOUR_RGB + (255,))
    ink.putalpha(grown)
    return Image.alpha_composite(ink, canvas)


def destination(path: str) -> Path:
    """Where a builder's render is loaded from by the app."""
    # Architecture keeps its own folder under the location, not `props/`.
    if path.startswith("home/architecture/"):
        return ASSETS / "home" / "architecture" / f"{path.rsplit('/', 1)[1]}.png"
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
    if path.startswith("item/"):
        # ITEM_WIDTH is the width of the SHIPPED file, and the contour is part
        # of the shipped file -- so the art is resized to leave room for it.
        # Resizing to ITEM_WIDTH and then adding the edge shipped 230px icons
        # from a table that says 224, which is the sort of drift that ends up
        # in an aspect lock and a layout constant six weeks later.
        inner = ITEM_WIDTH - contour_width(ITEM_WIDTH) * 2
        if trimmed.width != inner:
            height = round(trimmed.height * inner / trimmed.width)
            trimmed = trimmed.resize((inner, height), Image.LANCZOS)
    # The contour goes on AFTER the icon resize, so its weight is measured in
    # the pixels that actually ship rather than in the 640 canvas they came off.
    trimmed = outlined(trimmed, path, pad=contour_width(ITEM_WIDTH) if path.startswith("item/") else None)
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


def pack_fingerprint(pack: Path) -> str:
    """The pack's content hash -- what a render directory records it was built by."""
    return hashlib.sha256(pack.read_bytes()).hexdigest()


def rendered_fingerprint(renders: Path) -> str | None:
    """What the render directory says it was built by, or None if it predates this."""
    marker = renders / ".pack-sha256"
    try:
        return marker.read_text(encoding="utf-8").strip()
    except OSError:
        return None


def builders(pack: Path = PACK) -> list[str]:
    """Every key in a pack's BUILDERS table.

    Anchored to the start of a line, because the values are dicts with their
    own quoted keys and `"anchor":` is a perfectly good match for a name.
    """
    source = pack.read_text(encoding="utf-8")
    block = source[source.index("BUILDERS = {"):]
    block = block[:block.index("\n}\n")]
    return sorted(re.findall(r'^    "([a-z_0-9/]+)":', block, re.M))


def packs():
    """(pack file, renders dir, builder key -> shipped path) for each pack."""
    return (
        (PACK, RENDERS, lambda key: key),
        (HOME_PACK, HOME_RENDERS, lambda key: f"home/{key}"),
        (ARCH_PACK, ARCH_RENDERS, lambda key: f"home/architecture/{key}"),
    )


def main() -> int:
    check = "--check" in sys.argv[1:]
    pending, missing = [], []
    stale = {}

    # DECIDE FIRST, COPY AFTER. Nothing is written until every prop has been
    # looked at, because the refusal below is only worth anything if it happens
    # before the files move.
    for pack, renders, ship in packs():
        # ONE ANSWER PER PACK, not per file. The pack is the single source of
        # the whole world's look -- one shared camera, one light rig, one
        # material() -- so "which props does this edit change?" is a question
        # nobody can answer by reading it. Either this directory was rendered
        # by this builder or it was not.
        want = pack_fingerprint(pack)
        got = rendered_fingerprint(renders)
        pack_stale = got is not None and got != want
        for key in builders(pack):
            path = ship(key)
            render = renders / f"{key}.png"
            if not render.exists():
                missing.append(path)
                continue
            if pack_stale or (got is None and render.stat().st_mtime < pack.stat().st_mtime):
                stale.setdefault(pack, []).append(key)
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
                f"{sum(len(v) for v in stale.values())} are stale -- a partial pass would ship a world "
                f"rendered by two versions of the pack.\n"
            )
        for pack, keys in stale.items():
            # A FULL PASS, and the message says so. It used to hand back a
            # PROP_ONLY line listing every stale prop -- which cannot work: a
            # narrowed run deliberately does not stamp the directory, so the
            # very next promote refuses again with the same wall of text. A fix
            # command that does not fix it is worse than no fix command.
            print(
                f"STALE ({len(keys)}) -- these renders were made by a different "
                f"version of the builder:\n  {', '.join(keys)}\n\n"
                f"  blender -b --python {pack.relative_to(ROOT)}\n"
            )
        if missing:
            print(f"\nnever rendered ({len(missing)}): {', '.join(missing)}")
        return 1

    moved, written = [], []
    # TRIM TO THE ALPHA BOX, then quantise. The pack renders every prop on a
    # 640x640 transparent canvas; the app ships them trimmed and SIZES them
    # from their aspect ratio, so shipping the raw canvas silently makes every
    # prop square -- which is what broke twenty aspect locks in one commit.
    # UNIQUE PER RUN. This was a single fixed path, and two promotes running at
    # once -- easy to do, since a render pipeline invokes this at the end -- both
    # wrote and converted the same staging file. They interleaved, and the file
    # copied to assets/ was a half-written PNG: beach/castle shipped as bytes
    # Pillow could not even identify as an image. A shared temp path is a race
    # with a corrupted asset as its prize.
    staging = ROOT / "art-review" / f".promote-staging-{os.getpid()}.png"
    for path, render, target in pending:
        try:
            size = build(render, path, staging)
        except ValueError:
            missing.append(f"{path} (rendered empty)")
            continue
        if target.exists():
            try:
                was = Image.open(target).size
            except Exception:
                # An unreadable target is exactly what promotion is for. This
                # used to raise and take the whole run down, so a single
                # corrupt asset -- which is how the race above showed up --
                # blocked the repair of the very file that was broken.
                print(f"  {path}: shipped asset is unreadable; replacing it")
                if not check:
                    target.write_bytes(staging.read_bytes())
                written.append(path)
                continue
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

    # The pack's own manifest, carried across as it always has been. Nothing
    # in src/ reads it -- it is a render record that happens to ship -- but
    # dropping it here would be a silent behaviour change hidden inside a
    # refactor, and it is 5KB.
    for pack_manifest, target in (
        (RENDERS / "manifest.json", ASSETS / "manifest.json"),
        (HOME_RENDERS / "manifest.json", ASSETS / "home" / "props" / "manifest.json"),
    ):
        if not pack_manifest.exists():
            continue
        text = pack_manifest.read_text(encoding="utf-8")
        if not target.exists() or target.read_text(encoding="utf-8") != text:
            if not check:
                target.write_text(text, encoding="utf-8")
            written.append(str(target.relative_to(ASSETS)))

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
