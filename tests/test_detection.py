import numpy as np
import pytest

from fishai.perception.detection import available_detectors, build_detector
from fishai.perception.detection.motion import MotionDetector
from fishai.perception.detection.synthetic import SyntheticDetector
from fishai.types import BBox, Frame
from fishai.video import VideoReader


def test_registry_lists_builtins():
    assert {"motion", "synthetic", "yolo"} <= set(available_detectors())
    with pytest.raises(ValueError):
        build_detector({"backend": "nope"})


def test_synthetic_detector_replays_truth(synthetic_video):
    path, truth = synthetic_video
    det = SyntheticDetector(truth)
    frames = list(VideoReader(str(path), max_frames=3))
    dets = det.detect(frames[0])
    assert len(dets) == len(truth[0])
    assert all(d.confidence > 0.9 for d in dets)


def test_motion_detector_finds_moving_fish(synthetic_video):
    path, truth = synthetic_video
    det = MotionDetector()
    hits = 0
    checked = 0
    for f in VideoReader(str(path)):
        dets = det.detect(f)
        if f.index < 20:
            continue
        checked += 1
        gt = truth[f.index].values()
        if any(d.bbox.iou(g) >= 0.4 for d in dets for g in gt):
            hits += 1
    assert checked > 0 and hits / checked > 0.8


def test_motion_detector_silent_on_static_scene():
    det = MotionDetector(warmup_frames=2)
    img = np.full((120, 160, 3), 80, dtype=np.uint8)
    for i in range(20):
        assert det.detect(Frame(i, i / 20, img)) == []


def test_motion_detector_rejects_bad_method():
    with pytest.raises(ValueError):
        MotionDetector(method="magic")


def test_motion_detector_respects_area_limits():
    det = MotionDetector(warmup_frames=1, buffer_frames=5, sample_every=1, min_area_px=50, max_area_fraction=0.05)
    bg = np.zeros((200, 200, 3), dtype=np.uint8)
    for i in range(6):
        det.detect(Frame(i, i / 10, bg))
    big = bg.copy()
    big[20:180, 20:180] = 255  # 64% of the frame: too big to be a fish
    assert det.detect(Frame(6, 0.6, big)) == []
    small = bg.copy()
    small[50:70, 50:70] = 255
    dets = det.detect(Frame(7, 0.7, small))
    assert len(dets) == 1 and dets[0].bbox.iou(BBox(50, 50, 70, 70)) > 0.6
