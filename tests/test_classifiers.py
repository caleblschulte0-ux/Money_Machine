import math

import numpy as np

from fishai.perception.behavior.baselines import persistent_low_activity
from fishai.perception.behavior.classifiers import (
    chase_times,
    enrich_summaries,
    flags_for,
    per_track_kinematics,
)
from fishai.perception.behavior.telemetry import TelemetryBuilder, summarize_tracks
from fishai.perception.detection.synthetic import SyntheticDetector
from fishai.pipeline import process_video
from fishai.storage import Database
from fishai.types import BBox, Frame, TrackedObject, TrackSummary, VideoRecord


def _frames(n, dt=0.1):
    return [Frame(i, i * dt, np.zeros((200, 400, 3), np.uint8)) for i in range(n)]


def test_circling_vs_straight_vs_erratic():
    tb = TelemetryBuilder("v")
    circ, straight, erratic = [], [], []
    rng = np.random.default_rng(3)
    for i, f in enumerate(_frames(80)):
        a = i * 0.3
        x = 60 + i * 4 + (rng.uniform(-40, 40) if i % 4 == 0 else 0)
        objs = [
            TrackedObject(1, BBox(200 + 60 * math.cos(a) - 10, 100 + 60 * math.sin(a) - 5, 200 + 60 * math.cos(a) + 10, 100 + 60 * math.sin(a) + 5), 0.9),
            TrackedObject(2, BBox(i * 4, 150, i * 4 + 20, 160), 0.9),
            TrackedObject(3, BBox(x, 50, x + 20, 60), 0.9),
        ]
        r = tb.observe(f, objs)
        circ.append(r[0])
        straight.append(r[1])
        erratic.append(r[2])
    kc, ks, ke = (per_track_kinematics(rows, 0.1) for rows in (circ, straight, erratic))
    assert kc["circling_index"] > 0.9 and ks["circling_index"] < 0.1
    assert ke["speed_cv"] > ks["speed_cv"] + 0.5
    assert "repetitive circling" in flags_for(kc)


def test_vertical_posture_fraction():
    tb = TelemetryBuilder("v")
    rows = []
    for i, f in enumerate(_frames(20)):
        box = BBox(100, 100, 110, 130) if i < 10 else BBox(100, 100, 130, 110)  # tall, then normal
        rows += tb.observe(f, [TrackedObject(1, box, 0.9)])
    k = per_track_kinematics(rows, 0.1)
    assert abs(k["vertical_posture_fraction"] - 0.5) < 1e-9
    assert "vertical posture" in flags_for(k)


def test_chasing_requires_pursuit_geometry():
    tb = TelemetryBuilder("v")
    rows = []
    for i, f in enumerate(_frames(40)):
        rows += tb.observe(f, [
            TrackedObject(4, BBox(100 + i * 6, 100, 130 + i * 6, 112), 0.9),   # target
            TrackedObject(3, BBox(60 + i * 6, 100, 90 + i * 6, 112), 0.9),     # chaser, close behind
            TrackedObject(5, BBox(60 + i * 6, 180, 90 + i * 6, 192), 0.9),     # same speed, far away
            TrackedObject(6, BBox(300 - i * 6, 100, 330 - i * 6, 112), 0.9),   # heading the other way
        ])
    chase, chased = chase_times(rows, 0.1)
    assert chase.get(3, 0) > 3.0 and chased.get(4, 0) > 3.0
    assert chase.get(5, 0) == 0 and chase.get(6, 0) == 0
    assert chased.get(3, 0) == 0


def test_enrich_puts_behaviour_on_summaries_and_flags_show_in_json(cfg, synthetic_video):
    path, truth = synthetic_video
    r = process_video(path, cfg, detector=SyntheticDetector(truth), annotate=False)
    for f in r.summary["fish"]:
        b = f["behaviour"]
        assert set(b) == {"speed_cv", "turn_rate_std", "circling_index", "vertical_posture_fraction", "chase_time_s", "chased_time_s", "flags"}
        assert 0.0 <= b["circling_index"] <= 1.0
    assert all("speed_cv" in s.extra for s in r.tracks)


def test_top_view_disables_posture(cfg, synthetic_video):
    tb = TelemetryBuilder("v")
    rows = []
    for f in _frames(10):
        rows += tb.observe(f, [TrackedObject(1, BBox(100, 100, 110, 140), 0.9)])
    summaries = summarize_tracks(rows, 0.1)
    enrich_summaries(summaries, rows, 0.1, has_depth=False)
    assert summaries[0].extra["vertical_posture_fraction"] == 0.0


def test_persistent_low_activity_counts_consecutive_sessions(db: Database):
    def session(vid, when, activity):
        db.upsert_video(VideoRecord(vid, vid, 1, 1, 1.0, 1, 1.0, when, "d", "t", "h"))
        db.add_track_summaries([TrackSummary(vid, 1, 0, 10, 0.0, 1.0, 20, 1.0, 0, 0, 0, 0, activity, 0, 1, 0, 0, 1, 0, 0.5, 0.5, 0.9, 1.0, 0, 0, 1, {})])
        if not db.list_fish():
            db.add_fish([0.0])
        db.set_identity(vid, 1, 1, 1.0, "t")

    for i in range(4):
        session(f"n{i}", f"2026-09-{10 + i:02d}T00:00:00+00:00", 60.0)
    assert persistent_low_activity(db, 1, {"min_sessions": 3}) == 0
    session("low1", "2026-09-20T00:00:00+00:00", 30.0)
    session("low2", "2026-09-21T00:00:00+00:00", 32.0)
    assert persistent_low_activity(db, 1, {"min_sessions": 3}) == 2
