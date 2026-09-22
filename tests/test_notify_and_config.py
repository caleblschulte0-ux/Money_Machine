import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from fishai.config import load_config
from fishai.config_check import check_config
from fishai.control import ControlExecutor
from fishai.notify import Notification, Notifier, assessment_notification


class _Recorder(BaseHTTPRequestHandler):
    received: list = []

    def do_POST(self):  # noqa: N802
        n = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(n)
        _Recorder.received.append({"path": self.path, "headers": dict(self.headers), "body": body})
        self.send_response(200)
        self.end_headers()

    def log_message(self, *a):
        pass


@pytest.fixture(scope="module")
def sink():
    srv = HTTPServer(("127.0.0.1", 0), _Recorder)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{srv.server_address[1]}"
    srv.shutdown()


def test_ntfy_and_webhook_backends_and_min_severity(sink, db):
    _Recorder.received.clear()
    n = Notifier({"min_severity": "warning", "backends": [{"kind": "ntfy", "server": sink, "topic": "t1"}, {"kind": "webhook", "url": f"{sink}/hook"}]}, db)
    assert n.send(Notification("quiet", "x", "info")) == {"skipped": "severity info below warning"}
    out = n.send(Notification("Fish 2 hiding", "3x baseline", "critical", {"fish_id": 2}))
    assert out == {"ntfy": "sent", "webhook": "sent"}
    paths = sorted(r["path"] for r in _Recorder.received)
    assert paths == ["/hook", "/t1"]
    ntfy = next(r for r in _Recorder.received if r["path"] == "/t1")
    assert ntfy["headers"]["Title"] == "Fish 2 hiding" and ntfy["headers"]["Priority"] == "5"
    hook = json.loads(next(r for r in _Recorder.received if r["path"] == "/hook")["body"])
    assert hook["severity"] == "critical" and hook["data"]["fish_id"] == 2
    assert db.events("notification")[0]["payload"]["outcome"]["ntfy"] == "sent"


def test_failed_backend_does_not_raise(db):
    n = Notifier({"backends": [{"kind": "webhook", "url": "http://127.0.0.1:9/x", "timeout_s": 1}, {"kind": "log"}]}, db)
    out = n.send(Notification("t", "m", "critical"))
    assert out["log"] == "sent" and out["webhook"].startswith("failed")


def test_send_notification_action_reaches_the_notifier(sink, db):
    _Recorder.received.clear()
    ex = ControlExecutor(db, load_config().section("control"), notify_cfg={"backends": [{"kind": "webhook", "url": f"{sink}/act"}]})
    assessment = {"severity": "warning", "observations": ["Fish 2 surface time is 3.9x baseline"], "recommended_checks": ["Check dissolved oxygen"]}
    r = ex.run_assessment_actions(["send_notification"], assessment=assessment)
    assert r[0]["executed"]
    body = json.loads(_Recorder.received[-1]["body"])
    assert "3.9x" in body["message"] and "Check: Check dissolved oxygen" in body["message"]
    assert ex.actuator.state()["last_notification"]["outcome"] == {"webhook": "sent"}


def test_assessment_notification_titles():
    assert assessment_notification({"severity": "critical", "observations": ["a"]}).title.startswith("Tank needs attention")
    assert assessment_notification({"severity": "ok"}, context="daily").title == "Tank is fine (daily)"


def test_config_check_catches_typos_choices_and_ranges():
    assert check_config(load_config())["errors"] == []
    bad = load_config(overrides=["video.frame_strde=2", "tracking.backend=bytetrak", "live.session_s=1", "behavior.zones.surface_below=0.9"])
    errs = "\n".join(check_config(bad)["errors"])
    assert "unknown key 'video.frame_strde'" in errs and "bytetrak" in errs and "live.session_s" in errs and "surface_below" in errs


def test_config_check_freeform_sections_and_backend_requirements():
    cfg = load_config()
    cfg["sensors"] = [{"name": "rail", "kind": "edge"}]
    cfg.set_path("notify.backends", [{"kind": "ntfy"}])
    cfg.set_path("control.backend", "edge")
    errs = "\n".join(check_config(cfg)["errors"])
    assert "sensors[0]" in errs and "ntfy needs a topic" in errs and "control.edge_url" in errs
