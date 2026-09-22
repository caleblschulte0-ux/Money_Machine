"""The live loop: watch a camera (or a file standing in for one) continuously.

    fishai watch --source 0            # first webcam
    fishai watch --source rtsp://...   # IP camera
    fishai watch --source tank.mp4     # a file, in real time or as fast as it reads

What it does, every frame: detect, track, measure, store (through
``SessionProcessor``), keep a rolling JPEG buffer of the last ``buffer_s``
seconds, and write a small status file. Every ``session_s`` it closes the
session: summaries, identity, deviations against baselines, an optional
assessment, retention. Event clips (buffer + ``clip_post_s`` more) are saved
on feeding, on a deviation of warning or worse, on tracking loss, and on
request.

Control while running is a directory of small JSON files
(``live.requests_dir``): ``fishai feed`` and ``fishai clip`` drop one in;
``fishai stop`` too. Nothing needs a socket, and a crashed watcher leaves
nothing dangling. Camera failures reconnect with backoff; the watcher only
exits on stop, on a duration limit, or when a file source ends.
"""

from __future__ import annotations

import json
import signal
import time
import urllib.error
import urllib.request
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from fishai.config import Config
from fishai.log import get_logger
from fishai.perception.behavior.baselines import Deviation, deviations_for_video
from fishai.perception.behavior.feeding import (
    compute_feeding_responses,
    feeding_deviations,
    mark_feeding,
)
from fishai.perception.detection import Detector
from fishai.perception.tracking import Tracker
from fishai.pipeline.process import build_perception
from fishai.pipeline.session import ProcessResult, SessionProcessor
from fishai.retention import run_retention
from fishai.storage import Database
from fishai.types import Frame
from fishai.video import VideoWriter

log = get_logger(__name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def parse_source(source: str | int) -> str | int:
    if isinstance(source, int):
        return source
    s = str(source).strip()
    return int(s) if s.isdigit() else s


# --------------------------------------------------------------- rolling buffer
class RollingBuffer:
    """Last ``seconds`` of frames as JPEG bytes (cheap on memory, exact on time)."""

    def __init__(self, seconds: float, quality: int = 80) -> None:
        self.seconds = seconds
        self.quality = quality
        self._items: deque[tuple[float, bytes]] = deque()

    def push(self, ts: float, image: np.ndarray) -> None:
        ok, buf = cv2.imencode(".jpg", image, [int(cv2.IMWRITE_JPEG_QUALITY), self.quality])
        if not ok:
            return
        self._items.append((ts, buf.tobytes()))
        while self._items and ts - self._items[0][0] > self.seconds:
            self._items.popleft()

    def frames(self) -> list[tuple[float, np.ndarray]]:
        return [(ts, cv2.imdecode(np.frombuffer(b, dtype=np.uint8), cv2.IMREAD_COLOR)) for ts, b in self._items]

    def __len__(self) -> int:
        return len(self._items)

    @property
    def span_s(self) -> float:
        return (self._items[-1][0] - self._items[0][0]) if len(self._items) > 1 else 0.0


# ------------------------------------------------------------------- clips
@dataclass
class ClipRecorder:
    kind: str
    path: Path
    writer: VideoWriter
    start_ts: float
    until_ts: float
    reason: str
    video_id: str
    event_id: int | None = None
    frames: int = 0

    def write(self, image: np.ndarray) -> None:
        self.writer.write(image)
        self.frames += 1


# ------------------------------------------------------------------ status
@dataclass
class LiveStatus:
    source: str
    started_at: str = field(default_factory=_now_iso)
    session_id: str | None = None
    session_started_at: str | None = None
    sessions_completed: int = 0
    frames_total: int = 0
    frames_session: int = 0
    fps_measured: float = 0.0
    fish_now: int = 0
    detections_now: int = 0
    last_detection_at: str | None = None
    buffer_s: float = 0.0
    recording_clip: str | None = None
    pending_feedings: int = 0
    last_error: str | None = None
    reconnects: int = 0
    last_deviations: list[str] = field(default_factory=list)
    sensors: dict[str, Any] = field(default_factory=dict)
    updated_at: str = field(default_factory=_now_iso)
    running: bool = True

    def to_dict(self) -> dict[str, Any]:
        return self.__dict__.copy()


# ----------------------------------------------------------------- watcher
class LiveWatcher:
    def __init__(
        self,
        cfg: Config,
        source: str | int,
        db: Database | None = None,
        detector: Detector | None = None,
        tracker: Tracker | None = None,
        duration_s: float | None = None,
        max_sessions: int | None = None,
        realtime: bool | None = None,
    ) -> None:
        self.cfg = cfg
        self.source = parse_source(source)
        self.live_cfg = dict(cfg.section("live"))
        self.session_s = float(self.live_cfg.get("session_s", 600))
        self.buffer = RollingBuffer(float(self.live_cfg.get("buffer_s", 30)))
        self.clip_post_s = float(self.live_cfg.get("clip_post_s", 20))
        self.target_fps = float(self.live_cfg.get("target_fps", 10))
        self.reconnect_s = float(self.live_cfg.get("reconnect_s", 5))
        self.no_detection_alert_s = float(self.live_cfg.get("no_detection_alert_s", 120))
        self.clip_on = set(self.live_cfg.get("clip_on", ["feeding", "deviation", "tracking_loss", "request"]))
        self.assess_each_session = bool(self.live_cfg.get("assess_each_session", False))
        self.edge_url = (str(self.live_cfg["edge_url"]).rstrip("/") if self.live_cfg.get("edge_url") else None)
        self.edge_poll_s = float(self.live_cfg.get("edge_poll_s", 2))
        self.sensor_poll_s = float(self.live_cfg.get("sensor_poll_s", 60))
        self._edge_last_event = 0
        self._edge_next_poll = 0.0
        self._sensor_next_poll = 0.0
        self._hub: Any = None
        self.clip_dir = self._path(self.live_cfg.get("clip_dir", "runs/clips"))
        self.requests_dir = self._path(self.live_cfg.get("requests_dir", "runs/live/requests"))
        self.status_path = self._path(self.live_cfg.get("status_file", "runs/live/status.json"))
        self.out_dir = cfg.resolve_path("paths.output_dir") / "live"
        for d in (self.clip_dir, self.requests_dir, self.status_path.parent, self.out_dir):
            d.mkdir(parents=True, exist_ok=True)
        self.duration_s = duration_s
        self.max_sessions = max_sessions
        self.is_file = isinstance(self.source, str) and Path(self.source).exists()
        self.realtime = (not self.is_file) if realtime is None else realtime
        self.own_db = db is None
        self.db = db or Database(cfg.resolve_path("paths.database"))
        self._detector, self._tracker = detector, tracker
        self.status = LiveStatus(source=str(self.source))
        self.session: SessionProcessor | None = None
        self.session_start_wall = 0.0
        self.session_first_ts: float | None = None
        self.clip: ClipRecorder | None = None
        self.pending_feedings: list[dict[str, Any]] = []
        self.last_detection_ts: float | None = None
        self.tracking_loss_flagged = False
        self.results: list[ProcessResult] = []
        self._stop = False
        self._frame_times: deque[float] = deque(maxlen=60)
        self._deviation_clip_reason: str | None = None
        self._feedings_this_session: list[int] = []
        self.fps = float(self.live_cfg.get("assumed_fps", 30.0))
        self.size: tuple[int, int] = (0, 0)
        self.max_side = cfg.get_path("video.max_side")

    @staticmethod
    def _path(raw: str) -> Path:
        p = Path(raw)
        return p if p.is_absolute() else _repo_rel(p)

    # ----------------------------------------------------------- lifecycle
    def stop(self, *_: Any) -> None:
        self._stop = True

    def run(self) -> list[ProcessResult]:
        try:
            signal.signal(signal.SIGINT, self.stop)
            signal.signal(signal.SIGTERM, self.stop)
        except (ValueError, OSError):  # not the main thread
            pass
        started = time.time()
        try:
            while not self._stop:
                cap = self._open()
                if cap is None:
                    self.status.reconnects += 1
                    self._write_status()
                    if self.is_file:
                        break
                    time.sleep(self.reconnect_s)
                    continue
                self._loop(cap, started)
                cap.release()
                if self.is_file or self._stop:
                    break
                if self.duration_s and time.time() - started >= self.duration_s:
                    break
                log.warning("source ended; reconnecting in %.0fs", self.reconnect_s)
                self.status.reconnects += 1
                time.sleep(self.reconnect_s)
        finally:
            self._close_session(final=True)
            self.status.running = False
            self._write_status()
            if self._detector is not None:
                self._detector.close()
            if self.own_db:
                self.db.close()
        return self.results

    def _open(self) -> cv2.VideoCapture | None:
        cap = cv2.VideoCapture(self.source)
        if not cap.isOpened():
            self.status.last_error = f"could not open {self.source!r}"
            log.error("%s", self.status.last_error)
            return None
        fps = float(cap.get(cv2.CAP_PROP_FPS)) or 0.0
        self.fps = fps if fps > 0 else self.fps
        w, h = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        scale = 1.0
        if self.max_side and max(w, h) > self.max_side:
            scale = self.max_side / max(w, h)
        self.size = (int(round(w * scale)), int(round(h * scale)))
        self.status.last_error = None
        return cap

    # ---------------------------------------------------------------- loop
    def _loop(self, cap: cv2.VideoCapture, started: float) -> None:
        stride = max(1, int(round(self.fps / self.target_fps))) if not self.realtime else 1
        min_interval = 1.0 / self.target_fps if self.realtime else 0.0
        raw_index = 0
        last_emit = 0.0
        while not self._stop:
            ok, image = cap.read()
            if not ok or image is None:
                return
            raw_index += 1
            now = time.time()
            if self.realtime:
                if now - last_emit < min_interval:
                    continue
                last_emit = now
                ts = now
            else:
                if (raw_index - 1) % stride:
                    continue
                ms = cap.get(cv2.CAP_PROP_POS_MSEC)
                ts = ms / 1000.0 if ms and ms > 0 else (raw_index - 1) / self.fps
            if image.shape[1] != self.size[0] or image.shape[0] != self.size[1]:
                image = cv2.resize(image, self.size, interpolation=cv2.INTER_AREA)
            self._ensure_session(ts)
            first = self.session_first_ts if self.session_first_ts is not None else ts
            # Index is the SOURCE frame number (not per session): export seeks by it.
            frame = Frame(index=raw_index - 1, timestamp_s=ts - first, image=image)
            self._on_frame(frame, ts, image)
            if self.duration_s and now - started >= self.duration_s:
                self._stop = True
            if self._session_elapsed(ts) >= self.session_s:
                self._close_session()
                if self.max_sessions and self.status.sessions_completed >= self.max_sessions:
                    self._stop = True

    def _session_elapsed(self, ts: float) -> float:
        # `is None`, not `or`: a first timestamp of 0.0 is a real timestamp.
        return ts - self.session_first_ts if self.session_first_ts is not None else 0.0

    def _ensure_session(self, ts: float) -> None:
        if self.session is not None:
            return
        if self._detector is None or self._tracker is None:
            self._detector, self._tracker = build_perception(self.cfg, self.target_fps, self._detector, self._tracker)
        else:
            self._tracker.reset()
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        sid = f"live-{stamp}-{self.status.sessions_completed + 1:03d}"
        n = 0
        while self.db.get_video(sid) is not None:  # never clobber an existing session
            n += 1
            sid = f"live-{stamp}-{self.status.sessions_completed + 1:03d}-{n}"
        self.session_first_ts = ts
        self.session_start_wall = time.time()
        self.session = SessionProcessor(
            self.cfg, self.db, sid, f"live:{self.source}", self._detector, self._tracker,
            width=self.size[0], height=self.size[1], fps=self.target_fps, frame_interval_s=1.0 / self.target_fps,
            out_dir=self.out_dir, stem=sid, annotate=bool(self.live_cfg.get("store_annotated", False)),
            output_size=self.size, progress_every=0,
        )
        self.status.session_id = sid
        self.status.session_started_at = _now_iso()
        self.status.frames_session = 0
        self.status.last_deviations = []
        log.info("session %s started", sid)

    def _on_frame(self, frame: Frame, ts: float, image: np.ndarray) -> None:
        assert self.session is not None
        step = self.session.step(frame)
        self.buffer.push(ts, image)
        if self._deviation_clip_reason is not None:
            reason, self._deviation_clip_reason = self._deviation_clip_reason, None
            eid = self.db.add_event("deviation_clip", {"reason": reason}, video_id=self.session.video_id)
            self._start_clip("deviation", ts, reason, eid)
        self._frame_times.append(time.time())
        self.status.frames_total += 1
        self.status.frames_session += 1
        self.status.fish_now = len(step.tracked)
        self.status.detections_now = len(step.detections)
        if step.detections:
            self.last_detection_ts = ts
            self.status.last_detection_at = _now_iso()
            if self.tracking_loss_flagged:
                self.tracking_loss_flagged = False
                self.db.add_event("tracking_resumed", {"ts": frame.timestamp_s}, video_id=self.session.video_id)
        elif self.last_detection_ts is not None and not self.tracking_loss_flagged and ts - self.last_detection_ts >= self.no_detection_alert_s:
            self.tracking_loss_flagged = True
            eid = self.db.add_event("tracking_loss", {"since_s": ts - self.last_detection_ts, "ts": frame.timestamp_s}, video_id=self.session.video_id)
            log.warning("no fish detected for %.0fs", ts - self.last_detection_ts)
            if "tracking_loss" in self.clip_on:
                self._start_clip("tracking_loss", ts, f"no detections for {ts - self.last_detection_ts:.0f}s", eid)
        if self.clip is not None:
            self.clip.write(image)
            if ts >= self.clip.until_ts:
                self._finish_clip(ts)
        self._process_requests(frame, ts)
        self._poll_edge(frame)
        self._poll_sensors()
        self._check_pending_feedings(frame, ts)
        if len(self._frame_times) >= 2:
            span = self._frame_times[-1] - self._frame_times[0]
            self.status.fps_measured = (len(self._frame_times) - 1) / span if span > 0 else 0.0
        if self.status.frames_total % max(1, int(self.target_fps)) == 0:
            self._write_status()

    # --------------------------------------------------------------- clips
    def _start_clip(self, kind: str, ts: float, reason: str, event_id: int | None = None) -> Path | None:
        if self.clip is not None or self.session is None:
            return None
        stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        path = self.clip_dir / f"{stamp}_{kind}.mp4"
        writer = VideoWriter(path, self.target_fps, self.size)
        frames = self.buffer.frames()
        for _, img in frames:
            writer.write(img)
        start_ts = frames[0][0] if frames else ts
        self.clip = ClipRecorder(kind, path, writer, start_ts, ts + self.clip_post_s, reason, self.session.video_id, event_id, len(frames))
        self.status.recording_clip = str(path)
        log.info("clip %s started (%s): %d buffered frames", path.name, reason, len(frames))
        return path

    def _finish_clip(self, ts: float) -> None:
        if self.clip is None:
            return
        c = self.clip
        c.writer.close()
        size = c.path.stat().st_size if c.path.exists() else 0
        self.db.add_clip(c.kind, str(c.path), c.start_ts, ts, c.reason, c.video_id, c.event_id, size)
        log.info("clip %s saved: %d frames, %.1f MB", c.path.name, c.frames, size / 1e6)
        self.clip = None
        self.status.recording_clip = None

    # ------------------------------------------------------------ requests
    def _process_requests(self, frame: Frame, ts: float) -> None:
        if self.status.frames_total % 5:
            return
        for p in sorted(self.requests_dir.glob("*.json")):
            try:
                req = json.loads(p.read_text(encoding="utf-8"))
            except (OSError, ValueError) as exc:
                log.warning("bad request file %s: %s", p, exc)
                p.unlink(missing_ok=True)
                continue
            p.unlink(missing_ok=True)
            self.handle_request(req, frame, ts)

    def handle_request(self, req: dict[str, Any], frame: Frame, ts: float) -> None:
        kind = str(req.get("kind", ""))
        assert self.session is not None
        if kind == "stop":
            log.info("stop requested")
            self._stop = True
        elif kind == "feed":
            source = str(req.get("source", "manual"))
            portions = float(req.get("portions", 1.0))
            confirmed = req.get("confirmed")
            if self.edge_url and source in ("manual", "pc") and not req.get("already_dispensed"):
                # A request from the PC while a rail exists means: actually dispense.
                result = self._edge_feed(portions)
                confirmed = bool(result.get("confirmed")) if result else False
                source = "feeder"
            self._record_feeding(frame, ts, source, portions, str(req.get("note", "")), confirmed)
        elif kind == "clip":
            if "request" in self.clip_on:
                eid = self.db.add_event("clip_requested", {"note": req.get("note", ""), "ts": frame.timestamp_s}, video_id=self.session.video_id)
                self._start_clip("request", ts, str(req.get("note", "requested")), eid)
        elif kind == "note":
            self.db.add_event("owner_note", {"note": req.get("note", ""), "ts": frame.timestamp_s}, video_id=self.session.video_id)
        else:
            log.warning("unknown request kind %r", kind)

    def _record_feeding(self, frame: Frame, ts: float, source: str, portions: float, note: str, confirmed: bool | None) -> int:
        assert self.session is not None
        eid = mark_feeding(self.db, self.session.video_id, frame.timestamp_s, source, portions, note, confirmed)
        self.pending_feedings.append({"event_id": eid, "ts": frame.timestamp_s, "wall_ts": ts, "video_id": self.session.video_id})
        self._feedings_this_session.append(eid)
        self.status.pending_feedings = len(self.pending_feedings)
        log.info("feeding marked at %.1fs (event %d, %s%s)", frame.timestamp_s, eid, source, "" if confirmed is None else (", confirmed" if confirmed else ", NOT confirmed"))
        if "feeding" in self.clip_on:
            self._start_clip("feeding", ts, f"feeding ({source})", eid)
        return eid

    # ---------------------------------------------------------------- edge
    def _edge_feed(self, portions: float) -> dict[str, Any] | None:
        if not self.edge_url:
            return None
        try:
            body = json.dumps({"portions": portions, "source": "pc"}).encode()
            req = urllib.request.Request(f"{self.edge_url}/feed", data=body, headers={"Content-Type": "application/json"}, method="POST")
            with urllib.request.urlopen(req, timeout=15) as resp:  # noqa: S310 - configured URL
                result = json.loads(resp.read().decode())
            # Our own feed shows up in the edge event log too; skip it there.
            self._edge_last_event = max(self._edge_last_event, int(result.get("event_id", 0)) + 1)
            return result
        except (urllib.error.URLError, OSError, ValueError) as exc:
            log.error("edge feeder failed: %s", exc)
            self.status.last_error = f"edge feeder: {exc}"
            return None

    def _poll_edge(self, frame: Frame) -> None:
        """Turn the rail's FEED button and feeder confirmations into feeding events."""
        if not self.edge_url or self.session is None:
            return
        now = time.time()
        if now < self._edge_next_poll:
            return
        self._edge_next_poll = now + self.edge_poll_s
        try:
            from fishai.sensors.http_sensor import fetch_json

            doc = fetch_json(f"{self.edge_url}/events?since={self._edge_last_event}", timeout_s=3)
        except (urllib.error.URLError, OSError, ValueError) as exc:
            if self.status.last_error != f"edge: {exc}":
                log.warning("edge agent unreachable: %s", exc)
            self.status.last_error = f"edge: {exc}"
            return
        for ev in doc.get("events", []) if isinstance(doc, dict) else []:
            eid = int(ev.get("id", 0))
            self._edge_last_event = max(self._edge_last_event, eid)
            if ev.get("kind") == "feed_done" and ev.get("source") != "pc":
                self._record_feeding(frame, now, str(ev.get("source", "feeder")), float(ev.get("portions", 1.0)), "", bool(ev.get("confirmed", False)))
            elif ev.get("kind") == "mode":
                self.db.add_event("camera_mode", {"mode": ev.get("mode")}, video_id=self.session.video_id)

    def _poll_sensors(self) -> None:
        if self.sensor_poll_s <= 0:
            return
        now = time.time()
        if now < self._sensor_next_poll:
            return
        self._sensor_next_poll = now + self.sensor_poll_s
        if self._hub is None:
            from fishai.sensors import SensorHub, build_sensors

            try:
                self._hub = SensorHub(build_sensors(self.cfg.get("sensors", [])), limits=self.cfg.get("sensor_limits", {}))
            except Exception as exc:
                log.error("sensors not built: %s", exc)
                self.sensor_poll_s = 0
                return
        try:
            readings = self._hub.read_all(self.db)
            self.status.sensors = {k: {"value": (round(r.value, 2) if r.value == r.value else None), "unit": r.unit, "status": r.status} for k, r in readings.items()}
        except Exception as exc:
            log.error("sensor poll failed: %s", exc)

    def _check_pending_feedings(self, frame: Frame, ts: float, force: bool = False) -> None:
        if not self.pending_feedings or self.session is None:
            return
        after_s = float(self.cfg.section("feeding").get("after_s", 120))
        done = []
        for pf in self.pending_feedings:
            if force or frame.timestamp_s - pf["ts"] >= after_s:
                self.session.flush()
                rows = compute_feeding_responses(self.db, pf["event_id"], self.cfg.section("feeding"))
                log.info("feeding %d: %d fish measured, %d approached", pf["event_id"], len(rows), sum(r["approached"] for r in rows))
                done.append(pf)
        for pf in done:
            self.pending_feedings.remove(pf)
        self.status.pending_feedings = len(self.pending_feedings)

    # ------------------------------------------------------------- session end
    def _close_session(self, final: bool = False) -> None:
        if self.session is None:
            return
        last_ts = self.session.last_ts
        if self.session.last_step is not None:
            self._check_pending_feedings(self.session.last_step.frame, last_ts, force=True)
        if self.clip is not None:
            self._finish_clip(last_ts)
        result = self.session.finish(duration_s=last_ts + self.session.frame_interval_s if self.session.processed else 0.0)
        self.results.append(result)
        devs: list[Deviation] = []
        # Identities exist now: attach fish ids to this session's feeding responses and judge them.
        if self._feedings_this_session:
            self.db.relink_feeding_responses(result.video_id)
            for eid in self._feedings_this_session:
                try:
                    devs += feeding_deviations(self.db, eid)
                except Exception as exc:
                    log.error("feeding deviation check failed: %s", exc)
            self._feedings_this_session = []
        try:
            devs = deviations_for_video(self.db, result.video_id, self.cfg.section("baselines"))
        except Exception as exc:  # never let analysis kill the loop
            log.error("deviation check failed: %s", exc)
        self.status.last_deviations = [d.sentence() for d in devs]
        for d in devs:
            log.warning("[%s] %s", d.severity, d.sentence())
        if self.assess_each_session:
            self._assess(result.video_id, devs)
        try:
            rep = run_retention(self.db, self.cfg.section("retention"))
            if rep["observations_deleted"] or rep["clips_deleted"]:
                log.info("retention: %d observations pruned, %d clips deleted", rep["observations_deleted"], len(rep["clips_deleted"]))
        except Exception as exc:
            log.error("retention failed: %s", exc)
        self.status.sessions_completed += 1
        self.session = None
        self.session_first_ts = None
        self._write_status()
        # A deviation clip covers the END of the session that produced it.
        if devs and "deviation" in self.clip_on and not final and any(d.severity in ("warning", "critical") for d in devs):
            # The buffer still holds the end of the session that deviated; save it into the next one.
            self._deviation_clip_reason = "; ".join(d.sentence() for d in devs[:3])

    def _assess(self, video_id: str, devs: list[Deviation]) -> None:
        try:
            from fishai.reasoning import assess, build_state
            from fishai.sensors import SensorHub, build_sensors

            hub = SensorHub(build_sensors(self.cfg.get("sensors", [])), limits=self.cfg.get("sensor_limits", {}))
            readings = hub.read_all(self.db)
            state = build_state(self.db, video_id, devs, SensorHub.state_for_reasoner(readings))
            a = assess(state, dict(self.cfg.section("reasoning")), db=self.db, video_id=video_id)
            log.info("assessment: %s (%s)", a.severity, a.source)
        except Exception as exc:
            log.error("assessment failed: %s", exc)

    # -------------------------------------------------------------- status
    def _write_status(self) -> None:
        self.status.buffer_s = self.buffer.span_s
        self.status.updated_at = _now_iso()
        tmp = self.status_path.with_suffix(".tmp")
        try:
            tmp.write_text(json.dumps(self.status.to_dict(), indent=1), encoding="utf-8")
            tmp.replace(self.status_path)
        except OSError as exc:
            log.warning("could not write status: %s", exc)


def _repo_rel(p: Path) -> Path:
    from fishai.config import REPO_ROOT

    return REPO_ROOT / p


def read_status(cfg: Config) -> dict[str, Any] | None:
    p = Path(cfg.get_path("live.status_file", "runs/live/status.json"))
    if not p.is_absolute():
        p = _repo_rel(p)
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def send_request(cfg: Config, kind: str, **fields: Any) -> Path:
    """Drop a request file for a running watcher. Returns the file path."""
    d = Path(cfg.get_path("live.requests_dir", "runs/live/requests"))
    if not d.is_absolute():
        d = _repo_rel(d)
    d.mkdir(parents=True, exist_ok=True)
    p = d / f"{time.time_ns()}_{kind}.json"
    p.write_text(json.dumps({"kind": kind, **fields}), encoding="utf-8")
    return p
