"""Reasoner interface and registry."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, Protocol

from fishai.reasoning.schema import Assessment


class Reasoner(Protocol):
    name: str
    model: str

    def assess(self, state: dict[str, Any]) -> Assessment: ...

    def available(self) -> bool: ...


ReasonerFactory = Callable[[dict[str, Any]], Reasoner]
_REGISTRY: dict[str, ReasonerFactory] = {}


def register_reasoner(name: str) -> Callable[[ReasonerFactory], ReasonerFactory]:
    def deco(f: ReasonerFactory) -> ReasonerFactory:
        _REGISTRY[name] = f
        return f

    return deco


def _ensure_builtins() -> None:
    from fishai.reasoning import rules  # noqa: F401
    from fishai.reasoning.qwen import ollama  # noqa: F401


def build_reasoner(reasoning_cfg: dict[str, Any], backend: str | None = None) -> Reasoner:
    _ensure_builtins()
    name = backend or reasoning_cfg.get("backend", "rules")
    if name not in _REGISTRY:
        raise ValueError(f"unknown reasoner {name!r}; available: {', '.join(sorted(_REGISTRY))}")
    return _REGISTRY[name](reasoning_cfg)
