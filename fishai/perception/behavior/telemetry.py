"""Per-frame observations and per-track summaries.

Raw observations are one row per (frame, track). Track summaries are
derived from them and stored separately. Everything here is deterministic
arithmetic; no model, no guessing.
"""

from __future__ import annotations

import math
from collections import defaultdict
from dataclasses import dataclass
from typing import Any

from fishai.types import Frame, Observation, TrackedObject, TrackSummary, Zone


@dataclass(frozen=True)
class ZoneModel:
    """Vertical zones as fractions of frame height."""

    surface_below: float = 0.2
    bottom_above: float = 0.8

    def zone_for(self, ny: float) -> Zone:
        if ny < self.surface_below:
            return Zone.SURFACE
        if ny > self.bottom_above:
            return Zone.BOTTOM
        return Zone.MIDDLE

    @classmethod
    def from_config(cls, cfg: dict[str, Any]) -> ZoneModel:
        z = cfg.get("zones", {}) if cfg else {}
        return cls(float(z.get("surface_below", 0.2)), float(z.get("bottom_above", 0.8)))


class TelemetryBuilder:
    """Feeds on tracked objects frame by frame and emits ``Observation`` rows."""

    def __init__(self, video_id: str, zones: ZoneModel | None = None) -> None:
        self.video_id = video_id
        self.zones = zones or ZoneModel()
        self._last: dict[int, tuple[float, float, float]] = {}  # track_id -> (ts, cx, cy)

    def observe(self, frame: Frame, tracked: list[TrackedObject]) -> list[Observation]:
        rows: list[Observation] = []
        w, h = float(frame.width), float(frame.height)
        for t in tracked:
            cx, cy = t.bbox.center
            nx, ny = cx / w if w else 0.0, cy / h if h else 0.0
            dx = dy = disp = speed = speed_norm = 0.0
            prev = self._last.get(t.track_id)
            if prev is not None and not t.reacquired:
                pts, px, py = prev
                dt = frame.timestamp_s - pts
                dx, dy = cx - px, cy - py
                disp = math.hypot(dx, dy)
                if dt > 0:
                    speed = disp / dt
                    speed_norm = (disp / h) / dt if h else 0.0
            self._last[t.track_id] = (frame.timestamp_s, cx, cy)
            rows.append(
                Observation(
                    video_id=self.video_id,
                    frame_index=frame.index,
                    timestamp_s=frame.timestamp_s,
                    track_id=t.track_id,
                    bbox=t.bbox,
                    confidence=t.confidence,
                    cx=cx,
                    cy=cy,
                    nx=nx,
                    ny=ny,
                    zone=self.zones.zone_for(ny),
                    dx=dx,
                    dy=dy,
                    displacement_px=disp,
                    speed_px_s=speed,
                    speed_norm_s=speed_norm,
                    identity_confidence=t.identity_confidence,
                )
            )
        return rows


def _mean(xs: list[float]) -> float:
    return sum(xs) / len(xs) if xs else 0.0


def summarize_tracks(
    observations: list[Observation],
    frame_interval_s: float,
    full_score_speed: float = 0.5,
    hiding_gap_s: float = 5.0,
) -> list[TrackSummary]:
    """Collapse observations into one ``TrackSummary`` per track.

    ``frame_interval_s`` is the nominal time between processed frames; each
    observation is credited that much time in its zone, so zone times sum to
    observed time rather than to wall-clock lifetime.
    """
    by_track: dict[int, list[Observation]] = defaultdict(list)
    for o in observations:
        by_track[o.track_id].append(o)
    out: list[TrackSummary] = []
    for tid, rows in sorted(by_track.items()):
        rows.sort(key=lambda r: r.frame_index)
        n = len(rows)
        first, last = rows[0], rows[-1]
        duration = max(0.0, last.timestamp_s - first.timestamp_s) + frame_interval_s
        speeds = [r.speed_px_s for r in rows if r.speed_px_s > 0 or r.displacement_px > 0]
        speeds_norm = [r.speed_norm_s for r in rows if r.speed_px_s > 0 or r.displacement_px > 0]
        total_dist = sum(r.displacement_px for r in rows)
        zone_counts = {Zone.SURFACE: 0, Zone.MIDDLE: 0, Zone.BOTTOM: 0}
        for r in rows:
            zone_counts[r.zone] += 1
        # Gaps inside the track's lifetime: time between consecutive observations
        # beyond the nominal interval.
        gaps = []
        for a, b in zip(rows, rows[1:], strict=False):
            gap = (b.timestamp_s - a.timestamp_s) - frame_interval_s
            if gap > frame_interval_s * 1.5:
                gaps.append(gap)
        missing = sum(gaps)
        longest_gap = max(gaps) if gaps else 0.0
        mean_speed_norm = _mean(speeds_norm)
        activity = 100.0 * min(1.0, mean_speed_norm / full_score_speed) if full_score_speed > 0 else 0.0
        observed_time = n * frame_interval_s
        out.append(
            TrackSummary(
                video_id=first.video_id,
                track_id=tid,
                first_frame=first.frame_index,
                last_frame=last.frame_index,
                first_ts=first.timestamp_s,
                last_ts=last.timestamp_s,
                n_observations=n,
                duration_s=duration,
                total_distance_px=total_dist,
                mean_speed_px_s=_mean(speeds),
                max_speed_px_s=max(speeds) if speeds else 0.0,
                mean_speed_norm_s=mean_speed_norm,
                activity_score=activity,
                surface_fraction=zone_counts[Zone.SURFACE] / n,
                middle_fraction=zone_counts[Zone.MIDDLE] / n,
                bottom_fraction=zone_counts[Zone.BOTTOM] / n,
                surface_time_s=zone_counts[Zone.SURFACE] * frame_interval_s,
                middle_time_s=zone_counts[Zone.MIDDLE] * frame_interval_s,
                bottom_time_s=zone_counts[Zone.BOTTOM] * frame_interval_s,
                mean_nx=_mean([r.nx for r in rows]),
                mean_ny=_mean([r.ny for r in rows]),
                mean_confidence=_mean([r.confidence for r in rows]),
                min_identity_confidence=min(r.identity_confidence for r in rows),
                missing_time_s=missing,
                longest_gap_s=longest_gap,
                mean_box_area_px=_mean([r.bbox.area for r in rows]),
                extra={
                    "observed_time_s": observed_time,
                    "hiding_candidate": longest_gap >= hiding_gap_s,
                    "n_gaps": len(gaps),
                },
            )
        )
    return out
