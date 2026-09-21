-- FishAI storage schema. Raw rows (observations, sensor_readings) are never
-- rewritten; derived rows (track_summaries, baselines, anomalies) may be
-- recomputed from them at any time.

PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS videos (
    video_id      TEXT PRIMARY KEY,
    path          TEXT NOT NULL,
    width         INTEGER NOT NULL,
    height        INTEGER NOT NULL,
    fps           REAL NOT NULL,
    frame_count   INTEGER NOT NULL,
    duration_s    REAL NOT NULL,
    processed_at  TEXT NOT NULL,
    detector      TEXT NOT NULL,
    tracker       TEXT NOT NULL,
    config_hash   TEXT NOT NULL
);

-- RAW: one row per tracked fish per processed frame.
CREATE TABLE IF NOT EXISTS observations (
    id                  INTEGER PRIMARY KEY,
    video_id            TEXT NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE,
    frame_index         INTEGER NOT NULL,
    timestamp_s         REAL NOT NULL,
    track_id            INTEGER NOT NULL,
    x1 REAL NOT NULL, y1 REAL NOT NULL, x2 REAL NOT NULL, y2 REAL NOT NULL,
    confidence          REAL NOT NULL,
    cx REAL NOT NULL, cy REAL NOT NULL,
    nx REAL NOT NULL, ny REAL NOT NULL,
    zone                TEXT NOT NULL,
    dx REAL NOT NULL DEFAULT 0, dy REAL NOT NULL DEFAULT 0,
    displacement_px     REAL NOT NULL DEFAULT 0,
    speed_px_s          REAL NOT NULL DEFAULT 0,
    speed_norm_s        REAL NOT NULL DEFAULT 0,
    identity_confidence REAL NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS ix_obs_video_track ON observations(video_id, track_id, frame_index);

-- DERIVED: one row per track per video.
CREATE TABLE IF NOT EXISTS track_summaries (
    video_id                TEXT NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE,
    track_id                INTEGER NOT NULL,
    first_frame INTEGER NOT NULL, last_frame INTEGER NOT NULL,
    first_ts REAL NOT NULL, last_ts REAL NOT NULL,
    n_observations          INTEGER NOT NULL,
    duration_s              REAL NOT NULL,
    total_distance_px       REAL NOT NULL,
    mean_speed_px_s         REAL NOT NULL,
    max_speed_px_s          REAL NOT NULL,
    mean_speed_norm_s       REAL NOT NULL,
    activity_score          REAL NOT NULL,
    surface_fraction REAL NOT NULL, middle_fraction REAL NOT NULL, bottom_fraction REAL NOT NULL,
    surface_time_s REAL NOT NULL, middle_time_s REAL NOT NULL, bottom_time_s REAL NOT NULL,
    mean_nx REAL NOT NULL, mean_ny REAL NOT NULL,
    mean_confidence         REAL NOT NULL,
    min_identity_confidence REAL NOT NULL,
    missing_time_s          REAL NOT NULL,
    longest_gap_s           REAL NOT NULL,
    mean_box_area_px        REAL NOT NULL,
    extra_json              TEXT NOT NULL DEFAULT '{}',
    PRIMARY KEY (video_id, track_id)
);

-- Optional mapping from per-video track ids to a long-term fish identity.
-- Filled by the identity stage (Phase 2); absent rows mean "unknown fish".
CREATE TABLE IF NOT EXISTS fish_identities (
    video_id   TEXT NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE,
    track_id   INTEGER NOT NULL,
    fish_id    INTEGER NOT NULL,
    confidence REAL NOT NULL,
    method     TEXT NOT NULL,
    PRIMARY KEY (video_id, track_id)
);

-- DERIVED: rolling "normal" per fish per metric.
CREATE TABLE IF NOT EXISTS baselines (
    fish_id     INTEGER NOT NULL,
    metric      TEXT NOT NULL,
    n           INTEGER NOT NULL,
    mean        REAL NOT NULL,
    std         REAL NOT NULL,
    minimum     REAL NOT NULL,
    maximum     REAL NOT NULL,
    updated_at  TEXT NOT NULL,
    window_json TEXT NOT NULL,
    PRIMARY KEY (fish_id, metric)
);

-- DERIVED: deviations found when a session was compared to its baseline.
CREATE TABLE IF NOT EXISTS anomalies (
    id          INTEGER PRIMARY KEY,
    video_id    TEXT NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE,
    fish_id     INTEGER NOT NULL,
    metric      TEXT NOT NULL,
    value       REAL NOT NULL,
    baseline    REAL NOT NULL,
    z_score     REAL NOT NULL,
    percent     REAL NOT NULL,
    direction   TEXT NOT NULL,
    severity    TEXT NOT NULL,
    detected_at TEXT NOT NULL
);

-- RAW: sensor telemetry (real or simulated; `source` says which).
CREATE TABLE IF NOT EXISTS sensor_readings (
    id          INTEGER PRIMARY KEY,
    sensor      TEXT NOT NULL,
    kind        TEXT NOT NULL,
    value       REAL NOT NULL,
    unit        TEXT NOT NULL,
    source      TEXT NOT NULL,
    recorded_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_sensor_time ON sensor_readings(sensor, recorded_at);

-- Events: feeding, alerts, actions taken, owner confirmations. The
-- owner-confirmed outcomes are the labels the future dataset is built on.
CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY,
    kind        TEXT NOT NULL,
    video_id    TEXT,
    fish_id     INTEGER,
    payload_json TEXT NOT NULL DEFAULT '{}',
    recorded_at TEXT NOT NULL
);

-- Reasoner verdicts, kept so recommendations can be audited against outcomes.
CREATE TABLE IF NOT EXISTS assessments (
    id           INTEGER PRIMARY KEY,
    video_id     TEXT,
    backend      TEXT NOT NULL,
    model        TEXT NOT NULL,
    severity     TEXT NOT NULL,
    input_json   TEXT NOT NULL,
    output_json  TEXT NOT NULL,
    recorded_at  TEXT NOT NULL
);

-- Control actions requested/executed and their permission outcome.
CREATE TABLE IF NOT EXISTS actions (
    id          INTEGER PRIMARY KEY,
    action      TEXT NOT NULL,
    params_json TEXT NOT NULL DEFAULT '{}',
    requested_by TEXT NOT NULL,
    permission  TEXT NOT NULL,
    executed    INTEGER NOT NULL,
    reason      TEXT NOT NULL,
    recorded_at TEXT NOT NULL
);

-- Long-term fish registry (Phase 2). One row per fish the system believes it
-- has seen across sessions; descriptor_json is the appearance signature used
-- to link new tracks to it. Names are the owner's, ids are ours.
CREATE TABLE IF NOT EXISTS fish (
    fish_id         INTEGER PRIMARY KEY,
    name            TEXT,
    descriptor_json TEXT NOT NULL,
    first_seen      TEXT NOT NULL,
    last_seen       TEXT NOT NULL,
    n_sessions      INTEGER NOT NULL DEFAULT 1
);
