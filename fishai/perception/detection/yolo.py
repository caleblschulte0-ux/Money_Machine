"""Ultralytics YOLO adapter (Fishial fish detector or any YOLO checkpoint).

``ultralytics`` is imported lazily so the rest of FishAI never needs torch.
The model is resolved through ``models/registry.json`` (a key such as
``fishial_detector_v26``) or a direct path. Licensing: ultralytics is
AGPL-3.0; see docs/THIRD_PARTY.md before shipping this backend in a
product.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fishai.perception.detection.base import register_detector
from fishai.types import BBox, Detection, Frame


class YoloDetector:
    name = "yolo"

    def __init__(
        self,
        model: str,
        image_size: int = 640,
        min_confidence: float = 0.25,
        iou_threshold: float = 0.45,
        device: str = "auto",
        fish_classes: list[str] | None = None,
        models_dir: str | Path | None = None,
    ) -> None:
        try:
            from ultralytics import YOLO
        except ImportError as exc:  # pragma: no cover - exercised only without the ml extra
            raise ImportError("the yolo detector needs `pip install -r requirements-ml.txt`") from exc
        from fishai.models_registry import resolve_model_path

        self.model_path = resolve_model_path(model, models_dir=models_dir)
        self.image_size = image_size
        self.min_confidence = min_confidence
        self.iou_threshold = iou_threshold
        self.device = _resolve_device(device)
        self.fish_classes = {c.lower() for c in (fish_classes or [])}
        self._model = YOLO(str(self.model_path))
        self.names: dict[int, str] = dict(getattr(self._model, "names", {}) or {})

    def detect(self, frame: Frame) -> list[Detection]:
        results = self._model.predict(
            source=frame.image,
            imgsz=self.image_size,
            conf=self.min_confidence,
            iou=self.iou_threshold,
            device=self.device,
            verbose=False,
            save=False,
        )
        out: list[Detection] = []
        for res in results:
            boxes = getattr(res, "boxes", None)
            if boxes is None or len(boxes) == 0:
                continue
            data = boxes.data.cpu().numpy()
            for row in data:
                x1, y1, x2, y2, conf = (float(v) for v in row[:5])
                cls_id = int(row[5]) if len(row) > 5 else 0
                cls_name = str(self.names.get(cls_id, "fish"))
                if self.fish_classes and cls_name.lower() not in self.fish_classes:
                    continue
                out.append(Detection(BBox(x1, y1, x2, y2).clipped(frame.width, frame.height), conf, cls_name, cls_id))
        return out

    def close(self) -> None:
        self._model = None


def _resolve_device(device: str) -> str:
    if device != "auto":
        return device
    try:
        import torch

        return "cuda" if torch.cuda.is_available() else "cpu"
    except Exception:  # pragma: no cover
        return "cpu"


@register_detector("yolo")
def _build(cfg: dict[str, Any]) -> YoloDetector:
    sub = dict(cfg.get("yolo", {}))
    sub.setdefault("min_confidence", float(cfg.get("min_confidence", 0.25)))
    sub["models_dir"] = cfg.get("models_dir")
    return YoloDetector(**sub)
