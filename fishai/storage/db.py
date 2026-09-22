"""Thin repository over SQLite. All SQL lives here."""

from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterable
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fishai.types import BBox, Observation, TrackSummary, VideoRecord, Zone

SCHEMA_PATH = Path(__file__).with_name("schema.sql")


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class Database:
    def __init__(self, path: str | Path | None) -> None:
        """``path`` may be ``None`` or ``":memory:"`` for an in-memory database."""
        self.path = Path(path) if path and str(path) != ":memory:" else None
        if self.path is not None:
            self.path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(self.path) if self.path else ":memory:")
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA foreign_keys = ON")
        self._conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
        self._migrate()

    def _migrate(self) -> None:
        """Add columns introduced after a database was created. Additive only."""
        cols = {r["name"] for r in self._conn.execute("PRAGMA table_info(videos)")}
        with self._conn:
            if "camera_id" not in cols:
                self._conn.execute("ALTER TABLE videos ADD COLUMN camera_id TEXT NOT NULL DEFAULT 'cam1'")
            if "lighting_mode" not in cols:
                self._conn.execute("ALTER TABLE videos ADD COLUMN lighting_mode TEXT NOT NULL DEFAULT 'unknown'")

    # ------------------------------------------------------------ lifecycle
    def close(self) -> None:
        self._conn.close()

    def __enter__(self) -> Database:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    @property
    def connection(self) -> sqlite3.Connection:
        return self._conn

    # --------------------------------------------------------------- videos
    def upsert_video(self, rec: VideoRecord) -> None:
        with self._conn:
            self._conn.execute(
                """INSERT INTO videos (video_id, path, width, height, fps, frame_count, duration_s,
                       processed_at, detector, tracker, config_hash, camera_id, lighting_mode)
                   VALUES (:video_id, :path, :width, :height, :fps, :frame_count, :duration_s,
                       :processed_at, :detector, :tracker, :config_hash, :camera_id, :lighting_mode)
                   ON CONFLICT(video_id) DO UPDATE SET path=excluded.path, width=excluded.width,
                       height=excluded.height, fps=excluded.fps, frame_count=excluded.frame_count,
                       duration_s=excluded.duration_s, processed_at=excluded.processed_at,
                       detector=excluded.detector, tracker=excluded.tracker, config_hash=excluded.config_hash,
                       camera_id=excluded.camera_id, lighting_mode=excluded.lighting_mode""",
                rec.to_dict(),
            )

    def clear_video_results(self, video_id: str) -> None:
        """Remove derived and raw rows for a video before re-processing."""
        with self._conn:
            for table in ("observations", "track_summaries", "fish_identities", "anomalies"):
                self._conn.execute(f"DELETE FROM {table} WHERE video_id = ?", (video_id,))

    def get_video(self, video_id: str) -> dict[str, Any] | None:
        row = self._conn.execute("SELECT * FROM videos WHERE video_id = ?", (video_id,)).fetchone()
        return dict(row) if row else None

    def list_videos(self) -> list[dict[str, Any]]:
        return [dict(r) for r in self._conn.execute("SELECT * FROM videos ORDER BY processed_at")]

    # --------------------------------------------------------- observations
    def add_observations(self, rows: Iterable[Observation]) -> int:
        data = [
            (
                o.video_id, o.frame_index, o.timestamp_s, o.track_id,
                o.bbox.x1, o.bbox.y1, o.bbox.x2, o.bbox.y2,
                o.confidence, o.cx, o.cy, o.nx, o.ny, o.zone.value,
                o.dx, o.dy, o.displacement_px, o.speed_px_s, o.speed_norm_s, o.identity_confidence,
            )
            for o in rows
        ]
        if not data:
            return 0
        with self._conn:
            self._conn.executemany(
                """INSERT INTO observations (video_id, frame_index, timestamp_s, track_id, x1, y1, x2, y2,
                   confidence, cx, cy, nx, ny, zone, dx, dy, displacement_px, speed_px_s, speed_norm_s,
                   identity_confidence) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                data,
            )
        return len(data)

    def observations(self, video_id: str, track_id: int | None = None) -> list[Observation]:
        q = "SELECT * FROM observations WHERE video_id = ?"
        args: list[Any] = [video_id]
        if track_id is not None:
            q += " AND track_id = ?"
            args.append(track_id)
        q += " ORDER BY frame_index, track_id"
        out = []
        for r in self._conn.execute(q, args):
            out.append(
                Observation(
                    video_id=r["video_id"], frame_index=r["frame_index"], timestamp_s=r["timestamp_s"],
                    track_id=r["track_id"], bbox=BBox(r["x1"], r["y1"], r["x2"], r["y2"]),
                    confidence=r["confidence"], cx=r["cx"], cy=r["cy"], nx=r["nx"], ny=r["ny"],
                    zone=Zone(r["zone"]), dx=r["dx"], dy=r["dy"], displacement_px=r["displacement_px"],
                    speed_px_s=r["speed_px_s"], speed_norm_s=r["speed_norm_s"],
                    identity_confidence=r["identity_confidence"],
                )
            )
        return out

    def count_observations(self, video_id: str) -> int:
        return int(self._conn.execute("SELECT COUNT(*) FROM observations WHERE video_id = ?", (video_id,)).fetchone()[0])

    # ------------------------------------------------------------ summaries
    def add_track_summaries(self, rows: Iterable[TrackSummary]) -> None:
        with self._conn:
            for s in rows:
                d = s.to_dict()
                d["extra_json"] = json.dumps(d.pop("extra"), sort_keys=True)
                self._conn.execute(
                    """INSERT OR REPLACE INTO track_summaries (video_id, track_id, first_frame, last_frame, first_ts,
                       last_ts, n_observations, duration_s, total_distance_px, mean_speed_px_s, max_speed_px_s,
                       mean_speed_norm_s, activity_score, surface_fraction, middle_fraction, bottom_fraction,
                       surface_time_s, middle_time_s, bottom_time_s, mean_nx, mean_ny, mean_confidence,
                       min_identity_confidence, missing_time_s, longest_gap_s, mean_box_area_px, extra_json)
                       VALUES (:video_id, :track_id, :first_frame, :last_frame, :first_ts, :last_ts, :n_observations,
                       :duration_s, :total_distance_px, :mean_speed_px_s, :max_speed_px_s, :mean_speed_norm_s,
                       :activity_score, :surface_fraction, :middle_fraction, :bottom_fraction, :surface_time_s,
                       :middle_time_s, :bottom_time_s, :mean_nx, :mean_ny, :mean_confidence,
                       :min_identity_confidence, :missing_time_s, :longest_gap_s, :mean_box_area_px, :extra_json)""",
                    d,
                )

    def track_summaries(self, video_id: str | None = None) -> list[TrackSummary]:
        q = "SELECT * FROM track_summaries"
        args: list[Any] = []
        if video_id is not None:
            q += " WHERE video_id = ?"
            args.append(video_id)
        q += " ORDER BY video_id, track_id"
        out = []
        for r in self._conn.execute(q, args):
            d = dict(r)
            d["extra"] = json.loads(d.pop("extra_json") or "{}")
            out.append(TrackSummary(**d))
        return out

    # ----------------------------------------------------------- identities
    def set_identity(self, video_id: str, track_id: int, fish_id: int, confidence: float, method: str) -> None:
        with self._conn:
            self._conn.execute(
                "INSERT OR REPLACE INTO fish_identities (video_id, track_id, fish_id, confidence, method) VALUES (?,?,?,?,?)",
                (video_id, track_id, fish_id, confidence, method),
            )

    def identities(self, video_id: str) -> dict[int, dict[str, Any]]:
        rows = self._conn.execute("SELECT * FROM fish_identities WHERE video_id = ?", (video_id,))
        return {r["track_id"]: dict(r) for r in rows}

    # ------------------------------------------------------------ baselines
    def upsert_baseline(self, fish_id: int, metric: str, stats: dict[str, Any]) -> None:
        with self._conn:
            self._conn.execute(
                """INSERT OR REPLACE INTO baselines (fish_id, metric, n, mean, std, minimum, maximum, updated_at, window_json)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (fish_id, metric, stats["n"], stats["mean"], stats["std"], stats["min"], stats["max"], utc_now(),
                 json.dumps(stats.get("window", []))),
            )

    def baselines(self, fish_id: int | None = None) -> list[dict[str, Any]]:
        q, args = "SELECT * FROM baselines", []
        if fish_id is not None:
            q += " WHERE fish_id = ?"
            args.append(fish_id)
        out = []
        for r in self._conn.execute(q, args):
            d = dict(r)
            d["window"] = json.loads(d.pop("window_json") or "[]")
            out.append(d)
        return out

    # ------------------------------------------------------------ anomalies
    def add_anomalies(self, rows: Iterable[dict[str, Any]]) -> None:
        with self._conn:
            self._conn.executemany(
                """INSERT INTO anomalies (video_id, fish_id, metric, value, baseline, z_score, percent, direction, severity, detected_at)
                   VALUES (:video_id, :fish_id, :metric, :value, :baseline, :z_score, :percent, :direction, :severity, :detected_at)""",
                [dict(r, detected_at=r.get("detected_at") or utc_now()) for r in rows],
            )

    def anomalies(self, video_id: str | None = None) -> list[dict[str, Any]]:
        q, args = "SELECT * FROM anomalies", []
        if video_id is not None:
            q += " WHERE video_id = ?"
            args.append(video_id)
        return [dict(r) for r in self._conn.execute(q + " ORDER BY id", args)]

    # -------------------------------------------------------------- sensors
    def add_sensor_reading(self, sensor: str, kind: str, value: float, unit: str, source: str, recorded_at: str | None = None) -> None:
        with self._conn:
            self._conn.execute(
                "INSERT INTO sensor_readings (sensor, kind, value, unit, source, recorded_at) VALUES (?,?,?,?,?,?)",
                (sensor, kind, value, unit, source, recorded_at or utc_now()),
            )

    def latest_sensor_readings(self) -> dict[str, dict[str, Any]]:
        rows = self._conn.execute(
            """SELECT s.* FROM sensor_readings s
               JOIN (SELECT sensor, MAX(id) AS id FROM sensor_readings GROUP BY sensor) m ON m.id = s.id"""
        )
        return {r["sensor"]: dict(r) for r in rows}

    # --------------------------------------------------------------- events
    def add_event(self, kind: str, payload: dict[str, Any] | None = None, video_id: str | None = None, fish_id: int | None = None) -> int:
        with self._conn:
            cur = self._conn.execute(
                "INSERT INTO events (kind, video_id, fish_id, payload_json, recorded_at) VALUES (?,?,?,?,?)",
                (kind, video_id, fish_id, json.dumps(payload or {}, sort_keys=True), utc_now()),
            )
            return int(cur.lastrowid)

    def events(self, kind: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
        q, args = "SELECT * FROM events", []
        if kind:
            q += " WHERE kind = ?"
            args.append(kind)
        q += " ORDER BY id DESC LIMIT ?"
        args.append(limit)
        out = []
        for r in self._conn.execute(q, args):
            d = dict(r)
            d["payload"] = json.loads(d.pop("payload_json") or "{}")
            out.append(d)
        return out

    # ---------------------------------------------------------- assessments
    def add_assessment(self, backend: str, model: str, severity: str, input_obj: Any, output_obj: Any, video_id: str | None = None) -> int:
        with self._conn:
            cur = self._conn.execute(
                "INSERT INTO assessments (video_id, backend, model, severity, input_json, output_json, recorded_at) VALUES (?,?,?,?,?,?,?)",
                (video_id, backend, model, severity, json.dumps(input_obj, sort_keys=True, default=str),
                 json.dumps(output_obj, sort_keys=True, default=str), utc_now()),
            )
            return int(cur.lastrowid)

    def assessments(self, limit: int = 20) -> list[dict[str, Any]]:
        out = []
        for r in self._conn.execute("SELECT * FROM assessments ORDER BY id DESC LIMIT ?", (limit,)):
            d = dict(r)
            d["input"] = json.loads(d.pop("input_json"))
            d["output"] = json.loads(d.pop("output_json"))
            out.append(d)
        return out

    # -------------------------------------------------------------- actions
    def add_action(self, action: str, params: dict[str, Any], requested_by: str, permission: str, executed: bool, reason: str) -> int:
        with self._conn:
            cur = self._conn.execute(
                "INSERT INTO actions (action, params_json, requested_by, permission, executed, reason, recorded_at) VALUES (?,?,?,?,?,?,?)",
                (action, json.dumps(params, sort_keys=True), requested_by, permission, int(executed), reason, utc_now()),
            )
            return int(cur.lastrowid)

    def actions(self, limit: int = 50) -> list[dict[str, Any]]:
        out = []
        for r in self._conn.execute("SELECT * FROM actions ORDER BY id DESC LIMIT ?", (limit,)):
            d = dict(r)
            d["params"] = json.loads(d.pop("params_json") or "{}")
            d["executed"] = bool(d["executed"])
            out.append(d)
        return out

    # ----------------------------------------------------------------- fish
    @staticmethod
    def _descriptors(raw: str) -> dict[str, list[float]]:
        data = json.loads(raw or "{}")
        # Databases from before per-mode descriptors stored one bare list: it was a day view.
        return {"cam1/day": data} if isinstance(data, list) else dict(data)

    def list_fish(self) -> list[dict[str, Any]]:
        """Each fish with ``descriptors``: {"<camera_id>/<lighting_mode>": histogram}."""
        out = []
        for r in self._conn.execute("SELECT * FROM fish ORDER BY fish_id"):
            d = dict(r)
            d["descriptors"] = self._descriptors(d.pop("descriptor_json"))
            out.append(d)
        return out

    def add_fish(self, descriptors: dict[str, list[float]] | list[float], name: str | None = None) -> int:
        if isinstance(descriptors, list):
            descriptors = {"cam1/day": descriptors}
        now = utc_now()
        with self._conn:
            cur = self._conn.execute(
                "INSERT INTO fish (name, descriptor_json, first_seen, last_seen, n_sessions) VALUES (?,?,?,?,1)",
                (name, json.dumps(descriptors), now, now),
            )
            return int(cur.lastrowid)

    def update_fish(self, fish_id: int, descriptors: dict[str, list[float]] | None = None, name: str | None = None, seen: bool = False) -> None:
        """``descriptors`` replaces the keys given and keeps the others."""
        with self._conn:
            if descriptors is not None:
                row = self._conn.execute("SELECT descriptor_json FROM fish WHERE fish_id = ?", (fish_id,)).fetchone()
                merged = self._descriptors(row["descriptor_json"]) if row else {}
                merged.update(descriptors)
                self._conn.execute("UPDATE fish SET descriptor_json = ? WHERE fish_id = ?", (json.dumps(merged), fish_id))
            if name is not None:
                self._conn.execute("UPDATE fish SET name = ? WHERE fish_id = ?", (name, fish_id))
            if seen:
                self._conn.execute("UPDATE fish SET last_seen = ?, n_sessions = n_sessions + 1 WHERE fish_id = ?", (utc_now(), fish_id))

    def fish_for_video(self, video_id: str) -> dict[int, int]:
        """track_id -> fish_id for one video (only linked tracks)."""
        rows = self._conn.execute("SELECT track_id, fish_id FROM fish_identities WHERE video_id = ?", (video_id,))
        return {r["track_id"]: r["fish_id"] for r in rows}

    # ---------------------------------------------------------------- clips
    def add_clip(self, kind: str, path: str, start_ts: float, end_ts: float, reason: str = "", video_id: str | None = None,
                 event_id: int | None = None, size_bytes: int = 0) -> int:
        with self._conn:
            cur = self._conn.execute(
                "INSERT INTO clips (kind, path, video_id, event_id, start_ts, end_ts, reason, size_bytes, recorded_at) VALUES (?,?,?,?,?,?,?,?,?)",
                (kind, path, video_id, event_id, start_ts, end_ts, reason, size_bytes, utc_now()),
            )
            return int(cur.lastrowid)

    def clips(self, kind: str | None = None, limit: int = 100) -> list[dict[str, Any]]:
        q, args = "SELECT * FROM clips", []
        if kind:
            q += " WHERE kind = ?"
            args.append(kind)
        q += " ORDER BY id DESC LIMIT ?"
        args.append(limit)
        return [dict(r) for r in self._conn.execute(q, args)]

    def delete_clip(self, clip_id: int) -> None:
        with self._conn:
            self._conn.execute("DELETE FROM clips WHERE id = ?", (clip_id,))

    # -------------------------------------------------------------- feeding
    def add_feeding_response(self, row: dict[str, Any]) -> int:
        with self._conn:
            cur = self._conn.execute(
                """INSERT INTO feeding_responses (event_id, video_id, fish_id, track_id, approached, latency_s, zone_fraction_before,
                   zone_fraction_after, activity_before, activity_after, n_before, n_after, recorded_at)
                   VALUES (:event_id, :video_id, :fish_id, :track_id, :approached, :latency_s, :zone_fraction_before,
                   :zone_fraction_after, :activity_before, :activity_after, :n_before, :n_after, :recorded_at)""",
                dict(row, approached=int(bool(row["approached"])), recorded_at=row.get("recorded_at") or utc_now()),
            )
            return int(cur.lastrowid)

    def feeding_responses(self, fish_id: int | None = None, event_id: int | None = None, limit: int = 200) -> list[dict[str, Any]]:
        q, args, where = "SELECT * FROM feeding_responses", [], []
        if fish_id is not None:
            where.append("fish_id = ?")
            args.append(fish_id)
        if event_id is not None:
            where.append("event_id = ?")
            args.append(event_id)
        if where:
            q += " WHERE " + " AND ".join(where)
        q += " ORDER BY id DESC LIMIT ?"
        args.append(limit)
        out = []
        for r in self._conn.execute(q, args):
            d = dict(r)
            d["approached"] = bool(d["approached"])
            out.append(d)
        return out

    # ------------------------------------------------------------- windows
    def observations_between(self, video_id: str, t0: float, t1: float) -> list[Observation]:
        rows = self._conn.execute(
            "SELECT * FROM observations WHERE video_id = ? AND timestamp_s >= ? AND timestamp_s <= ? ORDER BY frame_index, track_id",
            (video_id, t0, t1),
        )
        return [
            Observation(
                video_id=r["video_id"], frame_index=r["frame_index"], timestamp_s=r["timestamp_s"], track_id=r["track_id"],
                bbox=BBox(r["x1"], r["y1"], r["x2"], r["y2"]), confidence=r["confidence"], cx=r["cx"], cy=r["cy"], nx=r["nx"], ny=r["ny"],
                zone=Zone(r["zone"]), dx=r["dx"], dy=r["dy"], displacement_px=r["displacement_px"], speed_px_s=r["speed_px_s"],
                speed_norm_s=r["speed_norm_s"], identity_confidence=r["identity_confidence"],
            )
            for r in rows
        ]

    def prune_observations(self, before_iso: str) -> int:
        """Delete raw observations of videos processed before ``before_iso`` that already have summaries."""
        with self._conn:
            cur = self._conn.execute(
                """DELETE FROM observations WHERE video_id IN (
                       SELECT v.video_id FROM videos v WHERE v.processed_at < ?
                       AND EXISTS (SELECT 1 FROM track_summaries s WHERE s.video_id = v.video_id))""",
                (before_iso,),
            )
            return int(cur.rowcount)

    def event(self, event_id: int) -> dict[str, Any] | None:
        r = self._conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
        if not r:
            return None
        d = dict(r)
        d["payload"] = json.loads(d.pop("payload_json") or "{}")
        return d

    def anomaly(self, anomaly_id: int) -> dict[str, Any] | None:
        r = self._conn.execute("SELECT * FROM anomalies WHERE id = ?", (anomaly_id,)).fetchone()
        return dict(r) if r else None

    def vacuum(self) -> None:
        self._conn.execute("VACUUM")

    def relink_feeding_responses(self, video_id: str) -> int:
        """Fill fish_id on feeding responses recorded before the session's identities existed."""
        mapping = self.fish_for_video(video_id)
        n = 0
        with self._conn:
            for track_id, fish_id in mapping.items():
                cur = self._conn.execute(
                    "UPDATE feeding_responses SET fish_id = ? WHERE video_id = ? AND track_id = ? AND fish_id IS NULL",
                    (fish_id, video_id, track_id),
                )
                n += int(cur.rowcount)
        return n
