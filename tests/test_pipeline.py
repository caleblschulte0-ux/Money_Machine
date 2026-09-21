import json

from fishai.perception.detection.synthetic import SyntheticDetector
from fishai.pipeline import process_video
from fishai.storage import Database


def test_phase1_success_criteria_on_synthetic_video(cfg, synthetic_video, workdir):
    """Input video -> detections -> ids -> movement -> stored -> JSON -> annotated video, no labels."""
    path, truth = synthetic_video
    cfg.set_path("behavior.hiding_gap_s", 2.0)  # fish 2 is hidden for 3 s
    r = process_video(path, cfg, detector=SyntheticDetector(truth, jitter_px=1.5))
    assert r.summary_path.exists() and r.annotated_path.exists()
    s = json.loads(r.summary_path.read_text())
    assert s["pipeline"]["processed_frames"] == 200
    assert s["counts"]["tracks"] == 3
    assert s["counts"]["distinct_fish_estimate"] == 3
    fish = {f["track_id"]: f for f in s["fish"]}
    assert set(fish) == {1, 2, 3}
    assert fish[2]["hiding_candidate"] is True and fish[2]["longest_gap_s"] > 2.5
    assert fish[1]["hiding_candidate"] is False
    for f in fish.values():
        zf = f["zone_fractions"]
        assert abs(zf["surface"] + zf["middle"] + zf["bottom"] - 1.0) < 1e-6
        assert f["activity_score"] > 0 and f["mean_speed_px_s"] > 0
        assert f["fish_id"] is not None
    assert fish[2]["min_track_identity_confidence"] < 1.0, "the re-link's uncertainty must be visible"
    with Database(cfg.resolve_path("paths.database")) as db:
        total_truth = sum(len(v) for v in truth.values())
        assert db.count_observations(r.video_id) == r.observations
        # min_hits=2 withholds each track's first frame: 3 fish -> 3 fewer rows than truth
        assert r.observations == total_truth - 3
        assert len(db.track_summaries(r.video_id)) == 3
        assert len(db.list_fish()) == 3
        assert db.events("video_processed")[0]["video_id"] == r.video_id
    # annotated video has the same number of frames as the input
    from fishai.video import probe_video

    assert probe_video(str(r.annotated_path)).frame_count == 200


def test_reprocessing_replaces_results_and_keeps_identity(cfg, synthetic_video):
    path, truth = synthetic_video
    r1 = process_video(path, cfg, detector=SyntheticDetector(truth), annotate=False)
    r2 = process_video(path, cfg, detector=SyntheticDetector(truth), annotate=False)
    assert r1.video_id == r2.video_id
    with Database(cfg.resolve_path("paths.database")) as db:
        assert db.count_observations(r2.video_id) == r2.observations
        assert len(db.list_videos()) == 1
        assert len(db.list_fish()) == 3, "the same three fish, not six"
    assert all(v["confidence"] > 0.6 for v in r2.identities.values())


def test_motion_backend_end_to_end_without_any_model(cfg, synthetic_video):
    path, _ = synthetic_video
    cfg.set_path("detection.backend", "motion")
    r = process_video(path, cfg, annotate=False)
    assert r.observations > 300
    assert 3 <= r.summary["counts"]["tracks"] <= 12
    assert any("motion detector" in n for n in r.summary["notes"])


def test_frame_stride_keeps_real_timestamps(cfg, synthetic_video):
    path, truth = synthetic_video
    cfg.set_path("video.frame_stride", 4)
    r = process_video(path, cfg, detector=SyntheticDetector(truth), annotate=False)
    assert r.summary["pipeline"]["processed_frames"] == 50
    with Database(cfg.resolve_path("paths.database")) as db:
        obs = db.observations(r.video_id, track_id=1)
    assert obs[1].timestamp_s - obs[0].timestamp_s > 0.19
    by_id = {s.track_id: s for s in r.tracks}
    assert by_id[1].duration_s > 9.0 and by_id[3].duration_s > 9.0, "the two never-hidden fish span the clip"
    assert by_id[1].n_observations == 49
