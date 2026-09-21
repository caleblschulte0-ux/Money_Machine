import numpy as np

from fishai.perception.behavior.telemetry import TelemetryBuilder, ZoneModel, summarize_tracks
from fishai.types import BBox, Frame, TrackedObject, Zone


def _frame(i, dt=0.1):
    return Frame(i, i * dt, np.zeros((100, 200, 3), dtype=np.uint8))


def test_zones_from_normalised_y():
    z = ZoneModel(0.2, 0.8)
    assert z.zone_for(0.1) == Zone.SURFACE
    assert z.zone_for(0.5) == Zone.MIDDLE
    assert z.zone_for(0.9) == Zone.BOTTOM
    assert ZoneModel.from_config({"zones": {"surface_below": 0.3}}).surface_below == 0.3


def test_observations_carry_speed_and_zone():
    tb = TelemetryBuilder("v")
    o0 = tb.observe(_frame(0), [TrackedObject(1, BBox(0, 0, 20, 10), 0.9)])[0]
    o1 = tb.observe(_frame(1), [TrackedObject(1, BBox(30, 80, 50, 90), 0.9)])[0]
    assert o0.speed_px_s == 0.0 and o0.zone == Zone.SURFACE
    assert o1.zone == Zone.BOTTOM
    assert abs(o1.displacement_px - (30**2 + 80**2) ** 0.5) < 1e-6
    assert abs(o1.speed_px_s - o1.displacement_px / 0.1) < 1e-6
    assert abs(o1.speed_norm_s - (o1.displacement_px / 100) / 0.1) < 1e-6
    assert o1.nx == 0.2 and o1.ny == 0.85


def test_reacquired_track_does_not_get_a_teleport_speed():
    tb = TelemetryBuilder("v")
    tb.observe(_frame(0), [TrackedObject(1, BBox(0, 0, 20, 10), 0.9)])
    o = tb.observe(_frame(50), [TrackedObject(1, BBox(150, 80, 170, 90), 0.9, reacquired=True, identity_confidence=0.7)])[0]
    assert o.speed_px_s == 0.0 and o.identity_confidence == 0.7


def test_track_summary_zone_fractions_gaps_and_activity():
    tb = TelemetryBuilder("v")
    rows = []
    # 10 frames near the surface (t=0.0..0.9), then nothing until t=3.0: a 2.0 s gap beyond the 0.1 s interval
    for i in range(10):
        rows += tb.observe(_frame(i), [TrackedObject(1, BBox(i * 5, 5, i * 5 + 20, 15), 0.9)])
    for i in range(30, 40):
        rows += tb.observe(_frame(i), [TrackedObject(1, BBox(i * 5, 85, i * 5 + 20, 95), 0.9)])
    (s,) = summarize_tracks(rows, frame_interval_s=0.1, full_score_speed=0.5, hiding_gap_s=1.0)
    assert s.n_observations == 20
    assert s.surface_fraction == 0.5 and s.bottom_fraction == 0.5 and s.middle_fraction == 0.0
    assert abs(s.surface_time_s - 1.0) < 1e-9
    assert abs(s.longest_gap_s - 2.0) < 1e-6
    assert s.extra["hiding_candidate"] is True and s.extra["n_gaps"] == 1
    # 5 px per 0.1 s = 50 px/s = 0.5 tank heights/s -> full score, ignoring the gap frame
    assert 90 <= s.activity_score <= 100
    assert abs(s.duration_s - (3.9 + 0.1)) < 1e-6


def test_summaries_are_per_track_and_sorted():
    tb = TelemetryBuilder("v")
    rows = []
    for i in range(5):
        rows += tb.observe(_frame(i), [TrackedObject(2, BBox(0, 0, 10, 10), 0.5), TrackedObject(1, BBox(50, 50, 60, 60), 0.8)])
    out = summarize_tracks(rows, 0.1)
    assert [s.track_id for s in out] == [1, 2]
    assert out[0].mean_confidence == 0.8
