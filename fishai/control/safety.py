"""Deterministic safety rules applied to EVERY action before an actuator moves.

They know nothing about the reasoner. Inputs are the action, its
parameters, the configured hard limits, current equipment state and the
recent action history (for rate limits). Output is a decision with a
reason a person can read.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from fishai.control.permissions import ACTIONS, Tier, tier_for


@dataclass(frozen=True)
class SafetyDecision:
    allowed: bool
    tier: Tier
    reason: str
    normalised_params: dict[str, Any]


def _parse(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def check(
    action: str,
    params: dict[str, Any] | None,
    limits: dict[str, Any] | None,
    equipment: dict[str, Any] | None,
    recent_actions: list[dict[str, Any]] | None,
    now: datetime | None = None,
    halted: bool = False,
) -> SafetyDecision:
    params = dict(params or {})
    limits = limits or {}
    equipment = equipment or {}
    now = now or datetime.now(timezone.utc)
    tier = tier_for(action)
    spec = ACTIONS.get(action)

    if halted:
        return SafetyDecision(False, tier, "control is halted by the owner", params)
    if spec is None or tier == Tier.FORBIDDEN:
        return SafetyDecision(False, Tier.FORBIDDEN, f"{action!r} is forbidden (unknown actions are forbidden too)", params)

    # Parameter bounds from the spec.
    for name, (lo, hi) in spec.params.items():
        if name not in params:
            # Missing numeric parameter: use the safest end (the smaller change).
            params[name] = lo if abs(lo) < abs(hi) else hi
        try:
            v = float(params[name])
        except (TypeError, ValueError):
            return SafetyDecision(False, tier, f"{action}: parameter {name} must be a number", params)
        if not lo <= v <= hi:
            return SafetyDecision(False, tier, f"{action}: {name}={v} outside [{lo}, {hi}]", params)
        params[name] = v

    # Action-specific hard limits from configuration.
    if action == "adjust_lighting":
        lo, hi = float(limits.get("lighting_min_percent", 0)), float(limits.get("lighting_max_percent", 100))
        if not lo <= params["percent"] <= hi:
            return SafetyDecision(False, tier, f"lighting {params['percent']}% outside configured [{lo}, {hi}]", params)
    if action == "set_heater_setpoint":
        max_step = float(limits.get("heater_max_setpoint_change_f", 1.0))
        if abs(params["delta_f"]) > max_step:
            return SafetyDecision(False, tier, f"heater step {params['delta_f']}F exceeds {max_step}F", params)
        current = equipment.get("heater_setpoint_f")
        if current is not None:
            target = float(current) + params["delta_f"]
            lo, hi = float(limits.get("heater_setpoint_min_f", 72)), float(limits.get("heater_setpoint_max_f", 82))
            if not lo <= target <= hi:
                return SafetyDecision(False, tier, f"heater target {target}F outside [{lo}, {hi}]", params)
    if action in ("feed_now", "reduce_feeding", "skip_next_feeding"):
        fed_today = int(equipment.get("portions_fed_today", 0))
        if action == "feed_now" and fed_today >= int(limits.get("feed_max_portions_per_day", 3)):
            return SafetyDecision(False, tier, f"already fed {fed_today} portions today", params)
    if action == "set_pump_mode":
        modes = set(equipment.get("pump_modes", ["normal", "night", "feeding"]))
        mode = str(params.get("mode", "normal"))
        if mode not in modes:
            return SafetyDecision(False, tier, f"pump mode {mode!r} not in {sorted(modes)}", params)
        params["mode"] = mode

    # Rate limit against the executed history.
    if spec.min_interval_s > 0:
        for prior in recent_actions or []:
            if prior.get("action") == action and prior.get("executed"):
                try:
                    age = (now - _parse(prior["recorded_at"])).total_seconds()
                except (KeyError, ValueError):
                    continue
                if 0 <= age < spec.min_interval_s:
                    return SafetyDecision(False, tier, f"{action} ran {age:.0f}s ago; minimum interval {spec.min_interval_s:.0f}s", params)
                break

    if tier == Tier.APPROVAL:
        return SafetyDecision(False, tier, f"{action} needs the owner's approval", params)
    return SafetyDecision(True, tier, "within limits", params)
