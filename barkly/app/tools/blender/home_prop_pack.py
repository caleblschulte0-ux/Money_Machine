"""Render Barkly Home hero props as modular transparent 2.5D assets.

This is an asset factory, not a baked room. React Native remains responsible for
scene layout, upgrades, interactions, and responsive placement. Every prop uses
the same camera and light rig so the pack belongs to one physical world.

Run:
  blender -b --python tools/blender/home_prop_pack.py
"""
from __future__ import annotations

import json
import math
import os
from pathlib import Path

import bpy

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
import packfile  # noqa: E402  -- what a render depends on, for the freshness marker
from palette import light_rgb, sun_height, tone, world_rgb  # noqa: E402  -- the one place a colour comes from
# The form recorder and the proportion dials, from the packs that own them.
# Home furniture is drawn to the same rules as everything outdoors -- it is the
# room the player starts in, so it is the LAST place that should be an
# exception -- and `scripts/proportion.py` can only hold it to them if these
# builders log their geometry the way the world pack's do.
import world_prop_pack as wpack  # noqa: E402
from proportion import flare, shaft, stack  # noqa: E402
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "art-review" / "home-props"
OUT.mkdir(parents=True, exist_ok=True)

# Must match world_prop_pack.py. A subtle side plane supplies depth; the
# objects still face the player and share one vanishing direction.
CAMERA_LOCATION = (0.0, -11.2, 4.5)


def _srgb_to_linear(channel: float) -> float:
    """
    THE REASON EVERY PROP SHIPPED PASTEL.

    Blender's Base Color input is LINEAR. A hex colour off a palette is sRGB.
    Handing `int(hex) / 255` straight to the shader tells Blender that #E14B45's
    0.29 green is a linear 0.29, and the render then encodes it back out through
    sRGB on the way to the PNG -- which lifts mid-tones hard. Under a perfectly
    neutral unit light and with no other change, #E14B45 comes back as #F1948E,
    #37B4CD as #80DBE8, #8A3FD6 as #C288EC. Three dusty pastels, from three
    candy colours, with nothing in the lighting or the view transform at fault.

    This is what the AgX fix could not reach. Dropping AgX stopped the highlight
    shoulder from rolling saturated pixels toward white and it measurably helped,
    but the base colours were already wrong before a single light hit them, so
    Town stayed washed and the doc that recorded that pass said so plainly:
    "it did not fix everything".
    """
    if channel <= 0.04045:
        return channel / 12.92
    return ((channel + 0.055) / 1.055) ** 2.4


def rgb(hex_value: str):
    value = hex_value.lstrip("#")
    return tuple(_srgb_to_linear(int(value[i:i + 2], 16) / 255) for i in (0, 2, 4))


def clean_scene():
    wpack.FORMS.clear()
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in list(bpy.data.materials):
        if block.users == 0:
            bpy.data.materials.remove(block)


def look_at(obj, target=(0.0, 0.0, 1.2)):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def make_material(name, color, roughness=0.5, metallic=0.0, coat=0.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*rgb(color), 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = coat
        if "Coat Roughness" in bsdf.inputs:
            bsdf.inputs["Coat Roughness"].default_value = max(0.08, roughness * 0.45)
    elif "Clearcoat" in bsdf.inputs:
        bsdf.inputs["Clearcoat"].default_value = coat
        if "Clearcoat Roughness" in bsdf.inputs:
            bsdf.inputs["Clearcoat Roughness"].default_value = max(0.08, roughness * 0.45)
    return material


def bevel(obj, width=0.12, segments=4):
    mod = obj.modifiers.new("Barkly bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    return obj


def cube(name, loc, scale, material, bevel_width=0.12, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel(obj, bevel_width)
    obj.data.materials.append(material)
    # SMOOTHED THROUGH THE WORLD PACK'S OWN HELPER. These primitives are a
    # second copy of the world pack's, so the room the player starts in would
    # have kept its 48 visible barrel facets while everything outdoors lost
    # them -- the same shape of defect as the four light rigs. One
    # implementation, called from here.
    wpack.round_off(obj)
    return wpack._record(obj)


def sphere(name, loc, scale, material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return wpack._record(obj)


def cylinder(name, loc, radius, depth, material, rotation=(0, 0, 0), vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    bevel(obj, min(radius * 0.22, 0.08), 3)
    wpack.round_off(obj)
    return wpack._record(obj)


def cone(name, loc, radius1, radius2, depth, material, rotation=(0, 0, 0), vertices=48):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius1, radius2=radius2,
                                    depth=depth, location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    bevel(obj, min(radius1 * 0.22, 0.08), 3)
    wpack.round_off(obj)
    return wpack._record(obj)


def contact_shadow(rx, ry, z=0.055):
    # A deliberately authored soft-looking footprint. Real cast shadows from the
    # key light reinforce it, but this ensures the sprite never floats in-app.
    shadow = make_material("Contact shadow", tone("ink", "shade"), roughness=1.0)
    return sphere("contact_shadow", (0, 0.12, z), (rx, ry, 0.045), shadow)


def add_camera_and_lights(ortho_scale=5.8, target=(0, 0, 1.25)):
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except (TypeError, ValueError):
        scene.render.engine = "BLENDER_EEVEE"

    scene.render.resolution_x = 640
    scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    # THE SAME SKY AS EVERYWHERE ELSE, at the same strength. This was a hand
    # picked near-black, so home's furniture had a third light model of its own
    # -- the world pack had one, the scene pack had another, and the room the
    # player starts in had a third.
    scene.world.color = world_rgb()

    # Keep contrast consistent across Blender 3.x/4.x.
    # STANDARD, NOT AgX -- see tools/blender/world_prop_pack.py for the
    # measurement. AgX rolls saturated highlights toward white by design, which
    # is what turned every authored candy colour in this pack into pastel.
    try:
        scene.view_settings.view_transform = "Standard"
    except (TypeError, ValueError):
        pass
    try:
        scene.view_settings.look = "None"
    except (TypeError, ValueError):
        pass

    bpy.ops.object.camera_add(location=CAMERA_LOCATION)
    cam = bpy.context.object
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = ortho_scale
    look_at(cam, target)
    scene.camera = cam

    # ONE SUN AND ONE FILL -- no rim. This was "a warm upper-left key, a cool
    # low-strength fill, and a gentle warm rim", three area lights, and it was
    # the last three-lamp studio rig left in the game: the world pack gave its
    # up, the scene pack never had one, and the room the player starts in kept
    # a third light model of its own. Measured in the app, home held 9.0% of
    # its frame under value 0.25 while park reached 14.8% and town 15.8%.
    #
    # The rim goes for the reason it went outdoors: the ink contour separates a
    # prop from what is behind it now, and a rim light doing the same job just
    # bleaches the edge it is drawn on.
    #
    # The ELEVATION is not written here. It lives in `palette.SUN_ELEVATION`
    # with the three outdoor scenes -- 38 degrees for a room, because a window
    # is a small aperture and the light through it is already directional, so
    # an interior does not want the 26-degree rake an open field does.
    reach = math.hypot(5.0, 6.0)
    bpy.ops.object.light_add(type="SUN", location=(-5.0, -6.0, sun_height(reach, "home")))
    key = bpy.context.object
    key.name = "Barkly key"
    key.data.energy = 6.2
    key.data.angle = math.radians(7.0)
    key.data.color = light_rgb("key")
    look_at(key, target)

    bpy.ops.object.light_add(type="AREA", location=(5.0, -2.2, 4.0))
    fill = bpy.context.object
    fill.name = "Barkly cool fill"
    fill.data.energy = 70
    fill.data.size = 5.5
    fill.data.color = light_rgb("fill")
    look_at(fill, target)

    # No rim: the contour separates a cut-out from its background now.


def chair():
    fabric = make_material("Muted coral upholstery", tone("berry", "base"), roughness=0.72, coat=0.02)
    fabric_light = make_material("Seat upholstery", tone("sea", "base"), roughness=0.78)
    seam = make_material("Upholstery seam", tone("stone", "shade"), roughness=0.84)
    wood = make_material("Warm chair feet", tone("wood", "base"), roughness=0.56, coat=0.03)
    pillow = make_material("Butter pillow", tone("sun", "base"), roughness=0.66)

    contact_shadow(1.38, 0.70)
    # The shared camera supplies the side plane. A second object-level yaw made
    # this chair disagree with the window, shelf, and floor perspective.
    yaw = 0
    cube("chair_back", (0.04, 0.42, 1.63), (1.18, 0.34, 0.92), fabric, 0.34, (math.radians(-5), 0, yaw))
    cube("chair_seat", (0.0, -0.13, 0.83), (0.96, 0.67, 0.23), fabric_light, 0.22, (0, 0, yaw))
    cube("chair_arm_l", (-1.03, -0.05, 1.02), (0.25, 0.72, 0.48), fabric, 0.24, (0, 0, yaw))
    cube("chair_arm_r", (1.03, -0.05, 1.02), (0.25, 0.72, 0.48), fabric, 0.24, (0, 0, yaw))
    cube("seat_seam", (0, -0.72, 0.82), (0.76, 0.035, 0.035), seam, 0.025, (0, 0, yaw))
    cube("pillow", (0.31, 0.05, 1.45), (0.43, 0.16, 0.42), pillow, 0.17, (math.radians(-8), math.radians(8), math.radians(10)))
    for x in (-0.78, 0.78):
        cube(f"foot_{x}", (x, 0.28, 0.28), (0.13, 0.14, 0.28), wood, 0.07, (math.radians(-5), 0, yaw))


def lamp():
    brass = make_material("Lamp brass", tone("sun", "base"), roughness=0.28, metallic=0.72)
    wood = make_material("Lamp stem wood", tone("wood", "base"), roughness=0.52, coat=0.04)
    # OFF THE SUN FAMILY ALTOGETHER, because the key is a sun now. `sun.pop` is
    # value 0.97 and `sun.lit` is 0.82: painted that high, a lampshade facing a
    # real light has nowhere to go and 25.8% of the prop came out pure white. A
    # lampshade looks lit because it is BRIGHTER THAN WHAT IS AROUND IT, which
    # is the light's job; painting it at the top of the ramp as well just clips
    # it.
    #
    # Stepping it down to `sun.base` fixed the clip and broke something else:
    # that is the tone the BRASS is, and the top rim sits directly on the
    # shade. Two touching parts of one prop at one tone is a single blob, and
    # `tests/palette_source.test.ts` caught it. `cream.base` is the honest
    # answer rather than a dodge -- brass is gold metal (chroma 0.75) and an
    # undyed woven shade is pale cloth (chroma 0.16). They separate by
    # SATURATION instead of by value, so the rim still reads against the shade
    # at a distance where a one-step value difference would not.
    shade = make_material("Warm woven shade", tone("cream", "base"), roughness=0.68)
    inner = make_material("Lit shade underside", tone("sun", "lit"), roughness=0.62, coat=0.04)

    contact_shadow(0.68, 0.42)
    # The stem measured 0.058 of its own height -- under STOUT, the same wire
    # the town lamp post was, in the room the player opens the game in. It is a
    # cone now, flaring 0.22 -> 0.10 onto a foot sized off the shaft, and the
    # shade drops onto it with a BITE instead of balancing on top.
    cylinder("lamp_base", (0, 0, 0.20), flare(0.22) * 2.2, 0.28, brass)
    cone("lamp_stem", (-0.02, 0, 1.58), 0.22, shaft(0.22), 2.66, wood)
    # Chunky oversize shade, a recognizable silhouette rather than a triangle icon.
    bpy.ops.mesh.primitive_cone_add(vertices=64, radius1=0.92, radius2=0.58, depth=1.06,
                                    location=(0, 0, stack(2.91, 0.53)))
    shade_obj = bpy.context.object
    shade_obj.name = "lamp_shade"
    shade_obj.data.materials.append(shade)
    bevel(shade_obj, 0.08, 4)
    shade_z = stack(2.91, 0.53)
    cylinder("shade_lower_rim", (0, 0, shade_z - 0.50), 0.92, 0.10, inner)
    cylinder("shade_top_rim", (0, 0, shade_z + 0.50), 0.58, 0.09, brass)


def bed():
    """His bed: a STUFFED bolster, not a swim ring.

    It was one smooth flattened torus with a flat cream disc lying inside it,
    and at any size that is an inflatable pool ring with a cushion dropped in.
    Two things fix it and neither is texture: the bolster is LUMPY (a ring of
    overlapping spheres over the torus, so the silhouette is stuffed fabric
    rather than a machined tube) and the cushion DOMES above the cavity instead
    of sinking into it.
    """
    # Deeper than the first aqua. The bed is the single biggest object on the
    # floor and at #1DBEE6 it was the brightest thing in the room after the
    # window -- and, measured against the shop panes its own card sits on, it
    # came out at 2.7:1 where 3:1 is the floor. Same colour, less light in it.
    # A STEP DOWN, because this one also stands on the shop's pale panes.
    # Pulling the world's chroma to 0.72 -- the fix for a build that hurt to
    # look at -- lightened every family, and the bed came out at 2.95:1
    # against four of the five panes, just under the 3:1 every item render is
    # held to. Same answer the cheese got: the ITEM moves down its own ramp
    # rather than the panes being darkened around it, because the panes are
    # UI and the world is not allowed to push the UI around.
    rim = make_material("Aqua plush rim", tone("sea", "shade"), roughness=0.90)
    rim_lump = make_material("Aqua plush lump", tone("sea", "base"), roughness=0.92)
    rim_dark = make_material("Aqua plush cavity", tone("sea", "deep"), roughness=0.94)
    cushion = make_material("Cream plush cushion", tone("cream", "shade"), roughness=0.94)
    cushion_shade = make_material("Cream plush shade", tone("sand", "shade"), roughness=0.95)
    stitch = make_material("Bed stitch", tone("wood", "lit"), roughness=0.95)

    contact_shadow(1.48, 0.76)
    bpy.ops.mesh.primitive_torus_add(major_segments=64, minor_segments=24, location=(0, 0.08, 0.48), major_radius=0.95, minor_radius=0.37)
    outer = bpy.context.object
    outer.name = "plush_rim"
    outer.scale = (1.42, 0.86, 0.70)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    outer.data.materials.append(rim)
    bpy.ops.object.shade_smooth()

    # The stuffing. Fourteen overlapping lobes around the same ellipse the
    # torus follows, so there is no gap to fall through and the outline reads
    # as something a dog would sink into.
    lobes = 14
    for i in range(lobes):
        angle = (i / lobes) * math.tau
        sphere(
            f"plush_lobe_{i}",
            (1.349 * math.cos(angle), 0.08 + 0.817 * math.sin(angle), 0.50),
            (0.40, 0.31, 0.27),
            rim_lump if i % 2 else rim,
        )

    sphere("bed_cavity", (0, 0.04, 0.36), (1.12, 0.66, 0.24), rim_dark)
    sphere("bed_cushion_shade", (0, 0.03, 0.48), (1.03, 0.60, 0.22), cushion_shade)
    # High enough to swell against the inner lip. Sunk at 0.46 you were looking
    # down a well past the near bolster at a small pale disc, which is a swim
    # ring with something floating in it, not a bed with a cushion in it.
    sphere("bed_cushion", (0, -0.03, 0.56), (0.97, 0.56, 0.22), cushion)
    # Three stitched channels hint at compression without noisy texture.
    for x in (-0.44, 0, 0.44):
        cylinder(f"stitch_{x}", (x, -0.52, 0.56), 0.035, 0.18, stitch, rotation=(math.radians(90), 0, 0), vertices=24)


def shelf():
    wood = make_material("Honey painted wood", tone("wood", "base"), roughness=0.52, coat=0.04)
    wood_dark = make_material("Shelf recess", tone("wood", "shade"), roughness=0.70)
    cream = make_material("Cabinet inset", tone("wood", "lit"), roughness=0.64)
    brass = make_material("Shelf brass", tone("sun", "base"), roughness=0.30, metallic=0.68)
    book_red = make_material("Muted red book", tone("berry", "base"), roughness=0.70)
    book_blue = make_material("Muted blue book", tone("sea", "base"), roughness=0.70)
    trophy = make_material("Trophy gold", tone("sun", "lit"), roughness=0.28, metallic=0.72)

    contact_shadow(1.05, 0.46)
    # One strong cabinet mass with actual depth and just a few story objects.
    cube("shelf_back", (0, 0.36, 1.72), (1.05, 0.22, 1.70), wood_dark, 0.18)
    cube("shelf_left", (-1.02, 0, 1.72), (0.18, 0.48, 1.72), wood, 0.16)
    cube("shelf_right", (1.02, 0, 1.72), (0.18, 0.48, 1.72), wood, 0.16)
    cube("shelf_top", (0, 0, 3.39), (1.18, 0.50, 0.18), wood, 0.16)
    cube("shelf_bottom", (0, 0, 0.17), (1.18, 0.50, 0.18), wood, 0.16)
    for z in (1.18, 2.20):
        cube(f"shelf_{z}", (0, 0.02, z), (0.98, 0.45, 0.11), wood, 0.10)
    cube("lower_cabinet", (0, -0.03, 0.62), (0.90, 0.35, 0.32), cream, 0.12)
    cylinder("knob_l", (-0.24, -0.39, 0.62), 0.075, 0.08, brass, rotation=(math.radians(90), 0, 0), vertices=32)
    cylinder("knob_r", (0.24, -0.39, 0.62), 0.075, 0.08, brass, rotation=(math.radians(90), 0, 0), vertices=32)
    cube("book_red", (-0.47, -0.31, 1.48), (0.15, 0.10, 0.27), book_red, 0.035, (0, 0, math.radians(-3)))
    cube("book_blue", (-0.15, -0.31, 1.46), (0.13, 0.10, 0.30), book_blue, 0.035, (0, 0, math.radians(4)))
    cylinder("trophy_cup", (0.43, -0.29, 2.52), 0.22, 0.30, trophy, vertices=40)
    cylinder("trophy_stem", (0.43, -0.29, 2.25), 0.07, 0.24, trophy, vertices=32)
    cylinder("trophy_base", (0.43, -0.29, 2.10), 0.24, 0.08, wood_dark, vertices=36)


BUILDERS = {
    "chair": (chair, 5.2, (0, 0, 1.25), {"displayWidth": 168, "anchor": "bottom"}),
    "lamp": (lamp, 5.0, (0, 0, 1.65), {"displayWidth": 100, "anchor": "bottom"}),
    "bed": (bed, 4.4, (0, 0, 0.65), {"displayWidth": 164, "anchor": "bottom"}),
    "shelf": (shelf, 5.6, (0, 0, 1.72), {"displayWidth": 174, "anchor": "bottom"}),
}


def render_prop(name):
    """Render whatever is currently built. The BUILD happens in main()."""
    scene = bpy.context.scene
    scene.render.filepath = str(OUT / f"{name}.png")
    bpy.ops.render.render(write_still=True)
    print(f"rendered {scene.render.filepath}")



def stamp_pack(out_dir):
    """Record WHICH VERSION of this file rendered into `out_dir`.

    `scripts/promote-props.py` reads this instead of comparing modification
    times. Times are rewritten by `git rebase`, `git checkout` and a fresh
    clone without a byte of the pack changing -- which marked every render
    stale and cost a fifteen-minute re-render to produce identical files --
    and a `git stash pop` can restore an older pack with a newer time, which
    the time check waved straight through.

    Written LAST, after every render in the run succeeded. A pass that dies
    halfway must not leave a marker saying the directory is current.
    """
    #
    # THE PACK AND WHAT IT IMPORTS. This hashed one file, so `palette.py` --
    # every colour in the game, both lights, and since the sun pass the
    # ELEVATION each pack lights from -- could be edited with every render in
    # the repo still reporting itself current. `packfile.fingerprint` is the
    # one implementation, shared with `scripts/promote-props.py`, because a
    # marker the writer and the reader compute differently is worse than none.
    digest = packfile.fingerprint(Path(__file__).resolve())
    (out_dir / ".pack-sha256").write_text(digest + "\n", encoding="utf-8")


def main():
    manifest = {
        "camera": "Barkly Home 3/4 orthographic v1",
        "light": "warm upper-left key + cool fill + warm rim",
        "assets": {},
    }
    # Same PROP_ONLY narrowing as the world pack: render one prop while you are
    # iterating on it. The manifest still describes every prop either way.
    only = os.environ.get("PROP_ONLY", "").strip()
    for name, (builder, scale, target, metadata) in BUILDERS.items():
        # Built either way, rendered only when wanted: measuring costs
        # milliseconds and it is what keeps the manifest's proportion block
        # complete under PROP_ONLY.
        clean_scene()
        add_camera_and_lights(ortho_scale=scale, target=target)
        builder()
        if not only or name.startswith(only):
            render_prop(name)
        entry = {"file": f"{name}.png", **metadata}
        form = wpack.measure_form()
        if form:
            entry["form"] = form
        manifest["assets"][name] = entry
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    if not only:
        stamp_pack(OUT)


if __name__ == "__main__":
    main()
