"""Process one video file end to end.

video -> detector -> tracker -> telemetry -> SQLite -> JSON summary
                                          \\-> annotated video

The frame loop lives in ``SessionProcessor``; this is the file front end.
"""

from __future__ import annotations

from pathlib import Path

from fishai.config import Config
from fishai.log import get_logger
from fishai.perception.detection import Detector, build_detector
from fishai.perception.tracking import Tracker, build_tracker
from fishai.pipeline.session import ProcessResult, SessionProcessor
from fishai.storage import Database
from fishai.video import VideoReader
from fishai.video.reader import video_id_for

log = get_logger(__name__)

__all__ = ["ProcessResult", "process_video"]


def build_perception(cfg: Config, fps: float, detector: Detector | None = None, tracker: Tracker | None = None) -> tuple[Detector, Tracker]:
    det_cfg = dict(cfg.section("detection"))
    det_cfg.setdefault("models_dir", cfg.get_path("paths.models_dir", "models"))
    return detector or build_detector(det_cfg), tracker or build_tracker(cfg.section("tracking"), fps=fps)


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
    """Run the pipeline on a file and persist everything.

    ``detector`` / ``tracker`` may be injected (tests, custom backends);
    otherwise they are built from ``cfg``.
    """
    source = Path(source)
    vcfg = cfg.section("video")
    reader = VideoReader(str(source), stride=int(vcfg.get("frame_stride", 1)), max_frames=vcfg.get("max_frames"), max_side=vcfg.get("max_side"))
    stride = reader.stride
    detector, tracker = build_perception(cfg, reader.fps / stride, detector, tracker)
    own_db = db is None
    db = db or Database(cfg.resolve_path("paths.database"))
    out_dir = Path(output_dir) if output_dir else cfg.resolve_path("paths.output_dir")
    out_dir.mkdir(parents=True, exist_ok=True)
    do_annotate = bool(cfg.section("annotate").get("enabled", True)) if annotate is None else annotate
    info = reader.info
    sp = SessionProcessor(
        cfg, db, video_id_for(source), str(source), detector, tracker,
        width=reader.output_size[0], height=reader.output_size[1], fps=reader.fps, frame_interval_s=stride / reader.fps,
        frame_count=info.frame_count, duration_s=info.duration_s, out_dir=out_dir, stem=source.stem,
        annotate=do_annotate, output_size=reader.output_size, link_identity=link_identity, progress_every=progress_every,
    )
    try:
        for frame in reader:
            sp.step(frame)
        result = sp.finish()
    finally:
        if sp.writer is not None:
            sp.writer.close()
        detector.close()
        if own_db:
            db.close()
    log.info("processed %s in %.1fs", source, result.elapsed_s)
    return result
