import numpy as np

from fishai.perception.behavior.feeding import (
    FoodZone,
    compute_feeding_responses,
    feeding_deviations,
    feeding_summary,
    mark_feeding,
)
from fishai.perception.behavior.telemetry import TelemetryBuilder
from fishai.storage import Database
from fishai.types import BBox, Frame, TrackedObject, VideoRecord


def _video(db: Database, vid: str) -> None:
    db.upsert_video(VideoRecord(vid, vid, 200, 100, 10.0, 0, 0.0, "2026-09-21T00:00:00+00:00", "synthetic", "simple", "h"))


def _session(db: Database, vid: str, approach_at: float | None, fish_id: int = 1, track_id: int = 1) -> None:
    """A fish in the bottom band that rises into the food zone ``approach_at`` s after feeding at t=10."""
    _video(db, vid)
    tb = TelemetryBuilder(vid)
    rows = []
    for i in range(200):  # 20 s at 10 fps
        t = i / 10
        y = 85.0
        if approach_at is not None and t >= 10 + approach_at:
            y = 10.0
        rows += tb.observe(Frame(i, t, np.zeros((100, 200, 3), np.uint8)), [TrackedObject(track_id, BBox(90, y - 5, 110, y + 5), 0.9)])
    db.add_observations(rows)
    if fish_id > len(db.list_fish()):
        db.add_fish([0.0])
    db.set_identity(vid, track_id, fish_id, 1.0, "test")


def test_food_zone_and_config():
    z = FoodZone.from_config({"zone": {"y2": 0.3}})
    assert z.contains(0.5, 0.1) and not z.contains(0.5, 0.5)
    assert FoodZone().y2 == 0.25


def test_response_measures_latency_and_zone_shift(db: Database):
    _session(db, "v1", approach_at=2.5)
    eid = mark_feeding(db, "v1", 10.0)
    (r,) = compute_feeding_responses(db, eid, {"before_s": 5, "after_s": 8})
    assert r["fish_id"] == 1 and r["approached"] is True
    assert abs(r["latency_s"] - 2.5) < 1e-6
    assert r["zone_fraction_before"] == 0.0 and r["zone_fraction_after"] > 0.6
    assert r["n_before"] == 50 and r["n_after"] == 81
    assert db.feeding_responses(event_id=eid)[0]["approached"] is True


def test_no_approach_is_recorded_honestly(db: Database):
    _session(db, "v1", approach_at=None)
    eid = mark_feeding(db, "v1", 10.0)
    (r,) = compute_feeding_responses(db, eid, {"before_s": 5, "after_s": 8})
    assert r["approached"] is False and r["latency_s"] is None and r["zone_fraction_after"] == 0.0


def test_feeding_deviation_against_prior_events(db: Database):
    for i, lat in enumerate([1.0, 1.2, 0.9, 1.1]):
        _session(db, f"v{i}", approach_at=lat)
        eid = mark_feeding(db, f"v{i}", 10.0)
        compute_feeding_responses(db, eid, {"before_s": 5, "after_s": 8})
        assert feeding_deviations(db, eid) == [] or i >= 3
    _session(db, "slow", approach_at=None)
    eid = mark_feeding(db, "slow", 10.0)
    compute_feeding_responses(db, eid, {"before_s": 5, "after_s": 8})
    devs = feeding_deviations(db, eid)
    metrics = {d.metric for d in devs}
    assert "feeding_latency_s" in metrics and "feeding_zone_fraction_after" in metrics
    lat = next(d for d in devs if d.metric == "feeding_latency_s")
    assert lat.direction == "high" and lat.severity == "critical"
    assert db.anomalies("slow")
    summary = feeding_summary(db)
    assert summary[0]["event_id"] == eid and summary[0]["approach_rate"] == 0.0


def test_relink_after_identity(db: Database):
    _video(db, "v1")
    tb = TelemetryBuilder("v1")
    rows = []
    for i in range(30):
        rows += tb.observe(Frame(i, i / 10, np.zeros((100, 200, 3), np.uint8)), [TrackedObject(4, BBox(0, 0, 10, 10), 0.9)])
    db.add_observations(rows)
    eid = mark_feeding(db, "v1", 1.0)
    (r,) = compute_feeding_responses(db, eid, {"before_s": 1, "after_s": 2})
    assert r["fish_id"] is None
    fid = db.add_fish([0.0])
    db.set_identity("v1", 4, fid, 1.0, "test")
    assert db.relink_feeding_responses("v1") == 1
    assert db.feeding_responses(event_id=eid)[0]["fish_id"] == fid
