"""Real footage labelled by the bootstrap detector: a SILVER evaluation set.

Silver labels are Fishial's boxes above a confidence floor. Scoring our
detector against them measures agreement with Fishial on real footage, not
truth: a fish Fishial missed counts against nobody, and a fish Fishial
invented counts against us. It is the best real-footage check available
until reviewed (gold) labels exist, and the manifest says exactly that.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import cv2

from fishai.lab.yolo import write_sample, write_split
from fishai.types import Frame


def build_silver(
    clips: list[Path],
    detector: Any,
    out: Path,
    every_n: int = 15,
    per_clip: int = 30,
    min_confidence: float = 0.5,
    size: tuple[int, int] = (640, 360),
) -> dict[str, Any]:
    n_frames = n_boxes = 0
    sources = []
    for clip in clips:
        cap = cv2.VideoCapture(str(clip))
        idx = taken = 0
        while taken < per_clip:
            ok, img = cap.read()
            if not ok:
                break
            if idx % every_n == 0:
                img = cv2.resize(img, size, interpolation=cv2.INTER_AREA)
                boxes = [d.bbox.as_tuple() for d in detector.detect(Frame(idx, 0.0, img)) if d.confidence >= min_confidence]
                write_sample(out, f"{clip.stem}_{idx:05d}", img, [list(b) for b in boxes], {"source": clip.name, "frame": idx})
                n_boxes += len(boxes)
                taken += 1
            idx += 1
        cap.release()
        n_frames += taken
        sources.append({"clip": clip.name, "frames": taken})
    # Everything is evaluation data: put it all in "val".
    write_split(out, 1.0, group_of=lambda p: p.stem.rsplit("_", 1)[0])
    (out / "val.txt").write_text("\n".join(str(p.resolve()) for p in sorted((out / "images").iterdir())) + "\n", encoding="utf-8")
    (out / "train.txt").write_text("", encoding="utf-8")
    manifest = {
        "kind": "silver", "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "frames": n_frames, "boxes": n_boxes,
        "min_confidence": min_confidence, "labeller": getattr(detector, "name", "?"), "sources": sources,
        "labels_are": "SILVER: the bootstrap detector's boxes. Scores against this set measure agreement with it, not truth.",
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest
