"""Score detectors on labelled images: overall and by the conditions that matter.

Breakdowns (when the dataset has per-frame metadata, as synthetic sets do):
fish size in pixels (small < 24 px long side, medium < 64, large), night
vs day, and occlusion. Precision / recall / F1 at IoU 0.5 by default.
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any

import cv2

from fishai.evaluation import score_detections
from fishai.lab.yolo import label_path_for, meta_for, read_boxes
from fishai.types import BBox, Frame


def _size_bucket(b: BBox) -> str:
    side = max(b.width, b.height)
    return "small" if side < 24 else ("medium" if side < 64 else "large")


def score_predictions(images: list[Path], predict: Any, iou: float = 0.5) -> dict[str, Any]:
    truth: dict[int, dict[int, BBox]] = {}
    preds: dict[int, list[tuple[int, BBox]]] = {}
    night: set[int] = set()
    by_source: dict[str, dict[int, dict[int, BBox]]] = {}
    t0 = time.time()
    n = 0
    for i, p in enumerate(images):
        img = cv2.imread(str(p))
        if img is None:
            continue
        h, w = img.shape[:2]
        truth[i] = {j: BBox(*b) for j, b in enumerate(read_boxes(label_path_for(p), w, h))}
        preds[i] = [(j, b) for j, b in enumerate(predict(img))]
        meta = meta_for(p)
        if meta.get("scene", {}).get("night"):
            night.add(i)
        for j, f in enumerate(x for x in meta.get("fish", []) if x.get("keep")):
            by_source.setdefault(str(f.get("sprite_source", "?")), {}).setdefault(i, {})[j] = BBox(*f["box"])
        n += 1
    elapsed = time.time() - t0
    overall = score_detections(truth, preds, iou)
    out: dict[str, Any] = {k: round(v, 4) if isinstance(v, float) else v for k, v in overall.to_dict().items()}
    out["images"] = n
    out["s_per_image"] = round(elapsed / n, 4) if n else None
    # Recall by fish size: truth split by bucket, predictions shared (so precision is not split).
    for bucket in ("small", "medium", "large"):
        t_b = {i: {j: b for j, b in gt.items() if _size_bucket(b) == bucket} for i, gt in truth.items()}
        if sum(len(v) for v in t_b.values()):
            s = score_detections(t_b, preds, iou)
            out[f"recall_{bucket}"] = round(s.tp / max(1, s.tp + s.fn), 4)
    # Synthetic sets: recall on real fish cut-outs vs procedural (cartoon) fish, so a
    # detector that ignores cartoons is not mistaken for one that misses fish.
    for source, t_s in by_source.items():
        s = score_detections({i: t_s.get(i, {}) for i in truth}, preds, iou)
        out[f"recall_{source}_fish"] = round(s.tp / max(1, s.tp + s.fn), 4)
    for name, keep in (("night", lambda i: i in night), ("day", lambda i: i not in night)):
        t_n = {i: gt for i, gt in truth.items() if keep(i)}
        if t_n and night:
            s = score_detections(t_n, {i: preds[i] for i in t_n}, iou)
            out[f"f1_{name}"] = round(s.f1, 4)
    return out


def evaluate_model(model: Any, images: list[Path], device: str = "cpu", min_confidence: float = 0.5, iou: float = 0.5) -> dict[str, Any]:
    """Score a torchvision detection model in memory."""
    import torch

    model.eval()

    def predict(img: Any) -> list[BBox]:
        t = torch.from_numpy(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)).permute(2, 0, 1).float().div(255.0).to(device)
        with torch.no_grad():
            out = model([t])[0]
        return [BBox(*(float(v) for v in b)) for b, s in zip(out["boxes"].cpu().numpy(), out["scores"].cpu().numpy(), strict=True) if s >= min_confidence]

    return score_predictions(images, predict, iou)


def evaluate_detector(detector: Any, images: list[Path], iou: float = 0.5) -> dict[str, Any]:
    """Score any FishAI ``Detector`` (yolo, torchvision, motion is not meaningful on stills)."""

    def predict(img: Any) -> list[BBox]:
        return [d.bbox for d in detector.detect(Frame(0, 0.0, img))]

    return score_predictions(images, predict, iou)
