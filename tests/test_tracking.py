import pytest

from fishai.perception.detection.synthetic import SyntheticDetector
from fishai.perception.tracking import appearance, available_trackers, build_tracker
from fishai.perception.tracking.simple import SimpleTracker
from fishai.types import BBox, Detection, Frame
from fishai.video import VideoReader
from fishai.video.synthetic import SyntheticAquarium
from tests.conftest import HAS_SV


def _run(path, truth, tracker, jitter=2.0, dropout=0.0):
    det = SyntheticDetector(truth, jitter_px=jitter, dropout=dropout)
    per_frame = {}
    reacquired = []
    for f in VideoReader(str(path)):
        objs = tracker.update(f, det.detect(f))
        per_frame[f.index] = [(o.track_id, o.bbox) for o in objs]
        reacquired += [(f.index, o.track_id, o.identity_confidence) for o in objs if o.reacquired]
    return per_frame, reacquired


def test_registry():
    assert {"simple", "bytetrack"} <= set(available_trackers())
    with pytest.raises(ValueError):
        build_tracker({"backend": "nope"})


def test_ids_are_stable_on_clean_detections(synthetic_video):
    path, truth = synthetic_video
    per_frame, _ = _run(path, truth, SimpleTracker(fps=20))
    from fishai.evaluation import score_tracking

    s = score_tracking(truth, per_frame)
    assert s.gt_ids == 3
    assert s.id_switches == 0
    assert s.fragments_per_gt == 1.0
    assert s.purity == 1.0


def test_hidden_fish_is_reacquired_with_honest_confidence(synthetic_video):
    """Fish 2 vanishes for 60 frames (3 s); the same id must come back, marked reacquired."""
    path, truth = synthetic_video
    per_frame, reacquired = _run(path, truth, SimpleTracker(fps=20))
    ids = {t for objs in per_frame.values() for t, _ in objs}
    assert ids == {1, 2, 3}
    assert len(reacquired) == 1
    frame, tid, conf = reacquired[0]
    assert frame == 120 and tid == 2
    assert 0.6 <= conf < 1.0, "a re-link is never reported as certain"


def test_without_reid_the_hidden_fish_gets_a_new_id(synthetic_video):
    path, truth = synthetic_video
    per_frame, reacquired = _run(path, truth, SimpleTracker(fps=20, reid={"enabled": False}))
    ids = {t for objs in per_frame.values() for t, _ in objs}
    assert len(ids) == 4 and not reacquired


def test_min_hits_suppresses_one_frame_noise():
    tr = SimpleTracker(fps=20, min_hits=2)
    import numpy as np

    img = np.zeros((100, 100, 3), dtype=np.uint8)
    f0 = Frame(0, 0.0, img)
    assert tr.update(f0, [Detection(BBox(10, 10, 30, 30), 0.9)]) == []
    f1 = Frame(1, 0.05, img)
    out = tr.update(f1, [Detection(BBox(11, 11, 31, 31), 0.9)])
    assert [o.track_id for o in out] == [1] and out[0].hits == 2


def test_dropouts_do_not_switch_ids(workdir):
    path = workdir / "d.mp4"
    truth = SyntheticAquarium(n_fish=3, seed=5).write(path, 150)
    per_frame, _ = _run(path, truth, SimpleTracker(fps=20), dropout=0.2)
    from fishai.evaluation import score_tracking

    s = score_tracking(truth, per_frame)
    assert s.id_switches == 0 and s.purity == 1.0


def test_appearance_similarity_orders_colours():
    import numpy as np

    red = np.zeros((40, 40, 3), dtype=np.uint8)
    red[:] = (0, 0, 220)
    blue = np.zeros((40, 40, 3), dtype=np.uint8)
    blue[:] = (220, 0, 0)
    box = BBox(0, 0, 40, 40)
    dr, db_ = appearance.describe(red, box), appearance.describe(blue, box)
    assert appearance.similarity(dr, dr) > 0.99
    assert appearance.similarity(dr, db_) < 0.2
    assert appearance.describe(red, BBox(0, 0, 1, 1)) is None
    assert appearance.similarity(None, dr) == 0.0


@pytest.mark.skipif(not HAS_SV, reason="supervision not installed")
@pytest.mark.parametrize("provider", ["auto", "supervision"])
def test_bytetrack_adapter_tracks_synthetic(synthetic_video, provider):
    path, truth = synthetic_video
    tr = build_tracker({"backend": "bytetrack", "bytetrack": {"provider": provider}}, fps=20)
    per_frame, _ = _run(path, truth, tr)
    from fishai.evaluation import score_tracking

    s = score_tracking(truth, per_frame)
    assert s.matched_frames > 400
    assert s.purity > 0.95
    assert s.id_switches <= 2
