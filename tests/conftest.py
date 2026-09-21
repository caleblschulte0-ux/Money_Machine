"""Shared fixtures. Every test gets its own temp directory, database and config."""

from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

from fishai.config import load_config
from fishai.storage import Database
from fishai.video.synthetic import SyntheticAquarium

HAS_ML = importlib.util.find_spec("ultralytics") is not None
HAS_SV = importlib.util.find_spec("supervision") is not None


def pytest_configure(config: pytest.Config) -> None:
    config.addinivalue_line("markers", "ml: needs the ML extras (torch, ultralytics, supervision) and downloaded weights")


@pytest.fixture
def workdir(tmp_path: Path) -> Path:
    return tmp_path


@pytest.fixture
def cfg(workdir: Path):
    return load_config(
        overrides={
            "paths.database": str(workdir / "fishai.db"),
            "paths.output_dir": str(workdir / "runs"),
            "paths.models_dir": str(Path(__file__).resolve().parent.parent / "models"),
        }
    )


@pytest.fixture
def db(workdir: Path) -> Database:
    d = Database(workdir / "fishai.db")
    yield d
    d.close()


@pytest.fixture
def synthetic_video(workdir: Path):
    """A 200-frame 3-fish clip with fish 2 hidden for frames 60..120; returns (path, truth)."""
    path = workdir / "tank.mp4"
    truth = SyntheticAquarium(n_fish=3, seed=7, hide_fish=2, hide_between=(60, 120)).write(path, 200)
    return path, truth
