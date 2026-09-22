#!/usr/bin/env python
"""Fine-tune a fish detector on a reviewed export.

    python training/train_detector.py datasets/tank1_week1/data.yaml --epochs 50 --base fishial_detector_v26 --name tank1

Writes models/ours_<name>/best.pt plus a training record (data, base, epochs,
image size, metrics) next to it, so a weights file is never a mystery.
Requires the ML extras (ultralytics). Licensing note in training/README.md.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("data", help="data.yaml from training/split_dataset.py")
    ap.add_argument("--base", default="fishial_detector_v26", help="registry key or .pt to start from")
    ap.add_argument("--name", default="fish")
    ap.add_argument("--epochs", type=int, default=50)
    ap.add_argument("--imgsz", type=int, default=640)
    ap.add_argument("--batch", type=int, default=8)
    ap.add_argument("--device", default="auto")
    ap.add_argument("--models-dir", default=str(REPO_ROOT / "models"))
    ap.add_argument("--fraction", type=float, default=1.0, help="use this fraction of the training set (smoke tests)")
    args = ap.parse_args(argv)
    try:
        from ultralytics import YOLO
    except ImportError:
        print("ultralytics is required: pip install -r requirements-ml.txt", file=sys.stderr)
        return 2
    from fishai.models_registry import resolve_model_path

    base = resolve_model_path(args.base, models_dir=args.models_dir)
    out_dir = Path(args.models_dir) / f"ours_{args.name}"
    out_dir.mkdir(parents=True, exist_ok=True)
    device = args.device
    if device == "auto":
        import torch

        device = "0" if torch.cuda.is_available() else "cpu"
    model = YOLO(str(base))
    results = model.train(
        data=str(Path(args.data).resolve()), epochs=args.epochs, imgsz=args.imgsz, batch=args.batch, device=device,
        project=str(out_dir), name="run", exist_ok=True, fraction=args.fraction, verbose=False, plots=False,
    )
    best = out_dir / "run" / "weights" / "best.pt"
    final = out_dir / "best.pt"
    if best.exists():
        final.write_bytes(best.read_bytes())
    metrics = {}
    try:
        metrics = {k: float(v) for k, v in getattr(results, "results_dict", {}).items()}
    except Exception:
        pass
    record = {
        "name": args.name, "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "data": str(Path(args.data).resolve()),
        "base": str(base), "epochs": args.epochs, "imgsz": args.imgsz, "device": device, "metrics": metrics, "weights": str(final),
        "framework": "ultralytics (AGPL-3.0); see training/README.md",
    }
    (out_dir / "training_record.json").write_text(json.dumps(record, indent=2), encoding="utf-8")
    print(json.dumps(record, indent=2))
    print(f"\nto use: fishai process ... -o detection.backend=yolo -o detection.yolo.model={final}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
