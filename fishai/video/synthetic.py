"""A synthetic aquarium: coloured fish-shaped blobs moving over a static background.

Used by the test-suite (ground truth is known, so detection and tracking can
be scored exactly) and by ``fishai demo`` so the whole pipeline can be shown
working on a machine that has no aquarium video and no model weights yet.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np

from fishai.types import BBox
from fishai.video.writer import VideoWriter


@dataclass
class SyntheticFish:
    fish_id: int
    x: float
    y: float
    vx: float
    vy: float
    length: float
    height: float
    color: tuple[int, int, int]
    # Fraction of time this fish prefers to spend near the surface / bottom.
    surface_bias: float = 0.0
    bottom_bias: float = 0.0
    # Frames during which the fish is hidden (e.g. behind a plant).
    hidden_frames: set[int] = field(default_factory=set)

    def bbox(self) -> BBox:
        return BBox(self.x - self.length / 2, self.y - self.height / 2, self.x + self.length / 2, self.y + self.height / 2)


class SyntheticAquarium:
    """Generates frames plus ground-truth boxes per frame.

    Movement is a smooth random walk with soft walls, so trajectories look
    like fish drifting rather than billiard balls.
    """

    def __init__(
        self,
        width: int = 640,
        height: int = 360,
        n_fish: int = 3,
        fps: float = 20.0,
        seed: int = 7,
        speed_scale: float = 1.0,
        hide_fish: int | None = None,
        hide_between: tuple[int, int] | None = None,
    ) -> None:
        self.width, self.height, self.fps = width, height, fps
        self.rng = random.Random(seed)
        self.frame_index = 0
        self.fish: list[SyntheticFish] = []
        palette = [(40, 90, 230), (230, 160, 30), (60, 200, 90), (200, 60, 200), (30, 200, 230)]
        for i in range(n_fish):
            f = SyntheticFish(
                fish_id=i + 1,
                x=self.rng.uniform(width * 0.2, width * 0.8),
                y=self.rng.uniform(height * 0.2, height * 0.8),
                vx=self.rng.uniform(-2.5, 2.5) * speed_scale,
                vy=self.rng.uniform(-1.0, 1.0) * speed_scale,
                length=self.rng.uniform(40, 70),
                height=self.rng.uniform(18, 30),
                color=palette[i % len(palette)],
            )
            self.fish.append(f)
        if hide_fish is not None and hide_between is not None:
            a, b = hide_between
            self.fish[hide_fish - 1].hidden_frames = set(range(a, b))
        self.speed_scale = speed_scale
        self._background = self._make_background()

    def _make_background(self) -> np.ndarray:
        bg = np.zeros((self.height, self.width, 3), dtype=np.uint8)
        # Water gradient: darker at the bottom.
        for y in range(self.height):
            t = y / max(1, self.height - 1)
            bg[y, :] = (int(90 - 40 * t), int(70 - 30 * t), int(30 - 10 * t))
        # Gravel strip.
        cv2.rectangle(bg, (0, int(self.height * 0.92)), (self.width, self.height), (60, 80, 100), -1)
        return bg

    def step(self) -> tuple[np.ndarray, dict[int, BBox]]:
        """Advance one frame. Returns (image, {fish_id: bbox}) for visible fish."""
        img = self._background.copy()
        truth: dict[int, BBox] = {}
        self._repel()
        for f in self.fish:
            f.vx += self.rng.uniform(-0.4, 0.4) * self.speed_scale
            f.vy += self.rng.uniform(-0.3, 0.3) * self.speed_scale
            f.vy += (f.bottom_bias - f.surface_bias) * 0.05
            vmax = 4.0 * self.speed_scale
            f.vx = max(-vmax, min(vmax, f.vx))
            f.vy = max(-vmax * 0.6, min(vmax * 0.6, f.vy))
            f.x += f.vx
            f.y += f.vy
            margin_x, margin_y = f.length, f.height
            if f.x < margin_x:
                f.x, f.vx = margin_x, abs(f.vx)
            if f.x > self.width - margin_x:
                f.x, f.vx = self.width - margin_x, -abs(f.vx)
            if f.y < margin_y:
                f.y, f.vy = margin_y, abs(f.vy)
            if f.y > self.height * 0.9 - margin_y:
                f.y, f.vy = self.height * 0.9 - margin_y, -abs(f.vy)
            if self.frame_index in f.hidden_frames:
                continue
            self._draw_fish(img, f)
            truth[f.fish_id] = f.bbox()
        self.frame_index += 1
        return img, truth

    def _repel(self) -> None:
        """Nudge fish apart so ground-truth boxes rarely overlap (real fish avoid each other too)."""
        for i, a in enumerate(self.fish):
            for b in self.fish[i + 1 :]:
                dx, dy = b.x - a.x, b.y - a.y
                dist = max(1e-6, (dx * dx + dy * dy) ** 0.5)
                min_dist = (a.length + b.length) / 2 + 6
                if dist < min_dist:
                    push = (min_dist - dist) / 2
                    ux, uy = dx / dist, dy / dist
                    a.x -= ux * push
                    a.y -= uy * push
                    b.x += ux * push
                    b.y += uy * push
                    a.vx, b.vx = a.vx - ux * 0.5, b.vx + ux * 0.5

    def _draw_fish(self, img: np.ndarray, f: SyntheticFish) -> None:
        cx, cy = int(f.x), int(f.y)
        cv2.ellipse(img, (cx, cy), (int(f.length / 2), int(f.height / 2)), 0, 0, 360, f.color, -1)
        # Tail on the side opposite to travel direction.
        d = -1 if f.vx >= 0 else 1
        tail_x = int(cx + d * f.length / 2)
        pts = np.array(
            [[tail_x, cy], [tail_x + d * int(f.height * 0.6), cy - int(f.height * 0.6)], [tail_x + d * int(f.height * 0.6), cy + int(f.height * 0.6)]],
            dtype=np.int32,
        )
        cv2.fillPoly(img, [pts], f.color)
        eye_x = int(cx - d * f.length * 0.3)
        cv2.circle(img, (eye_x, cy - int(f.height * 0.15)), 2, (255, 255, 255), -1)

    def write(self, path: str | Path, n_frames: int) -> dict[int, dict[int, BBox]]:
        """Write ``n_frames`` to ``path``. Returns ground truth {frame_index: {fish_id: bbox}}."""
        truth: dict[int, dict[int, BBox]] = {}
        with VideoWriter(path, self.fps, (self.width, self.height)) as w:
            for _ in range(n_frames):
                idx = self.frame_index
                img, boxes = self.step()
                truth[idx] = boxes
                w.write(img)
        return truth


def synthetic_speed_for(activity: str) -> float:
    return {"low": 0.4, "normal": 1.0, "high": 2.0}[activity]


