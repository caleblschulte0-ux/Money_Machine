"""What a render actually depends on, for the staleness marker.

`scripts/promote-props.py` refuses to ship props whose render directory was
built by a different version of the builder, and it decides that by comparing a
sha256 recorded at render time against one computed now. That check was reading
ONE file: the pack itself.

Which was true enough while a pack was self-contained, and stopped being true
the moment the shared layer grew. `palette.py` holds every colour in the game,
the two lights' colours, the sky fill strength, and -- since the pass that
lowered the sun -- the ELEVATION every pack lights from. `ink.py` holds the
contour. `proportion.py` holds the cartoon dials. Any of those can be edited,
and every render in the repo would still have reported itself current: the
single most behaviour-changing number in the whole render pipeline sat in a
file the freshness check did not look at.

So the fingerprint is the pack PLUS every sibling module it imports, following
those modules' own imports as well -- `home_prop_pack` imports
`world_prop_pack` imports `palette`, and all three have to count. Sorted by
name so the digest does not depend on which order they were discovered in.

This module is deliberately free of `bpy`: the packs run inside Blender and the
promote script does not, and a fingerprint the two sides compute differently is
worse than no fingerprint at all.
"""

from __future__ import annotations

import ast
import hashlib
from pathlib import Path


def dependencies(pack: Path) -> list[Path]:
    """`pack` and every sibling .py it imports, transitively, sorted by name.

    Only siblings: an `import bpy` or `import math` is not part of what this
    repo renders with, and hashing the interpreter's standard library would
    make every render stale on a Python upgrade.
    """
    here = pack.resolve().parent
    seen: dict[str, Path] = {}
    queue = [pack.resolve()]
    while queue:
        current = queue.pop()
        if current.name in seen:
            continue
        seen[current.name] = current
        try:
            tree = ast.parse(current.read_text(encoding="utf-8"))
        except (OSError, SyntaxError):
            # A pack that will not parse cannot render either; let the render
            # be the thing that reports it, and fingerprint what we can read.
            continue
        for node in ast.walk(tree):
            names: list[str] = []
            if isinstance(node, ast.Import):
                names = [alias.name.split(".")[0] for alias in node.names]
            elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
                names = [node.module.split(".")[0]]
            for name in names:
                sibling = here / f"{name}.py"
                if sibling.exists() and sibling.name not in seen:
                    queue.append(sibling)
    return [seen[name] for name in sorted(seen)]


def fingerprint(pack: Path) -> str:
    """One digest over the pack and its shared modules.

    The NAME goes into the digest alongside the bytes, so swapping two modules'
    contents -- or renaming one -- changes it. Concatenating bytes alone would
    not.
    """
    digest = hashlib.sha256()
    for path in dependencies(pack):
        digest.update(path.name.encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()
