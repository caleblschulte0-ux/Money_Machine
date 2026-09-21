"""Export what the system has seen as a training dataset (model-assisted labelling).

``export_dataset`` samples frames from processed videos, writes each with
its tracked boxes as YOLO-format labels (``class cx cy w h``, normalised),
and records a manifest in ``datasets/manifests/<name>.json``: which videos,
how many frames and boxes, the detector that produced the boxes, the
confidence floor, and the config hash. Boxes come from the detector that
ran, so this is a bootstrap set for human REVIEW, not ground truth; the
manifest says so.

Only videos whose file still exists can be exported; live sessions
contribute through their saved clips (``--include-clips``).
"""

from __future__ import annotations

import csv
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import cv2

from fishai.config import REPO_ROOT, Config
from fishai.log import get_logger
from fishai.storage import Database

log = get_logger(__name__)

MANIFESTS_DIR = REPO_ROOT / "datasets" / "manifests"


def _sample(indices: list[int], k: int) -> list[int]:
    if len(indices) <= k:
        return indices
    step = len(indices) / k
    return [indices[int(i * step)] for i in range(k)]


def export_dataset(
    db: Database,
    cfg: Config,
    out_dir: str | Path,
    name: str,
    min_confidence: float | None = None,
    max_frames_per_video: int | None = None,
    video_ids: list[str] | None = None,
    image_format: str | None = None,
) -> dict[str, Any]:
    ecfg = cfg.section("export")
    min_conf = float(ecfg.get("min_confidence", 0.6)) if min_confidence is None else min_confidence
    per_video = int(ecfg.get("max_frames_per_video", 50)) if max_frames_per_video is None else max_frames_per_video
    fmt = (image_format or ecfg.get("image_format", "jpg")).lstrip(".")
    out = Path(out_dir)
    (out / "images").mkdir(parents=True, exist_ok=True)
    (out / "labels").mkdir(parents=True, exist_ok=True)
    videos = [v for v in db.list_videos() if (video_ids is None or v["video_id"] in video_ids)]
    sources: list[dict[str, Any]] = []
    n_frames = n_boxes = 0
    skipped: list[str] = []
    for v in videos:
        path = Path(v["path"])
        if not path.exists():
            skipped.append(v["video_id"])
            continue
        obs = [o for o in db.observations(v["video_id"]) if o.confidence >= min_conf]
        if not obs:
            continue
        by_frame: dict[int, list[Any]] = {}
        for o in obs:
            by_frame.setdefault(o.frame_index, []).append(o)
        chosen = _sample(sorted(by_frame), per_video)
        cap = cv2.VideoCapture(str(path))
        if not cap.isOpened():
            skipped.append(v["video_id"])
            continue
        # Observations were made at the processed size; scale boxes by the stored width/height.
        src_w, src_h = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        obs_w, obs_h = float(v["width"]), float(v["height"])
        written = 0
        for fi in chosen:
            cap.set(cv2.CAP_PROP_POS_FRAMES, fi)
            ok, img = cap.read()
            if not ok or img is None:
                continue
            stem = f"{v['video_id']}_{fi:06d}"
            cv2.imwrite(str(out / "images" / f"{stem}.{fmt}"), img)
            lines = []
            for o in by_frame[fi]:
                cx, cy = (o.bbox.x1 + o.bbox.x2) / 2 / obs_w, (o.bbox.y1 + o.bbox.y2) / 2 / obs_h
                w, h = o.bbox.width / obs_w, o.bbox.height / obs_h
                lines.append(f"0 {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}")
            (out / "labels" / f"{stem}.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
            n_boxes += len(lines)
            written += 1
        cap.release()
        n_frames += written
        sources.append({"video_id": v["video_id"], "path": str(path), "frames": written, "detector": v["detector"], "source_size": [src_w, src_h]})
    (out / "data.yaml").write_text(
        f"path: {out.resolve()}\ntrain: images\nval: images\nnames:\n  0: fish\n# Split train/val yourself after review; this is a bootstrap set.\n",
        encoding="utf-8",
    )
    manifest = {
        "name": name,
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "out_dir": str(out.resolve()),
        "format": "yolo",
        "classes": {"0": "fish"},
        "frames": n_frames,
        "boxes": n_boxes,
        "min_confidence": min_conf,
        "max_frames_per_video": per_video,
        "config_hash": cfg.hash(),
        "sources": sources,
        "skipped_missing_files": skipped,
        "labels_are": "model-assisted (from the detector that ran), for human review; not ground truth",
    }
    manifest["checksum"] = hashlib.sha256(json.dumps(manifest, sort_keys=True).encode()).hexdigest()[:16]
    MANIFESTS_DIR.mkdir(parents=True, exist_ok=True)
    mpath = MANIFESTS_DIR / f"{name}.json"
    mpath.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    manifest["manifest_path"] = str(mpath)
    log.info("exported %d frames / %d boxes from %d videos to %s", n_frames, n_boxes, len(sources), out)
    return manifest


def export_summaries_csv(db: Database, path: str | Path) -> int:
    """Flat CSV of every track summary with its fish id: the analysis-friendly view."""
    rows = db.track_summaries()
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "video_id", "processed_at", "fish_id", "identity_confidence", "track_id", "n_observations", "duration_s", "activity_score",
        "mean_speed_norm_s", "surface_fraction", "middle_fraction", "bottom_fraction", "missing_time_s", "longest_gap_s", "mean_confidence",
    ]
    videos = {v["video_id"]: v for v in db.list_videos()}
    ids: dict[str, dict[int, dict[str, Any]]] = {}
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        for s in rows:
            if s.video_id not in ids:
                ids[s.video_id] = db.identities(s.video_id)
            ident = ids[s.video_id].get(s.track_id, {})
            w.writerow(
                {
                    "video_id": s.video_id, "processed_at": videos.get(s.video_id, {}).get("processed_at", ""),
                    "fish_id": ident.get("fish_id", ""), "identity_confidence": ident.get("confidence", ""), "track_id": s.track_id,
                    "n_observations": s.n_observations, "duration_s": round(s.duration_s, 3), "activity_score": round(s.activity_score, 2),
                    "mean_speed_norm_s": round(s.mean_speed_norm_s, 4), "surface_fraction": round(s.surface_fraction, 4),
                    "middle_fraction": round(s.middle_fraction, 4), "bottom_fraction": round(s.bottom_fraction, 4),
                    "missing_time_s": round(s.missing_time_s, 3), "longest_gap_s": round(s.longest_gap_s, 3), "mean_confidence": round(s.mean_confidence, 4),
                }
            )
    return len(rows)
