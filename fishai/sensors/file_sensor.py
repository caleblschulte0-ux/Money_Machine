"""A sensor that reads its latest value from a small JSON file.

This is the bridge to hardware you do not have a driver for yet: any
script, microcontroller serial logger or home-automation hook that can
write ``{"value": 78.4, "unit": "F", "recorded_at": "..."}`` to a file is
a sensor. Readings older than ``max_age_s`` are reported as ``stale``.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fishai.sensors.base import Reading, now_iso, register_sensor


class FileSensor:
    source = "file"

    def __init__(self, name: str, kind: str, path: str, unit: str = "", max_age_s: float = 600.0) -> None:
        self.name, self.kind, self.unit = name, kind, unit
        self.path = Path(path)
        self.max_age_s = max_age_s

    def read(self) -> Reading:
        data = json.loads(self.path.read_text(encoding="utf-8"))
        value = float(data["value"])
        unit = str(data.get("unit", self.unit))
        recorded_at = str(data.get("recorded_at") or now_iso())
        status = "ok"
        try:
            ts = datetime.fromisoformat(recorded_at.replace("Z", "+00:00"))
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            if (datetime.now(timezone.utc) - ts).total_seconds() > self.max_age_s:
                status = "stale"
        except ValueError:
            status = "stale"
        return Reading(self.name, self.kind, value, unit, self.source, recorded_at, status)

    def close(self) -> None:
        return None


@register_sensor("file")
def _build(cfg: dict[str, Any]) -> FileSensor:
    return FileSensor(cfg["name"], cfg.get("measures", cfg["name"]), cfg["path"], cfg.get("unit", ""), float(cfg.get("max_age_s", 600)))
