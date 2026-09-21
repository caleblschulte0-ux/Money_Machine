from fishai.evaluation import score_detections, score_tracking
from fishai.perception.detection.motion import MotionDetector
from fishai.perception.tracking.simple import SimpleTracker
from fishai.types import BBox
from fishai.video import VideoReader
from fishai.video.synthetic import SyntheticAquarium


def test_detection_scores():
    truth = {0: {1: BBox(0, 0, 10, 10), 2: BBox(50, 50, 60, 60)}, 1: {1: BBox(0, 0, 10, 10)}}
    preds = {0: [(7, BBox(1, 1, 11, 11)), (8, BBox(90, 90, 99, 99))], 1: []}
    s = score_detections(truth, preds, iou_threshold=0.4)
    assert (s.tp, s.fp, s.fn) == (1, 1, 2)
    assert 0 < s.precision < 1 and s.recall == 1 / 3


def test_tracking_scores_count_switches_and_fragments():
    truth = {i: {1: BBox(i, 0, i + 10, 10)} for i in range(6)}
    preds = {i: [((1 if i < 3 else 2), BBox(i, 0, i + 10, 10))] for i in range(6)}
    s = score_tracking(truth, preds)
    assert s.id_switches == 1 and s.fragments_per_gt == 2.0 and s.purity == 1.0 and s.pred_ids == 2


def test_motion_detector_baseline_quality(workdir):
    """Guards the measured numbers quoted in the motion detector's docstring."""
    path = workdir / "t.mp4"
    truth = SyntheticAquarium(n_fish=3, seed=7).write(path, 200)
    det, tr = MotionDetector(), SimpleTracker(fps=20)
    preds = {}
    for f in VideoReader(str(path)):
        preds[f.index] = [(o.track_id, o.bbox) for o in tr.update(f, det.detect(f))]
    t2 = {k: v for k, v in truth.items() if k >= 15}
    d, t = score_detections(t2, preds), score_tracking(t2, preds)
    assert d.f1 >= 0.8
    assert d.recall >= 0.85
    assert t.purity >= 0.95
