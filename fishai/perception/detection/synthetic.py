"""Ground-truth 'detector' for synthetic videos. Tests only.

It replays the boxes ``SyntheticAquarium`` produced, optionally with jitter
and dropouts, so tracking and behaviour code can be tested against exact
truth without a model.
"""

from __future__ import annotations

import random
from typing import Any

from fishai.perception.detection.base import register_detector
from fishai.types import BBox, Detection, Frame


class SyntheticDetector:
    name = "synthetic"

    def __init__(
        self,
        truth: dict[int, dict[int, BBox]] | None = None,
        jitter_px: float = 0.0,
        dropout: float = 0.0,
        seed: int = 0,
        min_confidence: float = 0.0,
    ) -> None:
        self.truth = truth or {}
        self.jitter_px = jitter_px
        self.dropout = dropout
        self.rng = random.Random(seed)
        self.min_confidence = min_confidence

    def detect(self, frame: Frame) -> list[Detection]:
        out: list[Detection] = []
        for _fish_id, box in sorted(self.truth.get(frame.index, {}).items()):
            if self.dropout and self.rng.random() < self.dropout:
                continue
            j = self.jitter_px
            b = box
            if j:
                b = BBox(
                    box.x1 + self.rng.uniform(-j, j),
                    box.y1 + self.rng.uniform(-j, j),
                    box.x2 + self.rng.uniform(-j, j),
                    box.y2 + self.rng.uniform(-j, j),
                )
            out.append(Detection(b.clipped(frame.width, frame.height), 0.95, "fish", 0))
        return out

    def close(self) -> None:
        return None


@register_detector("synthetic")
def _build(cfg: dict[str, Any]) -> SyntheticDetector:
    sub = dict(cfg.get("synthetic", {}))
    sub.setdefault("min_confidence", float(cfg.get("min_confidence", 0.0)))
    return SyntheticDetector(**sub)
