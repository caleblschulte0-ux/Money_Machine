# Porting the tour to a new device

ORI has not picked its glasses yet, so the player is built to be moved. A
device port is **a set of adapters plus a display**. The tour logic is not
rewritten. Everything a port has to provide is declared in
[`src/core/ports.ts`](../src/core/ports.ts); everything else is in
`src/core`, which has no browser, Node or device code in it. CI enforces that:
`tsconfig.core.json` compiles the core with no DOM and no Node types, and lint
refuses `window`, `navigator`, `fetch`, timers and `Date.now()` in `src/core`.

```
                     ┌──────────────────────── src/core (portable) ───────────────────────┐
 LocationSource ───► │                                                                     │
 HeadingSource  ───► │  TourSession ──► TourEngine (geofence → facing → still → narrate)  │ ──► Display.render(ViewModel)
 MotionSource   ───► │     │             HeadingFilter, StillnessDetector                 │ ──► AudioPort.play(narration)
 Clock/Scheduler ──► │     └─ buildView: what to show and say, decided once               │
 AssetLoader    ───► │  tour.json (ori.tour/1), validated                                  │
                     └─────────────────────────────────────────────────────────────────────┘
```

## What a port implements

| Port | Job | Web adapter (reference) | Notes for a port |
|---|---|---|---|
| `LocationSource` | Raw position readings `{t, pos, accuracy, speed}` or `{t, error}` | `GeolocationSource` | Raw is right; the core averages and judges stillness. Send fixes as they come, even when not moving if the platform allows. |
| `HeadingSource` | Raw compass heading, degrees from **true** north, of where the visitor faces | `CompassSource` | Optional. Without it, run the session with `requireFacing: false`: arriving and standing still shows the scene. `request()` is for platforms that need a permission tap. |
| `MotionSource` | Magnitude of acceleration **including gravity**, m/s², 10–50 Hz | `AccelerometerSource` | Optional but strongly recommended: footsteps make "standing still" fast and reliable. |
| `Clock` / `Scheduler` | Time in ms; a repeating timer (~250 ms) | `wallClock`, `intervalScheduler` | Tests and replays use a virtual clock, so never read the time anywhere else. |
| `AudioPort` | Play narration, report caption lines, call `onEnd` exactly once | `WebAudio` | Prefer the package's pre-generated audio (`narration.audio` + `cues`). With no audio output, still step the captions at reading pace (`readingMs` in `core/text.ts`) and end. |
| `Display` | Draw the `ViewModel`; optional `notify(text)` | `PhoneDisplay`, `GlassesDisplay` | The ViewModel already says what to show: scene or guidance, the guide line and arrow, the caption, status, and a sensor readout. Do not re-derive any of it. |
| `AssetLoader` | Read package files (`json`, `text`) | `fetchAssets` | Lens Studio: bundled assets. Android: app assets or a downloaded package. |
| `Storage` | Small key-value store | `browserStorage` | On-site placements, and persistent anchor handles for figures. |
| `WorldTracker` | World tracking for figures that stay in one spot: viewer pose, ground under the aim point, anchors | `WebXRTracker` (`src/web/xr.ts`) | Optional; only devices with 6DoF tracking. Poses in tracking space (`core/space.ts`: metres, +y up, right-handed, viewer looks down -z). `createAnchor` returns null where the device cannot anchor; the core then holds the figure by tracking alone and says so. Optional `persistAnchor` / `restoreAnchor` / `forgetAnchor` let a figure survive a restart where the platform keeps anchors (Lens Studio, ARCore cloud or Geospatial anchors, Quest Browser); leave them out and the figure is re-placed from the stop's position instead. |

Then construct and start a session:

```ts
const { tour } = await loadTour("content/falls-park/", assets);
const session = new TourSession(tour, { clock, scheduler, audio, display }, { requireFacing: hasCompass, hasMap });
await session.start({ location, heading, motion }); // from a user gesture where the platform needs one
// controls: session.calibrate(), session.force(), session.skip()
```

[`test/session.test.ts`](../test/session.test.ts) does exactly this with fake ports, so it is
both the proof that the core runs without a browser and the shortest working
example of a port.

### World-locked figures

Two core classes do all of it; a port supplies a `WorldTracker` and draws.

- **`TourFigures`** (`src/core/tourfigures.ts`) is the tour's figure logic.
  Each frame, give it the `TrackedFrame`, the session's GPS fix and accuracy,
  compass heading and steadiness, and the stop the visitor is at (all in
  `session.engine.state`). It learns where north is in tracking space by
  pairing the tracking yaw with the compass, puts the stop's figure on the
  ground at the spot the package names (`stop.figure`: model, scale, metres
  from the stop and bearing) without a tap, falls back to a tap when GPS, the
  compass or the ground is not good enough, takes the figure down between
  stops, replaces an anchor the platform lost, and stores and restores
  persistent anchors through `Storage`. It returns a `TourFiguresView`: what
  to draw (`stage`), the mode, and one prompt line.
- **`FigureStage`** (`src/core/anchoring.ts`) under it: where a tap puts a
  figure (on the aimed ground, pushed clear of the visitor, turned to face
  them), where it is each frame (its anchor, with the platform's corrections),
  whether to draw it, and the prompt. Use it alone for free placement.

What a port must provide for figures:

1. A `WorldTracker`: one `TrackedFrame` per rendered frame (viewer pose,
   tracking quality, the ground under the aim point, every anchor's pose or
   null), `createAnchor` / `deleteAnchor`, and persistence if the platform
   has it.
2. The models: `src/core/figures.ts` lists each figure's glTF binary
   (meshopt-compressed; any glTF loader with the meshopt decoder) and USDZ
   (Apple), its true height, which way its front faces, its tint and its
   idle clip. Fit it to `heightM` standing on y = 0, front turned to -z
   (`fitToSize` in `src/web/figures3d.ts` is the reference). Show the
   `credit` line somewhere a visitor can read it (CREDITS.md).
3. A tap ("select") that calls `TourFigures.tap()` when the mode is `tap`.

`test/tourfigures.test.ts` and `test/anchoring.test.ts` simulate a tracker
whose space is turned and shifted from the world, with compass and GPS
error, and are the acceptance tests for the logic. On a device the test is
the parking lot: "Walk the tour here" on `ar.html`, walk to stop 1, walk all
the way around the figure, walk on (it goes), come back.

## Acceptance for any port

A port is done when, on the device:

1. The parking-lot test passes: test-anywhere layout (`relocate()` in
   `core/relocate.ts`), three stops trigger in order, nothing shows while
   walking.
2. A recorded walk replayed through the port's adapters gives the same events
   as `replay()` in the tests (record one with `?record=1` on a phone).
3. The tour plays with no network after the first load.
4. Captions appear for every narration line, with sound on and with it off.

## Device notes (from ORI's hardware research; verify on hardware)

**Meta Ray-Ban Display.** Web Apps are HTML/JS, so this repo runs as is with
`?display=glasses` (600×600). Location comes from the paired phone.
**Whether Web Apps expose a compass heading is unverified.** If they do not,
use `?facing=off` (`requireFacing: false`), or feed heading from the paired phone.
That is the first thing to test on a loaner pair.

**World-locked figures by device** (ORI research, 2026-10-06, sources in
the project's `ori/build/glasses-world-locked-figures.md`; verify on
hardware): Snap Spectacles can (Lens Studio world tracking and Custom
Locations); Meta Ray-Ban Display cannot (heads-up display, no 6DoF for
developers); XREAL Air 2 Ultra can through the XREAL SDK's spatial anchors,
tethered to a phone or Beam Pro; RayNeo X3 Pro is not reliable yet.

**Snap Spectacles (Lens Studio, TypeScript).** Lens Studio scripts are
TypeScript, so `src/core` can be copied in as source. Two adjustments:
(a) Lens Studio resolves imports its own way, so the `.ts` extensions in the
import paths may need rewriting (a small copy script); (b) everything in
`src/core` is plain ES2022, but check Lens Studio's runtime for `Array.prototype.findLast`
(used only in `src/web`, not the core). Adapters: a `WorldTracker` from Lens Studio's world tracking
(device pose each frame, a world hit test for the aim point, its anchors, and
Custom Locations to put a figure back at the same spot at the park on every
visit), location and heading from Lens Studio's location and orientation APIs, motion from its IMU, `Display` as a
component that shows the scene card in front of the user (or anchored at the
landmark, which Spectacles can do and phones cannot), `AudioPort` with an
AudioComponent. Lens Studio has a preview with simulated location, which runs
on Caleb's computer.

**XREAL / RayNeo (Android).** Two routes:
1. A WebView wrapping this web app (fastest; the glasses are an external
   display). Position and heading come from the phone. Check whether the
   WebView grants geolocation and `deviceorientationabsolute`; if not, inject
   them from Kotlin through a JS bridge into a small `LocationSource` and
   `HeadingSource` that read from the bridge.
2. A native app that runs `src/core` in an embedded JS engine (QuickJS or
   J2V8) with Kotlin adapters. More work; only worth it if the WebView route
   falls short.

RayNeo X3 Pro has no GPS in the glasses: pair with a phone.

## Content is shared, not ported

Every device reads the same `content/<tour>/tour.json` (schema
[`schemas/ori.tour-1.schema.json`](../schemas/ori.tour-1.schema.json)), the
same audio and caption cues, and the same map. A device that cannot use part
of the package (a map on glasses) ignores that part. It does not fork the
package.
