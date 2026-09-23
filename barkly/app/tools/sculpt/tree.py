"""THE PARK TREE, sculpted. Its character list is unchanged -- it was never
the list that failed, it was the construction:

  - fat flared foot, gripping the ground
  - leans, and the canopy leans back to catch itself
  - canopy overhangs the trunk on one side like a hat brim
  - three lobes at three heights: a scalloped top, never a dome
  - one snapped-off branch stub, high on the lean side

Seeded: `python3 tree.py --seed 7` grows a different tree from the same rules.

    python3 tools/sculpt/tree.py [--seed N] [--out PATH.ply]
"""
import argparse
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "blender"))
import sdf  # noqa: E402
from palette import tone  # noqa: E402  (pure Python; no bpy)

BARK, LEAF = 0, 1


def hexrgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def saturate(h, f):
    """A palette tone with its saturation scaled -- the family stays the same,
    only how loud it is changes."""
    import colorsys
    r, g, b = (c / 255 for c in hexrgb(h))
    hh, s, vv = colorsys.rgb_to_hsv(r, g, b)
    r, g, b = colorsys.hsv_to_rgb(hh, min(1.0, s * f), vv)
    return (round(r * 255), round(g * 255), round(b * 255))


def grow(seed=0):
    rng = np.random.default_rng(seed)
    j = lambda s=1.0: rng.uniform(-s, s)   # noqa: E731  small seeded jitter

    lean = 0.18 + 0.05 * j()
    top = np.array([lean, 0.0, 2.25])

    trunk = sdf.capsule((0, 0, 0.05), top, 0.36, 0.21, paint=BARK)
    # FLARED FOOT: three flattened lobes around the base, blended into the
    # trunk so the tree grips the ground instead of standing on it.
    roots = [sdf.place(sdf.ellipsoid((0.42, 0.24, 0.20), paint=BARK),
                       at=(0.30 * np.cos(a), 0.30 * np.sin(a), 0.10), rot=[("z", a)])
             for a in (0.4 + j(0.2), 2.5 + j(0.2), 4.4 + j(0.2))]
    # THE SNAPPED STUB, high on the lean side.
    # 0.17 -> 0.11 and 0.72 long: the first cut was 0.12 and read as a bump.
    stub = sdf.capsule((lean * 0.8, 0, 1.55), (lean * 0.8 + 0.70, 0.02, 1.88), 0.17, 0.11, paint=BARK)
    # The broken end is FLAT -- snapped, not grown -- which is the quirk.
    stub = sdf.smooth_subtract(stub, sdf.place(sdf.round_box((0.2, 0.3, 0.3), 0.02), at=(lean * 0.8 + 0.86, 0.02, 1.95),
                                               rot=[("y", -0.42)]), k=0.03)
    wood = sdf.smooth_union(trunk, *roots, stub, k=0.22)

    # CANOPY: leaning back against the trunk, overhanging one side, three
    # heights for a scalloped top. Blended with a big radius so the masses are
    # one body with scallops on its edge -- not a pile.
    cx = lean - 0.12
    # A core plus a RING of lobes at different heights. The blend radius is
    # small (0.15): the first cut used 0.38, the lobes fused into one smooth
    # mushroom cap, and the scalloped silhouette that makes the flat tree
    # read instantly was gone. Small k keeps each lobe's outline and still
    # fillets the seams, so it is one body with bumps on its edge.
    core = sdf.place(sdf.ellipsoid((1.05, 0.85, 0.72), paint=LEAF), at=(cx, 0.0, 2.95))
    ring = []
    # (angle around the core, height, size) -- lower and bigger on the brim side
    for ang, z, r in [(3.3, 2.62, 0.66), (2.4, 3.18, 0.60), (1.6, 3.62, 0.62),
                      (0.8, 3.30, 0.56), (0.05, 2.62, 0.70), (-0.6, 2.30, 0.50)]:
        ang += j(0.12)
        rx = 1.02 if abs(np.cos(ang)) > 0.4 else 0.55
        ring.append(sdf.place(sdf.ellipsoid((r, r * 0.92, r * 0.84), paint=LEAF),
                              at=(cx + rx * np.cos(ang) * 1.05 + (0.35 if np.cos(ang) > 0.5 else 0), 0.22 * np.sin(ang * 1.7), z + j(0.06))))
    back = [sdf.place(sdf.ellipsoid((0.62, 0.55, 0.55), paint=LEAF), at=(cx + dx, 0.55, z)) for dx, z in [(-0.5, 3.0), (0.55, 3.1)]]
    canopy = sdf.smooth_union(core, *ring, *back, k=0.15)
    tree = sdf.smooth_union(wood, canopy, k=0.20)
    return sdf.warp(tree, amount=0.07, freq=1.2, seed=seed)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--out", default=str(HERE.parent.parent / "art-review" / "sculpt" / "tree.ply"))
    ap.add_argument("--res", type=float, default=0.032)
    a = ap.parse_args()
    field = grow(a.seed)
    verts, faces, paint, normals = sdf.mesh(field, lo=(-2.4, -1.5, -0.1), hi=(2.6, 1.5, 4.45), res=a.res)
    # Airbrushed per part: under / mid / top -- but the ramp stops at BASE.
    # The palette's `lit` step (#CEF6AB) is a painted highlight for flat art;
    # on a lit sculpt the studio key already brightens the top ~1.5x, so
    # painting `lit` as well counted the highlight twice and rendered the
    # canopy mint (measured: sat 0.20, val 0.80, against the flat tree's
    # 0.42 / 0.53 and Barkly's 0.41 / 0.74). Paint the object's own colour,
    # a step deeper and louder, and let the light do the light.
    leaf = sdf.airbrush(normals, verts, [saturate(tone("foliage", "deep"), 1.30), saturate(tone("foliage", "shade"), 1.45),
                                         saturate(tone("foliage", "base"), 1.40)], lift=0.0)
    bark = sdf.airbrush(normals, verts, [hexrgb(tone("bark", "deep")), hexrgb(tone("bark", "deep")), hexrgb(tone("bark", "shade"))])
    colours = np.where((paint == LEAF)[:, None], leaf, bark).astype(np.uint8)
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    sdf.write_ply(a.out, verts, faces, colours)
    print(f"sculpted tree seed={a.seed}: {len(verts)} verts, {len(faces)} faces -> {a.out}")


if __name__ == "__main__":
    main()
