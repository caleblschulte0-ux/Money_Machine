import numpy as np

from fishai.perception.classification.identity import link_tracks_to_fish
from fishai.storage import Database
from fishai.types import VideoRecord


def _vid(db, vid):
    db.upsert_video(VideoRecord(vid, vid, 1, 1, 1.0, 1, 1.0, "t", "d", "t", "h"))


def _hist(*peaks):
    d = np.zeros(128, dtype=np.float32)
    for p in peaks:
        d[p] = 1.0
    return d / d.sum()


def _desc(*peaks, key="cam1/day"):
    return {key: _hist(*peaks)}


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


def test_day_and_night_descriptors_never_compare(db: Database):
    """The same histogram under a different key is a different fish until a track bridges them."""
    _vid(db, "day")
    link_tracks_to_fish(db, "day", {1: _desc(3)}, min_observations={1: 10})
    _vid(db, "night")
    r = link_tracks_to_fish(db, "night", {1: _desc(3, key="cam1/night")}, min_observations={1: 10})
    assert r[1]["new"] is True and len(db.list_fish()) == 2
    # A dusk track carrying BOTH keys links to the day fish and teaches it the night key.
    _vid(db, "dusk")
    r = link_tracks_to_fish(db, "dusk", {5: {"cam1/day": _hist(3), "cam1/night": _hist(40)}}, min_observations={5: 10})
    assert r[5]["fish_id"] == 1 and r[5]["new"] is False
    assert set(db.list_fish()[0]["descriptors"]) == {"cam1/day", "cam1/night"}
    _vid(db, "night2")
    r = link_tracks_to_fish(db, "night2", {1: _desc(40, key="cam1/night")}, min_observations={1: 10})
    assert r[1]["fish_id"] == 1, "now recognised at night through the descriptor the dusk track taught"


def test_second_camera_gets_its_own_descriptors(db: Database):
    _vid(db, "a")
    link_tracks_to_fish(db, "a", {1: _desc(3)}, min_observations={1: 10})
    _vid(db, "b")
    r = link_tracks_to_fish(db, "b", {1: _desc(3, key="cam2/day")}, min_observations={1: 10})
    assert r[1]["new"] is True, "another camera's view is never matched against the first camera's histogram"


def test_legacy_single_descriptor_rows_still_load(db: Database):
    db.connection.execute("INSERT INTO fish (name, descriptor_json, first_seen, last_seen, n_sessions) VALUES (NULL, ?, 't', 't', 1)", ("[0.5, 0.5]",))
    db.connection.commit()
    assert db.list_fish()[0]["descriptors"] == {"cam1/day": [0.5, 0.5]}
