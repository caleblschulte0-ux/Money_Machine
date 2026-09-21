"""Water and environment sensors behind one interface (Phase 6).

Simulated and real sensors are interchangeable: both implement ``Sensor``
and register a ``kind``. The configuration decides which is wired in, so
development runs on simulators and the same code reads hardware later.
"""

from fishai.sensors.base import Reading, Sensor, SensorHub, build_sensors, register_sensor

__all__ = ["Reading", "Sensor", "SensorHub", "build_sensors", "register_sensor"]
