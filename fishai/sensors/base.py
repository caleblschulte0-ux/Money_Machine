from __future__ import annotations

from collections.abc import Callable
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any, Protocol

from fishai.log import get_logger

log = get_logger(__name__)


@dataclass(frozen=True)
class Reading:
    sensor: str
    kind: str
    value: float
    unit: str
    source: str  # "simulated" | "hardware" | "file"
    recorded_at: str
    status: str = "ok"  # ok | low | high | stale | error

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class Sensor(Protocol):
    name: str
    kind: str
    unit: str
    source: str

    def read(self) -> Reading: ...

    def close(self) -> None: ...


SensorFactory = Callable[[dict[str, Any]], Sensor]
_REGISTRY: dict[str, SensorFactory] = {}


def register_sensor(kind: str) -> Callable[[SensorFactory], SensorFactory]:
    def deco(f: SensorFactory) -> SensorFactory:
        _REGISTRY[kind] = f
        return f

    return deco


def _ensure_builtins() -> None:
    from fishai.sensors import file_sensor, simulated  # noqa: F401


def available_sensor_kinds() -> list[str]:
    _ensure_builtins()
    return sorted(_REGISTRY)


def build_sensors(entries: list[dict[str, Any]]) -> list[Sensor]:
    _ensure_builtins()
    out: list[Sensor] = []
    for e in entries or []:
        kind = e.get("kind")
        if kind not in _REGISTRY:
            raise ValueError(f"unknown sensor kind {kind!r}; available: {', '.join(sorted(_REGISTRY))}")
        out.append(_REGISTRY[kind](dict(e)))
    return out


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def classify(value: float, low: float | None, high: float | None) -> str:
    if low is not None and value < low:
        return "low"
    if high is not None and value > high:
        return "high"
    return "ok"


class SensorHub:
    """Reads every configured sensor, applies limits, and optionally stores the readings."""

    def __init__(self, sensors: list[Sensor], limits: dict[str, dict[str, float]] | None = None) -> None:
        self.sensors = sensors
        self.limits = limits or {}

    def read_all(self, db: Any | None = None) -> dict[str, Reading]:
        out: dict[str, Reading] = {}
        for s in self.sensors:
            try:
                r = s.read()
            except Exception as exc:  # a dead probe must not stop the loop
                log.error("sensor %s failed: %s", s.name, exc)
                r = Reading(s.name, s.kind, float("nan"), s.unit, s.source, now_iso(), status="error")
            lim = self.limits.get(s.name, {})
            if r.status == "ok":
                r = Reading(r.sensor, r.kind, r.value, r.unit, r.source, r.recorded_at, classify(r.value, lim.get("low"), lim.get("high")))
            out[s.name] = r
            if db is not None and r.status != "error":
                db.add_sensor_reading(r.sensor, r.kind, r.value, r.unit, r.source, r.recorded_at)
        return out

    def close(self) -> None:
        for s in self.sensors:
            s.close()

    @staticmethod
    def state_for_reasoner(readings: dict[str, Reading]) -> dict[str, dict[str, Any]]:
        return {
            name: {"value": round(r.value, 2) if r.value == r.value else None, "unit": r.unit, "status": r.status, "source": r.source}
            for name, r in readings.items()
        }
