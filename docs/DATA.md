# Data: what is kept, where, and why

## Two kinds of data

**Raw** rows are what the perception layer saw. They are preserved as-is so
every derived number can be recomputed when the arithmetic improves.

**Derived** rows are computed from raw rows and may be rebuilt at any time.

| Table | Kind | One row per | Notes |
|---|---|---|---|
| `videos` | provenance | processed video | detector, tracker and config hash used |
| `observations` | RAW | tracked fish x processed frame | box, confidence, centre, normalised position, zone, displacement, speed (px/s and tank-heights/s), identity confidence |
| `track_summaries` | derived | track x video | duration, distance, speeds, activity score, zone fractions and times, gaps, mean box area, `extra_json` (hiding candidate, gap count) |
| `fish` | derived (registry) | long-term fish | appearance descriptor, first/last seen, session count, optional owner-given name |
| `fish_identities` | derived | track x video | which fish a track was linked to, confidence, method |
| `baselines` | derived | fish x metric | mean, std, min, max, window values |
| `anomalies` | derived | deviation found | value, baseline, z, percent, direction, severity |
| `sensor_readings` | RAW | reading | value, unit, `source` (simulated / hardware / file) |
| `events` | RAW | event | feeding, video processed, halt/resume, **owner-confirmed outcomes** |
| `assessments` | derived | reasoner call | the exact state shown to the model and its validated output |
| `actions` | RAW | control request | action, params, who asked, tier/permission, executed, reason |
| `clips` | RAW (index) | saved clip | kind (feeding / deviation / tracking_loss / request), path, session, event, span, size |
| `feeding_responses` | derived | fish x feeding event | approached, latency, zone fraction before/after, activity before/after |

## Where files live

| Thing | Location | Committed? |
|---|---|---|
| Source, configs, schema, scripts, tests, docs | repo | yes |
| `models/registry.json` | repo | yes |
| Model weights | `models/<key>/` | no (`.gitignore`); `scripts/download_models.py` |
| Raw video | wherever you keep it; `fishai process` takes a path | no |
| Annotated video, JSON summaries | `paths.output_dir` (default `runs/`) | no |
| SQLite database | `paths.database` (default `runs/fishai.db`) | no |
| Datasets for training | `datasets/` (git-ignored) with a committed manifest in `datasets/manifests/` when one exists | manifests only |

Large binaries never go through git. If a curated dataset or a trained
checkpoint needs to be shared, use a GitHub Release asset or external
storage and record its URL and checksum in `models/registry.json` or a
dataset manifest.

## Video identity

A video's id is a hash of its size, name and first/last megabyte, so the
same file processed on two machines gets the same id and re-processing
replaces rather than duplicates.

## Retention (24/7 operation)

Built (`fishai/retention.py`, run at every live session end and by
`fishai maintain`):

- **Always:** track summaries, identities, baselines, anomalies, events,
  assessments, actions, feeding responses.
- **Raw observations** for `retention.observations_days` (14): a day of 10
  fps telemetry for 6 fish is roughly 5 million small rows, so they are
  pruned once summaries exist. Recompute nothing you cannot: summaries are
  derived before pruning.
- **Event clips:** the rolling buffer (`live.buffer_s`) plus `live.clip_post_s`
  on feeding, deviation, tracking loss and request; deleted after
  `retention.clips_days` or oldest-first beyond `retention.clips_max_gb`,
  except clips from sessions with an owner confirmation.
- **Nothing else** in raw form: routine footage is never written to disk.

## The dataset this produces

Every processed session adds: tracks, behaviour metrics, feeding events
(when built), sensor readings, environmental changes and, most valuable,
owner-confirmed outcomes recorded as `events`. That combination is the
proprietary dataset. Bootstrap order:

1. Third-party detector (Fishial) produces boxes on our footage;
   `fishai export dataset` writes them as YOLO labels with a manifest that
   says they are model-assisted, not ground truth.
2. Human review corrects a sample (model-assisted, never box-by-box from
   scratch); SAM-style tools can tighten boxes to masks.
3. Train our own detector on the reviewed set (Apache-licensed family).
4. Reduce dependence on third-party weights.
