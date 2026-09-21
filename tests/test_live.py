import json

import numpy as np

from fishai.perception.detection.synthetic import SyntheticDetector
from fishai.pipeline.live import LiveWatcher, RollingBuffer, read_status, send_request
from fishai.storage import Database
from fishai.video.synthetic import SyntheticAquarium


def _live_cfg(cfg, workdir, **extra):
    cfg.set_path("live.clip_dir", str(workdir / "clips"))
    cfg.set_path("live.requests_dir", str(workdir / "req"))
    cfg.set_path("live.status_file", str(workdir / "status.json"))
    cfg.set_path("live.buffer_s", 2.0)
    cfg.set_path("live.clip_post_s", 1.0)
    cfg.set_path("live.target_fps", 20)
    cfg.set_path("feeding.before_s", 2.0)
    cfg.set_path("feeding.after_s", 3.0)
    for k, v in extra.items():
        cfg.set_path(k, v)
    return cfg


def test_rolling_buffer_keeps_only_the_window():
    b = RollingBuffer(seconds=1.0)
    img = np.zeros((8, 8, 3), np.uint8)
    for i in range(30):
        b.push(i * 0.1, img)
    assert 10 <= len(b) <= 12 and b.span_s <= 1.0 + 1e-9
    assert b.frames()[0][1].shape == (8, 8, 3)


def test_watcher_rotates_sessions_and_serves_requests(cfg, workdir):
    path = workdir / "cam.mp4"
    truth = SyntheticAquarium(n_fish=3, seed=3).write(path, 300)  # 15 s at 20 fps
    _live_cfg(cfg, workdir, **{"live.session_s": 5.0})
    (workdir / "req").mkdir()
    send_request(cfg, "feed", source="manual")
    send_request(cfg, "note", note="lights changed")
    with Database(cfg.resolve_path("paths.database")) as db:
        w = LiveWatcher(cfg, str(path), db=db, detector=SyntheticDetector(truth), realtime=False)
        results = w.run()
        assert len(results) == 3, "15 s of video in 5 s sessions"
        assert [v["video_id"] for v in db.list_videos()] == [r.video_id for r in results]
        assert all(abs(v["duration_s"] - 5.0) < 0.2 for v in db.list_videos())
        assert sum(r.observations for r in results) > 800
        assert w.status.frames_total == 300 and w.status.sessions_completed == 3
        feedings = db.events("feeding")
        assert len(feedings) == 1 and feedings[0]["video_id"] == results[0].video_id
        responses = db.feeding_responses(event_id=feedings[0]["id"])
        assert len(responses) == 3 and all(r["fish_id"] is not None for r in responses), "relinked at session end"
        assert db.events("owner_note")[0]["payload"]["note"] == "lights changed"
        clips = db.clips()
        assert len(clips) == 1 and clips[0]["kind"] == "feeding"
        from pathlib import Path

        assert Path(clips[0]["path"]).exists() and clips[0]["size_bytes"] > 0
        assert len(db.list_fish()) == 3, "the same three fish across all sessions"
    st = read_status(cfg)
    assert st["running"] is False and st["sessions_completed"] == 3 and st["last_error"] is None
    assert not list((workdir / "req").glob("*.json")), "requests are consumed"


def test_watcher_flags_tracking_loss_and_clips_it(cfg, workdir):
    path = workdir / "cam.mp4"
    truth = SyntheticAquarium(n_fish=2, seed=5).write(path, 200)
    for f in range(60, 200):  # every fish vanishes after 3 s
        truth[f] = {}
    _live_cfg(cfg, workdir, **{"live.session_s": 100.0, "live.no_detection_alert_s": 2.0})
    with Database(cfg.resolve_path("paths.database")) as db:
        w = LiveWatcher(cfg, str(path), db=db, detector=SyntheticDetector(truth), realtime=False)
        w.run()
        assert db.events("tracking_loss"), "no fish for 2 s after having fish"
        assert [c["kind"] for c in db.clips()] == ["tracking_loss"]
        assert w.tracking_loss_flagged is True


def test_stop_request_ends_the_loop(cfg, workdir):
    path = workdir / "cam.mp4"
    truth = SyntheticAquarium(n_fish=1, seed=1).write(path, 400)
    _live_cfg(cfg, workdir, **{"live.session_s": 100.0})
    (workdir / "req").mkdir()
    send_request(cfg, "stop")
    with Database(cfg.resolve_path("paths.database")) as db:
        w = LiveWatcher(cfg, str(path), db=db, detector=SyntheticDetector(truth), realtime=False)
        results = w.run()
    assert len(results) == 1 and w.status.frames_total < 400
    assert json.loads((workdir / "status.json").read_text())["running"] is False


def test_unopenable_source_is_reported_not_raised(cfg, workdir):
    _live_cfg(cfg, workdir)
    with Database(cfg.resolve_path("paths.database")) as db:
        w = LiveWatcher(cfg, str(workdir / "missing.mp4"), db=db, realtime=False)
        w.is_file = True  # treat as a file so it gives up instead of reconnecting forever
        assert w.run() == []
    assert "could not open" in read_status(cfg)["last_error"]
