"""Generate synthetic datasets and videos from the renderer, with a manifest."""

from __future__ import annotations

import hashlib
import json
import random
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fishai.config import REPO_ROOT
from fishai.lab.render import Assets, RenderConfig, Scene, render_frame, scene_meta
from fishai.lab.sprites import load_sprites
from fishai.lab.yolo import write_sample, write_split
from fishai.log import get_logger
from fishai.video import VideoWriter

log = get_logger(__name__)

ASSETS_DIR = REPO_ROOT / "datasets" / "synth_assets"
MANIFESTS_DIR = REPO_ROOT / "datasets" / "manifests"


def load_assets(directory: Path | None = None, size: tuple[int, int] = (640, 360), exclude_origins: set[str] | None = None) -> Assets:
    """``exclude_origins``: substrings of clip names whose fish and backgrounds must NOT be used
    (held out so a real-footage evaluation is on tanks the detector never saw)."""
    d = directory or ASSETS_DIR
    sprites = load_sprites(d / "sprites", exclude_origins) if (d / "sprites").is_dir() else []
    plates = []
    if (d / "plates").is_dir():
        import cv2

        keep = [p for p in sorted((d / "plates").glob("*.png")) if not exclude_origins or not any(x in p.name for x in exclude_origins)]
        for p in keep:
            img = cv2.imread(str(p))
            if img is not None:
                plates.append(cv2.resize(img, size))
    return Assets(sprites, plates)


def generate_dataset(
    out: Path,
    n: int,
    name: str,
    cfg: RenderConfig | None = None,
    assets: Assets | None = None,
    seed: int = 0,
    val_fraction: float = 0.1,
    write_manifest: bool = True,
    manifests_dir: Path | None = None,
) -> dict[str, Any]:
    cfg = cfg or RenderConfig()
    assets = assets if assets is not None else load_assets(size=(cfg.width, cfg.height))
    rng = random.Random(seed)
    out.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    boxes_total = night = empty = 0
    hidden_total = 0
    for i in range(n):
        img, labels, scene = render_frame(rng, cfg, assets)
        kept = [lab for lab in labels if lab["keep"]]
        hidden_total += len(labels) - len(kept)
        boxes_total += len(kept)
        night += int(scene.night)
        empty += int(not kept)
        write_sample(out, f"synth_{seed}_{i:06d}", img, [lab["box"] for lab in kept], {"scene": scene_meta(scene), "fish": labels})
        if (i + 1) % 250 == 0:
            log.info("rendered %d/%d (%.1f frames/s)", i + 1, n, (i + 1) / (time.time() - t0))
    n_train, n_val = write_split(out, val_fraction, seed)
    manifest = {
        "name": name,
        "kind": "synthetic",
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "out_dir": str(out.resolve()),
        "frames": n, "boxes": boxes_total, "night_frames": night, "frames_without_fish": empty,
        "labels_dropped_as_hidden_or_tiny": hidden_total,
        "train": n_train, "val": n_val, "seed": seed,
        "render_config": cfg.to_dict(),
        "assets": assets.counts,
        "labels_are": "exact (rendered); boxes cover the VISIBLE part of each fish",
        "asset_licences": "real sprites and plates are derived from the clips in public_clips.json (Mixkit licence: use in projects, no redistribution of the clips); procedural assets are ours",
    }
    manifest["checksum"] = hashlib.sha256(json.dumps(manifest, sort_keys=True).encode()).hexdigest()[:16]
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    if write_manifest:
        md = manifests_dir or MANIFESTS_DIR
        md.mkdir(parents=True, exist_ok=True)
        (md / f"{name}.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    log.info("dataset %s: %d frames, %d boxes, %d night, in %.0fs", name, n, boxes_total, night, time.time() - t0)
    return manifest


def generate_video(out_path: Path, frames: int, cfg: RenderConfig | None = None, assets: Assets | None = None, seed: int = 0, fps: float = 10.0) -> dict[str, Any]:
    """A continuous synthetic clip plus ``<name>.labels.json`` with per-frame ids and boxes.

    Ground-truth identity through occlusions, look-alikes and night: the test
    set tracking and re-identification have never had.
    """
    cfg = cfg or RenderConfig()
    assets = assets if assets is not None else load_assets(size=(cfg.width, cfg.height))
    rng = random.Random(seed)
    scene = Scene(rng, cfg, assets)
    truth: dict[int, dict[int, list[float]]] = {}
    with VideoWriter(out_path, fps, (cfg.width, cfg.height)) as w:
        for i in range(frames):
            img, labels = scene.frame()
            truth[i] = {lab["id"]: lab["box"] for lab in labels if lab["keep"]}
            w.write(img)
            scene.step(1.0 / fps)
    meta = {"scene": scene_meta(scene), "fps": fps, "frames": frames, "truth": {str(k): {str(i): b for i, b in v.items()} for k, v in truth.items()}}
    out_path.with_suffix(".labels.json").write_text(json.dumps(meta), encoding="utf-8")
    return meta


def load_video_truth(path: Path) -> dict[int, dict[int, Any]]:
    from fishai.types import BBox

    meta = json.loads(path.with_suffix(".labels.json").read_text(encoding="utf-8"))
    return {int(k): {int(i): BBox(*b) for i, b in v.items()} for k, v in meta["truth"].items()}
