"""FishAI: an AI aquarium monitoring system.

Camera / sensors -> specialised perception models -> structured aquarium
state -> local reasoning model (Qwen) -> safe actions.

The package is organised so every stage can be swapped without touching the
others: detectors, trackers, storage, the reasoner and the actuators all sit
behind small interfaces in ``fishai.types`` and the ``base`` modules.
"""

__version__ = "0.1.0"
