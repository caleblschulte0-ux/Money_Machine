"""Day or night, decided from the frame itself.

Infrared night footage is essentially grey: every pixel's saturation is
near zero. Daylight (or tank light) footage is not. Mean HSV saturation
therefore separates the two without asking the camera, which matters
because appearance descriptors from the two modes must never be compared.
"""

from __future__ import annotations

import cv2
import numpy as np

DAY, NIGHT = "day", "night"


def mean_saturation(image: np.ndarray) -> float:
    small = image[::4, ::4] if image.shape[0] > 64 else image
    hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
    return float(hsv[:, :, 1].mean() / 255.0)


def detect_mode(image: np.ndarray, night_saturation_below: float = 0.12) -> str:
    return NIGHT if mean_saturation(image) < night_saturation_below else DAY
