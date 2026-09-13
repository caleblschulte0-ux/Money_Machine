"""ONE PROP, FINISHED, in the style the canon is already drawn in.

`docs/ART_NEGATIVE_SPACE.md` carries a standing process rule from an earlier
round: *before any further style round, pick ONE prop, finish it to shippable
quality, and judge that.* A hundred props averaged toward a style is how this
project spent a day learning that global parameters cannot rescue individual
shapes. This is that one prop.

The tree, because it is the most repeated object in the park -- eleven of them
in the plate -- so if the style does not hold on a tree it does not hold.

    xvfb-run -a blender -b --python tools/blender/style_probe_toybox.py
"""
import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))

import toybox                      # noqa: E402
import world_prop_pack as pack     # noqa: E402
from palette import tone           # noqa: E402

OUT = ROOT / "art-review" / "style-probe"


def clean():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.lights):
        for item in list(block):
            block.remove(item)


def toy_tree():
    """A tree as a moulded toy: a drafted rectangular trunk and three boxed
    canopy masses, stacked and rotated off-axis so the silhouette is not
    symmetrical.

    The old tree revolved a profile: a lathe canopy is a shape with one axis
    and infinite sides, which photographs as an egg from every angle. A boxed
    mass has four faces, so the light gives it a BRIGHT side and a DARK side --
    that is where a toy's readability comes from, and a revolve cannot have it.
    """
    # One step DOWN the ramp from the obvious choice. The canon puts 18% of
    # Barkly below value 0.25; a canopy painted base/lit/pop has no dark end to
    # sit the tree on, and the first cut measured 0.0% dark.
    bark = toybox.flock("Toy bark", tone("bark", "deep"), sheen=0.48)
    leaf_mid = toybox.flock("Toy leaf mid", tone("foliage", "base"))
    leaf_lit = toybox.flock("Toy leaf lit", tone("foliage", "lit"))
    leaf_dark = toybox.flock("Toy leaf dark", tone("foliage", "deep"))

    made = [
        # trunk -- drafted, so it leaves the tool
        # CHUNKY, and weight low. The canon is a low-slung dog with a big head
        # and short thick legs; a tree in the same language is a fat short
        # trunk under a canopy wider than it is tall, not a pole with a ball.
        # The trunk carries the tree up to eye height and stays CENTRED under
        # the canopy. The previous cut hid it behind an off-centre canopy and
        # the whole thing read as a pillow on a peg -- "BOLD SILHOUETTE, EASY
        # TO RECOGNIZE" is on the concept sheet and a silhouette you have to
        # work out is not one.
        toybox.rounded("trunk", (0.62, 0.58, 2.05), bark, loc=(0.0, 0.0, 1.02),
                       corner=0.30, taper=0.74),
        # Three masses that STAY three. The first cut overlapped them so
        # heavily they fused into one blob -- the point of a boxed canopy is
        # that each mass turns a different face to the key, so they have to
        # keep their own corners.
        # Broad and low, the way a deciduous tree reads at a glance: the
        # widest mass sits at the BOTTOM of the canopy, not the middle.
        toybox.rounded("canopy_back", (2.85, 1.75, 1.10), leaf_dark,
                       loc=(0.30, 0.40, 2.42), rotation=(0.0, 0.0, 0.34),
                       corner=0.46),
        toybox.rounded("canopy_main", (3.05, 2.05, 1.30), leaf_mid,
                       loc=(-0.06, -0.08, 2.62), rotation=(0.0, 0.0, -0.18),
                       corner=0.46),
        toybox.rounded("canopy_top", (1.86, 1.42, 1.00), leaf_lit,
                       loc=(0.10, -0.22, 3.32), rotation=(0.0, 0.0, 0.52),
                       corner=0.46),
    ]
    return made


def render(name, builder, ortho=5.6, target=(0.0, 0.0, 1.95)):
    clean()
    toybox.studio(target=target, key_energy=3600.0)
    builder()
    cam_loc = (0.0, -11.2, 4.5)
    bpy.ops.object.camera_add(location=cam_loc)
    cam = bpy.context.object
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = ortho
    pack.look_at(cam, target)
    scene = bpy.context.scene
    scene.camera = cam
    scene.render.resolution_x = 560
    scene.render.resolution_y = 760
    scene.render.film_transparent = True
    OUT.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(OUT / f"{name}.png")
    bpy.ops.render.render(write_still=True)
    print(f"rendered {name}")


render("toy_tree", toy_tree)
