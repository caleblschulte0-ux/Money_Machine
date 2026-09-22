"""The daily analysis: baselines, deviations for every new session, one assessment.

Meant to run from a scheduled task each morning (``scripts/install_tasks.ps1``)
or by hand (``fishai daily``). Writes ``runs/reports/daily-<date>.json`` and
records a ``daily`` event so the next run knows where it left off.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from fishai.config import Config
from fishai.log import get_logger
from fishai.perception.behavior.baselines import Deviation, deviations_for_video, update_baselines
from fishai.perception.behavior.feeding import feeding_summary
from fishai.reasoning import assess, build_state
from fishai.sensors import SensorHub, build_sensors
from fishai.storage import Database

log = get_logger(__name__)


def sessions_since_last_daily(db: Database) -> list[dict[str, Any]]:
    last = db.events("daily", limit=1)
    since = last[0]["recorded_at"] if last else ""
    return [v for v in db.list_videos() if v["processed_at"] > since]


def run_daily(cfg: Config, db: Database | None = None, act: bool = False, rules_only: bool = False, all_sessions: bool = False) -> dict[str, Any]:
    own = db is None
    db = db or Database(cfg.resolve_path("paths.database"))
    try:
        baselines = update_baselines(db, cfg.section("baselines"))
        videos = db.list_videos() if all_sessions else sessions_since_last_daily(db)
        devs: list[Deviation] = []
        for v in videos:
            devs += deviations_for_video(db, v["video_id"], cfg.section("baselines"))
        hub = SensorHub(build_sensors(cfg.get("sensors", [])), limits=cfg.get("sensor_limits", {}))
        readings = hub.read_all(db)
        latest = videos[-1]["video_id"] if videos else None
        state = build_state(db, latest, devs, SensorHub.state_for_reasoner(readings), None, db.events(limit=10))
        state["feeding"] = feeding_summary(db)
        state["sessions_reviewed"] = len(videos)
        reasoner = None
        if rules_only:
            from fishai.reasoning.rules import RulesReasoner

            reasoner = RulesReasoner()
        result = assess(state, dict(cfg.section("reasoning")), db=db, reasoner=reasoner, video_id=latest)
        actions: list[dict[str, Any]] = []
        if act and result.safe_actions:
            from fishai.control import ControlExecutor

            actions = ControlExecutor(db, cfg.section("control"), notify_cfg=cfg.section("notify")).run_assessment_actions(result.safe_actions, "daily", result.to_dict())
        elif not act:
            # Even without acting, the daily digest is the one message a person expects.
            from fishai.notify import Notifier, assessment_notification

            notifier = Notifier(cfg.section("notify"), db)
            if cfg.section("notify").get("daily_digest", True):
                n = assessment_notification(result.to_dict(), [d.to_dict() for d in devs], "daily")
                notifier.send(n, force=result.severity in ("warning", "critical") or bool(cfg.section("notify").get("digest_always", False)))
        report = {
            "date": datetime.now(timezone.utc).date().isoformat(),
            "sessions_reviewed": [v["video_id"] for v in videos],
            "fish_with_baselines": len(baselines),
            "deviations": [dict(d.to_dict(), sentence=d.sentence()) for d in devs],
            "assessment": result.to_dict(),
            "actions": actions,
            "sensors": state["sensors"],
        }
        reports = cfg.resolve_path("paths.output_dir") / "reports"
        reports.mkdir(parents=True, exist_ok=True)
        path = reports / f"daily-{report['date']}.json"
        path.write_text(json.dumps(report, indent=2, default=str), encoding="utf-8")
        report["path"] = str(path)
        db.add_event("daily", {"sessions": len(videos), "deviations": len(devs), "severity": result.severity, "report": str(path)})
        log.info("daily: %d sessions, %d deviations, severity %s -> %s", len(videos), len(devs), result.severity, path)
        return report
    finally:
        if own:
            db.close()
