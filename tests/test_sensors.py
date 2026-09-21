import json
from datetime import datetime, timedelta, timezone

from fishai.sensors import SensorHub, build_sensors
from fishai.sensors.base import available_sensor_kinds
from fishai.sensors.simulated import SimulatedSensor


def test_simulated_sensor_noise_and_override():
    s = SimulatedSensor("t", "temperature", "F", baseline=78.0, noise=0.1, seed=1)
    values = [s.read().value for _ in range(20)]
    assert all(77 < v < 79 for v in values) and len(set(values)) > 1
    s.override = 85.0
    assert s.read().value == 85.0 and s.read().source == "simulated"


def test_hub_applies_limits_and_stores(db):
    sensors = build_sensors([{"name": "water_temperature", "kind": "simulated_temperature", "baseline": 78.0, "noise": 0.0}])
    hub = SensorHub(sensors, limits={"water_temperature": {"low": 74, "high": 82}})
    assert hub.read_all(db)["water_temperature"].status == "ok"
    sensors[0].override = 90.0
    r = hub.read_all(db)["water_temperature"]
    assert r.status == "high"
    assert db.latest_sensor_readings()["water_temperature"]["value"] == 90.0
    state = SensorHub.state_for_reasoner({"water_temperature": r})
    assert state["water_temperature"] == {"value": 90.0, "unit": "F", "status": "high", "source": "simulated"}


def test_failing_sensor_does_not_stop_the_hub():
    class Dead:
        name, kind, unit, source = "dead", "ph", "pH", "hardware"

        def read(self):
            raise OSError("probe unplugged")

        def close(self):
            pass

    r = SensorHub([Dead()]).read_all()["dead"]
    assert r.status == "error"


def test_file_sensor_reads_json_and_flags_stale(tmp_path):
    p = tmp_path / "temp.json"
    p.write_text(json.dumps({"value": 77.5, "unit": "F", "recorded_at": datetime.now(timezone.utc).isoformat()}))
    (s,) = build_sensors([{"name": "probe", "kind": "file", "path": str(p), "measures": "temperature"}])
    r = s.read()
    assert r.value == 77.5 and r.status == "ok" and r.source == "file"
    p.write_text(json.dumps({"value": 77.5, "unit": "F", "recorded_at": (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()}))
    assert s.read().status == "stale"


def test_known_sensor_kinds():
    assert {"simulated_temperature", "simulated_water_level", "simulated_ph", "simulated_dissolved_oxygen", "file"} <= set(available_sensor_kinds())
