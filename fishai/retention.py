"""Retention: keep telemetry cheap and clips bounded.

- Raw observations older than ``observations_days`` are deleted for
  sessions that already have summaries (the summaries, baselines,
  anomalies and identities stay).
- Clips older than ``clips_days`` are deleted, oldest first until the
  clip directory is under ``clips_max_gb``. A clip whose session has an
  owner confirmation is kept: it is labelled data.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from fishai.feedback import confirmed_video_ids
from fishai.log import get_logger
from fishai.storage import Database

log = get_logger(__name__)


def run_retention(db: Database, cfg: dict[str, Any] | None, now: datetime | None = None) -> dict[str, Any]:
    cfg = cfg or {}
    now = now or datetime.now(timezone.utc)
    obs_days = float(cfg.get("observations_days", 14))
    clips_days = float(cfg.get("clips_days", 30))
    max_bytes = float(cfg.get("clips_max_gb", 5)) * 1e9
    keep_confirmed = bool(cfg.get("keep_clips_with_confirmation", True))
    report: dict[str, Any] = {"observations_deleted": 0, "clips_deleted": [], "clip_bytes": 0}

    if obs_days > 0:
        cutoff = (now - timedelta(days=obs_days)).isoformat(timespec="seconds")
        report["observations_deleted"] = db.prune_observations(cutoff)

    protected = confirmed_video_ids(db) if keep_confirmed else set()
    clips = sorted(db.clips(limit=100000), key=lambda c: c["recorded_at"])
    total = 0
    live: list[dict[str, Any]] = []
    for c in clips:
        p = Path(c["path"])
        if not p.exists():
            db.delete_clip(c["id"])
            continue
        size = p.stat().st_size
        c["size_bytes"] = size
        total += size
        live.append(c)
    report["clip_bytes"] = total

    def _delete(c: dict[str, Any]) -> None:
        nonlocal total
        try:
            Path(c["path"]).unlink()
        except OSError as exc:
            log.warning("could not delete clip %s: %s", c["path"], exc)
            return
        total -= c["size_bytes"]
        db.delete_clip(c["id"])
        report["clips_deleted"].append(c["path"])

    cutoff_dt = now - timedelta(days=clips_days)
    for c in list(live):
        if c["video_id"] in protected:
            continue
        try:
            when = datetime.fromisoformat(c["recorded_at"].replace("Z", "+00:00"))
        except ValueError:
            continue
        if clips_days > 0 and when < cutoff_dt:
            _delete(c)
            live.remove(c)
    for c in list(live):
        if total <= max_bytes:
            break
        if c["video_id"] in protected:
            continue
        _delete(c)
        live.remove(c)
    report["clip_bytes_after"] = total
    return report
