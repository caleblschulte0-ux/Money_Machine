# Open Range Interactive — AR tourism glasses promo

34-second vertical promo (1080x1920, 30fps) built 2026-08-13 from the raw
Falls Park footage in the `ORI video` folder of the
openrangeinteractive@gmail.com Google Drive.

`ORI_promo.mp4` is the web-quality render (CRF 24). The full-quality master
(CRF 18, ~43MB) is reproducible by re-running the build.

## Structure of the cut

| Time | Shot | Overlay | VO |
|---|---|---|---|
| 0–4.4 | IMG_6682 falls close-up | hook title | "Some of the best stories in America are standing right in front of you." |
| 4.4–7.0 | IMG_6709 plaque text pan | — | "But today, they live on plaques and little signs…" |
| 7.0–9.9 | IMG_6796 visitor at marker | — | "…and most people walk right past." |
| 9.9–14.5 | IMG_6799 overlook over-shoulder | brand lower-third | "Open Range Interactive is building AR glasses made for travel." |
| 14.5–17.9 | IMG_6806 pointing at falls | HUD + Queen Bee Mill card | "Put them on, and the place starts talking. The mill from 1881…" |
| 17.9–21.2 | IMG_6804 POV rapids | HUD + Big Sioux River card | "…the river at full flood…" |
| 21.2–24.3 | IMG_6798 skybridge | HUD + wayfinding card | "…the history, pinned to the exact spot where it happened." |
| 24.3–28.1 | IMG_6805 walking the park path | — | "No tour group. No phone in your face. You just look." |
| 28.1–34 | IMG_6682 wide + scrim | end card | "Open Range Interactive. See the story where you stand." |

The three AR cards simulate the glasses UI: glass-dark rounded card, cyan
corner brackets, connector line to an anchor dot on the landmark, plus a
full-frame "ORI VISION / SITE RECOGNIZED" viewfinder on a blurred
letterbox — the "through the glasses" treatment.

Facts on the cards are real: Queen Bee Mill built 1881 (Sioux quartzite
ruins at Falls Park), Big Sioux River falls average ~7,400 gallons/second.

## Rebuilding

```
python3 make_overlays.py   # draws every overlay PNG (PIL; Anton font from Shorts-pipeline assets)
python3 synth_music.py     # license-clean synthesized music bed
python3 build_promo.py     # cuts, overlays, VO+music+SFX mix, mux
```

Requires: ffmpeg, pillow, numpy, edge-tts (voice `en-US-AndrewNeural`).
Raw footage is downloaded per `manifest.txt` (Drive file IDs; all files are
link-shared). Accent SFX (whoosh/pop/riser/boom) come from
`Shorts-pipeline/assets/sfx/` — procedurally generated there, license-clean.
VO lines live in `vo/vo_lines.py`.

QA: passes `Shorts-pipeline`'s `python -m shared.video_qa`
(no black/freeze/silence, loudness −14.8 LUFS).
