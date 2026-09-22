"""Fish sprites: RGBA cut-outs a renderer can place anywhere.

Two sources, both labelled in the sprite's metadata so a dataset can say
what it was built from:

real        fish cut out of real footage. The bootstrap detector finds a
            confident box, GrabCut separates the fish from the water inside
            it, and the result is kept only if the mask looks like a fish
            (fills a sensible share of the box, is one main blob, does not
            touch the crop edge much). Licensed clips only; the cut-outs
            are derived from them and are NOT committed.
procedural  drawn fish: body ellipse, tail, fins, stripes / spots / bars in
            random colours. Unlimited, perfectly masked, and the only way to
            make as many look-alikes as identity training wants.
"""

from __future__ import annotations

import json
import random
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from fishai.log import get_logger

log = get_logger(__name__)


@dataclass
class Sprite:
    rgba: np.ndarray  # HxWx4 uint8, fish facing RIGHT
    source: str  # "real" | "procedural"
    origin: str = ""  # clip name / generator seed
    species_hint: str = ""
    # Stable identity for look-alike groups (procedural): same group = same appearance family.
    group: str = ""

    @property
    def aspect(self) -> float:
        return self.rgba.shape[1] / max(1, self.rgba.shape[0])


# --------------------------------------------------------------- procedural
def procedural_fish(rng: random.Random, length_px: int = 160, palette: tuple[int, int, int] | None = None, pattern: str | None = None) -> Sprite:
    L = length_px
    H = int(L * rng.uniform(0.28, 0.55))
    pad = int(L * 0.12)
    w, h = L + 2 * pad, H + 2 * pad + int(H * 0.5)
    img = np.zeros((h, w, 3), np.uint8)
    mask = np.zeros((h, w), np.uint8)
    cx, cy = pad + int(L * 0.45), h // 2
    body_ax = (int(L * 0.42), H // 2)
    base = palette or tuple(int(v) for v in rng.choice([(40, 90, 230), (230, 160, 30), (60, 200, 90), (200, 60, 200), (30, 200, 230), (200, 200, 200), (40, 40, 40), (20, 120, 240), (180, 60, 40)]))
    darker = tuple(max(0, int(v * 0.55)) for v in base)
    lighter = tuple(min(255, int(v * 1.25 + 30)) for v in base)
    # tail (left side; fish faces right)
    tx = cx - body_ax[0]
    tail = np.array([[tx + 4, cy], [tx - int(L * 0.18), cy - int(H * 0.55)], [tx - int(L * 0.12), cy], [tx - int(L * 0.18), cy + int(H * 0.55)]], np.int32)
    for m, col in ((mask, 255), (img, darker)):
        cv2.fillPoly(m, [tail], col)
    # dorsal / anal fins
    for sign in (-1, 1):
        fin = np.array([[cx - int(L * 0.15), cy + sign * (H // 2 - 2)], [cx + int(L * 0.05), cy + sign * (H // 2 + int(H * rng.uniform(0.15, 0.45)))], [cx + int(L * 0.12), cy + sign * (H // 2 - 2)]], np.int32)
        cv2.fillPoly(mask, [fin], 255)
        cv2.fillPoly(img, [fin], darker)
    cv2.ellipse(mask, (cx, cy), body_ax, 0, 0, 360, 255, -1)
    cv2.ellipse(img, (cx, cy), body_ax, 0, 0, 360, base, -1)
    # belly highlight
    cv2.ellipse(img, (cx, cy + H // 6), (int(body_ax[0] * 0.8), H // 5), 0, 0, 180, lighter, -1)
    pattern = pattern or rng.choice(["plain", "stripe", "bars", "spots", "neon"])
    body_mask = np.zeros_like(mask)
    cv2.ellipse(body_mask, (cx, cy), body_ax, 0, 0, 360, 255, -1)
    pat = img.copy()
    if pattern == "stripe":
        cv2.line(pat, (cx - body_ax[0], cy), (cx + body_ax[0], cy - H // 10), darker, max(2, H // 7))
    elif pattern == "neon":
        cv2.line(pat, (cx - body_ax[0] + 5, cy - H // 8), (cx + body_ax[0] - 5, cy - H // 8), (255, 230, 60), max(2, H // 9))
        cv2.rectangle(pat, (cx - body_ax[0], cy), (cx + body_ax[0] // 3, cy + H // 2), (40, 40, 220), -1)
    elif pattern == "bars":
        for k in range(rng.randint(3, 5)):
            x = cx - body_ax[0] + int((k + 1) * 2 * body_ax[0] / 6)
            cv2.line(pat, (x, cy - H), (x, cy + H), darker, max(2, L // 25))
    elif pattern == "spots":
        for _ in range(rng.randint(6, 18)):
            cv2.circle(pat, (rng.randint(cx - body_ax[0], cx + body_ax[0]), rng.randint(cy - H // 2, cy + H // 2)), max(1, L // 40), darker, -1)
    img = np.where(body_mask[..., None] > 0, pat, img)
    # eye
    ex = cx + int(body_ax[0] * 0.65)
    cv2.circle(img, (ex, cy - H // 8), max(2, L // 30), (250, 250, 250), -1)
    cv2.circle(img, (ex, cy - H // 8), max(1, L // 55), (10, 10, 10), -1)
    img = cv2.GaussianBlur(img, (3, 3), 0)
    mask = cv2.GaussianBlur(mask, (3, 3), 0)
    ys, xs = np.where(mask > 20)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgba = np.dstack([img, mask])[y0:y1, x0:x1].copy()
    return Sprite(rgba, "procedural", origin=f"pattern={pattern}", group=f"{pattern}:{base}")


def lookalike_group(rng: random.Random, n: int, length_px: int = 160) -> list[Sprite]:
    """``n`` fish of one species: same palette and pattern, tiny individual variation.

    This is what identity training needs and real footage rarely gives with labels.
    """
    palette = tuple(int(v) for v in rng.choice([(40, 90, 230), (230, 160, 30), (30, 200, 230), (200, 200, 200)]))
    pattern = rng.choice(["stripe", "neon", "bars", "spots"])
    out = []
    for i in range(n):
        jitter = tuple(int(np.clip(v + rng.randint(-12, 12), 0, 255)) for v in palette)
        s = procedural_fish(random.Random(rng.random()), length_px, jitter, pattern)
        s.group = f"lookalike:{pattern}:{palette}"
        s.origin += f";individual={i}"
        out.append(s)
    return out


# ------------------------------------------------------------------- real
def cut_out(image: np.ndarray, box: tuple[float, float, float, float], margin: float = 0.08, iterations: int = 4) -> np.ndarray | None:
    """GrabCut the fish inside ``box``; returns RGBA cropped to the fish, or None if it does not look like one."""
    h, w = image.shape[:2]
    x1, y1, x2, y2 = box
    bw, bh = x2 - x1, y2 - y1
    if bw < 24 or bh < 12:
        return None
    mx, my = bw * margin, bh * margin
    cx1, cy1 = int(max(0, x1 - mx * 3)), int(max(0, y1 - my * 3))
    cx2, cy2 = int(min(w, x2 + mx * 3)), int(min(h, y2 + my * 3))
    crop = image[cy1:cy2, cx1:cx2].copy()
    if crop.size == 0:
        return None
    rect = (int(x1 - cx1 + 1), int(y1 - cy1 + 1), max(2, int(bw - 2)), max(2, int(bh - 2)))
    mask = np.zeros(crop.shape[:2], np.uint8)
    bgd, fgd = np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64)
    try:
        cv2.grabCut(crop, mask, rect, bgd, fgd, iterations, cv2.GC_INIT_WITH_RECT)
    except cv2.error:
        return None
    fg = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    n, labels, stats, _ = cv2.connectedComponentsWithStats(fg)
    if n < 2:
        return None
    main = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    fg = np.where(labels == main, 255, 0).astype(np.uint8)
    area = float(fg.sum() / 255)
    fill = area / max(1.0, bw * bh)
    if not 0.25 <= fill <= 0.9:
        return None
    ys, xs = np.where(fg > 0)
    y0, y1_, x0, x1_ = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    edge = (fg[0].sum() + fg[-1].sum() + fg[:, 0].sum() + fg[:, -1].sum()) / 255
    if edge > 0.15 * (2 * fg.shape[0] + 2 * fg.shape[1]):
        return None  # the "fish" runs off the crop: probably background
    alpha = cv2.GaussianBlur(fg, (3, 3), 0)
    return np.dstack([crop, alpha])[y0:y1_, x0:x1_].copy()


def harvest_from_video(
    path: Path,
    detector: Any,
    out_dir: Path,
    min_confidence: float = 0.75,
    every_n: int = 10,
    max_sprites: int = 60,
    max_frames: int = 600,
) -> list[Path]:
    """Run the bootstrap detector over a clip and save confident fish as RGBA PNGs."""
    from fishai.types import Frame

    out_dir.mkdir(parents=True, exist_ok=True)
    cap = cv2.VideoCapture(str(path))
    saved: list[Path] = []
    idx = 0
    while len(saved) < max_sprites and idx < max_frames:
        ok, img = cap.read()
        if not ok:
            break
        if idx % every_n == 0:
            for d in detector.detect(Frame(idx, 0.0, img)):
                if d.confidence < min_confidence:
                    continue
                rgba = cut_out(img, d.bbox.as_tuple())
                if rgba is None:
                    continue
                # Orient facing right is unknown for real fish; keep as seen, the renderer flips randomly.
                p = out_dir / f"{path.stem}_{idx:05d}_{len(saved):03d}.png"
                cv2.imwrite(str(p), rgba)
                meta = {"source": "real", "origin": path.name, "frame": idx, "confidence": round(d.confidence, 3), "box": [round(v, 1) for v in d.bbox.as_tuple()]}
                p.with_suffix(".json").write_text(json.dumps(meta), encoding="utf-8")
                saved.append(p)
                if len(saved) >= max_sprites:
                    break
        idx += 1
    cap.release()
    log.info("%s: %d sprites", path.name, len(saved))
    return saved


def is_truncated(rgba: np.ndarray, max_edge_fill: float = 0.4) -> bool:
    """True when the fish runs straight into a border of its cut-out (it was cut by the video frame)."""
    a = rgba[..., 3] > 127
    edges = (a[0].mean(), a[-1].mean(), a[:, 0].mean(), a[:, -1].mean())
    return max(edges) > max_edge_fill


def load_sprites(directory: Path, exclude_origins: set[str] | None = None, drop_truncated: bool = True) -> list[Sprite]:
    out = []
    for p in sorted(directory.glob("*.png")):
        rgba = cv2.imread(str(p), cv2.IMREAD_UNCHANGED)
        if rgba is None or rgba.ndim != 3 or rgba.shape[2] != 4:
            continue
        if drop_truncated and is_truncated(rgba):
            continue
        meta = {}
        if p.with_suffix(".json").exists():
            meta = json.loads(p.with_suffix(".json").read_text(encoding="utf-8"))
        origin = meta.get("origin", p.name)
        if exclude_origins and any(x in origin for x in exclude_origins):
            continue
        out.append(Sprite(rgba, meta.get("source", "real"), origin, group=f"real:{p.stem}"))
    return out


def sprite_meta(s: Sprite) -> dict[str, Any]:
    d = asdict(s)
    d.pop("rgba")
    d["size"] = list(s.rgba.shape[:2])
    return d


