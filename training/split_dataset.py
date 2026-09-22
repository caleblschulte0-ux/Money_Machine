#!/usr/bin/env python
"""Split an exported dataset into train/val lists and write data.yaml for training.

    python training/split_dataset.py datasets/tank1_week1 --val 0.15 --seed 1

Splits by SOURCE VIDEO, not by frame, so frames of the same clip never sit
on both sides (adjacent frames are near-duplicates and would inflate the
validation score).
"""

from __future__ import annotations

import argparse
import random
from collections import defaultdict
from pathlib import Path


def split(root: Path, val_fraction: float, seed: int) -> tuple[list[Path], list[Path]]:
    images = sorted((root / "images").glob("*.*"))
    by_video: dict[str, list[Path]] = defaultdict(list)
    for p in images:
        by_video[p.stem.rsplit("_", 1)[0]].append(p)
    videos = sorted(by_video)
    rng = random.Random(seed)
    rng.shuffle(videos)
    n_val = max(1, int(round(len(videos) * val_fraction))) if len(videos) > 1 else 0
    val_videos = set(videos[:n_val])
    train = [p for v in videos if v not in val_videos for p in by_video[v]]
    val = [p for v in videos if v in val_videos for p in by_video[v]]
    return train, val


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("dataset")
    ap.add_argument("--val", type=float, default=0.15)
    ap.add_argument("--seed", type=int, default=1)
    args = ap.parse_args(argv)
    root = Path(args.dataset).resolve()
    train, val = split(root, args.val, args.seed)
    (root / "train.txt").write_text("\n".join(str(p) for p in train) + "\n", encoding="utf-8")
    (root / "val.txt").write_text("\n".join(str(p) for p in val) + "\n", encoding="utf-8")
    (root / "data.yaml").write_text(f"path: {root}\ntrain: train.txt\nval: val.txt\nnames:\n  0: fish\n", encoding="utf-8")
    print(f"{len(train)} train / {len(val)} val frames -> {root / 'data.yaml'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
