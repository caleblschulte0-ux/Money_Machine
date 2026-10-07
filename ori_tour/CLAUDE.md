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
- **Pictures only when the visitor stands still**, with one exception:
  between stops, walking is audio only. At a stop, a world-locked figure may
  stay visible while the visitor walks around it (Caleb's requirement,
  2026-10-06; the exception is that narrow on purpose). This is a safety rule;
  do not widen it to make a demo smoother.
- No model identifiers in commits, PR text or code.

## Caleb's top requirement (2026-10-06): figures that sit in one spot

*"Things need to be able to sit in one spot, like a mammoth, or a settler."*
A 3D figure is put on the ground and STAYS there, in the world, while the
visitor walks all the way around it, walks away and comes back. This replaces
the earlier default of heading-gated 2.5D cards with no world-locked figures
outdoors, and it decides which glasses are viable (the comparison is in the
project files, `ori/build/glasses-world-locked-figures.md`: Snap Spectacles
can; Meta Ray-Ban Display cannot).

- **Built (PR #14):** `WorldTracker` port (optional persistence),
  `FigureStage` (`src/core/anchoring.ts`, free placement), `TourFigures`
  (`src/core/tourfigures.ts`, figures inside the tour), pose math
  (`space.ts`), the figure catalogue (`figures.ts`), and `ar.html`
  (`src/web/ar.ts`): "Walk the tour here", "Start at the park", "Just place a
  figure". Android Chrome with ARCore runs it in the page (`src/web/xr.ts`,
  WebXR hit-test + anchors). iPhone has no WebXR AR: the tour runs in the page
  and "See the mammoth here" opens the figure's USDZ in Apple's AR Quick Look
  (`src/web/quicklook.ts`), which anchors it but runs outside our page.
- **Figures in the tour:** `stop.figure` in tour.json (model, scale,
  `offset_m` and `bearing_deg` from the stop, `yaw_deg`, `anchoring`
  auto|tap, `note`), validated by `validateTour` and the schema. Falls:
  mammoth skeleton 9 m toward the falls. Mill: settler. Dakota: no figure
  until the Dakota THPOs advise. Positions are provisional, to be set on
  site. On arrival `TourFigures` learns north in tracking space from
  compass/tracking-yaw pairs and puts the figure on the ground near its spot
  with no tap; GPS (±5 m) and compass (a few degrees) error means NEAR, not
  on. If GPS, compass or ground is not good enough within 12 s it asks for a
  tap. Between stops the figure is taken down (audio only).
- **Real models, open licences only** (`assets/figures/`, credits in
  `CREDITS.md`, `figures.ts` `credit`): the Smithsonian woolly mammoth
  skeleton scan (CC0, true size 3.44 m), SDPM Esare's mammoth calf (CC BY
  4.0), Quaternius's stylised cowboy as "settler" (CC0, no period claim).
  No open realistic fleshed adult mammoth or realistic settler exists that we
  found. glb is meshopt-compressed; USDZ is made from it by
  `node tools/build_figures.mjs --usdz` (also `--views <dir>` to check which
  way each model faces, `--measure` for load time on a throttled
  connection). Budgets in `figures.ts`, held by `test/figures.test.ts`.
  The drawn stand-ins (`src/web/figures3d.ts`) show if a model fails to load.
- **What a web page cannot do (say so, do not paper over it):** Chrome on
  Android has no persistent anchors, so a screen lock ends the AR session
  and the anchor is gone; "Back to AR" starts a new session and the figure is
  re-placed from the stop's position, not the exact spot. Where a browser
  has persistent anchors (Quest Browser), the handle is stored and the figure
  comes back exactly. "The mammoth stands on THE spot at the park every
  visit" needs a device that re-finds a scanned place (Snap Custom
  Locations, ARCore Geospatial/cloud anchors), not reachable from a phone web
  page.

## Defaults in force (Caleb can overrule any of them)

- **Scenes are 2.5D** where a stop has no figure: layered photos and
  illustrations with motion.
- **Narration voice is generated** (Kokoro-82M, Apache-2.0, run locally),
  marked on every stop as a placeholder until a human narrator records.
- **Code lives here**, Money_Machine `ori_tour/`. Branch
  `claude/ori-tour-app-f8hh67-w6ho3n` (PR #13) stacks on PR #12's branch
  `claude/ori-tour-app-f8hh67`; merging #13 folds it into #12. The figures
  work is `claude/ori-anchored-figures-5k24tv` (PR #14), stacked on #13.

## Caleb's standing requirements (2026-10-05)

- **Enterprise-level foundation**: typed code, tests that run headless,
  lint, format and CI on every push, a versioned and validated content
  schema, and docs a stranger can run and extend from.
- **Easy to port, universal**: the glasses are undecided. Portability is the
  top design constraint. The core stays platform-free; a new device is a set of
  adapters (docs/PORTING.md). Never put device code in `src/core`.
- **First test is his phone in a parking lot**, not the park: test-anywhere
  mode (`?here=1`) must keep working.

## Architecture: a portable core behind ports

```
src/core/     TypeScript, platform-free. Compiled with NO DOM and NO Node types
              (tsconfig.core.json); lint refuses window/navigator/fetch/timers/Date.now.
  ports.ts      THE porting contract: LocationSource, HeadingSource, MotionSource,
                Clock, Scheduler, AudioPort, Display, AssetLoader, Storage, WorldTracker
  space.ts      vectors, quaternions, poses in a device's tracking space
  anchoring.ts  FigureStage: place a figure, keep it in one spot, prompts (world-locked figures)
  figures.ts    the figures (mammoth, mammoth calf, settler), true sizes, model files, credits
  tourfigures.ts  TourFigures: each stop's figure placed near the stop, kept, taken down, restored
  types.ts      the content package types (ori.tour/1)
  tour.ts       version check, validation, asset paths, on-site placements
  geo.ts        distance, bearing, turn, offset
  heading.ts    compass smoothing: spike rejection, circular time-based filter, steadiness
  stillness.ts  walking vs still from accelerometer + GPS, dwell hysteresis, stale-fix rule
  engine.ts     THE loop: geofence -> facing -> still -> narrate -> next stop
  view.ts       ViewModel: what any display shows and says, decided once
  session.ts    TourSession: engine + ports. All a port gets for free.
  relocate.ts   test anywhere: move the tour around the tester, scaled to a parking lot
  replay.ts     replay a recorded walk (ori.trace/1 or GPX) on a virtual clock
  synthwalk.ts  a SYNTHETIC walk from route geometry, for tests (labelled as such)
  text.ts       caption sentence rule (shared with tools/make_narration.py)
src/web/      browser adapters: platform (clock, fetch, storage), sensors (GPS,
              compass, accelerometer, simulator, replay, recorder), audio, scene,
              map, hud (sensor readout), shells/phone.ts, shells/glasses.ts, app.ts;
              figures: xr.ts (WebXRTracker), quicklook.ts (iPhone), figures3d.ts, ar.ts
vendor/       three.js bundled by tools/vendor_three.mjs (the build runs it), MIT
ar.html       the figure page: the tour with figures in AR, and free placement
assets/figures/  figure models (glb + usdz), credited in CREDITS.md
dist/         compiled JS, COMMITTED (static hosting has no build step); CI fails if stale
schemas/      JSON Schemas: ori.tour-1 (content), ori.trace-1 (recorded walks)
docs/PORTING.md   what a Lens Studio, Android or Ray-Ban port implements, and its acceptance test
sw.js + offline.json   offline cache of the app and the whole package
content/<tour>/        tour.json, map.json, audio/, traces/
tools/        build_map.py, make_narration.py, build_offline.py, vendor_three.mjs,
              build_figures.mjs (USDZ export, orientation views, throttled load time)
test/         node:test on the TypeScript source (Node strips types), headless
```

Displays never decide anything: they draw the ViewModel. The engine's events:
`narrate` (the session plays it through the AudioPort and reports the end),
`stop-done`, `tour-done`. Walking on to the next stop mid-narration counts the
earlier stop as done, so the tour can always complete.

## Run and test

```bash
cd ori_tour
npm ci                            # dev tools; three.js is bundled into vendor/ by the build
npm run build                     # tsc -> dist/, vendor/three.js, then offline.json
npm run check                     # typecheck (core with no DOM), lint, format, tests
npm run serve                     # http://localhost:8000
```

CI: `.github/workflows/ori-tour.yml` runs the same checks plus "dist and
offline.json match the source" on every push touching `ori_tour/`.

URL switches: `?here=1` (test anywhere: stops moved around you, readout and
camera on), `?hud=1` (sensor readout), `?sim=1` (tap the map to stand, slider
to turn), `?autostart=sim&demo=1&speedup=8` (walks itself),
`?replay=synthetic` or `?replay=<file in content/<tour>/traces/>`,
`?record=1` ("Save the walk" downloads an ori.trace/1 file),
`?display=glasses` (600x600), `?edit=1` (place stops on site, export
tour.json), `?facing=off` (no compass: arrival + stillness shows the scene),
`?offline=off`.

GPS, compass and camera need HTTPS or localhost. iOS asks for motion
permission on the Start tap.

Figures: `ar.html` (Android: Chrome with ARCore; iPhone: Safari, Quick
Look). Hosted at
`https://raw.githack.com/caleblschulte0-ux/Money_Machine/claude/ori-anchored-figures-5k24tv/ori_tour/ar.html`.

Hosted: `https://raw.githack.com/caleblschulte0-ux/Money_Machine/claude/ori-tour-app-f8hh67-w6ho3n/ori_tour/index.html`
(an interstitial page first; checked from outside with Apify web-fetch, because
the cloud agent proxy blocks githack, jsDelivr and github.io). GitHub Pages from
that branch gives a clean URL once Caleb enables it in repo settings.

## After changing things

- Any source change: `npm run build` and commit `dist/`, `vendor/` and `offline.json`.
- Changed narration text: `KOKORO_DIR=<models> python3 tools/make_narration.py`
  (model files and setup in the script's docstring; Hugging Face is blocked
  from cloud sessions, the GitHub release works). The tests fail if text and
  audio disagree (`text_sha`).
- Changed the package shape: update `src/core/types.ts`, `validateTour` and
  `schemas/ori.tour-1.schema.json` together; `test/schema.test.ts` holds them
  in agreement. A breaking change is `ori.tour/2`, never a silent edit to /1.
- Moved a stop: `python3 tools/build_map.py` re-routes the legs.
- A real recorded walk goes in `content/<tour>/traces/` and is replayed by the
  tests from then on. The synthetic walk is generated, not recorded; say so
  wherever it is used.

## The plan (Caleb agreed 2026-10-05)

1. Core/shell split, compass smoothing, stillness, walk replay, generated
   audio, offline cache: **done** (phase two). TypeScript core behind ports,
   CI, schema, test-anywhere mode, porting guide: **done**.
2. Make the phone version real: a hosted URL, one recorded walk at the park
   (Caleb, `?record=1`), placement fixes from `?edit=1`.
3. Content pipeline: folder in, validated bundle out, so site two is a
   weekend. 2.5D scene layers (`scene.layers`: drawn with heading parallax by
   `src/web/scene.ts`; no stop has real layer art yet).
4. Device shells as hardware appears: Snap Spectacles (Lens Studio, has GPS,
   heading and world anchors), Meta Ray-Ban Display (600x600 heading-gated
   cards; whether its Web Apps expose a compass heading is the first thing to
   test, `?facing=off` is the fallback), Android wrapper for XREAL/RayNeo.
   Lens Studio and Android builds need Caleb's computer.
5. Operator tools last: kiosk reset, battery/location dashboard, play counts.

Company context (outreach, funding, City, hardware research) lives in the
project files under `ori/`, not in this repo.
