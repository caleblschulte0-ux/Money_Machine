"""Runs proposed actions through permissions and safety, then the actuator.

Everything is journaled in the ``actions`` table: what was asked, by whom,
the tier, whether it ran and why. Approval-tier actions are recorded as
``pending`` and only run through ``approve()`` with the owner's own call.
"""

from __future__ import annotations

from typing import Any

from fishai.control.actuators import Actuator, build_actuator
from fishai.control.permissions import Tier
from fishai.control.safety import SafetyDecision, check
from fishai.log import get_logger
from fishai.storage import Database

log = get_logger(__name__)


class ControlExecutor:
    def __init__(self, db: Database, control_cfg: dict[str, Any], actuator: Actuator | None = None) -> None:
        self.db = db
        self.limits = dict(control_cfg.get("limits", {}))
        self.actuator = actuator or build_actuator(control_cfg)
        self.halted = False

    def halt(self) -> None:
        self.halted = True
        self.db.add_event("control_halted")

    def resume(self) -> None:
        self.halted = False
        self.db.add_event("control_resumed")

    def _decide(self, action: str, params: dict[str, Any] | None) -> SafetyDecision:
        return check(action, params, self.limits, self.actuator.state(), self.db.actions(limit=50), halted=self.halted)

    def request(self, action: str, params: dict[str, Any] | None = None, requested_by: str = "reasoner") -> dict[str, Any]:
        """Propose an action. AUTO runs if safe; APPROVAL is recorded pending; FORBIDDEN is refused."""
        d = self._decide(action, params)
        if d.allowed:
            try:
                result = self.actuator.apply(action, d.normalised_params)
            except Exception as exc:
                self.db.add_action(action, d.normalised_params, requested_by, d.tier.value, False, f"actuator failed: {exc}")
                return {"action": action, "executed": False, "tier": d.tier.value, "reason": f"actuator failed: {exc}"}
            self.db.add_action(action, d.normalised_params, requested_by, d.tier.value, True, d.reason)
            return {"action": action, "executed": True, "tier": d.tier.value, "reason": d.reason, "result": result}
        permission = "pending" if d.tier == Tier.APPROVAL and not self.halted and "outside" not in d.reason and "exceeds" not in d.reason else d.tier.value
        self.db.add_action(action, d.normalised_params, requested_by, permission, False, d.reason)
        return {"action": action, "executed": False, "tier": d.tier.value, "reason": d.reason, "permission": permission}

    def approve(self, action: str, params: dict[str, Any] | None = None, approved_by: str = "owner") -> dict[str, Any]:
        """The owner's explicit yes for an APPROVAL-tier action. Safety rules still apply."""
        d = self._decide(action, params)
        if d.tier == Tier.FORBIDDEN or self.halted:
            self.db.add_action(action, d.normalised_params, approved_by, d.tier.value, False, d.reason)
            return {"action": action, "executed": False, "reason": d.reason}
        if not d.allowed and d.tier == Tier.AUTO:
            self.db.add_action(action, d.normalised_params, approved_by, d.tier.value, False, d.reason)
            return {"action": action, "executed": False, "reason": d.reason}
        if d.tier == Tier.APPROVAL and d.reason != f"{action} needs the owner's approval":
            # A bounds or rate-limit failure: approval does not override the rules.
            self.db.add_action(action, d.normalised_params, approved_by, d.tier.value, False, d.reason)
            return {"action": action, "executed": False, "reason": d.reason}
        result = self.actuator.apply(action, d.normalised_params)
        self.db.add_action(action, d.normalised_params, approved_by, "approved", True, "owner approved")
        return {"action": action, "executed": True, "reason": "owner approved", "result": result}

    def run_assessment_actions(self, safe_actions: list[str], requested_by: str = "reasoner") -> list[dict[str, Any]]:
        return [self.request(a, None, requested_by) for a in safe_actions]

    def pending(self) -> list[dict[str, Any]]:
        return [a for a in self.db.actions(limit=100) if a["permission"] == "pending"]
