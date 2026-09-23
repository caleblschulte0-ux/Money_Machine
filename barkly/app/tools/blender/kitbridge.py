"""The sculpt kit, as Blender sees it: one bridge for every renderer.

`tools/sculpt/kit.py` sculpts objects as signed-distance fields in system
python (numpy + scikit-image) and writes coloured meshes. The scene plates
(`world_scene_pack.py`) and Home's furniture (`home_prop_pack.py`) both stand
those meshes up, so the loading, the material and the measuring live here once
-- the first version lived inside the scene pack, and Home would otherwise
have grown a second copy of it.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import toybox  # noqa: E402  -- the canon's flocked material

ROOT = Path(__file__).resolve().parents[2]
KIT = ROOT / "tools" / "sculpt" / "kit.py"
KIT_DIR = ROOT / "art-review" / "sculpt" / "kit"
_MESHES: dict = {}


def _python() -> str:
    exe = shutil.which("python3")
    if exe is None:
        raise RuntimeError("the sculpt kit needs a system python3 (numpy + scikit-image) beside Blender")
    return exe


def ensure_kit():
    """Sculpt the kit if it is missing or was made by different rules.

    Fails LOUD rather than falling back to primitives: a render that quietly
    used the old construction because a dependency was missing would ship the
    look the operator rejected, with a green check on it.
    """
    want = subprocess.run([_python(), str(KIT), "--hash"], capture_output=True, text=True,
                          check=True).stdout.strip()
    index = KIT_DIR / "kit.json"
    have = json.loads(index.read_text()).get("source") if index.exists() else None
    if have != want:
        print(f"sculpt kit stale ({have} != {want}); sculpting")
        subprocess.run([_python(), str(KIT), "--out", str(KIT_DIR)], check=True)


def variants(kind: str) -> list[str]:
    """Every kit object named `<kind>_*`, sorted -- whatever the kit made."""
    names = sorted(n for n in json.loads((KIT_DIR / "kit.json").read_text())["objects"]
                   if n.startswith(kind + "_"))
    if not names:
        raise RuntimeError(f"the sculpt kit has no {kind}_* objects")
    return names


def toy_material(chroma: float = 1.0, nap: float = 0.25):
    """The canon's flocked vinyl, coloured by the sculpt's painted vertices and
    multiplied by the object's own colour -- which is how one mesh serves as a
    near tree and a darker far one without a second material.

    Nap 0.25, not the preview's 0.62: at plate scale the grain read as a
    fuzzy, buzzing surface -- "hurts my eyes"."""
    mat = bpy.data.materials.get("Toy flock")
    if mat is None:
        mat = toybox.flock_painted("Toy flock", nap=nap, chroma=chroma)
    return mat


def mesh(name: str, chroma: float = 1.0, nap: float = 0.25):
    """The kit object's mesh, imported once and shared by every instance."""
    found = _MESHES.get(name)
    if found is not None:
        return found
    bpy.ops.wm.ply_import(filepath=str(KIT_DIR / f"{name}.ply"))
    obj = bpy.context.selected_objects[0]
    data = obj.data
    data.name = f"kit_{name}"
    data.polygons.foreach_set("use_smooth", [True] * len(data.polygons))
    data.materials.clear()
    data.materials.append(toy_material(chroma, nap))
    data.use_fake_user = True   # outlives a scene clean between renders
    bpy.data.objects.remove(obj, do_unlink=True)
    _MESHES[name] = data
    return data


def measure(obj, slices: int = 32):
    """The proportion numbers `scripts/proportion.py` gates on, for a kit mesh.

    The same silhouette profile `world_prop_pack.measure_form` takes -- the
    x-extent of each horizontal slice -- but from the mesh's own vertices, since
    a sculpt is one body and logs no parts. Measured, never assumed, so the
    gate keeps checking the real shape.
    """
    mw = obj.matrix_world
    pts = [mw @ v.co for v in obj.data.vertices]
    if not pts:
        return None
    base = min(p.z for p in pts)
    top = max(p.z for p in pts)
    height = top - base
    if height <= 0:
        return None
    lo = [float("inf")] * slices
    hi = [float("-inf")] * slices
    for p in pts:
        i = min(slices - 1, int((p.z - base) / height * slices))
        lo[i] = min(lo[i], p.x)
        hi[i] = max(hi[i], p.x)
    profile = [round(hi[i] - lo[i], 3) if hi[i] >= lo[i] else 0.0 for i in range(slices)]

    def widest(a, b):
        s, e = int(slices * a), max(int(slices * a) + 1, int(slices * b))
        return max(profile[s:e])

    def narrowest(a, b):
        s, e = int(slices * a), max(int(slices * a) + 1, int(slices * b))
        return min(profile[s:e])

    return {
        "height": round(height, 3),
        "parts": 1,
        "widest": round(max(profile), 3),
        "foot": round(widest(0.0, 0.15), 3),
        "waist": round(narrowest(0.25, 0.65), 3),
        "crown": round(widest(0.55, 1.0), 3),
    }
