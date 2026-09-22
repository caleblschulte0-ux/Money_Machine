"""Link per-video track ids to long-term fish ids (Phase 2, first rung).

Method: each track's appearance descriptors (mean HSV histogram over its
observations, kept separately per "<camera_id>/<lighting_mode>") are
matched to the registry of known fish by histogram intersection under the
SAME key only: a day histogram is never compared with an infrared one, and
one camera's view is never compared with another's. A track that lives
through dusk carries both a day and a night descriptor, and that is what
links a fish's two identities. Hungarian assignment when scipy is present, greedy
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


Descriptors = dict[str, np.ndarray]


def descriptor_similarity(a: Descriptors, b: Descriptors) -> float:
    """Best similarity over the keys both sides have; 0 when they share none."""
    shared = set(a) & set(b)
    return max((appearance.similarity(a[k], b[k]) for k in shared), default=0.0)


def _as_lists(d: Descriptors) -> dict[str, list[float]]:
    return {k: [float(x) for x in v] for k, v in d.items() if v is not None}


def _fish_descriptors(f: dict[str, Any]) -> Descriptors:
    return {k: np.asarray(v, dtype=np.float32) for k, v in f["descriptors"].items()}


def link_tracks_to_fish(
    db: Database,
    video_id: str,
    descriptors: dict[int, Descriptors],
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
    tracks = [
        t for t, d in sorted(descriptors.items())
        if d and any(v is not None for v in d.values()) and (min_observations or {}).get(t, min_track_observations) >= min_track_observations
    ]
    known = db.list_fish()
    known_desc = [_fish_descriptors(f) for f in known]
    result: dict[int, dict[str, Any]] = {}
    if tracks and known:
        sim = np.zeros((len(tracks), len(known)), dtype=np.float32)
        for i, t in enumerate(tracks):
            for j, kd in enumerate(known_desc):
                sim[i, j] = descriptor_similarity(descriptors[t], kd)
        pairs = _assign(sim, min_similarity)
    else:
        pairs = []
    matched = {}
    for i, j in pairs:
        t, f = tracks[i], known[j]
        conf = float(sim[i, j])
        merged: Descriptors = dict(known_desc[j])
        for key, d in descriptors[t].items():
            merged[key] = appearance.blend(merged.get(key), d, alpha=0.2) if key in merged else d
        db.update_fish(f["fish_id"], descriptors=_as_lists(merged), seen=True)
        db.set_identity(video_id, t, f["fish_id"], conf, "hsv_histogram")
        result[t] = {"fish_id": f["fish_id"], "confidence": conf, "new": False}
        matched[t] = True
    # Tracks this video already assigned (known or new) with their time spans,
    # so a later fragment can join an earlier one when they never coexist.
    assigned: dict[int, list[tuple[int, Descriptors]]] = {}  # fish_id -> [(track, descriptors)]
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
                sim = max(descriptor_similarity(descriptors[t], d) for _, d in members)
                if sim >= min_similarity and (best is None or sim > best[0]):
                    best = (sim, fish_id)
        if best is not None:
            sim, fish_id = best
            db.set_identity(video_id, t, fish_id, sim, "hsv_histogram:fragment")
            db.update_fish(fish_id, descriptors=_as_lists(descriptors[t]))
            result[t] = {"fish_id": fish_id, "confidence": sim, "new": False}
        else:
            fish_id = db.add_fish(_as_lists(descriptors[t]))
            db.set_identity(video_id, t, fish_id, 1.0, "hsv_histogram:new")
            result[t] = {"fish_id": fish_id, "confidence": 1.0, "new": True}
        assigned.setdefault(fish_id, []).append((t, descriptors[t]))
    return result


def _overlaps(a: tuple[float, float], b: tuple[float, float]) -> bool:
    return a[0] <= b[1] and b[0] <= a[1]
