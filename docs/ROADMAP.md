# Roadmap

Honest state per phase. "Not built" means there is no code path; nothing
in the repo pretends otherwise.

## Done (2026-09-21)

- Repository foundation, Windows setup (`setup.ps1`), model download with
  checksums and licence notes, CI on Ubuntu and Windows.
- Phase 1: video ingestion, detection (motion / YOLO), tracking (built-in /
  ByteTrack), telemetry, SQLite, JSON summary, annotated video. Verified on
  synthetic ground truth (F1 0.89 motion-only) and on real aquarium clips
  with the Fishial detector (2 to 4 fish per frame at 0.8 to 0.9 confidence).
- Phase 2, first rung: appearance re-identification within a clip (a fish
  hidden 3 s returns with its id and a 0.93 confidence) and across clips.
- Phase 3, first metrics: activity, zone usage, surface time, hiding gaps.
- Phase 4: per-fish rolling baselines and deviation detection.
- Phase 5: Ollama/Qwen reasoner with schema validation and rules fallback.
- Phase 6: sensor interface with simulators and a file bridge.
- Phase 7: permission tiers, deterministic safety rules, simulated actuators.

## Next

1. **Live loop.** `fishai watch --source 0` reading a camera continuously,
   writing telemetry, rolling video buffer, event clips, retention. All
   pieces exist; the loop and the buffer do not.
2. **Feeding.** A `feeding` event (manual now, feeder later) plus per-fish
   approach latency, time near the food zone, and feeding-response baseline.
   Needs a food-zone definition in config.
3. **Behaviour classifiers.** Chasing (two tracks with sustained pursuit
   geometry), erratic swimming (acceleration variance), lethargy (activity
   under baseline for N sessions), circular movement (turning-rate
   histogram), loss of balance (box aspect-ratio anomalies). Each as a
   measured metric with a baseline, never as a diagnosis.
4. **Identity, second rung.** Deep re-id embeddings behind
   `appearance.describe`, species from Fishial classification as a hard
   constraint on matching, and a per-fish confidence history.
5. **Real sensors.** First a serial/USB temperature probe and a water-level
   float via the `file` bridge or a new `kind`; then pH and DO.
6. **Real actuators.** Smart plug for aeration/light first (reversible), then
   a feeder. Heater control stays APPROVAL-tier with the 1 F step.
7. **Data strategy.** Export reviewed boxes to a YOLO-format dataset under
   `datasets/manifests/`, a `training/` script for an Apache-licensed
   detector, and an evaluation run against the Fishial baseline.
8. **Owner feedback.** `fishai confirm <anomaly_id> --outcome ...` to record
   ground truth for what the system flagged.

## Deliberately not built

Branding, mobile app, dashboards beyond the annotated video, custom lid or
PCB, cloud infrastructure, foundation-model training, disease diagnosis,
autonomous chemical dosing. The permission table makes dosing an
APPROVAL action with a 5 ml ceiling and never proposable by the model.

## Known limitations

- The motion detector merges touching fish and is fooled by bubbles and
  swaying plants; it is a bootstrap and says so in every summary's notes.
- Colour-histogram identity cannot separate same-species look-alikes.
- ByteTrack via the `trackers` package returns ids from 0; the built-in
  tracker from 1. Ids are per run, not stable names; `fish_id` is.
- The Fishial detector runs at roughly 0.25 to 0.7 s per 960 px frame on a
  CPU; use `video.frame_stride` or a GPU for long footage.
