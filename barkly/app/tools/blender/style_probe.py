"""EIGHT RENDERS SO A STYLE CAN BE CHOSEN BY LOOKING, not argued about.

The operator, on a contact sheet: "the bench doesn't even look like the same
art style as the lamp." That is a real observation and it has a real cause --
this pack has a dozen dials that each got set on the prop in front of me at the
time (edge weight, ink thickness, coat, bevel share), so props authored in
different sessions carry different combinations of them.

This renders the SAME TWO PROPS under four whole-pack styles. Same builders,
same camera, same light, same palette -- only the style dials move. Bench and
lamp specifically, because they are the two the operator named, and because
one is a slatted box and the other is a tiered column: a style that only works
on one of them is not a style.

    xvfb-run -a blender -b --python tools/blender/style_probe.py

Writes art-review/style-probe/<style>__<prop>.png. NOTHING in this file feeds
the shipped packs -- it imports them, sets module globals, and puts its output
in its own directory, so a probe can never leak into the game. When a style is
chosen, its numbers are moved into the packs by hand and this stays as the
record of what was compared.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import world_prop_pack as pack  # noqa: E402
from ink import INK  # noqa: E402
from palette import tone  # noqa: E402

OUT = Path(__file__).resolve().parents[2] / "art-review" / "style-probe"

#: The props under test, and why these two. See the module docstring.
PROPS = ("park/bench", "town/lamp")

#: name -> (what it is, dials)
#:
#: `edge_share`   how fat a moulded edge is, as a share of the form's smallest
#:                dimension (world_prop_pack._edge_for)
#: `edge_cap`     the ceiling on that, so a big form does not get a huge round
#: `ink`          Freestyle on/off -- the INTERNAL lines between a prop's parts
#: `ink_thickness` how heavy those lines are at 640px
#: `ink_colour`   what colour they are
#: `coat`         clearcoat added to every material: how much the surface
#:                catches a highlight, i.e. matte toy vs vinyl figure
STYLES = {
    # What is on the branch right now, so there is a baseline in the sheet
    # rather than a memory of one.
    "A-shipping": dict(
        edge_share=0.17, edge_cap=0.26, ink=True, ink_thickness=5.4,
        ink_colour=INK, coat=0.0,
    ),
    # Clash-Mini figurine: fat rounds, heavy line, matte. Everything reads as
    # a moulded piece with a thick edge.
    "B-chunky": dict(
        edge_share=0.30, edge_cap=0.42, ink=True, ink_thickness=8.0,
        ink_colour=INK, coat=0.0,
    ),
    # NO OUTLINE AT ALL, which is what the reference games actually do: Brawl
    # Stars and Clash Mini models carry no black contour, they are read by
    # form, occlusion and a strong key. The black edge was our decision, and
    # this is the version that tests whether it is the right one.
    "C-no-outline": dict(
        edge_share=0.24, edge_cap=0.34, ink=False, ink_thickness=0.0,
        ink_colour=INK, coat=0.05,
    ),
    # Illustrated: a thinner, WARMER line (the ink family at `shade`, not
    # `deep`) plus a real clearcoat, so edges catch light instead of being
    # stamped on. Reads painted rather than printed.
    "D-painted": dict(
        edge_share=0.22, edge_cap=0.32, ink=True, ink_thickness=3.4,
        ink_colour=tone("ink", "shade"), coat=0.16,
    ),
}


def apply(style: dict):
    """Point the pack's own dials at this style. Module globals, no forking."""
    share, cap = style["edge_share"], style["edge_cap"]
    base_edge_for = _ORIGINAL_EDGE_FOR

    def edge_for(size, share=share, cap=cap):
        return base_edge_for(size, share, cap)

    pack._edge_for = edge_for

    # `material` is called both positionally and by keyword across the pack, so
    # the wrapper carries the real signature rather than *args.
    base_material = _ORIGINAL_MATERIAL
    floor = style["coat"]

    def material_shim(name, color, roughness=0.55, metallic=0.0, coat=0.04, surface=None):
        return base_material(name, color, roughness, metallic, max(coat, floor), surface)

    pack.material = material_shim

    base_use_ink = _ORIGINAL_USE_INK

    def use_ink(enabled):
        base_use_ink(enabled and style["ink"])
        if not (enabled and style["ink"]):
            return
        settings = bpy.context.view_layer.freestyle_settings
        lineset = settings.linesets[0]
        lineset.linestyle.thickness = style["ink_thickness"]
        lineset.linestyle.color = pack.rgb(style["ink_colour"])

    pack.use_ink = use_ink


_ORIGINAL_EDGE_FOR = pack._edge_for
_ORIGINAL_MATERIAL = pack.material
_ORIGINAL_USE_INK = pack.use_ink


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for style_name, style in STYLES.items():
        for path in PROPS:
            # Reset to the real pack every time, so one style cannot inherit
            # the previous one's dials.
            pack._edge_for = _ORIGINAL_EDGE_FOR
            pack.material = _ORIGINAL_MATERIAL
            pack.use_ink = _ORIGINAL_USE_INK
            apply(style)
            builder, scale, target, _meta = pack.BUILDERS[path]
            pack.clean_scene()
            pack.setup_camera_and_lights(ortho_scale=scale, target=target,
                                         scene_name=path.split("/", 1)[0])
            pack.use_ink(pack.takes_ink(path))
            builder()
            name = f"{style_name}__{path.replace('/', '-')}.png"
            bpy.context.scene.render.filepath = str(OUT / name)
            bpy.ops.render.render(write_still=True)
            print(f"probe {name}")
    print(f"style probe wrote {len(STYLES) * len(PROPS)} renders to {OUT}")


if __name__ == "__main__":
    main()
