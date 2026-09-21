import urllib.error

import pytest

from fishai.control.permissions import ACTIONS, Tier
from fishai.reasoning import assess, build_reasoner, build_state
from fishai.reasoning.qwen.ollama import OllamaReasoner
from fishai.reasoning.rules import RulesReasoner
from fishai.reasoning.schema import PROPOSABLE_ACTIONS, extract_json, validate


def test_every_proposable_action_is_a_known_auto_action():
    for a in PROPOSABLE_ACTIONS:
        assert a in ACTIONS and ACTIONS[a].tier == Tier.AUTO, f"{a} must be an AUTO action or not proposable"


def test_validate_normalises_and_drops_unknown_actions():
    a = validate({"severity": "Warning", "observations": ["x", 3], "safe_actions": ["Increase aeration", "dose_chemical", "disable_heater"], "confidence": "2"}, "t")
    assert a.severity == "warning"
    assert a.observations == ["x"]
    assert a.safe_actions == ["increase_aeration"]
    assert a.confidence == 1.0
    assert any("dose_chemical" in d for d in a.dropped) and any("disable_heater" in d for d in a.dropped)


def test_validate_survives_garbage():
    a = validate("not json", "t")
    assert a.severity == "info" and a.dropped
    b = validate({"severity": "apocalypse"}, "t")
    assert b.severity == "info" and b.safe_actions == []


def test_extract_json_from_fenced_and_chatty_text():
    assert extract_json('Here you go:\n```json\n{"severity": "ok"}\n```')["severity"] == "ok"
    assert extract_json('blah {"a": {"b": 1}} trailing')["a"]["b"] == 1
    assert extract_json("no json here") is None


def test_rules_reasoner_maps_deviations_to_checks_and_actions():
    state = {"deviations": [{"fish_id": 2, "metric": "surface_fraction", "severity": "warning", "direction": "high", "sentence": "Fish 2 surface fraction is 3.9x baseline"}], "sensors": {}}
    a = RulesReasoner().assess(state)
    assert a.severity == "warning"
    assert "increase_aeration" in a.safe_actions and "send_notification" in a.safe_actions
    assert any("oxygen" in c.lower() for c in a.recommended_checks)
    assert RulesReasoner().assess({"deviations": [], "sensors": {}}).severity == "ok"


def test_ollama_reasoner_with_fake_transport():
    calls = []

    def transport(path, payload):
        calls.append((path, payload))
        if path == "/api/tags":
            return {"models": [{"name": "qwen2.5:7b"}]}
        return {"message": {"content": '{"severity":"warning","observations":["Fish 2 surface time is 3.9x baseline"],"recommended_checks":["Check DO"],"safe_actions":["increase_aeration"],"confidence":0.8}'}}

    r = OllamaReasoner(model="qwen2.5:7b", transport=transport)
    assert r.available()
    a = r.assess({"deviations": []})
    assert a.severity == "warning" and a.safe_actions == ["increase_aeration"] and a.source == "ollama:qwen2.5:7b"
    assert calls[1][1]["format"]["type"] == "object"
    assert "veterinarian" in calls[1][1]["messages"][0]["content"]


def test_ollama_missing_model_is_not_available():
    r = OllamaReasoner(model="qwen2.5:7b", transport=lambda p, _: {"models": [{"name": "llama3:8b"}]})
    assert not r.available()

    def down(p, _):
        raise urllib.error.URLError("refused")

    assert not OllamaReasoner(transport=down).available()


def test_assess_falls_back_to_rules_and_says_so(db):
    def down(p, _):
        raise urllib.error.URLError("refused")

    state = build_state(db, None, [])
    a = assess(state, {"backend": "ollama", "ollama": {}}, db=db, reasoner=OllamaReasoner(transport=down))
    assert a.source == "rules"
    assert "unavailable" in a.rationale
    assert db.assessments()[0]["backend"] == "rules"


def test_build_reasoner_registry():
    assert build_reasoner({"backend": "rules"}).name == "rules"
    with pytest.raises(ValueError):
        build_reasoner({"backend": "gpt-99"})
