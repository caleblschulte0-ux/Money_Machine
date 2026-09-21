"""Safe control (Phase 7): permission tiers, deterministic safety rules, actuators.

Nothing the reasoner says reaches hardware directly. The order is:

    proposed action -> permissions.tier() -> safety.check() -> actuator

and every step is journaled in the ``actions`` table, including refusals.
"""

from fishai.control.executor import ControlExecutor
from fishai.control.permissions import ACTIONS, ActionSpec, Tier, tier_for
from fishai.control.safety import SafetyDecision, check

__all__ = ["ACTIONS", "ActionSpec", "ControlExecutor", "SafetyDecision", "Tier", "check", "tier_for"]
