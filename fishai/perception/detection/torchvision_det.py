"""Our own detector (trained in fishai.lab.trainer) as a FishAI detection backend.

    detection:
      backend: torchvision
      torchvision:
        model: models/ours_v1/detector.pt     # or a registry key with framework torchvision
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import cv2

from fishai.perception.detection.base import register_detector
from fishai.types import BBox, Detection, Frame


class TorchvisionDetector:
    name = "torchvision"

    def __init__(
        self,
        model: str,
        min_confidence: float = 0.5,
        device: str = "auto",
        models_dir: str | Path | None = None,
        nms_iou: float = 0.4,
        suppress_containers: bool = True,
        max_box_fraction: float = 0.5,
    ) -> None:
        import torch

        from fishai.lab.trainer import load_checkpoint
        from fishai.models_registry import resolve_model_path

        self.device = ("cuda" if torch.cuda.is_available() else "cpu") if device == "auto" else device
        self.path = resolve_model_path(model, models_dir=models_dir)
        self.model, ck = load_checkpoint(self.path, self.device)
        self.record = ck.get("record", {})
        self.min_confidence = min_confidence
        self.nms_iou = nms_iou
        self.suppress_containers = suppress_containers
        self.max_box_fraction = max_box_fraction
        self._torch = torch

    def detect(self, frame: Frame) -> list[Detection]:
        torch = self._torch
        t = torch.from_numpy(cv2.cvtColor(frame.image, cv2.COLOR_BGR2RGB)).permute(2, 0, 1).float().div(255.0).to(self.device)
        with torch.no_grad():
            out = self.model([t])[0]
        return postprocess(out["boxes"].cpu().numpy(), out["scores"].cpu().numpy(), frame.width, frame.height,
                           self.min_confidence, self.nms_iou, self.suppress_containers, self.max_box_fraction)

    def close(self) -> None:
        self.model = None


def postprocess(
    boxes: Any, scores: Any, width: int, height: int, min_confidence: float = 0.5, nms_iou: float = 0.4,
    suppress_containers: bool = True, max_box_fraction: float = 0.5,
) -> list[Detection]:
    """Confidence floor, class-agnostic NMS, and two plain-geometry rules learned from the first
    real-footage test (docs/DETECTOR_LAB.md): a box covering more than ``max_box_fraction`` of the
    frame is not a fish in a side-view tank, and a box that wraps two or more other detections
    is a wrapper around them, not a fish."""
    cand = [(BBox(*(float(v) for v in b)).clipped(width, height), float(s)) for b, s in zip(boxes, scores, strict=True) if s >= min_confidence]
    cand = [(b, s) for b, s in cand if b.area <= max_box_fraction * width * height]
    cand.sort(key=lambda t: -t[1])
    kept: list[tuple[BBox, float]] = []
    for b, s in cand:
        if all(b.iou(k) < nms_iou for k, _ in kept):
            kept.append((b, s))
    if suppress_containers and len(kept) > 2:
        def inside(inner: BBox, outer: BBox) -> bool:
            ix = max(0.0, min(inner.x2, outer.x2) - max(inner.x1, outer.x1))
            iy = max(0.0, min(inner.y2, outer.y2) - max(inner.y1, outer.y1))
            return inner.area > 0 and ix * iy / inner.area > 0.8

        kept = [(b, s) for b, s in kept if sum(1 for o, _ in kept if o is not b and o.area < b.area and inside(o, b)) < 2]
    return [Detection(b, s, "fish", 0) for b, s in kept]


@register_detector("torchvision")
def _build(cfg: dict[str, Any]) -> TorchvisionDetector:
    sub = dict(cfg.get("torchvision", {}))
    sub.setdefault("min_confidence", float(cfg.get("min_confidence", 0.5)))
    sub["models_dir"] = cfg.get("models_dir")
    if "model" not in sub:
        raise ValueError("detection.torchvision.model must name a trained checkpoint (fishai lab train)")
    return TorchvisionDetector(**sub)
