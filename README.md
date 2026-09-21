# FishAI (working name)

An AI aquarium monitoring system. A camera watches the tank; small
perception models detect and track each fish and turn their behaviour into
numbers; the numbers are compared with each fish's own learned baseline; a
local reasoning model (Qwen via Ollama) explains deviations and proposes
safe next steps; a deterministic safety layer decides what may actually run.

```
camera / sensors -> specialised perception models -> structured aquarium state -> local Qwen -> safe actions
```

The reasoning model never sees a video frame. It sees this:

```json
{"fish_id": 3, "activity_vs_baseline": -38, "surface_time_vs_baseline": 220,
 "feeding_response": "low", "temperature": 78.2, "dissolved_oxygen": 5.1}
```

## Status (2026-09-21)

| Phase | What | State |
|---|---|---|
| 1 | Eyes: video -> detection -> tracking -> telemetry -> SQLite -> JSON -> annotated video | **Working.** 83 tests. Runs with no model at all (motion detector) or with the Fishial YOLO detector + ByteTrack. Verified on real aquarium footage. |
| 2 | Identity: keep Fish #3 as Fish #3 | **First rung.** Appearance re-id inside a clip and across clips (colour histograms), confidence exposed, fragments merged only when they never coexist. Deep re-id: not built. |
| 3 | Behaviour: activity, zones, surface time, hiding | **Measured.** Feeding, aggression, erratic swimming: not built (see docs/ROADMAP.md). |
| 4 | Baselines per fish per tank, deviations | **Working.** Rolling window, prior-sessions-only comparison, z-score and percent thresholds. |
| 5 | Local Qwen reasoning | **Working with a fallback.** Ollama client with schema-validated JSON; deterministic rules when no model is reachable, and the result says which one answered. |
| 6 | Sensors | **Simulators + file bridge.** Temperature, water level, pH, dissolved oxygen simulators; a JSON-file sensor for any logger. No hardware driver yet. |
| 7 | Control | **Permission system + simulated actuators.** AUTO / APPROVAL / FORBIDDEN tiers, deterministic limits, rate limits, journaled. No hardware driver yet. |

See `docs/ROADMAP.md` for what is deliberately not built.

## Quick start (Windows)

```powershell
git clone <this repo> FishAI
cd FishAI
.\scripts\setup.ps1            # venv, dependencies, model weights, tests, doctor
.\scripts\run.ps1 demo         # synthetic tank through the whole pipeline
.\scripts\run.ps1 process C:\videos\tank.mp4 --detector yolo --tracker bytetrack --then-baseline
.\scripts\run.ps1 assess latest
```

`setup.ps1 -NoML` skips torch and gives you the model-free pipeline only.
Linux/macOS: `./scripts/setup.sh`, then `python -m fishai ...`.

Requirements: Python 3.10+, git. Optional: [Ollama](https://ollama.com)
with `ollama pull qwen2.5:7b` for the reasoner; an NVIDIA GPU
(`setup.ps1 -Gpu`) for faster detection.

## What a run produces

`fishai process tank.mp4` writes, under `runs/`:

- `tank.summary.json`: per-fish activity score, speed, zone fractions and
  times, missing time, hiding flag, identity confidence, plus tank-wide
  means and pipeline provenance (detector, tracker, config hash).
- `tank.annotated.mp4`: boxes, ids, trails, zone lines.
- Rows in `runs/fishai.db`: raw per-frame observations (never rewritten),
  derived track summaries, fish identities, baselines, anomalies, sensor
  readings, events, assessments and control actions. Schema in
  `fishai/storage/schema.sql`, described in `docs/DATA.md`.

## Commands

```
fishai demo                       synthetic tank through the pipeline (no model needed)
fishai process VIDEO...           detect, track, measure, store, summarise, annotate
fishai baseline                   recompute per-fish baselines from all sessions
fishai deviations [VIDEO_ID]      compare a session to its baselines
fishai assess [VIDEO_ID] [--act]  run the reasoner; --act sends proposals through the safety layer
fishai sensors [--store]          read configured sensors
fishai control ACTION k=v         request an action (AUTO runs, APPROVAL waits, FORBIDDEN refuses)
fishai approve ACTION k=v         the owner's yes for an APPROVAL action; limits still apply
fishai status                     what the database holds
fishai doctor                     what is installed, downloaded and will actually run
```

Every command takes `--config FILE` and `-o key.path=value` overrides; all
tunables are in `configs/default.yaml`.

## Layout

```
fishai/                 the package (importable; `python -m fishai`)
  video/                reader, writer, synthetic aquarium generator
  perception/detection  motion (no model), yolo (Fishial / any ultralytics), synthetic
  perception/tracking   built-in IoU + appearance re-id tracker; ByteTrack adapter
  perception/behavior   telemetry, track summaries, baselines and deviations
  perception/classification  cross-session fish identity (species: not built)
  pipeline/             process_video, annotation, JSON summary
  storage/              SQLite schema and repository
  reasoning/            schema-validated assessments; Ollama/Qwen client; rules fallback
  sensors/              sensor interface, simulators, file bridge
  control/              permission tiers, safety rules, actuators, executor
  evaluation/           detection/tracking scoring against ground truth
configs/default.yaml    every tunable
models/registry.json    downloadable weights, URLs, checksums, licences (weights git-ignored)
scripts/                setup.ps1, run.ps1, setup.sh, download_models.py
tests/                  pytest suite (runs without torch; ML tests skip when absent)
docs/                   ARCHITECTURE, DATA, THIRD_PARTY, ROADMAP, SETUP
```

## Principles that shaped the code

- **Small models watch, the LLM reasons.** Perception is deterministic and
  cheap; the reasoner gets numbers with citations, not pixels.
- **Replaceable parts.** Detector, tracker, reasoner, sensors and actuators
  are registries behind small interfaces. Swapping Fishial for a detector
  you trained is a registry entry and a config line.
- **Honest confidence.** Identity after an occlusion carries the re-link's
  similarity; the motion detector says its confidence is a heuristic; an
  assessment says whether Qwen or the rules produced it.
- **Nothing reaches hardware without deterministic rules.** The model may
  propose seven named actions; the permission table and the safety limits
  decide, and every request is journaled, including refusals.
- **Raw and derived data are separate.** Observations are never rewritten;
  summaries, baselines and anomalies can always be recomputed from them.
- **GitHub is the source of truth.** Weights, video and databases stay on
  the machine; everything that makes them reproducible is here.

## Licensing of third-party parts

Read `docs/THIRD_PARTY.md` before building a commercial product on the
default detector: ultralytics is AGPL-3.0 and the Fishial weights carry no
separate licence statement. The code here isolates that dependency behind
one adapter so it can be replaced.
