"""The contract between the reasoner and everything downstream.

The model returns JSON. This module is what makes that JSON safe to act
on: every field is validated, unknown actions are dropped, severity is
forced into the enum, and free text is length-capped. The reasoner's
prose never reaches an actuator; only ``safe_actions`` that survive
validation AND the control layer's own permission check do.
"""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass, field
from typing import Any

SEVERITIES = ("ok", "info", "warning", "critical")

# Actions the reasoner may *propose*. The control layer decides what may
# *run* (fishai.control.permissions). Keep both lists in sync by test.
PROPOSABLE_ACTIONS = (
    "send_notification",
    "skip_next_feeding",
    "reduce_feeding",
    "increase_aeration",
    "adjust_lighting",
    "set_pump_mode",
    "request_owner_check",
)

_MAX_ITEMS = 12
_MAX_TEXT = 240


@dataclass
class Assessment:
    severity: str = "ok"
    observations: list[str] = field(default_factory=list)
    possible_causes: list[str] = field(default_factory=list)
    recommended_checks: list[str] = field(default_factory=list)
    safe_actions: list[str] = field(default_factory=list)
    confidence: float = 0.0
    rationale: str = ""
    # Which backend produced it and anything the validator had to drop.
    source: str = "unset"
    dropped: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _clean_text(x: Any) -> str | None:
    if not isinstance(x, str):
        return None
    t = re.sub(r"\s+", " ", x).strip()
    return t[:_MAX_TEXT] if t else None


def _clean_list(x: Any, dropped: list[str], name: str) -> list[str]:
    if x is None:
        return []
    if not isinstance(x, list):
        dropped.append(f"{name}: not a list")
        return []
    out = []
    for item in x[:_MAX_ITEMS]:
        t = _clean_text(item)
        if t:
            out.append(t)
        else:
            dropped.append(f"{name}: non-text item")
    return out


def validate(raw: Any, source: str) -> Assessment:
    """Turn whatever the model returned into a valid ``Assessment``.

    Never raises on bad content: a model that emits garbage produces an
    ``info`` assessment whose ``dropped`` list says what was wrong.
    """
    a = Assessment(source=source)
    if not isinstance(raw, dict):
        a.severity = "info"
        a.dropped.append("response was not a JSON object")
        a.observations = ["Reasoner returned an unusable response; no assessment made."]
        return a
    sev = str(raw.get("severity", "")).lower().strip()
    if sev not in SEVERITIES:
        a.dropped.append(f"severity {sev!r} not in {SEVERITIES}")
        sev = "info"
    a.severity = sev
    a.observations = _clean_list(raw.get("observations"), a.dropped, "observations")
    a.possible_causes = _clean_list(raw.get("possible_causes"), a.dropped, "possible_causes")
    a.recommended_checks = _clean_list(raw.get("recommended_checks"), a.dropped, "recommended_checks")
    actions = []
    for item in _clean_list(raw.get("safe_actions"), a.dropped, "safe_actions"):
        key = item.strip().lower().replace(" ", "_")
        if key in PROPOSABLE_ACTIONS:
            if key not in actions:
                actions.append(key)
        else:
            a.dropped.append(f"safe_actions: {item!r} is not a proposable action")
    a.safe_actions = actions
    try:
        a.confidence = max(0.0, min(1.0, float(raw.get("confidence", 0.0))))
    except (TypeError, ValueError):
        a.dropped.append("confidence: not a number")
    a.rationale = _clean_text(raw.get("rationale")) or ""
    return a


def extract_json(text: str) -> Any:
    """Pull the first JSON object out of model output (tolerates code fences and chatter)."""
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.S)
    if fence:
        text = fence.group(1)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    start = text.find("{")
    while start != -1:
        depth = 0
        for i in range(start, len(text)):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text[start : i + 1])
                    except json.JSONDecodeError:
                        break
        start = text.find("{", start + 1)
    return None


RESPONSE_FORMAT: dict[str, Any] = {
    "type": "object",
    "properties": {
        "severity": {"type": "string", "enum": list(SEVERITIES)},
        "observations": {"type": "array", "items": {"type": "string"}},
        "possible_causes": {"type": "array", "items": {"type": "string"}},
        "recommended_checks": {"type": "array", "items": {"type": "string"}},
        "safe_actions": {"type": "array", "items": {"type": "string", "enum": list(PROPOSABLE_ACTIONS)}},
        "confidence": {"type": "number"},
        "rationale": {"type": "string"},
    },
    "required": ["severity", "observations", "recommended_checks", "safe_actions"],
}
