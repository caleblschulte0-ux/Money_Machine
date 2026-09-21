"""The action permission system.

Three tiers, decided here and nowhere else:

AUTO      may run unattended once the safety rules pass
APPROVAL  waits for the owner's explicit yes (a pending request is created)
FORBIDDEN never runs through this system, whatever anyone says

Widening a tier is a reviewed edit to this table, never a code path
around it. The reasoner's proposal list (``schema.PROPOSABLE_ACTIONS``)
is checked against this table by a test so the two cannot drift.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class Tier(str, Enum):
    AUTO = "auto"
    APPROVAL = "approval"
    FORBIDDEN = "forbidden"


@dataclass(frozen=True)
class ActionSpec:
    name: str
    tier: Tier
    description: str
    # Parameter names and (min, max) numeric bounds the safety rules enforce.
    params: dict[str, tuple[float, float]] = field(default_factory=dict)
    # Minimum seconds between two executions of this action (rate limit).
    min_interval_s: float = 0.0


ACTIONS: dict[str, ActionSpec] = {
    a.name: a
    for a in (
        # ---- automatically allowed ---------------------------------------
        ActionSpec("send_notification", Tier.AUTO, "Notify the owner", min_interval_s=60.0),
        ActionSpec("request_owner_check", Tier.AUTO, "Ask the owner to look at the tank", min_interval_s=300.0),
        ActionSpec("skip_next_feeding", Tier.AUTO, "Skip the next scheduled feeding", min_interval_s=3600.0),
        ActionSpec("reduce_feeding", Tier.AUTO, "Reduce the next portion", {"fraction": (0.25, 1.0)}, 3600.0),
        ActionSpec("increase_aeration", Tier.AUTO, "Raise air pump output within its safe range", {"percent": (0.0, 100.0)}, 60.0),
        ActionSpec("adjust_lighting", Tier.AUTO, "Set lighting within safe limits", {"percent": (0.0, 100.0)}, 60.0),
        ActionSpec("set_pump_mode", Tier.AUTO, "Switch between predefined safe pump modes", {}, 60.0),
        # ---- need the owner's approval ----------------------------------
        ActionSpec("feed_now", Tier.APPROVAL, "Dispense an extra portion", {"portions": (1.0, 1.0)}, 3600.0),
        ActionSpec("set_heater_setpoint", Tier.APPROVAL, "Change the heater target by a small step", {"delta_f": (-1.0, 1.0)}, 1800.0),
        ActionSpec("dose_chemical", Tier.APPROVAL, "Dose water conditioner or medication", {"ml": (0.0, 5.0)}, 3600.0),
        ActionSpec("water_change", Tier.APPROVAL, "Run an automatic water change", {"percent": (0.0, 25.0)}, 86400.0),
        # ---- never through this system ----------------------------------
        ActionSpec("disable_heater", Tier.FORBIDDEN, "Turn the heater off"),
        ActionSpec("disable_filter", Tier.FORBIDDEN, "Turn the filter off"),
        ActionSpec("large_temperature_change", Tier.FORBIDDEN, "Change temperature by more than the small step"),
        ActionSpec("drain_tank", Tier.FORBIDDEN, "Drain more than a water change"),
    )
}


def tier_for(action: str) -> Tier:
    """Unknown actions are FORBIDDEN: the permission system fails closed."""
    spec = ACTIONS.get(action)
    return spec.tier if spec else Tier.FORBIDDEN
