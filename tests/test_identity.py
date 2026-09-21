import numpy as np

from fishai.perception.classification.identity import link_tracks_to_fish
from fishai.storage import Database
from fishai.types import VideoRecord


def _vid(db, vid):
    db.upsert_video(VideoRecord(vid, vid, 1, 1, 1.0, 1, 1.0, "t", "d", "t", "h"))


def _desc(*peaks):
    d = np.zeros(128, dtype=np.float32)
    for p in peaks:
        d[p] = 1.0
    return d / d.sum()


def test_new_fish_are_registered_then_matched_across_videos(db: Database):
    _vid(db, "a")
    r1 = link_tracks_to_fish(db, "a", {1: _desc(3), 2: _desc(60)}, min_observations={1: 10, 2: 10})
    assert {v["fish_id"] for v in r1.values()} == {1, 2} and all(v["new"] for v in r1.values())
    _vid(db, "b")
    r2 = link_tracks_to_fish(db, "b", {7: _desc(60), 9: _desc(3)}, min_observations={7: 10, 9: 10})
    assert r2[7]["fish_id"] == 2 and r2[9]["fish_id"] == 1
    assert not any(v["new"] for v in r2.values())
    assert db.list_fish()[0]["n_sessions"] == 2


def test_short_tracks_are_not_registered(db: Database):
    _vid(db, "a")
    r = link_tracks_to_fish(db, "a", {1: _desc(3)}, min_observations={1: 2})
    assert r == {} and db.list_fish() == []


def test_dissimilar_track_becomes_new_fish(db: Database):
    _vid(db, "a")
    link_tracks_to_fish(db, "a", {1: _desc(3)}, min_observations={1: 10})
    _vid(db, "b")
    r = link_tracks_to_fish(db, "b", {1: _desc(100)}, min_observations={1: 10})
    assert r[1]["new"] is True and len(db.list_fish()) == 2


def test_fragments_join_only_when_they_do_not_coexist(db: Database):
    _vid(db, "a")
    spans = {1: (0.0, 5.0), 2: (6.0, 10.0), 3: (4.0, 10.0)}
    r = link_tracks_to_fish(db, "a", {1: _desc(3), 2: _desc(3), 3: _desc(3)}, min_observations={1: 10, 2: 10, 3: 10}, spans=spans)
    assert r[1]["fish_id"] == r[2]["fish_id"], "track 2 starts after track 1 ends: same fish"
    assert r[3]["fish_id"] != r[1]["fish_id"], "track 3 overlaps track 1 in time: cannot be the same fish"
    assert r[2]["confidence"] > 0.99
