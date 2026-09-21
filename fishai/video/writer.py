"""Write annotated frames to an mp4/avi with OpenCV."""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

_CODECS = {".mp4": "mp4v", ".avi": "MJPG", ".mkv": "mp4v", ".mov": "mp4v"}


class VideoWriter:
    def __init__(self, path: str | Path, fps: float, size: tuple[int, int]) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        codec = _CODECS.get(self.path.suffix.lower(), "mp4v")
        self._writer = cv2.VideoWriter(str(self.path), cv2.VideoWriter_fourcc(*codec), max(fps, 1.0), size)
        if not self._writer.isOpened():
            raise RuntimeError(f"could not open video writer for {self.path}")
        self.size = size
        self.frames_written = 0

    def write(self, image: np.ndarray) -> None:
        if (image.shape[1], image.shape[0]) != self.size:
            image = cv2.resize(image, self.size)
        self._writer.write(image)
        self.frames_written += 1

    def close(self) -> None:
        self._writer.release()

    def __enter__(self) -> VideoWriter:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()
