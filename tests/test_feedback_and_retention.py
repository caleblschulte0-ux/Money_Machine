from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from fishai.feedback import confirm, confirmations, unconfirmed_anomalies
from fishai.retention import run_retention
from fishai.storage import Database
from fishai.types import TrackSummary, VideoRecord


def _video(db: Database, vid: str, when: str) -> None:
    db.upsert_video(VideoRecord(vid, vid, 1, 1, 1.0, 1, 1.0, when, "d", "t", "h"))


def _anomaly(db: Database, vid: str, fish_id: int = 1) -> int:
    db.add_anomalies([{"video_id": vid, "fish_id": fish_id, "metric": "activity_score", "value": 10.0, "baseline": 50.0, "z_score": -4.0, "percent": -80.0, "direction": "low", "severity": "critical"}])
    return db.anomalies(vid)[-1]["id"]


def test_confirm_records_outcome_with_context(db: Database):
    _video(db, "v1", "2026-09-20T00:00:00+00:00")
    aid = _anomaly(db, "v1")
    assert [a["id"] for a in unconfirmed_anomalies(db)] == [aid]
    eid = confirm(db, "water_issue", anomaly_id=aid, note="filter had stopped")
    (c,) = confirmations(db)
    assert c["id"] == eid and c["fish_id"] == 1 and c["video_id"] == "v1"
    assert c["payload"]["metric"] == "activity_score" and c["payload"]["outcome"] == "water_issue"
    assert unconfirmed_anomalies(db) == []
    with pytest.raises(ValueError):
        confirm(db, "meh", anomaly_id=aid)
    with pytest.raises(ValueError):
        confirm(db, "fine", anomaly_id=999)


def _clip(db: Database, tmp: Path, name: str, vid: str, size: int, recorded_at: str) -> Path:
    p = tmp / name
    p.write_bytes(b"x" * size)
    db.add_clip("feeding", str(p), 0.0, 1.0, "", vid, None, size)
    db.connection.execute("UPDATE clips SET recorded_at = ? WHERE path = ?", (recorded_at, str(p)))
    db.connection.commit()
    return p


def test_retention_prunes_old_observations_and_bounds_clips(db: Database, tmp_path: Path):
    now = datetime(2026, 9, 21, tzinfo=timezone.utc)
    old_iso = (now - timedelta(days=40)).isoformat(timespec="seconds")
    new_iso = (now - timedelta(days=1)).isoformat(timespec="seconds")
    _video(db, "old", old_iso)
    _video(db, "new", new_iso)
    import numpy as np

    from fishai.perception.behavior.telemetry import TelemetryBuilder
    from fishai.types import BBox, Frame, TrackedObject

    for vid in ("old", "new"):
        rows = TelemetryBuilder(vid).observe(Frame(0, 0.0, np.zeros((10, 10, 3), np.uint8)), [TrackedObject(1, BBox(0, 0, 5, 5), 0.9)])
        db.add_observations(rows)
        db.add_track_summaries([TrackSummary(vid, 1, 0, 0, 0.0, 0.0, 1, 0.1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0.1, 0, 0.5, 0.5, 0.9, 1.0, 0, 0, 25, {})])
    old_clip = _clip(db, tmp_path, "old.mp4", "old", 100, old_iso)
    keep_clip = _clip(db, tmp_path, "confirmed.mp4", "confirmed", 100, old_iso)
    _video(db, "confirmed", old_iso)
    aid = _anomaly(db, "confirmed")
    confirm(db, "sick", anomaly_id=aid)
    big1 = _clip(db, tmp_path, "big1.mp4", "new", 600, new_iso)
    big2 = _clip(db, tmp_path, "big2.mp4", "new", 600, (now - timedelta(hours=1)).isoformat(timespec="seconds"))

    rep = run_retention(db, {"observations_days": 14, "clips_days": 30, "clips_max_gb": 700 / 1e9}, now=now)
    assert rep["observations_deleted"] == 1
    assert db.count_observations("old") == 0 and db.count_observations("new") == 1
    assert len(db.track_summaries("old")) == 1, "summaries survive pruning"
    assert not old_clip.exists(), "older than clips_days"
    assert keep_clip.exists(), "a confirmed session's clip is labelled data"
    assert not big1.exists() and big2.exists(), "oldest first until under the size cap"
    assert rep["clip_bytes_after"] <= 700
