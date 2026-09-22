import numpy as np
import pytest

from fishai.perception import lighting
from fishai.perception.behavior.telemetry import ZoneModel
from fishai.perception.detection.synthetic import SyntheticDetector
from fishai.pipeline import process_video
from fishai.storage import Database
from fishai.types import Zone
from fishai.video.synthetic import SyntheticAquarium


def test_detect_mode_from_saturation():
    colour = np.zeros((60, 80, 3), np.uint8)
    colour[:] = (30, 90, 200)
    grey = np.full((60, 80, 3), 120, np.uint8)
    assert lighting.detect_mode(colour) == "day"
    assert lighting.detect_mode(grey) == "night"
    assert lighting.mean_saturation(grey) == 0.0


def test_top_view_has_no_depth_zones():
    z = ZoneModel.from_config({}, view="top")
    assert z.zone_for(0.05) == Zone.MIDDLE and z.zone_for(0.95) == Zone.MIDDLE and not z.has_depth
    assert ZoneModel.from_config({}, view="side").zone_for(0.05) == Zone.SURFACE
    with pytest.raises(ValueError):
        ZoneModel.from_config({}, view="drone")


def test_session_records_camera_and_lighting(cfg, synthetic_video):
    path, truth = synthetic_video
    cfg.set_path("camera.id", "cam2")
    r = process_video(path, cfg, detector=SyntheticDetector(truth), annotate=False)
    assert r.summary["video"]["camera_id"] == "cam2"
    assert r.summary["video"]["lighting_mode"] == "day"
    with Database(cfg.resolve_path("paths.database")) as db:
        v = db.get_video(r.video_id)
        assert v["camera_id"] == "cam2" and v["lighting_mode"] == "day"
        assert all(set(f["descriptors"]) == {"cam2/day"} for f in db.list_fish())


def test_night_session_is_flagged_and_kept_apart(cfg, workdir):
    """A grey (infrared-like) clip: night mode, and its fish are not matched to day fish."""
    day = workdir / "day.mp4"
    truth_day = SyntheticAquarium(n_fish=2, seed=4).write(day, 60)
    process_video(day, cfg, detector=SyntheticDetector(truth_day), annotate=False)
    import cv2

    from fishai.video import VideoReader, VideoWriter

    night = workdir / "night.mp4"
    with VideoWriter(night, 20.0, (640, 360)) as w:
        for f in VideoReader(str(day)):
            g = cv2.cvtColor(f.image, cv2.COLOR_BGR2GRAY)
            w.write(cv2.cvtColor(g, cv2.COLOR_GRAY2BGR))
    r = process_video(night, cfg, detector=SyntheticDetector(truth_day), annotate=False)
    assert r.summary["video"]["lighting_mode"] == "night"
    assert any("infrared" in n for n in r.summary["notes"])
    with Database(cfg.resolve_path("paths.database")) as db:
        assert len(db.list_fish()) == 4, "two day fish and two night fish; nothing bridged them"
        keys = {k for f in db.list_fish() for k in f["descriptors"]}
        assert keys == {"cam1/day", "cam1/night"}


def test_top_view_summary_says_so(cfg, synthetic_video):
    path, truth = synthetic_video
    cfg.set_path("camera.view", "top")
    r = process_video(path, cfg, detector=SyntheticDetector(truth), annotate=False)
    assert all(f["zone_fractions"]["middle"] == 1.0 for f in r.summary["fish"])
    assert any("top-down" in n for n in r.summary["notes"])
