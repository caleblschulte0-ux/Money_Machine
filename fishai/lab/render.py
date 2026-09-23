"""Synthetic aquarium footage rendered from the rail camera, with exact labels.

Every fish is a sprite placed at a 3D position in a randomised tank and
projected through ``RailCamera`` (underwater field of view), so a fish's
size in pixels follows its distance from the glass exactly as it will on
the product. Drawing is far-to-near with a per-pixel owner map, so each
label is the VISIBLE part of the fish and records how much of it was
hidden (by nearer fish, plants in front, bubbles, or the frame edge).

Realism comes from randomising everything the real world varies: real
tank backgrounds and real fish cut-outs when available (procedural ones
otherwise), water colour and turbidity (attenuation with distance), blur,
caustics, reflections on the glass, flat-port distortion, exposure and
white balance, sensor noise, JPEG, and infrared night footage.

Two outputs: independent frames for detector training (``render_frame``)
and continuous video where each fish keeps its identity (``Scene``) for
tracking and re-identification.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass, field
from typing import Any

import cv2
import numpy as np

from fishai.lab.camera import RailCamera, Tank
from fishai.lab.plates import foreground_plants, procedural_plate
from fishai.lab.sprites import Sprite, lookalike_group, procedural_fish


@dataclass
class RenderConfig:
    width: int = 640
    height: int = 360
    tank_length_cm: tuple[float, float] = (45.0, 120.0)
    tank_width_cm: tuple[float, float] = (25.0, 45.0)
    water_depth_cm: tuple[float, float] = (25.0, 50.0)
    # Camera depth as a fraction of water depth; the rail puts it near the middle.
    camera_depth_fraction: tuple[float, float] = (0.35, 0.65)
    fish_count: tuple[int, int] = (1, 12)
    fish_length_cm: tuple[float, float] = (2.0, 12.0)
    p_real_sprite: float = 0.7
    p_real_plate: float = 0.7
    p_lookalike_school: float = 0.35
    p_night: float = 0.2
    p_foreground_plants: float = 0.35
    p_bubbles: float = 0.4
    p_reflection: float = 0.5
    p_distortion: float = 0.7
    # Fish-sized non-fish patches (leaves, rock, background texture) drawn among the fish
    # and NOT labelled: the detector must learn that a blob is not a fish.
    p_distractors: float = 0.6
    distractor_count: tuple[int, int] = (1, 6)
    # A label is kept when at least this much of the in-frame fish is not hidden
    # behind something (occlusion) ...
    min_visible_fraction: float = 0.35
    # ... and at least this much of the whole fish is inside the frame (truncation).
    min_in_frame_fraction: float = 0.25
    min_box_px: int = 8
    jpeg_quality: tuple[int, int] = (60, 95)

    def to_dict(self) -> dict[str, Any]:
        return {k: (list(v) if isinstance(v, tuple) else v) for k, v in self.__dict__.items()}


@dataclass
class Assets:
    sprites: list[Sprite] = field(default_factory=list)
    plates: list[np.ndarray] = field(default_factory=list)

    @property
    def counts(self) -> dict[str, int]:
        return {"real_sprites": sum(1 for s in self.sprites if s.source == "real"), "plates": len(self.plates)}


@dataclass
class Fish:
    fid: int
    sprite: Sprite
    length_cm: float
    x: float
    y: float
    z: float
    yaw: float
    pitch: float
    vx: float = 0.0
    vy: float = 0.0
    vz: float = 0.0


# ------------------------------------------------------------------ helpers
def _alpha_blend(dst: np.ndarray, src_rgb: np.ndarray, alpha: np.ndarray, x0: int, y0: int) -> tuple[int, int, int, int] | None:
    """Composite src at (x0, y0) with clipping; returns the destination rectangle used."""
    h, w = src_rgb.shape[:2]
    H, W = dst.shape[:2]
    x1, y1 = max(0, x0), max(0, y0)
    x2, y2 = min(W, x0 + w), min(H, y0 + h)
    if x2 <= x1 or y2 <= y1:
        return None
    sx1, sy1 = x1 - x0, y1 - y0
    a = alpha[sy1 : sy1 + (y2 - y1), sx1 : sx1 + (x2 - x1), None].astype(np.float32) / 255.0
    region = dst[y1:y2, x1:x2].astype(np.float32)
    dst[y1:y2, x1:x2] = (a * src_rgb[sy1 : sy1 + (y2 - y1), sx1 : sx1 + (x2 - x1)] + (1 - a) * region).astype(np.uint8)
    return x1, y1, x2, y2


def _pincushion_maps(w: int, h: int, k: float) -> tuple[np.ndarray, np.ndarray]:
    ys, xs = np.indices((h, w), dtype=np.float32)
    cx, cy = w / 2, h / 2
    nx, ny = (xs - cx) / cx, (ys - cy) / cy
    r2 = nx * nx + ny * ny
    f = 1 - k * r2  # sample closer to centre -> stretches the edges (pincushion)
    return (cx + nx * f * cx).astype(np.float32), (cy + ny * f * cy).astype(np.float32)


def _water_colour(rng: random.Random) -> np.ndarray:
    return np.array([rng.uniform(70, 150), rng.uniform(80, 150), rng.uniform(20, 90)], np.float32)


# ------------------------------------------------------------------- scene
class Scene:
    """One randomised tank; ``frame()`` renders the current state, ``step()`` moves the fish."""

    def __init__(self, rng: random.Random, cfg: RenderConfig, assets: Assets) -> None:
        self.rng, self.cfg, self.assets = rng, cfg, assets
        depth = rng.uniform(*cfg.water_depth_cm)
        self.tank = Tank(rng.uniform(*cfg.tank_length_cm), rng.uniform(*cfg.tank_width_cm), depth, rng.uniform(3, 7))
        self.cam = RailCamera(cfg.width, cfg.height, camera_depth_cm=depth * rng.uniform(*cfg.camera_depth_fraction),
                              lateral_offset_cm=rng.uniform(-0.3, 0.3) * self.tank.width_cm)
        self.night = rng.random() < cfg.p_night
        self.water = _water_colour(rng)
        self.attenuation_cm = rng.uniform(60, 260)
        self.blur_far = rng.uniform(0.3, 2.2)
        self.plate = self._make_plate()
        self.fg = foreground_plants(rng, (cfg.width, cfg.height), rng.randint(1, 3)) if rng.random() < cfg.p_foreground_plants else None
        self.reflection = self._make_reflection() if rng.random() < cfg.p_reflection else None
        self.distort = _pincushion_maps(cfg.width, cfg.height, rng.uniform(0.02, 0.08)) if rng.random() < cfg.p_distortion else None
        self.bubbles = [(rng.uniform(0, cfg.width), rng.uniform(0, cfg.height), rng.uniform(1.5, 5)) for _ in range(rng.randint(5, 40))] if rng.random() < cfg.p_bubbles else []
        self.gain = np.array([rng.uniform(0.85, 1.15) for _ in range(3)], np.float32)
        self.exposure = rng.uniform(0.75, 1.25)
        self.noise = rng.uniform(1.0, 6.0) * (2.0 if self.night else 1.0)
        self.jpeg = rng.randint(*cfg.jpeg_quality)
        self.t = 0
        self.fish = self._make_fish()
        self.distractors = self._make_distractors() if rng.random() < cfg.p_distractors else []

    # ---------------------------------------------------------- construction
    def _make_plate(self) -> np.ndarray:
        cfg, rng = self.cfg, self.rng
        if self.assets.plates and rng.random() < cfg.p_real_plate:
            p = rng.choice(self.assets.plates)
            h, w = p.shape[:2]
            s = rng.uniform(1.0, 1.4)
            cw, ch = int(w / s), int(h / s)
            x0, y0 = rng.randint(0, w - cw), rng.randint(0, h - ch)
            p = cv2.resize(p[y0 : y0 + ch, x0 : x0 + cw], (cfg.width, cfg.height))
            if rng.random() < 0.5:
                p = p[:, ::-1].copy()
            return p
        p = procedural_plate(rng, (cfg.width, cfg.height))
        # Geometry-consistent surface band: the underside of the surface is seen above
        # where it meets the far glass, as a bright mirror.
        v_surface = int(self.cam.project(0, -self.cam.camera_depth_cm, self.tank.length_cm)[1])
        if v_surface > 0:
            band = p[: min(v_surface, cfg.height)].astype(np.float32)
            p[: min(v_surface, cfg.height)] = np.clip(band * 0.5 + np.array([200, 210, 190], np.float32) * 0.5, 0, 255).astype(np.uint8)
        return p

    def _make_reflection(self) -> np.ndarray:
        if self.assets.plates and self.rng.random() < 0.5:
            r = cv2.resize(self.rng.choice(self.assets.plates), (self.cfg.width, self.cfg.height))[:, ::-1]
        else:
            r = procedural_plate(self.rng, (self.cfg.width, self.cfg.height))
        return cv2.GaussianBlur(r, (0, 0), 6)

    def _sprite(self, pool: list[Sprite] | None = None) -> Sprite:
        rng = self.rng
        if pool:
            return pool.pop()
        real = [s for s in self.assets.sprites if s.source == "real"]
        if real and rng.random() < self.cfg.p_real_sprite:
            # Balance by source clip: one clip with forty cut-outs must not outvote one with five.
            origins = sorted({s.origin for s in real})
            origin = rng.choice(origins)
            return rng.choice([s for s in real if s.origin == origin])
        return procedural_fish(rng, rng.randint(90, 200))

    def _random_position(self, length_cm: float) -> tuple[float, float, float]:
        rng, t, c = self.rng, self.tank, self.cam
        z = rng.uniform(max(6.0, length_cm), t.length_cm)
        half_w = t.width_cm / 2
        x = rng.uniform(-half_w - c.lateral_offset_cm + length_cm / 2, half_w - c.lateral_offset_cm - length_cm / 2)
        y_top = -c.camera_depth_cm + length_cm * 0.3
        y_bot = t.water_depth_cm - t.substrate_cm - c.camera_depth_cm - length_cm * 0.3
        y = rng.uniform(y_top, max(y_top + 0.1, y_bot))
        return x, y, z

    def _make_fish(self) -> list[Fish]:
        rng, cfg = self.rng, self.cfg
        n = rng.randint(*cfg.fish_count)
        pool: list[Sprite] = []
        if n >= 3 and rng.random() < cfg.p_lookalike_school:
            pool = lookalike_group(rng, rng.randint(3, n), rng.randint(90, 180))
        base_len = rng.uniform(*cfg.fish_length_cm)
        fish = []
        for i in range(n):
            s = self._sprite(pool)
            length = base_len * rng.uniform(0.85, 1.15) if s.group.startswith("lookalike") else rng.uniform(*cfg.fish_length_cm)
            x, y, z = self._random_position(length)
            f = Fish(i + 1, s, length, x, y, z, rng.uniform(-math.pi, math.pi), rng.uniform(-0.25, 0.25))
            speed = rng.uniform(1.0, 8.0)
            f.vx, f.vy, f.vz = speed * math.cos(f.yaw), rng.uniform(-0.8, 0.8), speed * math.sin(f.yaw) * 0.6
            fish.append(f)
        return fish

    def _make_distractors(self) -> list[tuple[np.ndarray, float, float, float]]:
        """(rgba patch, x, y, z): textures cut from backgrounds in fish-like shapes, placed in the tank."""
        rng, cfg = self.rng, self.cfg
        sources = list(self.assets.plates) or [procedural_plate(rng, (cfg.width, cfg.height))]
        out = []
        for _ in range(rng.randint(*cfg.distractor_count)):
            src = rng.choice(sources)
            h, w = src.shape[:2]
            pw, ph = rng.randint(30, 160), rng.randint(15, 90)
            x0, y0 = rng.randint(0, max(0, w - pw)), rng.randint(0, max(0, h - ph))
            patch = src[y0 : y0 + ph, x0 : x0 + pw].copy()
            if rng.random() < 0.3:
                patch = cv2.cvtColor(cv2.cvtColor(patch, cv2.COLOR_BGR2GRAY), cv2.COLOR_GRAY2BGR)
            mask = np.zeros(patch.shape[:2], np.uint8)
            kind = rng.random()
            if kind < 0.4:
                cv2.ellipse(mask, (pw // 2, ph // 2), (pw // 2 - 1, ph // 2 - 1), rng.uniform(-30, 30), 0, 360, 255, -1)
            elif kind < 0.7:
                pts = np.array([[rng.randint(0, pw), rng.randint(0, ph)] for _ in range(rng.randint(3, 7))], np.int32)
                cv2.fillPoly(mask, [cv2.convexHull(pts)], 255)
            else:
                mask[:] = 255
            mask = cv2.GaussianBlur(mask, (5, 5), 0)
            length = rng.uniform(*cfg.fish_length_cm)
            x, y, z = self._random_position(length)
            out.append((np.dstack([patch, mask]), x, y, z))
        return out

    # --------------------------------------------------------------- motion
    def step(self, dt: float = 0.1) -> None:
        rng, t, c = self.rng, self.tank, self.cam
        for f in self.fish:
            f.vx += rng.uniform(-1.5, 1.5)
            f.vy += rng.uniform(-0.6, 0.6)
            f.vz += rng.uniform(-1.0, 1.0)
            sp = math.sqrt(f.vx * f.vx + f.vz * f.vz)
            if sp > 12:
                f.vx, f.vz = f.vx * 12 / sp, f.vz * 12 / sp
            f.vy = max(-3.0, min(3.0, f.vy))
            f.x += f.vx * dt
            f.y += f.vy * dt
            f.z += f.vz * dt
            half_w = t.width_cm / 2
            lo_x, hi_x = -half_w - c.lateral_offset_cm + f.length_cm / 2, half_w - c.lateral_offset_cm - f.length_cm / 2
            lo_y, hi_y = -c.camera_depth_cm + f.length_cm * 0.3, t.water_depth_cm - t.substrate_cm - c.camera_depth_cm - f.length_cm * 0.3
            lo_z, hi_z = max(5.0, f.length_cm), t.length_cm
            if not lo_x <= f.x <= hi_x:
                f.x, f.vx = min(max(f.x, lo_x), hi_x), -f.vx
            if not lo_y <= f.y <= hi_y:
                f.y, f.vy = min(max(f.y, lo_y), hi_y), -f.vy
            if not lo_z <= f.z <= hi_z:
                f.z, f.vz = min(max(f.z, lo_z), hi_z), -f.vz
            f.yaw = math.atan2(f.vz, f.vx) if (f.vx or f.vz) else f.yaw
        self.bubbles = [(x + rng.uniform(-0.5, 0.5), y - r * 1.5, r) if y > 0 else (rng.uniform(0, self.cfg.width), self.cfg.height, r) for x, y, r in self.bubbles]
        self.t += 1

    # --------------------------------------------------------------- render
    def frame(self) -> tuple[np.ndarray, list[dict[str, Any]]]:
        cfg, cam, rng = self.cfg, self.cam, self.rng
        W, H = cfg.width, cfg.height
        img = self.plate.copy()
        owner = np.zeros((H, W), np.int16)
        full_area: dict[int, int] = {}
        in_frame_area: dict[int, int] = {}
        # Distractors first-by-depth together with fish: draw them in their own depth order but
        # without an owner id, so they hide fish behind them and are never labelled.
        drawables: list[tuple[float, Any]] = [(f.z, f) for f in self.fish] + [(d[3], d) for d in self.distractors]
        for _, item in sorted(drawables, key=lambda q: -q[0]):
            if not isinstance(item, Fish):
                patch, dx, dy, dz = item
                du, dv = cam.project(dx, dy, dz)
                k = 1 - math.exp(-dz / self.attenuation_cm)
                prgb = patch[..., :3].astype(np.float32) * (1 - k) + self.water * k
                r = _alpha_blend(img, prgb, patch[..., 3], int(du - patch.shape[1] / 2), int(dv - patch.shape[0] / 2))
                if r is not None:
                    x1, y1, x2, y2 = r
                    sub = patch[..., 3][y1 - int(dv - patch.shape[0] / 2) : y2 - int(dv - patch.shape[0] / 2), x1 - int(du - patch.shape[1] / 2) : x2 - int(du - patch.shape[1] / 2)] > 127
                    owner[y1:y2, x1:x2][sub] = 0
                continue
            f = item
            u, v = cam.project(f.x, f.y, f.z)
            facing = math.cos(f.yaw)
            apparent = f.length_cm * (0.3 + 0.7 * abs(facing))
            length_px = apparent * cam.pixels_per_cm(f.z)
            if length_px < 3:
                continue
            spr = f.sprite.rgba
            sh, sw = spr.shape[:2]
            height_px = max(2, int(round(f.length_cm * cam.pixels_per_cm(f.z) * sh / sw)))
            width_px = max(2, int(round(length_px)))
            s = cv2.resize(spr, (width_px, height_px), interpolation=cv2.INTER_AREA if width_px < sw else cv2.INTER_LINEAR)
            if facing < 0:
                s = s[:, ::-1]
            if abs(f.pitch) > 0.05:
                M = cv2.getRotationMatrix2D((width_px / 2, height_px / 2), math.degrees(f.pitch) * (1 if facing >= 0 else -1), 1.0)
                cos_, sin_ = abs(M[0, 0]), abs(M[0, 1])
                nw, nh = int(height_px * sin_ + width_px * cos_) + 2, int(height_px * cos_ + width_px * sin_) + 2
                M[0, 2] += nw / 2 - width_px / 2
                M[1, 2] += nh / 2 - height_px / 2
                s = cv2.warpAffine(np.ascontiguousarray(s), M, (nw, nh), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0, 0))
            rgb = s[..., :3].astype(np.float32)
            alpha = s[..., 3].copy()
            # Water between the glass and the fish: tint, contrast loss and blur with distance.
            k = 1 - math.exp(-f.z / self.attenuation_cm)
            rgb = rgb * (1 - k) + self.water * k
            sigma = self.blur_far * f.z / self.tank.length_cm
            if sigma > 0.4:
                rgb = cv2.GaussianBlur(rgb, (0, 0), sigma)
                alpha = cv2.GaussianBlur(alpha, (0, 0), sigma * 0.5)
            x0, y0 = int(round(u - rgb.shape[1] / 2)), int(round(v - rgb.shape[0] / 2))
            rect = _alpha_blend(img, rgb, alpha, x0, y0)
            if rect is None:
                continue
            x1, y1, x2, y2 = rect
            sub = alpha[y1 - y0 : y2 - y0, x1 - x0 : x2 - x0] > 127
            owner[y1:y2, x1:x2][sub] = f.fid
            full_area[f.fid] = int((alpha > 127).sum())  # includes the part outside the frame
            in_frame_area[f.fid] = int(sub.sum())
        # In front of every fish: plants near the glass, bubbles.
        if self.fg is not None:
            a = self.fg[..., 3]
            img = (img.astype(np.float32) * (1 - a[..., None] / 255.0) + self.fg[..., :3].astype(np.float32) * (a[..., None] / 255.0)).astype(np.uint8)
            owner[a > 127] = 0
        for bx, by, br in self.bubbles:
            cv2.circle(img, (int(bx), int(by)), int(br), (235, 235, 235), 1, cv2.LINE_AA)
            cv2.circle(owner, (int(bx), int(by)), int(br), 0, -1)
        # Caustics near the surface.
        if not self.night and rng.random() < 0.6:
            ys, xs = np.indices((H, W), dtype=np.float32)
            ph = self.t * 0.3
            c = (np.sin(xs * 0.05 + ph) * np.sin(ys * 0.07 - ph * 0.7) + np.sin((xs + ys) * 0.03 + ph)) * np.exp(-ys / (H * 0.35))
            img = np.clip(img.astype(np.float32) + (c[..., None] * rng.uniform(4, 14)), 0, 255).astype(np.uint8)
        if self.reflection is not None:
            img = cv2.addWeighted(img, 1.0, self.reflection, rng.uniform(0.03, 0.12), 0)
        if self.distort is not None:
            mx, my = self.distort
            img = cv2.remap(img, mx, my, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
            owner = cv2.remap(owner.astype(np.float32), mx, my, cv2.INTER_NEAREST, borderMode=cv2.BORDER_CONSTANT, borderValue=0).astype(np.int16)
        img = self._camera(img)
        labels = []
        for f in self.fish:
            if f.fid not in full_area:
                continue
            m = owner == f.fid
            vis = int(m.sum())
            if vis == 0:
                continue
            ys, xs = np.where(m)
            box = [float(xs.min()), float(ys.min()), float(xs.max() + 1), float(ys.max() + 1)]
            in_frame = in_frame_area.get(f.fid, 0)
            unoccluded = min(1.0, vis / max(1, in_frame))
            inside = in_frame / max(1, full_area[f.fid])
            big_enough = (box[2] - box[0]) >= self.cfg.min_box_px and (box[3] - box[1]) >= self.cfg.min_box_px
            labels.append(
                {
                    "id": f.fid, "box": box, "visible_fraction": round(unoccluded, 3), "in_frame_fraction": round(inside, 3),
                    "keep": unoccluded >= self.cfg.min_visible_fraction and inside >= self.cfg.min_in_frame_fraction and big_enough,
                    "z_cm": round(f.z, 1), "length_cm": round(f.length_cm, 1), "facing": "right" if math.cos(f.yaw) >= 0 else "left",
                    "sprite_source": f.sprite.source, "group": f.sprite.group,
                }
            )
        return img, labels

    def _camera(self, img: np.ndarray) -> np.ndarray:
        rng = self.rng
        x = img.astype(np.float32)
        if self.night:
            g = 0.2 * x[..., 0] + 0.5 * x[..., 1] + 0.3 * x[..., 2]
            H, W = g.shape
            ys, xs = np.indices((H, W), dtype=np.float32)
            hotspot = 1.25 - 0.6 * (((xs - W / 2) / W) ** 2 + ((ys - H / 2) / H) ** 2) * 2
            g = g * hotspot * rng.uniform(0.7, 1.1)
            x = np.repeat(g[..., None], 3, axis=2)
        else:
            x = x * self.gain * self.exposure
        x += np.random.default_rng(rng.randint(0, 1 << 30)).normal(0, self.noise, x.shape)
        H, W = x.shape[:2]
        ys, xs = np.indices((H, W), dtype=np.float32)
        vign = 1 - 0.25 * (((xs - W / 2) / (W / 2)) ** 2 + ((ys - H / 2) / (H / 2)) ** 2) / 2
        x = np.clip(x * vign[..., None], 0, 255).astype(np.uint8)
        ok, buf = cv2.imencode(".jpg", x, [int(cv2.IMWRITE_JPEG_QUALITY), self.jpeg])
        return cv2.imdecode(buf, cv2.IMREAD_COLOR) if ok else x


def render_frame(rng: random.Random, cfg: RenderConfig, assets: Assets) -> tuple[np.ndarray, list[dict[str, Any]], Scene]:
    """One independent frame from a fresh random scene (detector training)."""
    scene = Scene(rng, cfg, assets)
    for _ in range(rng.randint(0, 3)):
        scene.step()
    img, labels = scene.frame()
    return img, labels, scene


def scene_meta(scene: Scene) -> dict[str, Any]:
    return {
        "tank_cm": [round(scene.tank.length_cm, 1), round(scene.tank.width_cm, 1), round(scene.tank.water_depth_cm, 1)],
        "camera_depth_cm": round(scene.cam.camera_depth_cm, 1), "lateral_offset_cm": round(scene.cam.lateral_offset_cm, 1),
        "night": scene.night, "attenuation_cm": round(scene.attenuation_cm, 1), "fish": len(scene.fish),
        "foreground_plants": scene.fg is not None, "reflection": scene.reflection is not None, "bubbles": len(scene.bubbles),
        "distractors": len(scene.distractors),
    }
