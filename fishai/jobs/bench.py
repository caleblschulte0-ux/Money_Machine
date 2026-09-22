"""Benchmark the detector and tracker on a manifest of licensed public clips.

Ground truth is not available for these clips, so the report measures what
can be measured without it: how often the detector sees anything, how many
detections per frame, how confident it is, how fragmented the tracks are
relative to the number of fish it believes it saw, and speed. Alongside
the numbers it writes a contact sheet per clip (annotated frames) so a
person can judge in ten seconds, and exports the WEAK frames (low
confidence, or gaps between detections) as a review set for fine-tuning.
"""

from __future__ import annotations

import json
import shutil
import tempfile
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from fishai.config import REPO_ROOT, Config
from fishai.log import get_logger
from fishai.pipeline.annotate import Annotator
from fishai.pipeline.process import build_perception
from fishai.pipeline.session import SessionProcessor
from fishai.storage import Database
from fishai.video import VideoReader

log = get_logger(__name__)

DEFAULT_MANIFEST = REPO_ROOT / "datasets" / "manifests" / "public_clips.json"
DEFAULT_CLIPS_DIR = REPO_ROOT / "datasets" / "public_clips"


def load_manifest(path: Path | None = None) -> list[dict[str, Any]]:
    p = path or DEFAULT_MANIFEST
    data = json.loads(p.read_text(encoding="utf-8"))
    return list(data.get("clips", []))


def ensure_clip(entry: dict[str, Any], clips_dir: Path) -> Path | None:
    clips_dir.mkdir(parents=True, exist_ok=True)
    dest = clips_dir / f"{entry['name']}.mp4"
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    url = entry.get("url")
    if not url:
        return None
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (FishAI bench)"})
        with urllib.request.urlopen(req, timeout=120) as resp, open(dest, "wb") as out:  # noqa: S310 - manifest URLs
            shutil.copyfileobj(resp, out)
        return dest
    except Exception as exc:
        log.error("could not download %s: %s", entry["name"], exc)
        dest.unlink(missing_ok=True)
        return None


def _contact_sheet(frames: list[np.ndarray], cols: int = 3, width: int = 420) -> np.ndarray | None:
    if not frames:
        return None
    tiles = []
    for img in frames:
        h, w = img.shape[:2]
        tiles.append(cv2.resize(img, (width, int(h * width / w))))
    th = max(t.shape[0] for t in tiles)
    tiles = [cv2.copyMakeBorder(t, 0, th - t.shape[0], 0, 0, cv2.BORDER_CONSTANT, value=(0, 0, 0)) for t in tiles]
    rows = [tiles[i : i + cols] for i in range(0, len(tiles), cols)]
    while len(rows[-1]) < cols:
        rows[-1].append(np.zeros_like(tiles[0]))
    return np.vstack([np.hstack(r) for r in rows])


def bench_clip(
    path: Path,
    cfg: Config,
    out_dir: Path,
    detector: Any,
    tracker: Any,
    max_frames: int | None,
    stride: int,
    max_side: int | None,
    weak_confidence: float,
    review_limit: int,
) -> dict[str, Any]:
    reader = VideoReader(str(path), stride=stride, max_frames=max_frames, max_side=max_side)
    tracker.reset()
    with Database(None) as db:
        sp = SessionProcessor(
            cfg, db, f"bench-{path.stem}", str(path), detector, tracker, width=reader.output_size[0], height=reader.output_size[1],
            fps=reader.fps, frame_interval_s=stride / reader.fps, frame_count=reader.info.frame_count, duration_s=reader.info.duration_s,
            out_dir=None, annotate=False, write_summary_file=False, link_identity=True, progress_every=0,
        )
        ann = Annotator(trail_length=15, draw_zones=False, font_scale=0.45)
        sheet_every = max(1, (max_frames or reader.info.frame_count or 300) // stride // 6)
        sheet_frames: list[np.ndarray] = []
        confidences: list[float] = []
        per_frame_counts: list[int] = []
        weak: list[tuple[float, int, np.ndarray]] = []
        had_detection = False
        t0 = time.time()
        for frame in reader:
            step = sp.step(frame)
            n = len(step.detections)
            per_frame_counts.append(n)
            confidences += [d.confidence for d in step.detections]
            if n:
                had_detection = True
                low = min(d.confidence for d in step.detections)
                if low < weak_confidence:
                    weak.append((low, frame.index, frame.image))
            elif had_detection:
                weak.append((0.0, frame.index, frame.image))
            if sp.processed % sheet_every == 1 and len(sheet_frames) < 6:
                sheet_frames.append(ann.draw(frame, step.tracked, f"{path.stem} f{frame.index}"))
        elapsed = time.time() - t0
        result = sp.finish()
    n_frames = len(per_frame_counts)
    tracks = [s for s in result.tracks if s.n_observations >= 5]
    fish_est = result.summary["counts"]["distinct_fish_estimate"]
    report = {
        "clip": path.stem,
        "frames": n_frames,
        "fps_processed": round(n_frames / elapsed, 2) if elapsed > 0 else None,
        "frames_with_detections": round(sum(1 for c in per_frame_counts if c) / n_frames, 3) if n_frames else 0.0,
        "detections_per_frame": round(float(np.mean(per_frame_counts)), 2) if per_frame_counts else 0.0,
        "mean_confidence": round(float(np.mean(confidences)), 3) if confidences else None,
        "low_confidence_share": round(sum(1 for c in confidences if c < weak_confidence) / len(confidences), 3) if confidences else None,
        "tracks": len(result.tracks),
        "tracks_5plus": len(tracks),
        "distinct_fish_estimate": fish_est,
        "fragments_per_fish": round(len(tracks) / fish_est, 2) if fish_est else None,
        "mean_track_seconds": round(float(np.mean([s.duration_s for s in tracks])), 2) if tracks else 0.0,
        "reacquired_tracks": sum(1 for s in result.tracks if s.min_identity_confidence < 0.999),
        "weak_frames": len(weak),
    }
    out_dir.mkdir(parents=True, exist_ok=True)
    sheet = _contact_sheet(sheet_frames)
    if sheet is not None:
        cv2.imwrite(str(out_dir / f"{path.stem}.sheet.jpg"), sheet, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        report["contact_sheet"] = str(out_dir / f"{path.stem}.sheet.jpg")
    review = out_dir / "review" / path.stem
    if weak:
        review.mkdir(parents=True, exist_ok=True)
        # Worst first, then spread through the clip.
        weak.sort(key=lambda w: (w[0], w[1]))
        step_n = max(1, len(weak) // review_limit)
        for low, idx, img in weak[::step_n][:review_limit]:
            cv2.imwrite(str(review / f"{path.stem}_{idx:06d}_c{low:.2f}.jpg"), img, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
        report["review_dir"] = str(review)
    return report


def run_bench(
    cfg: Config,
    manifest: Path | None = None,
    clips_dir: Path | None = None,
    out_dir: Path | None = None,
    names: list[str] | None = None,
    max_frames: int | None = 300,
    stride: int = 2,
    max_side: int | None = 640,
    weak_confidence: float = 0.5,
    review_limit: int = 12,
    detector: Any = None,
    tracker: Any = None,
    extra_paths: list[Path] | None = None,
) -> dict[str, Any]:
    entries = load_manifest(manifest)
    if names:
        entries = [e for e in entries if e["name"] in names]
    clips_dir = clips_dir or DEFAULT_CLIPS_DIR
    out_dir = out_dir or (cfg.resolve_path("paths.output_dir") / "bench" / datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S"))
    out_dir.mkdir(parents=True, exist_ok=True)
    fps_guess = 30.0 / stride
    detector, tracker = build_perception(cfg, fps_guess, detector, tracker)
    reports: list[dict[str, Any]] = []
    skipped: list[str] = []
    paths: list[tuple[str, Path | None, dict[str, Any]]] = [(e["name"], ensure_clip(e, clips_dir), e) for e in entries]
    paths += [(p.stem, p, {"license": "own"}) for p in (extra_paths or [])]
    for name, path, entry in paths:
        if path is None:
            skipped.append(name)
            continue
        try:
            r = bench_clip(path, cfg, out_dir, detector, tracker, max_frames, stride, max_side, weak_confidence, review_limit)
        except Exception as exc:
            log.error("bench failed on %s: %s", name, exc)
            skipped.append(name)
            continue
        r["license"] = entry.get("license")
        r["notes"] = entry.get("notes", "")
        reports.append(r)
        log.info("%s: %.0f%% frames with fish, %.2f det/frame, conf %s, %d tracks for ~%s fish", name, 100 * r["frames_with_detections"], r["detections_per_frame"], r["mean_confidence"], r["tracks"], r["distinct_fish_estimate"])
    detector.close()
    summary = {
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "detector": getattr(detector, "name", "?"),
        "tracker": getattr(tracker, "name", "?"),
        "config_hash": cfg.hash(),
        "settings": {"max_frames": max_frames, "stride": stride, "max_side": max_side, "weak_confidence": weak_confidence},
        "clips": reports,
        "skipped": skipped,
        "out_dir": str(out_dir),
    }
    (out_dir / "report.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    (out_dir / "report.md").write_text(render_markdown(summary), encoding="utf-8")
    summary["report_path"] = str(out_dir / "report.md")
    return summary


def render_markdown(summary: dict[str, Any]) -> str:
    lines = [
        f"# Detector bench: {summary['detector']} + {summary['tracker']} ({summary['created_at']})",
        "",
        "| clip | frames w/ fish | det/frame | mean conf | low-conf share | tracks | ~fish | frags/fish | mean track s | proc fps | weak frames |",
        "|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    for r in summary["clips"]:
        lines.append(
            f"| {r['clip']} | {100 * r['frames_with_detections']:.0f}% | {r['detections_per_frame']} | {r['mean_confidence']} | {r['low_confidence_share']} | "
            f"{r['tracks']} | {r['distinct_fish_estimate']} | {r['fragments_per_fish']} | {r['mean_track_seconds']} | {r['fps_processed']} | {r['weak_frames']} |"
        )
    if summary["skipped"]:
        lines += ["", "Skipped: " + ", ".join(summary["skipped"])]
    lines += ["", "Weak frames (low confidence or gaps) are exported under `review/` for labelling. Contact sheets are next to this file."]
    return "\n".join(lines) + "\n"


def tempdir() -> Path:
    return Path(tempfile.mkdtemp(prefix="fishai-bench-"))
