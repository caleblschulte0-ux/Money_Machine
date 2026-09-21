from datetime import datetime, timezone

import pytest

from fishai.config import load_config
from fishai.control import ACTIONS, ControlExecutor, Tier, check, tier_for
from fishai.control.actuators import NullActuator, SimulatedActuator


@pytest.fixture
def executor(db):
    return ControlExecutor(db, load_config().section("control"))


def test_unknown_actions_are_forbidden():
    assert tier_for("launch_missiles") == Tier.FORBIDDEN
    d = check("launch_missiles", {}, {}, {}, [])
    assert not d.allowed and d.tier == Tier.FORBIDDEN


def test_tiers_are_as_designed():
    assert tier_for("increase_aeration") == Tier.AUTO
    assert tier_for("dose_chemical") == Tier.APPROVAL
    assert tier_for("disable_heater") == Tier.FORBIDDEN
    assert tier_for("large_temperature_change") == Tier.FORBIDDEN


def test_auto_action_runs_and_is_journaled(executor, db):
    r = executor.request("adjust_lighting", {"percent": 40})
    assert r["executed"] and executor.actuator.state()["lighting_percent"] == 40.0
    a = db.actions()[0]
    assert a["action"] == "adjust_lighting" and a["executed"] and a["permission"] == "auto"


def test_bounds_and_config_limits(executor):
    assert not executor.request("adjust_lighting", {"percent": 140})["executed"]
    executor.limits["lighting_max_percent"] = 50
    assert not executor.request("adjust_lighting", {"percent": 80})["executed"]
    assert not executor.request("adjust_lighting", {"percent": "bright"})["executed"]


def test_rate_limit(executor):
    assert executor.request("increase_aeration")["executed"]
    r = executor.request("increase_aeration")
    assert not r["executed"] and "minimum interval" in r["reason"]


def test_approval_tier_is_pending_until_the_owner_says_yes(executor, db):
    r = executor.request("feed_now")
    assert not r["executed"] and r["permission"] == "pending"
    assert executor.pending()[0]["action"] == "feed_now"
    ok = executor.approve("feed_now")
    assert ok["executed"] and executor.actuator.state()["portions_fed_today"] == 1


def test_approval_never_overrides_safety(executor):
    assert not executor.approve("set_heater_setpoint", {"delta_f": 5.0})["executed"]
    assert not executor.approve("disable_heater")["executed"]
    executor.actuator._state["heater_setpoint_f"] = 81.8
    assert not executor.approve("set_heater_setpoint", {"delta_f": 0.5})["executed"], "would exceed the max setpoint"
    executor.actuator._state["portions_fed_today"] = 3
    assert not executor.approve("feed_now")["executed"]


def test_halt_blocks_everything(executor):
    executor.halt()
    assert not executor.request("send_notification")["executed"]
    assert not executor.approve("feed_now")["executed"]
    executor.resume()
    assert executor.request("send_notification")["executed"]


def test_rate_limit_uses_history_timestamps():
    now = datetime(2026, 9, 21, 12, 0, tzinfo=timezone.utc)
    hist = [{"action": "skip_next_feeding", "executed": True, "recorded_at": "2026-09-21T11:30:00+00:00"}]
    assert not check("skip_next_feeding", {}, {}, {}, hist, now=now).allowed
    old = [{"action": "skip_next_feeding", "executed": True, "recorded_at": "2026-09-21T09:00:00+00:00"}]
    assert check("skip_next_feeding", {}, {}, {}, old, now=now).allowed


def test_pump_mode_must_be_known(executor):
    assert executor.request("set_pump_mode", {"mode": "night"})["executed"]
    executor.actuator._state["pump_mode"] = "normal"
    r = ControlExecutor(executor.db, {"backend": "simulated"}).request("set_pump_mode", {"mode": "turbo"})
    assert not r["executed"]


def test_null_actuator_refuses(db):
    ex = ControlExecutor(db, {"backend": "none"}, actuator=NullActuator())
    r = ex.request("send_notification")
    assert not r["executed"] and "no actuator" in r["reason"]


def test_every_action_spec_has_a_tier_and_description():
    for name, spec in ACTIONS.items():
        assert spec.name == name and spec.tier in Tier and spec.description
    assert isinstance(SimulatedActuator().state(), dict)
