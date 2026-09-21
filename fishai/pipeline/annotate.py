"""Draw detections, ids and trails on frames for the annotated output video."""

from __future__ import annotations

from collections import defaultdict, deque

import cv2
import numpy as np

from fishai.perception.behavior.telemetry import ZoneModel
from fishai.types import Frame, TrackedObject

_PALETTE = [
    (66, 133, 244), (52, 168, 83), (251, 188, 5), (234, 67, 53), (171, 71, 188),
    (0, 172, 193), (255, 112, 67), (158, 157, 36), (92, 107, 192), (240, 98, 146),
]


def color_for(track_id: int) -> tuple[int, int, int]:
    r, g, b = _PALETTE[(track_id - 1) % len(_PALETTE)]
    return (b, g, r)


class Annotator:
    def __init__(self, trail_length: int = 30, draw_zones: bool = True, font_scale: float = 0.5, zones: ZoneModel | None = None) -> None:
        self.trail_length = trail_length
        self.draw_zones = draw_zones
        self.font_scale = font_scale
        self.zones = zones or ZoneModel()
        self._trails: dict[int, deque[tuple[int, int]]] = defaultdict(lambda: deque(maxlen=max(1, trail_length)))
        self._labels: dict[int, str] = {}

    def set_label(self, track_id: int, label: str) -> None:
        self._labels[track_id] = label

    def draw(self, frame: Frame, tracked: list[TrackedObject], header: str | None = None) -> np.ndarray:
        img = frame.image.copy()
        h, w = img.shape[:2]
        if self.draw_zones:
            for frac in (self.zones.surface_below, self.zones.bottom_above):
                y = int(frac * h)
                cv2.line(img, (0, y), (w, y), (200, 200, 200), 1, cv2.LINE_AA)
            cv2.putText(img, "surface", (4, int(self.zones.surface_below * h) - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (200, 200, 200), 1, cv2.LINE_AA)
            cv2.putText(img, "bottom", (4, int(self.zones.bottom_above * h) + 12), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (200, 200, 200), 1, cv2.LINE_AA)
        for t in tracked:
            c = color_for(t.track_id)
            x1, y1, x2, y2 = (int(round(v)) for v in t.bbox.as_tuple())
            cv2.rectangle(img, (x1, y1), (x2, y2), c, 2)
            cx, cy = (int(v) for v in t.bbox.center)
            self._trails[t.track_id].append((cx, cy))
            pts = list(self._trails[t.track_id])
            for a, b in zip(pts, pts[1:], strict=False):
                cv2.line(img, a, b, c, 1, cv2.LINE_AA)
            label = self._labels.get(t.track_id, f"#{t.track_id}")
            text = f"{label} {t.confidence:.2f}"
            if t.identity_confidence < 0.999:
                text += f" id~{t.identity_confidence:.2f}"
            (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, self.font_scale, 1)
            ty = y1 - 4 if y1 - th - 6 > 0 else y2 + th + 4
            cv2.rectangle(img, (x1, ty - th - 4), (x1 + tw + 4, ty + 2), c, -1)
            cv2.putText(img, text, (x1 + 2, ty - 2), cv2.FONT_HERSHEY_SIMPLEX, self.font_scale, (255, 255, 255), 1, cv2.LINE_AA)
        if header:
            cv2.putText(img, header, (6, h - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA)
        return img
