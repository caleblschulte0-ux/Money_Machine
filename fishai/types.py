"""Shared data contracts.

Everything that crosses a stage boundary is one of these dataclasses. They are
plain data (no OpenCV, no torch) so storage, tests and the reasoner can use
them without importing perception dependencies.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any


class Zone(str, Enum):
    """Vertical tank zone of a fish, from its box centre."""

    SURFACE = "surface"
    MIDDLE = "middle"
    BOTTOM = "bottom"


@dataclass(frozen=True)
class BBox:
    """Axis-aligned box in pixel coordinates (x1, y1 top-left; x2, y2 bottom-right)."""

    x1: float
    y1: float
    x2: float
    y2: float

    @property
    def width(self) -> float:
        return max(0.0, self.x2 - self.x1)

    @property
    def height(self) -> float:
        return max(0.0, self.y2 - self.y1)

    @property
    def area(self) -> float:
        return self.width * self.height

    @property
    def center(self) -> tuple[float, float]:
        return ((self.x1 + self.x2) / 2.0, (self.y1 + self.y2) / 2.0)

    def iou(self, other: BBox) -> float:
        ix1, iy1 = max(self.x1, other.x1), max(self.y1, other.y1)
        ix2, iy2 = min(self.x2, other.x2), min(self.y2, other.y2)
        inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
        union = self.area + other.area - inter
        return inter / union if union > 0 else 0.0

    def clipped(self, width: int, height: int) -> BBox:
        return BBox(
            min(max(self.x1, 0.0), width),
            min(max(self.y1, 0.0), height),
            min(max(self.x2, 0.0), width),
            min(max(self.y2, 0.0), height),
        )

    def as_tuple(self) -> tuple[float, float, float, float]:
        return (self.x1, self.y1, self.x2, self.y2)


@dataclass(frozen=True)
class Detection:
    """One detector output on one frame. No identity yet."""

    bbox: BBox
    confidence: float
    class_name: str = "fish"
    class_id: int = 0


@dataclass(frozen=True)
class Frame:
    """A decoded video frame plus its position in the source."""

    index: int
    timestamp_s: float
    image: Any  # numpy array HxWx3 (BGR). Typed as Any to keep this module numpy-free.

    @property
    def height(self) -> int:
        return int(self.image.shape[0])

    @property
    def width(self) -> int:
        return int(self.image.shape[1])


@dataclass(frozen=True)
class TrackedObject:
    """A detection that a tracker has assigned a persistent id to."""

    track_id: int
    bbox: BBox
    confidence: float
    class_name: str = "fish"
    # Tracker's own confidence that this is the same fish as before (0..1).
    # Honest by design: a tracker that cannot estimate it reports 1.0 only for
    # a continuous unbroken track and lower after any re-association.
    identity_confidence: float = 1.0
    # How many consecutive frames this track has been observed.
    hits: int = 1
    # True if the tracker has re-linked this id after losing it.
    reacquired: bool = False


@dataclass
class Observation:
    """One row of raw telemetry: one tracked fish on one frame.

    This is the *raw* record preserved in storage. Derived metrics (speed,
    zone times, activity) are computed from sequences of these and stored
    separately so raw data and derived data never get mixed.
    """

    video_id: str
    frame_index: int
    timestamp_s: float
    track_id: int
    bbox: BBox
    confidence: float
    cx: float
    cy: float
    # Normalised position (0..1) so different resolutions compare.
    nx: float
    ny: float
    zone: Zone
    # Movement since the previous observation of this track (pixels, and px/s).
    dx: float = 0.0
    dy: float = 0.0
    displacement_px: float = 0.0
    speed_px_s: float = 0.0
    # Speed relative to tank height per second (resolution independent).
    speed_norm_s: float = 0.0
    identity_confidence: float = 1.0

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d["bbox"] = self.bbox.as_tuple()
        d["zone"] = self.zone.value
        return d


@dataclass
class TrackSummary:
    """Derived, per-track metrics over a whole video."""

    video_id: str
    track_id: int
    first_frame: int
    last_frame: int
    first_ts: float
    last_ts: float
    n_observations: int
    duration_s: float
    total_distance_px: float
    mean_speed_px_s: float
    max_speed_px_s: float
    mean_speed_norm_s: float
    activity_score: float
    # Fraction of observed time in each zone (sum to 1 when n_observations > 0).
    surface_fraction: float
    middle_fraction: float
    bottom_fraction: float
    surface_time_s: float
    middle_time_s: float
    bottom_time_s: float
    mean_nx: float
    mean_ny: float
    mean_confidence: float
    min_identity_confidence: float
    # Seconds this fish was not observed inside its lifetime (candidate hiding).
    missing_time_s: float
    longest_gap_s: float
    mean_box_area_px: float
    extra: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class VideoRecord:
    video_id: str
    path: str
    width: int
    height: int
    fps: float
    frame_count: int
    duration_s: float
    processed_at: str
    detector: str
    tracker: str
    config_hash: str
    camera_id: str = "cam1"
    # day | night | mixed | unknown, decided from the frames (fishai.perception.lighting)
    lighting_mode: str = "unknown"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
