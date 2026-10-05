// ORI tour player for browsers: boot. Loads the content package, picks a
// Display (phone or glasses) and the sources that feed the session, then
// hands everything to the portable core (src/core/session.ts).
//
//   (default)          phone display
//   ?display=glasses   600x600 glasses display
//   ?here=1            test anywhere: start with the tour moved around you
//   ?sim=1             simulator (tap the map to stand, slider to turn)
//   ?replay=synthetic  replay a walk through the real engine (or ?replay=<file in traces/>)
//   ?record=1          record this walk (GPS, compass, motion) for replay and tests
//   ?edit=1            site walk: place stops and facings on location, export tour.json
//   ?hud=1             sensor readout (always on in test-anywhere mode)
//   ?facing=off        device with no compass: arriving and standing still shows the scene
//   ?tour=<id>         another package under content/

import { bearing, distance, ll, offset, turn } from "../core/geo.ts";
import { relocate } from "../core/relocate.ts";
import { parseTrace, type Trace } from "../core/replay.ts";
import { TourSession, type SessionSources } from "../core/session.ts";
import { syntheticWalk } from "../core/synthwalk.ts";
import { applyPlacements, loadTour, targetBearing, type Placements } from "../core/tour.ts";
import type { LatLon, Tour, TourMap } from "../core/types.ts";
import { WebAudio } from "./audio.ts";
import { browserStorage, download, fetchAssets, intervalScheduler, wallClock } from "./platform.ts";
import {
  AccelerometerSource,
  CompassSource,
  GeolocationSource,
  Recorder,
  ReplaySources,
  SimulatedSensors,
} from "./sensors.ts";
import { GlassesDisplay } from "./shells/glasses.ts";
import { PhoneDisplay } from "./shells/phone.ts";

const params = new URLSearchParams(location.search);
const TOUR_ID = (params.get("tour") ?? "falls-park").replace(/[^\w-]/g, "");
const BASE = `content/${TOUR_ID}/`;
const EDIT_KEY = `ori-tour-edits:${TOUR_ID}`;
const GLASSES = params.get("display") === "glasses";
const storage = browserStorage();

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing from index.html`);
  return el as T;
};
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

type Mode = "live" | "here" | "sim" | "replay";

async function main(): Promise<void> {
  const loaded = await loadTour(BASE, fetchAssets);
  const tour = loaded.tour;
  const map = loaded.map;
  let edits: Placements | null = null;
  try {
    edits = JSON.parse(storage.get(EDIT_KEY) ?? "null") as Placements | null;
  } catch {
    edits = null;
  }
  const editsApplied = applyPlacements(tour, map, edits);

  const audio = new WebAudio(fetchAssets);
  const phone = GLASSES ? null : new PhoneDisplay(tour, map);
  const display = phone ?? new GlassesDisplay();
  display.hud = params.get("hud") === "1";
  $("chipEdits").hidden = !editsApplied;

  $("introTitle").textContent = tour.title;
  $("introSub").textContent = tour.subtitle;
  $("introStatus").textContent = tour.status;
  $("introStops").innerHTML = tour.stops.map((s) => `<li>${s.name}</li>`).join("");
  $("introLength").textContent =
    `${tour.stops.length} stops · about ${Math.round(map.legs.reduce((n, l) => n + l.metres, 0) / 10) * 10} m of paved path`;

  let session: TourSession | null = null;
  let recorder: Recorder | null = null;
  let geo: GeolocationSource | null = null;
  let sim: SimulatedSensors | null = null;

  const run = async (t: Tour, m: TourMap, sources: SessionSources, clock = wallClock): Promise<TourSession> => {
    session?.stop();
    const s = new TourSession(
      t,
      { clock, scheduler: intervalScheduler, audio, display },
      { requireFacing: params.get("facing") !== "off", hasMap: !GLASSES },
    );
    if (params.get("record") === "1") {
      recorder = new Recorder(t.id);
      s.observe(recorder);
    }
    if (phone) phone.bind(s, m, audio);
    else (display as GlassesDisplay).bind(s);
    session = s;
    window.oriTour = { session: s, tour: t, map: m, sim: () => sim };
    await s.start(sources);
    return s;
  };

  const liveSources = (compass: CompassSource): SessionSources => {
    geo = new GeolocationSource();
    return { location: geo, heading: compass, motion: new AccelerometerSource() };
  };

  // -------------------------------------------------------------- modes

  const start = async (mode: Mode): Promise<void> => {
    $("intro").hidden = true;
    audio.unlock(); // inside the tap, before any await
    try {
      await navigator.wakeLock?.request("screen");
    } catch {
      /* not supported */
    }
    if (mode === "live") {
      await run(tour, map, liveSources(new CompassSource()));
    } else if (mode === "here") {
      await startHere();
    } else if (mode === "sim") {
      sim = new SimulatedSensors(tour.start.position);
      await run(tour, map, { location: sim, heading: sim.heading$ });
      const first = tour.stops[0];
      if (first) sim.face(bearing(tour.start.position, first.position));
      sim.set(tour.start.position, 0);
      wireSim(sim, tour, map);
    } else {
      const which = params.get("replay") ?? "synthetic";
      const trace: Trace =
        which === "synthetic"
          ? syntheticWalk(tour, map)
          : parseTrace(await fetchAssets.text(BASE + "traces/" + which.replace(/[^\w.-]/g, "")));
      const speedup = Number(params.get("speedup") ?? 4);
      const rs = new ReplaySources(trace, speedup, intervalScheduler);
      document.body.classList.add("sim");
      await run(tour, map, { location: rs.location, heading: rs.heading, motion: rs.motion }, rs.clock);
      rs.begin();
      display.notify?.(`Replaying a ${trace.source} walk at ${speedup}x`);
    }
    if (params.get("record") === "1" && phone) wireRecord();
    if (params.get("edit") === "1" && phone) wireEdit(tour, map);
  };

  // Test anywhere: wait for a decent fix and a heading, move the tour around
  // the tester with stop 1 straight ahead, and show the readout and camera.
  const startHere = async (): Promise<void> => {
    const compass = new CompassSource();
    const err = await compass.request(); // must be the first await after the tap on iOS
    if (err) display.notify?.(err);
    if (phone) {
      phone.hud = true;
      void phone.toggleCamera(true);
    }
    display.hud = true;
    $("hereNote").hidden = false;
    $("hereNote").textContent = "Finding where you are… stand still for a few seconds.";
    let facing: number | null = null;
    const stopCompass = compass.start((h) => (facing = h));
    const here = await settleFix(display.notify?.bind(display));
    stopCompass();
    if (!here) {
      $("hereNote").textContent = "No GPS fix. Check location permission, step outside, and tap Re-centre.";
      return;
    }
    const moved = relocate(tour, here, { facingDeg: facing });
    const first = moved.tour.stops[0];
    $("hereNote").textContent =
      `Test layout: ${moved.tour.stops.length} stops around you, scaled to ${Math.round(moved.scale * 100)}%. ` +
      (first
        ? `Stop 1 is ${Math.round(distance(here, first.position))} m ${facing == null ? "away" : "straight ahead"}.`
        : "");
    $("btnRecenter").hidden = false;
    $("btnRecenter").onclick = () => void startHere();
    await run(moved.tour, moved.map, liveSources(compass));
  };

  // -------------------------------------------------------------- panels

  const wireSim = (s: SimulatedSensors, t: Tour, m: TourMap): void => {
    if (!phone) return;
    $("simPanel").hidden = false;
    document.body.classList.add("sim");
    phone.routeMap.onTap = (p) => s.set(p, 0);
    $<HTMLInputElement>("simHeading").oninput = (e) => s.face(Number((e.target as HTMLInputElement).value));
    phone.afterRender = (v) =>
      ($<HTMLInputElement>("simHeading").value = String(Math.round(v.sensors.headingDeg ?? 0)));
    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") s.face(s.heading - 5);
      if (e.key === "ArrowRight") s.face(s.heading + 5);
    });
    const btn = $<HTMLButtonElement>("simDemo");
    btn.onclick = async () => {
      btn.disabled = true;
      await demoWalk(s, t, m);
      btn.disabled = false;
    };
    if (params.get("demo")) btn.click();
  };

  // Walks the whole route: along each leg (audio only while moving), then
  // arrives, turns to face the landmark, stands still for the scene.
  const demoWalk = async (s: SimulatedSensors, t: Tour, m: TourMap): Promise<void> => {
    const speedup = Number(params.get("speedup") ?? 6);
    for (const leg of m.legs) {
      const stop = t.stops.find((x) => x.id === leg.to);
      if (!stop) continue;
      for (let i = 0; i + 1 < leg.line.length; i++) {
        const pa = leg.line[i];
        const pb = leg.line[i + 1];
        if (!pa || !pb) continue;
        const a = ll(pa);
        const b = ll(pb);
        const d = distance(a, b);
        const brg = bearing(a, b);
        for (let mm = 0; mm < d; mm += 1.4 * speedup * 0.25) {
          s.face(brg);
          s.set(offset(a, mm, brg), 1.4);
          await sleep(250);
        }
      }
      s.set(stop.position, 0);
      await sleep(800);
      const target = targetBearing(stop);
      while (Math.abs(turn(s.heading, target)) > 3) {
        const d = turn(s.heading, target);
        s.face(s.heading + Math.sign(d) * Math.min(6, Math.abs(d)));
        await sleep(60);
      }
      while (session && !session.engine.state.visited.has(stop.id)) {
        s.set(s.pos, 0);
        await sleep(250);
      }
      await sleep(600);
    }
  };

  const wireRecord = (): void => {
    $("recPanel").hidden = false;
    $("recSave").onclick = () => {
      if (!recorder) return;
      const note = $("hereNote").hidden ? "Recorded with ?record=1." : "Recorded in test-anywhere mode with ?record=1.";
      download(
        `walk-${TOUR_ID}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "")}.json`,
        recorder.file(note),
      );
    };
    if (phone) {
      const prev = phone.afterRender;
      phone.afterRender = (v) => {
        prev?.(v);
        $("recInfo").textContent = `${recorder?.fixes ?? 0} GPS fixes recorded`;
      };
    }
  };

  const wireEdit = (t: Tour, m: TourMap): void => {
    $("editPanel").hidden = false;
    const sel = $<HTMLSelectElement>("editStop");
    if (!sel.options.length) for (const s of t.stops) sel.add(new Option(`${s.order}. ${s.name}`, s.id));
    const cur = () => t.stops.find((x) => x.id === sel.value);
    const here = (): (LatLon & { n: number }) | null => (geo ? geo.averaged() : sim ? sim.averaged() : null);
    const save = (stopId: string, patch: Placements[string]): void => {
      let all: Placements = {};
      try {
        all = JSON.parse(storage.get(EDIT_KEY) ?? "{}") as Placements;
      } catch {
        all = {};
      }
      all[stopId] = { ...all[stopId], ...patch };
      storage.set(EDIT_KEY, JSON.stringify(all));
      applyPlacements(t, m, all);
      $("chipEdits").hidden = false;
      if (phone) phone.routeMap.view = null;
    };
    const info = (): void => {
      const s = cur();
      const a = here();
      if (!s) return;
      $("editInfo").textContent =
        `${s.name}: ${s.position.lat.toFixed(6)}, ${s.position.lon.toFixed(6)} facing ${Math.round(targetBearing(s))}°` +
        (a ? ` · you: ${a.lat.toFixed(6)}, ${a.lon.toFixed(6)} (avg of ${a.n} fixes)` : "");
    };
    if (phone) {
      const prev = phone.afterRender;
      phone.afterRender = (v) => {
        prev?.(v);
        info();
      };
    }
    $("editPlace").onclick = () => {
      const a = here();
      const s = cur();
      if (!a || !s) return display.notify?.("No GPS fix yet.");
      s.position = { lat: +a.lat.toFixed(6), lon: +a.lon.toFixed(6) };
      save(s.id, { position: s.position });
      display.notify?.(`Stop ${s.order} placed here.`);
    };
    $("editFace").onclick = () => {
      const h = session?.engine.state.heading;
      const s = cur();
      if (h == null || !s) return display.notify?.("No compass reading.");
      s.facing.bearing_deg = Math.round(h);
      save(s.id, { bearing: s.facing.bearing_deg });
      display.notify?.(`Stop ${s.order} faces ${s.facing.bearing_deg}° now.`);
    };
    $("editExport").onclick = () => {
      const out = JSON.parse(JSON.stringify(t)) as Tour;
      const strip = (p: string | null | undefined): string | null => (p ? p.slice(BASE.length) : null);
      for (const s of out.stops) {
        s.narration.audio = strip(s.narration.audio);
        s.narration.cues = strip(s.narration.cues);
        if (s.scene.image) s.scene.image = strip(s.scene.image);
        for (const l of s.scene.layers ?? []) l.src = strip(l.src) ?? l.src;
        s.placement = s.placement.replace(/^provisional/, "placed on site " + new Date().toISOString().slice(0, 10));
      }
      download("tour.json", out);
    };
    $("editReset").onclick = () => {
      storage.remove(EDIT_KEY);
      location.reload();
    };
  };

  // -------------------------------------------------------------- intro

  const preset: Mode | null =
    params.get("replay") != null
      ? "replay"
      : params.get("sim") === "1"
        ? "sim"
        : params.get("here") === "1"
          ? "here"
          : null;
  $("btnLive").onclick = () => void start(preset ?? "live");
  $("btnHere").onclick = () => void start("here");
  $("btnSim").onclick = () => void start(preset === "replay" ? "replay" : "sim");
  const auto = params.get("autostart");
  if (auto === "sim" || auto === "replay") void start(auto);
  registerOffline();
}

/** Best fix within a few seconds: good enough (<= 15 m) or the best seen by the deadline. */
function settleFix(notify?: (t: string) => void): Promise<LatLon | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    let best: GeolocationPosition | null = null;
    const finish = (): void => {
      navigator.geolocation.clearWatch(id);
      clearTimeout(deadline);
      resolve(best ? { lat: best.coords.latitude, lon: best.coords.longitude } : null);
    };
    const id = navigator.geolocation.watchPosition(
      (p) => {
        if (!best || p.coords.accuracy < best.coords.accuracy) best = p;
        if (p.coords.accuracy <= 15) setTimeout(finish, 1500); // one more second for the compass
      },
      (e) => {
        if (e.code === 1) {
          notify?.("Location permission was denied.");
          finish();
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
    const deadline = setTimeout(finish, 12000);
  });
}

// Offline: a service worker caches the app and the whole package (narration
// audio included) on first load, so the tour runs with no signal.
function registerOffline(): void {
  if (!("serviceWorker" in navigator) || params.get("offline") === "off") return;
  navigator.serviceWorker.register("sw.js").catch(() => {
    /* file:// or blocked: online only */
  });
}

declare global {
  interface Window {
    oriTour?: { session: TourSession; tour: Tour; map: TourMap; sim: () => SimulatedSensors | null };
  }
}

main().catch((e: unknown) => {
  document.body.innerHTML = `<p style="padding:24px;color:#fff">Could not load the tour: ${e instanceof Error ? e.message : String(e)}</p>`;
});
