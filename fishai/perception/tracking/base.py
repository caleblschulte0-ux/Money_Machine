"""Tracker interface and registry.

A tracker consumes one frame's detections and returns the same boxes with
persistent ``track_id`` values. Identity is a claim, so every tracked
object carries ``identity_confidence`` and ``reacquired``; downstream code
must not pretend an id is reliable when the tracker says it is not.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, Protocol

from fishai.types import Detection, Frame, TrackedObject


class Tracker(Protocol):
    name: str

    def update(self, frame: Frame, detections: list[Detection]) -> list[TrackedObject]: ...

    def reset(self) -> None: ...


TrackerFactory = Callable[[dict[str, Any]], Tracker]
_REGISTRY: dict[str, TrackerFactory] = {}


def register_tracker(name: str) -> Callable[[TrackerFactory], TrackerFactory]:
    def deco(factory: TrackerFactory) -> TrackerFactory:
        _REGISTRY[name] = factory
        return factory

    return deco


def _ensure_builtins() -> None:
    from fishai.perception.tracking import bytetrack, simple  # noqa: F401


def available_trackers() -> list[str]:
    _ensure_builtins()
    return sorted(_REGISTRY)


def build_tracker(tracking_cfg: dict[str, Any], backend: str | None = None, fps: float = 30.0) -> Tracker:
    _ensure_builtins()
    name = backend or tracking_cfg.get("backend", "simple")
    if name not in _REGISTRY:
        raise ValueError(f"unknown tracker {name!r}; available: {', '.join(sorted(_REGISTRY))}")
    cfg = dict(tracking_cfg)
    cfg["fps"] = fps
    return _REGISTRY[name](cfg)
