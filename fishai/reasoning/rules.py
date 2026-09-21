"""Deterministic fallback reasoner.

Runs when no model is available (or as a floor under one). It turns the
deviations and sensor readings into the same ``Assessment`` shape a model
would, using plain thresholds, so the rest of the system never has to
special-case "no model today". It never diagnoses; it names what moved and
what to check.
"""

from __future__ import annotations

from typing import Any

from fishai.reasoning.base import register_reasoner
from fishai.reasoning.schema import Assessment

_CHECKS_BY_METRIC = {
    "surface_fraction": ["Check dissolved oxygen / surface agitation", "Check filter and air pump are running", "Check water temperature (warm water holds less oxygen)"],
    "bottom_fraction": ["Check water temperature", "Check for signs of stress or illness (clamped fins, colour)", "Check ammonia and nitrite"],
    "activity_score": ["Check water temperature", "Check ammonia, nitrite, nitrate", "Check for recent changes (water change, new fish, lighting)"],
    "mean_speed_norm_s": ["Check for aggression or chasing in the tank", "Check water parameters"],
    "missing_time_s": ["Look for the fish; check hiding spots, filter intake and behind decor", "Check for aggression from tank-mates"],
}


class RulesReasoner:
    name = "rules"
    model = "deterministic-v1"

    def available(self) -> bool:
        return True

    def assess(self, state: dict[str, Any]) -> Assessment:
        a = Assessment(source="rules", confidence=0.6)
        devs = state.get("deviations", [])
        sensors = state.get("sensors", {})
        checks: list[str] = []
        worst = "ok"
        rank = {"ok": 0, "info": 1, "warning": 2, "critical": 3}
        for d in devs:
            sev = d.get("severity", "info")
            if rank[sev] > rank[worst]:
                worst = sev
            a.observations.append(d.get("sentence") or f"Fish {d.get('fish_id')} {d.get('metric')} deviates from baseline")
            for c in _CHECKS_BY_METRIC.get(d.get("metric", ""), []):
                if c not in checks:
                    checks.append(c)
            if d.get("metric") == "surface_fraction" and d.get("direction") == "high" and rank[sev] >= rank["warning"]:
                if "increase_aeration" not in a.safe_actions:
                    a.safe_actions.append("increase_aeration")
        for name, r in sensors.items():
            status = r.get("status")
            if status in ("low", "high"):
                worst = "warning" if rank[worst] < 2 else worst
                a.observations.append(f"{name.replace('_', ' ')} is {status}: {r.get('value')} {r.get('unit', '')}".strip())
                checks.append(f"Verify {name.replace('_', ' ')} reading with a second instrument")
        if worst in ("warning", "critical"):
            if "send_notification" not in a.safe_actions:
                a.safe_actions.insert(0, "send_notification")
        if devs and not a.observations:
            a.observations.append("Deviations present but could not be summarised")
        if not devs and not any(r.get("status") in ("low", "high") for r in sensors.values()):
            a.observations.append("No behavioural deviations and sensors within range")
        a.severity = worst
        a.recommended_checks = checks[:12]
        a.rationale = "Deterministic rules over baseline deviations and sensor limits; no model consulted."
        return a


@register_reasoner("rules")
def _build(cfg: dict[str, Any]) -> RulesReasoner:
    return RulesReasoner()
