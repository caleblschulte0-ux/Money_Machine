"""Link per-video track ids to long-term fish ids (Phase 2, first rung).

Method: each track's appearance descriptor (mean HSV histogram over its
observations) is matched to the registry of known fish by histogram
intersection. Hungarian assignment when scipy is present, greedy
otherwise; one fish per track and one track per fish within a video.
A match below ``min_similarity`` registers a NEW fish. The similarity is
stored as the link's confidence, so a report can say "Fish 3 (0.71)".

Known limits (documented, not hidden): fish of the same species and
colour cannot be told apart by this; lighting changes shift histograms;
a fish that grows changes little in colour, so this degrades slowly.
"""

from __future__ import annotations

from typing import Any

import numpy as np

from fishai.perception.tracking import appearance
from fishai.storage.db import Database


def _assign(sim: np.ndarray, threshold: float) -> list[tuple[int, int]]:
    if sim.size == 0:
        return []
    try:
        from scipy.optimize import linear_sum_assignment

        rows, cols = linear_sum_assignment(-sim)
        return [(int(r), int(c)) for r, c in zip(rows, cols, strict=True) if sim[r, c] >= threshold]
    except ImportError:
        pairs, used_r, used_c = [], set(), set()
        for r, c in np.dstack(np.unravel_index(np.argsort(-sim, axis=None), sim.shape))[0]:
            if sim[r, c] < threshold:
                break
            if r in used_r or c in used_c:
                continue
            pairs.append((int(r), int(c)))
            used_r.add(int(r))
            used_c.add(int(c))
        return pairs


def link_tracks_to_fish(
    db: Database,
    video_id: str,
    descriptors: dict[int, np.ndarray],
    min_similarity: float = 0.55,
    min_observations: dict[int, int] | None = None,
    min_track_observations: int = 5,
    spans: dict[int, tuple[float, float]] | None = None,
) -> dict[int, dict[str, Any]]:
    """Return {track_id: {"fish_id", "confidence", "new"}} and persist it.

    ``spans`` (track_id -> (first_ts, last_ts)) lets two tracks from the SAME
    video that never coexist be linked to one fish: a track that fragments
    when the tracker loses a fish would otherwise register a new fish each
    time. Tracks that overlap in time are never merged.
    """
    tracks = [t for t, d in sorted(descriptors.items()) if d is not None and (min_observations or {}).get(t, min_track_observations) >= min_track_observations]
    known = db.list_fish()
    result: dict[int, dict[str, Any]] = {}
    if tracks and known:
        sim = np.zeros((len(tracks), len(known)), dtype=np.float32)
        for i, t in enumerate(tracks):
            for j, f in enumerate(known):
                sim[i, j] = appearance.similarity(descriptors[t], np.asarray(f["descriptor"], dtype=np.float32))
        pairs = _assign(sim, min_similarity)
    else:
        pairs = []
    matched = {}
    for i, j in pairs:
        t, f = tracks[i], known[j]
        conf = float(sim[i, j])
        blended = appearance.blend(np.asarray(f["descriptor"], dtype=np.float32), descriptors[t], alpha=0.2)
        db.update_fish(f["fish_id"], descriptor=[float(x) for x in blended], seen=True)
        db.set_identity(video_id, t, f["fish_id"], conf, "hsv_histogram")
        result[t] = {"fish_id": f["fish_id"], "confidence": conf, "new": False}
        matched[t] = True
    # Tracks this video already assigned (known or new) with their time spans,
    # so a later fragment can join an earlier one when they never coexist.
    assigned: dict[int, list[tuple[int, np.ndarray]]] = {}  # fish_id -> [(track, descriptor)]
    for t, r in result.items():
        assigned.setdefault(r["fish_id"], []).append((t, descriptors[t]))
    for t in tracks:
        if t in matched:
            continue
        best: tuple[float, int] | None = None
        if spans and t in spans:
            for fish_id, members in assigned.items():
                if any(_overlaps(spans[t], spans.get(m, spans[t])) for m, _ in members):
                    continue
                sim = max(appearance.similarity(descriptors[t], d) for _, d in members)
                if sim >= min_similarity and (best is None or sim > best[0]):
                    best = (sim, fish_id)
        if best is not None:
            sim, fish_id = best
            db.set_identity(video_id, t, fish_id, sim, "hsv_histogram:fragment")
            result[t] = {"fish_id": fish_id, "confidence": sim, "new": False}
        else:
            fish_id = db.add_fish([float(x) for x in descriptors[t]])
            db.set_identity(video_id, t, fish_id, 1.0, "hsv_histogram:new")
            result[t] = {"fish_id": fish_id, "confidence": 1.0, "new": True}
        assigned.setdefault(fish_id, []).append((t, descriptors[t]))
    return result


def _overlaps(a: tuple[float, float], b: tuple[float, float]) -> bool:
    return a[0] <= b[1] and b[0] <= a[1]
