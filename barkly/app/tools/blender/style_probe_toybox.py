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
    """THE PARK TREE. Its bullet list, written before any geometry:

      - Fat flared foot, like it is gripping the ground
      - Leans, and the canopy leans the other way to catch itself
      - Canopy overhangs the trunk on one side like a hat brim
      - Three lobes at three heights -- a scalloped top, never a dome
      - One snapped-off branch stub, high on the lean side

    Five decisions, which is what the concept sheet gives Barkly (it gives him
    eight). The version of this tree without them measured within a few percent
    of the canon on flocking, value spread, darks and lights, and was still
    dead: those are the axes of a MATERIAL, and none of them is character.

    The construction is still rounded boxes -- that part was right. What
    changed is that the boxes now do something.
    """
    bark = toybox.flock("Toy bark", tone("bark", "deep"), sheen=0.48)
    # ONE GREEN FOR THE WHOLE CANOPY. The previous cut painted the three lobes
    # three different greens to satisfy the charcoal/cream rule, and that was a
    # misreading of it: the three swatches belong to the OBJECT, not to each
    # mass of one organ. Painted separately the lobes read as a pile of
    # pillows; painted the same they fuse into one bold shape whose edge is
    # scalloped, which is exactly what the flat tree does and why its
    # silhouette lands instantly. The masses make the OUTLINE. The light makes
    # the shading. Doing both with colour does neither.
    leaf = toybox.flock("Toy leaf", tone("foliage", "base"))
    leaf_mid = leaf_lit = leaf_dark = leaf

    LEAN = 0.085          # radians. Small enough to read as a stance, not a fall.

    # SILHOUETTE TARGET, measured rather than judged: the flat tree this
    # replaces is 0.83 wide-over-tall and Barkly himself is 0.79. Both are
    # TALLER than wide, and both put their widest point about a quarter of the
    # way down. The first pass at this list let the overhang run to 1.04 -- a
    # square canopy, which reads as a smear rather than a tree no matter how
    # much character is authored into it. Character has to live INSIDE a
    # readable silhouette, not instead of one.
    made = [
        # FAT FLARED FOOT. 1.9x at the bottom -- the trunk spreads into the
        # ground rather than meeting it at a right angle. It needs a tall
        # enough trunk to be visible at all; at 2.0 the canopy covered it.
        toybox.rounded("trunk", (0.60, 0.56, 2.55), bark, loc=(0.0, 0.0, 1.27),
                       rotation=(0.0, LEAN, 0.0), corner=0.30,
                       taper=0.60, flare=1.90),
        # THE SNAPPED STUB, high on the lean side. One small wrong thing is
        # worth more than any amount of correct symmetry.
        toybox.rounded("branch_stub", (0.56, 0.22, 0.20), bark,
                       loc=(0.52, -0.04, 2.24), rotation=(0.0, 0.66, 0.0),
                       corner=0.34, taper=0.55),
        # CANOPY: three lobes at three heights, stacked so the SCALLOP is on
        # top where the silhouette shows it. Overhang is deliberate but modest
        # -- one side only, and less than half a lobe.
        toybox.rounded("canopy_low", (2.30, 1.62, 0.98), leaf_dark,
                       loc=(0.50, 0.38, 3.02), rotation=(0.0, 0.0, 0.30),
                       corner=0.46),
        toybox.rounded("canopy_main", (2.42, 1.78, 1.26), leaf_mid,
                       loc=(-0.30, -0.08, 3.42), rotation=(0.0, -0.06, -0.16),
                       corner=0.46),
        toybox.rounded("canopy_high", (1.58, 1.24, 1.00), leaf_lit,
                       loc=(0.22, -0.22, 4.06), rotation=(0.0, 0.10, 0.48),
                       corner=0.46),
        # The heavy lobe that makes the canopy hang to one side -- small, and
        # tucked under, so it weights the mass without widening it.
        toybox.rounded("canopy_drop", (1.02, 0.92, 0.74), leaf_mid,
                       loc=(1.06, 0.04, 2.74), rotation=(0.0, 0.24, -0.34),
                       corner=0.46),
    ]
    return made


def render(name, builder, ortho=6.0, target=(0.0, 0.0, 2.45)):
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
