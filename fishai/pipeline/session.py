"""Incremental processing of one session (a file, or a slice of a live feed).

``process_video`` and the live watcher share this class so a frame from a
camera and a frame from a file go through exactly the same code:

    sp = SessionProcessor.open(...)
    for frame in frames:
        sp.step(frame)
    result = sp.finish()
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
from fishai.perception.detection import Detector
from fishai.perception.tracking import Tracker, appearance
from fishai.pipeline.annotate import Annotator
from fishai.pipeline.summary import build_summary
from fishai.storage import Database
from fishai.types import Detection, Frame, Observation, TrackedObject, TrackSummary, VideoRecord
from fishai.video import VideoWriter

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


@dataclass(frozen=True)
class StepResult:
    frame: Frame
    detections: list[Detection]
    tracked: list[TrackedObject]
    observations: list[Observation]


class SessionProcessor:
    def __init__(
        self,
        cfg: Config,
        db: Database,
        video_id: str,
        source_label: str,
        detector: Detector,
        tracker: Tracker,
        width: int,
        height: int,
        fps: float,
        frame_interval_s: float,
        frame_count: int = 0,
        duration_s: float = 0.0,
        out_dir: Path | None = None,
        stem: str = "session",
        annotate: bool = False,
        output_size: tuple[int, int] | None = None,
        write_summary_file: bool = True,
        link_identity: bool = True,
        progress_every: int = 200,
    ) -> None:
        self.cfg, self.db, self.video_id = cfg, db, video_id
        self.detector, self.tracker = detector, tracker
        self.frame_interval_s = frame_interval_s
        self.out_dir = out_dir
        self.stem = stem
        self.link_identity = link_identity
        self.progress_every = progress_every
        self.write_summary_file = write_summary_file
        self.t0 = time.time()
        self.zones = ZoneModel.from_config(cfg.section("behavior"))
        self.telemetry = TelemetryBuilder(video_id, self.zones)
        self.started_at = datetime.now(timezone.utc)
        self.record = VideoRecord(
            video_id=video_id,
            path=source_label,
            width=width,
            height=height,
            fps=fps,
            frame_count=frame_count,
            duration_s=duration_s,
            processed_at=self.started_at.isoformat(timespec="seconds"),
            detector=getattr(detector, "name", type(detector).__name__),
            tracker=getattr(tracker, "name", type(tracker).__name__),
            config_hash=cfg.hash(),
        )
        db.clear_video_results(video_id)
        db.upsert_video(self.record)
        self.processed = self.frames_with_dets = self.total_dets = 0
        self._obs_buffer: list[Observation] = []
        self.all_obs: list[Observation] = []
        self.descriptors: dict[int, np.ndarray | None] = {}
        self.obs_count: dict[int, int] = defaultdict(int)
        self.first_ts: float | None = None
        self.last_ts: float = 0.0
        self.last_step: StepResult | None = None
        self.writer: VideoWriter | None = None
        self.annotator: Annotator | None = None
        self.annotated_path: Path | None = None
        if annotate and out_dir is not None:
            ann = cfg.section("annotate")
            self.annotated_path = out_dir / f"{stem}.annotated.mp4"
            self.writer = VideoWriter(self.annotated_path, fps / max(1e-6, fps * frame_interval_s), output_size or (width, height))
            self.annotator = Annotator(
                trail_length=int(ann.get("trail_length", 30)),
                draw_zones=bool(ann.get("draw_zones", True)),
                font_scale=float(ann.get("font_scale", 0.5)),
                zones=self.zones,
            )

    # -------------------------------------------------------------- stepping
    def step(self, frame: Frame) -> StepResult:
        dets = self.detector.detect(frame)
        tracked = self.tracker.update(frame, dets)
        rows = self.telemetry.observe(frame, tracked)
        self.processed += 1
        self.total_dets += len(dets)
        self.frames_with_dets += 1 if dets else 0
        self._obs_buffer.extend(rows)
        self.all_obs.extend(rows)
        if self.first_ts is None:
            self.first_ts = frame.timestamp_s
        self.last_ts = frame.timestamp_s
        for t in tracked:
            self.obs_count[t.track_id] += 1
            if self.obs_count[t.track_id] % 5 == 1:
                self.descriptors[t.track_id] = appearance.blend(
                    self.descriptors.get(t.track_id), appearance.describe(frame.image, t.bbox), alpha=0.25
                )
        if self.writer is not None and self.annotator is not None:
            header = f"t={frame.timestamp_s:6.2f}s  frame {frame.index}  fish {len(tracked)}  det {len(dets)}"
            self.writer.write(self.annotator.draw(frame, tracked, header))
        if len(self._obs_buffer) >= 2000:
            self.flush()
        if self.progress_every and self.processed % self.progress_every == 0:
            log.info("frame %d (%.1fs): %d tracked, %d detections", frame.index, frame.timestamp_s, len(tracked), len(dets))
        self.last_step = StepResult(frame, dets, tracked, rows)
        return self.last_step

    def flush(self) -> None:
        if self._obs_buffer:
            self.db.add_observations(self._obs_buffer)
            self._obs_buffer.clear()

    @property
    def current_fish_count(self) -> int:
        return len(self.last_step.tracked) if self.last_step else 0

    # --------------------------------------------------------------- finish
    def finish(self, extra_notes: list[str] | None = None, duration_s: float | None = None) -> ProcessResult:
        self.flush()
        if self.writer is not None:
            self.writer.close()
        bcfg = self.cfg.section("behavior")
        summaries = summarize_tracks(
            self.all_obs,
            self.frame_interval_s,
            full_score_speed=float(bcfg.get("activity", {}).get("full_score_speed", 0.5)),
            hiding_gap_s=float(bcfg.get("hiding_gap_s", 5.0)),
        )
        if duration_s is not None or self.record.frame_count == 0:
            observed = duration_s if duration_s is not None else (self.last_ts - (self.first_ts or 0.0)) + self.frame_interval_s
            self.record = VideoRecord(**{**self.record.to_dict(), "duration_s": float(observed), "frame_count": self.processed if self.record.frame_count == 0 else self.record.frame_count})
            self.db.upsert_video(self.record)
        self.db.add_track_summaries(summaries)
        identities: dict[int, dict[str, Any]] = {}
        if self.link_identity:
            identities = link_tracks_to_fish(
                self.db,
                self.video_id,
                {k: v for k, v in self.descriptors.items() if v is not None},
                min_observations=dict(self.obs_count),
                spans={s.track_id: (s.first_ts, s.last_ts) for s in summaries},
            )
        notes = list(extra_notes or [])
        if self.processed == 0:
            notes.append("no frames were read from the source")
        elif self.frames_with_dets == 0:
            notes.append("no detections on any frame; check the detector backend and thresholds")
        if getattr(self.detector, "name", "") == "motion":
            notes.append("motion detector: confidence is a blob-size heuristic, not a probability; touching fish merge")
        summary = build_summary(
            self.record, summaries, identities, self.processed, self.frames_with_dets, self.total_dets,
            str(self.annotated_path) if self.annotated_path else None, notes,
        )
        summary_path: Path | None = None
        if self.write_summary_file and self.out_dir is not None:
            summary_path = self.out_dir / f"{self.stem}.summary.json"
            summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
        self.db.add_event(
            "video_processed", {"video_id": self.video_id, "tracks": len(summaries), "observations": len(self.all_obs)}, video_id=self.video_id
        )
        elapsed = time.time() - self.t0
        log.info("session %s: %d frames, %d observations, %d tracks in %.1fs", self.video_id, self.processed, len(self.all_obs), len(summaries), elapsed)
        return ProcessResult(self.video_id, summary, summary_path, self.annotated_path, len(self.all_obs), summaries, identities, elapsed)
