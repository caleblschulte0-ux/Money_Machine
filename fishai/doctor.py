"""Installation check: what is installed, what is downloaded, what will actually run.

Installed is not working. Each check makes the real attempt where it is
cheap (import, open the database, load the registry, hit Ollama's tag
list) and says which backends are usable as a result.
"""

from __future__ import annotations

import importlib
import importlib.util
from pathlib import Path
from typing import Any

from fishai.config import Config


def _check(name: str, status: str, detail: str) -> dict[str, str]:
    return {"name": name, "status": status, "detail": detail}


def run_doctor(cfg: Config, check_ollama: bool = True, source: str | None = None) -> dict[str, Any]:
    checks: list[dict[str, str]] = []
    from fishai.config_check import check_config

    cc = check_config(cfg)
    checks.append(_check("config", "fail" if cc["errors"] else "ok", "; ".join(cc["errors"]) or "every key known, every value in range"))
    import cv2
    import numpy

    checks.append(_check("opencv", "ok", f"{cv2.__version__}; numpy {numpy.__version__}"))

    # Optional ML stack
    ml_ok = importlib.util.find_spec("ultralytics") is not None
    if ml_ok:
        try:
            torch = importlib.import_module("torch")
            device = "cuda" if torch.cuda.is_available() else "cpu"
            checks.append(_check("ml extras", "ok", f"ultralytics + torch {torch.__version__} on {device}"))
        except Exception as exc:  # pragma: no cover
            ml_ok = False
            checks.append(_check("ml extras", "warn", f"ultralytics present but torch failed: {exc}"))
    else:
        checks.append(_check("ml extras", "warn", "not installed; only the motion detector and simple tracker work (pip install -r requirements-ml.txt)"))
    sv_ok = importlib.util.find_spec("supervision") is not None
    checks.append(_check("bytetrack", "ok" if sv_ok else "warn", "supervision installed" if sv_ok else "supervision not installed; tracker 'bytetrack' unavailable"))

    # Model weights
    from fishai.models_registry import load_registry, local_path_for

    models_dir = cfg.resolve_path("paths.models_dir")
    yolo_model = str(cfg.get_path("detection.yolo.model", ""))
    try:
        registry = load_registry()
        entry = registry.get(yolo_model)
        if entry is None:
            p = Path(yolo_model)
            status = "ok" if p.exists() else "fail"
            checks.append(_check("detector weights", status, f"{yolo_model} {'exists' if p.exists() else 'missing'}"))
        else:
            path = local_path_for(yolo_model, entry, models_dir)
            if path.exists():
                checks.append(_check("detector weights", "ok", f"{yolo_model} at {path} ({path.stat().st_size // 1_000_000} MB)"))
            else:
                checks.append(_check("detector weights", "warn", f"{yolo_model} not downloaded: python scripts/download_models.py"))
    except (OSError, ValueError) as exc:
        checks.append(_check("detector weights", "fail", f"registry unreadable: {exc}"))

    # Database
    try:
        from fishai.storage import Database

        db_path = cfg.resolve_path("paths.database")
        with Database(db_path) as db:
            n = len(db.list_videos())
        checks.append(_check("database", "ok", f"{db_path} ({n} videos)"))
    except Exception as exc:
        checks.append(_check("database", "fail", f"{exc}"))

    # Reasoner
    backend = cfg.get_path("reasoning.backend", "rules")
    if backend == "ollama" and check_ollama:
        from fishai.reasoning.qwen.ollama import OllamaReasoner

        r = OllamaReasoner(**cfg.get_path("reasoning.ollama", {}))
        if r.available():
            checks.append(_check("reasoner", "ok", f"ollama at {r.host} has {r.model}"))
        else:
            checks.append(_check("reasoner", "warn", f"ollama/{r.model} not reachable at {r.host}; assessments fall back to rules (install Ollama, then `ollama pull {r.model}`)"))
    else:
        checks.append(_check("reasoner", "ok", f"backend {backend}" + (" (network check skipped)" if backend == "ollama" else "")))

    # The rail, if configured: a real request, not a config read.
    edge = cfg.get_path("live.edge_url") or cfg.get_path("control.edge_url")
    if edge and check_ollama:
        try:
            from fishai.sensors.http_sensor import fetch_json

            st = fetch_json(f"{str(edge).rstrip('/')}/status", timeout_s=5)
            checks.append(_check("rail", "ok", f"{edge}: {st.get('fps_measured')} fps, {st.get('lighting_mode')} mode, camera {st.get('camera', {}).get('backend')}"))
        except Exception as exc:
            checks.append(_check("rail", "fail", f"{edge} not answering: {exc}"))
    if source is not None and check_ollama:
        import cv2 as _cv2

        from fishai.pipeline.live import parse_source

        cap = _cv2.VideoCapture(parse_source(source))
        ok, frame = cap.read() if cap.isOpened() else (False, None)
        cap.release()
        checks.append(_check("video source", "ok" if ok else "fail", f"{source}: {'frame ' + 'x'.join(str(v) for v in frame.shape[1::-1]) if ok else 'no frame'}"))

    detectors = ["motion", "synthetic"] + (["yolo"] if ml_ok else [])
    trackers = ["simple"] + (["bytetrack"] if sv_ok else [])
    ready = not any(c["status"] == "fail" for c in checks)
    return {"ready": ready, "checks": checks, "usable_detectors": detectors, "usable_trackers": trackers}
