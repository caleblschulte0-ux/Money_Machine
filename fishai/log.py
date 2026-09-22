"""One logger setup for the CLI and the library.

Unattended runs (watch, ingest --watch, daily from a scheduled task) write
to a rotating file under ``runs/logs`` as well as stderr, so a crash at
3 a.m. leaves something to read. Ten files of 5 MB each.
"""

from __future__ import annotations

import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

_FMT = "%(asctime)s %(levelname)-7s %(name)s: %(message)s"


def setup_logging(level: str = "INFO", log_file: str | Path | None = None, max_bytes: int = 5_000_000, backups: int = 10) -> None:
    root = logging.getLogger()
    root.setLevel(level.upper())
    if not any(isinstance(h, logging.StreamHandler) and not isinstance(h, RotatingFileHandler) for h in root.handlers):
        handler = logging.StreamHandler(sys.stderr)
        handler.setFormatter(logging.Formatter(_FMT, "%H:%M:%S"))
        root.addHandler(handler)
    if log_file is not None:
        path = Path(log_file)
        if not any(isinstance(h, RotatingFileHandler) and Path(h.baseFilename) == path.resolve() for h in root.handlers):
            path.parent.mkdir(parents=True, exist_ok=True)
            fh = RotatingFileHandler(path, maxBytes=max_bytes, backupCount=backups, encoding="utf-8")
            fh.setFormatter(logging.Formatter(_FMT))
            root.addHandler(fh)
    # Third-party chatter that drowns our own lines at INFO.
    for noisy in ("ultralytics", "urllib3", "PIL"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
