"""The rail camera: a flat-port camera looking horizontally through the tank glass.

In air the Pi Camera Module 3 Wide sees 102 x 67 degrees. Through flat glass
into water, Snell's law narrows every ray: sin(theta_water) = sin(theta_air)
/ n_water. The glass itself only shifts rays sideways; it does not change
their angle in the water, so it is ignored. The result is modelled as a
pinhole camera with the UNDERWATER field of view, which is a good
approximation near the centre and slightly optimistic at the edges (a real
flat port adds pincushion distortion there; the renderer adds a mild
version of it).

Coordinates, in centimetres, with the camera at the origin:
  x  across the frame (right positive)
  y  down (positive is deeper); the water surface is at y = -camera_depth_cm
  z  away from the glass, into the tank
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

N_WATER = 1.333


def underwater_fov_deg(fov_air_deg: float, n: float = N_WATER) -> float:
    half = math.radians(fov_air_deg / 2)
    return 2 * math.degrees(math.asin(math.sin(half) / n))


@dataclass(frozen=True)
class RailCamera:
    width_px: int = 1280
    height_px: int = 720
    hfov_air_deg: float = 102.0
    vfov_air_deg: float = 67.0
    # Where the camera sits: depth below the water surface, and its offset from
    # the centre of the pane it looks through (0 = centred across the pane).
    camera_depth_cm: float = 20.0
    lateral_offset_cm: float = 0.0

    @property
    def hfov_deg(self) -> float:
        return underwater_fov_deg(self.hfov_air_deg)

    @property
    def vfov_deg(self) -> float:
        return underwater_fov_deg(self.vfov_air_deg)

    @property
    def fx(self) -> float:
        return (self.width_px / 2) / math.tan(math.radians(self.hfov_deg / 2))

    @property
    def fy(self) -> float:
        return (self.height_px / 2) / math.tan(math.radians(self.vfov_deg / 2))

    def project(self, x: float, y: float, z: float) -> tuple[float, float]:
        """3D point (cm, camera frame) -> pixel (u, v). z must be positive."""
        return (self.width_px / 2 + self.fx * x / z, self.height_px / 2 + self.fy * y / z)

    def pixels_per_cm(self, z: float) -> float:
        return self.fx / z

    def visible_span_cm(self, z: float) -> tuple[float, float]:
        """(width, height) of water visible at distance z."""
        return (2 * z * math.tan(math.radians(self.hfov_deg / 2)), 2 * z * math.tan(math.radians(self.vfov_deg / 2)))

    def substrate_visible_from_cm(self, water_depth_cm: float) -> float:
        """Distance at which the bottom of the tank first enters the frame."""
        below = max(0.0, water_depth_cm - self.camera_depth_cm)
        return below / math.tan(math.radians(self.vfov_deg / 2))

    def surface_visible_from_cm(self) -> float:
        return self.camera_depth_cm / math.tan(math.radians(self.vfov_deg / 2))

    def scaled(self, width_px: int, height_px: int) -> RailCamera:
        return RailCamera(width_px, height_px, self.hfov_air_deg, self.vfov_air_deg, self.camera_depth_cm, self.lateral_offset_cm)


@dataclass(frozen=True)
class Tank:
    """Tank interior seen from the camera's pane. length_cm runs away from the camera."""

    length_cm: float = 60.0
    width_cm: float = 30.0
    water_depth_cm: float = 35.0
    substrate_cm: float = 5.0


def coverage_report(cam: RailCamera, tank: Tank, fish_length_cm: float = 3.0) -> dict[str, Any]:
    """What the camera actually sees in this tank: the numbers to check before mounting."""
    far = tank.length_cm
    mid = tank.length_cm / 2
    w_far, h_far = cam.visible_span_cm(far)
    return {
        "resolution_px": [cam.width_px, cam.height_px],
        "underwater_fov_deg": [round(cam.hfov_deg, 1), round(cam.vfov_deg, 1)],
        "substrate_visible_from_cm": round(cam.substrate_visible_from_cm(tank.water_depth_cm), 1),
        "surface_visible_from_cm": round(cam.surface_visible_from_cm(), 1),
        "visible_at_far_glass_cm": [round(w_far, 1), round(h_far, 1)],
        "full_width_visible_from_cm": round((tank.width_cm / 2 + abs(cam.lateral_offset_cm)) / math.tan(math.radians(cam.hfov_deg / 2)), 1),
        "fish_px_at_mid_tank": round(fish_length_cm * cam.pixels_per_cm(mid), 1),
        "fish_px_at_far_glass": round(fish_length_cm * cam.pixels_per_cm(far), 1),
        "fraction_of_tank_length_with_full_depth": round(max(0.0, 1 - max(cam.substrate_visible_from_cm(tank.water_depth_cm), cam.surface_visible_from_cm()) / far), 3),
    }
