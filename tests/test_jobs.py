import json
from pathlib import Path

from fishai.jobs.daily import run_daily
from fishai.jobs.export import export_dataset, export_summaries_csv
from fishai.jobs.ingest import ingest_folder, new_videos
from fishai.perception.detection.synthetic import SyntheticDetector
from fishai.pipeline import process_video
from fishai.storage import Database
from fishai.video.synthetic import SyntheticAquarium


def test_ingest_processes_only_new_files(cfg, workdir):
    folder = workdir / "inbox"
    folder.mkdir()
    for i in range(2):
        SyntheticAquarium(n_fish=2, seed=i).write(folder / f"clip{i}.mp4", 60)
    (folder / "notes.txt").write_text("ignored")
    cfg.set_path("detection.backend", "motion")
    with Database(cfg.resolve_path("paths.database")) as db:
        assert len(new_videos(db, folder)) == 2
        results = ingest_folder(cfg, folder, db=db, annotate=False, stability_wait_s=0)
        assert len(results) == 2
        assert new_videos(db, folder) == []
        assert ingest_folder(cfg, folder, db=db, annotate=False, stability_wait_s=0) == []
        SyntheticAquarium(n_fish=2, seed=9).write(folder / "clip9.mp4", 60)
        assert len(ingest_folder(cfg, folder, db=db, annotate=False, stability_wait_s=0)) == 1
        assert len(db.list_videos()) == 3


def test_ingest_survives_a_bad_file(cfg, workdir):
    folder = workdir / "inbox"
    folder.mkdir()
    (folder / "broken.mp4").write_bytes(b"not a video")
    SyntheticAquarium(n_fish=1, seed=1).write(folder / "good.mp4", 40)
    cfg.set_path("detection.backend", "motion")
    with Database(cfg.resolve_path("paths.database")) as db:
        results = ingest_folder(cfg, folder, db=db, annotate=False, stability_wait_s=0)
        assert len(results) == 1
        assert db.events("ingest_failed")[0]["payload"]["path"].endswith("broken.mp4")


def test_export_dataset_writes_yolo_labels_and_manifest(cfg, workdir, synthetic_video, monkeypatch):
    path, truth = synthetic_video
    monkeypatch.setattr("fishai.jobs.export.MANIFESTS_DIR", workdir / "manifests")
    with Database(cfg.resolve_path("paths.database")) as db:
        r = process_video(path, cfg, db=db, detector=SyntheticDetector(truth), annotate=False)
        m = export_dataset(db, cfg, workdir / "ds", "unit", min_confidence=0.5, max_frames_per_video=10)
        n_csv = export_summaries_csv(db, workdir / "s.csv")
    assert m["frames"] == 10 and m["boxes"] >= 20
    images = sorted((workdir / "ds" / "images").glob("*.jpg"))
    labels = sorted((workdir / "ds" / "labels").glob("*.txt"))
    assert len(images) == len(labels) == 10
    line = labels[0].read_text().splitlines()[0].split()
    assert line[0] == "0" and all(0.0 <= float(v) <= 1.0 for v in line[1:])
    assert (workdir / "ds" / "data.yaml").exists()
    manifest = json.loads((workdir / "manifests" / "unit.json").read_text())
    assert manifest["sources"][0]["video_id"] == r.video_id and "review" in manifest["labels_are"]
    assert n_csv == 3 and "fish_id" in (workdir / "s.csv").read_text().splitlines()[0]


def test_daily_reviews_new_sessions_once(cfg, workdir):
    cfg.set_path("detection.backend", "motion")
    cfg.set_path("reasoning.backend", "rules")
    with Database(cfg.resolve_path("paths.database")) as db:
        for i in range(2):
            p = workdir / f"d{i}.mp4"
            SyntheticAquarium(n_fish=2, seed=i).write(p, 60)
            process_video(p, cfg, db=db, annotate=False)
        rep = run_daily(cfg, db=db, rules_only=True)
        assert len(rep["sessions_reviewed"]) == 2
        assert rep["assessment"]["source"] == "rules"
        assert Path(rep["path"]).exists()
        rep2 = run_daily(cfg, db=db, rules_only=True)
        assert rep2["sessions_reviewed"] == [], "already reviewed"
        assert len(db.events("daily")) == 2
