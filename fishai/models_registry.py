"""Model registry: which weights exist, where they come from, and their licences.

``models/registry.json`` is committed; the weights it describes are not.
``scripts/download_models.py`` fetches them into ``models/`` and this module
resolves a registry key to a local path (or errors with the exact command to
run). A key is the only thing config files mention, so swapping detectors is
a registry edit, not a code change.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fishai.config import REPO_ROOT

REGISTRY_PATH = REPO_ROOT / "models" / "registry.json"


def load_registry(path: Path | None = None) -> dict[str, dict[str, Any]]:
    p = path or REGISTRY_PATH
    with open(p, encoding="utf-8") as fh:
        data = json.load(fh)
    models = data.get("models", {})
    if not isinstance(models, dict):
        raise ValueError(f"{p}: 'models' must be a mapping")
    return models


def local_path_for(key: str, entry: dict[str, Any], models_dir: Path) -> Path:
    return models_dir / entry.get("local_dir", key) / entry["file"]


def resolve_model_path(model: str, models_dir: str | Path | None = None, registry_path: Path | None = None) -> Path:
    """Return a path to weights for ``model`` (a registry key or a filesystem path)."""
    direct = Path(model)
    if direct.suffix and direct.exists():
        return direct
    mdir = Path(models_dir) if models_dir else REPO_ROOT / "models"
    if not mdir.is_absolute():
        mdir = REPO_ROOT / mdir
    registry = load_registry(registry_path)
    if model not in registry:
        raise FileNotFoundError(f"model {model!r} is neither a file nor a key in {REGISTRY_PATH}")
    path = local_path_for(model, registry[model], mdir)
    if not path.exists():
        raise FileNotFoundError(f"weights for {model!r} not downloaded; run: python scripts/download_models.py {model}")
    return path
