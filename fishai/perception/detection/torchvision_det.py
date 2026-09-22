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

    def __init__(self, model: str, min_confidence: float = 0.5, device: str = "auto", models_dir: str | Path | None = None) -> None:
        import torch

        from fishai.lab.trainer import load_checkpoint
        from fishai.models_registry import resolve_model_path

        self.device = ("cuda" if torch.cuda.is_available() else "cpu") if device == "auto" else device
        self.path = resolve_model_path(model, models_dir=models_dir)
        self.model, ck = load_checkpoint(self.path, self.device)
        self.record = ck.get("record", {})
        self.min_confidence = min_confidence
        self._torch = torch

    def detect(self, frame: Frame) -> list[Detection]:
        torch = self._torch
        t = torch.from_numpy(cv2.cvtColor(frame.image, cv2.COLOR_BGR2RGB)).permute(2, 0, 1).float().div(255.0).to(self.device)
        with torch.no_grad():
            out = self.model([t])[0]
        dets = []
        for b, s in zip(out["boxes"].cpu().numpy(), out["scores"].cpu().numpy(), strict=True):
            if s >= self.min_confidence:
                dets.append(Detection(BBox(*(float(v) for v in b)).clipped(frame.width, frame.height), float(s), "fish", 0))
        return dets

    def close(self) -> None:
        self.model = None


@register_detector("torchvision")
def _build(cfg: dict[str, Any]) -> TorchvisionDetector:
    sub = dict(cfg.get("torchvision", {}))
    sub.setdefault("min_confidence", float(cfg.get("min_confidence", 0.5)))
    sub["models_dir"] = cfg.get("models_dir")
    if "model" not in sub:
        raise ValueError("detection.torchvision.model must name a trained checkpoint (fishai lab train)")
    return TorchvisionDetector(**sub)
