// ORI tour player. One loop, same on every device:
//   arrive at a stop (GPS geofence) -> face the landmark (compass) ->
//   stand still -> the scene appears and the narration plays -> walk on.

import { distance, bearing, turn, offset, ll, compassWord, norm } from "./geo.js";
import { LiveLocation, LiveHeading, SimSensors } from "./sensors.js";
import { RouteMap } from "./map.js";
import { renderScene } from "./scene.js";
import { Narrator } from "./narrator.js";

const params = new URLSearchParams(location.search);
const TOUR = params.get("tour") || "falls-park";
const GLASSES = params.get("display") === "glasses";
const EDIT = params.get("edit") === "1";
const EDIT_KEY = `ori-tour-edits:${TOUR}`;

const $ = (id) => document.getElementById(id);
const st = {
  sim: params.get("sim") === "1",
  pos: null, accuracy: null, speed: 0, error: null,
  raw: null, heading: null, calib: 0,
  stillSince: null, still: false,
  visited: new Set(), legIndex: 0, nextId: null,
  atStop: null, facing: false, showing: null, narrating: null, forced: null,
};

let tour, map, routeMap, loc, head, sim, narrator, editsApplied = false;

// ---------------------------------------------------------------- loading

async function load() {
  const base = `content/${TOUR}/`;
  [tour, map] = await Promise.all([
    fetch(base + "tour.json").then((r) => r.json()),
    fetch(base + "map.json").then((r) => r.json()),
  ]);
  for (const s of tour.stops) {
    if (s.narration.audio) s.narration.audio = base + s.narration.audio;
    if (s.scene.image) s.scene.image = base + s.scene.image;
  }
  applyEdits();
  tour.stops.sort((a, b) => a.order - b.order);
  st.nextId = tour.stops[0].id;
}

// On-site placements made in site-walk mode live in this browser and win
// over the file until exported and committed.
function applyEdits() {
  let edits;
  try { edits = JSON.parse(localStorage.getItem(EDIT_KEY) || "null"); } catch { edits = null; }
  if (!edits) return;
  for (const s of tour.stops) {
    const e = edits[s.id];
    if (!e) continue;
    if (e.position) s.position = e.position;
    if (e.bearing != null) s.facing.bearing_deg = e.bearing;
    editsApplied = true;
  }
  // A moved stop no longer matches its pre-routed path: fall back to a straight guide line.
  const pts = [tour.start.position, ...tour.stops.map((s) => s.position)];
  map.legs.forEach((leg, i) => {
    const a = pts[i], b = pts[i + 1];
    if (distance(a, ll(leg.line[0])) > 10 || distance(b, ll(leg.line[leg.line.length - 1])) > 10) {
      leg.line = [[a.lat, a.lon], [b.lat, b.lon]];
      leg.routed = false;
    }
  });
}

function saveEdit(stopId, patch) {
  let edits;
  try { edits = JSON.parse(localStorage.getItem(EDIT_KEY) || "{}"); } catch { edits = {}; }
  edits[stopId] = { ...(edits[stopId] || {}), ...patch };
  try { localStorage.setItem(EDIT_KEY, JSON.stringify(edits)); } catch { /* storage blocked: edit lasts this session only */ }
}

const targetBearing = (s) => (s.facing.bearing_deg != null ? s.facing.bearing_deg : bearing(s.position, s.facing.target));

// ---------------------------------------------------------------- sensors

function onLocation(l) {
  Object.assign(st, l);
  const now = Date.now();
  if (st.speed != null && st.speed < tour.safety.still_below_mps) {
    st.stillSince = st.stillSince || now;
  } else st.stillSince = null;
  tick();
}

function onHeading(h) {
  st.raw = h;
  st.heading = norm(h + st.calib);
  tick();
}

// ---------------------------------------------------------------- the loop

function tick() {
  const now = Date.now();
  st.still = st.stillSince != null && now - st.stillSince >= tour.safety.still_for_seconds * 1000;

  // Which stop are we inside? Prefer the next unvisited one.
  let at = null;
  if (st.pos) {
    for (const s of tour.stops) {
      const d = distance(st.pos, s.position);
      if (d <= s.radius_m && (!at || s.id === st.nextId)) at = s;
    }
  }
  if (st.forced && (!at || at.id !== st.forced.id)) {
    // a staff override holds until the visitor walks well away from that stop
    if (!st.pos || distance(st.pos, st.forced.position) < 60) at = st.forced;
    else st.forced = null;
  }
  st.atStop = at;

  // Facing, with hysteresis so the picture does not flicker at the edge.
  if (at && st.heading != null) {
    const off = Math.abs(turn(st.heading, targetBearing(at)));
    const tol = at.facing.tolerance_deg;
    st.facing = st.facing ? off <= tol + 10 : off <= tol;
  } else st.facing = false;

  const forced = at && st.forced && st.forced.id === at.id;
  const canShow = at && (st.facing || forced) && (st.still || !tour.safety.pictures_only_when_still || forced);
  st.showing = canShow ? at : null;

  if (st.showing && st.narrating !== st.showing.id && !st.visited.has(st.showing.id)) {
    st.narrating = st.showing.id;
    const stop = st.showing;
    narrator.play(stop.narration);
    narrator.onEnd = () => finishStop(stop);
  }
  render();
}

function finishStop(stop) {
  st.narrating = null;
  st.visited.add(stop.id);
  st.forced = null;
  const i = tour.stops.findIndex((s) => s.id === stop.id);
  st.legIndex = Math.max(st.legIndex, i + 1);
  const next = tour.stops.find((s) => !st.visited.has(s.id));
  st.nextId = next ? next.id : null;
  toast(next ? `Stop ${stop.order} done. Next: ${next.name}.` : "Tour complete. Thanks for walking it.");
  tick();
}

// ---------------------------------------------------------------- rendering

function render() {
  const lens = $("lens"), guide = $("guide");
  if (st.showing) {
    if (lens.dataset.stop !== st.showing.id) {
      renderScene(lens, st.showing);
      lens.dataset.stop = st.showing.id;
    }
    lens.hidden = false;
    guide.hidden = true;
  } else {
    lens.hidden = true;
    lens.dataset.stop = "";
    guide.hidden = false;
    renderGuide(guide);
  }

  $("chipGps").textContent = st.error ? st.error : st.pos ? `GPS ±${Math.round(st.accuracy)} m` : "Finding GPS…";
  $("chipGps").className = "chip " + (st.error ? "bad" : st.accuracy && st.accuracy <= 10 ? "ok" : "warn");
  $("chipHead").textContent = st.heading == null ? "No compass" : `Facing ${Math.round(st.heading)}° ${compassWord(st.heading)}`;
  $("chipHead").className = "chip " + (st.heading == null ? "warn" : "ok");
  $("chipMove").textContent = st.speed > tour.safety.still_below_mps ? "Walking · audio only" : "Still";
  $("chipEdits").hidden = !editsApplied;

  $("btnCalib").hidden = !(st.atStop && st.raw != null);
  $("btnForce").hidden = !!st.showing;
  $("btnSkip").hidden = !st.nextId;

  if (routeMap) routeMap.draw({ ...st, legIndex: st.legIndex });
  if (EDIT) renderEdit();
  if (st.sim) $("simHeading").value = Math.round(st.heading ?? 0);
}

function renderGuide(el) {
  const next = tour.stops.find((s) => s.id === st.nextId);
  let arrow = null, big = "", small = "";
  if (!next) {
    big = "Tour complete";
    small = "Head back to the start when you're ready.";
  } else if (!st.pos) {
    big = `Stop ${next.order}: ${next.name}`;
    small = st.error || "Waiting for GPS…";
  } else if (st.atStop) {
    const s = st.atStop;
    const t = targetBearing(s);
    if (st.heading == null) {
      big = s.facing.hint;
      small = `Face ${compassWord(t)}, toward ${s.facing.target_name}. No compass here: tap "Show scene".`;
    } else if (!st.facing) {
      const d = turn(st.heading, t);
      arrow = d;
      big = s.facing.hint;
      small = `Turn ${d > 0 ? "right" : "left"} about ${Math.abs(Math.round(d / 5) * 5)}°, toward ${s.facing.target_name}`;
    } else {
      big = "Stand still for a moment";
      small = "The scene appears when you stop walking.";
    }
  } else {
    const d = distance(st.pos, next.position);
    const b = bearing(st.pos, next.position);
    arrow = st.heading == null ? null : turn(st.heading, b);
    big = `Stop ${next.order}: ${next.name}`;
    small = `${Math.round(d)} m ${st.heading == null ? compassWord(b) : "ahead"} · follow the bright line on the map`;
  }
  el.innerHTML = `${arrow == null ? "" : `<div class="arrow" style="transform:rotate(${arrow}deg)">↑</div>`}
    <div class="big">${big}</div><div class="small">${small}</div>`;
}

let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 4000);
}

// ---------------------------------------------------------------- site-walk (edit) mode

function renderEdit() {
  const sel = $("editStop");
  if (!sel.options.length) {
    for (const s of tour.stops) sel.add(new Option(`${s.order}. ${s.name}`, s.id));
  }
  const s = tour.stops.find((x) => x.id === sel.value);
  const a = (loc || sim).averaged();
  $("editInfo").textContent =
    `${s.name}: ${s.position.lat.toFixed(6)}, ${s.position.lon.toFixed(6)} facing ${Math.round(targetBearing(s))}°` +
    (a ? ` · you: ${a.lat.toFixed(6)}, ${a.lon.toFixed(6)} (avg of ${a.n} fixes)` : "");
}

function wireEdit() {
  $("editPanel").hidden = false;
  const cur = () => tour.stops.find((x) => x.id === $("editStop").value);
  $("editPlace").onclick = () => {
    const a = (loc || sim).averaged();
    if (!a) return toast("No GPS fix yet.");
    const s = cur();
    s.position = { lat: +a.lat.toFixed(6), lon: +a.lon.toFixed(6) };
    saveEdit(s.id, { position: s.position });
    editsApplied = true;
    applyEdits();
    toast(`Stop ${s.order} placed here.`);
    render();
  };
  $("editFace").onclick = () => {
    if (st.raw == null) return toast("No compass reading.");
    const s = cur();
    s.facing.bearing_deg = Math.round(st.heading);
    saveEdit(s.id, { bearing: s.facing.bearing_deg });
    editsApplied = true;
    toast(`Stop ${s.order} faces ${s.facing.bearing_deg}° now.`);
    render();
  };
  $("editExport").onclick = () => {
    const out = JSON.parse(JSON.stringify(tour));
    for (const s of out.stops) {
      if (s.narration.audio) s.narration.audio = s.narration.audio.split("/").pop();
      if (s.scene.image) s.scene.image = s.scene.image.split("/").pop();
      s.placement = s.placement.replace(/^provisional/, "placed on site " + new Date().toISOString().slice(0, 10));
    }
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tour.json";
    a.click();
  };
  $("editReset").onclick = () => {
    try { localStorage.removeItem(EDIT_KEY); } catch { /* nothing stored */ }
    location.reload();
  };
  $("editStop").onchange = render;
}

// ---------------------------------------------------------------- simulator

function wireSim() {
  $("simPanel").hidden = false;
  document.body.classList.add("sim");
  sim = new SimSensors(tour.start.position, onLocation, onHeading);
  if (routeMap) routeMap.onTap = (p) => sim.set(p, 0);
  $("simHeading").oninput = (e) => sim.face(+e.target.value);
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") sim.face(sim.heading - 5);
    if (e.key === "ArrowRight") sim.face(sim.heading + 5);
  });
  $("simDemo").onclick = () => demo();
  sim.face(bearing(tour.start.position, tour.stops[0].position));
  sim.set(tour.start.position, 0);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Walks the whole route: along each leg (audio-only while moving), then
// arrives, turns to face the landmark, stands still for the scene.
async function demo() {
  const speedup = +(params.get("speedup") || 6);
  $("simDemo").disabled = true;
  for (const leg of map.legs) {
    const stop = tour.stops.find((s) => s.id === leg.to);
    for (let i = 0; i + 1 < leg.line.length; i++) {
      const a = ll(leg.line[i]), b = ll(leg.line[i + 1]);
      const d = distance(a, b), brg = bearing(a, b);
      for (let m = 0; m < d; m += 1.4 * speedup * 0.25) {
        sim.face(brg);
        sim.set(offset(a, m, brg), 1.4);
        await sleep(250);
      }
    }
    sim.set(stop.position, 0);
    await sleep(800);
    // turn toward the landmark in steps, as a person would
    const t = targetBearing(stop);
    while (Math.abs(turn(sim.heading, t)) > 3) {
      sim.face(sim.heading + Math.sign(turn(sim.heading, t)) * Math.min(6, Math.abs(turn(sim.heading, t))));
      await sleep(60);
    }
    while (!st.visited.has(stop.id)) { onLocation({ pos: sim.pos, accuracy: 4, speed: 0 }); await sleep(250); }
    await sleep(600);
  }
  $("simDemo").disabled = false;
}

// ---------------------------------------------------------------- start

async function startCamera() {
  const v = $("cam");
  if (v.srcObject) {
    v.srcObject.getTracks().forEach((t) => t.stop());
    v.srcObject = null;
    document.body.classList.remove("camera");
    return;
  }
  try {
    v.srcObject = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    document.body.classList.add("camera");
  } catch {
    toast("Camera unavailable. The tour works without it.");
  }
}

async function start(simMode) {
  st.sim = st.sim || simMode;
  $("intro").hidden = true;
  narrator.unlock();
  try { await navigator.wakeLock?.request("screen"); } catch { /* not supported */ }
  if (st.sim) {
    wireSim();
  } else {
    head = new LiveHeading(onHeading);
    const err = await head.request();
    if (err) toast(err);
    head.start();
    loc = new LiveLocation(onLocation);
    loc.start();
  }
  if (EDIT) wireEdit();
  setInterval(tick, 500); // keeps "still for N seconds" moving with no new fix
  render();
}

async function main() {
  if (GLASSES) document.body.classList.add("glasses");
  await load();
  $("tourTitle").textContent = `${tour.title} · ${tour.subtitle}`;
  $("introTitle").textContent = tour.title;
  $("introSub").textContent = tour.subtitle;
  $("introStatus").textContent = tour.status;
  $("introStops").innerHTML = tour.stops.map((s) => `<li>${s.name}</li>`).join("");
  $("introLength").textContent = `${tour.stops.length} stops · about ${Math.round(map.legs.reduce((n, l) => n + l.metres, 0) / 10) * 10} m of paved path`;
  narrator = new Narrator((c) => { $("caption").textContent = c; $("caption").hidden = !c; }, () => {});
  if (!GLASSES) {
    routeMap = new RouteMap($("map"), map, tour);
    addEventListener("resize", () => { routeMap.view = null; render(); });
  }
  $("btnLive").onclick = () => start(false);
  $("btnSim").onclick = () => start(true);
  $("btnCam").onclick = startCamera;
  $("btnMute").onclick = () => {
    narrator.muted = !narrator.muted;
    $("btnMute").textContent = narrator.muted ? "Sound off" : "Sound on";
    if (narrator.muted && "speechSynthesis" in window) speechSynthesis.cancel();
  };
  $("btnCalib").onclick = () => {
    const s = st.atStop;
    st.calib = turn(st.raw, targetBearing(s));
    onHeading(st.raw);
    toast(`Compass set: you are facing ${s.facing.target_name}.`);
  };
  $("btnForce").onclick = () => {
    const s = st.atStop || tour.stops.find((x) => x.id === st.nextId);
    if (!s) return;
    st.forced = s;
    tick();
  };
  $("btnSkip").onclick = () => {
    const s = tour.stops.find((x) => x.id === st.nextId);
    narrator.stop();
    if (s) finishStop(s);
  };
  $("btnSources").onclick = () => {
    const s = st.showing || st.atStop || tour.stops.find((x) => x.id === st.nextId) || tour.stops[0];
    $("sourcesBody").innerHTML =
      `<h3>${s.name}</h3><p class="muted">${s.narration.review}</p><ul>` +
      s.sources.map((x) => `<li><a href="${x.url}" target="_blank" rel="noopener">${x.label}</a></li>`).join("") +
      `</ul><h4>Still to do</h4><ul>${s.todo.map((t) => `<li>${t}</li>`).join("")}</ul>` +
      `<p class="muted">Placement: ${s.placement}</p>`;
    $("sources").hidden = false;
  };
  $("sourcesClose").onclick = () => ($("sources").hidden = true);
  // handle for tests and for driving demos from the console
  window.oriTour = { st, tour, map, sim: () => sim, demo };
  if (params.get("autostart") === "sim") start(true).then(() => params.get("demo") && demo());
}

main().catch((e) => {
  document.body.innerHTML = `<p style="padding:24px;color:#fff">Could not load the tour: ${e.message}</p>`;
});
