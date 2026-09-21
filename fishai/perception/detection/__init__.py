"""Fish detectors. Pick one with ``build_detector(config)``."""

from fishai.perception.detection.base import (
    Detector,
    available_detectors,
    build_detector,
    register_detector,
)

__all__ = ["Detector", "available_detectors", "build_detector", "register_detector"]
