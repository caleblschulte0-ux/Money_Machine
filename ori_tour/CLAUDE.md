# ori_tour: notes for Claude sessions

Open Range Interactive (ORI) builds phone-free augmented-reality walking tours
for AR glasses. ORI writes the software; destinations (parks, museums,
historic sites) rent it. First site: Falls Park, Sioux Falls, SD, three stops
(the falls; the river and the Dakota; the Queen Bee Mill), aiming at a free,
supervised public pilot in spring 2027. Caleb Schulte is the founder; Claude
runs the build. This folder is the tour player and its content package.

## Rules that do not bend

- **Never fabricate.** Only history a source on the stop supports. Where
  research is thin the stop says so in `todo` and the narration says it is
  still being researched. No invented people, scenes, quotes, visitors or
  installations, in words or in art.
  - The falls geology narration is a **TODO with no verified source**. Do not
    use the promo's "twelve thousand years ago" line until it is sourced.
  - The Dakota stop is a **draft pending advice from Dakota tribal historic
    preservation offices** (Flandreau Santee Sioux, Sisseton-Wahpeton). Its
    words, any image, and how the generated voice pronounces Oceti Sakowin
    all wait on that review. Scene art there only with Dakota guidance.
  - Mill content waits on a Siouxland Heritage Museums check.
- **The app never claims what is not built.** The promo video describes
  recognising what you look at, water-edge cutoff and group audio sync; none
  of that exists. Offline play now does (below).
- **Pictures only when the visitor stands still.** Walking is audio only.
  This is a safety rule; do not weaken it to make a demo smoother.
- No model identifiers in commits, PR text or code.

## Defaults in force (Caleb can overrule any of them)

- **Scenes are 2.5D**: layered photos and illustrations with motion, not 3D.
- **Narration voice is generated** (Kokoro-82M, Apache-2.0, run locally),
  marked on every stop as a placeholder until a human narrator records.
- **Code lives here**, Money_Machine `ori_tour/`, on the tour branch with
  draft PR #12 as the record.

## Architecture: one core, thin shells

```
js/core/      device-agnostic, pure, runs in Node and the browser
  tour.js       load + validate the content package, on-site placement edits
  geo.js        distance, bearing, turn
  heading.js    compass smoothing: spike rejection, circular time-based filter, steadiness
  stillness.js  walking vs still from GPS + accelerometer, with dwell hysteresis
  engine.js     THE loop: geofence -> facing -> still -> narrate -> next stop
  replay.js     play a recorded walk (ori.trace/1 JSON or GPX) through the engine
js/device/    browser sensor adapters (GPS, compass, accelerometer, simulator, recorder)
js/ui/        scene window, narrator (audio + cue captions, device-voice fallback), route map
js/shells/    runtime.js (engine + narrator + sources, shared guidance text)
              phone.js (full UI), glasses.js (600x600 additive: scene, guidance, captions)
js/dev/       synthwalk.js: a SYNTHETIC walk generated from route geometry, for tests
js/app.js     boot: load package, build runtime, mount the shell for ?display=
sw.js + offline.json   offline cache of the app and the whole package
content/<tour>/        tour.json (schema ori.tour/1), map.json, audio/, traces/
tools/        build_map.py, make_narration.py, build_offline.py
test/         node --test, headless
```

Shells never decide anything: they feed the engine raw timestamped readings
and draw `engine.state`. A new device (Snap Spectacles in Lens Studio
TypeScript, an Android wrapper for XREAL/RayNeo) is a new shell that reads the
same `tour.json` and ports `js/core` behaviour, and `test/` is the spec it has
to match.

The engine's events: `narrate` (shell plays it and calls `narrationEnded`),
`stop-done`, `tour-done`. Walking on to the next stop mid-narration counts the
earlier stop as done, so the tour can always complete.

## Run and test

```bash
cd ori_tour
python3 -m http.server 8000      # any static server; no build, no dependencies
node --test                      # 15 headless tests, a couple of seconds
```

URL switches: `?sim=1` (tap the map to stand, slider to turn),
`?autostart=sim&demo=1&speedup=8` (walks itself), `?replay=synthetic` or
`?replay=<file in content/<tour>/traces/>` (a walk through the real engine),
`?record=1` (records GPS, compass and motion; "Save the walk" downloads an
ori.trace/1 file), `?display=glasses` (600x600), `?edit=1` (place stops on
site, export tour.json), `?facing=off` (device with no compass: arrival +
stillness shows the scene), `?offline=off`.

GPS, compass and camera need HTTPS or localhost. iOS asks for motion
permission on the Start tap.

## After changing things

- Changed narration text: `KOKORO_DIR=<models> python3 tools/make_narration.py`
  (model files and setup in the script's docstring; Hugging Face is blocked
  from cloud sessions, the GitHub release works). The tests fail if text and
  audio disagree (`text_sha`).
- Changed any app or content file: `python3 tools/build_offline.py`. The tests
  fail if `offline.json` is stale or misses a file.
- Moved a stop: `python3 tools/build_map.py` re-routes the legs.
- A real recorded walk goes in `content/<tour>/traces/` and is replayed by the
  tests from then on. The synthetic walk is generated, not recorded; say so
  wherever it is used.

## The plan (Caleb agreed 2026-10-05)

1. Core/shell split, compass smoothing, stillness, walk replay, generated
   audio, offline cache: **done** (phase two).
2. Make the phone version real: a hosted URL, one recorded walk at the park
   (Caleb, `?record=1`), placement fixes from `?edit=1`.
3. Content pipeline: folder in, validated bundle out, so site two is a
   weekend. 2.5D scene layers (`scene.layers`, resolved by `tour.js`, not yet
   drawn by `ui/scene.js`).
4. Device shells as hardware appears: Snap Spectacles (Lens Studio, has GPS,
   heading and world anchors), Meta Ray-Ban Display (600x600 heading-gated
   cards; whether its Web Apps expose a compass heading is the first thing to
   test, `?facing=off` is the fallback), Android wrapper for XREAL/RayNeo.
   Lens Studio and Android builds need Caleb's computer.
5. Operator tools last: kiosk reset, battery/location dashboard, play counts.

Company context (outreach, funding, City, hardware research) lives in the
project files under `ori/`, not in this repo.
