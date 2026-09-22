"""YOLO-format datasets: images/ + labels/ (class cx cy w h, normalised), split lists, data.yaml.

The format every detector family we might train reads, so a dataset built
once serves the torchvision trainer here, ultralytics, and RF-DETR alike.
"""

from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Any

import cv2
import yaml

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png"}


def write_sample(root: Path, stem: str, image: Any, boxes: list[list[float]], meta: dict[str, Any] | None = None, quality: int = 92) -> Path:
    (root / "images").mkdir(parents=True, exist_ok=True)
    (root / "labels").mkdir(parents=True, exist_ok=True)
    h, w = image.shape[:2]
    img_path = root / "images" / f"{stem}.jpg"
    cv2.imwrite(str(img_path), image, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    lines = []
    for x1, y1, x2, y2 in boxes:
        x1, y1, x2, y2 = max(0.0, x1), max(0.0, y1), min(float(w), x2), min(float(h), y2)
        if x2 <= x1 or y2 <= y1:
            continue
        lines.append(f"0 {(x1 + x2) / 2 / w:.6f} {(y1 + y2) / 2 / h:.6f} {(x2 - x1) / w:.6f} {(y2 - y1) / h:.6f}")
    (root / "labels" / f"{stem}.txt").write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")
    if meta is not None:
        (root / "meta").mkdir(parents=True, exist_ok=True)
        (root / "meta" / f"{stem}.json").write_text(json.dumps(meta), encoding="utf-8")
    return img_path


def read_boxes(label_path: Path, w: int, h: int) -> list[list[float]]:
    if not label_path.exists():
        return []
    out = []
    for line in label_path.read_text(encoding="utf-8").splitlines():
        parts = line.split()
        if len(parts) < 5:
            continue
        cx, cy, bw, bh = (float(v) for v in parts[1:5])
        out.append([(cx - bw / 2) * w, (cy - bh / 2) * h, (cx + bw / 2) * w, (cy + bh / 2) * h])
    return out


def label_path_for(image_path: Path) -> Path:
    return image_path.parent.parent / "labels" / (image_path.stem + ".txt")


def meta_for(image_path: Path) -> dict[str, Any]:
    p = image_path.parent.parent / "meta" / (image_path.stem + ".json")
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}


def list_images(spec: str | Path) -> list[Path]:
    """A dataset directory, a data.yaml (its val split), a split .txt, or an images/ directory."""
    p = Path(spec)
    if p.suffix in (".yaml", ".yml"):
        d = yaml.safe_load(p.read_text(encoding="utf-8"))
        root = Path(d.get("path", p.parent))
        return list_images(root / d.get("val", "images"))
    if p.is_file() and p.suffix == ".txt":
        return [Path(line.strip()) for line in p.read_text(encoding="utf-8").splitlines() if line.strip()]
    if p.is_dir() and (p / "images").is_dir():
        return sorted(q for q in (p / "images").iterdir() if q.suffix.lower() in IMAGE_SUFFIXES)
    if p.is_dir():
        return sorted(q for q in p.iterdir() if q.suffix.lower() in IMAGE_SUFFIXES)
    raise FileNotFoundError(f"no images at {spec}")


def write_split(root: Path, val_fraction: float, seed: int = 1, group_of: Any = None) -> tuple[int, int]:
    """Write train.txt / val.txt / data.yaml. ``group_of(path)`` keeps a group on one side (e.g. a source video)."""
    images = list_images(root)
    group_of = group_of or (lambda p: p.stem)
    groups: dict[str, list[Path]] = {}
    for p in images:
        groups.setdefault(str(group_of(p)), []).append(p)
    keys = sorted(groups)
    random.Random(seed).shuffle(keys)
    n_val = max(1, int(round(len(keys) * val_fraction))) if len(keys) > 1 and val_fraction > 0 else 0
    val_keys = set(keys[:n_val])
    train = [p for k in keys if k not in val_keys for p in groups[k]]
    val = [p for k in keys if k in val_keys for p in groups[k]]
    (root / "train.txt").write_text("\n".join(str(p.resolve()) for p in train) + "\n", encoding="utf-8")
    (root / "val.txt").write_text("\n".join(str(p.resolve()) for p in val) + "\n", encoding="utf-8")
    (root / "data.yaml").write_text(f"path: {root.resolve()}\ntrain: train.txt\nval: val.txt\nnames:\n  0: fish\n", encoding="utf-8")
    return len(train), len(val)
