"""Simulated sensors: a baseline plus noise plus an optional slow drift.

They exist so every downstream consumer (storage, reasoner, safety rules)
can be built and tested before hardware arrives. ``source`` is always
``"simulated"`` and is stored with every reading; a simulated value can
never be mistaken for a measurement.
"""

from __future__ import annotations

import math
import random
import time
from typing import Any

from fishai.sensors.base import Reading, now_iso, register_sensor


class SimulatedSensor:
    source = "simulated"

    def __init__(
        self,
        name: str,
        kind: str,
        unit: str,
        baseline: float,
        noise: float = 0.1,
        drift_per_hour: float = 0.0,
        period_s: float | None = None,
        amplitude: float = 0.0,
        seed: int | None = None,
        clock: Any | None = None,
    ) -> None:
        self.name, self.kind, self.unit = name, kind, unit
        self.baseline, self.noise = float(baseline), float(noise)
        self.drift_per_hour = float(drift_per_hour)
        self.period_s, self.amplitude = period_s, float(amplitude)
        self.rng = random.Random(seed)
        self._clock = clock or time.time
        self._t0 = self._clock()
        self.override: float | None = None  # tests and demos: force a value

    def read(self) -> Reading:
        if self.override is not None:
            return Reading(self.name, self.kind, float(self.override), self.unit, self.source, now_iso())
        elapsed = self._clock() - self._t0
        value = self.baseline + self.drift_per_hour * elapsed / 3600.0 + self.rng.gauss(0.0, self.noise)
        if self.period_s and self.amplitude:
            value += self.amplitude * math.sin(2 * math.pi * elapsed / self.period_s)
        return Reading(self.name, self.kind, float(value), self.unit, self.source, now_iso())

    def close(self) -> None:
        return None


def _factory(kind: str, default_unit: str) -> Any:
    def build(cfg: dict[str, Any]) -> SimulatedSensor:
        return SimulatedSensor(
            name=cfg.get("name", kind),
            kind=kind,
            unit=cfg.get("unit", default_unit),
            baseline=cfg.get("baseline", 0.0),
            noise=cfg.get("noise", 0.1),
            drift_per_hour=cfg.get("drift_per_hour", 0.0),
            period_s=cfg.get("period_s"),
            amplitude=cfg.get("amplitude", 0.0),
            seed=cfg.get("seed"),
        )

    return build


register_sensor("simulated_temperature")(_factory("temperature", "F"))
register_sensor("simulated_water_level")(_factory("water_level", "cm"))
register_sensor("simulated_ph")(_factory("ph", "pH"))
register_sensor("simulated_dissolved_oxygen")(_factory("dissolved_oxygen", "mg/L"))
