from pathlib import Path

from fishai.video import VideoReader, probe_video
from fishai.video.reader import video_id_for
from fishai.video.synthetic import SyntheticAquarium


def test_synthetic_video_roundtrip(workdir: Path):
    path = workdir / "s.mp4"
    truth = SyntheticAquarium(n_fish=2, seed=3).write(path, 30)
    info = probe_video(str(path))
    assert (info.width, info.height, info.frame_count) == (640, 360, 30)
    assert info.fps == 20.0
    frames = list(VideoReader(str(path)))
    assert len(frames) == 30
    assert frames[0].image.shape == (360, 640, 3)
    assert frames[-1].timestamp_s > frames[0].timestamp_s
    assert len(truth) == 30 and all(len(v) == 2 for v in truth.values())


def test_reader_stride_and_max_frames_and_resize(workdir: Path):
    path = workdir / "s.mp4"
    SyntheticAquarium(n_fish=1).write(path, 40)
    frames = list(VideoReader(str(path), stride=4, max_frames=5, max_side=320))
    assert [f.index for f in frames] == [0, 4, 8, 12, 16]
    assert frames[0].image.shape[1] == 320


def test_synthetic_fish_never_overlap(workdir: Path):
    truth = SyntheticAquarium(n_fish=4, seed=11).write(workdir / "s.mp4", 120)
    for boxes in truth.values():
        items = list(boxes.values())
        for i, a in enumerate(items):
            for b in items[i + 1 :]:
                assert a.iou(b) < 0.15


def test_video_id_is_stable_and_content_based(workdir: Path):
    p1, p2 = workdir / "a.mp4", workdir / "b.mp4"
    SyntheticAquarium(seed=1).write(p1, 10)
    SyntheticAquarium(seed=2).write(p2, 10)
    assert video_id_for(p1) == video_id_for(p1)
    assert video_id_for(p1) != video_id_for(p2)
    assert len(video_id_for(p1)) == 16
