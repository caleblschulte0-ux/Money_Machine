// ORI tour player: boot. Loads the content package, builds the runtime
// (engine + narrator + sensor sources, js/shells/runtime.js), and mounts the
// shell for this display:
//
//   (default)          phone: scene window, guidance, map, staff controls
//   ?display=glasses   600x600 glasses layout: scene, guidance, captions only
//
// Other switches, any shell:
//   ?sim=1             simulator (tap the map to stand, slider to turn)
//   ?replay=synthetic  replay a walk through the real engine (or ?replay=<file in traces/>)
//   ?record=1          record this walk's GPS/compass/motion for replay and tests
//   ?edit=1            site walk: place stops and facings on location, export tour.json
//   ?facing=off        no compass on this device: arrival + standing still shows the scene
//   ?tour=<id>         another package under content/

import { loadTour, applyPlacements } from "./core/tour.js";
import { Runtime } from "./shells/runtime.js";
import { mountPhone } from "./shells/phone.js";
import { mountGlasses } from "./shells/glasses.js";

const params = new URLSearchParams(location.search);
const TOUR = (params.get("tour") || "falls-park").replace(/[^\w-]/g, "");
const BASE = `content/${TOUR}/`;
const EDIT_KEY = `ori-tour-edits:${TOUR}`;
const $ = (id) => document.getElementById(id);

async function main() {
  const { tour, map } = await loadTour(BASE);

  // On-site placements made in site-walk mode live in this browser and win
  // over the file until exported and committed.
  const editsApplied = { value: false };
  try { editsApplied.value = applyPlacements(tour, map, JSON.parse(localStorage.getItem(EDIT_KEY) || "null")); } catch { /* storage blocked */ }

  const rt = new Runtime(tour, map, params, BASE);
  const shell = params.get("display") === "glasses" ? mountGlasses(rt) : mountPhone(rt, { editKey: EDIT_KEY, editsApplied });

  $("tourTitle").textContent = `${tour.title} · ${tour.subtitle}`;
  $("introTitle").textContent = tour.title;
  $("introSub").textContent = tour.subtitle;
  $("introStatus").textContent = tour.status;
  $("introStops").innerHTML = tour.stops.map((s) => `<li>${s.name}</li>`).join("");
  $("introLength").textContent = `${tour.stops.length} stops · about ${Math.round(map.legs.reduce((n, l) => n + l.metres, 0) / 10) * 10} m of paved path`;

  const start = async (mode) => {
    $("intro").hidden = true;
    await rt.start(mode);
    shell.afterStart();
    shell.render();
  };
  const preset = params.get("replay") != null ? "replay" : params.get("sim") === "1" ? "sim" : null;
  $("btnLive").onclick = () => start(preset === "replay" ? "replay" : preset === "sim" ? "sim" : "live");
  $("btnSim").onclick = () => start(preset === "replay" ? "replay" : "sim");

  // handle for tests and for driving demos from the console
  window.oriTour = { rt, st: rt.st, tour, map, sim: () => rt.sim, demo: () => rt.demo() };
  if (params.get("autostart") === "sim") start("sim").then(() => params.get("demo") && rt.demo());
  if (params.get("autostart") === "replay") start("replay");

  registerOffline();
}

// Offline: a service worker caches the app and the whole content package
// (narration audio included) on first load, so the tour runs with no signal.
function registerOffline() {
  if (!("serviceWorker" in navigator) || params.get("offline") === "off") return;
  navigator.serviceWorker.register("sw.js").catch(() => { /* file:// or blocked: online only */ });
}

main().catch((e) => {
  document.body.innerHTML = `<p style="padding:24px;color:#fff">Could not load the tour: ${e.message}</p>`;
});
