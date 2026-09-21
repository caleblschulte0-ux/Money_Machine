"""Configuration loading.

All tunables live in ``configs/default.yaml``. A run may override any key
with a second YAML file (``--config``) or ``KEY=VALUE`` dotted overrides on the
command line. Nothing in the code hardcodes a path, a threshold or a model
name; if you find one, move it here.
"""

from __future__ import annotations

import copy
import hashlib
import json
import os
from pathlib import Path
from typing import Any

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CONFIG_PATH = REPO_ROOT / "configs" / "default.yaml"


class Config(dict):
    """A dict with dotted-path access: ``cfg.get_path("tracking.simple.iou_threshold")``."""

    def get_path(self, dotted: str, default: Any = None) -> Any:
        node: Any = self
        for part in dotted.split("."):
            if not isinstance(node, dict) or part not in node:
                return default
            node = node[part]
        return node

    def set_path(self, dotted: str, value: Any) -> None:
        parts = dotted.split(".")
        node: dict[str, Any] = self
        for part in parts[:-1]:
            node = node.setdefault(part, {})
            if not isinstance(node, dict):
                raise KeyError(f"{dotted}: {part} is not a mapping")
        node[parts[-1]] = value

    def section(self, name: str) -> dict[str, Any]:
        value = self.get(name, {})
        return value if isinstance(value, dict) else {}

    def hash(self) -> str:
        """Stable short hash of the effective configuration, stored with every run."""
        blob = json.dumps(self, sort_keys=True, default=str).encode()
        return hashlib.sha256(blob).hexdigest()[:12]

    def resolve_path(self, dotted: str) -> Path:
        """Resolve a path-valued key relative to the repo root unless absolute."""
        raw = self.get_path(dotted)
        if raw is None:
            raise KeyError(f"config has no path at {dotted}")
        p = Path(os.path.expandvars(os.path.expanduser(str(raw))))
        return p if p.is_absolute() else REPO_ROOT / p


def _deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    out = copy.deepcopy(base)
    for k, v in override.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = copy.deepcopy(v)
    return out


def _parse_scalar(text: str) -> Any:
    try:
        return yaml.safe_load(text)
    except yaml.YAMLError:
        return text


def load_config(
    path: str | os.PathLike[str] | None = None,
    overrides: list[str] | dict[str, Any] | None = None,
) -> Config:
    """Load default.yaml, then an optional override file, then dotted overrides."""
    with open(DEFAULT_CONFIG_PATH, encoding="utf-8") as fh:
        data = yaml.safe_load(fh) or {}
    if path:
        with open(path, encoding="utf-8") as fh:
            extra = yaml.safe_load(fh) or {}
        if not isinstance(extra, dict):
            raise ValueError(f"{path}: top level must be a mapping")
        data = _deep_merge(data, extra)
    cfg = Config(data)
    if isinstance(overrides, dict):
        for k, v in overrides.items():
            cfg.set_path(k, v)
    elif overrides:
        for item in overrides:
            if "=" not in item:
                raise ValueError(f"override {item!r} must look like key.path=value")
            k, v = item.split("=", 1)
            cfg.set_path(k.strip(), _parse_scalar(v.strip()))
    return cfg
