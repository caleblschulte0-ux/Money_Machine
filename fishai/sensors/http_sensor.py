"""Sensors read over HTTP: one JSON field (``http``) or the rail's whole
``/sensors`` document (``edge``), which expands into one Sensor per entry.

Standard library only. A request failure is a reading with status ``error``
so a dead Wi-Fi link shows up in the data instead of stopping the loop.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any

from fishai.sensors.base import Reading, now_iso, register_sensor


def fetch_json(url: str, timeout_s: float = 5.0) -> Any:
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout_s) as resp:  # noqa: S310 - configured URL
        return json.loads(resp.read().decode())


def _dig(obj: Any, dotted: str) -> Any:
    for part in dotted.split("."):
        if isinstance(obj, dict):
            obj = obj.get(part)
        else:
            return None
    return obj


class HttpSensor:
    source = "hardware"

    def __init__(self, name: str, kind: str, url: str, field: str = "value", unit: str = "", timeout_s: float = 5.0) -> None:
        self.name, self.kind, self.url, self.field, self.unit, self.timeout_s = name, kind, url, field, unit, timeout_s

    def read(self) -> Reading:
        try:
            value = _dig(fetch_json(self.url, self.timeout_s), self.field)
            if value is None:
                return Reading(self.name, self.kind, float("nan"), self.unit, self.source, now_iso(), "error")
            return Reading(self.name, self.kind, float(value), self.unit, self.source, now_iso())
        except (urllib.error.URLError, OSError, ValueError, TypeError):
            return Reading(self.name, self.kind, float("nan"), self.unit, self.source, now_iso(), "error")

    def close(self) -> None:
        return None


class EdgeSensor:
    """One named entry of the edge agent's ``/sensors`` document."""

    def __init__(self, base_url: str, name: str, kind: str, unit: str, timeout_s: float = 5.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.name, self.kind, self.unit, self.timeout_s = name, kind, unit, timeout_s
        self.source = "hardware"

    def read(self) -> Reading:
        try:
            doc = fetch_json(f"{self.base_url}/sensors", self.timeout_s)
            entry = doc.get(self.name) if isinstance(doc, dict) else None
            if not entry or entry.get("value") is None:
                return Reading(self.name, self.kind, float("nan"), self.unit, self.source, now_iso(), "error")
            src = str(entry.get("source", "hardware"))
            status = str(entry.get("status", "ok"))
            return Reading(self.name, self.kind, float(entry["value"]), str(entry.get("unit", self.unit)), src, now_iso(), status if status in ("ok", "low", "high", "stale") else "error")
        except (urllib.error.URLError, OSError, ValueError, TypeError):
            return Reading(self.name, self.kind, float("nan"), self.unit, self.source, now_iso(), "error")

    def close(self) -> None:
        return None


@register_sensor("http")
def _build_http(cfg: dict[str, Any]) -> HttpSensor:
    return HttpSensor(cfg["name"], cfg.get("measures", cfg["name"]), cfg["url"], cfg.get("field", "value"), cfg.get("unit", ""), float(cfg.get("timeout_s", 5)))


def edge_sensors(base_url: str, timeout_s: float = 5.0, names: list[str] | None = None) -> list[EdgeSensor]:
    """Expand the rail's sensor document into Sensor objects (asks it once)."""
    known = {"water_temperature": ("temperature", "F"), "water_level": ("water_level", "ok"), "ph": ("ph", "pH"), "dissolved_oxygen": ("dissolved_oxygen", "mg/L")}
    wanted = names
    if wanted is None:
        try:
            doc = fetch_json(f"{base_url.rstrip('/')}/sensors", timeout_s)
            wanted = list(doc) if isinstance(doc, dict) else list(known)
        except (urllib.error.URLError, OSError, ValueError):
            wanted = list(known)
    return [EdgeSensor(base_url, n, *known.get(n, (n, "")), timeout_s=timeout_s) for n in wanted]


@register_sensor("edge")
def _build_edge(cfg: dict[str, Any]) -> list[EdgeSensor]:
    return edge_sensors(cfg["url"], float(cfg.get("timeout_s", 5)), cfg.get("names"))
