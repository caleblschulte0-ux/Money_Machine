from pathlib import Path

import pytest

from fishai.config import REPO_ROOT, load_config
from fishai.types import BBox, Zone


def test_bbox_geometry():
    a = BBox(0, 0, 10, 10)
    b = BBox(5, 5, 15, 15)
    assert a.area == 100
    assert a.center == (5, 5)
    assert abs(a.iou(b) - 25 / 175) < 1e-9
    assert a.iou(BBox(20, 20, 30, 30)) == 0.0
    assert a.clipped(5, 5) == BBox(0, 0, 5, 5)


def test_config_defaults_and_overrides(tmp_path: Path):
    cfg = load_config()
    assert cfg.get_path("detection.backend") == "motion"
    assert cfg.get_path("nope.missing", 42) == 42
    cfg2 = load_config(overrides=["tracking.backend=bytetrack", "video.max_frames=10", "behavior.zones.surface_below=0.1"])
    assert cfg2.get_path("tracking.backend") == "bytetrack"
    assert cfg2.get_path("video.max_frames") == 10
    assert cfg2.get_path("behavior.zones.surface_below") == 0.1
    assert cfg.hash() != cfg2.hash()
    override = tmp_path / "o.yaml"
    override.write_text("detection:\n  min_confidence: 0.9\n", encoding="utf-8")
    cfg3 = load_config(override)
    assert cfg3.get_path("detection.min_confidence") == 0.9
    assert cfg3.get_path("detection.backend") == "motion", "deep merge keeps sibling keys"


def test_bad_override_rejected():
    with pytest.raises(ValueError):
        load_config(overrides=["no-equals-sign"])


def test_resolve_path_is_repo_relative():
    cfg = load_config()
    assert cfg.resolve_path("paths.models_dir") == REPO_ROOT / "models"


def test_zone_enum_values_are_stable():
    assert [z.value for z in Zone] == ["surface", "middle", "bottom"]
