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
SOURCES = [HERE / "sdf.py", HERE / "kit.py", HERE / "tree.py", HERE.parent / "blender" / "palette.py"]


def source_hash() -> str:
    h = hashlib.sha256()
    for p in SOURCES:
        h.update(p.read_bytes())
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


PALE = ("shade", "base", "lit")


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
    SAND: ramp("sand", PALE, (1.0, 1.05, 1.0)),
    GOLD: ramp("sun", ("base", "lit", "lit"), (1.1, 1.1, 1.0)),
    GRASS: warm_under(ramp("grass")),
    SOIL: ramp("bark", ("deep", "shade", "shade"), (1.0, 1.05, 1.05)),
}
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
    for name in KIT:
        if a.only and name != a.only:
            continue
        index["objects"][name] = build(name, out)
        print(f"sculpted {name}: {index['objects'][name]['faces']} faces")
    index_path.write_text(json.dumps(index, indent=2) + "\n")


if __name__ == "__main__":
    main()
