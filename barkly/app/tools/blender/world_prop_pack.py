"""Render Barkly's modular 2.5D world prop pack.

This intentionally does not render complete backgrounds. React Native owns the
sky, terrain, time of day, responsive layout, interactions, and upgrade state.
Blender supplies only alpha-trimmed physical objects sharing one camera,
material language, and light rig.

Run:
  blender -b --python tools/blender/world_prop_pack.py
"""
from __future__ import annotations

import json
import math
import os
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "art-review" / "world-props"
OUT.mkdir(parents=True, exist_ok=True)

# One front-weighted orthographic camera for the whole world. The first pack
# used a 36-degree side angle; individual props had nice volume, but a room of
# them looked as if every object had been rotated toward a different vanishing
# point. Fifteen degrees keeps a readable side plane without turning the world
# into a shelf of diagonal product renders.
CAMERA_LOCATION = (3.0, -10.8, 4.5)


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


def rgb(value: str):
    value = value.lstrip("#")
    return tuple(_srgb_to_linear(int(value[i:i + 2], 16) / 255) for i in (0, 2, 4))


def clean_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in list(bpy.data.materials):
        if block.users == 0:
            bpy.data.materials.remove(block)


def look_at(obj, target=(0.0, 0.0, 1.2)):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def material(name, color, roughness=0.55, metallic=0.0, coat=0.04):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
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
    return mat


def bevel(obj, width=0.10, segments=4):
    modifier = obj.modifiers.new("Barkly molded edge", "BEVEL")
    modifier.width = width
    modifier.segments = segments
    return obj


def cube(name, loc, scale, mat, bevel_width=0.10, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel(obj, bevel_width)
    obj.data.materials.append(mat)
    return obj


def sphere(name, loc, scale, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return obj


def cylinder(name, loc, radius, depth, mat, rotation=(0, 0, 0), vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=loc,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    bevel(obj, min(radius * 0.20, 0.08), 3)
    return obj


def cone(name, loc, radius1, radius2, depth, mat, rotation=(0, 0, 0), vertices=64):
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius1,
        radius2=radius2,
        depth=depth,
        location=loc,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    bevel(obj, 0.06, 3)
    return obj


def torus(name, loc, major_radius, minor_radius, mat, scale=(1, 1, 1), rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(
        major_segments=64,
        minor_segments=24,
        major_radius=major_radius,
        minor_radius=minor_radius,
        location=loc,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return obj


def contact_shadow(rx, ry, z=0.045):
    shadow = material("Contact shadow", "#311E18", roughness=1.0, coat=0.0)
    return sphere("contact_shadow", (0, 0.18, z), (rx, ry, 0.035), shadow)


def setup_camera_and_lights(ortho_scale=5.8, target=(0, 0, 1.4), resolution=(640, 640)):
    scene = bpy.context.scene
    try:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    except (TypeError, ValueError):
        scene.render.engine = "BLENDER_EEVEE"

    scene.render.resolution_x = resolution[0]
    scene.render.resolution_y = resolution[1]
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    scene.world.color = (0.045, 0.055, 0.075)

    # STANDARD, NOT AgX. Every prop in this pack was coming out of Blender
    # pastel: measured, the Town storefronts render around #A0A0A0/#C0A0A0
    # even though their base colours are #E14B45 and #37B4CD, which is what
    # kept Town at 22% colourless pixels after the palette, the road and the
    # compositing had all been fixed in the app. The cause is the view
    # transform. AgX is filmic -- its job is to roll saturated highlights
    # toward white so photographic renders do not clip -- and under a 1000W
    # key that is most of a brightly lit toy prop. Correct for photoreal work,
    # wrong for stylised game art, where the flat saturated colour IS the look.
    # Standard keeps what was authored; the light energies drop with it so
    # nothing clips now that the shoulder is gone.
    try:
        scene.view_settings.view_transform = "Standard"
    except (TypeError, ValueError):
        pass
    try:
        scene.view_settings.look = "None"
    except (TypeError, ValueError):
        pass

    bpy.ops.object.camera_add(location=CAMERA_LOCATION)
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = ortho_scale
    look_at(camera, target)
    scene.camera = camera

    bpy.ops.object.light_add(type="AREA", location=(-4.8, -5.0, 8.4))
    key = bpy.context.object
    key.name = "Barkly warm key"
    key.data.energy = 880
    key.data.size = 5.0
    key.data.color = (1.0, 0.77, 0.58)
    look_at(key, target)

    bpy.ops.object.light_add(type="AREA", location=(5.0, -2.2, 4.0))
    fill = bpy.context.object
    fill.name = "Barkly cool fill"
    fill.data.energy = 300
    fill.data.size = 5.5
    fill.data.color = (0.58, 0.78, 1.0)
    look_at(fill, target)

    bpy.ops.object.light_add(type="AREA", location=(1.8, 4.0, 6.8))
    rim = bpy.context.object
    rim.name = "Barkly warm rim"
    rim.data.energy = 408
    rim.data.size = 4.2
    rim.data.color = (1.0, 0.84, 0.63)
    look_at(rim, target)


def park_tree():
    bark = material("Tree bark", "#70391A", roughness=0.72)
    bark_light = material("Tree bark light", "#B96526", roughness=0.66)
    leaf = material("Leaf green", "#2BA94C", roughness=0.76, coat=0.02)
    leaf_light = material("Leaf light", "#68DC5D", roughness=0.72, coat=0.03)
    leaf_dark = material("Leaf depth", "#136D36", roughness=0.80)

    contact_shadow(1.50, 0.74)
    cone("trunk", (0, 0.12, 1.45), 0.54, 0.28, 2.9, bark)
    cylinder("trunk_glint", (-0.22, -0.43, 1.52), 0.08, 2.1, bark_light, rotation=(math.radians(-4), 0, math.radians(-4)))
    for i, (x, y, z, sx, sy, sz) in enumerate([
        (-0.72, 0.16, 3.05, 0.92, 0.72, 0.78),
        (0.03, 0.26, 3.40, 1.12, 0.84, 0.92),
        (0.82, 0.12, 3.10, 0.90, 0.70, 0.76),
        (-0.30, -0.12, 3.88, 0.82, 0.67, 0.68),
        (0.50, -0.06, 3.82, 0.80, 0.64, 0.66),
    ]):
        sphere(f"crown_{i}", (x, y, z), (sx, sy, sz), leaf if i % 2 else leaf_dark)
    sphere("crown_highlight", (-0.48, -0.48, 3.76), (0.62, 0.28, 0.34), leaf_light)


def park_bench():
    wood = material("Bench honey wood", "#BD601C", roughness=0.58, coat=0.05)
    wood_light = material("Bench sun face", "#EE8C36", roughness=0.52, coat=0.06)
    metal = material("Bench iron", "#344349", roughness=0.36, metallic=0.64)

    contact_shadow(1.65, 0.52)
    for z in (1.15, 1.52, 1.88):
        cube(f"back_slats_{z}", (0, 0.28, z), (1.52, 0.15, 0.13), wood, 0.12, (math.radians(-5), 0, 0))
    for y in (-0.36, 0.00, 0.34):
        cube(f"seat_slats_{y}", (0, y, 0.88), (1.52, 0.15, 0.12), wood_light, 0.10)
    for x in (-1.25, 1.25):
        cube(f"leg_{x}", (x, 0.18, 0.42), (0.13, 0.18, 0.52), metal, 0.08)
        cube(f"arm_{x}", (x, -0.04, 1.13), (0.12, 0.58, 0.10), metal, 0.08, (0, math.radians(-5), 0))


def park_hedge():
    leaf = material("Hedge green", "#39AA43", roughness=0.82)
    leaf_light = material("Hedge light", "#7BDF5A", roughness=0.78)
    earth = material("Hedge earth", "#7A482B", roughness=0.94)
    contact_shadow(1.60, 0.48)
    sphere("earth", (0, 0.18, 0.25), (1.50, 0.52, 0.20), earth)
    for i, x in enumerate((-1.18, -0.58, 0, 0.58, 1.18)):
        sphere(f"hedge_{i}", (x, 0, 0.72 + 0.07 * (i % 2)), (0.61, 0.50, 0.58), leaf if i % 2 else leaf_light)


def storefront(accent_name, body_hex, edge_hex, awning_hex):
    body = material(f"{accent_name} stucco", body_hex, roughness=0.62, coat=0.03)
    edge = material(f"{accent_name} edge", edge_hex, roughness=0.58, coat=0.03)
    # Near-white cream and high-coat glass were the last dead grey in the game.
    # Town measured 33% of world pixels under 0.18 chroma while every other
    # scene cleared 12%, and the offenders were the sign, the alternating
    # awning stripes and the shop windows -- all blowing out to neutral under
    # the key light. A Clash Mini shopfront has no neutral in it: the cream is
    # a warm butter and the glass is a saturated teal that reads as colour, not
    # as reflection. See docs/ART_DIRECTION.md.
    cream = material("Store cream", "#FFD786", roughness=0.62, coat=0.02)
    glass = material("Store glass", "#3FBBD8", roughness=0.30, metallic=0.02, coat=0.12)
    glass_dark = material("Store glass depth", "#2F7387", roughness=0.26, metallic=0.08, coat=0.20)
    awning = material(f"{accent_name} awning", awning_hex, roughness=0.54, coat=0.05)
    wood = material("Display wood", "#954D1F", roughness=0.62)
    brass = material("Store brass", "#E79E1B", roughness=0.28, metallic=0.68)

    contact_shadow(2.05, 0.62)
    cube("store_body", (0, 0.48, 2.25), (1.78, 0.64, 2.22), body, 0.24)
    cube("store_crown", (0, 0.30, 4.46), (1.96, 0.78, 0.24), edge, 0.18)
    cube("sign", (0, -0.28, 3.70), (1.40, 0.16, 0.36), cream, 0.16)
    cube("sign_inset", (0, -0.47, 3.70), (0.94, 0.035, 0.07), awning, 0.04)
    cube("window_depth", (-0.54, -0.21, 1.83), (0.82, 0.20, 1.30), glass_dark, 0.14)
    cube("window", (-0.54, -0.45, 1.88), (0.76, 0.05, 1.22), glass, 0.10)
    cube("door_depth", (1.02, -0.22, 1.64), (0.48, 0.20, 1.53), edge, 0.12)
    cube("door", (1.02, -0.46, 1.68), (0.42, 0.05, 1.44), glass, 0.09)
    cylinder("door_knob", (0.76, -0.56, 1.62), 0.075, 0.08, brass, rotation=(math.radians(90), 0, 0), vertices=32)
    cube("display_shelf", (-0.54, -0.56, 0.88), (0.66, 0.11, 0.12), wood, 0.07)
    sphere("display_round", (-0.83, -0.61, 1.20), (0.25, 0.11, 0.25), awning)
    cube("display_box", (-0.25, -0.62, 1.22), (0.24, 0.10, 0.30), cream, 0.08)
    for i in range(7):
        x = -1.56 + i * 0.52
        cube(f"awning_{i}", (x, -0.72, 3.10), (0.25, 0.58, 0.15), awning if i % 2 == 0 else cream, 0.10, (math.radians(7), 0, 0))


def town_fountain():
    # Measured on the shipped PNG: 15.6% of the fountain's opaque pixels were
    # under 0.18 chroma and its biggest bucket was #C0C090 at 0.25 -- pale
    # khaki, the exact tone that made Town read washed. The stone was authored
    # a couple of shades off white (#E5BD76 lit, #FFD98A on the sun faces), so
    # the key light finished the job. Deeper sandstone keeps the same read at
    # a chroma the grade can actually pick up.
    stone = material("Fountain stone", "#F0B440", roughness=0.72)
    stone_light = material("Fountain stone light", "#FFCB5E", roughness=0.68)
    stone_dark = material("Fountain stone depth", "#8C5418", roughness=0.78)
    water = material("Fountain water", "#3DC7EA", roughness=0.18, metallic=0.06, coat=0.30)
    contact_shadow(1.46, 0.72)
    torus("lower_basin", (0, 0, 0.55), 0.98, 0.24, stone, scale=(1.25, 0.82, 0.72))
    sphere("lower_water", (0, -0.02, 0.60), (1.13, 0.68, 0.10), water)
    cylinder("column", (0, 0.10, 1.38), 0.20, 1.30, stone_dark)
    torus("upper_basin", (0, 0.02, 1.82), 0.50, 0.14, stone_light, scale=(1.18, 0.82, 0.65))
    sphere("upper_water", (0, -0.02, 1.86), (0.55, 0.33, 0.08), water)
    sphere("finial", (0, 0.05, 2.20), (0.19, 0.17, 0.24), stone_light)


def town_lamp():
    # Metallic 0.66 on a near-neutral navy renders as a plain grey pole -- the
    # two tallest objects in Town were the last neutral things in the scene. A
    # toy lamppost is painted, not chromed: keep the hue, drop the metal.
    # The same argument applies to the brass, which was still at 0.72 and was
    # rendering as part of the lamp's 18.0% colourless pixels along with a
    # near-white glass; both are dialled back to painted values here.
    # ...and the navy still lost: the cool fill is (0.58, 0.78, 1.0), so on a
    # dark blue post it lands as cyan-grey and the lamp measured 15.7%
    # colourless even after the metal came off. A painted TEAL post keeps its
    # hue under that fill instead of dissolving into it, and it is the same
    # family as townBlueEdge, so the two tallest objects in Town now belong to
    # Town's palette rather than reading as generic street furniture.
    iron = material("Lamp iron", "#1A6B84", roughness=0.42, metallic=0.10)
    brass = material("Lamp brass", "#D07B15", roughness=0.30, metallic=0.24)
    glass = material("Lamp glow glass", "#FFC93B", roughness=0.22, coat=0.26)
    contact_shadow(0.56, 0.34)
    cylinder("base", (0, 0, 0.20), 0.42, 0.18, iron)
    cylinder("post", (0, 0, 1.72), 0.10, 3.05, iron)
    cylinder("collar", (0, 0, 3.02), 0.22, 0.18, brass)
    cube("lantern", (0, 0, 3.55), (0.42, 0.34, 0.52), iron, 0.12)
    cube("lantern_glass", (0, -0.36, 3.55), (0.29, 0.04, 0.38), glass, 0.08)
    cone("cap", (0, 0, 4.12), 0.56, 0.14, 0.34, iron)


def town_planter():
    pot = material("Planter terracotta", "#E36C3C", roughness=0.76)
    pot_dark = material("Planter depth", "#953922", roughness=0.82)
    leaf = material("Planter leaf", "#2D984B", roughness=0.78)
    leaf_light = material("Planter leaf light", "#71D25A", roughness=0.76)
    contact_shadow(0.84, 0.40)
    cone("pot", (0, 0.05, 0.42), 0.64, 0.48, 0.78, pot)
    cylinder("pot_rim", (0, 0.05, 0.80), 0.66, 0.18, pot_dark)
    for i, (x, z) in enumerate(((-0.34, 1.18), (0, 1.40), (0.34, 1.20), (-0.15, 1.55), (0.18, 1.64))):
        sphere(f"plant_{i}", (x, 0, z), (0.43, 0.34, 0.47), leaf if i % 2 else leaf_light)


def beach_umbrella():
    wood = material("Umbrella wood", "#964D20", roughness=0.66)
    coral = material("Umbrella coral", "#FF5B44", roughness=0.56, coat=0.05)
    coral_dark = material("Umbrella coral edge", "#D12522", roughness=0.62)
    yellow = material("Umbrella yellow", "#FFCF4D", roughness=0.58, coat=0.05)
    contact_shadow(1.22, 0.52)
    cylinder("umbrella_pole", (0, 0.08, 1.62), 0.09, 3.10, wood)
    cone("canopy", (0, 0, 3.44), 1.62, 0.18, 0.74, coral)
    torus("canopy_edge", (0, 0, 3.12), 1.43, 0.10, coral_dark, scale=(1.0, 0.72, 0.65))
    cone("canopy_inset", (0, -0.18, 3.45), 0.88, 0.10, 0.65, yellow)
    sphere("cap", (0, 0, 3.88), (0.16, 0.14, 0.16), yellow)


def beach_lifeguard():
    wood = material("Tower warm wood", "#BB6226", roughness=0.66)
    coral = material("Tower coral", "#F64E3C", roughness=0.62, coat=0.03)
    cream = material("Tower cream", "#FFDA93", roughness=0.68)
    aqua = material("Tower aqua", "#39C0D8", roughness=0.56, coat=0.06)
    glass = material("Tower window", "#8BE0E9", roughness=0.20, coat=0.30)
    contact_shadow(1.45, 0.68)
    for x in (-0.95, 0.95):
        cube(f"stilt_{x}", (x, 0.18, 1.05), (0.13, 0.16, 1.05), wood, 0.07, (0, math.radians(4 if x < 0 else -4), 0))
    cube("platform", (0, 0.05, 1.92), (1.38, 0.78, 0.16), wood, 0.12)
    # A LIFEGUARD TOWER IS RED AND WHITE, not cream on cream. The hut is the
    # biggest mass in this prop and it was the same family as the sand it
    # stands on, so on the contact sheet the whole tower read as a pale smudge
    # a few shades off the beach floor. Bold hut, contrasting roof, cream only
    # as trim.
    cube("hut", (0, 0.18, 2.90), (1.20, 0.65, 0.86), coral, 0.20)
    cube("window", (0, -0.50, 3.04), (0.62, 0.05, 0.38), glass, 0.10)
    cube("window_frame_top", (0, -0.58, 3.45), (0.72, 0.05, 0.07), cream, 0.05)
    cube("window_frame_bottom", (0, -0.58, 2.63), (0.72, 0.05, 0.07), cream, 0.05)
    cube("roof", (0, 0.18, 3.93), (1.46, 0.88, 0.17), aqua, 0.15, (0, math.radians(-4), 0))
    # Ladder remains a separate readable sub-form inside the tower sprite.
    for x in (-0.43, 0.43):
        cube(f"ladder_rail_{x}", (x, -0.50, 0.94), (0.07, 0.08, 0.92), wood, 0.05, (math.radians(-7), 0, 0))
    for z in (0.32, 0.70, 1.08, 1.46):
        cube(f"ladder_step_{z}", (0, -0.62, z), (0.48, 0.07, 0.06), wood, 0.04)
    cube("rescue_mark", (0.86, -0.58, 2.94), (0.18, 0.04, 0.18), cream, 0.08)


# Beach props stand ON sand, so they must not BE sand. The dune and the castle
# were authored a couple of shades off the beach floor they sit on (#F0C463 and
# #F4CA6D against a #FFDC93 near-sand), which is why both read as smudges on
# the contact sheet no matter what the lighting did. Deeper, warmer, wetter
# sand for the objects; the dry floor stays pale.
def beach_dune():
    sand = material("Dune sand", "#E7B247", roughness=0.92)
    sand_light = material("Dune light", "#FFC95F", roughness=0.90)
    grass = material("Dune grass", "#57A335", roughness=0.88)
    contact_shadow(1.62, 0.52)
    sphere("dune", (0, 0.16, 0.34), (1.65, 0.66, 0.42), sand)
    sphere("dune_light", (-0.36, -0.30, 0.48), (0.92, 0.22, 0.16), sand_light)
    for i, x in enumerate((-1.20, -0.72, -0.15, 0.52, 1.06)):
        cylinder(f"grass_{i}", (x, 0, 0.92 + 0.08 * (i % 2)), 0.045, 1.10, grass, rotation=(math.radians(8), math.radians(-12 + i * 6), math.radians(-8 + i * 4)), vertices=20)


def beach_castle():
    sand = material("Castle sand", "#E3AC46", roughness=0.92)
    sand_light = material("Castle sun face", "#FFC85F", roughness=0.90)
    sand_dark = material("Castle depth", "#A06B24", roughness=0.94)
    flag = material("Castle flag", "#FF4A3D", roughness=0.60, coat=0.04)
    wood = material("Flag pole", "#7C482A", roughness=0.72)
    contact_shadow(1.32, 0.52)
    cube("castle_base", (0, 0.08, 0.48), (1.10, 0.60, 0.46), sand, 0.16)
    for i, x in enumerate((-0.82, 0, 0.82)):
        cylinder(f"tower_{i}", (x, -0.02, 1.04 + (0.28 if i == 1 else 0)), 0.38 if i != 1 else 0.44, 1.18 if i != 1 else 1.50, sand_light if i == 1 else sand, vertices=40)
        for j in range(4):
            angle = j * math.pi / 2
            cube(f"battlement_{i}_{j}", (x + math.cos(angle) * 0.25, math.sin(angle) * 0.22, 1.68 + (0.42 if i == 1 else 0)), (0.10, 0.10, 0.12), sand, 0.04)
    cube("door", (0, -0.64, 0.46), (0.24, 0.05, 0.28), sand_dark, 0.12)
    cylinder("flag_pole", (0, 0, 2.68), 0.035, 1.25, wood, vertices=20)
    cube("flag", (0.24, 0, 3.02), (0.28, 0.035, 0.16), flag, 0.04)


def beach_palm():
    trunk = material("Palm trunk", "#A05A26", roughness=0.78)
    trunk_light = material("Palm trunk light", "#DB8438", roughness=0.72)
    leaf = material("Palm leaf", "#2B9751", roughness=0.80)
    leaf_light = material("Palm leaf light", "#5DC759", roughness=0.76)
    contact_shadow(1.12, 0.50)
    for i in range(6):
        x = -0.10 + i * 0.08
        z = 0.36 + i * 0.62
        cylinder(f"trunk_{i}", (x, 0, z), 0.19 - i * 0.012, 0.72, trunk_light if i % 2 else trunk, rotation=(0, math.radians(-8), 0), vertices=32)
    crown = (0.42, 0, 4.05)
    sphere("palm_crown", crown, (0.34, 0.30, 0.28), trunk)
    for i, angle in enumerate((-70, -35, 0, 35, 70, 145)):
        cube(f"frond_{i}", (crown[0] + math.sin(math.radians(angle)) * 0.76, -0.02, crown[2] + math.cos(math.radians(angle)) * 0.24), (0.92, 0.11, 0.16), leaf_light if i % 2 else leaf, 0.12, (0, math.radians(angle * 0.18), math.radians(angle)))


def home_rug():
    gold = material("Rug gold", "#FAB521", roughness=0.92)
    gold_light = material("Rug pile light", "#FFD973", roughness=0.94)
    gold_dark = material("Rug bound edge", "#BE750D", roughness=0.90)
    cream = material("Rug inset", "#FFEDC1", roughness=0.96)
    contact_shadow(1.72, 0.72)
    torus("rug_edge", (0, 0, 0.20), 1.10, 0.24, gold_dark, scale=(1.52, 0.72, 0.34))
    sphere("rug_body", (0, -0.02, 0.22), (1.56, 0.72, 0.18), gold)
    torus("rug_inset", (0, -0.08, 0.30), 0.56, 0.11, cream, scale=(1.45, 0.68, 0.24))
    sphere("rug_glint", (-0.48, -0.60, 0.34), (0.66, 0.11, 0.045), gold_light)


def home_care_tray():
    """
    The tray Barkly's bowl, toy and bed sit in.

    THE LAST BIG CODE-DRAWN OBJECT IN THE GAME. Every piece of furniture around
    it is a render -- his bed, the chair, the lamp, the shelf, the rug, and the
    window frame he stands in front of -- and the tray directly beneath him was
    a rounded rectangle with a gloss bar and two dots on it, on screen in all
    four locations at all times.

    THREE THINGS THIS LEARNED THE HARD WAY, all by looking at it in the app
    rather than in isolation:

    1. IT IS DRAWN AT 330x42, an aspect of 7.9:1. A first pass modelled a
       normal-looking tray, rendered 3.6:1, and `resizeMode="stretch"` squashed
       it to half its height in place. The model is built at the aspect it is
       DISPLAYED at, and the render is measured against that number.
    2. IT HAS NO WELLS. The three cream dishes are live Views: they brighten
       when Barkly wants that thing, and a baked copy underneath them drew
       everything twice. The render owns the wood; the app owns anything that
       changes.
    3. IT IS TURNED SQUARE TO THE CAMERA, and this is the one that cost the
       most. The shared camera sits 15.5 degrees off-axis, which reads as a
       pleasant side plane on a bed or a chair and is invisible on anything
       compact. On an object five units long it is a catastrophe: the long axis
       picks up sin(pitch)*sin(yaw) of vertical drop per unit, so the tray
       rendered as a DIAGONAL, and almost the entire alpha height of the image
       was tilt rather than tray. Stretched into a 42px slot that became a thin
       plank with three items floating over it. Rotating the model by the
       camera's own yaw puts the long axis dead horizontal, so the height in
       the image is the tray's real height -- the front wall, the interior
       floor, the back rim -- and the fix stays inside this one builder instead
       of forking the shared camera every other prop depends on.

    Colours are now written as the colour they should BE. They used to be
    written several stops darker, to compensate for a render pipeline that was
    handing sRGB hex to a linear shader input and washing everything out; with
    that fixed (see `_srgb_to_linear`) the compensation became a second bug and
    the tray rendered nearly black. If a prop's material list looks like it is
    apologising for the lighting, check the colour space before tuning it.
    """
    wood = material("Tray wood", "#C0762A", roughness=0.58, coat=0.05)
    floor = material("Tray floor", "#9B531A", roughness=0.66, coat=0.03)
    front = material("Tray front", "#7E3D12", roughness=0.62, coat=0.04)
    rim = material("Tray rim", "#DE9740", roughness=0.50, coat=0.08)
    shine = material("Tray shine", "#F3C078", roughness=0.40, coat=0.12)
    brass = material("Tray brass", "#EFBA4A", roughness=0.30, metallic=0.72)

    # The camera's own yaw, cancelled. atan(3.0 / 10.8) from CAMERA_LOCATION --
    # derived, never typed as a number, so moving the camera moves the tray with
    # it instead of leaving a stale literal behind.
    theta = math.atan2(CAMERA_LOCATION[0], -CAMERA_LOCATION[1])
    cos_t, sin_t = math.cos(theta), math.sin(theta)

    def place(name, loc, scale, mat, bevel_width=0.10):
        x, y, z = loc
        return cube(
            name,
            (x * cos_t - y * sin_t, x * sin_t + y * cos_t, z),
            scale,
            mat,
            bevel_width,
            rotation=(0, 0, theta),
        )

    def stud(name, loc, scale, mat):
        x, y, z = loc
        return sphere(name, (x * cos_t - y * sin_t, x * sin_t + y * cos_t, z), scale, mat)

    # No contact shadow: the app draws its own behind this (styles.dockShadow).
    #
    # Local frame: +X runs along the tray (screen-horizontal once rotated), -Y
    # is toward the camera, +Z is up. A real open box -- floor, front wall, back
    # wall, two end caps -- because the thing that made the flat version work
    # was CONTAINMENT, and a slab has none.
    # `cube` scales a two-unit default cube, so every tuple below is a HALF
    # extent. The first square-to-camera pass read them as full sizes, built the
    # tray at double scale, and it overflowed the frame with its ends sheared
    # off at the image edge -- which the alpha bbox reports as a clean full-width
    # render, so it has to be checked against the ortho box, not just measured.
    place("tray_floor", (0, 0, 0.19), (2.80, 0.48, 0.05), floor, 0.04)
    place("tray_back", (0, 0.43, 0.32), (2.80, 0.05, 0.20), wood, 0.04)
    place("tray_front", (0, -0.43, 0.27), (2.80, 0.05, 0.17), front, 0.04)
    place("tray_front_lip", (0, -0.43, 0.45), (2.80, 0.065, 0.025), rim, 0.02)
    place("tray_end_l", (-2.75, 0, 0.30), (0.05, 0.48, 0.18), wood, 0.04)
    place("tray_end_r", (2.75, 0, 0.30), (0.05, 0.48, 0.18), wood, 0.04)
    place("tray_back_lip", (0, 0.43, 0.53), (2.80, 0.065, 0.02), rim, 0.02)
    # The long highlight down the front wall: the one detail that says "sealed
    # wood" instead of "brown rectangle".
    place("tray_gloss", (0, -0.49, 0.34), (2.55, 0.01, 0.015), shine, 0.008)
    # The two rivets the flat version had at its ends -- the one detail that
    # said "made object" rather than "rectangle".
    for i, x in enumerate((-2.55, 2.55)):
        stud(f"rivet_{i}", (x, -0.49, 0.23), (0.05, 0.035, 0.05), brass)


# ---------------------------------------------------------------------------
# THE STORE'S ITEMS, RENDERED LIKE EVERYTHING ELSE HE OWNS.
#
# The care tray under Barkly is a render, the bowl and toy on it are drawn with
# real volume, and the food sheet listed the SAME OBJECTS as flat glyphs in
# coloured squares: a beige blob for dinner, a white bone on coral for biscuits,
# a yellow square with a scribble for cheese. One app, two art languages, and
# the cheap one used on the screen where a child chooses what to give him.
#
# These go through the shared camera and light rig -- and, since the colour
# space fix, the shared basis too -- so an item in the shop is the same object a
# player later sees in his mouth. Modelled bold rather than detailed: they are
# read at about 48px in a list row, so silhouette and one strong colour do all
# the work and a fillet does the rest.
# ---------------------------------------------------------------------------


def item_biscuit():
    """A bone biscuit: one smooth bar with a knob at each corner of each end.

    The first pass laid a darker bar along the underside as a shadow line; at
    thumbnail size that stripe read as a plank, and the whole thing looked like
    a little wooden bench. A bone is a silhouette, so it is now only that.
    """
    dough = material("Biscuit dough", "#D79A4C", roughness=0.78)
    for x in (-0.34, 0.34):
        for z in (-0.16, 0.16):
            sphere(f"knob_{x}_{z}", (x, 0, 0.58 + z), (0.18, 0.16, 0.17), dough)
    cube("bone_bar", (0, 0, 0.58), (0.34, 0.11, 0.11), dough, 0.09)


def item_cheese():
    """A wedge. A three-sided cylinder IS a triangular prism; a rotated cube is
    a rhombus, which is what the first pass rendered."""
    flesh = material("Cheese flesh", "#FFC93F", roughness=0.60, coat=0.05)
    rind = material("Cheese rind", "#E8A21C", roughness=0.64)
    hole = material("Cheese hole", "#B4761A", roughness=0.72)
    cylinder("wedge", (0, 0, 0.56), 0.52, 0.34, flesh,
             rotation=(math.radians(90), 0, 0), vertices=3)
    cylinder("wedge_rind", (0, -0.18, 0.56), 0.52, 0.03, rind,
             rotation=(math.radians(90), 0, 0), vertices=3)
    for x, z in ((-0.06, 0.52), (0.12, 0.44), (0.00, 0.68)):
        sphere(f"hole_{x}_{z}", (x, -0.19, z), (0.055, 0.03, 0.055), hole)


def item_steak():
    """A cut of meat: one mass, a rim of fat around it, one seared highlight.

    Three passes were lost to detail this thing has no room for. Pale caps at
    each END made it symmetrical and read as a wrapped sweet; fat along the top
    edge read as a bun; a bone poking out of one side read as a drumstick. The
    thing that actually says "steak" at 48px is a rounded slab of red with a
    cream rim, so that is all this is now -- and no bone, because a bone is what
    kept turning it into some other food.
    """
    meat = material("Steak", "#A93A2A", roughness=0.68)
    sear = material("Steak sear", "#C9553C", roughness=0.60)
    fat = material("Steak fat", "#F3DCC0", roughness=0.62)
    sphere("fat_rim", (0, 0.03, 0.56), (0.52, 0.20, 0.36), fat)
    sphere("cut", (0, -0.04, 0.56), (0.46, 0.20, 0.31), meat)
    sphere("cut_lit", (-0.12, -0.20, 0.66), (0.22, 0.07, 0.12), sear)


def item_ball():
    """A squeaky ball: one sphere with a cream stripe around its middle.

    Three passes. A torus at the sphere's own radius renders as a ring AROUND
    it -- a planet, not a toy. An inset patch at y=-0.30 sat entirely INSIDE a
    sphere of radius 0.46 and rendered as two stray specks. Placing that patch
    correctly on the visible face, with a gloss dot above it, drew a curved
    line under a round highlight -- a smiley face, on a ball, in a dog's toy
    box. The stripe now runs all the way round the equator, which is both what
    a real ball looks like and a shape that cannot be read as a mouth.
    """
    body = material("Ball body", "#E0452F", roughness=0.42, coat=0.20)
    band = material("Ball band", "#FFF3E0", roughness=0.44, coat=0.18)
    sphere("ball", (0, 0, 0.58), (0.46, 0.46, 0.46), body)
    sphere("band", (0, 0, 0.58), (0.485, 0.485, 0.14), band)


def item_rope():
    """A knotted tug rope: a thick braid with a fat knot and a tuft at each end.

    Three passes. A flattened torus rendered as a tan disc; upright it rendered
    as a doughnut, the one shape a rope toy must not have; and a thin bar with
    dark beads strung along it rendered as a caterpillar. What reads is the
    proportion -- the knots have to be much fatter than the braid, and the
    frayed ends have to splay.
    """
    rope = material("Rope", "#D8B36A", roughness=0.88)
    rope_dark = material("Rope shade", "#A8823F", roughness=0.90)
    cylinder("braid", (0, 0, 0.58), 0.16, 0.88, rope,
             rotation=(0, math.radians(90), 0))
    for i, tw in enumerate((-0.22, 0.0, 0.22)):
        sphere(f"twist_{i}", (tw, -0.12, 0.58), (0.035, 0.06, 0.17), rope_dark)
    for i, x in enumerate((-0.44, 0.44)):
        outward = 1 if x > 0 else -1
        sphere(f"knot_{i}", (x, 0, 0.58), (0.21, 0.21, 0.21), rope)
        for j, tilt in enumerate((-40, -14, 14, 40)):
            angle = math.radians(tilt)
            cone(f"fray_{i}_{j}",
                 (x + outward * 0.24 * math.cos(angle), 0,
                  0.58 + 0.24 * math.sin(angle)),
                 0.065, 0.02, 0.16, rope,
                 rotation=(0, math.radians(outward * 90) - outward * angle, 0))


def collar(name, hex_body, hex_edge):
    def build():
        body = material(f"{name} collar", hex_body, roughness=0.52, coat=0.08)
        edge = material(f"{name} collar edge", hex_edge, roughness=0.56)
        brass = material("Collar brass", "#E0A93C", roughness=0.28, metallic=0.74)
        torus("band", (0, 0, 0.58), 0.42, 0.09, body, scale=(1, 0.55, 1))
        torus("band_edge", (0, 0, 0.52), 0.42, 0.04, edge, scale=(1, 0.55, 1))
        cube("buckle", (0, -0.22, 0.58), (0.11, 0.04, 0.11), brass, 0.03)
        sphere("tag", (0, -0.24, 0.30), (0.12, 0.04, 0.12), brass)
    return build


BUILDERS = {
    "park/tree": (park_tree, 6.4, (0, 0, 2.15), {"displayWidth": 190, "anchor": "bottom"}),
    "park/bench": (park_bench, 4.7, (0, 0, 1.0), {"displayWidth": 136, "anchor": "bottom"}),
    "park/hedge": (park_hedge, 4.4, (0, 0, 0.72), {"displayWidth": 154, "anchor": "bottom"}),
    "town/store_coral": (lambda: storefront("Coral", "#E14B45", "#982D32", "#FF6349"), 6.6, (0, 0, 2.30), {"displayWidth": 176, "anchor": "bottom"}),
    "town/store_aqua": (lambda: storefront("Aqua", "#37B4CD", "#216E84", "#3ED3EB"), 6.6, (0, 0, 2.30), {"displayWidth": 190, "anchor": "bottom"}),
    # Violet measured the palest of the three storefronts (0.344 against the
    # coral's and aqua's 0.40) -- a warm key on a lilac washes it toward grey,
    # so the base carries more chroma than its neighbours need to.
    "town/store_violet": (lambda: storefront("Violet", "#8A3FD6", "#4F2189", "#B871F0"), 6.6, (0, 0, 2.30), {"displayWidth": 176, "anchor": "bottom"}),
    "town/fountain": (town_fountain, 4.4, (0, 0, 1.05), {"displayWidth": 114, "anchor": "bottom"}),
    "town/lamp": (town_lamp, 5.4, (0, 0, 2.05), {"displayWidth": 70, "anchor": "bottom"}),
    "town/planter": (town_planter, 3.8, (0, 0, 0.9), {"displayWidth": 74, "anchor": "bottom"}),
    "beach/umbrella": (beach_umbrella, 5.5, (0, 0, 1.95), {"displayWidth": 152, "anchor": "bottom"}),
    "beach/lifeguard": (beach_lifeguard, 6.4, (0, 0, 2.15), {"displayWidth": 170, "anchor": "bottom"}),
    "beach/dune": (beach_dune, 4.5, (0, 0, 0.72), {"displayWidth": 158, "anchor": "bottom"}),
    "beach/castle": (beach_castle, 4.5, (0, 0, 1.30), {"displayWidth": 112, "anchor": "bottom"}),
    "beach/palm": (beach_palm, 6.0, (0, 0, 2.20), {"displayWidth": 142, "anchor": "bottom"}),
    "home/rug": (home_rug, 4.5, (0, 0, 0.42), {"displayWidth": 188, "anchor": "bottom"}),
    # Wide and shallow, so the ortho box is sized to the long axis rather than
    # to a tall prop's height, or the tray renders as a sliver in a big canvas.
    "home/care_tray": (home_care_tray, 6.1, (0, 0, 0.30), {"displayWidth": 330, "anchor": "bottom"}),
    # The store's items. Small ortho boxes: each one fills its own frame.
    "item/treat_biscuit": (item_biscuit, 1.5, (0, 0, 0.60), {"displayWidth": 48, "anchor": "center"}),
    "item/treat_cheese": (item_cheese, 1.7, (0, 0, 0.58), {"displayWidth": 48, "anchor": "center"}),
    "item/treat_steak": (item_steak, 1.7, (0, 0, 0.54), {"displayWidth": 48, "anchor": "center"}),
    "item/toy_ball": (item_ball, 1.5, (0, 0, 0.58), {"displayWidth": 48, "anchor": "center"}),
    "item/toy_rope": (item_rope, 1.9, (0, 0, 0.58), {"displayWidth": 48, "anchor": "center"}),
    "item/collar_red": (collar("Red", "#C4432E", "#8E2C1D"), 1.6, (0, 0, 0.52), {"displayWidth": 48, "anchor": "center"}),
    "item/collar_blue": (collar("Blue", "#3E6E9C", "#28496A"), 1.6, (0, 0, 0.52), {"displayWidth": 48, "anchor": "center"}),
    "item/collar_green": (collar("Green", "#4E7A46", "#33512E"), 1.6, (0, 0, 0.52), {"displayWidth": 48, "anchor": "center"}),
    "item/collar_gold": (collar("Gold", "#D9A62B", "#9A711A"), 1.6, (0, 0, 0.52), {"displayWidth": 48, "anchor": "center"}),
}


def render_prop(path, builder, ortho_scale, target):
    clean_scene()
    setup_camera_and_lights(ortho_scale=ortho_scale, target=target)
    builder()
    file_path = OUT / f"{path}.png"
    file_path.parent.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.render.filepath = str(file_path)
    bpy.ops.render.render(write_still=True)
    print(f"rendered {file_path}")


def main():
    manifest = {
        "camera": "Barkly shared front-weighted orthographic v3",
        "light": "warm upper-left key + cool fill + warm rim",
        "contract": "modular transparent props; app owns scene composition",
        "assets": {},
    }
    # PROP_ONLY re-renders one pack while iterating on it -- a full pass is 24
    # props and several minutes, which is long enough that you stop looking.
    # It only ever narrows what is RENDERED; the manifest still describes every
    # prop, so a partial run can never publish a manifest that forgets one.
    only = os.environ.get("PROP_ONLY", "").strip()
    for path, (builder, scale, target, metadata) in BUILDERS.items():
        if not only or path.startswith(only):
            render_prop(path, builder, scale, target)
        manifest["assets"][path] = {"file": f"{path}.png", **metadata}
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    if only:
        print(f"PROP_ONLY={only}: rendered a subset; manifest still describes all")


if __name__ == "__main__":
    main()
