"""Train OUR fish detector: torchvision Faster R-CNN, no Ultralytics anywhere.

Why this stack first: it is in torchvision (BSD-3 code), trains on a laptop
CPU at roughly 0.3 s per 640x360 image, and needs no new dependency. The
architecture is a detail behind ``build_model``; RF-DETR (Apache-2.0,
DINOv2 backbone) is the production candidate once a GPU is in the loop, and
it reads the same YOLO-format datasets.

Licence honesty: the torchvision COCO-pretrained detection weights we start
from were themselves trained from ImageNet-initialised backbones, and
ImageNet's terms are research-only. Starting from them is common practice
and a grey area for a commercial product; ``--no-pretrained`` trains from
scratch (slower, needs more data) and removes the question. Both are
recorded in the checkpoint.

The checkpoint is a single .pt with everything needed to run it:
{"arch", "min_size", "max_size", "state_dict", "record"}.
"""

from __future__ import annotations

import json
import math
import random
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from fishai.lab.yolo import label_path_for, list_images, read_boxes
from fishai.log import get_logger

log = get_logger(__name__)

ARCHS = ("mobilenet_fpn", "mobilenet_320_fpn", "resnet50_fpn")


def build_model(arch: str = "mobilenet_fpn", pretrained: bool = True, min_size: int = 480, max_size: int = 864) -> Any:
    import torchvision
    from torchvision.models.detection import faster_rcnn

    num_classes = 2  # background + fish
    kw = {"min_size": min_size, "max_size": max_size}
    if arch == "mobilenet_fpn":
        w = torchvision.models.detection.FasterRCNN_MobileNet_V3_Large_FPN_Weights.DEFAULT if pretrained else None
        m = torchvision.models.detection.fasterrcnn_mobilenet_v3_large_fpn(weights=w, weights_backbone=None, **kw)
    elif arch == "mobilenet_320_fpn":
        w = torchvision.models.detection.FasterRCNN_MobileNet_V3_Large_320_FPN_Weights.DEFAULT if pretrained else None
        m = torchvision.models.detection.fasterrcnn_mobilenet_v3_large_320_fpn(weights=w, weights_backbone=None, **kw)
    elif arch == "resnet50_fpn":
        w = torchvision.models.detection.FasterRCNN_ResNet50_FPN_V2_Weights.DEFAULT if pretrained else None
        m = torchvision.models.detection.fasterrcnn_resnet50_fpn_v2(weights=w, weights_backbone=None, **kw)
    else:
        raise ValueError(f"arch must be one of {ARCHS}")
    in_features = m.roi_heads.box_predictor.cls_score.in_features
    m.roi_heads.box_predictor = faster_rcnn.FastRCNNPredictor(in_features, num_classes)
    return m


def load_checkpoint(path: str | Path, device: str = "cpu") -> tuple[Any, dict[str, Any]]:
    import torch

    ck = torch.load(str(path), map_location=device, weights_only=False)
    m = build_model(ck["arch"], pretrained=False, min_size=ck["min_size"], max_size=ck["max_size"])
    m.load_state_dict(ck["state_dict"])
    m.eval().to(device)
    return m, ck


# ------------------------------------------------------------------ data
class YoloDetectionDataset:
    """Images + YOLO labels -> (tensor CHW float 0..1, target dict) for torchvision."""

    def __init__(self, images: list[Path], augment: bool = False, seed: int = 0) -> None:
        self.images = images
        self.augment = augment
        self.rng = random.Random(seed)

    def __len__(self) -> int:
        return len(self.images)

    def __getitem__(self, i: int) -> tuple[Any, dict[str, Any]]:
        import torch

        p = self.images[i]
        img = cv2.imread(str(p))
        if img is None:
            raise FileNotFoundError(p)
        h, w = img.shape[:2]
        boxes = np.array(read_boxes(label_path_for(p), w, h), dtype=np.float32).reshape(-1, 4)
        if self.augment:
            if self.rng.random() < 0.5:
                img = img[:, ::-1].copy()
                boxes[:, [0, 2]] = w - boxes[:, [2, 0]]
            if self.rng.random() < 0.8:
                a = self.rng.uniform(0.7, 1.3)
                b = self.rng.uniform(-25, 25)
                img = np.clip(img.astype(np.float32) * a + b, 0, 255).astype(np.uint8)
            if self.rng.random() < 0.3:
                hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(np.int16)
                hsv[..., 0] = (hsv[..., 0] + self.rng.randint(-12, 12)) % 180
                img = cv2.cvtColor(np.clip(hsv, 0, 255).astype(np.uint8), cv2.COLOR_HSV2BGR)
            if self.rng.random() < 0.15:
                g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                img = cv2.cvtColor(g, cv2.COLOR_GRAY2BGR)
        keep = (boxes[:, 2] - boxes[:, 0] >= 2) & (boxes[:, 3] - boxes[:, 1] >= 2)
        boxes = boxes[keep]
        t = torch.from_numpy(cv2.cvtColor(img, cv2.COLOR_BGR2RGB)).permute(2, 0, 1).float() / 255.0
        target = {"boxes": torch.from_numpy(boxes).reshape(-1, 4), "labels": torch.ones((len(boxes),), dtype=torch.int64)}
        return t, target


def _collate(batch: list[Any]) -> tuple[list[Any], list[Any]]:
    return [b[0] for b in batch], [b[1] for b in batch]


# ----------------------------------------------------------------- train
@dataclass
class TrainConfig:
    arch: str = "mobilenet_fpn"
    pretrained: bool = True
    min_size: int = 480
    max_size: int = 864
    epochs: int = 10
    batch_size: int = 4
    lr: float = 0.01
    weight_decay: float = 1e-4
    max_minutes: float | None = None
    max_train_images: int | None = None
    eval_every_epochs: int = 1
    eval_confidence: float = 0.5
    seed: int = 0
    threads: int | None = None
    # Start from a previous checkpoint of ours (fine-tune) instead of the torchvision weights.
    init_from: str | None = None
    notes: list[str] = field(default_factory=list)


def _images_from(spec: str | Path, split: str) -> list[Path]:
    p = Path(spec)
    if p.suffix in (".yaml", ".yml"):
        import yaml

        d = yaml.safe_load(p.read_text(encoding="utf-8"))
        root = Path(d.get("path", p.parent))
        return list_images(root / d.get(split, "images"))
    if p.is_dir() and (p / f"{split}.txt").exists():
        return list_images(p / f"{split}.txt")
    return list_images(p)


def train(
    train_sets: list[str | Path],
    val_set: str | Path | None,
    out_path: Path,
    cfg: TrainConfig | None = None,
    extra_eval_sets: dict[str, str | Path] | None = None,
) -> dict[str, Any]:
    """Train on the union of ``train_sets`` (their train splits), select on ``val_set``."""
    import torch
    from torch.utils.data import DataLoader

    from fishai.lab.evaluate import evaluate_model

    cfg = cfg or TrainConfig()
    torch.manual_seed(cfg.seed)
    if cfg.threads:
        torch.set_num_threads(cfg.threads)
    images: list[Path] = []
    for s in train_sets:
        # "path*4" repeats a set four times per epoch: how a small real set is not drowned by synthetic ones.
        spec, _, rep = str(s).partition("*")
        images += _images_from(spec, "train") * (int(rep) if rep else 1)
    random.Random(cfg.seed).shuffle(images)
    if cfg.max_train_images:
        images = images[: cfg.max_train_images]
    val_images = _images_from(val_set, "val") if val_set else []
    device = "cuda" if torch.cuda.is_available() else "cpu"
    if cfg.init_from:
        model, ck = load_checkpoint(cfg.init_from, device)
        if ck["arch"] != cfg.arch:
            raise ValueError(f"--init {cfg.init_from} is {ck['arch']}, not {cfg.arch}")
        model.train()
    else:
        model = build_model(cfg.arch, cfg.pretrained, cfg.min_size, cfg.max_size).to(device)
    params = [p for p in model.parameters() if p.requires_grad]
    opt = torch.optim.SGD(params, lr=cfg.lr, momentum=0.9, weight_decay=cfg.weight_decay)
    steps_per_epoch = max(1, math.ceil(len(images) / cfg.batch_size))
    total_steps = steps_per_epoch * cfg.epochs
    warmup = min(200, total_steps // 10 + 1)

    def lr_at(step: int) -> float:
        if step < warmup:
            return cfg.lr * (0.1 + 0.9 * step / warmup)
        return cfg.lr * 0.5 * (1 + math.cos(math.pi * (step - warmup) / max(1, total_steps - warmup)))

    loader = DataLoader(YoloDetectionDataset(images, augment=True, seed=cfg.seed), batch_size=cfg.batch_size, shuffle=True, collate_fn=_collate, num_workers=0)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    history: list[dict[str, Any]] = []
    best: dict[str, Any] | None = None
    step = 0
    t0 = time.time()
    stopped_early = False
    for epoch in range(cfg.epochs):
        model.train()
        losses = []
        for imgs, targets in loader:
            for g in opt.param_groups:
                g["lr"] = lr_at(step)
            imgs = [i.to(device) for i in imgs]
            targets = [{k: v.to(device) for k, v in t.items()} for t in targets]
            loss_dict = model(imgs, targets)
            loss = sum(loss_dict.values())
            opt.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(params, 10.0)
            opt.step()
            losses.append(float(loss.detach()))
            step += 1
            if step % 50 == 0:
                log.info("epoch %d step %d/%d loss %.3f (%.1f min)", epoch + 1, step, total_steps, float(np.mean(losses[-50:])), (time.time() - t0) / 60)
            if cfg.max_minutes and (time.time() - t0) / 60 >= cfg.max_minutes:
                stopped_early = True
                break
        row: dict[str, Any] = {"epoch": epoch + 1, "loss": round(float(np.mean(losses)) if losses else 0.0, 4), "minutes": round((time.time() - t0) / 60, 1)}
        if val_images and ((epoch + 1) % cfg.eval_every_epochs == 0 or stopped_early or epoch == cfg.epochs - 1):
            model.eval()
            score = evaluate_model(model, val_images, device=device, min_confidence=cfg.eval_confidence)
            row["val"] = score
            if best is None or score["f1"] > best["val"]["f1"]:
                best = dict(row)
                _save(out_path, model, cfg, row, images, val_images, train_sets, val_set, history + [row])
        history.append(row)
        log.info("epoch %d: %s", epoch + 1, json.dumps(row))
        if stopped_early:
            break
    if best is None:  # no validation set: keep the last weights
        _save(out_path, model, cfg, history[-1], images, val_images, train_sets, val_set, history)
        best = history[-1]
    record = json.loads(out_path.with_suffix(".json").read_text(encoding="utf-8"))
    if extra_eval_sets:
        model, _ = load_checkpoint(out_path, device)
        record["eval"] = {name: evaluate_model(model, _images_from(spec, "val"), device=device, min_confidence=cfg.eval_confidence) for name, spec in extra_eval_sets.items()}
    record["history"] = history
    record["stopped_early_on_time_budget"] = stopped_early
    out_path.with_suffix(".json").write_text(json.dumps(record, indent=2), encoding="utf-8")
    return record


def _save(out_path: Path, model: Any, cfg: TrainConfig, row: dict[str, Any], images: list[Path], val_images: list[Path], train_sets: list[Any], val_set: Any, history: list[Any]) -> None:
    import torch

    record = {
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "framework": "torchvision Faster R-CNN (BSD-3); no Ultralytics",
        "start_weights": (f"our checkpoint {cfg.init_from}" if cfg.init_from else
                          "torchvision COCO detection weights (ImageNet-initialised backbone: research-only terms, see trainer.py)" if cfg.pretrained else "none (trained from scratch)"),
        "config": asdict(cfg), "train_sets": [str(s) for s in train_sets], "val_set": str(val_set) if val_set else None,
        "train_images": len(images), "val_images": len(val_images), "selected": row, "history": history,
    }
    torch.save({"arch": cfg.arch, "min_size": cfg.min_size, "max_size": cfg.max_size, "state_dict": model.state_dict(), "record": record}, str(out_path))
    out_path.with_suffix(".json").write_text(json.dumps(record, indent=2, default=str), encoding="utf-8")
