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
3. A tap ("select") that calls `TourFigures.tap()` when the mode is `tap`,
   and in test mode `spawn(model)`.
4. Hit poses whose +y is the surface normal (WebXR's convention): the core
   refuses ground steeper than 20 degrees (`isLevel`).
5. For a figure that looks real: light the model from the platform's light
   estimate, cast its shadow on the real ground, and hide it behind real
   things where the device senses depth. `src/web/look.ts` is the reference
   (Lens Studio and ARKit/ARCore native have all three built in).

Test points (`src/core/testpoints.ts`) are sites too: a port gets test mode
by passing `TestPoints.sites()` to `TourFigures` instead of `tourSites(tour)`.

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

### Snap Spectacles port (Lens Studio)

Spectacles are the one pair that can pin a figure outdoors today (Lens Studio
world tracking, Custom Locations). Lens Studio scripts are TypeScript, so the
port is the same shape as the web one: the core copied in, small adapters
around it. Written 2026-10-07, before we have held a pair; the Lens Studio API
names below are from Snap's documentation and are to be checked against the
Lens Studio version we install.

**Carries over as is (copied source, no edits):** all of `src/core`, which is
plain ES2022 with no DOM, Node or device code (`tsconfig.core.json` compiles
it with no platform types and ESLint refuses browser globals there, so a
regression fails CI). That is the tour engine and session (`engine.ts`,
`session.ts`, `view.ts`, `text.ts`), arrival and facing (`geo.ts`,
`heading.ts`, `stillness.ts`, `relocate.ts`), the content loader and
validation (`tour.ts`, `types.ts`), and every figure rule: placement,
clearance, facing, ground, settling, anchor bookkeeping and test points
(`anchoring.ts`, `tourfigures.ts`, `testpoints.ts`, `space.ts`,
`figures.ts`), and where each stop's scene card stands and what it says
(`scenecard.ts`; the port draws it as a Text panel at the given pose). The content package (`content/<tour>/`) is shared unchanged.
The only mechanical step is the import paths: the core imports `./x.ts`, and
Lens Studio may want `./x`; a small copy script rewrites them.

**Needs a Spectacles adapter (one each, behind `src/core/ports.ts`):**

| Port | Spectacles source (to verify) |
|---|---|
| `WorldTracker` | Device pose from the camera's DeviceTracking (world mode); the aim point from the World Query hit test; anchors from Spectacles' anchor support; `persistAnchor` / `restoreAnchor` from Custom Locations (a scanned place the device re-finds, so the mammoth stands on the same spot every visit). |
| `LocationSource` / `HeadingSource` | Lens Studio's location service (GPS from the paired phone) and device heading. |
| `MotionSource` | IMU; optional. |
| `Display` | A small panel in view for prompts and captions, or anchored at the landmark. The `ViewModel` already says what to show. |
| `AudioPort` | An AudioComponent playing the package's narration files, caption cues as now. |
| `Storage` | Lens persistent storage. |
| `AssetLoader` | Bundled assets in the Lens. |
| Figure drawing | Import the same glb files (`assets/figures/`) into Lens Studio; credits in `CREDITS.md` travel with them. No USDZ needed. |

The web port's own pieces stay behind: three.js drawing, WebXR (`xr.ts`),
Quick Look (`quicklook.ts`), the Variant Launch loader (`launch.ts`) and its
config. None of them is imported by the core.

**Cannot know until we hold a pair:**
- How tightly Custom Locations holds a figure outdoors at Falls Park (light,
  season, crowds) and how far from the scan point a visitor can stand.
- Whether the consumer Specs run Custom Locations or only the developer kit.
- Whether location and heading are good enough on the glasses for the tour's
  arrival rules, or must come from the phone.
- Frame rate and heat with a 57,000-triangle skinned mammoth, and the Lens
  size limit against our figure files.
- Battery (about 45 minutes on the developer kit) against a three-stop tour.

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
