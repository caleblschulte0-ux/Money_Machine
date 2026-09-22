"""Backgrounds ("plates"): what the tank looks like with no fish in it.

real        temporal median of a real clip: moving fish vanish, the tank,
            plants and substrate stay. Frames where the median still holds a
            fish (a fish that sat still) are rejected by comparing the median
            with a second median over a different time window.
procedural  a water gradient, a substrate band, a back wall, plants as
            layered stalks and leaves. Plants are also returned as separate
            RGBA occluders so the renderer can put some in FRONT of fish.
"""

from __future__ import annotations

import random
from pathlib import Path

import cv2
import numpy as np

from fishai.log import get_logger

log = get_logger(__name__)


def plate_from_video(path: Path, size: tuple[int, int] = (640, 360), samples: int = 40, max_frames: int = 900) -> np.ndarray | None:
    cap = cv2.VideoCapture(str(path))
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or max_frames
    n = min(n, max_frames)
    if n < 10:
        cap.release()
        return None
    idx = np.linspace(0, n - 1, samples).astype(int)
    frames = []
    for i in idx:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(i))
        ok, img = cap.read()
        if ok:
            frames.append(cv2.resize(img, size, interpolation=cv2.INTER_AREA))
    cap.release()
    if len(frames) < 10:
        return None
    a = np.median(np.stack(frames[::2]), axis=0)
    b = np.median(np.stack(frames[1::2]), axis=0)
    if float(np.abs(a - b).mean()) > 12.0:
        log.info("%s: scene is not static enough for a plate (camera moves?)", path.name)
        return None
    return np.median(np.stack(frames), axis=0).astype(np.uint8)


def clean_plate(plate: np.ndarray, detector: object, min_confidence: float = 0.25, pad: float = 0.15) -> tuple[np.ndarray, int]:
    """Paint out any fish the bootstrap detector still finds in a plate (a fish that sat still).

    An unlabelled fish left in a background would teach the detector that fish
    are background. Returns (clean plate, number of fish removed).
    """
    from fishai.types import Frame

    dets = [d for d in detector.detect(Frame(0, 0.0, plate)) if d.confidence >= min_confidence]  # type: ignore[attr-defined]
    if not dets:
        return plate, 0
    mask = np.zeros(plate.shape[:2], np.uint8)
    for d in dets:
        x1, y1, x2, y2 = d.bbox.as_tuple()
        px, py = (x2 - x1) * pad, (y2 - y1) * pad
        cv2.rectangle(mask, (int(x1 - px), int(y1 - py)), (int(x2 + px), int(y2 + py)), 255, -1)
    return cv2.inpaint(plate, mask, 7, cv2.INPAINT_TELEA), len(dets)


def procedural_plate(rng: random.Random, size: tuple[int, int] = (640, 360)) -> np.ndarray:
    w, h = size
    top = np.array([rng.uniform(60, 140), rng.uniform(80, 150), rng.uniform(20, 90)])  # BGR: blue-green water
    bottom = top * rng.uniform(0.35, 0.7)
    t = np.linspace(0, 1, h)[:, None, None]
    img = (top * (1 - t) + bottom * t).repeat(w, axis=1).astype(np.float32)
    # back wall texture
    noise = cv2.GaussianBlur(np.random.default_rng(rng.randint(0, 1 << 30)).normal(0, 1, (h, w)).astype(np.float32), (0, 0), 12)
    img += noise[..., None] * rng.uniform(4, 14)
    # substrate
    sub_y = int(h * rng.uniform(0.72, 0.92))
    gravel = np.random.default_rng(rng.randint(0, 1 << 30)).integers(0, 60, (h - sub_y, w, 1)).astype(np.float32)
    base = np.array([rng.uniform(40, 120), rng.uniform(60, 140), rng.uniform(80, 170)], np.float32)
    img[sub_y:] = base * 0.7 + gravel
    img = np.clip(img, 0, 255).astype(np.uint8)
    for _ in range(rng.randint(2, 7)):
        draw_plant(img, rng, (w, h), sub_y)
    return img


def draw_plant(img: np.ndarray, rng: random.Random, size: tuple[int, int], base_y: int, alpha_out: np.ndarray | None = None) -> None:
    w, h = size
    x = rng.randint(0, w)
    colour = (int(rng.uniform(20, 60)), int(rng.uniform(90, 180)), int(rng.uniform(20, 70)))
    height = rng.uniform(0.3, 0.8) * h
    for _ in range(rng.randint(3, 9)):
        pts = []
        px, py = x + rng.randint(-15, 15), base_y
        for _ in range(8):
            px += rng.randint(-8, 8)
            py -= int(height / 8)
            pts.append((px, py))
        pts_a = np.array([(x, base_y)] + pts, np.int32)
        cv2.polylines(img, [pts_a], False, colour, rng.randint(2, 5))
        if alpha_out is not None:
            cv2.polylines(alpha_out, [pts_a], False, 255, rng.randint(2, 5))
        for (lx, ly) in pts[1::2]:
            ax = (rng.randint(5, 14), rng.randint(2, 5))
            ang = rng.randint(-40, 40)
            cv2.ellipse(img, (lx, ly), ax, ang, 0, 360, colour, -1)
            if alpha_out is not None:
                cv2.ellipse(alpha_out, (lx, ly), ax, ang, 0, 360, 255, -1)


def foreground_plants(rng: random.Random, size: tuple[int, int], n: int) -> np.ndarray:
    """RGBA layer of plants to composite IN FRONT of some fish."""
    w, h = size
    rgb = np.zeros((h, w, 3), np.uint8)
    alpha = np.zeros((h, w), np.uint8)
    for _ in range(n):
        draw_plant(rgb, rng, size, h + 5, alpha)
    return np.dstack([rgb, alpha])


def save_plate(img: np.ndarray, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(path), img)


def load_plates(directory: Path, size: tuple[int, int] | None = None) -> list[np.ndarray]:
    out = []
    for p in sorted(directory.glob("*.png")) + sorted(directory.glob("*.jpg")):
        img = cv2.imread(str(p))
        if img is not None:
            out.append(cv2.resize(img, size) if size else img)
    return out
