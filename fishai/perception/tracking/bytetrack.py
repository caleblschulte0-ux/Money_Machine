"""ByteTrack adapter (optional dependency).

Two providers, tried in order:

1. ``trackers`` (Roboflow's tracker library; ``pip install trackers``) -
   ``ByteTrackTracker`` with Kalman prediction and two-stage association.
2. ``supervision.ByteTrack`` - deprecated upstream since 0.28 and removed in
   0.31; kept as a fallback while the pin in requirements-ml.txt holds.

ByteTrack keeps low-confidence detections in a second association pass,
which helps when fish are partially occluded. It has no appearance model,
so identity after a long occlusion is a fresh id; ``identity_confidence``
is reported as 1.0 for continuous tracks and a track is never marked
``reacquired`` because ByteTrack never re-links. That is honest, not a
bug: the built-in tracker or a deep re-id stage supplies identity.
"""

from __future__ import annotations

from typing import Any

import numpy as np

from fishai.perception.tracking.base import register_tracker
from fishai.types import BBox, Detection, Frame, TrackedObject


class ByteTrackTracker:
    name = "bytetrack"

    def __init__(
        self,
        track_activation_threshold: float = 0.25,
        lost_track_buffer: int = 30,
        minimum_matching_threshold: float = 0.8,
        minimum_consecutive_frames: int = 1,
        fps: float = 30.0,
        provider: str = "auto",
    ) -> None:
        try:
            import supervision as sv
        except ImportError as exc:  # pragma: no cover
            raise ImportError("the bytetrack tracker needs `pip install -r requirements-ml.txt`") from exc
        self._sv = sv
        self._cfg = dict(
            track_activation_threshold=track_activation_threshold,
            lost_track_buffer=lost_track_buffer,
            minimum_matching_threshold=minimum_matching_threshold,
            minimum_consecutive_frames=minimum_consecutive_frames,
            frame_rate=max(1.0, float(fps)),
        )
        self.provider = self._pick_provider(provider)
        self._hits: dict[int, int] = {}
        self.reset()

    @staticmethod
    def _pick_provider(provider: str) -> str:
        if provider in ("trackers", "supervision"):
            return provider
        try:
            import trackers  # noqa: F401

            return "trackers"
        except ImportError:
            return "supervision"

    def reset(self) -> None:
        c = self._cfg
        if self.provider == "trackers":
            from trackers import ByteTrackTracker as _BT

            self._tracker = _BT(
                lost_track_buffer=int(c["lost_track_buffer"]),
                frame_rate=float(c["frame_rate"]),
                track_activation_threshold=float(c["track_activation_threshold"]),
                # `trackers` starts new tracks only from detections in its HIGH set, gated by a separate
                # threshold (default 0.6). Measured on a public clip whose detections sat near 0.35: zero
                # tracks. Tie the two together so track_activation_threshold is the one knob it claims to be.
                high_conf_det_threshold=float(c["track_activation_threshold"]),
                minimum_consecutive_frames=int(c["minimum_consecutive_frames"]),
                # supervision's "matching threshold" is a similarity; trackers wants a minimum IoU.
                minimum_iou_threshold=max(0.05, 1.0 - float(c["minimum_matching_threshold"])),
            )
        else:
            import warnings

            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                self._tracker = self._sv.ByteTrack(
                    track_activation_threshold=c["track_activation_threshold"],
                    lost_track_buffer=c["lost_track_buffer"],
                    minimum_matching_threshold=c["minimum_matching_threshold"],
                    minimum_consecutive_frames=c["minimum_consecutive_frames"],
                    frame_rate=int(round(c["frame_rate"])),
                )
        self._hits = {}

    def update(self, frame: Frame, detections: list[Detection]) -> list[TrackedObject]:
        sv = self._sv
        if detections:
            xyxy = np.array([d.bbox.as_tuple() for d in detections], dtype=np.float32)
            conf = np.array([d.confidence for d in detections], dtype=np.float32)
            cls = np.array([d.class_id for d in detections], dtype=int)
            dets = sv.Detections(xyxy=xyxy, confidence=conf, class_id=cls)
        else:
            dets = sv.Detections.empty()
        if self.provider == "trackers":
            tracked = self._tracker.update(dets, frame=frame.image, timestamp=frame.timestamp_s)
        else:
            tracked = self._tracker.update_with_detections(dets)
        out: list[TrackedObject] = []
        if tracked.tracker_id is None:
            return out
        names = {d.class_id: d.class_name for d in detections}
        for i in range(len(tracked)):
            tid = int(tracked.tracker_id[i])
            if tid < 0:
                # `trackers` returns -1 for detections not yet confirmed as a track.
                continue
            self._hits[tid] = self._hits.get(tid, 0) + 1
            x1, y1, x2, y2 = (float(v) for v in tracked.xyxy[i])
            conf = float(tracked.confidence[i]) if tracked.confidence is not None else 0.0
            cid = int(tracked.class_id[i]) if tracked.class_id is not None else 0
            out.append(TrackedObject(tid, BBox(x1, y1, x2, y2), conf, names.get(cid, "fish"), 1.0, self._hits[tid], False))
        return out


@register_tracker("bytetrack")
def _build(cfg: dict[str, Any]) -> ByteTrackTracker:
    sub = dict(cfg.get("bytetrack", {}))
    sub["fps"] = float(cfg.get("fps", 30.0))
    return ByteTrackTracker(**sub)
