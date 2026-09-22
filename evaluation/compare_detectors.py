#!/usr/bin/env python
"""Score detectors against a reviewed YOLO-format dataset.

    python evaluation/compare_detectors.py datasets/tank1_week1/data.yaml fishial_detector_v26 models/ours_tank1/best.pt [--split val]

Each image's labels are the ground truth; each detector's boxes are scored
with fishai.evaluation (precision, recall, F1, mean IoU at IoU 0.5). A
motion detector cannot be scored this way (it needs video), so this is for
weights files and registry keys.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2
import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from fishai.evaluation import score_detections  # noqa: E402
from fishai.types import BBox, Frame  # noqa: E402


def load_split(data_yaml: Path, split: str) -> list[Path]:
    d = yaml.safe_load(data_yaml.read_text(encoding="utf-8"))
    root = Path(d.get("path", data_yaml.parent))
    entry = d.get(split, "images")
    p = root / entry
    if p.is_file():
        return [Path(line.strip()) for line in p.read_text(encoding="utf-8").splitlines() if line.strip()]
    return sorted(q for q in p.glob("*.*") if q.suffix.lower() in {".jpg", ".jpeg", ".png"})


def labels_for(image: Path, w: int, h: int) -> dict[int, BBox]:
    lbl = image.parent.parent / "labels" / (image.stem + ".txt")
    out: dict[int, BBox] = {}
    if not lbl.exists():
        return out
    for i, line in enumerate(lbl.read_text(encoding="utf-8").splitlines()):
        parts = line.split()
        if len(parts) < 5:
            continue
        cx, cy, bw, bh = (float(v) for v in parts[1:5])
        out[i] = BBox((cx - bw / 2) * w, (cy - bh / 2) * h, (cx + bw / 2) * w, (cy + bh / 2) * h)
    return out


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("data")
    ap.add_argument("detectors", nargs="+", help="registry keys or .pt paths")
    ap.add_argument("--split", default="val")
    ap.add_argument("--iou", type=float, default=0.5)
    ap.add_argument("--min-confidence", type=float, default=0.25)
    ap.add_argument("--max-images", type=int)
    args = ap.parse_args(argv)
    images = load_split(Path(args.data), args.split)
    if args.max_images:
        images = images[: args.max_images]
    if not images:
        print("no images in split", file=sys.stderr)
        return 2
    from fishai.perception.detection.yolo import YoloDetector

    rows = []
    for name in args.detectors:
        det = YoloDetector(name, min_confidence=args.min_confidence)
        truth, preds = {}, {}
        for i, img_path in enumerate(images):
            img = cv2.imread(str(img_path))
            if img is None:
                continue
            h, w = img.shape[:2]
            truth[i] = labels_for(img_path, w, h)
            preds[i] = [(j, d.bbox) for j, d in enumerate(det.detect(Frame(i, 0.0, img)))]
        s = score_detections(truth, preds, iou_threshold=args.iou)
        det.close()
        rows.append((name, s))
    print(f"{'detector':40} {'precision':>9} {'recall':>7} {'F1':>6} {'mIoU':>6}  (n={len(images)} images, IoU>={args.iou})")
    for name, s in rows:
        print(f"{name:40} {s.precision:9.3f} {s.recall:7.3f} {s.f1:6.3f} {s.mean_iou:6.3f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
