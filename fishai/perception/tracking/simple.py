"""Built-in tracker: IoU association with appearance re-identification.

Deliberately small. Each frame:

1. Predict each live track's box by its last velocity (constant velocity).
2. Match detections to live tracks by IoU (Hungarian when scipy is present,
   greedy otherwise).
3. Unmatched detections try to re-link to *lost* tracks by appearance
   similarity and proximity (Phase 2). A re-link lowers the track's
   ``identity_confidence`` to the similarity score and marks it
   ``reacquired`` so downstream consumers can see the seam.
4. Whatever is still unmatched starts a new track.

Tracks are reported only after ``min_hits`` consecutive observations, so a
one-frame bubble does not become Fish #7.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np

from fishai.perception.tracking import appearance
from fishai.perception.tracking.base import register_tracker
from fishai.types import BBox, Detection, Frame, TrackedObject


@dataclass
class _Track:
    track_id: int
    bbox: BBox
    confidence: float
    class_name: str
    last_frame: int
    last_ts: float
    hits: int = 1
    age: int = 0  # frames since last match
    vx: float = 0.0
    vy: float = 0.0
    descriptor: np.ndarray | None = None
    identity_confidence: float = 1.0
    reacquired: bool = False
    lost_since_ts: float | None = None
    history: list[tuple[float, float]] = field(default_factory=list)

    def predicted(self) -> BBox:
        return BBox(self.bbox.x1 + self.vx, self.bbox.y1 + self.vy, self.bbox.x2 + self.vx, self.bbox.y2 + self.vy)


def _assign(cost: np.ndarray, threshold: float) -> list[tuple[int, int]]:
    """Maximise IoU. Returns (row, col) pairs with iou >= threshold."""
    if cost.size == 0:
        return []
    try:
        from scipy.optimize import linear_sum_assignment

        rows, cols = linear_sum_assignment(-cost)
        return [(int(r), int(c)) for r, c in zip(rows, cols, strict=True) if cost[r, c] >= threshold]
    except ImportError:
        pairs: list[tuple[int, int]] = []
        used_r: set[int] = set()
        used_c: set[int] = set()
        order = np.dstack(np.unravel_index(np.argsort(-cost, axis=None), cost.shape))[0]
        for r, c in order:
            if cost[r, c] < threshold:
                break
            if r in used_r or c in used_c:
                continue
            pairs.append((int(r), int(c)))
            used_r.add(int(r))
            used_c.add(int(c))
        return pairs


class SimpleTracker:
    name = "simple"

    def __init__(
        self,
        iou_threshold: float = 0.3,
        max_age_frames: int = 30,
        min_hits: int = 2,
        reid: dict[str, Any] | None = None,
        fps: float = 30.0,
    ) -> None:
        self.iou_threshold = iou_threshold
        self.max_age_frames = max_age_frames
        self.min_hits = max(1, min_hits)
        reid = reid or {}
        self.reid_enabled = bool(reid.get("enabled", True))
        self.reid_max_lost_s = float(reid.get("max_lost_s", 20.0))
        self.reid_min_similarity = float(reid.get("min_similarity", 0.6))
        self.reid_max_distance_frac = float(reid.get("max_distance_frac", 0.35))
        # A live track unmatched for this many frames is also a re-id candidate:
        # its constant-velocity prediction has drifted too far for IoU by then.
        self.reid_stale_frames = int(reid.get("stale_frames", 3))
        self.fps = fps
        self.reset()

    def reset(self) -> None:
        self._next_id = 1
        self._live: list[_Track] = []
        self._lost: list[_Track] = []

    # ------------------------------------------------------------------ update
    def update(self, frame: Frame, detections: list[Detection]) -> list[TrackedObject]:
        diag = float(np.hypot(frame.width, frame.height))
        # 1. cost matrix on predicted boxes
        preds = [t.predicted() for t in self._live]
        iou = np.zeros((len(self._live), len(detections)), dtype=np.float32)
        for i, p in enumerate(preds):
            for j, d in enumerate(detections):
                iou[i, j] = p.iou(d.bbox)
        pairs = _assign(iou, self.iou_threshold)
        matched_t = {i for i, _ in pairs}
        matched_d = {j for _, j in pairs}

        for i, j in pairs:
            self._observe(self._live[i], detections[j], frame)

        # 2. unmatched live tracks age; retire the old ones to `lost`
        still_live: list[_Track] = []
        for i, t in enumerate(self._live):
            if i in matched_t:
                still_live.append(t)
                continue
            t.age += 1
            if t.age > self.max_age_frames:
                if t.hits >= self.min_hits:
                    t.lost_since_ts = frame.timestamp_s
                    self._lost.append(t)
            else:
                still_live.append(t)
        self._live = still_live

        # 3. unmatched detections: re-id against lost tracks, else new track
        self._lost = [t for t in self._lost if t.lost_since_ts is None or frame.timestamp_s - t.lost_since_ts <= self.reid_max_lost_s]
        for j, d in enumerate(detections):
            if j in matched_d:
                continue
            desc = appearance.describe(frame.image, d.bbox)
            relinked = self._try_reid(d, desc, frame, diag) if self.reid_enabled else None
            if relinked is not None:
                self._observe(relinked, d, frame, descriptor=desc)
                if relinked not in self._live:
                    self._live.append(relinked)
                continue
            t = _Track(
                track_id=self._next_id,
                bbox=d.bbox,
                confidence=d.confidence,
                class_name=d.class_name,
                last_frame=frame.index,
                last_ts=frame.timestamp_s,
                descriptor=desc,
                history=[d.bbox.center],
            )
            self._next_id += 1
            self._live.append(t)

        # 4. report confirmed, currently matched tracks
        out: list[TrackedObject] = []
        for t in self._live:
            if t.age == 0 and t.hits >= self.min_hits:
                out.append(
                    TrackedObject(
                        track_id=t.track_id,
                        bbox=t.bbox,
                        confidence=t.confidence,
                        class_name=t.class_name,
                        identity_confidence=t.identity_confidence,
                        hits=t.hits,
                        reacquired=t.reacquired,
                    )
                )
                t.reacquired = False
        return out

    # ----------------------------------------------------------------- helpers
    def _observe(self, t: _Track, d: Detection, frame: Frame, descriptor: np.ndarray | None = None) -> None:
        cx, cy = d.bbox.center
        px, py = t.bbox.center
        frames_elapsed = max(1, frame.index - t.last_frame)
        t.vx = 0.7 * t.vx + 0.3 * (cx - px) / frames_elapsed
        t.vy = 0.7 * t.vy + 0.3 * (cy - py) / frames_elapsed
        t.bbox = d.bbox
        t.confidence = d.confidence
        t.last_frame = frame.index
        t.last_ts = frame.timestamp_s
        t.hits += 1
        t.age = 0
        t.history.append((cx, cy))
        if len(t.history) > 64:
            del t.history[0]
        if descriptor is None and self.reid_enabled and (t.hits % 5 == 0 or t.descriptor is None):
            descriptor = appearance.describe(frame.image, d.bbox)
        if descriptor is not None:
            t.descriptor = appearance.blend(t.descriptor, descriptor)

    def _try_reid(self, d: Detection, desc: np.ndarray | None, frame: Frame, diag: float) -> _Track | None:
        if desc is None:
            return None
        candidates = list(self._lost) + [t for t in self._live if t.age >= self.reid_stale_frames and t.hits >= self.min_hits]
        if not candidates:
            return None
        cx, cy = d.bbox.center
        best: tuple[float, _Track] | None = None
        for t in candidates:
            lx, ly = t.bbox.center
            dist = float(np.hypot(cx - lx, cy - ly)) / diag
            if dist > self.reid_max_distance_frac:
                continue
            sim = appearance.similarity(t.descriptor, desc)
            if sim < self.reid_min_similarity:
                continue
            # Prefer look-alikes; break ties by proximity.
            score = sim - 0.2 * dist
            if best is None or score > best[0]:
                best = (score, t)
        if best is None:
            return None
        t = best[1]
        if t in self._lost:
            self._lost.remove(t)
        sim = appearance.similarity(t.descriptor, desc)
        t.identity_confidence = min(t.identity_confidence, float(sim))
        t.reacquired = True
        t.age = 0
        t.lost_since_ts = None
        t.vx = t.vy = 0.0
        # Re-linking starts a fresh run of hits; the track was already confirmed.
        t.hits = max(t.hits, self.min_hits)
        return t


@register_tracker("simple")
def _build(cfg: dict[str, Any]) -> SimpleTracker:
    sub = dict(cfg.get("simple", {}))
    sub["fps"] = float(cfg.get("fps", 30.0))
    return SimpleTracker(**sub)
