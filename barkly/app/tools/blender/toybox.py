"""THE STYLE, as buildable parts. Read off the approved concept sheet.

Every previous pass in this project tuned a PARAMETER -- chroma, value, hue,
sun elevation, contour width. That is GRADING, and grading is what you do once
you have a style. Mario does not differ from GTA by palette. A style is a
handful of committed decisions about how form, surface, edge and light work,
applied to everything without exception.

So this file states the six decisions, and they are not invented: they are
measured off `assets/barkly/concept/barkly-concept.png`, the approved and
locked canon, which is the one piece of art in this project that works. Every
one of them is the OPPOSITE of what the world was built with, which is why
Barkly has never looked like he lives in his own game.

                     the canon (Barkly)          what the world did
  FORM      rounded rectangular masses     lathed/revolved organic blobs
  SURFACE   matte flocked velvet, fuzz     smooth plastic with a clearcoat
  SHADING   continuous, 49/64 value bins   banded to 3 steps, 12/64 bins
  EDGE      none at all                    a Freestyle contour on everything
  LIGHT     broad studio softbox, soft     a hard directional sun, raking
  DETAIL    a few applied parts            sculpted noise on every surface

FORM is the one that matters most and it is the one nobody named. Barkly's
head is a ROUNDED BOX. His muzzle is a rounded slab, his legs are rounded
rectangular columns, his body is a rounded box. There is not one revolved
surface on him. `forms.py` builds the world out of lathes -- profiles revolved
around an axis -- which is the other family of shapes entirely. A revolved
canopy next to a boxed dog reads as two different toys from two different
shelves no matter what colour either of them is.

Use `rounded(...)` for mass, `flock(...)` for surface, `studio(...)` for light.
"""
import math

import bpy

from palette import tone
import world_prop_pack as pack


# --- FORM ---------------------------------------------------------------
#
# 0.34 of the smallest dimension, and it is a big radius on purpose. The
# concept sheet's corners are soft enough to read as moulded rather than
# machined -- a 0.08 fillet is a chamfered box and looks like architecture.
# Anything below about 0.25 stops reading as a toy.
CORNER = 0.34

#: Bevel segments. Six is the point where the corner stops faceting under a
#: soft light; the canon has no visible facets anywhere on it.
CORNER_SEGMENTS = 6


def rounded(name, size, mat, loc=(0.0, 0.0, 0.0), rotation=(0.0, 0.0, 0.0),
            corner=CORNER, taper=1.0, flare=1.0):
    """A rounded rectangular mass -- the only primitive this style has.

    `size` is (x, y, z) full extents. `taper` scales the TOP face, which is how
    a trunk or a leg gets its draft angle without becoming a cone: a moulded
    part is drafted so it can leave the tool, and that slight taper is a large
    part of why an object reads as manufactured rather than drawn.
    """
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = tuple(s for s in size)
    obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    # `taper` narrows the TOP, `flare` widens the BOTTOM. Both are draft
    # angles on a moulded part, and both are also where a prop gets a stance:
    # a trunk that flares into the ground is gripping it, and a trunk that does
    # not is a dowel pushed into a hole.
    if taper != 1.0 or flare != 1.0:
        mesh = obj.data
        zs = [v.co.z for v in mesh.vertices]
        top, bottom = max(zs), min(zs)
        for v in mesh.vertices:
            if taper != 1.0 and abs(v.co.z - top) < 1e-5:
                v.co.x *= taper
                v.co.y *= taper
            if flare != 1.0 and abs(v.co.z - bottom) < 1e-5:
                v.co.x *= flare
                v.co.y *= flare

    radius = corner * min(size)
    bevel = obj.modifiers.new("corner", "BEVEL")
    bevel.width = radius
    bevel.segments = CORNER_SEGMENTS
    bevel.limit_method = "ANGLE"
    bevel.angle_limit = math.radians(30.0)
    bevel.harden_normals = False

    obj.data.materials.append(mat)
    # Smooth everything. A flocked surface has no hard edges left on it at all;
    # the bevel is what carries the corner, not a crease.
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


# --- SURFACE ------------------------------------------------------------
#
# Measured on the concept sheet: high-frequency amplitude 3.2/255 over a body
# panel. That is FLOCKING -- the fine velvet nap of a flocked vinyl figure --
# and it is what stops a big simple mass reading as bare CG plastic. It is an
# order of magnitude finer than the `noise_material` grain the world had, which
# was coarse enough to read as stucco.
FLOCK_SCALE = 340.0
FLOCK_DEPTH = 0.0044


def flock(name, colour, sheen=0.62, roughness=0.94):
    """Matte flocked velvet. The canon's surface, and the world had none of it.

    Roughness near 1.0 with real SHEEN is what velvet is: almost no specular
    lobe, but a bright rim where the nap catches light at a grazing angle. A
    clearcoat -- which every prop in this repo carried -- is the exact opposite
    material, and it is why the world read as injection-moulded ABS while the
    character reads as something you would want to hold.
    """
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*pack.rgb(colour), 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = 0.0
    for key, value in (("Sheen Weight", sheen), ("Sheen Roughness", 0.30),
                       ("Coat Weight", 0.0), ("Specular IOR Level", 0.18)):
        if key in bsdf.inputs:
            bsdf.inputs[key].default_value = value

    # The nap itself, as a very fine bump. Deliberately below the threshold
    # where you can see individual grains at render scale -- it should read as
    # softness, never as texture.
    tex = nt.nodes.new("ShaderNodeTexNoise")
    tex.inputs["Scale"].default_value = FLOCK_SCALE
    tex.inputs["Detail"].default_value = 2.0
    bump = nt.nodes.new("ShaderNodeBump")
    # Tuned against the canon, not by eye: high-frequency amplitude over an
    # opaque patch is 2.85/255 on Barkly's own render. The first cut of this
    # material measured 1.00 -- the nap was there in the node graph and
    # invisible in the picture, which is the same as not having it.
    bump.inputs["Strength"].default_value = FLOCK_DEPTH * 100.0
    nt.links.new(tex.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


# --- LIGHT --------------------------------------------------------------
#: EVERY OBJECT CARRIES A CHARCOAL NOTE. This is the rule that took longest to
#: see, because it does not look like a lighting rule and it is not one.
#:
#: 18% of Barkly sits below value 0.25, and almost none of that is shadow: it
#: is his NOSE, his COLLAR and his eyes -- charcoal PARTS, the third swatch on
#: the sheet, present as material rather than as darkness. That is why he holds
#: up under a soft light that has no deep shadow in it anywhere.
#:
#: Every attempt to get the world's darks from lighting failed the same way:
#: raise the key and the darks vanish, lower it and the whole thing goes muddy,
#: because a soft light cannot produce a deep shadow by definition. The first
#: three cuts of this tree measured 0.0%, 10.1% and 0.0% dark chasing exactly
#: that. A prop in this style gets its dark end the way the character does --
#: something on it is actually charcoal.
CHARCOAL_NOTE = "ink"

#: ...AND A CREAM NOTE, which is the same rule at the other end. 26% of Barkly
#: is above value 0.80 and that is not a highlight either -- it is his chest,
#: muzzle and paws, which are CREAM. The concept sheet's palette panel names
#: exactly three swatches and the character wears all three at once.
#:
#: So a prop in this style spans the sheet: a charcoal note, the object's own
#: colour, and a cream-end note. Two tones of one hue is what every prop in
#: this repo was, and it is why they photographed as flat next to him however
#: they were lit. This is a rule about MATERIAL assignment, not about light,
#: and it is the one a renderer cannot supply for you.
CREAM_NOTE = "cream"

#: AND THE RULE THAT MATTERS MORE THAN ALL SIX OF THE ABOVE.
#:
#: Operator, on seeing the first toy tree next to the flat outlined one it was
#: meant to replace: *"I like the one on the left more... not because I like
#: the realism of either one. It's because the one on the left has character
#: and personality. The one on the right doesn't."* He did not like the left
#: one's vibe either. He still preferred it, and he was right to.
#:
#: The concept sheet answers this too, and more directly than anything else on
#: it. Down its left edge is a BULLET LIST of eight named, deliberate
#: oddities -- rectangular head; long nose with a rounded square tip; stiff
#: bent ears that angle outward; tiny snaggletooth; striped knit-sock paws;
#: thick collar; ring-shaped tail curl; low-slung body. That list IS the
#: personality. Take those eight away and what is left is a well-rendered dog
#: shape that nobody would put on a shelf.
#:
#: The first toy tree had ZERO such decisions. It was three boxes, correctly
#: flocked, correctly lit, measuring within a few percent of the canon on every
#: axis I had thought to measure -- and dead, because none of those axes is
#: character. A flat outlined drawing with a lumpy canopy and a flared trunk
#: beat it, and should have.
#:
#: So: NO PROP GETS BUILT WITHOUT ITS OWN LIST FIRST. Three to five specific,
#: slightly odd, exaggerated decisions, written down before any geometry. Not
#: "a tree" -- a tree that does something. This is a process rule, it is the
#: one the renderer cannot supply, and it is the difference between an asset
#: and a character.
QUIRKS_PER_PROP = (3, 5)


def studio(target=(0.0, 0.0, 1.2), key_energy=2400.0):
    """One broad softbox and a bounce. No sun, no rim, no cast-shadow drama.

    The concept sheet has NO hard shadow anywhere in it. Its terminator runs
    over about a third of the form, which is a source many times the size of
    the subject -- a product softbox. The world was lit by a 1.1-degree sun,
    which is the sharpest light there is, and no amount of fill hides that a
    terminator is a hard line.
    """
    scene = bpy.context.scene
    scene.render.use_freestyle = False          # EDGE: none. See the header.
    scene.render.film_transparent = True
    scene.render.engine = "BLENDER_EEVEE"
    scene.eevee.use_gtao = True
    scene.eevee.gtao_distance = 2.6
    scene.eevee.gtao_factor = 1.0
    scene.eevee.taa_render_samples = 96
    scene.eevee.use_soft_shadows = True

    bpy.ops.object.light_add(type="AREA", location=(-3.2, -5.4, 5.0))
    key = bpy.context.object
    key.name = "Toy key softbox"
    key.data.size = 14.0
    key.data.energy = key_energy
    key.data.color = pack.rgb(tone("cream", "pop"))
    pack.look_at(key, target)

    bpy.ops.object.light_add(type="AREA", location=(4.6, -3.0, 2.2))
    fill = bpy.context.object
    fill.name = "Toy bounce"
    fill.data.size = 16.0
    fill.data.energy = key_energy * 0.055
    fill.data.color = pack.rgb(tone("sand", "lit"))
    pack.look_at(fill, target)

    world = bpy.data.worlds.new("Toy stage") if not scene.world else scene.world
    scene.world = world
    world.use_nodes = False
    # 0.16, not 0.55. Measured against the canon: Barkly spans value 0.00 to
    # 0.99 with a spread of 0.264 -- 18% of him is below 0.25 AND 26% is above
    # 0.80. The first cut of this rig produced 0.43 to 0.88, spread 0.082: a
    # soft light is not the same thing as a FLAT one, and an ambient this
    # bright fills the shadow side back in until the form has no dark end at
    # all. The softbox stays huge (that is what keeps the terminator gentle);
    # what comes down is everything that was lifting the shadows.
    world.color = tuple(c * 0.10 for c in pack.rgb(tone("cream", "lit")))
    return key
