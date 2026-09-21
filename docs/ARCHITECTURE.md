# Architecture

## The pipeline

```
VideoReader ──frames──▶ Detector ──Detection[]──▶ Tracker ──TrackedObject[]──▶ TelemetryBuilder ──Observation[]──▶ Database
                                                                 │                                         │
                                                                 ▼                                         ▼
                                                             Annotator ──▶ annotated.mp4         summarize_tracks ──▶ TrackSummary[]
                                                                                                           │
                                                                            link_tracks_to_fish ◀──────────┘ (appearance descriptors)
                                                                                     │
                                                                                     ▼
                                                                              summary.json
```

Later, over stored sessions:

```
Database ──▶ baselines.update_baselines ──▶ baselines table
Database ──▶ baselines.deviations_for_video ──▶ Deviation[] ──▶ reasoning.build_state ──▶ Reasoner ──▶ Assessment
SensorHub ──▶ readings ──────────────────────────────────────────────┘                        │
                                                                                              ▼
                                                             ControlExecutor.request ◀── safe_actions (validated names only)
                                                                    │
                                                    permissions.tier_for + safety.check ──▶ Actuator (or pending / refused)
```

## Contracts (`fishai/types.py`)

| Type | Meaning |
|---|---|
| `Frame` | one decoded image with index and timestamp |
| `Detection` | a box with confidence and class, no identity |
| `TrackedObject` | a detection with a `track_id`, `identity_confidence`, `reacquired` flag |
| `Observation` | RAW: one tracked fish on one frame, with normalised position, zone, displacement and speed |
| `TrackSummary` | DERIVED: per-track metrics over a video |
| `VideoRecord` | provenance: source, resolution, fps, detector, tracker, config hash |

## Stages and their swap points

Every stage is a registry keyed by a config string. Adding a backend means
one module that calls `register_*` and one line in `configs/default.yaml`.

| Stage | Interface | Backends today | Config key |
|---|---|---|---|
| Detection | `Detector.detect(frame) -> [Detection]` | `motion` (median background), `yolo` (ultralytics: Fishial or any .pt), `synthetic` (tests) | `detection.backend` |
| Tracking | `Tracker.update(frame, dets) -> [TrackedObject]` | `simple` (IoU + velocity + HSV re-id), `bytetrack` (trackers / supervision) | `tracking.backend` |
| Telemetry | `TelemetryBuilder.observe` + `summarize_tracks` | one implementation, all arithmetic | `behavior.*` |
| Identity | `link_tracks_to_fish` | HSV histogram matching to the `fish` table | (inside pipeline) |
| Baselines | `update_baselines`, `deviations_for_video` | rolling window, prior sessions only | `baselines.*` |
| Reasoning | `Reasoner.assess(state) -> Assessment` | `ollama` (Qwen), `rules` (deterministic) | `reasoning.backend` |
| Sensors | `Sensor.read() -> Reading` | simulated temperature / water level / pH / DO, `file` | `sensors[]` |
| Control | `Actuator.apply(action, params)` | `simulated`, `none` | `control.backend` |

## Model resolution

`configs/default.yaml` names a **registry key** (`fishial_detector_v26`), not
a file. `models/registry.json` maps the key to a URL, archive member,
checksum and licence; `scripts/download_models.py` fetches it;
`fishai.models_registry.resolve_model_path` turns the key into a path or
raises with the exact command to run. Weights are git-ignored.

## Identity, honestly

Within a clip, the built-in tracker re-links a lost track to a new
detection by HSV histogram similarity and proximity. The re-link's
similarity becomes the track's `identity_confidence` and the frame is
marked `reacquired`, so telemetry does not compute a teleport speed and the
summary can show `id~0.93`. Across clips, each track's mean descriptor is
matched to the `fish` table (Hungarian assignment, one fish per track);
below the threshold a new fish is registered. Two tracks in the same clip
join one fish only if they never coexist in time. Two identical neon
tetras will not be told apart by this; the roadmap names deep re-id as the
next rung.

## Baselines

For each fish and metric, "normal" is the mean and standard deviation over
the last `window_sessions` sessions *before* the one being judged. A
deviation is flagged on `|z| >= z_threshold` or `|percent| >= percent_threshold`,
in the direction the metric's config says matters (`surface_fraction:
high`, `activity_score: both`). Flat histories get a floor on the standard
deviation so a tiny wobble is not an infinite z-score. Sessions with
fragmented tracks are combined weighted by observation count so one
session is one sample.

## Reasoning boundary

The reasoner receives one dictionary (`reasoning.build_state`) and that
dictionary is stored with its verdict. Its reply is JSON, requested with
Ollama's structured `format` and then validated by `reasoning.schema`:
severity forced into the enum, lists capped, unknown `safe_actions` dropped
and listed in `dropped`. When Ollama is down or the model is not pulled,
`assess` runs the rules reasoner and prefixes the rationale with the
reason, so a rules answer is never mistaken for a model's.

## Control boundary

`control.permissions.ACTIONS` is the only place tiers live. Unknown
actions are FORBIDDEN. `control.safety.check` enforces parameter bounds,
configured hard limits (lighting range, heater step and setpoint window,
portions per day), pump modes, rate limits from the journal, and the halt
switch. `ControlExecutor.approve` is the owner's yes and still runs the
same check, so approval never overrides a limit. A test pins the reasoner's
proposable actions to the AUTO tier.

## Storage

SQLite, schema in `fishai/storage/schema.sql`, one repository class in
`fishai/storage/db.py`. RAW tables (`observations`, `sensor_readings`) are
append-only in normal operation; re-processing a video clears and rewrites
that video's rows. DERIVED tables can be recomputed at any time.
`docs/DATA.md` has the column-level description and the retention plan.

## Evaluation

`fishai.evaluation` scores predictions against ground truth: precision,
recall, F1, mean IoU for detection; id switches, fragments per fish, purity
for tracking. `SyntheticAquarium` produces ground truth for free; the same
functions accept a labelled real clip. `tests/test_evaluation.py` guards
the motion detector's published numbers.
