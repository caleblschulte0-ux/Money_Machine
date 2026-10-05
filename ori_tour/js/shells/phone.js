// Phone shell: the scene window, guidance, captions, status chips, route map,
// staff controls, and the simulator / site-walk / record / replay panels.

import { compassWord } from "../core/geo.js";
import { applyPlacements, targetBearing } from "../core/tour.js";
import { RouteMap } from "../ui/map.js";
import { renderScene } from "../ui/scene.js";
import { guidance } from "./runtime.js";

const $ = (id) => document.getElementById(id);

export function mountPhone(rt, { editKey, editsApplied }) {
  const { tour, map, params } = rt;
  const st = rt.st;
  const EDIT = params.get("edit") === "1";
  let routeMap = new RouteMap($("map"), map, tour);
  addEventListener("resize", () => { routeMap.view = null; render(); });

  // ---------------------------------------------------------- drawing

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
      const g = guidance(rt);
      guide.innerHTML = `${g.arrow == null ? "" : `<div class="arrow" style="transform:rotate(${g.arrow}deg)">↑</div>`}
        <div class="big">${g.big}</div><div class="small">${g.small}</div>`;
    }

    $("chipGps").textContent = st.error ? st.error : st.pos ? `GPS ±${Math.round(st.accuracy)} m` : "Finding GPS…";
    $("chipGps").className = "chip " + (st.error ? "bad" : st.accuracy && st.accuracy <= 10 ? "ok" : "warn");
    $("chipHead").textContent = st.heading == null ? "No compass" : `Facing ${Math.round(st.heading)}° ${compassWord(st.heading)}`;
    $("chipHead").className = "chip " + (st.heading == null ? "warn" : st.headingSteady ? "ok" : "warn");
    $("chipMove").textContent = st.moving ? "Walking · audio only" : st.still ? "Still" : "Stopping…";
    $("chipEdits").hidden = !editsApplied.value;

    $("btnCalib").hidden = !(st.atStop && st.raw != null);
    $("btnForce").hidden = !!st.showing;
    $("btnSkip").hidden = !st.nextId;

    routeMap.draw({ ...st });
    if (EDIT) renderEdit();
    if (rt.sim) $("simHeading").value = Math.round(st.heading ?? 0);
    if (rt.recorder) $("recInfo").textContent = `${rt.recorder.gpsCount} GPS fixes recorded`;
  }

  let toastTimer;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 4000);
  }

  rt.on((e) => {
    if (e.type === "render" || e.type === "stop-done") render();
    if (e.type === "toast") toast(e.text);
    if (e.type === "caption") { $("caption").textContent = e.text; $("caption").hidden = !e.text; }
  });

  // ---------------------------------------------------------- controls

  $("btnCam").onclick = startCamera;
  $("btnMute").onclick = () => {
    rt.narrator.muted = !rt.narrator.muted;
    $("btnMute").textContent = rt.narrator.muted ? "Sound off" : "Sound on";
    if (rt.narrator.muted) rt.narrator.stop();
  };
  $("btnCalib").onclick = () => rt.calibrate();
  $("btnForce").onclick = () => rt.force();
  $("btnSkip").onclick = () => rt.skip();
  $("btnSources").onclick = () => {
    const s = st.showing || st.atStop || tour.stops.find((x) => x.id === st.nextId) || tour.stops[0];
    $("sourcesBody").innerHTML =
      `<h3>${s.name}</h3><p class="muted">${s.narration.review}</p><ul>` +
      s.sources.map((x) => `<li><a href="${x.url}" target="_blank" rel="noopener">${x.label}</a></li>`).join("") +
      `</ul><h4>Still to do</h4><ul>${s.todo.map((t) => `<li>${t}</li>`).join("")}</ul>` +
      `<p class="muted">Placement: ${s.placement}</p>` +
      (s.narration.voice ? `<p class="muted">Voice: ${s.narration.voice}</p>` : "");
    $("sources").hidden = false;
  };
  $("sourcesClose").onclick = () => ($("sources").hidden = true);

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

  // ---------------------------------------------------------- per-mode panels

  function afterStart() {
    if (rt.mode === "sim") {
      $("simPanel").hidden = false;
      document.body.classList.add("sim");
      routeMap.onTap = (p) => rt.sim.set(p, 0);
      $("simHeading").oninput = (e) => rt.sim.face(+e.target.value);
      document.addEventListener("keydown", (e) => {
        if (e.key === "ArrowLeft") rt.sim.face(rt.sim.heading - 5);
        if (e.key === "ArrowRight") rt.sim.face(rt.sim.heading + 5);
      });
      $("simDemo").onclick = async () => { $("simDemo").disabled = true; await rt.demo(); $("simDemo").disabled = false; };
    }
    if (rt.mode === "replay") document.body.classList.add("sim");
    if (rt.recorder) {
      $("recPanel").hidden = false;
      $("recSave").onclick = () => rt.saveRecording();
    }
    if (EDIT) wireEdit();
  }

  // ---------------------------------------------------------- site-walk (edit) mode

  function saveEdit(stopId, patch) {
    let edits;
    try { edits = JSON.parse(localStorage.getItem(editKey) || "{}"); } catch { edits = {}; }
    edits[stopId] = { ...(edits[stopId] || {}), ...patch };
    try { localStorage.setItem(editKey, JSON.stringify(edits)); } catch { /* storage blocked: edit lasts this session only */ }
    applyPlacements(tour, map, edits);
    editsApplied.value = true;
    routeMap.view = null;
  }

  function renderEdit() {
    const sel = $("editStop");
    if (!sel.options.length) for (const s of tour.stops) sel.add(new Option(`${s.order}. ${s.name}`, s.id));
    const s = tour.stops.find((x) => x.id === sel.value);
    const a = rt.positionSource()?.averaged();
    $("editInfo").textContent =
      `${s.name}: ${s.position.lat.toFixed(6)}, ${s.position.lon.toFixed(6)} facing ${Math.round(targetBearing(s))}°` +
      (a ? ` · you: ${a.lat.toFixed(6)}, ${a.lon.toFixed(6)} (avg of ${a.n} fixes)` : "");
  }

  function wireEdit() {
    $("editPanel").hidden = false;
    const cur = () => tour.stops.find((x) => x.id === $("editStop").value);
    $("editPlace").onclick = () => {
      const a = rt.positionSource()?.averaged();
      if (!a) return toast("No GPS fix yet.");
      const s = cur();
      s.position = { lat: +a.lat.toFixed(6), lon: +a.lon.toFixed(6) };
      saveEdit(s.id, { position: s.position });
      toast(`Stop ${s.order} placed here.`);
      render();
    };
    $("editFace").onclick = () => {
      if (st.raw == null) return toast("No compass reading.");
      const s = cur();
      s.facing.bearing_deg = Math.round(st.heading);
      saveEdit(s.id, { bearing: s.facing.bearing_deg });
      toast(`Stop ${s.order} faces ${s.facing.bearing_deg}° now.`);
      render();
    };
    $("editExport").onclick = () => {
      const out = JSON.parse(JSON.stringify(tour));
      const strip = (p) => p && p.slice(rt.base.length);
      for (const s of out.stops) {
        s.narration.audio = strip(s.narration.audio) || null;
        if (s.narration.cues) s.narration.cues = strip(s.narration.cues);
        if (s.scene.image) s.scene.image = strip(s.scene.image);
        for (const l of s.scene.layers || []) if (l.src) l.src = strip(l.src);
        s.placement = s.placement.replace(/^provisional/, "placed on site " + new Date().toISOString().slice(0, 10));
      }
      const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "tour.json";
      a.click();
    };
    $("editReset").onclick = () => {
      try { localStorage.removeItem(editKey); } catch { /* nothing stored */ }
      location.reload();
    };
    $("editStop").onchange = render;
  }

  return { render, afterStart, toast };
}
