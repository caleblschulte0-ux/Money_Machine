"""Process every new video in a folder; optionally keep watching it.

The simplest way to start feeding data: point a phone, a webcam recorder
or a camera's SD-card sync at a folder and run ``fishai ingest FOLDER
--watch``. Files already in the database (by content id) are skipped, so
re-running is free, and a file still being written is left for the next
pass (its size must be stable across two checks).
"""

from __future__ import annotations

import time
from collections.abc import Callable
from pathlib import Path
from typing import Any

from fishai.config import Config
from fishai.log import get_logger
from fishai.pipeline.process import process_video
from fishai.storage import Database
from fishai.video.reader import video_id_for

log = get_logger(__name__)

VIDEO_SUFFIXES = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}


def list_videos(folder: Path, recursive: bool = True) -> list[Path]:
    it = folder.rglob("*") if recursive else folder.glob("*")
    return sorted(p for p in it if p.is_file() and p.suffix.lower() in VIDEO_SUFFIXES and ".annotated" not in p.name)


def new_videos(db: Database, folder: Path, recursive: bool = True) -> list[Path]:
    known = {v["video_id"] for v in db.list_videos()}
    return [p for p in list_videos(folder, recursive) if video_id_for(p) not in known]


def _stable(path: Path, wait_s: float) -> bool:
    a = path.stat().st_size
    if wait_s <= 0:
        return True
    time.sleep(wait_s)
    return path.stat().st_size == a


def ingest_folder(
    cfg: Config,
    folder: str | Path,
    db: Database | None = None,
    recursive: bool = True,
    watch: bool = False,
    poll_s: float = 30.0,
    stability_wait_s: float = 2.0,
    annotate: bool | None = None,
    on_done: Callable[[Any], None] | None = None,
    max_files: int | None = None,
    stop_after_s: float | None = None,
) -> list[Any]:
    folder = Path(folder)
    if not folder.is_dir():
        raise FileNotFoundError(f"{folder} is not a directory")
    own = db is None
    db = db or Database(cfg.resolve_path("paths.database"))
    results: list[Any] = []
    started = time.time()
    try:
        while True:
            todo = new_videos(db, folder, recursive)
            if max_files is not None:
                todo = todo[: max(0, max_files - len(results))]
            for p in todo:
                if not _stable(p, stability_wait_s):
                    log.info("%s still growing; will retry", p.name)
                    continue
                try:
                    r = process_video(p, cfg, db=db, annotate=annotate)
                except Exception as exc:  # one bad file must not stop the folder
                    log.error("failed on %s: %s", p, exc)
                    db.add_event("ingest_failed", {"path": str(p), "error": str(exc)})
                    continue
                results.append(r)
                if on_done:
                    on_done(r)
            if not watch or (max_files is not None and len(results) >= max_files):
                break
            if stop_after_s is not None and time.time() - started >= stop_after_s:
                break
            time.sleep(poll_s)
    finally:
        if own:
            db.close()
    return results
