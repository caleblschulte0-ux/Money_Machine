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
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "art-review" / "home-props"
OUT.mkdir(parents=True, exist_ok=True)

# Must match world_prop_pack.py. A subtle side plane supplies depth; the
# objects still face the player and share one vanishing direction.
CAMERA_LOCATION = (3.0, -10.8, 4.5)


def rgb(hex_value: str):
    value = hex_value.lstrip("#")
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
    return obj


def sphere(name, loc, scale, material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return obj


def cylinder(name, loc, radius, depth, material, rotation=(0, 0, 0), vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    bevel(obj, min(radius * 0.22, 0.08), 3)
    return obj


def contact_shadow(rx, ry, z=0.055):
    # A deliberately authored soft-looking footprint. Real cast shadows from the
    # key light reinforce it, but this ensures the sprite never floats in-app.
    shadow = make_material("Contact shadow", "#2F1E16", roughness=1.0)
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
    scene.world.color = (0.055, 0.065, 0.085)

    # Keep contrast consistent across Blender 3.x/4.x.
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except Exception:
        try:
            scene.view_settings.look = "Medium High Contrast"
        except Exception:
            pass

    bpy.ops.object.camera_add(location=CAMERA_LOCATION)
    cam = bpy.context.object
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = ortho_scale
    look_at(cam, target)
    scene.camera = cam

    # One warm upper-left key, a cool low-strength fill, and a gentle warm rim.
    bpy.ops.object.light_add(type="AREA", location=(-4.8, -5.0, 8.4))
    key = bpy.context.object
    key.name = "Barkly key"
    key.data.energy = 980
    key.data.size = 5.0
    key.data.color = (1.0, 0.77, 0.58)
    look_at(key, target)

    bpy.ops.object.light_add(type="AREA", location=(5.0, -2.2, 4.0))
    fill = bpy.context.object
    fill.name = "Barkly cool fill"
    fill.data.energy = 330
    fill.data.size = 5.5
    fill.data.color = (0.58, 0.78, 1.0)
    look_at(fill, target)

    bpy.ops.object.light_add(type="AREA", location=(1.8, 4.0, 6.8))
    rim = bpy.context.object
    rim.name = "Barkly rim"
    rim.data.energy = 520
    rim.data.size = 4.2
    rim.data.color = (1.0, 0.84, 0.63)
    look_at(rim, target)


def chair():
    fabric = make_material("Muted coral upholstery", "#F45649", roughness=0.72, coat=0.02)
    fabric_light = make_material("Seat upholstery", "#FF7F72", roughness=0.78)
    seam = make_material("Upholstery seam", "#AE2D2A", roughness=0.84)
    wood = make_material("Warm chair feet", "#733919", roughness=0.56, coat=0.03)
    pillow = make_material("Butter pillow", "#FFD049", roughness=0.66)

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
    brass = make_material("Lamp brass", "#CB7D0F", roughness=0.28, metallic=0.72)
    wood = make_material("Lamp stem wood", "#69371B", roughness=0.52, coat=0.04)
    shade = make_material("Warm woven shade", "#FFC44D", roughness=0.68)
    inner = make_material("Lit shade underside", "#FFE09B", roughness=0.62, coat=0.04)

    contact_shadow(0.62, 0.38)
    cylinder("lamp_base", (0, 0, 0.22), 0.48, 0.22, brass)
    cylinder("lamp_stem", (-0.02, 0, 1.55), 0.105, 2.7, wood)
    # Chunky oversize shade, a recognizable silhouette rather than a triangle icon.
    bpy.ops.mesh.primitive_cone_add(vertices=64, radius1=0.86, radius2=0.55, depth=1.02, location=(0, 0, 3.05))
    shade_obj = bpy.context.object
    shade_obj.name = "lamp_shade"
    shade_obj.data.materials.append(shade)
    bevel(shade_obj, 0.08, 4)
    cylinder("shade_lower_rim", (0, 0, 2.56), 0.86, 0.09, inner)
    cylinder("shade_top_rim", (0, 0, 3.56), 0.55, 0.08, brass)


def bed():
    rim = make_material("Aqua plush rim", "#1DBEE6", roughness=0.86)
    rim_dark = make_material("Aqua plush cavity", "#0B85A5", roughness=0.92)
    cushion = make_material("Cream plush cushion", "#FFE8BB", roughness=0.94)
    stitch = make_material("Bed stitch", "#D78D43", roughness=0.95)

    contact_shadow(1.48, 0.76)
    # Flattened torus gives the bed real depth and a tactile donut silhouette.
    bpy.ops.mesh.primitive_torus_add(major_segments=64, minor_segments=24, location=(0, 0.08, 0.48), major_radius=0.95, minor_radius=0.39)
    outer = bpy.context.object
    outer.name = "plush_rim"
    outer.scale = (1.42, 0.86, 0.70)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    outer.data.materials.append(rim)
    bpy.ops.object.shade_smooth()

    sphere("bed_cavity", (0, 0.04, 0.37), (1.13, 0.67, 0.28), rim_dark)
    sphere("bed_cushion", (0, -0.03, 0.47), (0.96, 0.56, 0.27), cushion)
    # Three stitched channels hint at compression without noisy texture.
    for x in (-0.44, 0, 0.44):
        cylinder(f"stitch_{x}", (x, -0.54, 0.50), 0.035, 0.18, stitch, rotation=(math.radians(90), 0, 0), vertices=24)


def shelf():
    wood = make_material("Honey painted wood", "#BC631F", roughness=0.52, coat=0.04)
    wood_dark = make_material("Shelf recess", "#452216", roughness=0.70)
    cream = make_material("Cabinet inset", "#FFDBA0", roughness=0.64)
    brass = make_material("Shelf brass", "#E4981A", roughness=0.30, metallic=0.68)
    book_red = make_material("Muted red book", "#D03E37", roughness=0.70)
    book_blue = make_material("Muted blue book", "#389ABB", roughness=0.70)
    trophy = make_material("Trophy gold", "#F7AC1D", roughness=0.28, metallic=0.72)

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


def render_prop(name, builder, ortho_scale, target):
    clean_scene()
    add_camera_and_lights(ortho_scale=ortho_scale, target=target)
    builder()
    scene = bpy.context.scene
    scene.render.filepath = str(OUT / f"{name}.png")
    bpy.ops.render.render(write_still=True)
    print(f"rendered {scene.render.filepath}")


def main():
    manifest = {
        "camera": "Barkly Home 3/4 orthographic v1",
        "light": "warm upper-left key + cool fill + warm rim",
        "assets": {},
    }
    for name, (builder, scale, target, metadata) in BUILDERS.items():
        render_prop(name, builder, scale, target)
        manifest["assets"][name] = {"file": f"{name}.png", **metadata}
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
