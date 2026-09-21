"""Real detector/tracker adapters. Skipped unless the ML extras and weights are present."""

from pathlib import Path

import pytest

from fishai.config import REPO_ROOT, load_config
from tests.conftest import HAS_ML

WEIGHTS = REPO_ROOT / "models" / "fishial_detector_v26" / "fishial_detector_v26.pt"
pytestmark = [pytest.mark.ml, pytest.mark.skipif(not (HAS_ML and WEIGHTS.exists()), reason="ML extras or weights missing")]


def test_yolo_adapter_loads_fishial_and_runs(synthetic_video):
    from fishai.perception.detection import build_detector
    from fishai.video import VideoReader

    cfg = load_config()
    det = build_detector(dict(cfg.section("detection"), backend="yolo", models_dir=str(REPO_ROOT / "models")))
    assert det.names == {0: "Fish"}
    path, _ = synthetic_video
    frame = next(iter(VideoReader(str(path), max_frames=1)))
    dets = det.detect(frame)  # cartoon fish may or may not be detected; the call must simply work
    assert all(0.0 <= d.confidence <= 1.0 for d in dets)
    det.close()


def test_yolo_missing_weights_message(tmp_path: Path):
    from fishai.models_registry import resolve_model_path

    with pytest.raises(FileNotFoundError, match="download_models.py"):
        resolve_model_path("yolov8n_coco", models_dir=tmp_path)
