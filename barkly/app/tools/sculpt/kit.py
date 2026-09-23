"""THE PARK KIT: every object the park plate stands up, sculpted.

`world_scene_pack.py` composes the park from builders. The first set built
each thing out of Blender primitives -- lathes, spheres, bevelled cubes -- and
the operator's verdict on the result was the art style itself, not any one
prop. This kit is the other construction: each object is a seeded signed-
distance field (`sdf.py`), meshed once, painted by which way each part faces,
and imported by the scene as a coloured mesh. The scene still decides WHERE
things go; this decides what they ARE.

Every object is built at the origin, standing on z = 0, front toward -y (the
camera side), in the scene's world units -- so a kit tree at scale 1 is the
same size as the primitive tree it replaces.

    python3 tools/sculpt/kit.py [--out DIR] [--only NAME]

Writes DIR/<name>.ply and DIR/kit.json. `kit.json` carries a hash of the
source that made it, and the scene pack rebuilds the kit when that hash is
stale, so a changed rule can never render against yesterday's meshes.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "blender"))
import sdf  # noqa: E402
import tree  # noqa: E402
from palette import tone  # noqa: E402  (pure Python; no bpy)

ROOT = HERE.parent.parent
OUT = ROOT / "art-review" / "sculpt" / "kit"

#: Everything whose change must re-sculpt the kit.
SOURCES = [HERE / "sdf.py", HERE / "kit.py", HERE / "tree.py"]


def source_hash() -> str:
    """The code that sculpts, plus the palette's COLOURS -- not palette.py's
    bytes. The kit paints with tones; it does not care how the scene is lit,
    and hashing the whole file made every light tweak a 7-minute re-sculpt."""
    import palette
    h = hashlib.sha256()
    for p in SOURCES:
        h.update(p.read_bytes())
    h.update(json.dumps({f: [tone(f, s) for s in palette.STEPS] for f in palette.FAMILIES}).encode())
    return h.hexdigest()[:16]


# ------------------------------------------------------------------ paint

def _loud(h, f):
    return tree.saturate(h, f)


def ramp(family, steps=("deep", "shade", "base"), sat=(0.95, 1.0, 0.92)):
    """(under, mid, top) for the airbrush.

    It stops at BASE on purpose. On a lit sculpt the key light already lifts
    the top about 1.5x; painting the palette's `lit` step as well counts the
    highlight twice and renders mint (measured on the tree: sat 0.20 / val 0.80
    painted to `lit`, 0.45 / 0.68 painted to `base`, Barkly 0.41 / 0.74).
    Pale families (cream, sand) pass a brighter `steps` so they stay pale.

    NO SATURATION BOOST by default, and that is measured too. The studio
    preview wanted +40% to match Barkly; the park's warm sun adds its own, and
    with both the plate's foliage measured sat 0.65 -- lime -- against the
    canon's 0.41. The kit ships in the scene, so it is tuned in the scene.
    """
    return [_loud(tone(family, s), f) for s, f in zip(steps, sat)]


# Pale families stop at BASE too. They were ("shade", "base", "lit") -- the
# same double-counted highlight the foliage had -- and under the beach's
# stronger sun the castle, driftwood and rocks rendered nearly white.
PALE = ("shade", "base", "base")


def warm_under(r, into="bark", step="deep", f=0.5):
    """Pull a ramp's UNDER colour toward a warm dark.

    The concept sheet's darkest 15% is 98.4% warm; the first sculpted park's
    was 28.8%, because its darks were canopy undersides in shade -- green. The
    primitive plate only passed on this because its warm darks were the ink
    lines. A factory airbrush darkens a toy's underside with a warm brown, not
    a darker green, and that is what this does.
    """
    w = tree.hexrgb(tone(into, step))
    return [tuple(round(a * (1 - f) + b * f) for a, b in zip(r[0], w)), r[1], r[2]]

# Paint ids. BARK and LEAF are tree.py's own -- the first cut numbered them
# here independently, the other way round, and every tree in the park
# rendered with a brown canopy on a green trunk.
BARK, LEAF = tree.BARK, tree.LEAF
WOOD, IRON, CREAM, ROOF, TRIM, STONE, SAND, GOLD, GRASS, SOIL = range(2, 12)
PAINT = {
    LEAF: warm_under(ramp("foliage")),
    BARK: ramp("bark", ("deep", "deep", "shade"), (1.0, 1.0, 1.0)),
    WOOD: ramp("wood", ("shade", "base", "base"), (0.95, 0.95, 0.9)),
    IRON: ramp("metal", ("deep", "deep", "shade"), (1.0, 1.0, 1.0)),
    CREAM: ramp("cream", PALE, (1.0, 1.0, 1.0)),
    ROOF: ramp("roof", ("shade", "base", "base"), (1.05, 1.1, 1.05)),
    TRIM: ramp("sea", ("shade", "base", "base"), (1.05, 1.1, 1.05)),
    STONE: ramp("stone", PALE, (1.0, 1.0, 1.0)),
    # A step darker than the other pale families: with a low sun the VERTICAL
    # faces of a castle or a rock catch far more light than the flat sand they
    # stand on, and at PALE they rendered nearly white on the beach.
    SAND: ramp("sand", ("deep", "shade", "base"), (1.0, 1.05, 1.0)),
    GOLD: ramp("sun", ("base", "lit", "lit"), (1.1, 1.1, 1.0)),
    GRASS: warm_under(ramp("grass")),
    SOIL: ramp("bark", ("deep", "shade", "shade"), (1.0, 1.05, 1.05)),
}
# The beach's colours. Stripes need a loud colour and a quiet one side by
# side, so the pale partner is cream `pop`, not `base`.
CORAL, BERRY, YELLOW, AQUA, SEA, GLASS, STRIPE, BLEACH, MARRAM, HEADLAND, ROCK = range(30, 41)
PAINT.update({
    CORAL: ramp("roof", ("shade", "base", "base"), (1.05, 1.1, 1.05)),
    BERRY: ramp("berry", ("shade", "base", "base"), (1.0, 1.0, 1.0)),
    YELLOW: ramp("sun", ("base", "lit", "lit"), (1.0, 1.0, 0.95)),
    AQUA: ramp("sea", ("base", "lit", "lit"), (1.05, 1.1, 1.05)),
    SEA: ramp("sea", ("shade", "base", "base"), (1.05, 1.1, 1.05)),
    GLASS: ramp("sea", ("lit", "pop", "pop"), (1.0, 1.0, 1.0)),
    STRIPE: ramp("cream", ("base", "base", "lit"), (1.0, 1.0, 1.0)),
    BLEACH: ramp("cream", ("deep", "shade", "base"), (1.0, 1.0, 1.0)),
    ROCK: ramp("stone", ("deep", "shade", "base"), (1.0, 1.0, 1.0)),
    MARRAM: warm_under(ramp("grass", ("shade", "base", "lit"), (0.9, 0.95, 0.9))),
    # Distant land is nearly one colour; the stone's shade step, lit.
    HEADLAND: ramp("stone", ("deep", "shade", "shade"), (1.0, 1.0, 1.0)),
})

#: Flower heads take their colour from the bed, so they get ids above the rest.
PETALS = {"berry": 20, "sun": 21, "cream": 22, "grape": 23}
for fam, pid in PETALS.items():
    PAINT[pid] = ramp(fam, ("base", "lit", "lit"), (1.2, 1.15, 1.1)) if fam != "cream" else ramp("cream", ("base", "lit", "pop"), (1, 1, 1))


def paint_mesh(verts, normals, paint):
    out = np.zeros((len(verts), 3))
    for pid, rp in PAINT.items():
        sel = paint == pid
        if sel.any():
            out[sel] = sdf.airbrush(normals[sel], verts[sel], rp)
    return out.astype(np.uint8)


# ------------------------------------------------------------------ the objects

def park_tree(seed):
    """The tree from `tree.py`, sat on the lawn."""
    return sdf.sit(tree.grow(seed), k=0.05)


def bush(seed):
    """A shrub: a squat core with lobes that STAND PROUD of it and differ in
    size, lower and wider at the skirt. The first cut melted seven overlapping
    lobes at k 0.16 and rendered a smooth potato -- the scallops are the
    character, so each lobe sits mostly OUTSIDE the core and the blend radius
    only fillets the seams."""
    rng = np.random.default_rng(seed)
    core = sdf.place(sdf.ellipsoid((1.05, 0.85, 0.62), paint=LEAF), at=(0, 0.05, 0.45))
    lobes = []
    for ang, z, r in ((3.1, 0.40, 0.62), (2.3, 0.78, 0.56), (1.55, 1.02, 0.58),
                      (0.8, 0.80, 0.52), (0.05, 0.42, 0.60), (-1.6, 0.55, 0.50), (-0.9, 0.35, 0.46)):
        ang += rng.uniform(-0.15, 0.15)
        rr = r * (1.0 + rng.uniform(-0.1, 0.1))
        lobes.append(sdf.place(sdf.ellipsoid((rr, rr * 0.9, rr * 0.82), paint=LEAF),
                               at=(0.78 * math.cos(ang), 0.45 * math.sin(ang) - 0.05, z)))
    return sdf.sit(sdf.warp(sdf.smooth_union(core, *lobes, k=0.09), amount=0.04, freq=1.6, seed=seed))


def hedge(seed):
    """Nine units of clipped hedge: a continuous body with a lumpy top, so it
    reads as one planted row rather than a line of balls."""
    rng = np.random.default_rng(seed)
    # Taller than the primitive row (1.3 -> 1.7): at plate distance the first
    # cut read as a green kerb, not a hedge.
    core = sdf.place(sdf.round_box((4.3, 0.60, 0.62), 0.40, paint=LEAF), at=(0, 0, 0.62))
    lumps = []
    for i in range(10):
        x = -4.05 + i * 0.9 + rng.uniform(-0.12, 0.12)
        h = 1.35 + rng.uniform(0, 0.40)
        lumps.append(sdf.place(sdf.ellipsoid((0.62, 0.62, 0.46), paint=LEAF), at=(x, rng.uniform(-0.08, 0.08), h - 0.38)))
    return sdf.sit(sdf.warp(sdf.smooth_union(core, *lumps, k=0.14), amount=0.05, freq=1.4, seed=seed))


def bench(seed=0):
    """Plank on stubby legs, the same proportions as park/bench -- but a toy's
    bench: every edge rolled, the slats swollen, the legs fat."""
    seat = sdf.place(sdf.round_box((1.62, 0.58, 0.19), 0.12, paint=WOOD), at=(0, -0.06, 0.86))
    slats = [sdf.place(sdf.round_box((1.52, 0.18, 0.21), 0.12, paint=WOOD), at=(0, 0.40, z)) for z in (1.28, 1.72)]
    legs = [sdf.capsule((sx, 0.10, 0.0), (sx, 0.10, 0.78), 0.20, 0.16, paint=IRON) for sx in (-1.22, 1.22)]
    backs = [sdf.capsule((sx, 0.30, 0.9), (sx, 0.44, 1.86), 0.10, 0.09, paint=IRON) for sx in (-1.18, 1.18)]
    return sdf.sit(sdf.smooth_union(seat, *slats, *legs, *backs, k=0.06), k=0.03)


def bandstand(seed=0):
    """The park's landmark, as a toy: a fat plinth, six swollen posts that
    visibly CARRY a rolled ring, and a roof with a scalloped eave -- the
    playset detail the primitive version could not make, because a scallop is
    a blend, not a part."""
    parts = [sdf.cylinder(3.34, 0.22, 0.08, paint=STONE),
             sdf.place(sdf.cylinder(3.05, 0.62, 0.14, paint=SAND), at=(0, 0, 0.0))]
    # Three steps on the camera side.
    for i, (w, z) in enumerate(((1.55, 0.50), (1.75, 0.34), (1.95, 0.18))):
        parts.append(sdf.place(sdf.round_box((w, 0.34, z / 2 + 0.05), 0.06, paint=STONE), at=(0, -(2.95 + i * 0.52), z / 2)))
    ring_r = 2.42
    for i in range(6):
        a = i / 6.0 * math.tau + 0.26
        px, py = math.cos(a) * ring_r, math.sin(a) * ring_r
        parts.append(sdf.capsule((px, py, 0.62), (px, py, 3.30), 0.27, 0.23, paint=CREAM))
        parts.append(sdf.place(sdf.ellipsoid((0.38, 0.38, 0.18), paint=CREAM), at=(px, py, 0.74)))
        parts.append(sdf.place(sdf.ellipsoid((0.40, 0.40, 0.16), paint=CREAM), at=(px, py, 3.20)))
    # Balustrade: a panel and a rail along each chord between posts.
    step = math.tau / 6.0
    for i in range(6):
        a0 = i * step + 0.26
        mid = a0 + step / 2
        r = ring_r * math.cos(step / 2)
        half = ring_r * math.sin(step / 2)
        mx, my = math.cos(mid) * r, math.sin(mid) * r
        if -math.sin(mid) > 0.8:   # the chord facing the steps is the way in
            continue
        rot = [("z", mid + math.pi / 2)]
        parts.append(sdf.place(sdf.round_box((half * 0.86, 0.08, 0.40), 0.06, paint=TRIM), at=(mx, my, 1.06), rot=rot))
        parts.append(sdf.place(sdf.round_box((half * 0.96, 0.12, 0.10), 0.09, paint=CREAM), at=(mx, my, 1.58), rot=rot))
    parts.append(sdf.place(sdf.torus(2.62, 0.20, paint=TRIM), at=(0, 0, 3.42)))
    # The roof: a rounded cone, a rolled lip, and scallops hanging off it.
    roof = sdf.smooth_union(
        sdf.place(sdf.cone(3.02, 0.30, 1.95, paint=ROOF), at=(0, 0, 3.52)),
        sdf.place(sdf.torus(2.96, 0.20, paint=ROOF), at=(0, 0, 3.66)),
        *[sdf.place(sdf.ellipsoid((0.46, 0.30, 0.30), paint=ROOF),
                    at=(math.cos(t) * 2.98, math.sin(t) * 2.98, 3.44), rot=[("z", t + math.pi / 2)])
          for t in np.linspace(0, math.tau, 16, endpoint=False)],
        k=0.10)
    finial = sdf.place(sdf.ellipsoid((0.24, 0.24, 0.32), paint=GOLD), at=(0, 0, 5.68))
    body = sdf.smooth_union(*parts, k=0.07)
    return sdf.sit(sdf.union(body, sdf.smooth_union(roof, finial, k=0.12)), k=0.03)


def flowers(seed, petal="berry"):
    """A small bed: a leafy mound with a handful of round flower heads, each a
    ring of fat petals round a gold eye."""
    rng = np.random.default_rng(seed)
    pid = PETALS[petal]
    parts = [sdf.place(sdf.ellipsoid((0.95, 0.75, 0.34), paint=GRASS), at=(0, 0, 0.02))]
    heads = []
    for i in range(7):
        a = i * 2.39996 + rng.uniform(-0.2, 0.2)
        r = 0.18 + 0.52 * math.sqrt(i / 7)
        cx, cy, cz = math.cos(a) * r, math.sin(a) * r * 0.8, 0.40 + rng.uniform(0.0, 0.22)
        for k in range(5):
            t = k / 5 * math.tau + rng.uniform(0, 0.4)
            heads.append(sdf.place(sdf.ellipsoid((0.10, 0.10, 0.06), paint=pid), at=(cx + 0.10 * math.cos(t), cy + 0.10 * math.sin(t), cz)))
        heads.append(sdf.place(sdf.ellipsoid((0.07, 0.07, 0.06), paint=GOLD), at=(cx, cy, cz + 0.03)))
    bed = sdf.smooth_union(*parts, k=0.1)
    return sdf.sit(sdf.union(bed, sdf.smooth_union(*heads, k=0.035)), k=0.02)


def tuft(seed):
    """Seven blades from one root, splayed and tapering to a soft point. The
    first cut was five upright capsules of near-constant width and read as a
    hand of green fingers."""
    rng = np.random.default_rng(seed)
    blades = []
    for i in range(7):
        a = i / 7 * math.tau + rng.uniform(-0.3, 0.3)
        lean = 0.38 + rng.uniform(0, 0.30)
        h = 0.40 + rng.uniform(0, 0.28)
        tip = (math.sin(lean) * h * math.cos(a), math.sin(lean) * h * math.sin(a), math.cos(lean) * h)
        blades.append(sdf.capsule((0, 0, 0), tip, 0.07, 0.014, paint=GRASS))
    return sdf.sit(sdf.smooth_union(*blades, k=0.06), k=0.02)



# ------------------------------------------------------------------ the beach

def _sectors(paints, n, axis_tilt=0.0, centre=(0, 0, 0)):
    """Paint by angle around a (tilted) vertical axis: umbrella panels, ball
    gores. Only surfaces already painted STRIPE-able (the id passed as
    `paints[0]`'s owner) are recoloured by the caller's `repaint`."""
    c = np.asarray(centre, float)
    ct, st = math.cos(axis_tilt), math.sin(axis_tilt)

    def choose(p, m):
        q = p - c
        x = q[:, 0]
        y = q[:, 1] * ct - q[:, 2] * st
        k = (np.floor((np.arctan2(y, x) + math.pi) / (2 * math.pi) * n).astype(int)) % n
        return np.asarray(paints)[k % len(paints)]
    return choose


def palm(seed):
    """A toy palm: a leaning, SEGMENTED trunk -- the rings are the playset
    detail -- a crown with two coconuts, and seven drooping fronds with
    scalloped edges."""
    rng = np.random.default_rng(seed)

    def arc(t):
        return -0.10 + 0.72 * t * t, 0.22 + t * 3.42

    trunk = []
    for i in range(9):
        t0, t1 = i / 9, (i + 1) / 9
        (x0, z0), (x1, z1) = arc(t0), arc(t1)
        trunk.append(sdf.capsule((x0, 0, z0 - (0.22 if i == 0 else 0)), (x1, 0, z1), 0.36 - 0.20 * t0, 0.34 - 0.20 * t1, paint=BARK))
        # A ring bulge per segment: a palm trunk reads by its rings.
        trunk.append(sdf.place(sdf.ellipsoid((0.40 - 0.20 * t1, 0.40 - 0.20 * t1, 0.08), paint=WOOD),
                               at=(x1, 0, z1 - 0.02), rot=[("y", math.atan2(1.44 * t1, 3.42))]))
    cx, cz = arc(1.0)
    crown = (cx + 0.06, 0.0, cz + 0.12)
    parts = [sdf.smooth_union(*trunk, k=0.05),
             sdf.place(sdf.ellipsoid((0.32, 0.30, 0.26), paint=BARK), at=crown)]
    nuts = [sdf.place(sdf.ellipsoid((0.17, 0.16, 0.16), paint=BARK), at=(crown[0] + dx, -0.22, crown[2] + dz))
            for dx, dz in ((-0.24, -0.26), (0.22, -0.30))]
    fronds = []
    for i in range(7):
        az = i / 7 * math.tau + rng.uniform(-0.2, 0.2)
        reach = 1.9 + rng.uniform(-0.2, 0.25)
        d = np.array([math.cos(az), math.sin(az) * 0.8])
        prev = None
        for k in range(7):
            t = (k + 0.5) / 7
            px = crown[0] + d[0] * reach * t
            py = crown[1] + d[1] * reach * t
            pz = crown[2] + 0.55 * t - 1.35 * t * t
            w = 0.30 * (1 - t) + 0.07
            pitch = math.atan2(0.55 - 2.7 * t, reach)
            seg = sdf.place(sdf.ellipsoid((reach / 7 * 0.75, w, w * 0.30), paint=LEAF), at=(px, py, pz),
                            rot=[("y", -pitch), ("z", az)])
            fronds.append(seg)
            # the scalloped edge: a leaflet either side
            for side in (-1, 1):
                ox, oy = -math.sin(az) * w * 0.9 * side, math.cos(az) * w * 0.9 * side
                fronds.append(sdf.place(sdf.ellipsoid((w * 0.55, w * 0.45, w * 0.20), paint=LEAF),
                                        at=(px + ox, py + oy, pz - 0.04), rot=[("z", az + side * 0.6)]))
    crown_leaf = sdf.smooth_union(*fronds, k=0.06)
    return sdf.sit(sdf.union(sdf.smooth_union(*parts, *nuts, k=0.08), crown_leaf), k=0.03)


def umbrella(seed=0):
    """A striped beach umbrella: tapered pole in a little heap of sand, a
    domed canopy with a SCALLOPED hem, panels alternating coral and cream, a
    yellow cap."""
    heap = sdf.place(sdf.ellipsoid((0.46, 0.36, 0.18), paint=SAND), at=(0, 0.06, 0.06))
    pole = sdf.capsule((0, 0.08, 0.0), (0, 0.0, 3.5), 0.12, 0.08, paint=WOOD)
    canopy = sdf.smooth_union(
        sdf.place(sdf.cone(1.66, 0.22, 0.92, paint=CORAL), at=(0, 0, 2.98)),
        sdf.place(sdf.ellipsoid((1.50, 1.50, 0.46), paint=CORAL), at=(0, 0, 3.10)),
        sdf.place(sdf.torus(1.52, 0.12, paint=CORAL), at=(0, 0, 3.00)),
        *[sdf.place(sdf.ellipsoid((0.40, 0.26, 0.16), paint=CORAL),
                    at=(1.56 * math.cos(t), 1.56 * math.sin(t), 2.94), rot=[("z", t + math.pi / 2)])
          for t in (np.arange(8) + 0.5) / 8 * math.tau],
        k=0.10)
    canopy = sdf.repaint(canopy, _sectors([CORAL, STRIPE], 8))
    cap = sdf.place(sdf.ellipsoid((0.20, 0.20, 0.22), paint=YELLOW), at=(0, 0, 3.98))
    return sdf.sit(sdf.union(sdf.smooth_union(heap, pole, k=0.08), sdf.smooth_union(canopy, cap, k=0.06)), k=0.03)


def lifeguard(seed=0):
    """The lifeguard tower: splayed stilts, a deck, a coral hut with a framed
    window and a cream rescue cross, an aqua roof with a scalloped front edge,
    and a ladder."""
    parts = []
    for x in (-1.02, 1.02):
        lean = -0.17 if x < 0 else 0.17
        parts.append(sdf.capsule((x + lean, 0.18, 0.0), (x - lean * 0.2, 0.18, 1.90), 0.22, 0.18, paint=WOOD))
    parts.append(sdf.place(sdf.round_box((1.52, 0.86, 0.20), 0.14, paint=WOOD), at=(0, 0.05, 1.94)))
    hut = sdf.place(sdf.round_box((1.20, 0.65, 0.86), 0.22, paint=BERRY), at=(0, 0.18, 2.90))
    frame = sdf.place(sdf.round_box((0.74, 0.08, 0.48), 0.07, paint=STRIPE), at=(0, -0.48, 3.04))
    glass = sdf.place(sdf.round_box((0.60, 0.06, 0.36), 0.06, paint=GLASS), at=(0, -0.53, 3.04))
    cross = sdf.union(sdf.place(sdf.round_box((0.20, 0.05, 0.07), 0.035, paint=STRIPE), at=(0.86, -0.48, 2.70)),
                      sdf.place(sdf.round_box((0.07, 0.05, 0.20), 0.035, paint=STRIPE), at=(0.86, -0.48, 2.70)))
    roof = sdf.smooth_union(
        sdf.place(sdf.round_box((1.74, 1.02, 0.22), 0.18, paint=AQUA), at=(0, 0.18, 3.86), rot=[("y", math.radians(-5))]),
        *[sdf.place(sdf.ellipsoid((0.22, 0.14, 0.14), paint=AQUA), at=(-1.50 + i * 0.5, -0.84, 3.66)) for i in range(7)],
        k=0.06)
    ladder = [sdf.capsule((x, -0.60, 0.0), (x, -0.46, 1.86), 0.07, 0.06, paint=WOOD) for x in (-0.43, 0.43)]
    ladder += [sdf.capsule((-0.43, -0.60 + z * 0.075, z), (0.43, -0.60 + z * 0.075, z), 0.055, 0.055, paint=WOOD)
               for z in (0.32, 0.70, 1.08, 1.46)]
    body = sdf.smooth_union(*parts, k=0.08)
    front = sdf.union(sdf.smooth_union(hut, frame, k=0.03), glass, cross)
    return sdf.sit(sdf.union(body, front, roof, sdf.union(*ladder)), k=0.03)


def castle(seed=0):
    """A sandcastle: a squat base, three bucket-shaped towers (the middle one
    taller) with crenellated tops, an arched doorway pressed in, and a berry
    flag."""
    base = sdf.place(sdf.round_box((1.30, 0.68, 0.42), 0.16, paint=SAND), at=(0, 0.08, 0.42))
    towers = []
    for i, x in enumerate((-0.86, 0.0, 0.86)):
        r, h = (0.58, 2.02) if i == 1 else (0.50, 1.62)
        t = sdf.place(sdf.cone(r, r * 0.74, h, paint=SAND), at=(x, -0.02, 0.0))
        # crenellations: notches cut around the rim
        notches = [sdf.place(sdf.round_box((0.09, 0.30, 0.12), 0.03), at=(x + math.cos(a) * r * 0.74, -0.02 + math.sin(a) * r * 0.74, h),
                             rot=[("z", a)]) for a in np.arange(6) / 6 * math.tau]
        for n in notches:
            t = sdf.smooth_subtract(t, n, k=0.03)
        towers.append(t)
    door = sdf.place(sdf.ellipsoid((0.24, 0.30, 0.36), paint=SAND), at=(0, -0.72, 0.22))
    body = sdf.smooth_subtract(sdf.smooth_union(base, *towers, k=0.10), door, k=0.05)
    pole = sdf.capsule((0, -0.02, 1.9), (0, -0.02, 3.05), 0.035, 0.03, paint=STRIPE)
    flag = sdf.warp(sdf.place(sdf.round_box((0.30, 0.03, 0.17), 0.025, paint=BERRY), at=(0.30, -0.02, 2.88)), amount=0.04, freq=4.0, seed=3)
    return sdf.sit(sdf.union(body, pole, flag), k=0.03)


def bucket(seed=0):
    """A sand bucket: wider at the rim, hollow, a rolled lip, an aqua handle."""
    outer = sdf.cone(0.36, 0.47, 0.84, paint=YELLOW)
    inner = sdf.place(sdf.cone(0.29, 0.40, 0.84), at=(0, 0, 0.10))
    lip = sdf.place(sdf.torus(0.46, 0.05, paint=YELLOW), at=(0, 0, 0.84))
    handle = sdf.place(sdf.torus(0.44, 0.04, paint=SEA), at=(0, 0, 0.84), rot=[("x", math.pi / 2)])
    # Keep only the arch: cut away everything BELOW the rim (a half-space
    # field is negative inside the region it removes).
    handle = sdf.smooth_subtract(handle, lambda p: (p[:, 2] - 0.84, np.zeros(len(p), int)), k=0.02)
    return sdf.sit(sdf.union(sdf.smooth_union(sdf.smooth_subtract(outer, inner, k=0.03), lip, k=0.03), handle), k=0.02)


def beachball(seed=0):
    """Six gores round a tilted axis -- berry, cream, sea -- with a cream cap."""
    ball = sdf.place(sdf.ellipsoid((0.52, 0.52, 0.50), paint=BERRY), at=(0, 0, 0.50))
    ball = sdf.repaint(ball, _sectors([BERRY, STRIPE, SEA, STRIPE, YELLOW, STRIPE], 6, axis_tilt=0.45, centre=(0, 0, 0.50)))
    cap = sdf.place(sdf.ellipsoid((0.12, 0.12, 0.05), paint=STRIPE),
                    at=(0, -0.50 * math.sin(0.45), 0.50 + 0.50 * math.cos(0.45)), rot=[("x", 0.45)])
    return sdf.sit(sdf.union(ball, cap), k=0.02)


def starfish(seed):
    """Five puffy arms, tips curled up a little, one body."""
    rng = np.random.default_rng(seed)
    arms = [sdf.place(sdf.ellipsoid((0.22, 0.22, 0.10), paint=CORAL), at=(0, 0, 0.06))]
    for i in range(5):
        a = i / 5 * math.tau + rng.uniform(-0.12, 0.12)
        L = 0.58 + rng.uniform(-0.05, 0.05)
        arms.append(sdf.capsule((0, 0, 0.07), (L * math.cos(a), L * math.sin(a), 0.12), 0.14, 0.05, paint=CORAL))
    return sdf.sit(sdf.squash(sdf.smooth_union(*arms, k=0.08), (1, 1, 0.7)), k=0.02)


def driftwood(seed):
    """A bleached branch lying on the sand, bent, with one stub arm."""
    rng = np.random.default_rng(seed)
    pts = [(-1.05 + i * 0.35, 0.10 * math.sin(i * 1.3 + seed), 0.16 + 0.03 * math.sin(i)) for i in range(7)]
    segs = [sdf.capsule(pts[i], pts[i + 1], 0.17 - i * 0.012, 0.16 - i * 0.012, paint=BLEACH) for i in range(6)]
    arm = sdf.capsule(pts[3], (pts[3][0] + 0.45, pts[3][1] + 0.45, 0.42 + rng.uniform(0, 0.1)), 0.08, 0.05, paint=BLEACH)
    return sdf.sit(sdf.warp(sdf.smooth_union(*segs, arm, k=0.08), amount=0.03, freq=2.0, seed=seed), k=0.03)


def rocks(seed):
    """Three rounded stones of different sizes, leaning together."""
    rng = np.random.default_rng(seed)
    stones = [sdf.place(sdf.ellipsoid((r * (1 + rng.uniform(-0.1, 0.1)), r * 0.82, r * 0.70), paint=ROCK),
                        at=(dx, dy, r * 0.45), rot=[("z", rng.uniform(0, 3))])
              for dx, dy, r in ((0.0, 0.0, 0.62), (-0.72, 0.22, 0.42), (0.64, -0.18, 0.34))]
    return sdf.sit(sdf.warp(sdf.smooth_union(*stones, k=0.06), amount=0.05, freq=1.8, seed=seed))


def pebble(seed):
    rng = np.random.default_rng(seed)
    return sdf.sit(sdf.warp(sdf.place(sdf.ellipsoid((0.30, 0.22, 0.12), paint=ROCK), at=(0, 0, 0.06),
                                      rot=[("z", rng.uniform(0, 3))]), amount=0.03, freq=3.0, seed=seed), k=0.02)


def shell(seed=0):
    """A scallop, read from its silhouette: a fan of lobes from the hinge."""
    lobes = []
    for i in range(7):
        a = math.radians(-55 + i * 110 / 6)
        lobes.append(sdf.place(sdf.ellipsoid((0.16, 0.13, 0.075), paint=STRIPE if i % 2 else BLEACH),
                               at=(-0.26 + 0.36 * math.cos(a), 0.06 + 0.36 * math.sin(a) * 0.55, 0.08)))
    body = sdf.place(sdf.ellipsoid((0.24, 0.17, 0.08), paint=STRIPE), at=(-0.09, 0.06, 0.08))
    stone = sdf.place(sdf.ellipsoid((0.12, 0.10, 0.06), paint=STONE), at=(0.34, -0.20, 0.05))
    return sdf.sit(sdf.union(sdf.smooth_union(body, *lobes, k=0.03), stone), k=0.02)


def marram(seed):
    """Dune grass: fewer, taller, paler blades than the park's tufts."""
    rng = np.random.default_rng(seed)
    blades = []
    for i in range(6):
        a = i / 6 * math.tau + rng.uniform(-0.4, 0.4)
        lean = 0.30 + rng.uniform(0, 0.35)
        h = 0.60 + rng.uniform(0, 0.40)
        tip = (math.sin(lean) * h * math.cos(a), math.sin(lean) * h * math.sin(a), math.cos(lean) * h)
        blades.append(sdf.capsule((0, 0, 0), tip, 0.055, 0.010, paint=MARRAM))
    return sdf.sit(sdf.smooth_union(*blades, k=0.05), k=0.02)


def windbreak(seed=0):
    """A striped windbreak: six cloth panels between two poles, folded in a
    gentle zigzag the way cloth hangs."""
    span = 3.4
    panels = []
    for i in range(6):
        px = -span / 2 + (i + 0.5) * span / 6
        panels.append(sdf.place(sdf.round_box((span / 12 + 0.02, 0.05, 0.60), 0.04, paint=(BERRY, STRIPE, SEA)[i % 3]),
                                at=(px, 0.07 * (1 if i % 2 else -1), 0.66), rot=[("z", 0.12 * (1 if i % 2 else -1))]))
    poles = [sdf.capsule((x, -0.04, 0.0), (x, -0.04, 1.48), 0.08, 0.06, paint=WOOD) for x in (-span / 2, span / 2)]
    return sdf.sit(sdf.union(sdf.smooth_union(*panels, k=0.03), *poles), k=0.02)


def towel(seed=0):
    """A striped towel, rippled, with rolled ends."""
    slab = sdf.place(sdf.round_box((0.85, 1.80, 0.05), 0.045, paint=STRIPE), at=(0, 0, 0.05))
    ends = [sdf.capsule((-0.84, y, 0.09), (0.84, y, 0.09), 0.09, 0.09, paint=STRIPE) for y in (-1.78, 1.78)]
    t = sdf.warp(sdf.smooth_union(slab, *ends, k=0.05), amount=0.035, freq=2.2, seed=seed)
    t = sdf.repaint(t, lambda p, m: np.where((np.floor((p[:, 1] + 1.9) / 0.45).astype(int) % 2) == 0, BERRY, STRIPE))
    return sdf.sit(t, k=0.02)


def headland(seed=0):
    """The far side of the bay: one low, lumpy band of land running the width
    of the scene. Thirty-one mounds melted at a wide radius, so it is a single
    shore with a varied top edge rather than a row of loaves."""
    rng = np.random.default_rng(seed)
    mounds = []
    for i in range(31):
        x = -34.0 + i * 2.2 + rng.uniform(-0.55, 0.55)
        h = 0.55 + rng.uniform(0, 0.75)
        w = 1.9 + rng.uniform(0, 1.1)
        mounds.append(sdf.place(sdf.ellipsoid((w, w * 0.68, h * 0.85), paint=HEADLAND),
                                at=(x, rng.uniform(0, 2.4), h * 0.16 - 0.3)))
    return sdf.sit(sdf.warp(sdf.smooth_union(*mounds, k=0.7), amount=0.15, freq=0.6, seed=seed), k=0.05)


def dune(seed):
    """A low dune: a crest, a long windward slope and a short leeward one,
    as one soft mass."""
    lobes = [sdf.place(sdf.ellipsoid((rx * 1.5, ry * 1.35, rz), paint=SAND), at=(dx * 1.5, dy * 1.5, dz))
             for dx, dy, dz, rx, ry, rz in ((0.00, 0.00, 0.30 - 0.9, 1.55, 1.15, 1.45),
                                            (-1.20, 0.30, 0.10 - 0.6, 1.25, 0.95, 0.95),
                                            (0.95, -0.25, 0.14 - 0.6, 0.95, 0.80, 1.05))]
    return sdf.sit(sdf.warp(sdf.smooth_union(*lobes, k=0.45), amount=0.10, freq=0.9, seed=seed), k=0.05)

#: name -> (builder, bounds lo, bounds hi, resolution)
KIT = {}
for s in range(6):
    KIT[f"tree_{s}"] = (lambda s=s: park_tree(s), (-2.8, -1.8, -0.1), (3.0, 1.8, 4.7), 0.036)
for s in range(3):
    KIT[f"bush_{s}"] = (lambda s=s: bush(s), (-1.9, -1.4, -0.1), (1.9, 1.4, 1.8), 0.03)
for s in range(2):
    KIT[f"hedge_{s}"] = (lambda s=s: hedge(s), (-5.3, -1.1, -0.1), (5.3, 1.1, 2.0), 0.04)
KIT["bench"] = (bench, (-1.9, -0.8, -0.1), (1.9, 0.8, 2.0), 0.022)
KIT["bandstand"] = (bandstand, (-3.6, -4.5, -0.1), (3.6, 3.6, 6.1), 0.042)
for fam in PETALS:
    KIT[f"flowers_{fam}"] = (lambda fam=fam: flowers(len(fam), fam), (-1.2, -1.0, -0.1), (1.2, 1.0, 0.8), 0.02)
for s in range(3):
    KIT[f"tuft_{s}"] = (lambda s=s: tuft(s), (-0.5, -0.5, -0.05), (0.5, 0.5, 0.8), 0.012)

# The beach.
KIT["palm_0"] = (lambda: palm(0), (-2.6, -2.6, -0.1), (3.3, 2.6, 4.6), 0.032)
KIT["palm_1"] = (lambda: palm(1), (-2.6, -2.6, -0.1), (3.3, 2.6, 4.6), 0.032)
KIT["umbrella"] = (umbrella, (-2.0, -2.0, -0.1), (2.0, 2.0, 4.3), 0.03)
KIT["lifeguard"] = (lifeguard, (-2.1, -1.4, -0.1), (2.1, 1.4, 4.5), 0.028)
KIT["castle"] = (castle, (-1.6, -1.0, -0.1), (1.6, 1.0, 3.2), 0.022)
KIT["bucket"] = (bucket, (-0.6, -0.6, -0.05), (0.6, 0.6, 1.4), 0.014)
KIT["beachball"] = (beachball, (-0.6, -0.6, -0.05), (0.6, 0.6, 1.1), 0.014)
for s in range(2):
    KIT[f"starfish_{s}"] = (lambda s=s: starfish(s), (-0.8, -0.8, -0.05), (0.8, 0.8, 0.35), 0.012)
    KIT[f"driftwood_{s}"] = (lambda s=s: driftwood(s), (-1.4, -0.6, -0.05), (1.3, 1.0, 0.7), 0.02)
    KIT[f"rocks_{s}"] = (lambda s=s: rocks(s), (-1.3, -0.9, -0.05), (1.2, 0.9, 1.0), 0.022)
for s in range(3):
    KIT[f"pebble_{s}"] = (lambda s=s: pebble(s), (-0.4, -0.4, -0.05), (0.4, 0.4, 0.25), 0.012)
    KIT[f"marram_{s}"] = (lambda s=s: marram(s), (-0.8, -0.8, -0.05), (0.8, 0.8, 1.1), 0.012)
KIT["shell"] = (shell, (-0.6, -0.4, -0.05), (0.6, 0.4, 0.25), 0.01)
KIT["windbreak"] = (windbreak, (-1.9, -0.4, -0.05), (1.9, 0.4, 1.6), 0.018)
KIT["towel"] = (towel, (-1.1, -2.1, -0.05), (1.1, 2.1, 0.3), 0.02)
KIT["headland"] = (headland, (-38.0, -2.8, -0.1), (38.0, 5.2, 1.6), 0.09)
for s in range(2):
    KIT[f"dune_{s}"] = (lambda s=s: dune(s), (-4.4, -2.4, -0.1), (4.0, 2.4, 1.2), 0.05)


def build(name, out: Path):
    builder, lo, hi, res = KIT[name]
    verts, faces, paint, normals = sdf.mesh(builder(), lo, hi, res)
    sdf.write_ply(out / f"{name}.ply", verts, faces, paint_mesh(verts, normals, paint))
    return {"file": f"{name}.ply", "verts": int(len(verts)), "faces": int(len(faces))}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(OUT))
    ap.add_argument("--only", default="")
    ap.add_argument("--hash", action="store_true", help="print the source hash and exit")
    a = ap.parse_args()
    if a.hash:
        print(source_hash())
        return
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    index_path = out / "kit.json"
    index = {"source": source_hash(), "objects": {}}
    if a.only and index_path.exists():
        # A partial build keeps the OLD source hash: the rest of the kit was
        # made by the old rules, and claiming otherwise would stop the scene
        # pack from rebuilding it.
        prev = json.loads(index_path.read_text())
        index = {"source": prev.get("source", ""), "objects": prev.get("objects", {})}
    names = [n for n in KIT if not a.only or n == a.only]
    # In parallel: 44 objects serially was the slowest step of the CI render.
    # Each build is independent and deterministic, so the order is free.
    from concurrent.futures import ProcessPoolExecutor
    import os
    with ProcessPoolExecutor(max(1, os.cpu_count() or 1)) as pool:
        for name, info in zip(names, pool.map(build, names, [out] * len(names))):
            index["objects"][name] = info
            print(f"sculpted {name}: {info['faces']} faces")
    index_path.write_text(json.dumps(index, indent=2) + "\n")


if __name__ == "__main__":
    main()
