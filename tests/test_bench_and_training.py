import json
import subprocess
import sys
from pathlib import Path

from fishai.jobs.bench import render_markdown, run_bench
from fishai.jobs.export import export_dataset
from fishai.perception.detection.synthetic import SyntheticDetector
from fishai.pipeline import process_video
from fishai.storage import Database
from fishai.video.synthetic import SyntheticAquarium


def test_bench_runs_local_manifest_and_writes_report(cfg, workdir):
    clip = workdir / "clips" / "tank_a.mp4"
    clip.parent.mkdir()
    SyntheticAquarium(n_fish=3, seed=2).write(clip, 120)
    manifest = workdir / "m.json"
    manifest.write_text(json.dumps({"clips": [{"name": "tank_a", "license": "own", "notes": "synthetic"}, {"name": "missing", "url": "", "license": "own"}]}))
    cfg.set_path("detection.backend", "motion")
    s = run_bench(cfg, manifest=manifest, clips_dir=clip.parent, out_dir=workdir / "bench", max_frames=100, stride=1, max_side=None)
    assert s["skipped"] == ["missing"]
    (r,) = s["clips"]
    assert r["frames"] == 100 and r["frames_with_detections"] > 0.7 and r["detections_per_frame"] > 1.5
    assert Path(r["contact_sheet"]).exists()
    assert (workdir / "bench" / "report.md").exists() and "tank_a" in render_markdown(s)
    if r["weak_frames"]:
        assert list(Path(r["review_dir"]).glob("*.jpg"))


def test_split_dataset_by_video(cfg, workdir, synthetic_video, monkeypatch):
    path, truth = synthetic_video
    monkeypatch.setattr("fishai.jobs.export.MANIFESTS_DIR", workdir / "manifests")
    other = workdir / "other.mp4"
    truth2 = SyntheticAquarium(n_fish=2, seed=9).write(other, 60)
    with Database(cfg.resolve_path("paths.database")) as db:
        process_video(path, cfg, db=db, detector=SyntheticDetector(truth), annotate=False)
        process_video(other, cfg, db=db, detector=SyntheticDetector(truth2), annotate=False)
        export_dataset(db, cfg, workdir / "ds", "unit", max_frames_per_video=6)
    r = subprocess.run([sys.executable, "training/split_dataset.py", str(workdir / "ds"), "--val", "0.5"], capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
    train = (workdir / "ds" / "train.txt").read_text().split()
    val = (workdir / "ds" / "val.txt").read_text().split()
    assert len(train) == 6 and len(val) == 6
    assert {Path(p).stem.rsplit("_", 1)[0] for p in train}.isdisjoint({Path(p).stem.rsplit("_", 1)[0] for p in val})
    assert "train.txt" in (workdir / "ds" / "data.yaml").read_text()


def test_train_script_reports_missing_ml_cleanly(workdir):
    r = subprocess.run([sys.executable, "training/train_detector.py", "--help"], capture_output=True, text=True)
    assert r.returncode == 0 and "fine-tune" in r.stdout.lower()
