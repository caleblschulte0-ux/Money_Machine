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
import zlib
import os
from pathlib import Path

import bpy

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from palette import light_rgb, tone  # noqa: E402  -- the one place a colour comes from
from proportion import BITE, OVERHANG, crown, flare, shaft, stack  # noqa: E402
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
    FORMS.clear()
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in list(bpy.data.materials):
        if block.users == 0:
            bpy.data.materials.remove(block)


def look_at(obj, target=(0.0, 0.0, 1.2)):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


# WHAT EVERY SURFACE IN THE WORLD IS MADE OF.
#
# Barkly is a plush toy: felt weave on the fur, leather grain and stitching on
# the collar, worn brass on the tag. Crop him next to the world at the same
# scale and the world is bare plastic -- one flat colour, one roughness, no
# surface at all. Not one object tells you what it is made of.
#
# That is not a composition problem and no amount of props fixes it. The hero
# and the world were in different material languages, and every prop in the
# game gets its material from this one function, so this is where it is fixed.
#
# Three things, all cheap, all driven by noise in object space:
#   MOTTLE  the colour varies AROUND the authored value rather than replacing
#           it, so nothing shifts hue -- the sRGB lesson this file already
#           carries applies to every one of these numbers.
#   ROUGH   roughness varies, which is most of what reads as "material" under
#           a moving light.
#   BUMP    a fine normal perturbation. This is the one that does the work:
#           it is what makes felt look woven and plaster look plastered.
#
# `stretch` pulls the noise along one axis for grain -- wood is not isotropic.
# SURFACE, AND THE MISTAKE THIS BLOCK IS THE CORRECTION OF.
#
# The first version of this set out to give the world "material" because the
# hero looked like a plush toy beside untextured plastic. That reading was
# WRONG, and the operator said so as soon as he saw it: Barkly is not plush.
# He is CLEAN and CARTOON -- big smooth forms, soft gradients, crisp dark
# separation where shapes meet, a little sheen -- and what he carries at the
# pixel level is a whisper of grain, not a weave. Matching the world to a
# fabric that was never there put the background in a different material
# language than the character, which is the same defect as before pointing
# the other way.
#
# The number that settles it. Median absolute deviation from a 1px blur,
# interior pixels only, at native resolution:
#
#   Barkly           median 1.0    p75 3.0
#   hedge, as built  median 3.0    p75 5.0     <- three times the character
#   bench, as built  median 2.0    p75 4.0
#
# So the target is Barkly's own number and Barkly's own character of grain:
#
#   FINE      scales here are 16-34 cycles per world unit for the albedo and
#             120-220 for the bump, several times finer than the first pass.
#             At a prop's render size that is a few pixels per cycle: felt
#             reads as a weave because you can SEE the weave.
#   FAINT     mottle is 4-6%, down from 11-24%. Enough that a surface is not
#             one flat number; not enough to be a texture you notice.
#   ALBEDO    bump drops to about a tenth of what it was, because a perturbed
#             normal catching a hard key light is most of what says "fabric".
#   NO ROUGHNESS VARIATION at all. That was the fibrous cue: patches of
#             differing roughness read as nap, which is exactly wrong here.
#
# `stretch` still pulls the field along one axis for wood, because drawn wood
# grain is a legitimate cartoon cue in a way that felt nap is not. `smooth`
# opts out entirely, for glass, water, cloud and contact shadows.
#
# The mechanics below stay as they were, and two of them are load-bearing:
# object coordinates are world units here (cube/sphere call transform_apply,
# so `grain` really is cycles per unit), and a noise Fac is fBm clustered
# around 0.5, so it must be spread before it drives anything or every
# amplitude above is quietly cut to a fifth.
SURFACES = {
    "matte":   {"grain": 22.0, "tooth": 150.0, "bump": 0.10, "depth": 0.004,
                "mottle": 0.045, "rough": 0.0, "stretch": 1.0},
    "felt":    {"grain": 26.0, "tooth": 170.0, "bump": 0.12, "depth": 0.004,
                "mottle": 0.055, "rough": 0.0, "stretch": 1.0},
    "wood":    {"grain": 16.0, "tooth": 120.0, "bump": 0.12, "depth": 0.005,
                "mottle": 0.060, "rough": 0.0, "stretch": 9.0},
    "foliage": {"grain": 28.0, "tooth": 180.0, "bump": 0.11, "depth": 0.004,
                "mottle": 0.050, "rough": 0.0, "stretch": 1.0},
    "sand":    {"grain": 34.0, "tooth": 220.0, "bump": 0.10, "depth": 0.003,
                "mottle": 0.040, "rough": 0.0, "stretch": 1.0},
    "stone":   {"grain": 18.0, "tooth": 130.0, "bump": 0.12, "depth": 0.005,
                "mottle": 0.055, "rough": 0.0, "stretch": 1.0},
    "smooth":  None,
}


# WHICH surface a material gets, inferred from the name it already has.
#
# There are 146 material() calls in this file and every one of them is named
# for what it is -- "Bench honey wood", "Hedge green", "Paving slab", "Store
# glass". That naming is not decoration, it is a usable declaration of
# substance, so the surface is read off it rather than added as a 147th edit
# that would go stale the moment someone adds a prop. A new material called
# "Fence post oak" gets wood grain for free; one called "Kite nylon" gets
# cloth. An explicit surface= always wins over the guess.
#
# Order matters: the first match wins, so the specific words come first.
SURFACE_WORDS = (
    # Nothing modulated. A contact shadow is not an object with a surface --
    # it is a shadow, and putting tooth on it makes the ground look mouldy.
    ("smooth", ("shadow", "glass", "water", "glow", "sky", "light beam",
                "cloud", "glaze", "foam", "surf", "wave")),
    ("wood",  ("wood", "bark", "plank", "timber", "board", "trunk", "log",
               "oak", "pine", "slat", "decking", "driftwood", "pole")),
    ("foliage", ("leaf", "leaves", "foliage", "hedge", "bush", "shrub",
                 "canopy", "grass", "tuft", "clump", "marram", "moss",
                 "fern", "palm", "treeline", "reed", "blade", "stem")),
    ("sand",  ("sand", "dune", "beach", "gravel", "grit", "shingle",
               "castle", "earth", "soil", "dirt", "mound", "path")),
    ("stone", ("stone", "paving", "slab", "kerb", "curb", "grout", "brick",
               "concrete", "plaster", "rock", "pebble", "tile", "slate",
               "wall", "terracotta", "clay", "cobble", "asphalt")),
    ("felt",  ("felt", "cloth", "fabric", "towel", "cushion", "canvas",
               "awning", "umbrella", "flag", "rug", "blanket", "wool",
               "nylon", "bed", "rope")),
)


def _infer_surface(name):
    lowered = name.lower()
    for surface, words in SURFACE_WORDS:
        if any(word in lowered for word in words):
            return surface
    return "matte"


def _shift(linear_rgb, amount):
    """Scale a linear colour lighter or darker. A MULTIPLIER, so hue is exact."""
    return tuple(min(1.0, max(0.0, c * (1.0 + amount))) for c in linear_rgb)


def material(name, color, roughness=0.55, metallic=0.0, coat=0.04, surface=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    base = rgb(color)
    bsdf.inputs["Base Color"].default_value = (*base, 1.0)
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

    spec = SURFACES.get(surface if surface is not None else _infer_surface(name))
    if spec is None:
        return mat

    coord = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (1.0, 1.0 / spec["stretch"], 1.0)
    nt.links.new(coord.outputs["Object"], mapping.inputs["Vector"])

    # ONE field for colour and roughness. Detail 8 with a high noise-roughness
    # keeps the fine octaves alive, so this single node covers several of the
    # measured bands instead of sitting in one of them.
    grain = nt.nodes.new("ShaderNodeTexNoise")
    grain.inputs["Scale"].default_value = spec["grain"]
    grain.inputs["Detail"].default_value = 8.0
    if "Roughness" in grain.inputs:
        grain.inputs["Roughness"].default_value = 0.62
    nt.links.new(mapping.outputs["Vector"], grain.inputs["Vector"])

    # SPREAD, and this is the node the whole pass turns on.
    #
    # A noise node's Fac is fBm: it is not uniform over 0..1, it clusters hard
    # around 0.5 with a standard deviation near 0.1. Driving a mix with it raw
    # therefore only ever travels about a fifth of the range you asked for, so
    # every strength below was being quietly cut to a fifth before it reached
    # the render. That is why the first attempt at this moved a bench by five
    # values out of 255 and looked, correctly, like nothing had happened.
    #
    # Expanding the middle of the distribution back out to the full range is
    # what makes an authored amplitude mean what it says.
    spread = nt.nodes.new("ShaderNodeMapRange")
    spread.inputs["From Min"].default_value = 0.36
    spread.inputs["From Max"].default_value = 0.64
    spread.clamp = True
    nt.links.new(grain.outputs["Fac"], spread.inputs["Value"])

    # Mix between a darker and a lighter version of the SAME colour, so the
    # mean is what was authored and the hue is bit-for-bit unchanged.
    mix = nt.nodes.new("ShaderNodeMixRGB")
    mix.inputs["Color1"].default_value = (*_shift(base, -spec["mottle"]), 1.0)
    mix.inputs["Color2"].default_value = (*_shift(base, spec["mottle"]), 1.0)
    nt.links.new(spread.outputs["Result"], mix.inputs["Fac"])
    nt.links.new(mix.outputs["Color"], bsdf.inputs["Base Color"])

    # Roughness variation is OFF for every surface, and that is deliberate --
    # see the note above. It stays wired for the case where a future surface
    # genuinely wants it (wet stone, worn metal), but at 0.0 it is skipped
    # rather than connected as a constant.
    if spec["rough"] > 0:
        rough = nt.nodes.new("ShaderNodeMapRange")
        rough.inputs["To Min"].default_value = max(0.05, roughness - spec["rough"])
        rough.inputs["To Max"].default_value = min(1.0, roughness + spec["rough"])
        nt.links.new(spread.outputs["Result"], rough.inputs["Value"])
        nt.links.new(rough.outputs["Result"], bsdf.inputs["Roughness"])

    # The tooth, on its own much finer field, as a normal perturbation. Bump
    # beats colour for this: it modulates the key light rather than the albedo,
    # so it survives being lit and does not wash out in shadow.
    fine = nt.nodes.new("ShaderNodeTexNoise")
    fine.inputs["Scale"].default_value = spec["tooth"]
    fine.inputs["Detail"].default_value = 3.0
    nt.links.new(mapping.outputs["Vector"], fine.inputs["Vector"])
    tooth = nt.nodes.new("ShaderNodeMapRange")
    tooth.inputs["From Min"].default_value = 0.34
    tooth.inputs["From Max"].default_value = 0.66
    tooth.clamp = True
    nt.links.new(fine.outputs["Fac"], tooth.inputs["Value"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = spec["bump"]
    bump.inputs["Distance"].default_value = spec["depth"]
    nt.links.new(tooth.outputs["Result"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


# ---------------------------------------------------------------------------
# THE FORM LOG.
#
# Every primitive a builder makes records its world bounding box here, so the
# proportions a prop was authored with can be CHECKED instead of eyeballed --
# see `tools/blender/proportion.py` for what the rules are and
# `scripts/proportion.py` for the gate that enforces them.
#
# Measured from the geometry, not from the shipped PNG, for two reasons. The
# contact shadow is real opaque geometry sitting on the ground and it is wider
# than most of the props that cast it, so an alpha silhouette says every prop
# in the game is bottom-heavy. And the promoted PNG is trimmed, quantised and
# now carries a contour, none of which are the author's decisions. The bbox is.
# ---------------------------------------------------------------------------
FORMS: list[dict] = []


def _record(obj):
    """Log `obj`'s world-space bounding box. Returns the object unchanged."""
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    lo = [min(c[i] for c in corners) for i in range(3)]
    hi = [max(c[i] for c in corners) for i in range(3)]
    FORMS.append({
        "name": obj.name,
        "lo": [round(v, 4) for v in lo],
        "hi": [round(v, 4) for v in hi],
    })
    return obj


def measure_form(slices=32):
    """The proportion numbers for whatever is currently built.

    A SILHOUETTE PROFILE, not a list of part sizes. The first version took the
    narrowest individual part crossing the middle of the prop and called that
    the waist, which made a storefront's waist 0.15 -- the doorknob. What the
    eye reads as the waist is how wide the whole thing is at that height, so
    every measurement here is the union x-extent of a horizontal slice.

    x only, deliberately: the camera is front-weighted, so depth in y barely
    changes the shape on screen and including it makes a deep, narrow prop
    look chunky in the numbers and thin in the game.

    The contact shadow is excluded by name. It is a lighting cue lying on the
    floor, wider than most of the props that cast it, and counting it says
    every object in the game is bottom-heavy.
    """
    parts = [f for f in FORMS if "contact_shadow" not in f["name"]]
    if not parts:
        return None
    top = max(f["hi"][2] for f in parts)
    base = min(f["lo"][2] for f in parts)
    height = top - base
    if height <= 0:
        return None

    profile = []
    for i in range(slices):
        z0 = base + height * i / slices
        z1 = base + height * (i + 1) / slices
        here = [f for f in parts if f["lo"][2] < z1 and f["hi"][2] > z0]
        span = 0.0
        if here:
            span = max(f["hi"][0] for f in here) - min(f["lo"][0] for f in here)
        profile.append(round(span, 3))

    def widest(lo_share, hi_share):
        lo = int(slices * lo_share)
        hi = max(lo + 1, int(slices * hi_share))
        return max(profile[lo:hi])

    def narrowest(lo_share, hi_share):
        lo = int(slices * lo_share)
        hi = max(lo + 1, int(slices * hi_share))
        return min(profile[lo:hi])

    return {
        "height": round(height, 3),
        "parts": len(parts),
        "widest": round(max(profile), 3),
        "foot": round(widest(0.0, 0.15), 3),
        "waist": round(narrowest(0.25, 0.65), 3),
        "crown": round(widest(0.55, 1.0), 3),
    }


def _wobble(name, amount=1.0):
    """A small, DETERMINISTIC tilt, seeded by the object's own name.

    Nothing in the reference art is perfectly upright. Everything in ours was:
    every cube, cylinder and cone in the game was axis-aligned unless a builder
    passed an explicit rotation, so a park of trees stood like a bar chart and
    six gazebo posts were six identical verticals. A degree and a half of lean
    is invisible as a decision and unmistakable as an absence.

    Seeded by name rather than random because the renders are COMPARED -- CI
    re-renders the pack and `promote-props.py` diffs the result. A random tilt
    would make every build a fresh set of assets and every diff meaningless.
    """
    h = zlib.crc32(name.encode("utf-8"))
    ax = ((h & 0xFFFF) / 65535.0 - 0.5) * 2.0
    ay = (((h >> 16) & 0xFFFF) / 65535.0 - 0.5) * 2.0
    lean = math.radians(1.6) * amount
    return ax * lean, ay * lean


def _leaned(name, rotation, amount=1.0):
    """`rotation` with the wobble added. Pass amount=0 to stay square."""
    if amount == 0:
        return rotation
    dx, dy = _wobble(name, amount)
    return (rotation[0] + dx, rotation[1] + dy, rotation[2])


def bevel(obj, width=0.10, segments=4):
    modifier = obj.modifiers.new("Barkly molded edge", "BEVEL")
    modifier.width = width
    modifier.segments = segments
    return obj


def _edge_for(size, share=0.17, cap=0.26):
    """How fat the moulded edge is, FROM THE FORM'S OWN SIZE.

    Every cube in the game took a 0.10 bevel whatever its size, so a 6-unit
    storefront and a 0.3-unit doorknob had the same edge weight -- which reads
    as a set of parts cut on the same machine rather than as objects. In the
    reference art the edge weight is proportional: big forms carry a heavy
    round, small details stay crisp, and that variation is most of what makes
    a silhouette look sculpted instead of extruded.
    """
    smallest = max(1e-4, min(abs(v) for v in size))
    return max(0.012, min(cap, smallest * share))


def cube(name, loc, scale, mat, bevel_width=None, rotation=(0, 0, 0), lean=1.0):
    obj_rotation = _leaned(name, rotation, lean)
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=obj_rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel(obj, _edge_for(scale) if bevel_width is None else bevel_width)
    obj.data.materials.append(mat)
    return _record(obj)


def sphere(name, loc, scale, mat, swell=1.0):
    """A sphere, DENTED. A perfect ellipsoid is the giveaway of a primitive.

    The swell is deterministic per name and small -- up to 7% on each axis --
    which is enough that a row of hedge lumps or beach pebbles stops reading as
    the same ball copied along a line.
    """
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, location=loc)
    obj = bpy.context.object
    obj.name = name
    if swell:
        h = zlib.crc32(name.encode("utf-8"))
        f = [1.0 + (((h >> (i * 7)) & 0xFF) / 255.0 - 0.5) * 0.14 * swell for i in range(3)]
        scale = (scale[0] * f[0], scale[1] * f[1], scale[2] * f[2])
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return _record(obj)


def cylinder(name, loc, radius, depth, mat, rotation=(0, 0, 0), vertices=48,
             taper=0.88, lean=1.0):
    """A post that FLARES. There are no parallel-sided objects in the reference.

    Every cylinder in this game was a constant radius top to bottom -- gazebo
    posts, tree trunks, lamp columns, fence rails, the fountain stem -- which
    is the single most primitive-looking thing a 3D toy can do. A cylinder is
    now a shallow cone: 12% narrower at the top, so it reads as moulded and
    catches the key light differently along its length. `taper=1.0` opts out
    for the few things that really are pipes.
    """
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius,
        radius2=radius * taper,
        depth=depth,
        location=loc,
        rotation=_leaned(name, rotation, lean),
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    bevel(obj, min(radius * 0.24, 0.09), 3)
    return _record(obj)


def cone(name, loc, radius1, radius2, depth, mat, rotation=(0, 0, 0), vertices=64,
         lean=1.0):
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius1,
        radius2=radius2,
        depth=depth,
        location=loc,
        rotation=_leaned(name, rotation, lean),
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    bevel(obj, _edge_for((radius1, radius2 if radius2 > 0.02 else radius1, depth), 0.20, 0.10), 3)
    return _record(obj)


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
    return _record(obj)


def metablob(name, parts, mat, resolution=0.026, stiffness=2.0, threshold=0.25):
    """Fuse a set of ellipsoids into ONE surface.

    A cloud built as overlapping spheres renders as a bunch of grapes: each
    lobe keeps its own terminator, so the interior fills with crescent seams
    and the eye counts eight balls instead of reading one mass. A cloud is
    lumpy on its SILHOUETTE and smooth inside it, which is precisely what a
    metaball field gives -- the lobes blend where they overlap and only the
    outer boundary keeps the bumps.

    `parts` is a sequence of ((x, y, z), (sx, sy, sz)); every element lives on
    one metaball datablock, so there is no dependence on Blender's name-prefix
    family rules. Converted to a mesh immediately, so downstream code can treat
    the result like any other object in this pack.
    """
    bpy.ops.object.metaball_add(type="BALL", location=(0.0, 0.0, 0.0))
    obj = bpy.context.object
    obj.name = name
    obj.data.resolution = resolution
    obj.data.render_resolution = resolution
    # The field threshold is what decides whether neighbouring lobes MERGE.
    # At Blender's default 0.6 they do not: the first pass rendered as seven
    # separate eggs floating in a row, which is a worse cloud than the pills
    # it was replacing. Low threshold, wide influence radius, and the lobes
    # become one mass whose only lumps are on the outside.
    obj.data.threshold = threshold
    elements = obj.data.elements
    elements.remove(elements[0])
    for (x, y, z), (sx, sy, sz) in parts:
        element = elements.new(type="ELLIPSOID")
        element.co = (x, y, z)
        element.size_x, element.size_y, element.size_z = sx, sy, sz
        element.radius = 1.7
        element.stiffness = stiffness
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return _record(obj)


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
    shadow = material("Contact shadow", tone("ink", "shade"), roughness=1.0, coat=0.0)
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

    # AMBIENT OCCLUSION, which this pack did not have at all.
    #
    # THE ACTUAL GAP between the hero and the world, and it is not texture.
    # Look at Barkly closely: big smooth forms, soft gradients, and a CRISP
    # DARK SEAM everywhere two shapes meet -- muzzle against cheek, brow over
    # eye, ear against head. That separation is what makes a clean cartoon
    # read as solid instead of as flat shapes overlapping, and it is the thing
    # the props were missing. Every light in the rig below is a big soft area
    # light, so nothing in a prop was ever darkened by its own neighbours: the
    # five spheres of a hedge met with no seam between them, and the slats of
    # a bench with no shadow in the gaps.
    #
    # The scene pack has had this on since it was written. The pack that
    # renders every single prop in the game did not, and that difference sat
    # unnoticed while a whole pass went into surface noise instead.
    #
    # `gtao_distance` is in world units and the props are 1-4 units across, so
    # 0.8 reaches across a gap between neighbouring parts without dimming a
    # whole face.
    for attribute, value in (
        ("use_gtao", True),
        ("gtao_distance", 0.8),
        ("gtao_factor", 1.0),
    ):
        if hasattr(scene.eevee, attribute):
            setattr(scene.eevee, attribute, value)

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
    key.data.energy = 1040
    key.data.size = 5.0
    key.data.color = light_rgb("key")
    look_at(key, target)

    bpy.ops.object.light_add(type="AREA", location=(5.0, -2.2, 4.0))
    fill = bpy.context.object
    fill.name = "Barkly cool fill"
    # ONE THIRD OF THE KEY IS NOT A FILL, IT IS A SECOND KEY. At 300 against
    # 880 -- with a 408 rim on top -- the non-key light outweighed the key and
    # nothing in the world could go dark: measured, 0.1% of a park frame fell
    # below value 0.25 where the reference art puts 18.8% there. A fill exists
    # to keep shadow READABLE, not to erase it.
    fill.data.energy = 110
    fill.data.size = 5.5
    fill.data.color = light_rgb("fill")
    look_at(fill, target)

    bpy.ops.object.light_add(type="AREA", location=(1.8, 4.0, 6.8))
    rim = bpy.context.object
    rim.name = "Barkly warm rim"
    rim.data.energy = 330
    rim.data.size = 4.2
    rim.data.color = light_rgb("key")
    look_at(rim, target)


def park_tree():
    bark = material("Tree bark", tone("bark", "base"), roughness=0.72)
    bark_light = material("Tree bark light", tone("bark", "lit"), roughness=0.66)
    leaf = material("Leaf green", tone("foliage", "base"), roughness=0.76, coat=0.02)
    leaf_light = material("Leaf light", tone("foliage", "lit"), roughness=0.72, coat=0.03)
    # `shade`, not `deep`: this alternates with `leaf` over HALF the canopy,
    # and half a tree at crevice value renders as holes in the crown.
    leaf_dark = material("Leaf depth", tone("foliage", "shade"), roughness=0.80)

    # PROPORTION, not detail. See tools/blender/proportion.py: the old tree was
    # a gentle 0.54->0.28 cone under five same-sized balls alternating light and
    # dark, which is a botanically reasonable tree and reads, at 190pt on a
    # phone, as a lollipop with a rash. Reference trees are one enormous canopy
    # dropped over a trunk that is nearly twice as fat at the roots as it is at
    # the shoulder, and their dark tone is on the UNDERSIDE, never every other
    # lobe.
    contact_shadow(1.78, 0.84)
    # Roots. A trunk that meets the ground at its own diameter looks pushed in.
    for i, (x, y) in enumerate(((-0.66, 0.28), (0.62, 0.32), (-0.06, -0.36))):
        sphere(f"root_{i}", (x, y, 0.15), (0.46, 0.36, 0.21), bark)
    cone("trunk", (0, 0.12, 1.28), 0.95, shaft(0.95, 0.32), 2.56, bark)
    cylinder("trunk_glint", (-0.30, -0.52, 1.26), 0.12, 1.96, bark_light,
             rotation=(math.radians(-4), 0, math.radians(-5)), taper=0.44)
    # ONE canopy mass, sunk over the trunk's shoulder rather than balanced on
    # it, then bitten into by four bumps that only break the silhouette.
    crown_z = stack(2.56, 1.16)
    sphere("crown_mass", (0.02, 0.16, crown_z), (crown(0.95), 1.34, 1.16), leaf)
    for name, (x, y, z, sx, sy, sz), mat in (
        ("crown_sun", (-0.42, -0.30, crown_z + 0.86, 1.06, 0.86, 0.70), leaf_light),
        ("crown_right", (1.52, 0.18, crown_z + 0.14, 0.86, 0.72, 0.74), leaf),
        ("crown_left", (-1.58, 0.22, crown_z - 0.28, 0.80, 0.68, 0.68), leaf_dark),
        ("crown_under", (0.56, 0.42, crown_z - 0.62, 1.02, 0.72, 0.56), leaf_dark),
    ):
        sphere(name, (x, y, z), (sx, sy, sz), mat)


def park_bench():
    wood = material("Bench honey wood", tone("wood", "base"), roughness=0.58, coat=0.05)
    wood_light = material("Bench sun-face wood", tone("wood", "lit"), roughness=0.52, coat=0.06)
    metal = material("Bench iron", tone("metal", "shade"), roughness=0.36, metallic=0.64)

    # Six thin slats and four straight legs is what a bench IS. What a bench
    # READS as at 136pt is a thick plank on stubby splayed legs with a back
    # leaning well past vertical -- fewer parts, each one much fatter, and the
    # seat overhanging the legs so it sits on them instead of in line with them.
    contact_shadow(1.78, 0.58)
    for z in (1.26, 1.70):
        cube(f"back_slats_{z}", (0, 0.34, z), (1.46, 0.19, 0.21), wood, 0.17, (math.radians(-11), 0, 0))
    cube("seat", (0, -0.02, 0.86), (1.58, 0.56, 0.17), wood_light, 0.15)
    cube("seat_lip", (0, -0.56, 0.78), (1.58, 0.10, 0.13), wood, 0.09)
    for x in (-1.22, 1.22):
        cube(f"leg_{x}", (x, 0.16, 0.36), (0.21, 0.27, 0.41), metal, 0.13, (0, math.radians(9 if x < 0 else -9), 0))
        cube(f"arm_{x}", (x * 0.96, -0.10, 1.14), (0.17, 0.62, 0.14), metal, 0.11, (0, math.radians(-6), 0))
        sphere(f"arm_cap_{x}", (x * 0.96, -0.68, 1.16), (0.19, 0.18, 0.17), wood)


def park_hedge():
    leaf = material("Hedge green", tone("foliage", "base"), roughness=0.82)
    leaf_light = material("Hedge light", tone("foliage", "lit"), roughness=0.78)
    earth = material("Hedge earth", tone("bark", "shade"), roughness=0.94)
    # Five equal lumps in a row read as five bushes. One mass with three
    # unequal bumps bitten into its top reads as a hedge.
    contact_shadow(1.72, 0.52)
    sphere("earth", (0, 0.20, 0.22), (1.62, 0.56, 0.18), earth)
    sphere("hedge_mass", (0, 0, 0.74), (1.52, 0.56, 0.60), leaf)
    for i, (x, z, s) in enumerate(((-0.94, 1.00, 0.62), (0.08, 1.16, 0.74), (0.98, 0.96, 0.56))):
        sphere(f"hedge_{i}", (x, -0.04, z), (s, s * 0.80, s * 0.84), leaf_light if i == 1 else leaf)


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
    mid = material("Grass mid", tone("grass", "base"), roughness=0.86)
    light = material("Grass light", tone("grass", "lit"), roughness=0.82)
    deep = material("Grass deep", tone("grass", "deep"), roughness=0.88)
    _blades(13, 0.13, 0.36, 0.86, (mid, light, deep, mid), lean=0.34)


def park_grass_clump():
    """A big clump for the FOREGROUND, where it crosses the bottom edge.

    Deliberately darker and coarser than the tuft: foreground cover is closer
    to the camera than the key light's falloff, and a foreground that matches
    the mid-ground in value is a foreground that does not read as one.
    """
    deep = material("Clump deep", tone("foliage", "deep"), roughness=0.88)
    mid = material("Clump mid", tone("foliage", "base"), roughness=0.86)
    dark = material("Clump dark", tone("foliage", "shade"), roughness=0.90)
    _blades(23, 0.41, 0.82, 1.60, (deep, mid, dark, deep, mid), lean=0.46, thickness=0.040)


# ---------------------------------------------------------------------------
# THE NEAR GROUND.
#
# The largest single area in every scene is the ground between the dog's feet
# and the bottom of the frame, and in all four locations it was a flat colour
# wash: smooth sand, smooth pavement, smooth floorboard, smooth grass. Props
# were added in front of it and it stayed a wash behind them, which is what
# reads as unfinished -- an empty foreground is more obviously empty than an
# empty background, because it is the part closest to the viewer.
#
# These are ground COVER, not props: wide strips meant to run off both side
# edges and off the bottom, sitting under everything else in the near plane.
# Each is rendered at a wide ortho scale so it comes out as a band rather than
# an object, and each is deliberately coarser and darker than its midground
# equivalent -- foreground that matches the midground in value is foreground
# that does not read as one.
# ---------------------------------------------------------------------------


def park_near_grass():
    """A dense band of grass seen from a step away."""
    deep = material("Near grass deep", tone("grass", "deep"), roughness=0.90)
    mid = material("Near grass mid", tone("grass", "base"), roughness=0.88)
    dark = material("Near grass dark", tone("grass", "shade"), roughness=0.92)
    lit = material("Near grass lit", tone("grass", "lit"), roughness=0.86)
    # Several roots across the width rather than one fan, or it reads as a
    # single bush lying on its side -- and offset in the CAMERA's frame, not
    # the world's. Stepping them along world x put each clump slightly further
    # from the lens than the last, so the band came out sloping downhill to
    # the right: a hillside, in a scene with no hill.
    turn = facing(camera_yaw())
    for i, ox in enumerate((-4.4, -3.1, -1.9, -0.7, 0.6, 1.8, 3.0, 4.3)):
        dx, dy = turn(ox, 0.0)
        before = set(bpy.data.objects)
        _blades(
            14, 0.17 + i * 0.31, 0.86, 1.15 + 0.30 * ((i * 0.61) % 1.0),
            (deep, mid, dark, lit, mid), lean=0.52, thickness=0.052,
        )
        for obj in set(bpy.data.objects) - before:
            obj.location.x += dx
            obj.location.y += dy


def beach_near_sand():
    """Wet sand at your feet: ripples, a wrack line, shells and marram.

    CAMERA-FACING, like every other wide band in this pack. The first version
    laid its ripples along the world axes and the 15-degree camera yaw turned
    the whole strip into a diagonal ribbon with spikes on it. `turn` puts the
    band in the camera's own frame so `x` really is "across the picture".

    AND IT HAS TO CARRY SILHOUETTE, not just tone. Four ripples and four
    shells across a whole phone width is not a near plane, it is a slightly
    bumpy floor -- the beach's bottom half read as an empty sand-coloured
    rectangle in every capture. The park's near band works because things
    STAND UP in it and get cropped by the bottom edge. So this one grew a
    wrack line (the dark seaweed the tide leaves, which is also the only dark
    value anywhere near the bottom of that scene), pebbles with real relief,
    and marram blades at both edges where the dry sand starts.
    """
    turn = facing(camera_yaw())
    theta = camera_yaw()
    sand = material("Near sand", tone("sand", "base"), roughness=0.95)
    shade = material("Near sand shade", tone("sand", "shade"), roughness=0.96)
    shell = material("Near shell", tone("cream", "base"), roughness=0.80)
    shell_warm = material("Near shell warm", tone("cream", "lit"), roughness=0.78)
    wrack = material("Near wrack", tone("foliage", "deep"), roughness=0.94)
    wrack_lit = material("Near wrack lit", tone("foliage", "shade"), roughness=0.92)
    pebble = material("Near pebble", tone("stone", "base"), roughness=0.88)
    pebble_lit = material("Near pebble lit", tone("stone", "lit"), roughness=0.86)

    # Low, WIDE mounds rather than long thin lenses. A sphere squashed to a
    # tenth of its length is a blade, which is what the first pass rendered:
    # four green-looking spikes lying across the sand.
    for i, (ox, oy, rx, ry, rz, mat) in enumerate((
        (-3.60, -0.40, 1.30, 0.30, 0.050, shade),
        (-2.30, -0.34, 1.45, 0.32, 0.055, shade),
        (0.90, -0.06, 1.60, 0.34, 0.060, sand),
        (-1.10, 0.30, 1.40, 0.30, 0.050, sand),
        (2.40, 0.60, 1.25, 0.28, 0.048, shade),
        (3.90, 0.16, 1.30, 0.30, 0.050, sand),
    )):
        cx, cy = turn(ox, oy)
        obj = sphere(f"ripple_{i}", (cx, cy, rz * 0.5), (rx, ry, rz), mat)
        obj.rotation_euler = (0, 0, theta)

    # The wrack line. Small, dark, irregular, and the only deep value in the
    # bottom third of the beach -- which is what stops the sand reading as one
    # flat sheet of the same colour.
    for i, (ox, oy, r) in enumerate((
        (-4.6, 0.02, 0.20), (-3.9, -0.10, 0.15), (-3.3, 0.08, 0.22),
        (-2.1, -0.04, 0.17), (-1.4, 0.10, 0.13), (-0.5, -0.08, 0.21),
        (0.4, 0.06, 0.16), (1.3, -0.02, 0.19), (2.2, 0.09, 0.14),
        (3.1, -0.06, 0.20), (4.0, 0.04, 0.16), (4.8, -0.09, 0.18),
    )):
        cx, cy = turn(ox, oy)
        sphere(f"wrack_{i}", (cx, cy, 0.05), (r, r * 0.42, 0.045),
               wrack if i % 3 else wrack_lit)

    for i, (ox, oy, r) in enumerate((
        (-4.1, 0.34, 0.20), (-2.6, 0.42, 0.15), (-0.2, 0.36, 0.23),
        (1.9, 0.44, 0.17), (3.4, 0.32, 0.19),
    )):
        cx, cy = turn(ox, oy)
        sphere(f"nearpeb_{i}", (cx, cy, r * 0.34), (r, r * 0.74, r * 0.52),
               pebble_lit if i % 2 else pebble)

    for i, (ox, oy) in enumerate(((-3.4, 0.22), (-1.0, -0.28), (1.6, 0.40), (3.7, -0.10),
                                  (-4.9, -0.20), (0.6, 0.52))):
        cx, cy = turn(ox, oy)
        sphere(f"nearshell_{i}", (cx, cy, 0.11), (0.26, 0.20, 0.085),
               shell_warm if i % 2 else shell)

    # NO TALL THINGS IN A WIDE THIN BAND. The first version of this put marram
    # blades at both ends for silhouette; the blades doubled the strip's bbox
    # height, and because the app sizes this prop from its ASPECT the whole
    # near plane drew 1.75x deeper and hung below the care tray. Height in the
    # near plane belongs in a prop of its own (beach/dune_grass); what this
    # band carries is GRAIN -- ripples, wrack, pebbles, shells.


def town_near_paving():
    """Slabs at arm's length, with a kerb lip, weeds in the joints and grit.

    THE SLABS ALONE WERE NOT A NEAR PLANE. One course of seven flat cubes lying
    on the ground gives the eye a change of tone and nothing to measure depth
    against, and the town's bottom half read as a pale empty rectangle in every
    capture -- the single worst area in any of the four places. The park's near
    band works because things STAND UP in it and are cropped by the bottom of
    the frame.

    So: two courses instead of one (a street has a joint running along it, not
    just across it), a raised kerb lip at the very front, weeds pushing through
    the joints, and grit. The weeds are the important part -- they are the only
    green in the scene below the planter, and a pavement with something growing
    out of it is a place rather than a texture.
    """
    turn = facing(camera_yaw())
    theta = camera_yaw()
    grout = material("Near paving grout", tone("stone", "shade"), roughness=0.94)
    slab_a = material("Near paving slab", tone("paving", "lit"), roughness=0.86)
    slab_b = material("Near paving slab b", tone("paving", "base"), roughness=0.86)
    slab_c = material("Near paving slab c", tone("paving", "pop"), roughness=0.84)
    kerb = material("Near kerb lip", tone("stone", "base"), roughness=0.88)
    kerb_top = material("Near kerb top", tone("stone", "lit"), roughness=0.86)
    grit = material("Near grit", tone("stone", "deep"), roughness=0.92)
    weed = material("Near weed", tone("grass", "shade"), roughness=0.90)
    weed_lit = material("Near weed lit", tone("grass", "base"), roughness=0.88)

    bx, by = turn(0.0, 0.10)
    cube("near_base", (bx, by, 0.02), (6.4, 1.30, 0.02), grout, 0.02, (0, 0, theta), lean=0)

    # Two courses, offset like real paving, so the joints make a grid and not
    # a row of stripes.
    tones = (slab_a, slab_b, slab_c, slab_b, slab_a, slab_c, slab_a)
    for row, (oy, shift) in enumerate(((0.44, 0.0), (-0.42, 0.85))):
        for i, ox in enumerate((-5.2, -3.5, -1.8, -0.1, 1.6, 3.3, 5.0)):
            cx, cy = turn(ox + shift, oy)
            cube(f"near_slab_{row}_{i}", (cx, cy, 0.07), (0.79, 0.40, 0.05),
                 tones[(i + row) % len(tones)], 0.05, (0, 0, theta))

    # The kerb lip at the very front, cropped by the bottom edge.
    kx, ky = turn(0.0, -0.98)
    cube("near_kerb", (kx, ky, 0.10), (6.6, 0.26, 0.10), kerb, 0.04, (0, 0, theta), lean=0)
    tx, ty = turn(0.0, -0.86)
    cube("near_kerb_top", (tx, ty, 0.19), (6.6, 0.16, 0.03), kerb_top, 0.02, (0, 0, theta), lean=0)

    for i, (ox, oy, r) in enumerate((
        (-4.4, -0.62, 0.075), (-2.9, -0.56, 0.055), (-1.2, -0.66, 0.085),
        (0.7, -0.54, 0.060), (2.6, -0.64, 0.080), (4.2, -0.58, 0.065),
    )):
        cx, cy = turn(ox, oy)
        sphere(f"near_grit_{i}", (cx, cy, r * 0.5), (r, r * 0.8, r * 0.55), grit)

    # Weeds in the joints. SHORT, and that is not a style note: this band is
    # 0.45 units tall and the app sizes it from its aspect, so a 0.52-tall weed
    # doubles the drawn depth of the whole near plane. A pavement, not a meadow,
    # and not a hedge.
    for i, (ox, oy) in enumerate(((-3.42, 0.02), (-0.06, 0.02), (3.34, 0.02))):
        dx, dy = turn(ox, oy)
        before = set(bpy.data.objects)
        _blades(7, 0.19 + i * 0.37, 0.30, 0.22 + 0.06 * ((i * 0.73) % 1.0),
                (weed, weed_lit, weed, weed_lit, weed),
                lean=0.66, thickness=0.030)
        for obj in set(bpy.data.objects) - before:
            obj.location.x += dx
            obj.location.y += dy


def home_near_floor():
    """Boards running across the near floor, close enough to show their grain."""
    turn = facing(camera_yaw())
    theta = camera_yaw()
    board = material("Near board wood", tone("wood", "base"), roughness=0.72)
    board_b = material("Near board wood b", tone("wood", "shade"), roughness=0.74)
    board_c = material("Near board wood c", tone("wood", "lit"), roughness=0.70)
    seam = material("Near board seam", tone("stone", "shade"), roughness=0.86)

    bx, by = turn(0.0, 0.10)
    cube("near_floor_base", (bx, by, 0.02), (6.4, 0.94, 0.02), seam, 0.02, (0, 0, theta), lean=0)
    tones = (board, board_b, board_c, board_b)
    for i, ox in enumerate((-5.4, -3.6, -1.8, 0.0, 1.8, 3.6, 5.4)):
        cx, cy = turn(ox, 0.10)
        cube(f"near_board_{i}", (cx, cy, 0.06), (0.86, 0.90, 0.04),
             tones[i % len(tones)], 0.03, (0, 0, theta))


def park_wildflowers():
    """A tuft with three heads on it, so the scatter is not all one object."""
    mid = material("Flower stem", tone("grass", "base"), roughness=0.86)
    deep = material("Flower stem deep", tone("berry", "deep"), roughness=0.88)
    petal = material("Flower petal", tone("berry", "base"), roughness=0.74)
    petal_b = material("Flower petal pale", tone("berry", "lit"), roughness=0.74)
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
    far = material("Treeline far", tone("foliage", "lit"), roughness=0.90)
    far_b = material("Treeline far b", tone("foliage", "pop"), roughness=0.90)
    far_c = material("Treeline far c", tone("foliage", "base"), roughness=0.90)
    back = material("Treeline back", tone("foliage", "shade"), roughness=0.92)

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
    cream = material("Store cream", tone("cream", "base"), roughness=0.62, coat=0.02)
    glass = material("Store glass", tone("sea", "lit"), roughness=0.30, metallic=0.02, coat=0.12)
    glass_dark = material("Store glass depth", tone("sea", "shade"), roughness=0.26, metallic=0.08, coat=0.20)
    awning = material(f"{accent_name} awning", awning_hex, roughness=0.54, coat=0.05)
    wood = material("Display wood", tone("wood", "base"), roughness=0.62)
    brass = material("Store brass", tone("sun", "base"), roughness=0.28, metallic=0.68)

    # A shop that is one width from pavement to parapet is a box with windows
    # in it. The reference always gives it a plinth wider than the wall and a
    # crown wider than both, so the silhouette steps out at the ground and
    # again at the sky, and the awning hangs past the whole thing.
    contact_shadow(2.26, 0.68)
    cube("plinth", (0, 0.44, 0.30), (2.02, 0.72, 0.30), edge, 0.16)
    cube("store_body", (0, 0.48, 2.32), (1.78, 0.64, 2.10), body, 0.26)
    cube("store_crown", (0, 0.26, 4.34), (2.28, 0.90, 0.34), edge, 0.22)
    cube("store_cornice", (0, 0.24, 4.68), (2.00, 0.80, 0.15), body, 0.12)
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
        x = -1.68 + i * 0.56
        stripe = awning if i % 2 == 0 else cream
        cube(f"awning_{i}", (x, -0.86, 3.16), (0.28, 0.72, 0.17), stripe, 0.11, (math.radians(9), 0, 0))
        # The scalloped hem. It is the single most recognisable shape on a
        # cartoon shopfront and we were shipping a flat cut edge.
        sphere(f"awning_scallop_{i}", (x, -1.44, 3.00), (0.28, 0.17, 0.21), stripe)


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
    # DISTANCE IS NOT FOG. Measured against the park at the same hour: the
    # treeline is drawn at depth 0.14 / opacity 0.92 and the rooftops at 0.10 /
    # 0.86 -- effectively the same aerial perspective -- and yet the park's far
    # edge read as trees while the town's read as weather. The difference was
    # not the distance, it was that these were painted at `lit` and `base`
    # while the treeline is foliage at `base` and `lit`: a pale colour plus a
    # haze pass is a ghost. Distance takes a step DOWN the ramp so the haze has
    # something to lift.
    slate = material("Roof slate", tone("roof", "base"), roughness=0.86)
    slate_b = material("Roof tile", tone("roof", "shade"), roughness=0.86)
    wall = material("Far wall", tone("brick", "shade"), roughness=0.84)
    wall_b = material("Far wall warm", tone("brick", "base"), roughness=0.84)
    trim = material("Far trim", tone("metal", "base"), roughness=0.86)

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
    grout = material("Paving grout", tone("stone", "shade"), roughness=0.90)
    slab_a = material("Paving slab", tone("paving", "base"), roughness=0.82)
    slab_b = material("Paving slab b", tone("paving", "shade"), roughness=0.82)
    slab_c = material("Paving slab c", tone("paving", "lit"), roughness=0.80)

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
    stone = material("Kerb stone", tone("paving", "base"), roughness=0.80)
    stone_b = material("Kerb stone b", tone("paving", "lit"), roughness=0.82)
    edge = material("Kerb edge", tone("paving", "shade"), roughness=0.84)
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
    stone = material("Fountain stone", tone("stone", "base"), roughness=0.72)
    stone_light = material("Fountain stone light", tone("stone", "lit"), roughness=0.68)
    stone_dark = material("Fountain stone depth", tone("stone", "deep"), roughness=0.78)
    water = material("Fountain water", tone("sea", "base"), roughness=0.18, metallic=0.06, coat=0.30)
    # A 0.20 stem carrying a basin looks like a birdbath somebody could tip
    # over. Fat column, a plinth wider than the basin above it, and a heavier
    # lip on both bowls: the same fountain, drawn as a toy.
    contact_shadow(1.68, 0.80)
    cone("plinth", (0, 0, 0.17), 1.34, 1.16, 0.34, stone_dark)
    torus("lower_basin", (0, 0, 0.62), 1.04, 0.30, stone, scale=(1.22, 0.84, 0.66))
    sphere("lower_water", (0, -0.02, 0.66), (1.20, 0.72, 0.10), water)
    cone("column", (0, 0.08, 1.24), 0.46, shaft(0.46, 0.60), 1.10, stone_dark)
    torus("upper_basin", (0, 0.02, 1.82), 0.62, 0.20, stone_light, scale=(1.16, 0.84, 0.62))
    sphere("upper_water", (0, -0.02, 1.86), (0.66, 0.38, 0.08), water)
    sphere("finial", (0, 0.05, 2.24), (0.24, 0.21, 0.30), stone_light)


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
    iron = material("Lamp iron", tone("metal", "base"), roughness=0.42, metallic=0.10)
    brass = material("Lamp brass", tone("sun", "base"), roughness=0.30, metallic=0.24)
    glass = material("Lamp glow glass", tone("sun", "pop"), roughness=0.22, coat=0.26)
    # The post was a 0.10-radius pipe 3 units tall -- 5.4% of the prop's own
    # height, under the STOUT floor, and at 70pt on screen that is a hairline.
    # It is now a cone flaring 0.30 -> 0.14 onto a bell foot, under a lantern
    # half again as big as it was, and the whole thing reads at thumbnail size.
    contact_shadow(0.74, 0.40)
    cone("base", (0, 0, 0.17), flare(0.30), 0.30, 0.34, iron)
    cone("post", (0, 0, 1.59), 0.30, shaft(0.30), 2.50, iron)
    cylinder("collar", (0, 0, 2.90), 0.28, 0.22, brass, taper=0.74)
    lantern_z = stack(3.01, 0.60)
    cube("lantern", (0, 0, lantern_z), (0.62, 0.50, 0.60), iron, 0.16)
    cube("lantern_glass", (0, -0.50, lantern_z), (0.44, 0.05, 0.44), glass, 0.10)
    cone("cap", (0, 0, lantern_z + 0.72), 0.86, 0.16, 0.42, iron)
    sphere("finial", (0, 0, lantern_z + 1.02), (0.13, 0.12, 0.17), brass)


def town_planter():
    pot = material("Planter terracotta", tone("brick", "base"), roughness=0.76)
    pot_dark = material("Planter depth", tone("brick", "shade"), roughness=0.82)
    leaf = material("Planter leaf", tone("foliage", "base"), roughness=0.78)
    leaf_light = material("Planter leaf light", tone("foliage", "lit"), roughness=0.76)
    # A pot that is nearly the same width top and bottom is a bucket. This one
    # stands on a foot half the width of its mouth and wears a rim that
    # overhangs both, which is the shape every planter in the reference is.
    contact_shadow(0.96, 0.46)
    cone("pot", (0, 0.05, 0.44), 0.42, 0.80, 0.88, pot)
    cylinder("pot_rim", (0, 0.05, 0.94), 0.90, 0.22, pot_dark, taper=0.94)
    plant_z = stack(1.05, 0.52)
    sphere("plant_mass", (0, 0.02, plant_z), (0.80, 0.60, 0.52), leaf)
    for i, (x, z, s) in enumerate(((-0.44, 0.16, 0.40), (0.10, 0.54, 0.44), (0.46, 0.06, 0.36))):
        sphere(f"plant_{i}", (x, -0.04, plant_z + z), (s, s * 0.80, s * 0.88),
               leaf_light if i == 1 else leaf)


def beach_umbrella():
    wood = material("Umbrella wood", tone("wood", "base"), roughness=0.66)
    coral = material("Umbrella coral", tone("roof", "base"), roughness=0.56, coat=0.05)
    coral_dark = material("Umbrella coral edge", tone("roof", "shade"), roughness=0.62)
    yellow = material("Umbrella yellow", tone("sun", "base"), roughness=0.58, coat=0.05)
    # A 0.09 pole under a 1.62 canopy is a cocktail umbrella. Fatter, tapered,
    # planted in a heap of sand, under a canopy that is a DOME rather than a
    # disc -- deeper cone, heavier hem.
    contact_shadow(1.40, 0.58)
    sphere("sand_heap", (0, 0.06, 0.10), (0.44, 0.32, 0.15), wood)
    cylinder("umbrella_pole", (0, 0.08, 1.62), 0.17, 3.10, wood, taper=0.58)
    cone("canopy", (0, 0, 3.40), 1.66, 0.20, 0.92, coral)
    torus("canopy_edge", (0, 0, 2.98), 1.48, 0.14, coral_dark, scale=(1.0, 0.72, 0.65))
    cone("canopy_inset", (0, -0.18, 3.42), 0.92, 0.11, 0.78, yellow)
    sphere("cap", (0, 0, 3.94), (0.18, 0.16, 0.20), yellow)


def beach_lifeguard():
    wood = material("Tower warm wood", tone("wood", "base"), roughness=0.66)
    coral = material("Tower coral", tone("berry", "base"), roughness=0.62, coat=0.03)
    cream = material("Tower cream", tone("cream", "base"), roughness=0.68)
    aqua = material("Tower aqua", tone("sea", "lit"), roughness=0.56, coat=0.06)
    glass = material("Tower window", tone("sea", "pop"), roughness=0.20, coat=0.30)
    contact_shadow(1.45, 0.68)
    # Stilts at 0.13 under a hut 1.20 wide is a table, not a tower. Fatter and
    # splayed twice as hard, so the whole thing stands in an A rather than a
    # pair of parallels, and a deck that overhangs them.
    for x in (-1.02, 1.02):
        cube(f"stilt_{x}", (x, 0.18, 1.02), (0.20, 0.23, 1.08), wood, 0.12, (0, math.radians(9 if x < 0 else -9), 0))
    cube("platform", (0, 0.05, 1.94), (1.52, 0.86, 0.20), wood, 0.15)
    # A LIFEGUARD TOWER IS RED AND WHITE, not cream on cream. The hut is the
    # biggest mass in this prop and it was the same family as the sand it
    # stands on, so on the contact sheet the whole tower read as a pale smudge
    # a few shades off the beach floor. Bold hut, contrasting roof, cream only
    # as trim.
    cube("hut", (0, 0.18, 2.90), (1.20, 0.65, 0.86), coral, 0.20)
    cube("window", (0, -0.50, 3.04), (0.62, 0.05, 0.38), glass, 0.10)
    cube("window_frame_top", (0, -0.58, 3.45), (0.72, 0.05, 0.07), cream, 0.05)
    cube("window_frame_bottom", (0, -0.58, 2.63), (0.72, 0.05, 0.07), cream, 0.05)
    cube("roof", (0, 0.18, 3.86), (1.74, 1.02, 0.22), aqua, 0.18, (0, math.radians(-5), 0))
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
def beach_headland():
    """The far side of the bay.

    The beach sky measured a standard deviation of 3.3 across a clean band --
    the flattest surface in the game, flatter than the town sky was -- and the
    sea ran to a hard line with a thin green strip on it. This is a headland to
    sit on that line: one low mass, hazed toward the sky the way distance
    actually works, so the water has a far edge and the sky has something to
    end against.

    Camera-facing frame, like every wide band in this pack.
    """
    turn = facing(camera_yaw())
    far = material("Headland far", tone("stone", "lit"), roughness=0.92)
    far_b = material("Headland far b", tone("stone", "pop"), roughness=0.92)
    far_c = material("Headland far c", tone("stone", "base"), roughness=0.92)
    rock = material("Headland rock", tone("stone", "shade"), roughness=0.90)

    mats = (far, far_b, far_c, far_b, far)
    for i in range(15):
        h = 0.30 + 0.26 * ((i * 0.6180) % 1.0)
        x, y = turn(-3.10 + i * 0.44, 0.05 * ((i % 3) - 1))
        sphere(f"hill_{i}", (x, y, h * 0.58), (0.42, 0.30, h * 0.56), mats[i % len(mats)])
    # A headland has to END somewhere, or it is a wall. One rocky point.
    for i, (dx, hh) in enumerate(((0.0, 0.42), (0.30, 0.28), (0.56, 0.18))):
        x, y = turn(2.30 + dx, 0.02)
        sphere(f"point_{i}", (x, y, hh * 0.52), (0.26, 0.20, hh * 0.50), rock)
    for i in range(13):
        x, y = turn(-3.10 + i * 0.52, 0.06)
        sphere(f"shore_{i}", (x, y, 0.06), (0.34, 0.26, 0.10), far_c)


def beach_shells():
    """A scallop shell and a pebble, for the sand.

    The sand measured sd 8.0 -- 318 distinct colours across a 160x70 patch,
    and the same 318 on the other side of the frame. It is one fill, and this
    is what goes on it.

    A scallop is read from its SILHOUETTE, so it is built as a fan of lobes
    radiating from the hinge: the scalloped outer edge is the whole shape. A
    first pass made it a smooth dome with four dimples raked across it and
    rendered three pale blobs -- ribs pressed INTO a shell do nothing at 58px,
    because at 58px there is no surface, only an outline.
    """
    shell = material("Shell", tone("cream", "base"), roughness=0.58, coat=0.10)
    shell_warm = material("Shell warm", tone("cream", "lit"), roughness=0.58, coat=0.10)
    hinge = material("Shell hinge", tone("metal", "base"), roughness=0.66)
    pebble = material("Pebble", tone("stone", "base"), roughness=0.86)

    root_x, root_y = -0.26, 0.06
    lobes = 7
    for i in range(lobes):
        # A fan from about -55 to +55 degrees, opening away from the hinge.
        angle = math.radians(-55 + i * (110 / (lobes - 1)))
        reach = 0.36
        sphere(
            f"lobe_{i}",
            (root_x + reach * math.cos(angle), root_y + reach * math.sin(angle) * 0.55, 0.09),
            (0.16, 0.13, 0.075),
            shell if i % 2 else shell_warm,
        )
    sphere("shell_body", (root_x + 0.17, root_y, 0.085), (0.24, 0.17, 0.08), shell)
    sphere("hinge", (root_x, root_y, 0.07), (0.09, 0.08, 0.055), hinge)
    sphere("pebble", (0.34, -0.20, 0.055), (0.12, 0.10, 0.062), pebble)


def beach_dune_grass():
    """Marram grass, for the dry sand. Sparser and paler than park grass --
    it grows in tufts out of bare sand, not in a lawn."""
    blade = material("Marram", tone("grass", "lit"), roughness=0.88)
    blade_pale = material("Marram pale", tone("grass", "pop"), roughness=0.86)
    blade_deep = material("Marram deep", tone("grass", "base"), roughness=0.90)
    _blades(9, 0.57, 0.30, 1.05, (blade, blade_pale, blade_deep), lean=0.52, thickness=0.026)


def beach_dune():
    sand = material("Dune sand", tone("sand", "base"), roughness=0.92)
    sand_light = material("Dune light", tone("sand", "lit"), roughness=0.90)
    grass = material("Dune grass", tone("grass", "base"), roughness=0.88)
    contact_shadow(1.62, 0.52)
    sphere("dune", (0, 0.16, 0.34), (1.65, 0.66, 0.42), sand)
    sphere("dune_light", (-0.36, -0.30, 0.48), (0.92, 0.22, 0.16), sand_light)
    for i, x in enumerate((-1.20, -0.72, -0.15, 0.52, 1.06)):
        cylinder(f"grass_{i}", (x, 0, 0.92 + 0.08 * (i % 2)), 0.045, 1.10, grass, rotation=(math.radians(8), math.radians(-12 + i * 6), math.radians(-8 + i * 4)), vertices=20)


def beach_castle():
    sand = material("Castle sand", tone("sand", "base"), roughness=0.92)
    sand_light = material("Castle sun face", tone("sun", "lit"), roughness=0.90)
    sand_dark = material("Castle depth", tone("sand", "shade"), roughness=0.94)
    flag = material("Castle flag", tone("berry", "base"), roughness=0.60, coat=0.04)
    wood = material("Flag pole", tone("cream", "lit"), roughness=0.72)
    contact_shadow(1.32, 0.52)
    cube("castle_base", (0, 0.08, 0.42), (1.30, 0.68, 0.42), sand, 0.18)
    for i, x in enumerate((-0.86, 0, 0.86)):
        cylinder(f"tower_{i}", (x, -0.02, 0.98 + (0.30 if i == 1 else 0)),
                 0.50 if i != 1 else 0.58, 1.26 if i != 1 else 1.60,
                 sand_light if i == 1 else sand, vertices=40, taper=0.72)
        for j in range(4):
            angle = j * math.pi / 2
            cube(f"battlement_{i}_{j}", (x + math.cos(angle) * 0.25, math.sin(angle) * 0.22, 1.68 + (0.42 if i == 1 else 0)), (0.10, 0.10, 0.12), sand, 0.04)
    cube("door", (0, -0.64, 0.46), (0.24, 0.05, 0.28), sand_dark, 0.12)
    cylinder("flag_pole", (0, 0, 2.68), 0.035, 1.25, wood, vertices=20)
    cube("flag", (0.24, 0, 3.02), (0.28, 0.035, 0.16), flag, 0.04)


def beach_palm():
    trunk = material("Palm trunk", tone("bark", "base"), roughness=0.78)
    trunk_light = material("Palm trunk light", tone("bark", "lit"), roughness=0.72)
    leaf = material("Palm leaf", tone("foliage", "base"), roughness=0.80)
    leaf_light = material("Palm leaf light", tone("foliage", "lit"), roughness=0.76)
    # The trunk drifted 0.08 per segment and shed a twelfth of its radius --
    # near enough to a vertical pipe. A palm in the reference is a THICK base
    # that bends away hard and thins to a third of itself under the crown, with
    # the segments overlapping so it reads as one bending mass, not a stack.
    # THE TRUNK IS ONE BENDING MASS, NOT A STACK.
    #
    # Two attempts read as a staircase of blocks on the contact sheet -- the
    # thin original and a fattened version of the same idea. The shape was
    # never the problem: a leaning cylinder has a FLAT TOP, so every segment
    # showed a shelf where the next one climbed onto it, and alternating a
    # light and a dark tone across those shelves drew a ladder. `metablob`
    # already exists for exactly this (it is what stopped the clouds reading as
    # bunches of grapes) so the trunk is one fused surface, and the rings that
    # make it read as a palm are banded ON it rather than being the joins.
    contact_shadow(1.30, 0.56)

    def arc(t):
        """(x, z) along the trunk, and the slope there in radians."""
        return -0.10 + 0.72 * t * t, 0.22 + t * 3.42, math.atan2(1.44 * t, 3.42)

    blobs = []
    for i in range(16):
        t = i / 15.0
        x, z, _ = arc(t)
        r = 0.34 - 0.20 * t
        blobs.append(((x, 0.0, z), (r, r * 0.92, r)))
    metablob("palm_trunk", blobs, trunk, resolution=0.05, threshold=0.3)
    # PROUD OF THE SURFACE, not level with it. The first pass sized the rings
    # to the blob radius and the fused surface swallowed all six -- a detail
    # that is present in the file and absent from the picture is worse than no
    # detail, because it looks handled.
    for i in range(7):
        t = 0.06 + i * 0.13
        x, z, slope = arc(t)
        cylinder(f"trunk_ring_{i}", (x, 0, z), 0.41 - 0.20 * t, 0.12, trunk_light,
                 rotation=(0, slope, 0), vertices=28, taper=0.98, lean=0)

    crown_x, crown_z, _ = arc(1.0)
    crown = (crown_x + 0.06, 0, crown_z + 0.12)
    sphere("palm_crown", crown, (0.30, 0.28, 0.24), trunk)
    for i, (dx, dz) in enumerate(((-0.26, -0.26), (0.22, -0.30))):
        sphere(f"coconut_{i}", (crown[0] + dx, -0.26, crown[2] + dz), (0.16, 0.15, 0.15), trunk)

    # FRONDS DROOP, AND THEY TAPER.
    #
    # They were cubes rotated about Z, which turns a frond in the GROUND plane
    # -- on a front-weighted camera that draws six spokes lying flat, which is
    # why the old palm read as a T. Rotating about Y turns them in the plane
    # the camera sees. Cones rather than boxes, so a frond comes to a point,
    # and two segments each so the outer half falls away from the inner half.
    def along(deg, length, base, tip, name, mat, start_at):
        a = math.radians(deg)
        ux, uz = math.cos(a), math.sin(a) * 0.88
        centre = (start_at[0] + ux * length / 2, -0.02, start_at[1] + uz * length / 2)
        cone(name, centre, base, tip, length, mat,
             rotation=(0, math.pi / 2 - a, 0), vertices=20, lean=0)
        return (start_at[0] + ux * length, start_at[1] + uz * length)

    for i, phi in enumerate((198, 156, 122, 58, 24, -14)):
        mat = leaf_light if i % 2 else leaf
        tip_at = along(phi, 1.16, 0.20, 0.13, f"frond_{i}", mat, (crown[0], crown[2]))
        along(phi - (34 if math.cos(math.radians(phi)) > 0 else -34),
              0.78, 0.13, 0.02, f"frond_tip_{i}", mat, tip_at)


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
    field = material("Panel field", tone("cream", "lit"), roughness=0.74)
    stile = material("Panel stile", tone("paving", "base"), roughness=0.68, coat=0.02)
    rail = material("Panel rail", tone("wood", "base"), roughness=0.66, coat=0.02)
    shade = material("Panel shade", tone("wood", "lit"), roughness=0.80)

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
    board = material("Skirting board", tone("wood", "base"), roughness=0.62, coat=0.04)
    board_lit = material("Skirting lit", tone("metal", "lit"), roughness=0.56, coat=0.06)
    shadow = material("Skirting shadow", tone("metal", "shade"), roughness=0.74)

    for i in range(16):
        x = -3.20 + i * 0.42
        bx, by = turn(x, 0.0)
        cube(f"board_{i}", (bx, by, 0.16), (0.212, 0.05, 0.16), board, 0.02, rotation=(0, 0, theta))
        cx, cy = turn(x, -0.012)
        cube(f"cap_{i}", (cx, cy, 0.315), (0.212, 0.062, 0.028), board_lit, 0.018, rotation=(0, 0, theta))
        sx, sy = turn(x, -0.055)
        cube(f"scotia_{i}", (sx, sy, 0.028), (0.212, 0.022, 0.028), shadow, 0.012, rotation=(0, 0, theta))


def home_rug():
    gold = material("Rug gold", tone("sun", "base"), roughness=0.92)
    gold_light = material("Rug pile light", tone("sun", "lit"), roughness=0.94)
    gold_dark = material("Rug bound edge", tone("sun", "shade"), roughness=0.90)
    cream = material("Rug inset", tone("cream", "pop"), roughness=0.96)
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
    wood = material("Tray wood", tone("wood", "base"), roughness=0.58, coat=0.05)
    floor = material("Tray floor", tone("wood", "shade"), roughness=0.66, coat=0.03)
    front = material("Tray front", tone("wood", "deep"), roughness=0.62, coat=0.04)
    rim = material("Tray rim", tone("wood", "lit"), roughness=0.50, coat=0.08)
    shine = material("Tray shine", tone("wood", "pop"), roughness=0.40, coat=0.12)
    brass = material("Tray brass", tone("sun", "base"), roughness=0.30, metallic=0.72)

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
    return _mound(tone("bark", "base"), tone("bark", "lit"), tone("bark", "shade"),
                  tone("ink", "deep"), tone("sun", "base"))


def beach_sand_mound():
    return _mound(tone("sand", "lit"), tone("sand", "pop"), tone("sand", "base"),
                  tone("sand", "shade"), tone("cream", "pop"), ripples=True)


# ---------------------------------------------------------------------------


def item_biscuit():
    """A bone biscuit: one smooth bar with a knob at each corner of each end.

    The first pass laid a darker bar along the underside as a shadow line; at
    thumbnail size that stripe read as a plank, and the whole thing looked like
    a little wooden bench. A bone is a silhouette, so it is now only that.
    """
    dough = material("Biscuit dough", tone("wood", "base"), roughness=0.78)
    for x in (-0.34, 0.34):
        for z in (-0.16, 0.16):
            sphere(f"knob_{x}_{z}", (x, 0, 0.58 + z), (0.18, 0.16, 0.17), dough)
    cube("bone_bar", (0, 0, 0.58), (0.34, 0.11, 0.11), dough, 0.09)


def item_cheese():
    """A wedge. A three-sided cylinder IS a triangular prism; a rotated cube is
    a rhombus, which is what the first pass rendered.

    What was still wrong: it was 0.34 deep against a 0.52 radius and turned
    face-on to the camera, so it read as a flat triangular SIGN. A wedge of
    cheese is a solid -- you see the front face AND the top of it -- and its
    holes are cavities, not three dots painted on the front. Deeper, turned off
    axis, holes sunk in the top and the side, and a rind that wraps the back
    instead of being a sheet stuck on the front.
    """
    flesh = material("Cheese flesh", tone("sun", "lit"), roughness=0.60, coat=0.05)
    rind = material("Cheese rind", tone("sun", "base"), roughness=0.64)
    hole = material("Cheese hole", tone("sun", "shade"), roughness=0.72)
    turn = math.radians(-22)
    cylinder("wedge", (0, 0, 0.54), 0.56, 0.50, flesh,
             rotation=(math.radians(90), 0, turn), vertices=3, taper=1.0)
    cylinder("wedge_rind", (0.09, 0.22, 0.54), 0.56, 0.07, rind,
             rotation=(math.radians(90), 0, turn), vertices=3, taper=1.0)
    # ON THE FACE, all of them. The first version of this spread the holes
    # through the wedge's DEPTH (y from -0.24 to +0.02) and three of the four
    # ended up inside the solid: one hole rendered, on a cheese that is
    # supposed to be full of them.
    # BORES, NOT BUMPS. Spheres sitting proud of the face take the key light
    # on their tops and render as three studs -- the cheese grew rivets. A
    # shallow dark disc flush with the surface is what reads as a hole.
    for i, (x, z, r) in enumerate((
        (-0.13, 0.49, 0.090),
        (0.10, 0.40, 0.064),
        (-0.04, 0.70, 0.055),
    )):
        cylinder(f"hole_{i}", (x, -0.243, z), r, 0.03, hole,
                 rotation=(math.radians(90), 0, 0), vertices=20, taper=1.0, lean=0)


def item_steak():
    """A cut of meat: one mass, a rim of fat, a lighter cut face, one bone.

    Four passes were lost to detail this thing has no room for. Pale caps at
    each END made it symmetrical and read as a wrapped sweet; fat along the top
    edge read as a bun; a bone poking out of one SIDE read as a drumstick.

    And then a fifth thing, which no amount of shaping was ever going to fix:
    the seared face was painted `tone("sea", ...)`. The sea family. On a 48px
    icon that is a TEAL BLOB in the middle of the meat, and the note above it
    described the shape it wanted while saying nothing about the colour, so
    three separate passes re-cut the geometry around a bug in the material.
    Everything on a steak is warm. There is no cool tone anywhere in it.
    """
    meat = material("Steak", tone("berry", "shade"), roughness=0.68)
    cut = material("Steak cut face", tone("berry", "base"), roughness=0.64)
    fat = material("Steak fat", tone("cream", "lit"), roughness=0.62)
    sphere("fat_rim", (0, 0.03, 0.56), (0.54, 0.21, 0.38), fat)
    sphere("cut", (0, -0.04, 0.56), (0.47, 0.20, 0.32), meat)
    # The cut face is the top of the mass catching the key, one step up the
    # SAME ramp -- not a separate patch in the middle, which looked like a yolk.
    sphere("cut_lit", (0.02, -0.17, 0.68), (0.38, 0.07, 0.13), cut)
    # The T-bone, INSIDE the silhouette. A slab of red with a cream rim is
    # meat, but it is also ham, a pork chop, or a bread roll shot from above.
    # The bone is what names it -- and every earlier attempt put it outside the
    # outline, which is exactly what turned it into a drumstick.
    tilt = math.radians(-16)
    bone_x, bone_y, bone_z, bone_half = -0.26, -0.26, 0.56, 0.19
    cylinder("bone_bar", (bone_x, bone_y, bone_z), 0.052, bone_half * 2, fat,
             rotation=(0, tilt, 0), taper=1.0)
    for end_ in (1, -1):
        sphere(
            f"bone_end_{end_}",
            (bone_x + end_ * bone_half * math.sin(tilt), bone_y,
             bone_z + end_ * bone_half * math.cos(tilt)),
            (0.088, 0.055, 0.082),
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
    body = material("Ball body", tone("berry", "base"), roughness=0.42, coat=0.20)
    band = material("Ball band", tone("cream", "pop"), roughness=0.44, coat=0.18)
    sphere("ball", (0, 0, 0.58), (0.46, 0.46, 0.46), body)
    sphere("band", (0, 0, 0.58), (0.485, 0.485, 0.14), band)


def item_rope():
    """A knotted tug rope: TWO STRANDS WOUND ROUND EACH OTHER, and a knot at
    each end.

    Five passes, and the first four all failed the same way: they drew a bar
    and then tried to make the bar say "rope" with something added to its ends.
    A flattened torus rendered as a tan disc. Upright it rendered as a
    doughnut. A thin bar with dark beads rendered as a caterpillar. Cones fanned
    round the ends rendered as a morningstar, and cones opening outward from
    them rendered as a dumbbell.

    What says rope is the TWIST, and a twist is not a detail you add to a
    cylinder -- it is what the object is made of. So there is no cylinder: two
    helical strands of overlapping beads wind around the axis in opposite
    phase, in two tones, and the crossing pattern that produces is legible at
    48px in a way nothing painted on a smooth rod ever was.
    """
    rope = material("Rope", tone("wood", "base"), roughness=0.88)
    rope_dark = material("Rope shade", tone("wood", "shade"), roughness=0.90)
    lean = math.radians(-14)
    # The rope's own frame: `u` runs along it, `p` is across it in the picture
    # plane, and y is the third axis. Everything below is placed in that frame,
    # so changing `lean` swings the whole toy instead of shearing it.
    ux, uz = math.cos(lean), -math.sin(lean)
    px, pz = math.sin(lean), math.cos(lean)
    span, twist, offset = 0.34, 7.2, 0.086

    for i in range(19):
        t = (i / 18.0 - 0.5) * 2 * span
        for strand, phase in enumerate((0.0, math.pi)):
            a = t * twist / span * 0.5 + phase
            sphere(
                f"strand_{strand}_{i}",
                (t * ux + offset * math.cos(a) * px,
                 offset * math.sin(a),
                 0.58 + t * uz + offset * math.cos(a) * pz),
                (0.080, 0.080, 0.080),
                rope if strand == 0 else rope_dark,
                swell=0.0,
            )

    for i, side in enumerate((-1, 1)):
        kx = side * (span + 0.10) * ux
        kz = 0.58 + side * (span + 0.10) * uz
        sphere(f"knot_{i}", (kx, 0, kz), (0.140, 0.172, 0.172), rope)
        # A short cut end past the knot, the same width as the knot: a rope
        # that stops at a bulge looks tied, which is exactly what it is.
        cone(f"end_{i}", (kx + side * 0.13 * ux, 0, kz + side * 0.13 * uz),
             0.115, 0.135, 0.15, rope_dark,
             rotation=(0, math.radians(side * 90) + lean, 0), vertices=14, lean=0)


def kit_bowl():
    """His food bowl, for the care tray.

    The tray under him is a Blender render and everything standing on it was a
    flat SVG -- a bowl drawn as two stacked ellipses, directly beneath a
    rendered dog. Same object, same rig, same light.

    The dish is shallow and the food is MOUNDED above the rim. The first pass
    put a disc across the opening at the same height as the kibble, which
    swallowed all four pieces and rendered an empty orange bowl.
    """
    glaze = material("Bowl glaze", tone("sun", "base"), roughness=0.36, coat=0.22)
    rim = material("Bowl rim", tone("wood", "base"), roughness=0.34, coat=0.24)
    inside = material("Bowl inside", tone("sun", "shade"), roughness=0.55)
    kibble = material("Kibble", tone("bark", "base"), roughness=0.74)
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

    ONE tapered branch with twigs. The first pass built it from three cylinders
    whose ends did not actually meet, which rendered as a jack: three separate
    brown rods crossing near the middle. A branch reads as a branch because it
    TAPERS and because everything on it grows out of one line.

    It was still reading as a cigar: 0.10 down to 0.062 is a 38% taper on a
    horizontal rod with one small twig, which is a smooth brown tube. Harder
    taper, a lean, two twigs on opposite sides of the line rather than one, and
    a couple of bark rings so the surface is not a single unbroken cylinder.
    """
    bark = material("Stick bark", tone("bark", "base"), roughness=0.86)
    bark_dark = material("Stick bark shade", tone("bark", "shade"), roughness=0.88)
    lit = material("Stick lit", tone("wood", "lit"), roughness=0.80)
    lean = math.radians(-12)
    axis = math.radians(90) + lean

    def along(t):
        """A point t units from the middle, down the branch's own line."""
        return t * math.cos(lean), 0.58 - t * math.sin(lean)

    # 0.115 -> 0.045 over one length is a CONE, and a brown cone with a point
    # on it is a carrot. A branch keeps most of its thickness and loses it at
    # the tip, so this is two segments: a near-parallel shaft, then a short
    # taper. The rings sit proud (see beach/palm -- level with the surface they
    # are invisible) and are what stops the shaft reading as one smooth tube.
    cone("limb", (0.06, 0, 0.575), 0.098, 0.072, 0.80, bark, rotation=(0, axis, 0))
    tx, tz = along(0.44)
    cone("limb_tip", (tx, 0, tz), 0.074, 0.026, 0.34, bark, rotation=(0, axis, 0))
    for i, (t, r) in enumerate(((-0.30, 0.098), (-0.02, 0.088), (0.24, 0.078))):
        x, z = along(t)
        cylinder(f"ring_{i}", (x, 0, z), r * 1.16, 0.05, bark_dark,
                 rotation=(0, axis, 0), vertices=20, taper=1.0)
    # Two twigs, opposite sides of the line. One was a knot with a spike on it.
    for i, (t, fork, length) in enumerate(((0.13, 46, 0.30), (-0.09, -132, 0.21))):
        x, z = along(t)
        angle = math.radians(fork) + lean
        sphere(f"knot_{i}", (x, 0, z), (0.10, 0.092, 0.092), bark)
        cone(f"twig_{i}",
             (x + (length / 2) * math.sin(angle), 0, z + (length / 2) * math.cos(angle)),
             0.055, 0.014, length, bark, rotation=(0, angle, 0))
    # No painted-on highlight: a thin lit rod laid along the top of the branch
    # sits PROUD of it at the tapered end and renders as a second stick lying
    # across the first. The key light already gives it a top edge; the pale
    # material is the scar where the branch broke off instead.
    # ON the shaft. This sat at along(-0.50) while the limb only reaches -0.34,
    # so the pale scar rendered as a separate crumb floating beside the stick.
    sx, sz = along(-0.30)
    sphere("scar", (sx, -0.075, sz), (0.052, 0.030, 0.044), lit)


def collar(name, hex_body, hex_edge):
    def build():
        body = material(f"{name} collar", hex_body, roughness=0.52, coat=0.08)
        edge = material(f"{name} collar edge", hex_edge, roughness=0.56)
        brass = material("Collar brass", tone("sun", "base"), roughness=0.28, metallic=0.74)
        torus("band", (0, 0, 0.58), 0.42, 0.09, body, scale=(1, 0.55, 1))
        torus("band_edge", (0, 0, 0.52), 0.42, 0.04, edge, scale=(1, 0.55, 1))
        cube("buckle", (0, -0.22, 0.58), (0.11, 0.04, 0.11), brass, 0.03)
        sphere("tag", (0, -0.24, 0.30), (0.12, 0.04, 0.12), brass)
    return build


def sky_cloud():
    """A CLOUD, not five white pills.

    The sky is the largest surface in every outdoor scene and it held two
    objects: a flat SVG sun and a stack of `borderRadius` Views. On a 2x
    capture at 2pm the near one reads as a pale grey rounded slab -- the exact
    "empty grey UI panel" note a comment in `OutdoorRenderedScenes.tsx` was
    written to kill, still true, because the fix that comment describes was to
    the ARRANGEMENT of pills and the problem is that they are pills. A capsule
    has one silhouette and one fill; nothing about it is a cloud.

    So this is geometry, in two fused masses:

    - The CROWN is lumpy on its silhouette and smooth inside it -- one
      metaball surface, so lobes of clearly unequal radius bump the top edge
      without filling the interior with the crescent seams that overlapping
      spheres leave. A first pass built it from plain spheres and rendered a
      bunch of grapes.
    - The UNDERSIDE is a second, flatter, wider mass in cool blue-grey,
      showing beneath the crown. The two-tone is authored rather than left to
      the lights, because at 140pt on a phone a soft gradient reads as dirt on
      the glass. The seam between the two masses IS the shadow line.

    White at the top, non-negotiable: a cloud is the brightest thing in this
    sky, and the old pills were 94% white over pale blue, which is grey. The
    base colour is a COOL white rather than #FFFFFF, because the pack's shared
    key is (1.0, 0.77, 0.58) and a neutral white under it renders peach -- fine
    on a wooden bench, wrong on the one object in the frame the eye reads as
    "white". Measured against the sky it sits on, not judged on paper.

    Built in the camera-facing frame like every other wide prop, or a cloud
    two metres long comes out banked like a paper aeroplane.
    """
    turn = facing(camera_yaw())
    crown_mat = material("Cloud crown", tone("sky", "base"), roughness=0.96, coat=0.0)
    under_mat = material("Cloud under", tone("sky", "shade"), roughness=0.98, coat=0.0)

    under = []
    for dx, sx, sz in ((-1.66, 0.44, 0.15), (-0.84, 0.56, 0.17),
                       (0.02, 0.62, 0.18), (0.86, 0.54, 0.17), (1.62, 0.46, 0.15)):
        x, y = turn(dx, 0.16)
        under.append(((x, y, 0.24), (sx, 0.34, sz)))
    metablob("cloud_under", under, under_mat)

    # Radii deliberately unequal and unsorted -- a run of lobes that grows and
    # then shrinks is a hill, and a hill in the sky is a blob.
    crown = []
    for dx, dz, r in ((-1.44, 0.40, 0.30), (-0.76, 0.60, 0.44), (0.04, 0.70, 0.50),
                      (0.70, 0.54, 0.38), (1.34, 0.40, 0.28), (-0.24, 0.44, 0.34),
                      (0.92, 0.36, 0.26)):
        x, y = turn(dx, -0.02)
        crown.append(((x, y, dz), (r, 0.36, r * 0.80)))
    metablob("cloud_crown", crown, crown_mat)


def sky_cloud_far():
    """The same cloud, further away and thinner.

    A second cloud at a different size is what gives a flat gradient a sense
    of distance, so this is not the near one scaled down: it is flatter (a
    distant cumulus is seen closer to edge-on) and its underside is weaker,
    because haze eats contrast with distance before it eats anything else.
    """
    turn = facing(camera_yaw())
    crown_mat = material("Far cloud crown", tone("sky", "base"), roughness=0.96, coat=0.0)
    under_mat = material("Far cloud under", tone("sky", "shade"), roughness=0.98, coat=0.0)

    under = []
    for dx, sx in ((-0.66, 0.30), (-0.02, 0.36), (0.62, 0.28)):
        x, y = turn(dx, 0.14)
        under.append(((x, y, 0.20), (sx, 0.26, 0.08)))
    metablob("far_under", under, under_mat, threshold=0.16)

    # Tighter spacing and a lower threshold than the near cloud. Distance
    # SIMPLIFIES a silhouette -- at this size three legible lobes read as one
    # far cloud, where three separable ones read as three small near ones.
    crown = []
    for dx, dz, r in ((-0.48, 0.28, 0.22), (0.00, 0.36, 0.28), (0.46, 0.26, 0.20)):
        x, y = turn(dx, -0.01)
        crown.append(((x, y, dz), (r, 0.26, r * 0.60)))
    metablob("far_crown", crown, crown_mat, threshold=0.16)


def home_vista():
    """What the living-room window actually looks out on.

    This was the worst object in the game and it sat inside one of the best.
    The window FRAME is a full render -- mitred timber, a bevelled sill, a real
    cast shadow -- and behind its glass were a flat blue rectangle, a flat
    yellow disc, three flat green SVG bands and four ellipses for trees. A
    child's drawing taped inside a photograph.

    The constraint that shapes everything here is SIZE. The aperture is about
    127pt across on a phone and this occupies the bottom two fifths of it, so
    the whole landscape is roughly 127x48pt. A first pass put four trees on it
    and they came out six points tall: invisible, and they took the ridge's
    silhouette with them. What survives at 48pt is tonal separation between a
    small number of bands, plus one or two shapes big enough to have an
    outline.

    So: three ridges that differ in HEIGHT and in COLOUR, not just in y. Far is
    hazed toward the sky's own blue -- distance is a colour problem before it
    is a size problem, and a first pass hazed it so far it read as snow. Two
    trees, on the nearest ridge where they are biggest, and only two.
    """
    turn = facing(camera_yaw())
    # Blue, not grey, and MORE blue than looks right on paper. #8FB6BE rendered
    # as a neutral and the far ridge read as a heap of boulders behind the
    # fields; #A3C4DA, an honest distant-hill blue, rendered grey too. The warm
    # key is (1.0, 0.77, 0.58) at 880W, and it eats low-chroma blue -- the same
    # effect this file already records for the violet storefront, which carries
    # more chroma than its neighbours need for exactly this reason. Measured
    # off the render, not eyeballed: the saturation of the far band has to come
    # back above the grass's before it reads as distance.
    far = material("Vista far", tone("sky", "lit"), roughness=0.95)
    far_b = material("Vista far b", tone("sky", "pop"), roughness=0.95)
    mid = material("Vista mid", tone("foliage", "lit"), roughness=0.92)
    mid_b = material("Vista mid b", tone("foliage", "pop"), roughness=0.92)
    near = material("Vista near", tone("foliage", "base"), roughness=0.90)
    near_b = material("Vista near b", tone("foliage", "pop"), roughness=0.90)
    trunk = material("Vista trunk", tone("bark", "base"), roughness=0.88)
    leaf = material("Vista leaf", tone("foliage", "shade"), roughness=0.90)

    # Far: the TALLEST band, and the one furthest back. Hills read as distant
    # because they are pale and high, not because they are small.
    for i in range(6):
        h = 0.92 + 0.62 * ((i * 0.6180) % 1.0)
        x, y = turn(-1.85 + i * 0.74, 0.85)
        sphere(f"far_{i}", (x, y, h * 0.26), (0.78, 0.36, h * 0.54), far if i % 2 else far_b)
    for i in range(7):
        h = 0.52 + 0.26 * ((i * 0.3820) % 1.0)
        x, y = turn(-1.85 + i * 0.62, 0.30)
        sphere(f"mid_{i}", (x, y, h * 0.18), (0.62, 0.36, h * 0.50), mid if i % 2 else mid_b)
    for i in range(6):
        h = 0.34 + 0.20 * ((i * 0.7236) % 1.0)
        x, y = turn(-1.95 + i * 0.78, -0.35)
        sphere(f"near_{i}", (x, y, h * 0.04), (0.80, 0.42, h * 0.56), near if i % 2 else near_b)
    # Two trees, on the nearest ridge, at a size that survives the pane.
    for i, (dx, sc) in enumerate(((-1.16, 0.62), (1.06, 0.54))):
        x, y = turn(dx, -0.42)
        cylinder(f"trunk_{i}", (x, y, 0.18 + sc * 0.34), sc * 0.10, sc * 0.80, trunk)
        sphere(f"leaf_{i}", (x, y, 0.18 + sc * 1.02), (sc * 0.66, sc * 0.52, sc * 0.72), leaf)


def beach_surf():
    """Where the sea meets the sand, which was one wavy white line.

    The beach sea is a flat teal band about a sixth of the frame, and the only
    thing happening on it is a single SVG squiggle of white doing the whole job
    of "water arriving at a shore". At phone size that reads as a scratch in
    the paint.

    Surf is FOAM, and foam is the one thing in this world with genuinely no
    hard edges, so it is a metaball field like the clouds. Two rules learned
    from the first pass, which rendered a fat white sausage -- a kerb, which is
    exactly what its own docstring said to avoid:

    - It must BREAK. Evenly spaced lobes fuse into a rope no matter how their
      heights vary. The gaps between groups are wider than the metaball field
      can bridge, so the surf is a broken chain of scallops.
    - Its crests must differ by a LOT, not a little. Two or three tall breaks
      carry the whole line; everything between them is thin.

    Camera-facing like every wide band in this pack, and overscanned past both
    ends so the app can hang it off the frame edges.
    """
    turn = facing(camera_yaw())
    foam = material("Surf foam", tone("cream", "pop"), roughness=0.94, coat=0.0)
    wash = material("Surf wash", tone("sea", "lit"), roughness=0.96, coat=0.0)

    # The spent wash: what is left after a wave has broken, low and continuous,
    # so the broken crest above it still has a waterline to sit on.
    spent = []
    for i in range(15):
        dx = -3.40 + i * 0.49
        sx = 0.22 + 0.12 * ((i * 0.6180) % 1.0)
        x, y = turn(dx, 0.26)
        spent.append(((x, y, 0.035), (sx, 0.18, 0.028)))
    metablob("surf_wash", spent, wash, threshold=0.18)

    # Groups, with gaps between them the field cannot bridge. Hand-authored
    # rather than generated, because WHERE it breaks is the whole read.
    groups = (
        ((-3.36, 0.15, 0.028), (-3.10, 0.19, 0.038)),
        ((-2.50, 0.30, 0.150), (-2.12, 0.36, 0.230), (-1.74, 0.26, 0.120), (-1.46, 0.17, 0.055)),
        ((-0.86, 0.16, 0.032),),
        ((-0.26, 0.28, 0.130), (0.10, 0.34, 0.200), (0.44, 0.22, 0.085)),
        ((1.06, 0.17, 0.036), (1.32, 0.15, 0.028)),
        ((1.92, 0.26, 0.115), (2.26, 0.30, 0.165), (2.58, 0.20, 0.070)),
        ((3.18, 0.16, 0.030),),
    )
    for gi, group in enumerate(groups):
        lobes = []
        for dx, w, h in group:
            x, y = turn(dx, 0.0)
            lobes.append(((x, y, h * 0.62), (w, 0.15, h)))
        metablob(f"surf_crest_{gi}", lobes, foam, threshold=0.20)


BUILDERS = {
    "park/tree": (park_tree, 6.4, (0, 0, 2.15), {"displayWidth": 190, "anchor": "bottom"}),
    "park/bench": (park_bench, 4.7, (0, 0, 1.0), {"displayWidth": 136, "anchor": "bottom"}),
    "park/grass_tuft": (park_grass_tuft, 1.9, (0, 0, 0.32), {"displayWidth": 46, "anchor": "bottom"}),
    "park/grass_clump": (park_grass_clump, 3.6, (0, 0, 0.62), {"displayWidth": 130, "anchor": "bottom"}),
    "park/near_grass": (park_near_grass, 11.0, (0, 0, 0.55), {"displayWidth": 430, "anchor": "bottom"}),
    "beach/near_sand": (beach_near_sand, 11.0, (0, 0, 0.30), {"displayWidth": 430, "anchor": "bottom"}),
    "town/near_paving": (town_near_paving, 11.0, (0, 0, 0.20), {"displayWidth": 430, "anchor": "bottom"}),
    "home/near_floor": (home_near_floor, 11.0, (0, 0, 0.18), {"displayWidth": 430, "anchor": "bottom"}),
    "park/wildflowers": (park_wildflowers, 2.0, (0, 0, 0.38), {"displayWidth": 50, "anchor": "bottom"}),
    # Wide and shallow: it is a horizon, so the ortho box is sized to the run.
    "park/treeline": (park_treeline, 6.6, (0, 0, 0.42), {"displayWidth": 420, "anchor": "bottom"}),
    "park/hedge": (park_hedge, 4.4, (0, 0, 0.72), {"displayWidth": 154, "anchor": "bottom"}),
    "town/store_coral": (lambda: storefront("Coral", tone("roof", "base"), tone("roof", "shade"), tone("roof", "lit")), 6.6, (0, 0, 2.30), {"displayWidth": 176, "anchor": "bottom"}),
    "town/store_aqua": (lambda: storefront("Aqua", tone("sea", "base"), tone("sea", "shade"), tone("sea", "lit")), 6.6, (0, 0, 2.30), {"displayWidth": 190, "anchor": "bottom"}),
    # Violet measured the palest of the three storefronts (0.344 against the
    # coral's and aqua's 0.40) -- a warm key on a lilac washes it toward grey,
    # so the base carries more chroma than its neighbours need to.
    "town/store_violet": (lambda: storefront("Violet", tone("grape", "base"), tone("grape", "shade"), tone("grape", "lit")), 6.6, (0, 0, 2.30), {"displayWidth": 176, "anchor": "bottom"}),
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
    # The sky, at last. Wide and shallow like every other horizon band.
    "sky/cloud": (sky_cloud, 5.2, (0, 0, 0.56), {"displayWidth": 168, "anchor": "bottom"}),
    "sky/cloud_far": (sky_cloud_far, 3.6, (0, 0, 0.34), {"displayWidth": 96, "anchor": "bottom"}),
    "home/vista": (home_vista, 4.4, (0, 0, 0.52), {"displayWidth": 200, "anchor": "bottom"}),
    "beach/headland": (beach_headland, 6.6, (0, 0, 0.34), {"displayWidth": 420, "anchor": "bottom"}),
    "beach/surf": (beach_surf, 6.6, (0, 0, 0.16), {"displayWidth": 440, "anchor": "bottom"}),
    "beach/shells": (beach_shells, 1.7, (0, 0, 0.10), {"displayWidth": 58, "anchor": "bottom"}),
    "beach/dune_grass": (beach_dune_grass, 2.6, (0, 0, 0.46), {"displayWidth": 54, "anchor": "bottom"}),
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
    "item/collar_red": (collar("Red", tone("berry", "base"), tone("berry", "shade")), 1.6, (0, 0, 0.52), {"displayWidth": 48, "anchor": "center"}),
    "item/collar_blue": (collar("Blue", tone("sea", "shade"), tone("sea", "deep")), 1.6, (0, 0, 0.52), {"displayWidth": 48, "anchor": "center"}),
    "item/collar_green": (collar("Green", tone("foliage", "shade"), tone("foliage", "deep")), 1.6, (0, 0, 0.52), {"displayWidth": 48, "anchor": "center"}),
    "item/collar_gold": (collar("Gold", tone("sun", "base"), tone("sun", "shade")), 1.6, (0, 0, 0.52), {"displayWidth": 48, "anchor": "center"}),
}


def build_prop(path, builder, ortho_scale, target, render=True):
    """Build a prop, optionally render it, and return its measured form.

    The build always happens even when the render is skipped: it costs
    milliseconds, and it is what keeps the manifest's proportion block
    complete under `PROP_ONLY`. A manifest that forgets a prop is the exact
    bug the filter's own comment below is about.
    """
    clean_scene()
    setup_camera_and_lights(ortho_scale=ortho_scale, target=target)
    builder()
    if render:
        file_path = OUT / f"{path}.png"
        file_path.parent.mkdir(parents=True, exist_ok=True)
        scene = bpy.context.scene
        scene.render.filepath = str(file_path)
        bpy.ops.render.render(write_still=True)
        print(f"rendered {file_path}")
    return measure_form()


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
    # Comma-separated, because comparing a material change across several props
    # at once is the only way to judge one. It was a single prefix, and a list
    # matched NOTHING while still printing "rendered a subset" and exiting 0 --
    # which cost a whole measurement pass that was read off stale renders.
    # A filter that matches nothing is now an error, not a quiet success.
    only = [p for p in os.environ.get("PROP_ONLY", "").split(",") if p.strip()]
    only = [p.strip() for p in only]
    rendered = 0
    for path, (builder, scale, target, metadata) in BUILDERS.items():
        wanted = not only or any(path.startswith(prefix) for prefix in only)
        form = build_prop(path, builder, scale, target, render=wanted)
        rendered += 1 if wanted else 0
        entry = {"file": f"{path}.png", **metadata}
        if form:
            entry["form"] = form
        manifest["assets"][path] = entry
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    if only:
        if not rendered:
            raise SystemExit(
                f"PROP_ONLY={','.join(only)} matched no prop. "
                f"Known prefixes: {sorted({p.split('/')[0] for p in BUILDERS})}"
            )
        print(f"PROP_ONLY={','.join(only)}: rendered {rendered}; manifest still describes all")


if __name__ == "__main__":
    main()
