"""Validate a configuration before an unattended run starts.

Two kinds of mistakes are caught: keys that do not exist (a typo in an
override YAML silently does nothing otherwise) and values of the wrong
shape or outside a sane range. Unknown keys are warnings inside free-form
sections (``sensors``, ``notify.backends``) and errors elsewhere.
"""

from __future__ import annotations

from typing import Any

import yaml

from fishai.config import DEFAULT_CONFIG_PATH, Config

FREEFORM = {"sensors", "sensor_limits", "notify.backends", "detection.synthetic", "control.initial"}
CHOICES = {
    "detection.backend": {"motion", "yolo", "synthetic"},
    "detection.motion.method": {"median", "mog2"},
    "tracking.backend": {"simple", "bytetrack"},
    "tracking.bytetrack.provider": {"auto", "trackers", "supervision"},
    "reasoning.backend": {"ollama", "rules"},
    "control.backend": {"simulated", "none", "edge"},
    "camera.view": {"side", "top", "oblique"},
    "notify.min_severity": {"ok", "info", "warning", "critical"},
}
RANGES = {
    "video.frame_stride": (1, 1000),
    "detection.min_confidence": (0.0, 1.0),
    "tracking.simple.iou_threshold": (0.0, 1.0),
    "tracking.simple.reid.min_similarity": (0.0, 1.0),
    "behavior.zones.surface_below": (0.0, 1.0),
    "behavior.zones.bottom_above": (0.0, 1.0),
    "baselines.window_sessions": (1, 1000),
    "baselines.min_sessions": (1, 1000),
    "live.session_s": (10, 86400),
    "live.target_fps": (0.5, 120),
    "live.buffer_s": (0, 600),
    "feeding.after_s": (1, 3600),
    "retention.observations_days": (0, 3650),
    "retention.clips_max_gb": (0, 10000),
    "camera.lighting.night_saturation_below": (0.0, 1.0),
}


def _flatten(d: dict[str, Any], prefix: str = "") -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in d.items():
        key = f"{prefix}{k}"
        if isinstance(v, dict) and not any(key == f or key.startswith(f + ".") for f in FREEFORM):
            out.update(_flatten(v, key + "."))
        else:
            out[key] = v
    return out


def check_config(cfg: Config) -> dict[str, list[str]]:
    """Return {"errors": [...], "warnings": [...]}; empty errors means safe to run."""
    with open(DEFAULT_CONFIG_PATH, encoding="utf-8") as fh:
        defaults = _flatten(yaml.safe_load(fh) or {})
    flat = _flatten(dict(cfg))
    errors: list[str] = []
    warnings: list[str] = []
    for key, value in flat.items():
        if key not in defaults:
            if any(key.startswith(f + ".") or key == f for f in FREEFORM):
                continue
            errors.append(f"unknown key {key!r} (typo? see configs/default.yaml)")
            continue
        d = defaults[key]
        if d is not None and value is not None and type(value) is not type(d) and not (isinstance(d, float) and isinstance(value, int)) and not (isinstance(d, int) and isinstance(value, float)):
            errors.append(f"{key}: expected {type(d).__name__}, got {type(value).__name__} ({value!r})")
        if key in CHOICES and value not in CHOICES[key]:
            errors.append(f"{key}: {value!r} is not one of {sorted(CHOICES[key])}")
        if key in RANGES and isinstance(value, (int, float)) and not isinstance(value, bool):
            lo, hi = RANGES[key]
            if not lo <= value <= hi:
                errors.append(f"{key}: {value} outside [{lo}, {hi}]")
    zones = cfg.get_path("behavior.zones", {}) or {}
    if float(zones.get("surface_below", 0.2)) >= float(zones.get("bottom_above", 0.8)):
        errors.append("behavior.zones: surface_below must be less than bottom_above")
    if cfg.get_path("detection.backend") == "yolo":
        from fishai.models_registry import load_registry

        model = str(cfg.get_path("detection.yolo.model", ""))
        try:
            if model not in load_registry() and not model.endswith((".pt", ".onnx")):
                errors.append(f"detection.yolo.model: {model!r} is neither a registry key nor a weights file")
        except (OSError, ValueError) as exc:
            errors.append(f"models/registry.json unreadable: {exc}")
    if cfg.get_path("control.backend") == "edge" and not cfg.get_path("control.edge_url"):
        errors.append("control.backend is edge but control.edge_url is empty")
    for i, s in enumerate(cfg.get("sensors", []) or []):
        if not isinstance(s, dict) or "kind" not in s:
            errors.append(f"sensors[{i}]: needs a kind")
        elif s["kind"] in ("edge", "http") and not s.get("url"):
            errors.append(f"sensors[{i}]: {s['kind']} needs a url")
    for i, b in enumerate(cfg.get_path("notify.backends") or []):
        kind = b.get("kind") if isinstance(b, dict) else None
        if kind == "ntfy" and not b.get("topic"):
            errors.append(f"notify.backends[{i}]: ntfy needs a topic")
        if kind == "webhook" and not b.get("url"):
            errors.append(f"notify.backends[{i}]: webhook needs a url")
        if kind == "email" and not (b.get("host") and b.get("to")):
            errors.append(f"notify.backends[{i}]: email needs host and to")
    if cfg.get_path("live.edge_url") and not str(cfg.get_path("live.edge_url")).startswith("http"):
        errors.append("live.edge_url must start with http:// or https://")
    return {"errors": errors, "warnings": warnings}
