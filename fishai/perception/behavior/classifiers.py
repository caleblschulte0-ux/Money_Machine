"""Measured behaviours beyond activity and zones (Phase 3, second pass).

Every one of these is a NUMBER computed from tracks, stored on the track
summary and given a baseline like any other metric. None is a diagnosis;
the names say what was measured, not what it means:

erratic:  ``speed_cv`` (coefficient of variation of speed) and
          ``turn_rate_std`` (spread of heading change per second).
          Darting, then stopping, then darting scores high.
circling: ``circling_index`` in 0..1: how consistently the fish turns the
          same way. Straight swimming and random wandering are near 0;
          going round and round is near 1.
balance:  ``vertical_posture_fraction``: share of frames where the box is
          taller than wide (a side-view fish is normally wider than tall).
          Head-standing, tail-standing and rolling raise it. Not
          meaningful for a top-down camera.
chasing:  ``chase_time_s`` (as the chaser) and ``chased_time_s`` (as the
          target): time spent close behind another fish, both moving, the
          chaser heading toward the target, sustained for at least
          ``min_episode_s``. Sustained pursuit geometry, not intent.
lethargy: cross-session, in ``baselines.persistent_low_activity``: how
          many consecutive sessions activity sat below the baseline.
"""

from __future__ import annotations

import math
from collections import defaultdict
from typing import Any

from fishai.types import Observation, TrackSummary

BEHAVIOUR_METRICS = ("speed_cv", "turn_rate_std", "circling_index", "vertical_posture_fraction", "chase_time_s", "chased_time_s")


def _heading(dx: float, dy: float) -> float | None:
    return math.atan2(dy, dx) if (dx or dy) else None


def _wrap(a: float) -> float:
    while a > math.pi:
        a -= 2 * math.pi
    while a < -math.pi:
        a += 2 * math.pi
    return a


def per_track_kinematics(rows: list[Observation], frame_interval_s: float, min_speed_px_s: float = 5.0) -> dict[str, float]:
    speeds = [o.speed_px_s for o in rows if o.displacement_px > 0 or o.speed_px_s > 0]
    out: dict[str, float] = {"speed_cv": 0.0, "turn_rate_std": 0.0, "circling_index": 0.0, "vertical_posture_fraction": 0.0}
    if len(speeds) >= 3:
        mean = sum(speeds) / len(speeds)
        if mean > 0:
            var = sum((s - mean) ** 2 for s in speeds) / (len(speeds) - 1)
            out["speed_cv"] = math.sqrt(var) / mean
    # Heading changes between consecutive moving observations.
    turns: list[float] = []
    prev_h: float | None = None
    for o in rows:
        if o.speed_px_s < min_speed_px_s:
            prev_h = None
            continue
        h = _heading(o.dx, o.dy)
        if h is None:
            continue
        if prev_h is not None:
            dt = max(frame_interval_s, 1e-6)
            turns.append(_wrap(h - prev_h) / dt)
        prev_h = h
    if len(turns) >= 3:
        mean = sum(turns) / len(turns)
        var = sum((t - mean) ** 2 for t in turns) / (len(turns) - 1)
        out["turn_rate_std"] = math.sqrt(var)
        total_abs = sum(abs(t) for t in turns)
        if total_abs > 0:
            # Consistent direction over windows of ~2 s: |signed sum| / sum|turns|.
            win = max(3, int(round(2.0 / frame_interval_s)))
            chunks = [turns[i : i + win] for i in range(0, len(turns), win)]
            consistent = sum(abs(sum(c)) for c in chunks)
            out["circling_index"] = min(1.0, consistent / total_abs)
    tall = sum(1 for o in rows if o.bbox.height > 1.2 * o.bbox.width)
    out["vertical_posture_fraction"] = tall / len(rows) if rows else 0.0
    return out


def chase_times(
    observations: list[Observation],
    frame_interval_s: float,
    min_speed_px_s: float = 20.0,
    max_gap_body_lengths: float = 2.0,
    min_cosine: float = 0.7,
    min_episode_s: float = 1.0,
) -> tuple[dict[int, float], dict[int, float]]:
    """Return (chase_time_s by chaser track, chased_time_s by target track)."""
    by_frame: dict[int, list[Observation]] = defaultdict(list)
    for o in observations:
        by_frame[o.frame_index].append(o)
    # run[(chaser, target)] = consecutive frames the geometry held
    runs: dict[tuple[int, int], int] = defaultdict(int)
    chase: dict[int, float] = defaultdict(float)
    chased: dict[int, float] = defaultdict(float)
    min_frames = max(1, int(round(min_episode_s / frame_interval_s)))
    for fi in sorted(by_frame):
        rows = by_frame[fi]
        active: set[tuple[int, int]] = set()
        for a in rows:
            if a.speed_px_s < min_speed_px_s:
                continue
            va = (a.dx, a.dy)
            na = math.hypot(*va)
            if na == 0:
                continue
            body = max(1.0, a.bbox.width)
            for b in rows:
                if b.track_id == a.track_id or b.speed_px_s < min_speed_px_s * 0.5:
                    continue
                to_b = (b.cx - a.cx, b.cy - a.cy)
                dist = math.hypot(*to_b)
                if dist == 0 or dist > max_gap_body_lengths * body:
                    continue
                cos = (va[0] * to_b[0] + va[1] * to_b[1]) / (na * dist)
                if cos < min_cosine:
                    continue
                key = (a.track_id, b.track_id)
                runs[key] += 1
                active.add(key)
                if runs[key] >= min_frames:
                    # Credit the whole episode once it qualifies, then each further frame.
                    credit = min_frames if runs[key] == min_frames else 1
                    chase[a.track_id] += credit * frame_interval_s
                    chased[b.track_id] += credit * frame_interval_s
        for key in list(runs):
            if key not in active:
                del runs[key]
    return dict(chase), dict(chased)


def enrich_summaries(
    summaries: list[TrackSummary],
    observations: list[Observation],
    frame_interval_s: float,
    cfg: dict[str, Any] | None = None,
    has_depth: bool = True,
) -> None:
    """Attach the behaviour metrics to each summary's ``extra`` (in place)."""
    cfg = cfg or {}
    by_track: dict[int, list[Observation]] = defaultdict(list)
    for o in observations:
        by_track[o.track_id].append(o)
    ccfg = cfg.get("chasing", {})
    chase, chased = chase_times(
        observations, frame_interval_s,
        min_speed_px_s=float(ccfg.get("min_speed_px_s", 20.0)), max_gap_body_lengths=float(ccfg.get("max_gap_body_lengths", 2.0)),
        min_cosine=float(ccfg.get("min_cosine", 0.7)), min_episode_s=float(ccfg.get("min_episode_s", 1.0)),
    )
    for s in summaries:
        rows = sorted(by_track.get(s.track_id, []), key=lambda r: r.frame_index)
        k = per_track_kinematics(rows, frame_interval_s, float(cfg.get("min_speed_px_s", 5.0)))
        if not has_depth:
            k["vertical_posture_fraction"] = 0.0
        s.extra.update({**k, "chase_time_s": round(chase.get(s.track_id, 0.0), 3), "chased_time_s": round(chased.get(s.track_id, 0.0), 3)})
        s.extra["behaviour_flags"] = flags_for(s.extra, cfg)


def flags_for(extra: dict[str, Any], cfg: dict[str, Any] | None = None) -> list[str]:
    """Plain-word flags from absolute thresholds (baselines are the better judge; these catch the obvious)."""
    cfg = cfg or {}
    th = cfg.get("flags", {})
    flags = []
    if extra.get("circling_index", 0) >= float(th.get("circling_index", 0.6)):
        flags.append("repetitive circling")
    if extra.get("vertical_posture_fraction", 0) >= float(th.get("vertical_posture_fraction", 0.3)):
        flags.append("vertical posture")
    if extra.get("speed_cv", 0) >= float(th.get("speed_cv", 1.5)):
        flags.append("erratic swimming")
    if extra.get("chase_time_s", 0) >= float(th.get("chase_time_s", 5.0)):
        flags.append("chasing")
    if extra.get("chased_time_s", 0) >= float(th.get("chased_time_s", 5.0)):
        flags.append("being chased")
    return flags
