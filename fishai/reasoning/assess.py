"""Build the structured state and run the reasoner, with an honest fallback.

The reasoner never sees raw video and never sees the database: it sees
this one dictionary, which is also what gets stored with the assessment so
every verdict can be audited later against what it was shown.
"""

from __future__ import annotations

from typing import Any

from fishai.log import get_logger
from fishai.perception.behavior.baselines import Deviation, baseline_report
from fishai.pipeline.summary import track_to_summary_dict
from fishai.reasoning.base import Reasoner, build_reasoner
from fishai.reasoning.schema import Assessment
from fishai.storage import Database

log = get_logger(__name__)


def build_state(
    db: Database,
    video_id: str | None,
    deviations: list[Deviation],
    sensors: dict[str, dict[str, Any]] | None = None,
    equipment: dict[str, Any] | None = None,
    recent_events: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    fish_rows: list[dict[str, Any]] = []
    if video_id:
        ids = db.identities(video_id)
        for s in db.track_summaries(video_id):
            if s.n_observations < 5:
                continue
            fish_rows.append(track_to_summary_dict(s, ids.get(s.track_id)))
    baselines = baseline_report(db)
    video = db.get_video(video_id) if video_id else None
    return {
        "session": {
            "video_id": video_id,
            "processed_at": video.get("processed_at") if video else None,
            "duration_s": video.get("duration_s") if video else None,
        },
        "fish": fish_rows,
        "baselines": {str(k): v for k, v in baselines.items()},
        "deviations": [dict(d.to_dict(), sentence=d.sentence()) for d in deviations],
        "sensors": sensors or {},
        "equipment": equipment or {},
        "recent_events": recent_events or [],
    }


def assess(
    state: dict[str, Any],
    reasoning_cfg: dict[str, Any],
    db: Database | None = None,
    reasoner: Reasoner | None = None,
    video_id: str | None = None,
) -> Assessment:
    """Run the configured reasoner; fall back to rules and SAY SO in the result."""
    from fishai.reasoning.qwen.ollama import ReasonerUnavailable

    primary = reasoner or build_reasoner(reasoning_cfg)
    result: Assessment
    try:
        if not primary.available():
            raise ReasonerUnavailable(f"{primary.name} ({primary.model}) is not available")
        result = primary.assess(state)
    except ReasonerUnavailable as exc:
        log.warning("falling back to rules: %s", exc)
        fallback = build_reasoner(reasoning_cfg, backend="rules")
        result = fallback.assess(state)
        result.dropped.append(f"primary reasoner unavailable: {exc}")
        result.rationale = f"{primary.name} was unavailable, so this is from deterministic rules. " + result.rationale
    if db is not None:
        db.add_assessment(result.source.split(":")[0], getattr(primary, "model", "?"), result.severity, state, result.to_dict(), video_id=video_id)
    return result
