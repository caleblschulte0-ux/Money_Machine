#!/usr/bin/env python3
"""
NO TWO DOGS MAY BE THE SAME DOG.

Barkly's nemesis and his best friend shipped with IDENTICAL silhouettes --
0.00%, pixel for pixel -- because all three NPC renders are one drawing in
three palettes. They differed by hue alone, which is the one difference the
visual doctrine says may never carry meaning on its own, and nothing could see
it: the files are distinct, the imports resolve, the types are exhaustive, and
every test passes. A filename check cannot catch this. Only pixels can.

So this reads the alpha of whatever poses `src/ui/npcArt.ts` actually points at
and fails when two of them are the same shape. It measures the SHIPPED
assignment, not the folder -- three-quarter renders sat unused next to the front
ones the whole time, so "the art exists" was never the problem.

Colour is deliberately not measured. Two dogs may share a palette; they may not
share an outline.

    python3 scripts/npc-distinct.py
"""
import pathlib
import re
import sys

from PIL import Image
import numpy as np

APP = pathlib.Path(__file__).resolve().parent.parent
# Below this, two dogs read as the same dog wearing a different coat. The pose
# split that fixed the original defect scores 28.8% at its closest pair, so this
# is a floor with real room under it, not a number drawn around today's art.
MIN_DIFFERENCE = 12.0


def used_poses():
    src = (APP / "src" / "ui" / "npcArt.ts").read_text()
    found = {}
    for npc, path in re.findall(r"(\w+):\s*\{\s*source:\s*require\('([^']+)'\)", src):
        found[npc] = (APP / "src" / "ui" / path).resolve()
    return found


def silhouette(path, size=(200, 240)):
    im = Image.open(path).convert("RGBA").resize(size, Image.LANCZOS)
    return np.asarray(im)[:, :, 3] > 128


def main():
    poses = used_poses()
    if len(poses) < 2:
        print(f"FAIL: could not read the NPC pose map (found {len(poses)})")
        return 2
    for npc, path in sorted(poses.items()):
        if not path.exists():
            print(f"FAIL: {npc} points at a missing render: {path}")
            return 2
        print(f"  {npc:9s} {path.name}")

    sils = {npc: silhouette(path) for npc, path in poses.items()}
    worst = None
    names = sorted(sils)
    for i, a in enumerate(names):
        for b in names[i + 1:]:
            union = np.logical_or(sils[a], sils[b]).sum()
            diff = np.logical_xor(sils[a], sils[b]).sum() / max(1, union) * 100
            print(f"  {a} vs {b}: silhouettes differ {diff:.1f}%")
            if worst is None or diff < worst[2]:
                worst = (a, b, diff)

    if worst and worst[2] < MIN_DIFFERENCE:
        print(f"\nFAIL — {worst[0]} and {worst[1]} are the same shape ({worst[2]:.1f}% < {MIN_DIFFERENCE}%).")
        print("Two dogs differing only in colour is a palette swap, not a cast.")
        return 1
    print(f"\nPASS — every dog is a different shape (closest pair {worst[2]:.1f}%).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
