"""Owner confirmations: the labels the dataset is built on.

Every anomaly the system flags, and every assessment it makes, can be
confirmed by the owner with an outcome. Confirmations are events, so
they are append-only and travel with the rest of the record.
"""

from __future__ import annotations

from typing import Any

from fishai.storage import Database

OUTCOMES = ("fine", "watching", "sick", "died", "water_issue", "equipment_issue", "feeding_issue", "false_alarm", "other")


def confirm(
    db: Database,
    outcome: str,
    anomaly_id: int | None = None,
    assessment_id: int | None = None,
    fish_id: int | None = None,
    note: str = "",
) -> int:
    if outcome not in OUTCOMES:
        raise ValueError(f"outcome must be one of {OUTCOMES}")
    payload: dict[str, Any] = {"outcome": outcome, "note": note}
    video_id = None
    if anomaly_id is not None:
        a = db.anomaly(anomaly_id)
        if a is None:
            raise ValueError(f"no anomaly {anomaly_id}")
        payload.update(anomaly_id=anomaly_id, metric=a["metric"], value=a["value"], baseline=a["baseline"], severity=a["severity"])
        fish_id = fish_id if fish_id is not None else a["fish_id"]
        video_id = a["video_id"]
    if assessment_id is not None:
        payload["assessment_id"] = assessment_id
    return db.add_event("owner_confirmation", payload, video_id=video_id, fish_id=fish_id)


def confirmations(db: Database, limit: int = 100) -> list[dict[str, Any]]:
    return db.events("owner_confirmation", limit=limit)


def unconfirmed_anomalies(db: Database, limit: int = 50) -> list[dict[str, Any]]:
    done = {c["payload"].get("anomaly_id") for c in confirmations(db, limit=1000)}
    return [a for a in db.anomalies() if a["id"] not in done][-limit:]


def confirmed_video_ids(db: Database) -> set[str]:
    return {c["video_id"] for c in confirmations(db, limit=10000) if c.get("video_id")}
