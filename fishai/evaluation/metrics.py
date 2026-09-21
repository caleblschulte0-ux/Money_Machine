"""Detection precision/recall and tracking identity metrics.

Ground truth is ``{frame_index: {gt_id: BBox}}`` (what ``SyntheticAquarium``
produces, and what a labelled clip exports to). Predictions are
``{frame_index: [(track_id, BBox)]}``.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from fishai.types import BBox


@dataclass
class DetectionScore:
    tp: int = 0
    fp: int = 0
    fn: int = 0
    mean_iou: float = 0.0

    @property
    def precision(self) -> float:
        return self.tp / (self.tp + self.fp) if self.tp + self.fp else 0.0

    @property
    def recall(self) -> float:
        return self.tp / (self.tp + self.fn) if self.tp + self.fn else 0.0

    @property
    def f1(self) -> float:
        p, r = self.precision, self.recall
        return 2 * p * r / (p + r) if p + r else 0.0

    def to_dict(self) -> dict[str, float]:
        return {"tp": self.tp, "fp": self.fp, "fn": self.fn, "precision": self.precision, "recall": self.recall, "f1": self.f1, "mean_iou": self.mean_iou}


@dataclass
class TrackingScore:
    """How well predicted ids preserve ground-truth identity.

    ``id_switches`` counts frames where a ground-truth fish is matched to a
    different predicted id than on its previous matched frame.
    ``fragments`` is the number of distinct predicted ids per ground-truth
    fish (1.0 is perfect). ``purity`` is the fraction of each predicted id's
    matches that belong to its majority ground-truth fish.
    """

    id_switches: int = 0
    matched_frames: int = 0
    gt_ids: int = 0
    pred_ids: int = 0
    fragments_per_gt: float = 0.0
    purity: float = 0.0
    detail: dict[int, list[int]] = field(default_factory=dict)

    def to_dict(self) -> dict[str, float]:
        return {
            "id_switches": self.id_switches, "matched_frames": self.matched_frames, "gt_ids": self.gt_ids,
            "pred_ids": self.pred_ids, "fragments_per_gt": self.fragments_per_gt, "purity": self.purity,
        }


def _match_frame(gt: dict[int, BBox], pred: list[tuple[int, BBox]], iou_threshold: float) -> list[tuple[int, int, float]]:
    """Greedy IoU matching within one frame -> [(gt_id, track_id, iou)]."""
    cands = sorted(
        ((g.iou(p), gid, tid) for gid, g in gt.items() for tid, p in pred),
        reverse=True,
    )
    used_g: set[int] = set()
    used_t: set[int] = set()
    out = []
    for iou, gid, tid in cands:
        if iou < iou_threshold:
            break
        if gid in used_g or tid in used_t:
            continue
        out.append((gid, tid, iou))
        used_g.add(gid)
        used_t.add(tid)
    return out


def score_detections(truth: dict[int, dict[int, BBox]], preds: dict[int, list[tuple[int, BBox]]], iou_threshold: float = 0.4) -> DetectionScore:
    score = DetectionScore()
    ious: list[float] = []
    for frame, gt in truth.items():
        pred = preds.get(frame, [])
        matches = _match_frame(gt, pred, iou_threshold)
        score.tp += len(matches)
        score.fp += len(pred) - len(matches)
        score.fn += len(gt) - len(matches)
        ious.extend(m[2] for m in matches)
    score.mean_iou = sum(ious) / len(ious) if ious else 0.0
    return score


def score_tracking(truth: dict[int, dict[int, BBox]], preds: dict[int, list[tuple[int, BBox]]], iou_threshold: float = 0.4) -> TrackingScore:
    last_tid: dict[int, int] = {}
    ids_per_gt: dict[int, list[int]] = {}
    votes: dict[int, dict[int, int]] = {}
    score = TrackingScore()
    for frame in sorted(truth):
        for gid, tid, _ in _match_frame(truth[frame], preds.get(frame, []), iou_threshold):
            score.matched_frames += 1
            if gid in last_tid and last_tid[gid] != tid:
                score.id_switches += 1
            last_tid[gid] = tid
            ids = ids_per_gt.setdefault(gid, [])
            if tid not in ids:
                ids.append(tid)
            votes.setdefault(tid, {}).setdefault(gid, 0)
            votes[tid][gid] += 1
    score.gt_ids = len({g for gt in truth.values() for g in gt})
    score.pred_ids = len({t for p in preds.values() for t, _ in p})
    score.fragments_per_gt = (sum(len(v) for v in ids_per_gt.values()) / len(ids_per_gt)) if ids_per_gt else 0.0
    total = sum(sum(v.values()) for v in votes.values())
    score.purity = (sum(max(v.values()) for v in votes.values()) / total) if total else 0.0
    score.detail = ids_per_gt
    return score
