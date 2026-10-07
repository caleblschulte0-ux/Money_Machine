# ORI tour player: Falls Park prototype

Open Range Interactive's walking tour, as a static web app. It runs in a phone
browser today and is built to move to glasses (Meta Ray-Ban Display Web Apps
are HTML/CSS/JS) without rewriting the tour.

**Status: prototype.** Stop placement is provisional and every word of tour
copy is unreviewed. Not for public use.

## The loop

1. **Arrive.** GPS geofence (20 m) around each stop.
2. **Face it.** Compass heading must be within 25° of the landmark (10° of
   hysteresis so the picture does not flicker). A one-tap "I'm facing it"
   calibration fixes compass error near railings and stone.
3. **Stand still.** Pictures appear only when the visitor has been still for
   2 s (footsteps on the accelerometer, GPS speed as backup); while walking it is audio only. The scene window sits in the
   upper-middle of the view, clear of the lower field.
4. **See and hear.** A square scene window (the same 1:1 frame as the 600x600
   Ray-Ban Display) and narration with captions. Narration plays the package's
   pre-generated audio with timed captions (a generated voice for now,
   marked as such), otherwise the device voice.
5. **Walk on.** Route map from real OpenStreetMap geometry, legs routed over
   mapped paths (no steps), with the next leg highlighted.

Fallbacks for a supervised pilot: **Show scene** (staff override when GPS or
the compass is bad), **Skip stop**, and captions that run even with no voice.

## Try it

- **At the park:** "Start at the park".
- **Anywhere (a parking lot):** "Test it where you are", or open with `?here=1`.
  Stand still a few seconds; the three stops are moved around you, a parking
  lot apart, with stop 1 straight ahead. The camera runs behind the scene
  window and a readout shows GPS accuracy, heading, whether you count as
  still, and the distance to the next stop. "Re-centre here" redoes it.
- **No walking:** "Simulator", then "Walk the whole route".
- **Figures in one spot (AR):** `ar.html`. "Walk the tour here" moves the
  three stops around you and runs the tour; at the falls a full-size
  Smithsonian mammoth skeleton, and at the mill a settler, appear on the
  ground near the stop and stay there while you walk around them. Android
  (Chrome with ARCore) runs it in the page with an anchor and a live readout;
  iPhone runs the tour in the page and opens each figure in Apple's AR Quick
  Look at its stop. "Just place a figure" places any figure with a tap.
  Model credits: [CREDITS.md](CREDITS.md).

## Develop

Node 22.18 or newer. npm is only for dev tools; the one runtime library, three.js (MIT), is bundled into `vendor/three.js` by the build and served with the app.

```bash
cd ori_tour
npm ci
npm run build        # TypeScript -> dist/ (committed, so static hosting needs no build), offline.json
npm run check        # typecheck (core compiled with no DOM), lint, format, tests
npm run serve        # http://localhost:8000
```

URL switches: `?here=1` test anywhere · `?hud=1` sensor readout ·
`?sim=1` simulator · `?autostart=sim&demo=1&speedup=8` walks itself ·
`?replay=synthetic` (or a file in `content/<tour>/traces/`) replays a walk
through the real engine · `?record=1` records a walk for replay and tests ·
`?display=glasses` 600x600 layout · `?edit=1` place stops on site and export
tour.json · `?facing=off` device with no compass · `?offline=off`.

After the first load it works with no signal (`sw.js` caches everything in
`offline.json`). GPS, compass and camera need HTTPS or localhost; iPhone asks
for compass permission on the Start tap.

## Layout

- `src/core/`: the portable tour engine, platform-free TypeScript.
  `ports.ts` is the contract every device implements. See
  [docs/PORTING.md](docs/PORTING.md).
- `src/web/`: the browser adapters, plus the phone and glasses displays.
- `content/falls-park/`: **the content package**. `tour.json` (schema
  [`schemas/ori.tour-1.schema.json`](schemas/ori.tour-1.schema.json)), `map.json`
  (from `tools/build_map.py` over OpenStreetMap data), `audio/` (from
  `tools/make_narration.py`).
- `test/`: headless tests covering the engine, compass, stillness, replayed
  synthetic and GPX walks, the schema, test-anywhere mode, a session on fake
  ports, and the offline list.
- `CLAUDE.md`: rules, defaults, architecture and the plan, for any Claude
  session working here.

## Devices

One package, several players:

| Device | How it plays the package | Known gap |
|---|---|---|
| Phone (now) | this app | none for testing; it is the partner and City demo |
| Meta Ray-Ban Display | this app as a Meta Web App, `?display=glasses` layout | Location comes from the paired phone. **Whether Web Apps expose a compass heading is unverified** (ORI research, b-hardware.md). If not, the facing gate falls back to "Show scene" or a phone-held heading. First thing to test on a loaner. |
| Snap Specs | a Lens Studio Lens running `src/core` with Lens Studio adapters | Not built (docs/PORTING.md). Specs has GPS, compass and world-locking, so it can do more than this player. |
| RayNeo X3 Pro | Android app or WebView with this app | No GPS in the glasses: pair with a phone. Magnetometer readable from apps is unverified. |

## What this is not

It does not recognise what you look at, detect the water's edge, or sync a
group's audio. The promo video's narration describes those; none is built, and the app does not claim them.

## Content rules

Only history that ORI's research files verify, with sources on each stop.
Where research is thin the stop says so (`todo`) instead of inventing. Dakota
content waits on advice from Dakota tribal historic preservation offices; mill
content waits on a Siouxland Heritage Museums check.
