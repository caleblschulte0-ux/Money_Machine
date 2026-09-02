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


def rgb(value: str):
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) / 255 for i in (0, 2, 4))


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

    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except Exception:
        try:
            scene.view_settings.look = "Medium High Contrast"
        except Exception:
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
    key.data.energy = 1020
    key.data.size = 5.0
    key.data.color = (1.0, 0.77, 0.58)
    look_at(key, target)

    bpy.ops.object.light_add(type="AREA", location=(5.0, -2.2, 4.0))
    fill = bpy.context.object
    fill.name = "Barkly cool fill"
    fill.data.energy = 340
    fill.data.size = 5.5
    fill.data.color = (0.58, 0.78, 1.0)
    look_at(fill, target)

    bpy.ops.object.light_add(type="AREA", location=(1.8, 4.0, 6.8))
    rim = bpy.context.object
    rim.name = "Barkly warm rim"
    rim.data.energy = 500
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
    cream = material("Store cream", "#FFF9E7", roughness=0.58, coat=0.04)
    glass = material("Store glass", "#8EDAE7", roughness=0.18, metallic=0.04, coat=0.34)
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
    stone = material("Fountain stone", "#E5BD76", roughness=0.72)
    stone_light = material("Fountain stone light", "#FFE5A9", roughness=0.68)
    stone_dark = material("Fountain stone depth", "#9D723E", roughness=0.78)
    water = material("Fountain water", "#3DC7EA", roughness=0.18, metallic=0.06, coat=0.30)
    contact_shadow(1.46, 0.72)
    torus("lower_basin", (0, 0, 0.55), 0.98, 0.24, stone, scale=(1.25, 0.82, 0.72))
    sphere("lower_water", (0, -0.02, 0.60), (1.13, 0.68, 0.10), water)
    cylinder("column", (0, 0.10, 1.38), 0.20, 1.30, stone_dark)
    torus("upper_basin", (0, 0.02, 1.82), 0.50, 0.14, stone_light, scale=(1.18, 0.82, 0.65))
    sphere("upper_water", (0, -0.02, 1.86), (0.55, 0.33, 0.08), water)
    sphere("finial", (0, 0.05, 2.20), (0.19, 0.17, 0.24), stone_light)


def town_lamp():
    iron = material("Lamp iron", "#2A3843", roughness=0.34, metallic=0.66)
    brass = material("Lamp brass", "#D07B15", roughness=0.28, metallic=0.72)
    glass = material("Lamp glow glass", "#FFDD8E", roughness=0.22, coat=0.26)
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
    cream = material("Tower cream", "#FFEBBE", roughness=0.68)
    aqua = material("Tower aqua", "#39C0D8", roughness=0.56, coat=0.06)
    glass = material("Tower window", "#8BE0E9", roughness=0.20, coat=0.30)
    contact_shadow(1.45, 0.68)
    for x in (-0.95, 0.95):
        cube(f"stilt_{x}", (x, 0.18, 1.05), (0.13, 0.16, 1.05), wood, 0.07, (0, math.radians(4 if x < 0 else -4), 0))
    cube("platform", (0, 0.05, 1.92), (1.38, 0.78, 0.16), wood, 0.12)
    cube("hut", (0, 0.18, 2.90), (1.20, 0.65, 0.86), cream, 0.20)
    cube("window", (0, -0.50, 3.04), (0.62, 0.05, 0.38), glass, 0.10)
    cube("window_frame_top", (0, -0.58, 3.45), (0.72, 0.05, 0.07), aqua, 0.05)
    cube("window_frame_bottom", (0, -0.58, 2.63), (0.72, 0.05, 0.07), aqua, 0.05)
    cube("roof", (0, 0.18, 3.93), (1.46, 0.88, 0.17), coral, 0.15, (0, math.radians(-4), 0))
    # Ladder remains a separate readable sub-form inside the tower sprite.
    for x in (-0.43, 0.43):
        cube(f"ladder_rail_{x}", (x, -0.50, 0.94), (0.07, 0.08, 0.92), wood, 0.05, (math.radians(-7), 0, 0))
    for z in (0.32, 0.70, 1.08, 1.46):
        cube(f"ladder_step_{z}", (0, -0.62, z), (0.48, 0.07, 0.06), wood, 0.04)
    cube("rescue_mark", (0.86, -0.58, 2.94), (0.18, 0.04, 0.18), coral, 0.08)


def beach_dune():
    sand = material("Dune sand", "#F0C463", roughness=0.92)
    sand_light = material("Dune light", "#FFE49B", roughness=0.90)
    grass = material("Dune grass", "#609348", roughness=0.88)
    contact_shadow(1.62, 0.52)
    sphere("dune", (0, 0.16, 0.34), (1.65, 0.66, 0.42), sand)
    sphere("dune_light", (-0.36, -0.30, 0.48), (0.92, 0.22, 0.16), sand_light)
    for i, x in enumerate((-1.20, -0.72, -0.15, 0.52, 1.06)):
        cylinder(f"grass_{i}", (x, 0, 0.92 + 0.08 * (i % 2)), 0.045, 1.10, grass, rotation=(math.radians(8), math.radians(-12 + i * 6), math.radians(-8 + i * 4)), vertices=20)


def beach_castle():
    sand = material("Castle sand", "#F4CA6D", roughness=0.92)
    sand_light = material("Castle sun face", "#FFE29F", roughness=0.90)
    sand_dark = material("Castle depth", "#C08E3F", roughness=0.94)
    flag = material("Castle flag", "#2CBAD8", roughness=0.60, coat=0.04)
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


BUILDERS = {
    "park/tree": (park_tree, 6.4, (0, 0, 2.15), {"displayWidth": 190, "anchor": "bottom"}),
    "park/bench": (park_bench, 4.7, (0, 0, 1.0), {"displayWidth": 136, "anchor": "bottom"}),
    "park/hedge": (park_hedge, 4.4, (0, 0, 0.72), {"displayWidth": 154, "anchor": "bottom"}),
    "town/store_coral": (lambda: storefront("Coral", "#E14B45", "#982D32", "#FF6349"), 6.6, (0, 0, 2.30), {"displayWidth": 176, "anchor": "bottom"}),
    "town/store_aqua": (lambda: storefront("Aqua", "#37B4CD", "#216E84", "#3ED3EB"), 6.6, (0, 0, 2.30), {"displayWidth": 190, "anchor": "bottom"}),
    "town/store_violet": (lambda: storefront("Violet", "#856EB1", "#56417C", "#A688D0"), 6.6, (0, 0, 2.30), {"displayWidth": 176, "anchor": "bottom"}),
    "town/fountain": (town_fountain, 4.4, (0, 0, 1.05), {"displayWidth": 114, "anchor": "bottom"}),
    "town/lamp": (town_lamp, 5.4, (0, 0, 2.05), {"displayWidth": 70, "anchor": "bottom"}),
    "town/planter": (town_planter, 3.8, (0, 0, 0.9), {"displayWidth": 74, "anchor": "bottom"}),
    "beach/umbrella": (beach_umbrella, 5.5, (0, 0, 1.95), {"displayWidth": 152, "anchor": "bottom"}),
    "beach/lifeguard": (beach_lifeguard, 6.4, (0, 0, 2.15), {"displayWidth": 170, "anchor": "bottom"}),
    "beach/dune": (beach_dune, 4.5, (0, 0, 0.72), {"displayWidth": 158, "anchor": "bottom"}),
    "beach/castle": (beach_castle, 4.5, (0, 0, 1.30), {"displayWidth": 112, "anchor": "bottom"}),
    "beach/palm": (beach_palm, 6.0, (0, 0, 2.20), {"displayWidth": 142, "anchor": "bottom"}),
    "home/rug": (home_rug, 4.5, (0, 0, 0.42), {"displayWidth": 188, "anchor": "bottom"}),
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
    for path, (builder, scale, target, metadata) in BUILDERS.items():
        render_prop(path, builder, scale, target)
        manifest["assets"][path] = {"file": f"{path}.png", **metadata}
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
