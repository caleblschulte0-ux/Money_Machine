# Training our own detector

The path from "Fishial bootstrap" to "our weights":

1. Collect footage (`fishai watch` / `fishai ingest`), let the bootstrap
   detector run, and export: `fishai export dataset --name tank1_week1`.
   The manifest in `datasets/manifests/` says the labels are
   model-assisted.
2. Review the export (fix boxes, delete false positives, add misses).
   Any YOLO-format label tool works; the review tool in the roadmap will
   make it faster. Keep the manifest name.
3. Split: `python training/split_dataset.py datasets/tank1_week1 --val 0.15`
   writes `train.txt` / `val.txt` and a `data.yaml` that points at them.
4. Train: `python training/train_detector.py datasets/tank1_week1/data.yaml --epochs 50 --base fishial_detector_v26`
   fine-tunes from the bootstrap weights (or from a COCO nano if you want
   to start clean) and writes `models/ours_<name>/best.pt`.
5. Compare: `python evaluation/compare_detectors.py datasets/tank1_week1/data.yaml --val fishial_detector_v26 models/ours_tank1/best.pt`
   scores each detector against the reviewed labels with
   `fishai.evaluation` (precision, recall, F1, mean IoU) and prints a table.
6. Register the winner in `models/registry.json` (a local path entry is
   fine) and set `detection.yolo.model` to it.

Licensing: `train_detector.py` uses ultralytics (AGPL-3.0). Weights
trained with it inherit that question for a commercial product; the plan
in `docs/THIRD_PARTY.md` is to move training to an Apache-licensed
family (RF-DETR, D-FINE, YOLOX) once the reviewed dataset exists. The
dataset format is the same, so nothing above changes except step 4.
