"""The rail's edge agent (fake mode) talking to the PC side over real HTTP."""

import argparse
import json
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "edge" / "pi"))
import fishai_edge  # noqa: E402

from fishai.control import ControlExecutor  # noqa: E402
from fishai.perception.detection.synthetic import SyntheticDetector  # noqa: E402
from fishai.pipeline.live import LiveWatcher  # noqa: E402
from fishai.sensors import SensorHub, build_sensors  # noqa: E402
from fishai.storage import Database  # noqa: E402
from fishai.video.synthetic import SyntheticAquarium  # noqa: E402


@pytest.fixture(scope="module")
def edge():
    args = argparse.Namespace(host="127.0.0.1", port=0, fake=True, width=320, height=180, fps=15.0)
    server = fishai_edge.serve(args)
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    url = f"http://127.0.0.1:{server.server_address[1]}"
    time.sleep(0.5)
    yield url, server.agent
    server.shutdown()
    server.agent.close()


def _post(url, body=None):
    req = urllib.request.Request(url, data=json.dumps(body or {}).encode(), headers={"Content-Type": "application/json"}, method="POST")
    return json.load(urllib.request.urlopen(req, timeout=5))


def test_edge_status_sensors_feed_and_events(edge):
    url, agent = edge
    st = json.load(urllib.request.urlopen(f"{url}/status"))
    assert st["camera"]["locked"] is True and st["lighting_mode"] == "day"
    sensors = json.load(urllib.request.urlopen(f"{url}/sensors"))
    assert sensors["water_temperature"]["unit"] == "F" and sensors["water_level"]["status"] == "ok"
    r = _post(f"{url}/feed", {"portions": 1})
    assert r["confirmed"] is True and r["revolutions"] == 1
    with pytest.raises(urllib.error.HTTPError):  # portions are bounded
        _post(f"{url}/feed", {"portions": 9})
    ev = json.load(urllib.request.urlopen(f"{url}/events?since=0"))["events"]
    assert [e["kind"] for e in ev][:2] == ["feed_started", "feed_done"]
    _post(f"{url}/camera/mode", {"mode": "night"})
    assert json.load(urllib.request.urlopen(f"{url}/status"))["lighting_mode"] == "night"
    _post(f"{url}/camera/mode", {"mode": "day"})


def test_edge_sensors_through_the_hub(edge, db):
    url, _ = edge
    sensors = build_sensors([{"name": "rail", "kind": "edge", "url": url}])
    assert {s.name for s in sensors} == {"water_temperature", "water_level"}
    hub = SensorHub(sensors, limits={"water_temperature": {"low": 74, "high": 82}})
    readings = hub.read_all(db)
    assert readings["water_temperature"].status == "ok" and readings["water_temperature"].source == "simulated"
    assert db.latest_sensor_readings()["water_level"]["value"] == 1.0
    dead = build_sensors([{"name": "t", "kind": "http", "url": "http://127.0.0.1:9/nope", "measures": "temperature"}])
    assert SensorHub(dead).read_all()["t"].status == "error"


def test_edge_actuator_feeds_through_permissions(edge, db):
    url, agent = edge
    before = agent.feeder.runs
    ex = ControlExecutor(db, {"backend": "edge", "edge_url": url})
    r = ex.request("feed_now")
    assert not r["executed"] and r["permission"] == "pending", "feeding is approval-tier"
    ok = ex.approve("feed_now")
    assert ok["executed"] and ok["result"]["confirmed"] is True
    assert agent.feeder.runs == before + 1
    assert ex.actuator.state()["portions_fed_today"] == 1
    assert ex.request("set_heater_setpoint", {"delta_f": 0.5})["tier"] == "forbidden"


def test_watcher_logs_the_feed_button_and_polls_sensors(edge, cfg, workdir):
    url, agent = edge
    path = workdir / "cam.mp4"
    truth = SyntheticAquarium(n_fish=2, seed=8).write(path, 240)
    for k, v in {
        "live.clip_dir": str(workdir / "clips"), "live.requests_dir": str(workdir / "req"), "live.status_file": str(workdir / "status.json"),
        "live.session_s": 100.0, "live.buffer_s": 1.0, "live.clip_post_s": 0.5, "live.target_fps": 20, "live.edge_url": url,
        "live.edge_poll_s": 0.0, "live.sensor_poll_s": 0.5, "feeding.after_s": 2.0, "feeding.before_s": 1.0,
    }.items():
        cfg.set_path(k, v)
    cfg["sensors"] = [{"name": "rail", "kind": "edge", "url": url}]
    with Database(cfg.resolve_path("paths.database")) as db:
        w = LiveWatcher(cfg, str(path), db=db, detector=SyntheticDetector(truth), realtime=False)
        w._edge_last_event = agent.events._next - 1  # ignore what earlier tests did
        _post(f"{url}/button")  # pressed before the run starts: picked up at the first poll
        w.run()
        feedings = db.events("feeding")
        assert len(feedings) == 1
        assert feedings[0]["payload"]["source"] == "button" and feedings[0]["payload"]["confirmed"] is True
        assert db.clips() and db.clips()[0]["kind"] == "feeding"
        assert db.latest_sensor_readings()["water_temperature"]["source"] == "simulated"
        assert w.status.sensors["water_temperature"]["status"] == "ok"
