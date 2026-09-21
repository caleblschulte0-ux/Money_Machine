"""Multi-object trackers. Pick one with ``build_tracker(config)``."""

from fishai.perception.tracking.base import (
    Tracker,
    available_trackers,
    build_tracker,
    register_tracker,
)

__all__ = ["Tracker", "available_trackers", "build_tracker", "register_tracker"]
