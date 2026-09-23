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


def cylinder(r, h, radius=0.0, paint=0):
    """An upright rounded cylinder, radius r, height h, base on z=0."""
    def f(p):
        q = np.stack([np.hypot(p[:, 0], p[:, 1]) - (r - radius), np.abs(p[:, 2] - h / 2) - (h / 2 - radius)], 1)
        d = np.linalg.norm(np.maximum(q, 0), axis=1) + np.minimum(q.max(1), 0) - radius
        return d, np.full(len(p), paint)
    return f


def cone(r0, r1, h, paint=0):
    """A frustum on z=0, radius r0 at the foot and r1 at height h (a bound,
    exact enough for marching cubes)."""
    slope = (r0 - r1) / h
    norm = np.sqrt(1 + slope * slope)

    def f(p):
        z = p[:, 2]
        side = (np.hypot(p[:, 0], p[:, 1]) - (r0 - slope * np.clip(z, 0, h))) / norm
        return np.maximum(side, np.maximum(-z, z - h)), np.full(len(p), paint)
    return f


def torus(R, r, paint=0):
    """A ring lying flat, major radius R, tube radius r, centred on z=0."""
    def f(p):
        q = np.stack([np.hypot(p[:, 0], p[:, 1]) - R, p[:, 2]], 1)
        return np.linalg.norm(q, axis=1) - r, np.full(len(p), paint)
    return f


# ------------------------------------------------------------------ operators


def union(*fields):
    """Hard union: parts that TOUCH without melting (a post under a roof)."""
    def f(p):
        d, m = fields[0](p)
        for g in fields[1:]:
            d2, m2 = g(p)
            m = np.where(d2 < d, m2, m)
            d = np.minimum(d, d2)
        return d, m
    return f


def repaint(field, choose):
    """Recolour a field by POSITION: `choose(p, paint) -> paint`. Stripes on
    an umbrella or a beach ball are paint, not geometry -- the form stays one
    smooth body and only the colour changes across it."""
    def f(p):
        d, m = field(p)
        return d, choose(p, m)
    return f


def squash(field, scale, about=(0, 0, 0)):
    """Scale a field non-uniformly about a point (a leaf flattened into a
    blade). The result is a level set rather than an exact distance, which is
    all marching cubes needs."""
    scale, about = np.asarray(scale, float), np.asarray(about, float)

    def f(p):
        return field((p - about) / scale + about)
    return f


def sit(field, z=0.0, k=0.06):
    """Flatten everything below the ground plane, so an object SITS on the lawn
    instead of floating a sphere's curve above it."""
    def below(p):   # the half-space under the ground, as a field
        return p[:, 2] - z, np.zeros(len(p), int)
    return smooth_subtract(field, below, k=k)


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


def _weld(verts, faces, normals):
    """Merge duplicate vertices and drop zero-area triangles.

    Marching cubes emits the same point twice wherever the surface passes
    exactly through a grid vertex, and a sliver triangle between them. The
    Home chair came out with 1,629 duplicated points and 3,734 zero-area
    faces; unwelded, smooth shading breaks at every one, and the arm caps
    rendered with rings of dark speckles.
    """
    # 1e-5: the PLY is written to five decimals, so points closer than that
    # become duplicates in the file even if they were distinct here.
    key = np.round(verts / 1e-5).astype(np.int64)
    _, first, inverse = np.unique(key, axis=0, return_index=True, return_inverse=True)
    inverse = inverse.reshape(-1)
    verts, normals = verts[first], normals[first]
    faces = inverse[faces]
    distinct = (faces[:, 0] != faces[:, 1]) & (faces[:, 1] != faces[:, 2]) & (faces[:, 0] != faces[:, 2])
    faces = faces[distinct]
    area = np.linalg.norm(np.cross(verts[faces[:, 1]] - verts[faces[:, 0]], verts[faces[:, 2]] - verts[faces[:, 0]]), axis=1)
    return verts, faces[area > 1e-12], normals


def mesh(field, lo, hi, res=0.03):
    """Marching cubes over the box [lo, hi] at `res` world units per cell."""
    from skimage.measure import marching_cubes
    lo, hi = np.asarray(lo, float), np.asarray(hi, float)
    n = np.ceil((hi - lo) / res).astype(int) + 1
    axes = [np.linspace(lo[i], hi[i], n[i]) for i in range(3)]
    g = np.stack(np.meshgrid(*axes, indexing="ij"), -1).reshape(-1, 3)
    # In chunks: a bandstand at kit resolution is several million samples and
    # every operator allocates a copy per part.
    d = np.concatenate([field(g[i:i + 400_000])[0] for i in range(0, len(g), 400_000)])
    vol = d.reshape(n)
    step = (hi - lo) / (n - 1)
    verts, faces, normals, _ = marching_cubes(vol, 0.0, spacing=tuple(step))
    verts += lo
    verts, faces, normals = _weld(verts, faces, normals)
    _, paint = field(verts)
    # marching_cubes' normals point down the gradient (into the solid); flip
    # them so +z means "faces the sky".
    return verts, faces, paint, -normals


def write_ply(path, verts, faces, colours):
    """ASCII PLY with per-vertex colour; Blender imports it.

    ASCII ON PURPOSE. A binary writer was tried for speed and Blender 4.0's
    PLY reader refused one valid file of the park/beach kit ("Invalid face
    size") while taking the others -- every face record in it checked out as
    count 3, and the same mesh as ASCII imported cleanly. A reader bug that
    depends on where records fall is not something to gamble a CI render on;
    the kit is a gitignored cache, so the bytes cost nothing.
    """
    import io
    buf = io.StringIO()
    buf.write("ply\nformat ascii 1.0\n")
    buf.write(f"element vertex {len(verts)}\nproperty float x\nproperty float y\nproperty float z\n")
    buf.write("property uchar red\nproperty uchar green\nproperty uchar blue\n")
    buf.write(f"element face {len(faces)}\nproperty list uchar int vertex_indices\nend_header\n")
    v = np.concatenate([np.asarray(verts, float), np.asarray(colours, float)], 1)
    np.savetxt(buf, v, fmt=["%.5f"] * 3 + ["%d"] * 3)
    # marching-cubes winding -> outward normals
    f = np.stack([np.full(len(faces), 3), faces[:, 0], faces[:, 2], faces[:, 1]], 1)
    np.savetxt(buf, f, fmt="%d")
    with open(path, "w") as fh:
        fh.write(buf.getvalue())


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

