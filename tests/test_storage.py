import numpy as np

from fishai.perception.behavior.telemetry import TelemetryBuilder, summarize_tracks
from fishai.storage import Database
from fishai.types import BBox, Frame, TrackedObject, VideoRecord


def _video(db: Database, vid="v1"):
    db.upsert_video(VideoRecord(vid, f"/x/{vid}.mp4", 200, 100, 10.0, 20, 2.0, "2026-09-21T00:00:00+00:00", "synthetic", "simple", "abc"))


def test_schema_creates_all_tables(db: Database):
    names = {r[0] for r in db.connection.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    assert {"videos", "observations", "track_summaries", "fish", "fish_identities", "baselines", "anomalies", "sensor_readings", "events", "assessments", "actions"} <= names


def test_observations_roundtrip_and_clear(db: Database):
    _video(db)
    tb = TelemetryBuilder("v1")
    rows = []
    for i in range(4):
        rows += tb.observe(Frame(i, i * 0.1, np.zeros((100, 200, 3), np.uint8)), [TrackedObject(1, BBox(i, i, i + 10, i + 10), 0.9)])
    assert db.add_observations(rows) == 4
    back = db.observations("v1")
    assert len(back) == 4 and back[0].bbox == BBox(0, 0, 10, 10) and back[3].speed_px_s > 0
    db.add_track_summaries(summarize_tracks(rows, 0.1))
    assert db.track_summaries("v1")[0].n_observations == 4
    db.clear_video_results("v1")
    assert db.count_observations("v1") == 0 and db.track_summaries("v1") == []
    assert db.get_video("v1") is not None, "clearing results keeps the video row"


def test_video_upsert_is_idempotent(db: Database):
    _video(db)
    _video(db)
    assert len(db.list_videos()) == 1


def test_fish_registry_and_identities(db: Database):
    _video(db)
    fid = db.add_fish([0.1, 0.9], name="Blue")
    db.set_identity("v1", 3, fid, 0.8, "test")
    assert db.fish_for_video("v1") == {3: fid}
    db.update_fish(fid, descriptors={"cam1/day": [0.5, 0.5], "cam1/night": [1.0, 0.0]}, seen=True)
    (f,) = db.list_fish()
    assert f["descriptors"] == {"cam1/day": [0.5, 0.5], "cam1/night": [1.0, 0.0]} and f["n_sessions"] == 2 and f["name"] == "Blue"
    db.update_fish(fid, descriptors={"cam1/day": [0.2, 0.8]})
    assert db.list_fish()[0]["descriptors"]["cam1/night"] == [1.0, 0.0], "other keys are kept"


def test_sensor_events_assessments_actions(db: Database):
    db.add_sensor_reading("temp", "temperature", 78.0, "F", "simulated")
    db.add_sensor_reading("temp", "temperature", 79.0, "F", "simulated")
    assert db.latest_sensor_readings()["temp"]["value"] == 79.0
    db.add_event("feeding", {"portions": 1})
    assert db.events("feeding")[0]["payload"] == {"portions": 1}
    db.add_assessment("rules", "v1", "warning", {"a": 1}, {"b": 2})
    assert db.assessments()[0]["output"] == {"b": 2}
    db.add_action("feed_now", {"portions": 1}, "cli", "pending", False, "needs approval")
    a = db.actions()[0]
    assert a["executed"] is False and a["params"] == {"portions": 1}


def test_in_memory_database():
    with Database(None) as db:
        _video(db)
        assert db.list_videos()[0]["video_id"] == "v1"
