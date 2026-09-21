"""Read frames from a file, a camera index, or a stream URL with OpenCV."""

from __future__ import annotations

import hashlib
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

import cv2

from fishai.types import Frame


@dataclass(frozen=True)
class VideoInfo:
    source: str
    width: int
    height: int
    fps: float
    frame_count: int  # 0 when unknown (live streams)

    @property
    def duration_s(self) -> float:
        return self.frame_count / self.fps if self.fps > 0 and self.frame_count > 0 else 0.0


def video_id_for(path: str | Path) -> str:
    """Stable id for a video file: sha256 of size + first/last 1 MB + name.

    Hashing the full file would be slow for hours of footage; this is stable
    across machines for the same file and cheap.
    """
    p = Path(path)
    if not p.exists():
        return hashlib.sha256(str(path).encode()).hexdigest()[:16]
    h = hashlib.sha256()
    size = p.stat().st_size
    h.update(str(size).encode())
    h.update(p.name.encode())
    chunk = 1024 * 1024
    with open(p, "rb") as fh:
        h.update(fh.read(chunk))
        if size > 2 * chunk:
            fh.seek(-chunk, 2)
            h.update(fh.read(chunk))
    return h.hexdigest()[:16]


def _open(source: str | int) -> cv2.VideoCapture:
    cap = cv2.VideoCapture(source)
    if not cap.isOpened():
        raise FileNotFoundError(f"could not open video source {source!r}")
    return cap


def probe_video(source: str | int) -> VideoInfo:
    cap = _open(source)
    try:
        return VideoInfo(
            source=str(source),
            width=int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
            height=int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
            fps=float(cap.get(cv2.CAP_PROP_FPS)) or 0.0,
            frame_count=max(0, int(cap.get(cv2.CAP_PROP_FRAME_COUNT))),
        )
    finally:
        cap.release()


class VideoReader:
    """Iterate ``Frame`` objects. ``stride`` skips frames; ``max_frames`` caps output.

    Timestamps come from the container when available, falling back to
    ``index / fps`` so speeds stay correct even for files with broken PTS.
    """

    def __init__(
        self,
        source: str | int,
        stride: int = 1,
        max_frames: int | None = None,
        max_side: int | None = None,
        assumed_fps: float = 30.0,
    ) -> None:
        self.source = source
        self.stride = max(1, int(stride))
        self.max_frames = max_frames
        self.max_side = max_side
        self.assumed_fps = assumed_fps
        self.info = probe_video(source)
        self.scale = 1.0
        if self.max_side and max(self.info.width, self.info.height) > self.max_side:
            self.scale = self.max_side / max(self.info.width, self.info.height)

    @property
    def fps(self) -> float:
        return self.info.fps if self.info.fps > 0 else self.assumed_fps

    @property
    def output_size(self) -> tuple[int, int]:
        return (int(round(self.info.width * self.scale)), int(round(self.info.height * self.scale)))

    def __iter__(self) -> Iterator[Frame]:
        cap = _open(self.source)
        emitted = 0
        index = 0
        try:
            while True:
                ok, image = cap.read()
                if not ok or image is None:
                    break
                if index % self.stride == 0:
                    ts_ms = cap.get(cv2.CAP_PROP_POS_MSEC)
                    # POS_MSEC is reported for the frame just read; guard against
                    # backends that return 0 or go backwards.
                    ts = ts_ms / 1000.0 if ts_ms and ts_ms > 0 else index / self.fps
                    if self.scale != 1.0:
                        image = cv2.resize(image, self.output_size, interpolation=cv2.INTER_AREA)
                    yield Frame(index=index, timestamp_s=float(ts), image=image)
                    emitted += 1
                    if self.max_frames is not None and emitted >= self.max_frames:
                        break
                index += 1
        finally:
            cap.release()
