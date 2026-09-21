"""Feeding events and per-fish feeding response (Phase 3, feeding).

A feeding is an EVENT (manual now, feeder later): ``mark_feeding`` records
it. Once ``after_s`` of observations exist past the event,
``compute_feeding_responses`` measures, per fish:

- ``approached`` and ``latency_s``: first time the fish entered the food
  zone after the event (None if it never did within the window)
- ``zone_fraction_before/after``: share of observations inside the food
  zone in the window before vs after
- ``activity_before/after``: mean normalised speed before vs after

The food zone is a normalised rectangle in config (``feeding.zone``); by
default the top quarter of the frame, where flakes land. Responses are
stored per event so a fish that stops coming to food shows up as a
deviation against its own history (``feeding_deviations``).
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

from fishai.perception.behavior.baselines import Deviation
from fishai.storage.db import Database, utc_now
from fishai.types import Observation


@dataclass(frozen=True)
class FoodZone:
    x1: float = 0.0
    y1: float = 0.0
    x2: float = 1.0
    y2: float = 0.25

    def contains(self, nx: float, ny: float) -> bool:
        return self.x1 <= nx <= self.x2 and self.y1 <= ny <= self.y2

    @classmethod
    def from_config(cls, cfg: dict[str, Any] | None) -> FoodZone:
        z = (cfg or {}).get("zone") or {}
        return cls(float(z.get("x1", 0.0)), float(z.get("y1", 0.0)), float(z.get("x2", 1.0)), float(z.get("y2", 0.25)))


def mark_feeding(db: Database, video_id: str | None, at_ts: float, source: str = "manual", portions: float = 1.0, note: str = "") -> int:
    """Record a feeding event at ``at_ts`` seconds into ``video_id``. Returns the event id."""
    return db.add_event("feeding", {"ts": float(at_ts), "source": source, "portions": portions, "note": note}, video_id=video_id)


def _mean(xs: list[float]) -> float:
    return sum(xs) / len(xs) if xs else 0.0


def compute_feeding_responses(
    db: Database,
    event_id: int,
    feeding_cfg: dict[str, Any] | None = None,
    observations: list[Observation] | None = None,
) -> list[dict[str, Any]]:
    """Measure and store every tracked fish's response to feeding event ``event_id``."""
    ev = db.event(event_id)
    if ev is None or ev["kind"] != "feeding":
        raise ValueError(f"event {event_id} is not a feeding event")
    cfg = feeding_cfg or {}
    zone = FoodZone.from_config(cfg)
    before_s = float(cfg.get("before_s", 60.0))
    after_s = float(cfg.get("after_s", 120.0))
    video_id = ev["video_id"]
    t_feed = float(ev["payload"]["ts"])
    if observations is None:
        observations = db.observations_between(video_id, t_feed - before_s, t_feed + after_s)
    fish_of = db.fish_for_video(video_id)
    by_track: dict[int, list[Observation]] = {}
    for o in observations:
        by_track.setdefault(o.track_id, []).append(o)
    out: list[dict[str, Any]] = []
    for track_id, rows in sorted(by_track.items()):
        before = [o for o in rows if o.timestamp_s < t_feed]
        after = [o for o in rows if o.timestamp_s >= t_feed]
        if not after and not before:
            continue
        in_zone_after = [o for o in after if zone.contains(o.nx, o.ny)]
        latency = (min(o.timestamp_s for o in in_zone_after) - t_feed) if in_zone_after else None
        row = {
            "event_id": event_id,
            "video_id": video_id,
            "fish_id": fish_of.get(track_id),
            "track_id": track_id,
            "approached": latency is not None,
            "latency_s": latency,
            "zone_fraction_before": (sum(zone.contains(o.nx, o.ny) for o in before) / len(before)) if before else 0.0,
            "zone_fraction_after": (len(in_zone_after) / len(after)) if after else 0.0,
            "activity_before": _mean([o.speed_norm_s for o in before]),
            "activity_after": _mean([o.speed_norm_s for o in after]),
            "n_before": len(before),
            "n_after": len(after),
            "recorded_at": utc_now(),
        }
        row["id"] = db.add_feeding_response(row)
        out.append(row)
    return out


FEEDING_METRICS = {"latency_s": "high", "zone_fraction_after": "low", "activity_after": "low"}


def feeding_deviations(
    db: Database,
    event_id: int,
    min_events: int = 3,
    z_threshold: float = 2.0,
    percent_threshold: float = 50.0,
    latency_max_s: float = 120.0,
) -> list[Deviation]:
    """Compare this event's responses with each fish's PRIOR feeding events."""
    current = db.feeding_responses(event_id=event_id)
    found: list[Deviation] = []
    for row in current:
        fish_id = row["fish_id"]
        if fish_id is None:
            continue
        prior = [r for r in db.feeding_responses(fish_id=fish_id) if r["event_id"] < event_id]
        if len(prior) < min_events:
            continue
        for metric, direction in FEEDING_METRICS.items():
            hist = [(r[metric] if r[metric] is not None else latency_max_s) for r in prior]
            value = row[metric] if row[metric] is not None else latency_max_s
            n = len(hist)
            mean = sum(hist) / n
            std = math.sqrt(sum((h - mean) ** 2 for h in hist) / (n - 1)) if n > 1 else 0.0
            eff_std = max(std, 0.05 * abs(mean), 1e-6)
            z = (value - mean) / eff_std
            pct = ((value - mean) / mean * 100.0) if abs(mean) > 1e-9 else 0.0
            actual = "high" if value > mean else "low"
            if actual != direction or (abs(z) < z_threshold and abs(pct) < percent_threshold):
                continue
            sev = "critical" if (abs(z) >= 2 * z_threshold or abs(pct) >= 3 * percent_threshold) else "warning"
            found.append(Deviation(fish_id, f"feeding_{metric}", float(value), float(mean), std, n, z, pct, actual, sev))
    if found:
        ev = db.event(event_id)
        db.add_anomalies(
            [
                {"video_id": ev["video_id"] if ev else "", "fish_id": d.fish_id, "metric": d.metric, "value": d.value, "baseline": d.baseline,
                 "z_score": d.z_score, "percent": d.percent, "direction": d.direction, "severity": d.severity, "detected_at": utc_now()}
                for d in found
            ]
        )
    return found


def feeding_summary(db: Database, limit_events: int = 5) -> list[dict[str, Any]]:
    """Recent feeding events with their per-fish responses, for the reasoner state."""
    out = []
    for ev in db.events("feeding", limit=limit_events):
        responses = db.feeding_responses(event_id=ev["id"])
        out.append(
            {
                "event_id": ev["id"],
                "recorded_at": ev["recorded_at"],
                "video_id": ev["video_id"],
                "source": ev["payload"].get("source"),
                "fish": [
                    {"fish_id": r["fish_id"], "approached": r["approached"], "latency_s": r["latency_s"],
                     "zone_fraction_after": round(r["zone_fraction_after"], 3), "activity_after": round(r["activity_after"], 3)}
                    for r in responses
                ],
                "approach_rate": (sum(r["approached"] for r in responses) / len(responses)) if responses else None,
            }
        )
    return out
