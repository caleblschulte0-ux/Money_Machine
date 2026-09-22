#!/usr/bin/env python3
"""FishAI edge agent: runs on the Raspberry Pi on the rail.

It does the four things the rail hardware needs and nothing else:

  * stream the camera as MJPEG with LOCKED exposure, gain and colour gains
    (auto exposure and auto white balance off, so the colour of a fish is
    the same in every frame FishAI sees)
  * read the sensors (DS18B20 temperature probe, float switch)
  * drive the feeder (metering drum with a home sensor) and the FEED button
  * keep an event log the PC polls, so a button press or a completed feed
    reaches the same logging path as everything else

Standard library only for the server; picamera2 / gpiozero / w1thermsensor
are imported when present. ``--fake`` runs the whole agent with a synthetic
tank, simulated sensors and a simulated feeder, on any machine, which is how
the PC side is tested.

    python3 fishai_edge.py --port 8000                      # on the Pi
    python3 fishai_edge.py --port 8000 --fake               # anywhere

Endpoints (all JSON unless stated):
    GET  /stream.mjpg          multipart MJPEG stream
    GET  /snapshot.jpg         one JPEG frame
    GET  /status               camera settings, lighting mode, fps, uptime
    GET  /sensors              {"water_temperature": {value, unit, status}, "water_level": {...}}
    GET  /events?since=N       events with id > N (button, feed_started, feed_done, mode)
    POST /feed  {"portions": 1, "source": "pc"}   run the drum; returns {"confirmed": bool, ...}
    POST /camera/mode {"mode": "day"|"night"}      switch IR-cut filter / IR LEDs if wired
    POST /button                                  simulate the FEED button (fake mode only)
"""

from __future__ import annotations

import argparse
import json
import logging
import socketserver
import sys
import threading
import time
from collections import deque
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any

log = logging.getLogger("fishai.edge")

try:  # numpy + cv2 are needed for --fake and for JPEG encoding without picamera2
    import cv2
    import numpy as np
except ImportError:  # pragma: no cover
    cv2 = None
    np = None


# ------------------------------------------------------------------ events
class EventLog:
    def __init__(self, maxlen: int = 2000) -> None:
        self._items: deque[dict[str, Any]] = deque(maxlen=maxlen)
        self._next = 1
        self._lock = threading.Lock()

    def add(self, kind: str, **fields: Any) -> dict[str, Any]:
        with self._lock:
            ev = {"id": self._next, "kind": kind, "ts": time.time(), **fields}
            self._next += 1
            self._items.append(ev)
        return ev

    def since(self, last_id: int) -> list[dict[str, Any]]:
        with self._lock:
            return [e for e in self._items if e["id"] > last_id]


# ------------------------------------------------------------------ camera
class Camera:
    """Abstract camera: ``jpeg()`` returns the latest frame as JPEG bytes."""

    mode = "day"

    def jpeg(self) -> bytes:
        raise NotImplementedError

    def settings(self) -> dict[str, Any]:
        return {}

    def set_mode(self, mode: str) -> None:
        self.mode = mode

    def close(self) -> None:
        return None


class FakeCamera(Camera):
    """Synthetic tank so the agent runs without hardware. Night mode is grey, like IR."""

    def __init__(self, width: int, height: int, fps: float) -> None:
        self.width, self.height, self.fps = width, height, fps
        self._t0 = time.time()
        self._rng = np.random.default_rng(1)
        self._fish = [
            {"x": self._rng.uniform(80, width - 80), "y": self._rng.uniform(60, height - 60), "vx": self._rng.uniform(-3, 3), "vy": self._rng.uniform(-1, 1), "c": c}
            for c in [(40, 90, 230), (230, 160, 30), (60, 200, 90)]
        ]

    def _frame(self):
        img = np.zeros((self.height, self.width, 3), np.uint8)
        for y in range(self.height):
            t = y / max(1, self.height - 1)
            img[y, :] = (int(90 - 40 * t), int(70 - 30 * t), int(30 - 10 * t))
        for f in self._fish:
            f["vx"] += self._rng.uniform(-0.4, 0.4)
            f["vy"] += self._rng.uniform(-0.3, 0.3)
            f["vx"] = float(np.clip(f["vx"], -4, 4))
            f["vy"] = float(np.clip(f["vy"], -2, 2))
            f["x"] += f["vx"]
            f["y"] += f["vy"]
            if not 40 < f["x"] < self.width - 40:
                f["vx"] *= -1
            if not 30 < f["y"] < self.height - 30:
                f["vy"] *= -1
            cv2.ellipse(img, (int(f["x"]), int(f["y"])), (28, 12), 0, 0, 360, f["c"], -1)
        if self.mode == "night":
            g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            img = cv2.cvtColor(g, cv2.COLOR_GRAY2BGR)
        return img

    def jpeg(self) -> bytes:
        ok, buf = cv2.imencode(".jpg", self._frame(), [int(cv2.IMWRITE_JPEG_QUALITY), 85])
        return buf.tobytes() if ok else b""

    def settings(self) -> dict[str, Any]:
        return {"backend": "fake", "width": self.width, "height": self.height, "fps": self.fps, "locked": True}


class PiCamera(Camera):
    """Picamera2 with everything automatic switched off."""

    def __init__(self, width: int, height: int, fps: float, exposure_us: int, analogue_gain: float, colour_gains: tuple[float, float], ircut_pin: int | None, irled_pin: int | None) -> None:
        from picamera2 import Picamera2  # type: ignore

        self.width, self.height, self.fps = width, height, fps
        self.cam = Picamera2()
        cfg = self.cam.create_video_configuration(main={"size": (width, height), "format": "RGB888"}, controls={"FrameRate": fps})
        self.cam.configure(cfg)
        self.cam.start()
        time.sleep(0.5)
        self.controls = {
            "AeEnable": False,
            "AwbEnable": False,
            "ExposureTime": int(exposure_us),
            "AnalogueGain": float(analogue_gain),
            "ColourGains": (float(colour_gains[0]), float(colour_gains[1])),
        }
        self.cam.set_controls(self.controls)
        self._ircut = self._irled = None
        try:
            from gpiozero import OutputDevice  # type: ignore

            self._ircut = OutputDevice(ircut_pin) if ircut_pin is not None else None
            self._irled = OutputDevice(irled_pin) if irled_pin is not None else None
        except Exception as exc:  # pragma: no cover
            log.warning("gpio not available for IR control: %s", exc)

    def jpeg(self) -> bytes:
        arr = self.cam.capture_array("main")
        bgr = arr[:, :, ::-1]
        ok, buf = cv2.imencode(".jpg", bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
        return buf.tobytes() if ok else b""

    def settings(self) -> dict[str, Any]:
        return {"backend": "picamera2", "width": self.width, "height": self.height, "fps": self.fps, "locked": True, **self.controls}

    def set_mode(self, mode: str) -> None:
        self.mode = mode
        night = mode == "night"
        if self._ircut is not None:
            (self._ircut.on if night else self._ircut.off)()  # filter OUT at night
        if self._irled is not None:
            (self._irled.on if night else self._irled.off)()

    def close(self) -> None:
        self.cam.stop()


# ----------------------------------------------------------------- sensors
class Sensors:
    def read(self) -> dict[str, dict[str, Any]]:
        raise NotImplementedError


class FakeSensors(Sensors):
    def __init__(self) -> None:
        self.temperature_f = 78.0
        self.water_ok = True

    def read(self) -> dict[str, dict[str, Any]]:
        return {
            "water_temperature": {"value": round(self.temperature_f + (time.time() % 7) * 0.02, 2), "unit": "F", "status": "ok", "source": "simulated"},
            "water_level": {"value": 1.0 if self.water_ok else 0.0, "unit": "ok", "status": "ok" if self.water_ok else "low", "source": "simulated"},
        }


class PiSensors(Sensors):
    def __init__(self, float_pin: int | None, temp_unit: str = "F") -> None:
        self.temp_unit = temp_unit
        self._sensor = None
        self._float = None
        try:
            from w1thermsensor import W1ThermSensor  # type: ignore

            self._sensor = W1ThermSensor()
        except Exception as exc:  # pragma: no cover
            log.warning("no DS18B20 found: %s", exc)
        if float_pin is not None:
            try:
                from gpiozero import Button  # type: ignore

                self._float = Button(float_pin, pull_up=True)
            except Exception as exc:  # pragma: no cover
                log.warning("float switch not available: %s", exc)

    def read(self) -> dict[str, dict[str, Any]]:
        out: dict[str, dict[str, Any]] = {}
        if self._sensor is not None:
            try:
                c = float(self._sensor.get_temperature())
                v = c * 9 / 5 + 32 if self.temp_unit == "F" else c
                out["water_temperature"] = {"value": round(v, 2), "unit": self.temp_unit, "status": "ok", "source": "hardware"}
            except Exception as exc:  # pragma: no cover
                out["water_temperature"] = {"value": None, "unit": self.temp_unit, "status": "error", "source": "hardware", "error": str(exc)}
        if self._float is not None:
            ok = bool(self._float.is_pressed)  # switch closed = water at level
            out["water_level"] = {"value": 1.0 if ok else 0.0, "unit": "ok", "status": "ok" if ok else "low", "source": "hardware"}
        return out


# ------------------------------------------------------------------ feeder
class Feeder:
    def feed(self, portions: float) -> dict[str, Any]:
        raise NotImplementedError


class FakeFeeder(Feeder):
    def __init__(self) -> None:
        self.runs = 0

    def feed(self, portions: float) -> dict[str, Any]:
        time.sleep(0.05)
        self.runs += 1
        return {"confirmed": True, "revolutions": int(max(1, round(portions))), "duration_s": 0.05}


class PiFeeder(Feeder):
    """Metering drum on a DC motor; a home sensor closes once per revolution."""

    def __init__(self, motor_pin: int, home_pin: int | None, max_run_s: float = 6.0) -> None:
        from gpiozero import Button, OutputDevice  # type: ignore

        self.motor = OutputDevice(motor_pin)
        self.home = Button(home_pin, pull_up=True) if home_pin is not None else None
        self.max_run_s = max_run_s
        self._lock = threading.Lock()

    def feed(self, portions: float) -> dict[str, Any]:
        revolutions = int(max(1, round(portions)))
        with self._lock:
            t0 = time.time()
            done = 0
            self.motor.on()
            try:
                if self.home is None:
                    time.sleep(1.2 * revolutions)  # timed fallback; not confirmed
                    return {"confirmed": False, "revolutions": revolutions, "duration_s": time.time() - t0, "reason": "no home sensor"}
                for _ in range(revolutions):
                    if not self.home.wait_for_release(timeout=self.max_run_s) or not self.home.wait_for_press(timeout=self.max_run_s):
                        return {"confirmed": False, "revolutions": done, "duration_s": time.time() - t0, "reason": "home sensor timeout (jam?)"}
                    done += 1
            finally:
                self.motor.off()
            return {"confirmed": True, "revolutions": done, "duration_s": time.time() - t0}


# ------------------------------------------------------------------- agent
class Agent:
    def __init__(self, camera: Camera, sensors: Sensors, feeder: Feeder, fps: float) -> None:
        self.camera, self.sensors, self.feeder, self.fps = camera, sensors, feeder, fps
        self.events = EventLog()
        self.started = time.time()
        self._frame: bytes = b""
        self._frame_lock = threading.Lock()
        self._frames = 0
        self._fps_window: deque[float] = deque(maxlen=60)
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._thread.start()

    def _capture_loop(self) -> None:
        interval = 1.0 / max(0.5, self.fps)
        while not self._stop.is_set():
            t = time.time()
            try:
                data = self.camera.jpeg()
            except Exception as exc:
                log.error("capture failed: %s", exc)
                time.sleep(1.0)
                continue
            with self._frame_lock:
                self._frame = data
                self._frames += 1
            self._fps_window.append(t)
            time.sleep(max(0.0, interval - (time.time() - t)))

    def frame(self) -> bytes:
        with self._frame_lock:
            return self._frame

    def status(self) -> dict[str, Any]:
        w = self._fps_window
        fps = (len(w) - 1) / (w[-1] - w[0]) if len(w) > 1 and w[-1] > w[0] else 0.0
        return {
            "agent": "fishai-edge", "version": "0.1", "uptime_s": round(time.time() - self.started, 1), "frames": self._frames,
            "fps_measured": round(fps, 2), "lighting_mode": self.camera.mode, "camera": self.camera.settings(),
            "last_event_id": self.events._next - 1,
        }

    def feed(self, portions: float, source: str) -> dict[str, Any]:
        ev = self.events.add("feed_started", portions=portions, source=source)
        result = self.feeder.feed(portions)
        self.events.add("feed_done", portions=portions, source=source, started_id=ev["id"], **result)
        return {"event_id": ev["id"], **result}

    def button_pressed(self) -> dict[str, Any]:
        self.events.add("button", source="button")
        return self.feed(1.0, "button")

    def set_mode(self, mode: str) -> None:
        self.camera.set_mode(mode)
        self.events.add("mode", mode=mode)

    def close(self) -> None:
        self._stop.set()
        self.camera.close()


# ------------------------------------------------------------------ server
class Handler(BaseHTTPRequestHandler):
    agent: Agent
    fake: bool = False

    def log_message(self, fmt: str, *args: Any) -> None:  # quiet
        log.debug(fmt, *args)

    def _json(self, obj: Any, status: int = 200) -> None:
        data = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _body(self) -> dict[str, Any]:
        n = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(n) if n else b""
        try:
            return json.loads(raw.decode() or "{}")
        except ValueError:
            return {}

    def do_GET(self) -> None:  # noqa: N802
        path, _, query = self.path.partition("?")
        if path == "/stream.mjpg":
            self.send_response(200)
            self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            interval = 1.0 / max(0.5, self.agent.fps)
            try:
                last = b""
                while True:
                    frame = self.agent.frame()
                    if frame and frame is not last:
                        self.wfile.write(b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: " + str(len(frame)).encode() + b"\r\n\r\n" + frame + b"\r\n")
                        self.wfile.flush()
                        last = frame
                    time.sleep(interval)
            except (BrokenPipeError, ConnectionResetError, OSError):
                return
        elif path == "/snapshot.jpg":
            frame = self.agent.frame()
            self.send_response(200 if frame else 503)
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Content-Length", str(len(frame)))
            self.end_headers()
            self.wfile.write(frame)
        elif path == "/status":
            self._json(self.agent.status())
        elif path == "/sensors":
            self._json(self.agent.sensors.read())
        elif path == "/events":
            since = 0
            for part in query.split("&"):
                if part.startswith("since="):
                    try:
                        since = int(part[6:])
                    except ValueError:
                        pass
            self._json({"events": self.agent.events.since(since)})
        elif path == "/":
            self._json({"ok": True, "endpoints": ["/stream.mjpg", "/snapshot.jpg", "/status", "/sensors", "/events?since=N", "POST /feed", "POST /camera/mode"]})
        else:
            self._json({"error": "not found"}, HTTPStatus.NOT_FOUND)

    def do_POST(self) -> None:  # noqa: N802
        path = self.path.partition("?")[0]
        body = self._body()
        if path == "/feed":
            portions = float(body.get("portions", 1.0))
            if not 0 < portions <= 3:
                self._json({"error": "portions must be in (0, 3]"}, HTTPStatus.BAD_REQUEST)
                return
            self._json(self.agent.feed(portions, str(body.get("source", "pc"))))
        elif path == "/camera/mode":
            mode = str(body.get("mode", ""))
            if mode not in ("day", "night"):
                self._json({"error": "mode must be day or night"}, HTTPStatus.BAD_REQUEST)
                return
            self.agent.set_mode(mode)
            self._json({"ok": True, "lighting_mode": mode})
        elif path == "/button" and self.fake:
            self._json(self.agent.button_pressed())
        else:
            self._json({"error": "not found"}, HTTPStatus.NOT_FOUND)


class ThreadedServer(socketserver.ThreadingMixIn, HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def build_agent(args: argparse.Namespace) -> Agent:
    if args.fake:
        cam: Camera = FakeCamera(args.width, args.height, args.fps)
        sensors: Sensors = FakeSensors()
        feeder: Feeder = FakeFeeder()
    else:
        cam = PiCamera(args.width, args.height, args.fps, args.exposure_us, args.gain, (args.red_gain, args.blue_gain), args.ircut_pin, args.irled_pin)
        sensors = PiSensors(args.float_pin, args.temp_unit)
        feeder = PiFeeder(args.feeder_pin, args.home_pin) if args.feeder_pin is not None else FakeFeeder()
    agent = Agent(cam, sensors, feeder, args.fps)
    if not args.fake and args.button_pin is not None:
        try:
            from gpiozero import Button  # type: ignore

            btn = Button(args.button_pin, pull_up=True, bounce_time=0.1)
            btn.when_pressed = lambda: threading.Thread(target=agent.button_pressed, daemon=True).start()
            agent._button = btn  # keep a reference
        except Exception as exc:  # pragma: no cover
            log.warning("FEED button not available: %s", exc)
    return agent


def serve(args: argparse.Namespace) -> ThreadedServer:
    agent = build_agent(args)
    handler = type("BoundHandler", (Handler,), {"agent": agent, "fake": args.fake})
    server = ThreadedServer((args.host, args.port), handler)
    server.agent = agent  # type: ignore[attr-defined]
    return server


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--host", default="0.0.0.0")
    ap.add_argument("--port", type=int, default=8000)
    ap.add_argument("--fake", action="store_true", help="synthetic camera, sensors and feeder")
    ap.add_argument("--width", type=int, default=1920)
    ap.add_argument("--height", type=int, default=1080)
    ap.add_argument("--fps", type=float, default=10.0)
    ap.add_argument("--exposure-us", type=int, default=8000, help="fixed exposure (microseconds)")
    ap.add_argument("--gain", type=float, default=2.0, help="fixed analogue gain")
    ap.add_argument("--red-gain", type=float, default=1.8)
    ap.add_argument("--blue-gain", type=float, default=1.6)
    ap.add_argument("--temp-unit", default="F", choices=["F", "C"])
    ap.add_argument("--float-pin", type=int, default=None, help="BCM pin of the float switch")
    ap.add_argument("--feeder-pin", type=int, default=None, help="BCM pin driving the drum motor")
    ap.add_argument("--home-pin", type=int, default=None, help="BCM pin of the drum home sensor")
    ap.add_argument("--button-pin", type=int, default=None, help="BCM pin of the FEED button")
    ap.add_argument("--ircut-pin", type=int, default=None, help="BCM pin that switches the IR-cut filter")
    ap.add_argument("--irled-pin", type=int, default=None, help="BCM pin that switches the IR illuminator")
    ap.add_argument("--log-level", default="INFO")
    args = ap.parse_args(argv)
    logging.basicConfig(level=args.log_level.upper(), format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    if cv2 is None:
        print("opencv-python-headless and numpy are required", file=sys.stderr)
        return 2
    server = serve(args)
    log.info("fishai edge on http://%s:%d (%s)", args.host, args.port, "FAKE" if args.fake else "hardware")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.agent.close()  # type: ignore[attr-defined]
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
