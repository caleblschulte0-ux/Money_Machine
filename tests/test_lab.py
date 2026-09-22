"""The detector lab: camera geometry, sprites, plates, renderer labels, datasets, silver, eval."""

import json
import math
import random
from pathlib import Path

import cv2
import numpy as np
import pytest

from fishai.lab.camera import RailCamera, Tank, coverage_report, underwater_fov_deg
from fishai.lab.evaluate import evaluate_detector, score_predictions
from fishai.lab.plates import clean_plate, foreground_plants, plate_from_video, procedural_plate
from fishai.lab.render import Assets, RenderConfig, Scene, render_frame
from fishai.lab.silver import build_silver
from fishai.lab.sprites import cut_out, load_sprites, lookalike_group, procedural_fish
from fishai.lab.synth import generate_dataset, generate_video, load_video_truth
from fishai.lab.yolo import label_path_for, list_images, read_boxes, write_sample, write_split
from fishai.types import BBox, Detection
from fishai.video.synthetic import SyntheticAquarium
from tests.conftest import HAS_ML


# ------------------------------------------------------------------ camera
def test_refraction_matches_the_hardware_review():
    assert round(underwater_fov_deg(102.0), 1) == 71.3
    assert round(underwater_fov_deg(67.0), 1) == 48.9
    # 60 cm tall tank: from one third down the substrate appears at ~88 cm; from the middle at ~66 cm.
    assert round(RailCamera(camera_depth_cm=20).substrate_visible_from_cm(60), 0) == 88
    assert round(RailCamera(camera_depth_cm=30).substrate_visible_from_cm(60), 0) == 66


def test_projection_and_scale():
    c = RailCamera(1280, 720)
    assert c.project(0, 0, 50) == (640.0, 360.0)
    u, _ = c.project(10, 0, 50)
    assert abs((u - 640) - 10 * c.pixels_per_cm(50)) < 1e-9
    assert c.pixels_per_cm(100) == pytest.approx(c.pixels_per_cm(50) / 2)
    rep = coverage_report(c, Tank(60, 30, 35))
    assert rep["fish_px_at_far_glass"] < rep["fish_px_at_mid_tank"]
    assert 0 < rep["fraction_of_tank_length_with_full_depth"] < 1


# ----------------------------------------------------------------- sprites
def test_procedural_and_lookalike_sprites():
    rng = random.Random(1)
    s = procedural_fish(rng, 150)
    assert s.rgba.shape[2] == 4 and s.rgba[..., 3].max() == 255 and s.aspect > 1.2
    group = lookalike_group(rng, 4)
    assert len({g.group for g in group}) == 1 and len(group) == 4


def test_cut_out_recovers_a_fish_from_a_frame():
    img = np.full((200, 300, 3), (120, 90, 40), np.uint8)
    cv2.ellipse(img, (150, 100), (50, 20), 0, 0, 360, (30, 120, 240), -1)
    rgba = cut_out(img, (95, 75, 205, 125))
    assert rgba is not None
    h, w = rgba.shape[:2]
    assert 80 <= w <= 115 and 30 <= h <= 50
    assert cut_out(img, (0, 0, 5, 5)) is None


def test_load_sprites_roundtrip(tmp_path):
    s = procedural_fish(random.Random(2))
    cv2.imwrite(str(tmp_path / "a.png"), s.rgba)
    (tmp_path / "a.json").write_text(json.dumps({"source": "real", "origin": "clip.mp4"}))
    (loaded,) = load_sprites(tmp_path)
    assert loaded.source == "real" and loaded.rgba.shape == s.rgba.shape


# ------------------------------------------------------------------ plates
def test_plate_from_video_removes_moving_fish(tmp_path):
    p = tmp_path / "t.mp4"
    SyntheticAquarium(n_fish=3, seed=1).write(p, 120)
    plate = plate_from_video(p, size=(640, 360), samples=30)
    assert plate is not None
    bg = SyntheticAquarium(n_fish=0)._background
    assert float(np.abs(plate.astype(np.float32) - bg.astype(np.float32)).mean()) < 6.0


def test_clean_plate_paints_out_a_detected_fish():
    plate = procedural_plate(random.Random(3))
    dirty = plate.copy()
    cv2.ellipse(dirty, (300, 150), (40, 15), 0, 0, 360, (0, 0, 255), -1)

    class OneFish:
        def detect(self, frame):
            return [Detection(BBox(258, 133, 342, 167), 0.9)]

    clean, n = clean_plate(dirty, OneFish())
    assert n == 1
    assert float(np.abs(clean[140:160, 290:310].astype(int) - [0, 0, 255]).mean()) > 60


def test_foreground_plants_have_alpha():
    fg = foreground_plants(random.Random(4), (320, 180), 2)
    assert fg.shape == (180, 320, 4) and fg[..., 3].max() == 255


# ------------------------------------------------------------------ render
def test_labels_follow_occlusion_and_projection():
    rng = random.Random(7)
    cfg = RenderConfig(fish_count=(2, 2), p_night=0.0, p_foreground_plants=0.0, p_bubbles=0.0, p_reflection=0.0, p_distortion=0.0, p_real_sprite=0.0, p_real_plate=0.0)
    scene = Scene(rng, cfg, Assets())
    a, b = scene.fish
    # Put b directly behind a, same line of sight: b must be (mostly) hidden.
    a.x = a.y = b.x = b.y = 0.0
    a.z, b.z = 20.0, 60.0
    a.length_cm = b.length_cm = 6.0
    a.yaw = b.yaw = 0.0
    a.pitch = b.pitch = 0.0
    _, labels = scene.frame()
    by_id = {lab["id"]: lab for lab in labels}
    la = by_id[a.fid]
    assert la["visible_fraction"] > 0.95 and la["keep"]
    # b is hidden behind a: either no pixel of it survives (no label at all) or too little to keep.
    assert b.fid not in by_id or (by_id[b.fid]["visible_fraction"] < 0.35 and not by_id[b.fid]["keep"])
    # Move b out from behind a: now it is labelled and kept.
    b.x = 12.0
    _, labels = scene.frame()
    assert next(lab for lab in labels if lab["id"] == b.fid)["keep"]
    # Nearer fish is bigger by the ratio of distances.
    wa = la["box"][2] - la["box"][0]
    assert wa == pytest.approx(6.0 * scene.cam.pixels_per_cm(20.0), rel=0.1)


def test_truncated_fish_is_kept_when_enough_is_in_frame():
    rng = random.Random(8)
    cfg = RenderConfig(fish_count=(1, 1), p_night=0.0, p_foreground_plants=0.0, p_bubbles=0.0, p_reflection=0.0, p_distortion=0.0, p_real_sprite=0.0, p_real_plate=0.0)
    scene = Scene(rng, cfg, Assets())
    f = scene.fish[0]
    f.y, f.z, f.length_cm, f.yaw, f.pitch = 0.0, 30.0, 8.0, 0.0, 0.0
    half = scene.cam.visible_span_cm(30.0)[0] / 2
    f.x = half  # centre on the right edge: about half the fish is in frame
    _, (lab,) = scene.frame()
    assert 0.3 < lab["in_frame_fraction"] < 0.7 and lab["visible_fraction"] > 0.9 and lab["keep"]
    f.x = half + 3.5  # mostly outside
    _, labels = scene.frame()
    assert not labels or not labels[0]["keep"]


def test_night_frames_are_grey_and_scene_video_keeps_ids(tmp_path):
    rng = random.Random(9)
    img, _, scene = render_frame(rng, RenderConfig(p_night=1.0, p_real_plate=0.0, p_real_sprite=0.0), Assets())
    assert scene.night
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    assert hsv[..., 1].mean() < 25
    # Enough fish that some are always in view (a single fish can legitimately sit in the
    # blind zone near the surface, which the camera model predicts).
    meta = generate_video(tmp_path / "v.mp4", 30, RenderConfig(fish_count=(8, 10), p_real_plate=0.0, p_real_sprite=0.0), Assets(), seed=2)
    truth = load_video_truth(tmp_path / "v.mp4")
    assert len(truth) == 30 and meta["frames"] == 30
    ids = {i for fr in truth.values() for i in fr}
    assert ids and ids <= set(range(1, 13))


# ---------------------------------------------------------------- datasets
def test_generate_dataset_writes_yolo_split_and_manifest(tmp_path):
    m = generate_dataset(tmp_path / "ds", 12, "unit", RenderConfig(p_real_plate=0.0, p_real_sprite=0.0), Assets(), seed=1, val_fraction=0.25, manifests_dir=tmp_path / "manifests")
    assert m["frames"] == 12 and m["boxes"] > 0 and m["train"] + m["val"] == 12
    assert (tmp_path / "manifests" / "unit.json").exists()
    imgs = list_images(tmp_path / "ds")
    assert len(imgs) == 12
    img = cv2.imread(str(imgs[0]))
    boxes = read_boxes(label_path_for(imgs[0]), img.shape[1], img.shape[0])
    meta = json.loads((tmp_path / "ds" / "meta" / f"{imgs[0].stem}.json").read_text())
    assert len(boxes) == sum(1 for f in meta["fish"] if f["keep"])
    assert "data.yaml" in {p.name for p in (tmp_path / "ds").iterdir()}


def test_yolo_roundtrip_and_grouped_split(tmp_path):
    img = np.zeros((100, 200, 3), np.uint8)
    for g in ("a", "b", "c", "d"):
        for k in range(3):
            write_sample(tmp_path, f"{g}_{k}", img, [[10, 20, 50, 60]])
    (b,) = read_boxes(tmp_path / "labels" / "a_0.txt", 200, 100)
    assert [round(v) for v in b] == [10, 20, 50, 60]
    n_train, n_val = write_split(tmp_path, 0.25, group_of=lambda p: p.stem.split("_")[0])
    assert (n_train, n_val) == (9, 3)
    val_groups = {Path(p).stem.split("_")[0] for p in (tmp_path / "val.txt").read_text().split()}
    assert len(val_groups) == 1


# -------------------------------------------------------------- silver/eval
class _GroundTruthDetector:
    """Returns the labelled boxes of the image it is shown (looked up by pixel hash)."""

    name = "oracle"

    def __init__(self, table):
        self.table = table

    def detect(self, frame):
        return [Detection(BBox(*b), 0.9) for b in self.table.get(frame.image.tobytes()[:4096], [])]

    def close(self):
        pass


def test_score_predictions_and_breakdowns(tmp_path):
    generate_dataset(tmp_path / "ds", 8, "u", RenderConfig(p_real_plate=0.0, p_real_sprite=0.0, p_night=0.5), Assets(), seed=4, write_manifest=False)
    images = list_images(tmp_path / "ds")
    perfect = score_predictions(images, lambda img: [BBox(*b) for b in _boxes_for(img, images)])
    assert perfect["f1"] == 1.0 and perfect["recall_medium"] == 1.0 or perfect["recall_small"] == 1.0
    empty = score_predictions(images, lambda img: [])
    assert empty["recall"] == 0.0 and empty["fn"] > 0


def _boxes_for(img, images):
    for p in images:
        ref = cv2.imread(str(p))
        if ref.shape == img.shape and np.array_equal(ref, img):
            return read_boxes(label_path_for(p), img.shape[1], img.shape[0])
    return []


def test_build_silver_labels_real_frames_with_the_bootstrap(tmp_path):
    clip = tmp_path / "c.mp4"
    SyntheticAquarium(n_fish=2, seed=5).write(clip, 60)

    class Fixed:
        name = "fixed"

        def detect(self, frame):
            return [Detection(BBox(10, 10, 60, 40), 0.8), Detection(BBox(100, 100, 150, 130), 0.3)]

    m = build_silver([clip], Fixed(), tmp_path / "silver", every_n=10, per_clip=4)
    assert m["frames"] == 4 and m["boxes"] == 4, "the 0.3 box is below the floor"
    assert "SILVER" in m["labels_are"]
    assert len(list_images(tmp_path / "silver" / "val.txt")) == 4
    score = evaluate_detector(Fixed(), list_images(tmp_path / "silver" / "val.txt"))
    assert score["recall"] == 1.0


# ----------------------------------------------------------------- trainer
@pytest.mark.ml
@pytest.mark.skipif(not HAS_ML, reason="torch not installed")
def test_trainer_runs_saves_and_loads_as_a_backend(tmp_path):
    from fishai.lab.trainer import TrainConfig, train
    from fishai.perception.detection import build_detector
    from fishai.types import Frame

    generate_dataset(tmp_path / "ds", 8, "u", RenderConfig(width=320, height=180, p_real_plate=0.0, p_real_sprite=0.0), Assets(), seed=6, val_fraction=0.25, write_manifest=False)
    rec = train([tmp_path / "ds"], tmp_path / "ds", tmp_path / "m.pt", TrainConfig(epochs=1, batch_size=2, pretrained=False, min_size=180, max_size=320))
    assert (tmp_path / "m.pt").exists() and rec["train_images"] == 6 and rec["val_images"] == 2
    assert "Ultralytics" in rec["framework"] and "from scratch" in rec["start_weights"]
    det = build_detector({"backend": "torchvision", "torchvision": {"model": str(tmp_path / "m.pt")}, "min_confidence": 0.0})
    dets = det.detect(Frame(0, 0.0, np.zeros((180, 320, 3), np.uint8)))
    assert all(0 <= d.confidence <= 1 for d in dets)
    assert math.isfinite(rec["history"][0]["loss"])
