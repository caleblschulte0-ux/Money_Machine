"""Model-free detector: background subtraction on a static camera.

Aquarium cameras do not move and fish do, so foreground blobs against a
learned background are a usable first detector. It needs no weights, runs
on any CPU, and lets the rest of the pipeline be exercised for real before
a neural detector is downloaded.

Two background methods:

``median`` (default)
    Temporal median over a rolling buffer of sampled frames. Measured on the
    synthetic tank against ground truth (tests/test_evaluation.py): F1 0.89,
    recall 0.92. Robust to a fish that pauses, because a median does not
    absorb it the way a running average does.
``mog2``
    OpenCV's Gaussian-mixture subtractor. Same clip, same settings: F1 0.85,
    recall 0.81, and purity 0.93 because it leaves a ghost blob where a fish
    was. Kept because it adapts faster to slow lighting change.

Known weaknesses, stated rather than hidden: bubbles, plants swaying in the
current, reflections and two touching fish become one blob. Confidence is a
blob-size heuristic, not a probability.
"""

from __future__ import annotations

from collections import deque
from typing import Any

import cv2
import numpy as np

from fishai.perception.detection.base import register_detector
from fishai.types import BBox, Detection, Frame


class MotionDetector:
    name = "motion"

    def __init__(
        self,
        method: str = "median",
        # median
        buffer_frames: int = 40,
        sample_every: int = 3,
        diff_threshold: int = 30,
        # mog2
        history: int = 300,
        var_threshold: float = 32.0,
        # shared
        min_area_px: int = 250,
        max_area_fraction: float = 0.25,
        blur_kernel: int = 5,
        dilate_iterations: int = 0,
        warmup_frames: int = 10,
        min_confidence: float = 0.0,
    ) -> None:
        if method not in {"median", "mog2"}:
            raise ValueError(f"motion.method must be 'median' or 'mog2', got {method!r}")
        self.method = method
        self.buffer_frames = max(3, int(buffer_frames))
        self.sample_every = max(1, int(sample_every))
        self.diff_threshold = int(diff_threshold)
        self._buffer: deque[np.ndarray] = deque(maxlen=self.buffer_frames)
        self._background: np.ndarray | None = None
        self._sub = cv2.createBackgroundSubtractorMOG2(history=history, varThreshold=var_threshold, detectShadows=False) if method == "mog2" else None
        self.min_area_px = min_area_px
        self.max_area_fraction = max_area_fraction
        self.blur_kernel = blur_kernel if blur_kernel % 2 == 1 else blur_kernel + 1
        self.dilate_iterations = dilate_iterations
        self.warmup_frames = warmup_frames
        self.min_confidence = min_confidence
        self._seen = 0
        self._kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))

    # ------------------------------------------------------------------ mask
    def _foreground_mask(self, image: np.ndarray) -> np.ndarray | None:
        if self._sub is not None:
            return self._sub.apply(image)
        if (self._seen - 1) % self.sample_every == 0 or not self._buffer:
            self._buffer.append(image)
            if len(self._buffer) >= 3:
                self._background = np.median(np.stack(self._buffer), axis=0).astype(np.uint8)
        if self._background is None:
            return None
        diff = cv2.absdiff(image, self._background).max(axis=2)
        return ((diff > self.diff_threshold).astype(np.uint8)) * 255

    @property
    def background(self) -> np.ndarray | None:
        """The learned background (median method only); handy for debugging."""
        return self._background

    # ---------------------------------------------------------------- detect
    def detect(self, frame: Frame) -> list[Detection]:
        image = frame.image
        if self.blur_kernel > 1:
            image = cv2.GaussianBlur(image, (self.blur_kernel, self.blur_kernel), 0)
        self._seen += 1
        mask = self._foreground_mask(image)
        if mask is None or self._seen <= self.warmup_frames:
            return []
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, self._kernel)
        if self.dilate_iterations > 0:
            mask = cv2.dilate(mask, self._kernel, iterations=self.dilate_iterations)
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        frame_area = float(frame.width * frame.height)
        max_area = frame_area * self.max_area_fraction
        out: list[Detection] = []
        for c in contours:
            area = cv2.contourArea(c)
            if area < self.min_area_px or area > max_area:
                continue
            x, y, w, h = cv2.boundingRect(c)
            fill = area / float(max(1, w * h))
            size_score = min(1.0, area / (self.min_area_px * 4.0))
            confidence = float(np.clip(0.5 * fill + 0.5 * size_score, 0.05, 0.99))
            if confidence < self.min_confidence:
                continue
            out.append(Detection(BBox(float(x), float(y), float(x + w), float(y + h)), confidence, "fish", 0))
        return out

    def close(self) -> None:
        return None


@register_detector("motion")
def _build(cfg: dict[str, Any]) -> MotionDetector:
    sub = dict(cfg.get("motion", {}))
    sub.setdefault("min_confidence", float(cfg.get("min_confidence", 0.0)))
    return MotionDetector(**sub)
