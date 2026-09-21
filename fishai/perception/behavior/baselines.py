"""Rolling per-fish baselines and deviation detection (Phase 4).

"Normal" is learned for THIS fish in THIS tank: for each metric, the mean
and standard deviation over the last ``window_sessions`` sessions the fish
was seen in. A session's value is compared with the baseline computed from
the sessions BEFORE it, so a fish never sets its own normal on the day it
is tested. Everything is arithmetic; the numbers go to the reasoner, which
is the only place that interprets them.
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass
from typing import Any

from fishai.storage.db import Database, utc_now
from fishai.types import TrackSummary

# Metrics a baseline is kept for, and the direction that is interesting.
DEFAULT_METRICS: dict[str, str] = {
    "activity_score": "both",
    "surface_fraction": "high",
    "bottom_fraction": "high",
    "missing_time_s": "high",
    "mean_speed_norm_s": "both",
}


@dataclass
class Deviation:
    fish_id: int
    metric: str
    value: float
    baseline: float
    baseline_std: float
    n_sessions: int
    z_score: float
    percent: float
    direction: str  # "high" | "low"
    severity: str  # "info" | "warning" | "critical"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def sentence(self) -> str:
        """A plain sentence a person (or a reasoner prompt) can read."""
        ratio = (self.value / self.baseline) if self.baseline else None
        how = f"{ratio:.1f}x baseline" if ratio and ratio >= 1.5 else f"{self.percent:+.0f}% vs baseline"
        return f"Fish {self.fish_id} {self.metric.replace('_', ' ')} is {self.value:.2f} ({how}; normal {self.baseline:.2f}, n={self.n_sessions})"


def _stats(values: list[float]) -> dict[str, Any]:
    n = len(values)
    mean = sum(values) / n if n else 0.0
    var = sum((v - mean) ** 2 for v in values) / (n - 1) if n > 1 else 0.0
    return {"n": n, "mean": mean, "std": math.sqrt(var), "min": min(values) if values else 0.0, "max": max(values) if values else 0.0, "window": values}


def per_fish_session_values(db: Database, metrics: list[str], min_observations: int = 5) -> dict[int, list[dict[str, Any]]]:
    """For each fish, one row per video (session) with that video's metric values.

    Several tracks of one fish in one video are combined weighted by
    observation count, so a fragmented track does not count as three sessions.
    """
    videos = {v["video_id"]: v for v in db.list_videos()}
    sessions: dict[int, dict[str, dict[str, Any]]] = {}
    for s in db.track_summaries():
        if s.n_observations < min_observations:
            continue
        fish_id = db.fish_for_video(s.video_id).get(s.track_id)
        if fish_id is None:
            continue
        slot = sessions.setdefault(fish_id, {}).setdefault(s.video_id, {"weight": 0.0, "sums": dict.fromkeys(metrics, 0.0)})
        w = float(s.n_observations)
        for m in metrics:
            slot["sums"][m] += w * float(getattr(s, m))
        slot["weight"] += w
    out: dict[int, list[dict[str, Any]]] = {}
    for fish_id, per_video in sessions.items():
        rows = []
        for vid, slot in per_video.items():
            values = {m: slot["sums"][m] / slot["weight"] for m in metrics}
            rows.append({"video_id": vid, "processed_at": videos.get(vid, {}).get("processed_at", ""), **values})
        rows.sort(key=lambda r: r["processed_at"])
        out[fish_id] = rows
    return out


def update_baselines(db: Database, cfg: dict[str, Any] | None = None) -> dict[int, dict[str, dict[str, Any]]]:
    """Recompute and store baselines from ALL stored sessions. Returns {fish_id: {metric: stats}}."""
    cfg = cfg or {}
    metrics = dict(cfg.get("metrics") or DEFAULT_METRICS)
    window = int(cfg.get("window_sessions", 14))
    result: dict[int, dict[str, dict[str, Any]]] = {}
    for fish_id, rows in per_fish_session_values(db, list(metrics)).items():
        recent = rows[-window:]
        result[fish_id] = {}
        for m in metrics:
            stats = _stats([float(r[m]) for r in recent])
            db.upsert_baseline(fish_id, m, stats)
            result[fish_id][m] = stats
    return result


def _severity(z: float, percent: float, z_threshold: float, pct_threshold: float) -> str:
    az, ap = abs(z), abs(percent)
    if az >= 2 * z_threshold or ap >= 3 * pct_threshold:
        return "critical"
    if az >= z_threshold or ap >= pct_threshold:
        return "warning"
    return "info"


def deviations_for_video(db: Database, video_id: str, cfg: dict[str, Any] | None = None, persist: bool = True) -> list[Deviation]:
    """Compare one session against baselines built from the sessions BEFORE it."""
    cfg = cfg or {}
    metrics = dict(cfg.get("metrics") or DEFAULT_METRICS)
    window = int(cfg.get("window_sessions", 14))
    min_sessions = int(cfg.get("min_sessions", 3))
    z_thr = float(cfg.get("z_threshold", 2.0))
    pct_thr = float(cfg.get("percent_threshold", 50.0))
    found: list[Deviation] = []
    for fish_id, rows in per_fish_session_values(db, list(metrics)).items():
        idx = next((i for i, r in enumerate(rows) if r["video_id"] == video_id), None)
        if idx is None:
            continue
        prior = rows[max(0, idx - window) : idx]
        if len(prior) < min_sessions:
            continue
        current = rows[idx]
        for m, direction in metrics.items():
            st = _stats([float(r[m]) for r in prior])
            value = float(current[m])
            base = st["mean"]
            std = st["std"]
            # Floor the std at a small fraction of the mean so a perfectly flat history
            # does not turn a tiny wobble into an infinite z-score.
            eff_std = max(std, 0.05 * abs(base), 1e-6)
            z = (value - base) / eff_std
            percent = ((value - base) / base * 100.0) if abs(base) > 1e-9 else (0.0 if abs(value) < 1e-9 else math.copysign(999.0, value - base))
            actual_dir = "high" if value > base else "low"
            if direction != "both" and direction != actual_dir:
                continue
            if abs(z) < z_thr and abs(percent) < pct_thr:
                continue
            found.append(Deviation(fish_id, m, value, base, std, len(prior), z, percent, actual_dir, _severity(z, percent, z_thr, pct_thr)))
    if persist and found:
        db.add_anomalies(
            [
                {
                    "video_id": video_id, "fish_id": d.fish_id, "metric": d.metric, "value": d.value, "baseline": d.baseline,
                    "z_score": d.z_score, "percent": d.percent, "direction": d.direction, "severity": d.severity, "detected_at": utc_now(),
                }
                for d in found
            ]
        )
    return found


def baseline_report(db: Database) -> dict[int, dict[str, Any]]:
    """{fish_id: {metric: {mean, std, n}}} straight from the store."""
    out: dict[int, dict[str, Any]] = {}
    for row in db.baselines():
        out.setdefault(row["fish_id"], {})[row["metric"]] = {"mean": row["mean"], "std": row["std"], "n": row["n"]}
    return out


def summaries_for_video(db: Database, video_id: str) -> list[TrackSummary]:
    return db.track_summaries(video_id)
