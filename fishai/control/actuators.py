"""Actuator interface plus a simulator. Hardware drivers register new kinds."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, Protocol

from fishai.log import get_logger

log = get_logger(__name__)


class Actuator(Protocol):
    name: str

    def apply(self, action: str, params: dict[str, Any]) -> dict[str, Any]: ...

    def state(self) -> dict[str, Any]: ...


class SimulatedActuator:
    """Keeps an equipment dictionary and mutates it the way hardware would."""

    name = "simulated"

    def __init__(self, initial: dict[str, Any] | None = None) -> None:
        self._state: dict[str, Any] = {
            "aeration_percent": 50.0,
            "lighting_percent": 60.0,
            "pump_mode": "normal",
            "pump_modes": ["normal", "night", "feeding"],
            "heater_setpoint_f": 78.0,
            "portions_fed_today": 0,
            "next_feeding_skipped": False,
            "next_feeding_fraction": 1.0,
            "notifications": [],
        }
        self._state.update(initial or {})

    def apply(self, action: str, params: dict[str, Any]) -> dict[str, Any]:
        s = self._state
        if action == "send_notification" or action == "request_owner_check":
            s["notifications"].append({"action": action, **params})
        elif action == "skip_next_feeding":
            s["next_feeding_skipped"] = True
        elif action == "reduce_feeding":
            s["next_feeding_fraction"] = float(params.get("fraction", 0.5))
        elif action == "increase_aeration":
            s["aeration_percent"] = max(s["aeration_percent"], float(params.get("percent", 100.0)))
        elif action == "adjust_lighting":
            s["lighting_percent"] = float(params["percent"])
        elif action == "set_pump_mode":
            s["pump_mode"] = str(params["mode"])
        elif action == "feed_now":
            s["portions_fed_today"] = int(s["portions_fed_today"]) + int(params.get("portions", 1))
        elif action == "set_heater_setpoint":
            s["heater_setpoint_f"] = float(s["heater_setpoint_f"]) + float(params["delta_f"])
        elif action == "dose_chemical":
            s.setdefault("doses", []).append({"ml": float(params.get("ml", 0.0)), **{k: v for k, v in params.items() if k != "ml"}})
        elif action == "water_change":
            s["last_water_change_percent"] = float(params.get("percent", 0.0))
        else:
            raise ValueError(f"simulated actuator has no handler for {action!r}")
        log.info("simulated actuator applied %s %s", action, params)
        return {"ok": True, "state": dict(s)}

    def state(self) -> dict[str, Any]:
        return dict(self._state)


class NullActuator:
    """Refuses everything; the honest choice when no hardware is configured."""

    name = "none"

    def apply(self, action: str, params: dict[str, Any]) -> dict[str, Any]:
        raise RuntimeError("no actuator configured; nothing was done")

    def state(self) -> dict[str, Any]:
        return {}


_REGISTRY: dict[str, Callable[[dict[str, Any]], Actuator]] = {
    "simulated": lambda cfg: SimulatedActuator(cfg.get("initial")),
    "none": lambda cfg: NullActuator(),
}


def build_actuator(control_cfg: dict[str, Any]) -> Actuator:
    backend = control_cfg.get("backend", "none")
    if backend not in _REGISTRY:
        raise ValueError(f"unknown actuator backend {backend!r}; available: {', '.join(sorted(_REGISTRY))}")
    return _REGISTRY[backend](control_cfg)
