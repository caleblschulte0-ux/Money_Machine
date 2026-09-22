"""Detector interface and registry.

A detector turns one frame into a list of ``Detection``. It has no memory
of identity; that is the tracker's job. Backends register themselves by
name so ``configs/default.yaml`` can pick one and nothing else needs to
import torch.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, Protocol

from fishai.types import Detection, Frame


class Detector(Protocol):
    name: str

    def detect(self, frame: Frame) -> list[Detection]: ...

    def close(self) -> None: ...


DetectorFactory = Callable[[dict[str, Any]], Detector]
_REGISTRY: dict[str, DetectorFactory] = {}


def register_detector(name: str) -> Callable[[DetectorFactory], DetectorFactory]:
    def deco(factory: DetectorFactory) -> DetectorFactory:
        _REGISTRY[name] = factory
        return factory

    return deco


def available_detectors() -> list[str]:
    _ensure_builtins()
    return sorted(_REGISTRY)


def _ensure_builtins() -> None:
    # Import for side effects (registration). Each module guards its heavy imports.
    from fishai.perception.detection import motion, synthetic, torchvision_det, yolo  # noqa: F401


def build_detector(detection_cfg: dict[str, Any], backend: str | None = None) -> Detector:
    """Build the detector named by ``backend`` (or ``detection_cfg['backend']``).

    ``detection_cfg`` is the whole ``detection:`` section; the factory
    receives it and reads its own sub-section plus shared keys like
    ``min_confidence``.
    """
    _ensure_builtins()
    name = backend or detection_cfg.get("backend", "motion")
    if name not in _REGISTRY:
        raise ValueError(f"unknown detector {name!r}; available: {', '.join(sorted(_REGISTRY))}")
    return _REGISTRY[name](detection_cfg)
