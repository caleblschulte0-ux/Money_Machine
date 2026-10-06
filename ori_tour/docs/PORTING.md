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
| `Storage` | Small key-value store | `browserStorage` | Only used for on-site placements. |
| `WorldTracker` | World tracking for figures that stay in one spot: viewer pose, ground under the aim point, anchors | `WebXRTracker` (`src/web/xr.ts`) | Optional; only devices with 6DoF tracking. Poses in tracking space (`core/space.ts`: metres, +y up, right-handed, viewer looks down -z). `createAnchor` returns null where the device cannot anchor; the core then holds the figure by tracking alone and says so. |

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

`FigureStage` (`src/core/anchoring.ts`) is the whole figure logic: where a
tap puts the figure (on the aimed ground, pushed clear of the visitor, turned
to face them), where it is each frame (its anchor, with the platform's
corrections), whether to draw it, and the prompt. A port feeds it one
`TrackedFrame` per rendered frame and draws `StageView`: each figure's pose,
the placement reticle, the prompt. The figures and their true sizes are in
`src/core/figures.ts`; the 3D models are per device (`src/web/figures3d.ts`
draws them for browsers; another device loads an exported glTF/USDZ of the
same figure). `test/anchoring.test.ts` simulates a drifting tracker and is the
acceptance test for the logic; on a device, the test is the parking lot:
place it, walk all the way around, walk 50 m away, come back.

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
