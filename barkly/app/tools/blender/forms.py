"""AUTHORED SILHOUETTES. The shape vocabulary this game did not have.

Operator, after a day of lighting passes that each helped and none fixed it:
*"all games are just coloured shapes, but we are handicapping ourselves out
of the gate, because no matter what we do our coloured shapes are not
working."* That is the correct diagnosis and it is a level below everything
else that has been tried.

Every organic mass in this world is `world_prop_pack.sphere` -- a UV sphere
scaled on three axes. A scaled sphere is an EGG. It is an egg after you
jitter it 7%, after you tilt it, after you band its shading, after you draw a
line round it. A tree canopy is seven eggs in a pile; a bush is five; the
beach's far shore is thirty-one in a row. No amount of light makes a pile of
eggs read as designed art, which is why every pass so far has moved the
needle a little and never enough.

What a designed shape has that a scaled sphere cannot:

  A FLAT CONTACT. A sphere touches the ground at a single tangent point, so
  it reads as resting on it at best and floating at worst. Things that sit
  somewhere have a base with area.

  A SHOULDER. A silhouette that changes its rate of curvature -- fast near
  the top, slow through the body -- is read as deliberate. An ellipse's
  curvature varies smoothly and symmetrically and reads as geometry.

  AN OVERHANG. A canopy wider than what holds it up casts a line under
  itself. That undercut is most of what makes a form look built rather than
  inflated.

  HARD MEETING SOFT. One object with both a crisp edge and a rounded body.
  Everything here was uniformly smooth, which is the other half of "plastic".

So a form is authored as a PROFILE -- a list of (radius, height) points read
bottom to top -- and revolved. The profile is the drawing. Squashing and
rotating still work, but they now modify a designed outline instead of
supplying one.
"""
from __future__ import annotations

import math
import zlib

import bpy
import bmesh


def _smooth(profile, per_span=5):
    """Catmull-Rom through the authored points, so the outline is a curve."""
    if len(profile) < 3:
        return list(profile)
    pts = [profile[0]] + list(profile) + [profile[-1]]
    out = []
    for i in range(len(pts) - 3):
        p0, p1, p2, p3 = pts[i:i + 4]
        for step in range(per_span):
            t = step / per_span
            t2, t3 = t * t, t * t * t
            out.append(tuple(
                0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2
                       + (-a + 3 * b - 3 * c + d) * t3)
                for a, b, c, d in zip(p0, p1, p2, p3)))
    out.append(profile[-1])
    # A radius must never go negative through an overshoot.
    return [(max(0.0, r), z) for r, z in out]


def lathe(name, profile, mat, loc=(0.0, 0.0, 0.0), segments=40, scale=(1.0, 1.0, 1.0),
          rotation=(0.0, 0.0, 0.0), lobes=0, lobe_depth=0.0, jitter=0.0,
          smooth_angle=72.0):
    """Revolve an authored profile into a solid.

    `profile` is [(radius, z), ...] bottom to top. A first radius above zero
    gives the flat contact; a last radius of zero closes to a point.

    `lobes` and `lobe_depth` push the radius in and out AROUND the axis, so
    the form is not a circle in plan either -- which is what separates a
    shrub from a turned bowl. `jitter` breaks the remaining regularity, keyed
    off the name so a rebuild is identical.
    """
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    seed = zlib.crc32(name.encode("utf-8"))

    def radius_at(base_r, i, theta):
        r = base_r
        if lobes and lobe_depth:
            r *= 1.0 + math.sin(theta * lobes + (seed % 628) / 100.0) * lobe_depth
        if jitter:
            # SMOOTH, not per-vertex. Hashing on (ring, angle) gave every
            # vertex its own radius, which is a microscopically bumpy surface:
            # each facet then creases against its neighbour, and Freestyle --
            # which draws borders and creases -- covered the whole form in
            # little dark hatch marks. It looked like the shape had been
            # scribbled on. Two slow sine terms at incommensurate frequencies
            # break the regularity without ever creasing, because they are
            # continuous.
            phase = (seed % 997) / 997.0 * math.tau
            r *= (1.0
                  + math.sin(theta * 3.0 + phase) * jitter
                  + math.sin(theta * 5.0 + phase * 2.3) * jitter * 0.6)
        return r

    # SMOOTH THE PROFILE FIRST. A profile is a handful of authored points and
    # revolving it literally gives a silhouette made of straight segments --
    # the first render came out visibly polygonal, which is a different way of
    # looking cheap from the one this module exists to fix. Catmull-Rom
    # through the authored points keeps them exactly where they were drawn and
    # curves between them, so the outline is a curve whose SHAPE is still
    # authored rather than an ellipse.
    profile = _smooth(profile)

    rings = []
    for i, (r, z) in enumerate(profile):
        if r <= 1e-6:
            rings.append([bm.verts.new((0.0, 0.0, z))])
            continue
        ring = []
        for s in range(segments):
            theta = s / segments * math.tau
            rr = radius_at(r, i, theta)
            ring.append(bm.verts.new((math.cos(theta) * rr, math.sin(theta) * rr, z)))
        rings.append(ring)

    for a, b in zip(rings, rings[1:]):
        if len(a) == 1 or len(b) == 1:
            tip, ring = (a[0], b) if len(a) == 1 else (b[0], a)
            for s in range(len(ring)):
                bm.faces.new((ring[s], ring[(s + 1) % len(ring)], tip))
            continue
        for s in range(len(a)):
            t = (s + 1) % len(a)
            bm.faces.new((a[s], a[t], b[t], b[s]))

    # Caps. The bottom one is the flat contact; without it the form is an open
    # shell and its underside shows through everything it stands on.
    for ring in (rings[0], rings[-1]):
        if len(ring) > 2:
            bm.faces.new(ring[::-1] if ring is rings[0] else ring)

    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = rotation
    obj.scale = scale
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.select_set(False)
    obj.data.materials.append(mat)

    # HARD MEETING SOFT, in one object: the body smooths, the flat base and
    # any crease sharper than the angle stays crisp. Uniform smoothing is the
    # other half of why everything read as plastic.
    #
    # 72 degrees, not 46. At 46 the lobe modulation itself counted as a
    # crease, so the sides of every form came out faceted AND outlined. The
    # only edge that should stay hard is where the body meets the flat base,
    # and that one is a right angle.
    for poly in mesh.polygons:
        poly.use_smooth = True
    if hasattr(mesh, "use_auto_smooth"):
        mesh.use_auto_smooth = True
        mesh.auto_smooth_angle = math.radians(smooth_angle)
    else:
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        try:
            bpy.ops.object.shade_smooth_by_angle(angle=math.radians(smooth_angle))
        except (AttributeError, RuntimeError):
            pass
        obj.select_set(False)
    return obj


#: A canopy: wide shoulders, an UNDERCUT at the bottom so it overhangs its
#: trunk, and a crown that closes fast rather than tapering to a cone. The
#: undercut is the whole difference between a canopy and a ball on a stick.
CANOPY = [(0.52, 0.00), (0.86, 0.14), (1.00, 0.40), (0.97, 0.62),
          (0.82, 0.80), (0.55, 0.93), (0.00, 1.00)]

#: A shrub: flat and wide at the ground, rising in one mass, slightly
#: overhanging its own base so it casts a line where it meets the grass.
#: 0.55 at the ground, not 0.72. At 0.72 the widest point sits barely above
#: the base and the form flares straight out of the grass -- it rendered as a
#: lampshade. A shrub's widest point is a third of the way up.
SHRUB = [(0.55, 0.00), (0.86, 0.18), (1.00, 0.40), (0.94, 0.62),
         (0.72, 0.80), (0.40, 0.94), (0.00, 1.00)]

#: A boulder or a dune: heavy, settled, flat where it meets the ground.
MOUND = [(1.00, 0.00), (0.98, 0.22), (0.88, 0.48), (0.66, 0.72),
         (0.36, 0.90), (0.00, 1.00)]
