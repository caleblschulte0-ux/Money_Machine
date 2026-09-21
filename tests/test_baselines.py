from fishai.perception.behavior.baselines import (
    deviations_for_video,
    per_fish_session_values,
    update_baselines,
)
from fishai.storage import Database
from fishai.types import TrackSummary, VideoRecord


def _session(db: Database, vid: str, when: str, fish_id: int, activity: float, surface: float, track_id: int = 1, n: int = 50):
    if db.get_video(vid) is None:
        db.upsert_video(VideoRecord(vid, vid, 1, 1, 1.0, 1, 1.0, when, "d", "t", "h"))
    db.add_track_summaries(
        [
            TrackSummary(vid, track_id, 0, n, 0.0, n / 10, n, n / 10, 100.0, 10.0, 20.0, activity / 200, activity, surface, 1 - surface, 0.0,
                         surface * n / 10, (1 - surface) * n / 10, 0.0, 0.5, 0.5, 0.9, 1.0, 0.0, 0.0, 300.0, {})
        ]
    )
    db.add_fish([0.0]) if fish_id > len(db.list_fish()) else None
    db.set_identity(vid, track_id, fish_id, 1.0, "test")


def test_baselines_and_deviation_use_prior_sessions_only(db: Database):
    for i in range(5):
        _session(db, f"v{i}", f"2026-09-{10 + i:02d}T00:00:00+00:00", 1, activity=70 + i, surface=0.04)
    _session(db, "bad", "2026-09-20T00:00:00+00:00", 1, activity=40, surface=0.17)
    stats = update_baselines(db, {"window_sessions": 14})
    assert stats[1]["activity_score"]["n"] == 6, "update_baselines summarises everything stored"
    devs = deviations_for_video(db, "bad", {"min_sessions": 3, "z_threshold": 2.0, "percent_threshold": 50.0})
    by_metric = {d.metric: d for d in devs}
    assert "surface_fraction" in by_metric and by_metric["surface_fraction"].direction == "high"
    assert abs(by_metric["surface_fraction"].baseline - 0.04) < 1e-9, "baseline excludes the session under test"
    assert by_metric["surface_fraction"].value / by_metric["surface_fraction"].baseline > 4
    assert "activity_score" in by_metric and by_metric["activity_score"].direction == "low"
    assert by_metric["activity_score"].severity in ("warning", "critical")
    assert "3." in by_metric["surface_fraction"].sentence() or "4." in by_metric["surface_fraction"].sentence()
    assert len(db.anomalies("bad")) == len(devs)


def test_not_enough_history_means_no_deviations(db: Database):
    _session(db, "v0", "2026-09-10T00:00:00+00:00", 1, 70, 0.04)
    _session(db, "v1", "2026-09-11T00:00:00+00:00", 1, 10, 0.5)
    assert deviations_for_video(db, "v1", {"min_sessions": 3}) == []


def test_fragmented_tracks_count_as_one_session(db: Database):
    _session(db, "v0", "2026-09-10T00:00:00+00:00", 1, 80, 0.0, track_id=1, n=30)
    _session(db, "v0", "2026-09-10T00:00:00+00:00", 1, 40, 0.0, track_id=2, n=10)
    rows = per_fish_session_values(db, ["activity_score"])
    assert len(rows[1]) == 1
    assert abs(rows[1][0]["activity_score"] - (80 * 30 + 40 * 10) / 40) < 1e-9


def test_flat_history_does_not_explode_z_scores(db: Database):
    for i in range(4):
        _session(db, f"v{i}", f"2026-09-{10 + i:02d}T00:00:00+00:00", 1, 50.0, 0.1)
    _session(db, "now", "2026-09-20T00:00:00+00:00", 1, 51.0, 0.1)
    assert deviations_for_video(db, "now", {"min_sessions": 3}) == []
