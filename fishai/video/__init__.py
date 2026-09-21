"""Video ingestion and output."""

from fishai.video.reader import VideoInfo, VideoReader, probe_video
from fishai.video.synthetic import SyntheticAquarium, SyntheticFish
from fishai.video.writer import VideoWriter

__all__ = ["VideoInfo", "VideoReader", "probe_video", "VideoWriter", "SyntheticAquarium", "SyntheticFish"]
