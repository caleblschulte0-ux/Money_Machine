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


def camera_yaw():
    """The camera's own yaw, so a WIDE prop can cancel it.

    An orthographic camera looking in from (3.0, -10.8, 4.5) is turned about
    15.6 degrees off the X axis, so anything long and horizontal -- a tray, a
    horizon -- projects as a slanted bar. Build it rotated by this and it comes
    out level. Derived from CAMERA_LOCATION, never typed as a number, so moving
    the camera moves these props with it instead of leaving a stale literal.
    """
    return math.atan2(CAMERA_LOCATION[0], -CAMERA_LOCATION[1])


def facing(theta):
    """(x, y) -> (x, y) rotated into the camera-facing frame."""
    cos_t, sin_t = math.cos(theta), math.sin(theta)

    def turn(x, y):
        return (x * cos_t - y * sin_t, x * sin_t + y * cos_t)

    return turn


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


# ---------------------------------------------------------------------------
# GROUND COVER.
#
# Every OBJECT in this game is a render and every SURFACE those objects stand
# on was a colour fill. Measured off a screenshot: the town pavement varies by
# a standard deviation of 4.6 across a whole band, the town sky by 4.3, the
# home floor by 22, the park grass by 28 -- which is another way of saying they
# are painted, and it is why a hand-modelled dog reads as standing on green
# construction paper.
#
# The answer is the same one the props gave: model it. Not as a tiling texture
# -- an orthographic camera at this yaw cannot be made to tile seamlessly
# without fighting it -- but as SCATTER. Small pieces of ground cover placed at
# several depths do the work a texture would, they cost almost nothing, and
# they scale fluidly because the scene places them by fraction.
# ---------------------------------------------------------------------------


def _blades(count, seed, spread, height, mats, lean=0.30, thickness=0.030, flatten=0.34):
    """A fan of tapered blades from one root.

    A blade is a cone, not a cylinder: the taper is the whole read at this
    size. It is also FLAT -- scaled to about a third across its lean axis --
    because a cone of revolution renders as a spike, and the first pass came
    out as a bed of little green traffic bollards. They lean away from centre
    by an amount that grows with distance from it, which is what stops a tuft
    looking like a shaving brush.
    """
    for i in range(count):
        # Deterministic pseudo-scatter. Real randomness would make every
        # re-render a different picture and every diff a lie.
        t = (i * 2.39996 + seed) % 1.0
        x = (t - 0.5) * 2 * spread
        y = ((i * 0.7548 + seed * 3) % 1.0 - 0.5) * spread * 0.55
        h = height * (0.55 + 0.45 * ((i * 0.4771 + seed) % 1.0))
        tilt = lean * (x / max(spread, 1e-6)) + 0.12 * ((i % 3) - 1)
        blade = cone(
            f"blade_{seed}_{i}",
            (x + math.sin(tilt) * h * 0.25, y, h * 0.5),
            thickness * (0.85 + 0.3 * (i % 2)),
            0.0035,
            h,
            mats[i % len(mats)],
            rotation=(0, tilt, 0),
            vertices=10,
        )
        blade.scale = (1.0, flatten, 1.0)


def park_grass_tuft():
    """A small tuft, for scattering across the mid-ground."""
    mid = material("Grass mid", "#4FBE4A", roughness=0.86)
    light = material("Grass light", "#7BDF5A", roughness=0.82)
    deep = material("Grass deep", "#2E8C36", roughness=0.88)
    _blades(13, 0.13, 0.36, 0.86, (mid, light, deep, mid), lean=0.34)


def park_grass_clump():
    """A big clump for the FOREGROUND, where it crosses the bottom edge.

    Deliberately darker and coarser than the tuft: foreground cover is closer
    to the camera than the key light's falloff, and a foreground that matches
    the mid-ground in value is a foreground that does not read as one.
    """
    deep = material("Clump deep", "#2A7F33", roughness=0.88)
    mid = material("Clump mid", "#3EA342", roughness=0.86)
    dark = material("Clump dark", "#1E6128", roughness=0.90)
    _blades(23, 0.41, 0.82, 1.60, (deep, mid, dark, deep, mid), lean=0.46, thickness=0.040)


def park_wildflowers():
    """A tuft with three heads on it, so the scatter is not all one object."""
    mid = material("Flower stem", "#4FBE4A", roughness=0.86)
    deep = material("Flower stem deep", "#2E8C36", roughness=0.88)
    petal = material("Flower petal", "#FFD84D", roughness=0.74)
    petal_b = material("Flower petal pale", "#FFF0B0", roughness=0.74)
    _blades(11, 0.29, 0.32, 0.72, (mid, deep, mid), lean=0.34)
    # Small FLAT heads on thin stems. Domes on thick stems are mushrooms, which
    # is what the first pass grew.
    for i, (x, z, mat) in enumerate(((-0.18, 0.70, petal), (0.08, 0.86, petal_b), (0.24, 0.60, petal))):
        cylinder(f"stem_{i}", (x, 0.02, z * 0.5), 0.013, z, mid)
        sphere(f"head_{i}", (x, 0.02, z), (0.085, 0.080, 0.030), mat)
        sphere(f"eye_{i}", (x, -0.02, z + 0.018), (0.030, 0.028, 0.016), deep)


def park_treeline():
    """The distant edge of the park.

    Sky met grass at a hard colour change with nothing between them, which is
    the other half of why the field read flat: no horizon, no distance, just
    two fills touching. This is a low mass of canopies to sit ON that line.

    They OVERLAP heavily on purpose. A first pass spaced them so each canopy
    kept its own outline and it rendered as a row of eggs -- a distant treeline
    is one silhouette with a bumpy top, not a line of individual trees, and the
    moment you can count them they stop being far away. A darker rank behind
    the front one gives the mass some depth without giving it detail.
    """
    far = material("Treeline far", "#63A857", roughness=0.90)
    far_b = material("Treeline far b", "#74B863", roughness=0.90)
    far_c = material("Treeline far c", "#54964E", roughness=0.90)
    back = material("Treeline back", "#4A8749", roughness=0.92)

    # A horizon has to be LEVEL, and this camera is yawed, so a bar built along
    # world X renders as a slope. Built in the camera-facing frame instead --
    # the same cancellation the care tray uses.
    turn = facing(camera_yaw())

    # The rank behind: fewer, taller, darker, and set back so the light drops.
    for i in range(9):
        h = 0.62 + 0.20 * ((i * 0.6180) % 1.0)
        x, y = turn(-2.85 + i * 0.72, 0.34)
        sphere(f"back_{i}", (x, y, h * 0.72), (0.52, 0.30, h * 0.62), back)

    mats = (far, far_b, far_c, far_b, far, far_c)
    for i in range(17):
        h = 0.46 + 0.24 * ((i * 0.6180) % 1.0)
        x, y = turn(-3.05 + i * 0.38, 0.04 * ((i % 3) - 1))
        sphere(f"canopy_{i}", (x, y, h * 0.66), (0.40, 0.28, h * 0.60), mats[i % len(mats)])

    # Closes the bottom so the mass sits ON the ground rather than hovering
    # over a gap between its own lobes. Eleven overlapping lobes rather than one
    # long ellipsoid, because a single wide sphere cannot be turned -- scaling
    # it on X and rotating it are not the same operation.
    for i in range(13):
        x, y = turn(-3.10 + i * 0.52, 0.06)
        sphere(f"skirt_{i}", (x, y, 0.13), (0.34, 0.30, 0.19), far_c)


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


def town_rooftops():
    """The town behind the town.

    Measured off a screenshot, the town sky varies by a standard deviation of
    4.3 across a whole band -- it is one fill, and the shopfronts stand in front
    of nothing. This is the next street over: a run of roofs, chimneys and a
    water tower, built in the camera-facing frame so it comes out level, and
    kept to a narrow value range so it reads as distance, not as more town.
    """
    turn = facing(camera_yaw())
    # Distance desaturates toward the sky, but not to ONE hue. The first pass
    # was five shades of the same blue-grey and rendered as a mountain range --
    # pitched roofs on a monochrome run read as peaks. A little warm in the
    # walls and a little terracotta in the roofs is all it takes to make the
    # same silhouette read as buildings.
    slate = material("Roof slate", "#8C7E96", roughness=0.86)
    slate_b = material("Roof tile", "#A2818A", roughness=0.86)
    wall = material("Far wall", "#9AAAC6", roughness=0.84)
    wall_b = material("Far wall warm", "#BCAFB2", roughness=0.84)
    trim = material("Far trim", "#6E82A2", roughness=0.86)

    blocks = (
        (-3.05, 0.62, 0.86, wall, slate),
        (-2.30, 0.48, 0.62, wall_b, slate_b),
        (-1.62, 0.74, 1.02, wall, slate_b),
        (-0.92, 0.54, 0.70, wall_b, slate),
        (-0.16, 0.66, 0.92, wall, slate),
        (0.60, 0.46, 0.58, wall_b, slate_b),
        (1.30, 0.72, 0.98, wall, slate_b),
        (2.06, 0.52, 0.66, wall_b, slate),
        (2.78, 0.62, 0.84, wall, slate),
    )
    theta = camera_yaw()
    for i, (x, half, h, body, roof) in enumerate(blocks):
        bx, by = turn(x, 0.0)
        cube(f"block_{i}", (bx, by, h * 0.5), (half, 0.30, h * 0.5), body, 0.05, rotation=(0, 0, theta))
        rx, ry = turn(x, -0.02)
        cube(f"roof_{i}", (rx, ry, h + 0.055), (half * 1.06, 0.34, 0.06), roof, 0.03, rotation=(0, 0, theta))
        # Half of them get a pitched roof. A run of nothing but flat slabs is a
        # row of warehouses, and a run of nothing but gables is a toy village.
        if i % 2 == 0:
            px, py = turn(x, -0.01)
            cone(f"gable_{i}", (px, py, h + 0.22), math.hypot(half * 1.06, 0.34), 0.0, 0.52, roof,
                 rotation=(0, 0, theta + math.radians(45)), vertices=4)
        if i % 3 == 1:
            cx, cy = turn(x + half * 0.5, -0.04)
            cube(f"chimney_{i}", (cx, cy, h + 0.20), (0.07, 0.07, 0.15), trim, 0.02, rotation=(0, 0, theta))

    # One landmark, so the run is not nine of the same thing.
    tx, ty = turn(1.86, -0.06)
    cylinder("tower_leg_a", (tx - 0.10, ty, 0.52), 0.035, 1.04, trim)
    cylinder("tower_leg_b", (tx + 0.10, ty, 0.52), 0.035, 1.04, trim)
    cylinder("tower_tank", (tx, ty, 1.20), 0.20, 0.30, slate_b)
    cone("tower_cap", (tx, ty, 1.44), 0.22, 0.02, 0.18, trim)


def town_paving():
    """A course of paving slabs, for the pavement itself.

    The kerb gave the pavement an edge; this gives it a surface. Measured, the
    whole slab below that edge was one fill at a standard deviation of 4.6,
    with three drawn hairlines on it standing in for joints.

    Built as slabs on a DARK BASE that shows through the gaps, so the joints
    read as grout rather than as a raised tile pattern -- pavement is a surface
    with lines in it, not a mosaic sitting on top of one. Very low profile for
    the same reason: at this camera a 0.03 slab has just enough edge to catch
    the key light and no more. Camera-facing frame, like every other wide band
    in this pack, or it renders as a slope.
    """
    turn = facing(camera_yaw())
    theta = camera_yaw()
    grout = material("Paving grout", "#8A7448", roughness=0.90)
    slab_a = material("Paving slab", "#E4CFA2", roughness=0.82)
    slab_b = material("Paving slab b", "#D8C091", roughness=0.82)
    slab_c = material("Paving slab c", "#EDDBB1", roughness=0.80)

    # ONE course, deliberately. Two rows was the first attempt and the camera
    # ate it: looking down at 22 degrees, a 0.6-deep band projects to about a
    # fifth of its depth, so the second row landed inside the first. The app
    # places several of these down the pavement at increasing width instead,
    # which is also how the courses get to recede.
    for i in range(16):
        gx, gy = turn(-3.15 + i * 0.42, 0.0)
        cube(f"grout_{i}", (gx, gy, 0.010), (0.215, 0.26, 0.010), grout, 0.004,
             rotation=(0, 0, theta))

    tones = (slab_a, slab_b, slab_c, slab_b, slab_a, slab_c)
    # NEARLY FLUSH. At 0.034 the slabs caught a bright bevel along their top
    # edge and four courses of them read as decking -- raised sleepers laid
    # across the pavement rather than joints in it. A pavement is a surface
    # with dark lines in it, so the slabs sit just proud enough to separate
    # and the grout underneath does all the drawing.
    for i in range(11):
        sx, sy = turn(-3.0 + i * 0.62, 0.0)
        cube(f"slab_{i}", (sx, sy, 0.014), (0.268, 0.228, 0.014),
             tones[i % len(tones)], 0.004, rotation=(0, 0, theta))


def town_kerb():
    """Where the pavement stops.

    The pavement was one fill at sd 4.6 with three hairlines drawn on it
    pretending to be joints, and it met the road at a colour change. A kerb is
    the one piece of street furniture that says which surface you are on, and
    it is a long horizontal object, so it is built in the camera-facing frame
    like the treeline and the tray.
    """
    turn = facing(camera_yaw())
    theta = camera_yaw()
    stone = material("Kerb stone", "#D9C9A6", roughness=0.80)
    stone_b = material("Kerb stone b", "#CBB994", roughness=0.82)
    edge = material("Kerb edge", "#A48F6B", roughness=0.84)
    for i in range(14):
        x = -3.15 + i * 0.46
        bx, by = turn(x, 0.0)
        cube(f"slab_{i}", (bx, by, 0.11), (0.215, 0.20, 0.11), stone if i % 2 else stone_b, 0.03,
             rotation=(0, 0, theta))
    ex, ey = turn(0.0, 0.20)
    for i in range(14):
        x = -3.15 + i * 0.46
        fx, fy = turn(x, 0.19)
        cube(f"face_{i}", (fx, fy, 0.05), (0.215, 0.02, 0.055), edge, 0.01, rotation=(0, 0, theta))


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


def home_panelling():
    """Panelling for the flattest surface in the game.

    The home wall is one vertical gradient. It now has a skirting board at the
    bottom, which draws the corner; this is what goes above it. A dado is
    stiles and a rail -- the rail is the horizontal line, and the stiles are
    what stop the wall being a single unbroken field behind every piece of
    furniture in the room.

    Kept close to the wall's own colour on purpose: the point is the LIGHT
    catching a few edges, not a second pattern competing with the window, the
    shelf and the pictures. Camera-facing frame, like the skirting it sits on.
    """
    turn = facing(camera_yaw())
    theta = camera_yaw()
    # Lighter than they look here: these are VERTICAL faces under a key light
    # that comes from above, so every one of them renders a good step darker
    # than its own hex. The first pass picked colours that matched the wall on
    # paper and rendered as a grey-brown slab against it.
    field = material("Panel field", "#F2D8B2", roughness=0.74)
    stile = material("Panel stile", "#F8E3C6", roughness=0.68, coat=0.02)
    rail = material("Panel rail", "#FAE8D0", roughness=0.66, coat=0.02)
    shade = material("Panel shade", "#C4915A", roughness=0.80)

    top = 1.28
    for i in range(16):
        fx, fy = turn(-3.20 + i * 0.42, 0.03)
        cube(f"field_{i}", (fx, fy, top * 0.5), (0.212, 0.02, top * 0.5), field, 0.01,
             rotation=(0, 0, theta))

    # The stiles: the vertical divisions. Wide spacing -- a room this size
    # reads as panelled with seven of them and as a fence with eleven, which
    # is what the first pass rendered.
    for i in range(8):
        sx, sy = turn(-3.15 + i * 0.92, 0.0)
        cube(f"stile_{i}", (sx, sy, top * 0.5), (0.045, 0.028, top * 0.48), stile, 0.012,
             rotation=(0, 0, theta))
        dx, dy = turn(-3.15 + i * 0.92 + 0.02, 0.052)
        cube(f"stile_shade_{i}", (dx, dy, top * 0.5), (0.030, 0.012, top * 0.46), shade, 0.008,
             rotation=(0, 0, theta))

    # The rail along the top, which is the line the whole thing is for.
    for i in range(16):
        rx, ry = turn(-3.20 + i * 0.42, -0.012)
        cube(f"rail_{i}", (rx, ry, top + 0.022), (0.212, 0.040, 0.022), rail, 0.010,
             rotation=(0, 0, theta))
        ux, uy = turn(-3.20 + i * 0.42, 0.030)
        cube(f"rail_under_{i}", (ux, uy, top - 0.020), (0.212, 0.020, 0.020), shade, 0.008,
             rotation=(0, 0, theta))


def home_skirting():
    """The one thing every room has and this one did not.

    The home wall is a single fill and it meets the floor at a colour change,
    which is why the room reads as a backdrop with furniture in front of it
    rather than as a room. A skirting board is the cheapest possible fix and
    the most load-bearing: it draws the corner, it gives the floor an edge to
    stop at, and it puts a lit horizontal line right across the flattest band
    in the scene.

    Camera-facing frame, like the tray it shares a room with, so it renders as
    a level line instead of a slope.
    """
    turn = facing(camera_yaw())
    theta = camera_yaw()
    board = material("Skirting board", "#E7C79A", roughness=0.62, coat=0.04)
    board_lit = material("Skirting lit", "#F6DDB6", roughness=0.56, coat=0.06)
    shadow = material("Skirting shadow", "#A87642", roughness=0.74)

    for i in range(16):
        x = -3.20 + i * 0.42
        bx, by = turn(x, 0.0)
        cube(f"board_{i}", (bx, by, 0.16), (0.212, 0.05, 0.16), board, 0.02, rotation=(0, 0, theta))
        cx, cy = turn(x, -0.012)
        cube(f"cap_{i}", (cx, cy, 0.315), (0.212, 0.062, 0.028), board_lit, 0.018, rotation=(0, 0, theta))
        sx, sy = turn(x, -0.055)
        cube(f"scotia_{i}", (sx, sy, 0.028), (0.212, 0.022, 0.028), shadow, 0.012, rotation=(0, 0, theta))


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

    # The camera's own yaw, cancelled. See camera_yaw().
    theta = camera_yaw()
    turn = facing(theta)

    def place(name, loc, scale, mat, bevel_width=0.10):
        x, y, z = loc
        tx, ty = turn(x, y)
        return cube(name, (tx, ty, z), scale, mat, bevel_width, rotation=(0, 0, theta))

    def stud(name, loc, scale, mat):
        x, y, z = loc
        tx, ty = turn(x, y)
        return sphere(name, (tx, ty, z), scale, mat)

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
def _mound(hex_body, hex_lump, hex_shade, hex_hole, hex_light, ripples=False):
    """A dug-up mound: earth thrown up in a ring around an actual hole.

    The drawn version was a hard-edged half-disc with a flat crescent under it,
    a dark oval and two eyebrow strokes -- a croissant, or a closed eye, and the
    loudest hand-drawn thing left in the park now that the trees and the bench
    are renders.

    A first pass modelled it as one heap with a dark sphere for the hole, and
    the hole vanished: a sphere INSIDE a bigger sphere renders as nothing. You
    cannot fake a hole with geometry that sits on top of the thing it is meant
    to be a hole in. So the spoil is a RING -- lumps at seven different heights
    around an ellipse -- and the pit is what you see through the middle of it,
    which is a real opening rather than a dark patch painted on a lump.
    """
    body = material("Mound body", hex_body, roughness=0.94)
    lump = material("Mound lump", hex_lump, roughness=0.95)
    shade = material("Mound shade", hex_shade, roughness=0.95)
    hole = material("Mound hole", hex_hole, roughness=0.96)
    light = material("Mound light", hex_light, roughness=0.92)

    # The pit first, so the spoil ring closes over its edges.
    sphere("pit", (0, 0.00, 0.08), (0.94, 0.54, 0.10), hole)
    sphere("pit_floor", (0.05, -0.10, 0.11), (0.54, 0.30, 0.06), shade)

    # A HORSESHOE, open toward the camera.
    #
    # A closed ring did not work either. The camera looks down this world at
    # about 22 degrees, so a 0.5-high lump on the near side of a 0.12-deep pit
    # hides the pit completely: the second pass rendered a tidy heap of boulders
    # with nothing in the middle. Real spoil piles up on the far side of the
    # hole anyway -- you throw it away from yourself -- so the far arc carries
    # the height and the near arc is a low lip you see straight over.
    ring_rx, ring_ry = 1.00, 0.60
    heights = (0.30, 0.24, 0.34, 0.22, 0.32, 0.26, 0.36, 0.23, 0.29)
    sizes = (0.46, 0.38, 0.50, 0.36, 0.44, 0.40, 0.52, 0.37, 0.42)
    mats = (body, lump, light, shade, body, lump, body, shade, lump)
    for i, (zz, rr, mat) in enumerate(zip(heights, sizes, mats)):
        angle = (i / len(heights)) * math.tau
        y = -0.02 + ring_ry * math.sin(angle)
        near = y < -0.16
        sphere(
            f"spoil_{i}",
            (ring_rx * math.cos(angle) * 1.15, y, (0.10 if near else zz)),
            (rr, rr * 0.62, rr * (0.30 if near else 0.58)),
            shade if near else mat,
        )

    if ripples:
        for i, x in enumerate((-1.20, -0.60, 0.62, 1.18)):
            cylinder(f"ripple_{i}", (x, -0.62, 0.10), 0.045, 0.30, shade,
                     rotation=(0, math.radians(90), math.radians(12 * (1 if i % 2 else -1))))

    # Clods, thrown clear. They are what says somebody has been digging here.
    for i, (cx, cy, cz, cr) in enumerate((
        (-1.66, -0.34, 0.09, 0.15),
        (-1.38, 0.26, 0.07, 0.11),
        (1.62, -0.28, 0.09, 0.14),
        (1.34, 0.30, 0.06, 0.10),
        (0.24, -0.74, 0.07, 0.12),
    )):
        sphere(f"clod_{i}", (cx, cy, cz), (cr, cr * 0.8, cr * 0.7), lump if i % 2 else shade)


def park_dig_mound():
    return _mound("#AA681F", "#B97826", "#73400E", "#2E1A08", "#E1963D")


def beach_sand_mound():
    return _mound("#F8CD8C", "#FFDCA6", "#D09853", "#8B6231", "#FFECCA", ripples=True)


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
    # The seared face reads as a broad lift across the top of the cut, not a
    # separate ellipse in the middle -- that centred patch looked like a yolk.
    sphere("cut_lit", (0.02, -0.19, 0.70), (0.34, 0.05, 0.10), sear)
    # The T-bone, INSIDE the silhouette. A fourth pass: a slab of red with a
    # cream rim is meat, but it is also ham, a pork chop, or a bread roll shot
    # from above. The bone is what names it -- and every earlier attempt put it
    # outside the outline, which is exactly what turned it into a drumstick.
    tilt = math.radians(-16)
    bone_x, bone_y, bone_z, bone_half = -0.27, -0.26, 0.56, 0.17
    cylinder("bone_bar", (bone_x, bone_y, bone_z), 0.042, bone_half * 2, fat,
             rotation=(0, tilt, 0))
    for end in (1, -1):
        sphere(
            f"bone_end_{end}",
            (bone_x + end * bone_half * math.sin(tilt), bone_y,
             bone_z + end * bone_half * math.cos(tilt)),
            (0.075, 0.05, 0.07),
            fat,
        )


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


def kit_bowl():
    """His food bowl, for the care tray.

    The tray under him is a Blender render and everything standing on it was a
    flat SVG -- a bowl drawn as two stacked ellipses, directly beneath a
    rendered dog. Same object, same rig, same light.

    The dish is shallow and the food is MOUNDED above the rim. The first pass
    put a disc across the opening at the same height as the kibble, which
    swallowed all four pieces and rendered an empty orange bowl.
    """
    glaze = material("Bowl glaze", "#F5A704", roughness=0.36, coat=0.22)
    rim = material("Bowl rim", "#FFC038", roughness=0.34, coat=0.24)
    inside = material("Bowl inside", "#A9640A", roughness=0.55)
    kibble = material("Kibble", "#8A4A18", roughness=0.74)
    cone("bowl", (0, 0, 0.38), 0.30, 0.50, 0.34, glaze)
    sphere("bowl_inside", (0, 0, 0.50), (0.44, 0.44, 0.06), inside)
    torus("bowl_rim", (0, 0, 0.54), 0.48, 0.06, rim, scale=(1, 1, 0.7))
    for x, y, z, r in (
        (-0.15, -0.06, 0.57, 0.13),
        (0.13, 0.03, 0.58, 0.12),
        (-0.01, -0.15, 0.60, 0.12),
        (0.19, -0.11, 0.56, 0.10),
        (0.02, 0.04, 0.64, 0.11),
    ):
        sphere(f"kibble_{x}_{y}", (x, y, z), (r, r, r * 0.78), kibble)


def kit_stick():
    """The stick -- what he plays with before anything is bought.

    ONE tapered branch with ONE twig. The first pass built it from three
    cylinders whose ends did not actually meet, which rendered as a jack: three
    separate brown rods crossing near the middle. A branch reads as a branch
    because it TAPERS and because everything on it grows out of one line.
    """
    bark = material("Stick bark", "#7A3E15", roughness=0.86)
    lit = material("Stick lit", "#CF7A2B", roughness=0.80)
    cone("limb", (0, 0, 0.58), 0.10, 0.062, 1.06, bark,
         rotation=(0, math.radians(90), 0))
    knot_x = 0.13
    sphere("knot", (knot_x, 0, 0.585), (0.105, 0.098, 0.098), bark)
    fork = math.radians(42)
    cone("twig",
         (knot_x + 0.14 * math.sin(fork), 0, 0.585 + 0.14 * math.cos(fork)),
         0.055, 0.018, 0.28, bark,
         rotation=(0, fork, 0))
    # No painted-on highlight: a thin lit rod laid along the top of the branch
    # sits PROUD of it at the tapered end and renders as a second stick lying
    # across the first. The key light already gives it a top edge; the pale
    # material is the scar where the twig broke off instead.
    sphere("scar", (-0.30, -0.075, 0.60), (0.055, 0.03, 0.045), lit)


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
    "park/grass_tuft": (park_grass_tuft, 1.9, (0, 0, 0.32), {"displayWidth": 46, "anchor": "bottom"}),
    "park/grass_clump": (park_grass_clump, 3.6, (0, 0, 0.62), {"displayWidth": 130, "anchor": "bottom"}),
    "park/wildflowers": (park_wildflowers, 2.0, (0, 0, 0.38), {"displayWidth": 50, "anchor": "bottom"}),
    # Wide and shallow: it is a horizon, so the ortho box is sized to the run.
    "park/treeline": (park_treeline, 6.6, (0, 0, 0.42), {"displayWidth": 420, "anchor": "bottom"}),
    "park/hedge": (park_hedge, 4.4, (0, 0, 0.72), {"displayWidth": 154, "anchor": "bottom"}),
    "town/store_coral": (lambda: storefront("Coral", "#E14B45", "#982D32", "#FF6349"), 6.6, (0, 0, 2.30), {"displayWidth": 176, "anchor": "bottom"}),
    "town/store_aqua": (lambda: storefront("Aqua", "#37B4CD", "#216E84", "#3ED3EB"), 6.6, (0, 0, 2.30), {"displayWidth": 190, "anchor": "bottom"}),
    # Violet measured the palest of the three storefronts (0.344 against the
    # coral's and aqua's 0.40) -- a warm key on a lilac washes it toward grey,
    # so the base carries more chroma than its neighbours need to.
    "town/store_violet": (lambda: storefront("Violet", "#8A3FD6", "#4F2189", "#B871F0"), 6.6, (0, 0, 2.30), {"displayWidth": 176, "anchor": "bottom"}),
    # Wide horizon bands: the ortho box is sized to the run, and both are built
    # in the camera-facing frame so they render level rather than sloped.
    "town/rooftops": (town_rooftops, 6.8, (0, 0, 0.62), {"displayWidth": 440, "anchor": "bottom"}),
    "town/paving": (town_paving, 6.8, (0, 0, 0.06), {"displayWidth": 440, "anchor": "bottom"}),
    "town/kerb": (town_kerb, 6.8, (0, 0, 0.18), {"displayWidth": 440, "anchor": "bottom"}),
    "town/fountain": (town_fountain, 4.4, (0, 0, 1.05), {"displayWidth": 114, "anchor": "bottom"}),
    "town/lamp": (town_lamp, 5.4, (0, 0, 2.05), {"displayWidth": 70, "anchor": "bottom"}),
    "town/planter": (town_planter, 3.8, (0, 0, 0.9), {"displayWidth": 74, "anchor": "bottom"}),
    "beach/umbrella": (beach_umbrella, 5.5, (0, 0, 1.95), {"displayWidth": 152, "anchor": "bottom"}),
    "beach/lifeguard": (beach_lifeguard, 6.4, (0, 0, 2.15), {"displayWidth": 170, "anchor": "bottom"}),
    "beach/dune": (beach_dune, 4.5, (0, 0, 0.72), {"displayWidth": 158, "anchor": "bottom"}),
    "beach/castle": (beach_castle, 4.5, (0, 0, 1.30), {"displayWidth": 112, "anchor": "bottom"}),
    "beach/palm": (beach_palm, 6.0, (0, 0, 2.20), {"displayWidth": 142, "anchor": "bottom"}),
    "park/dig_mound": (park_dig_mound, 4.2, (0, 0, 0.36), {"displayWidth": 118, "anchor": "bottom"}),
    "beach/sand_mound": (beach_sand_mound, 4.2, (0, 0, 0.36), {"displayWidth": 118, "anchor": "bottom"}),
    "home/panelling": (home_panelling, 6.8, (0, 0, 0.46), {"displayWidth": 440, "anchor": "bottom"}),
    "home/skirting": (home_skirting, 6.8, (0, 0, 0.18), {"displayWidth": 440, "anchor": "bottom"}),
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
    "item/kit_bowl": (kit_bowl, 1.6, (0, 0, 0.48), {"displayWidth": 76, "anchor": "center"}),
    "item/kit_stick": (kit_stick, 1.9, (0, 0, 0.60), {"displayWidth": 82, "anchor": "center"}),
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
