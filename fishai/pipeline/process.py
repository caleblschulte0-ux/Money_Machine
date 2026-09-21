"""Process one video end to end.

video -> detector -> tracker -> telemetry -> SQLite -> JSON summary
                                          \\-> annotated video
"""

from __future__ import annotations

import json
import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np

from fishai.config import Config
from fishai.log import get_logger
from fishai.perception.behavior.telemetry import TelemetryBuilder, ZoneModel, summarize_tracks
from fishai.perception.classification.identity import link_tracks_to_fish
from fishai.perception.detection import Detector, build_detector
from fishai.perception.tracking import Tracker, appearance, build_tracker
from fishai.pipeline.annotate import Annotator
from fishai.pipeline.summary import build_summary
from fishai.storage import Database
from fishai.types import Observation, TrackSummary, VideoRecord
from fishai.video import VideoReader, VideoWriter
from fishai.video.reader import video_id_for

log = get_logger(__name__)


@dataclass
class ProcessResult:
    video_id: str
    summary: dict[str, Any]
    summary_path: Path | None
    annotated_path: Path | None
    observations: int
    tracks: list[TrackSummary]
    identities: dict[int, dict[str, Any]] = field(default_factory=dict)
    elapsed_s: float = 0.0


def process_video(
    source: str | Path,
    cfg: Config,
    db: Database | None = None,
    detector: Detector | None = None,
    tracker: Tracker | None = None,
    output_dir: str | Path | None = None,
    annotate: bool | None = None,
    link_identity: bool = True,
    progress_every: int = 200,
) -> ProcessResult:
    """Run the Phase 1 pipeline on ``source`` and persist everything.

    ``detector`` / ``tracker`` may be injected (tests, custom backends);
    otherwise they are built from ``cfg``.
    """
    t0 = time.time()
    source = Path(source) if not isinstance(source, int) else source
    vcfg = cfg.section("video")
    reader = VideoReader(
        str(source), stride=int(vcfg.get("frame_stride", 1)), max_frames=vcfg.get("max_frames"), max_side=vcfg.get("max_side")
    )
    video_id = video_id_for(source) if isinstance(source, Path) else f"live-{int(t0)}"
    stride = reader.stride
    frame_interval_s = stride / reader.fps

    det_cfg = dict(cfg.section("detection"))
    det_cfg.setdefault("models_dir", cfg.get_path("paths.models_dir", "models"))
    detector = detector or build_detector(det_cfg)
    tracker = tracker or build_tracker(cfg.section("tracking"), fps=reader.fps / stride)
    zones = ZoneModel.from_config(cfg.section("behavior"))
    telemetry = TelemetryBuilder(video_id, zones)

    own_db = db is None
    db = db or Database(cfg.resolve_path("paths.database"))
    out_dir = Path(output_dir) if output_dir else cfg.resolve_path("paths.output_dir")
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = source.stem if isinstance(source, Path) else "live"

    ann_cfg = cfg.section("annotate")
    do_annotate = bool(ann_cfg.get("enabled", True)) if annotate is None else annotate
    writer: VideoWriter | None = None
    annotator: Annotator | None = None
    annotated_path: Path | None = None
    if do_annotate:
        annotated_path = out_dir / f"{stem}.annotated.mp4"
        writer = VideoWriter(annotated_path, reader.fps / stride, reader.output_size)
        annotator = Annotator(
            trail_length=int(ann_cfg.get("trail_length", 30)),
            draw_zones=bool(ann_cfg.get("draw_zones", True)),
            font_scale=float(ann_cfg.get("font_scale", 0.5)),
            zones=zones,
        )

    db.clear_video_results(video_id)
    info = reader.info
    record = VideoRecord(
        video_id=video_id,
        path=str(source),
        width=info.width,
        height=info.height,
        fps=reader.fps,
        frame_count=info.frame_count,
        duration_s=info.duration_s,
        processed_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        detector=getattr(detector, "name", type(detector).__name__),
        tracker=getattr(tracker, "name", type(tracker).__name__),
        config_hash=cfg.hash(),
    )
    db.upsert_video(record)
    processed = frames_with_dets = total_dets = 0
    obs_buffer: list[Observation] = []
    all_obs: list[Observation] = []
    descriptors: dict[int, np.ndarray | None] = {}
    obs_count: dict[int, int] = defaultdict(int)
    try:
        for frame in reader:
            dets = detector.detect(frame)
            tracked = tracker.update(frame, dets)
            rows = telemetry.observe(frame, tracked)
            processed += 1
            total_dets += len(dets)
            frames_with_dets += 1 if dets else 0
            obs_buffer.extend(rows)
            all_obs.extend(rows)
            for t in tracked:
                obs_count[t.track_id] += 1
                if obs_count[t.track_id] % 5 == 1:
                    descriptors[t.track_id] = appearance.blend(descriptors.get(t.track_id), appearance.describe(frame.image, t.bbox), alpha=0.25)
            if writer is not None and annotator is not None:
                header = f"t={frame.timestamp_s:6.2f}s  frame {frame.index}  fish {len(tracked)}  det {len(dets)}"
                writer.write(annotator.draw(frame, tracked, header))
            if len(obs_buffer) >= 2000:
                db.add_observations(obs_buffer)
                obs_buffer.clear()
            if progress_every and processed % progress_every == 0:
                log.info("frame %d (%.1fs): %d tracked, %d detections", frame.index, frame.timestamp_s, len(tracked), len(dets))
        db.add_observations(obs_buffer)
    finally:
        if writer is not None:
            writer.close()
        detector.close()

    bcfg = cfg.section("behavior")
    summaries = summarize_tracks(
        all_obs,
        frame_interval_s,
        full_score_speed=float(bcfg.get("activity", {}).get("full_score_speed", 0.5)),
        hiding_gap_s=float(bcfg.get("hiding_gap_s", 5.0)),
    )
    db.add_track_summaries(summaries)
    identities: dict[int, dict[str, Any]] = {}
    if link_identity:
        identities = link_tracks_to_fish(
            db,
            video_id,
            {k: v for k, v in descriptors.items() if v is not None},
            min_observations=dict(obs_count),
            spans={s.track_id: (s.first_ts, s.last_ts) for s in summaries},
        )

    notes = []
    if processed == 0:
        notes.append("no frames were read from the source")
    elif frames_with_dets == 0:
        notes.append("no detections on any frame; check the detector backend and thresholds")
    if getattr(detector, "name", "") == "motion":
        notes.append("motion detector: confidence is a blob-size heuristic, not a probability; touching fish merge")
    summary = build_summary(record, summaries, identities, processed, frames_with_dets, total_dets, str(annotated_path) if annotated_path else None, notes)
    summary_path = out_dir / f"{stem}.summary.json"
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    db.add_event("video_processed", {"video_id": video_id, "tracks": len(summaries), "observations": len(all_obs)}, video_id=video_id)
    if own_db:
        db.close()
    elapsed = time.time() - t0
    log.info("processed %s: %d frames, %d observations, %d tracks in %.1fs", source, processed, len(all_obs), len(summaries), elapsed)
    return ProcessResult(video_id, summary, summary_path, annotated_path, len(all_obs), summaries, identities, elapsed)
