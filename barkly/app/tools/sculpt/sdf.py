"""PROCEDURAL CLAY: sculpt objects as signed-distance fields.

Operator, 2026-09-23: *"This all needs to be procedurally generated."*

Every earlier procedural attempt in this repo SNAPPED primitives together --
lathes, then bevelled boxes -- and each one read as a stack of parts: the
operator's "pile of pillows". That is a limit of the construction, not of
procedural art. A vinyl toy is SCULPTED: one continuous mass where forms melt
into each other with soft fillets. The procedural equivalent is a distance
field with SMOOTH union -- the field of two shapes blended over a radius `k`,
so a trunk grows into its canopy instead of being plugged into it.

Pipeline: build a field here in NumPy, extract the surface with marching cubes
(scikit-image), write a coloured PLY; Blender only lights and renders it
(tools/blender/render_sculpt.py). Every shape is seeded, so a tree is a
function, not a file -- the same code grows the next tree different.

A field is a function  p (N,3) -> (distance (N,), paint (N,))  where paint is
an integer material id. Smooth union carries the paint of whichever part is
nearer, so colour follows form.
"""
import numpy as np

# ------------------------------------------------------------------ primitives


def _rot(axis, angle):
    c, s = np.cos(angle), np.sin(angle)
    if axis == "x":
        return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
    if axis == "y":
        return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def place(field, at=(0, 0, 0), rot=()):
    """Move a field. `rot` is a list of (axis, radians) applied in order."""
    R = np.eye(3)
    for axis, ang in rot:
        R = _rot(axis, ang) @ R
    Rinv, at = R.T, np.asarray(at, float)

    def f(p):
        return field((p - at) @ Rinv.T)
    return f


def ellipsoid(r, paint=0):
    r = np.asarray(r, float)

    def f(p):
        k0 = np.linalg.norm(p / r, axis=1)
        k1 = np.linalg.norm(p / (r * r), axis=1)
        d = k0 * (k0 - 1.0) / np.maximum(k1, 1e-9)   # Quilez's bound
        return d, np.full(len(p), paint)
    return f


def round_box(half, radius, paint=0):
    half = np.asarray(half, float) - radius

    def f(p):
        q = np.abs(p) - half
        d = np.linalg.norm(np.maximum(q, 0), axis=1) + np.minimum(q.max(1), 0) - radius
        return d, np.full(len(p), paint)
    return f


def capsule(a, b, ra, rb=None, paint=0):
    """A tapered capsule from a (radius ra) to b (radius rb)."""
    a, b = np.asarray(a, float), np.asarray(b, float)
    rb = ra if rb is None else rb
    ba = b - a

    def f(p):
        pa = p - a
        h = np.clip((pa @ ba) / (ba @ ba), 0, 1)
        d = np.linalg.norm(pa - np.outer(h, ba), axis=1) - (ra + (rb - ra) * h)
        return d, np.full(len(p), paint)
    return f


# ------------------------------------------------------------------ operators


def smooth_union(*fields, k=0.3):
    """Blend fields over radius k. Paint goes to the nearer part."""
    def f(p):
        d, m = fields[0](p)
        for g in fields[1:]:
            d2, m2 = g(p)
            h = np.clip(0.5 + 0.5 * (d2 - d) / k, 0, 1)
            m = np.where(d2 < d, m2, m)
            d = d2 * (1 - h) + d * h - k * h * (1 - h)
        return d, m
    return f


def smooth_subtract(base, cut, k=0.1):
    """Carve `cut` out of `base` with a soft edge -- a bite, a dent."""
    def f(p):
        d, m = base(p)
        d2, _ = cut(p)
        h = np.clip(0.5 - 0.5 * (d + d2) / k, 0, 1)
        return d * (1 - h) + (-d2) * h + k * h * (1 - h), m
    return f


def warp(field, amount=0.08, freq=1.3, seed=0):
    """Domain warp by a smooth, seeded, continuous displacement.

    The hand in the clay: no surface a person sculpts is mathematically
    symmetric, and the eye reads perfect symmetry as CG. Low frequency only --
    this bends forms, it never adds texture (the flocking does that).
    """
    rng = np.random.default_rng(seed)
    ph = rng.uniform(0, 2 * np.pi, (3, 3))
    fr = freq * rng.uniform(0.7, 1.3, (3, 3))

    def f(p):
        off = np.zeros_like(p)
        for i in range(3):
            off[:, i] = sum(np.sin(p[:, (i + j + 1) % 3] * fr[i, j] + ph[i, j]) for j in range(3)) / 3
        return field(p + amount * off)
    return f


# ------------------------------------------------------------------ meshing


def mesh(field, lo, hi, res=0.03):
    """Marching cubes over the box [lo, hi] at `res` world units per cell."""
    from skimage.measure import marching_cubes
    lo, hi = np.asarray(lo, float), np.asarray(hi, float)
    n = np.ceil((hi - lo) / res).astype(int) + 1
    axes = [np.linspace(lo[i], hi[i], n[i]) for i in range(3)]
    g = np.stack(np.meshgrid(*axes, indexing="ij"), -1).reshape(-1, 3)
    d, _ = field(g)
    vol = d.reshape(n)
    step = (hi - lo) / (n - 1)
    verts, faces, normals, _ = marching_cubes(vol, 0.0, spacing=tuple(step))
    verts += lo
    _, paint = field(verts)
    # marching_cubes' normals point down the gradient (into the solid); flip
    # them so +z means "faces the sky".
    return verts, faces, paint, -normals


def write_ply(path, verts, faces, colours):
    """Binary-free ASCII PLY with per-vertex colour; Blender imports it."""
    with open(path, "w") as fh:
        fh.write("ply\nformat ascii 1.0\n")
        fh.write(f"element vertex {len(verts)}\nproperty float x\nproperty float y\nproperty float z\n")
        fh.write("property uchar red\nproperty uchar green\nproperty uchar blue\n")
        fh.write(f"element face {len(faces)}\nproperty list uchar int vertex_indices\nend_header\n")
        for (x, y, z), (r, g, b) in zip(verts, colours):
            fh.write(f"{x:.5f} {y:.5f} {z:.5f} {r} {g} {b}\n")
        for a, b, c in faces:
            fh.write(f"3 {a} {c} {b}\n")   # marching-cubes winding -> outward normals


def airbrush(normals, verts, ramp, lift=0.0):
    """Paint a vinyl toy's factory airbrushing onto the surface.

    Collectible vinyl is not one flat colour: it is sprayed darker where a
    form turns under and lighter where it faces up, so it reads as a form even
    under flat shop lighting. The concept sheet's ears and muzzle do exactly
    this. `ramp` is (under, mid, top) as RGB 0-255; which one a vertex gets is
    decided by which way it faces, with `lift` biasing toward the top colour.
    """
    ramp = [np.asarray(c, float) for c in ramp]
    up = np.clip(normals[:, 2] * 0.5 + 0.5 + lift, 0, 1)
    lo = np.clip(up * 2, 0, 1)[:, None]
    hi = np.clip(up * 2 - 1, 0, 1)[:, None]
    under_mid = ramp[0] * (1 - lo) + ramp[1] * lo
    return np.where((up < 0.5)[:, None], under_mid, ramp[1] * (1 - hi) + ramp[2] * hi).astype(np.uint8)
