// The figure page (ar.html): figures that stay in one spot, alone or inside
// the tour.
//
// Route per phone, decided at load:
//   Android, Chrome with ARCore  -> WebXR here. "Walk the tour here" moves the
//                                   Falls Park stops around the tester and runs
//                                   the real TourSession; TourFigures puts each
//                                   stop's figure on the ground near the stop
//                                   (src/core/tourfigures.ts). "Just place a
//                                   figure" is the free FigureStage.
//   iPhone (Safari and friends)  -> the tour runs in the page without AR, and
//                                   at a figure's stop "See it here" opens
//                                   Apple's AR Quick Look with that figure.
//   anything else                -> the figure turns on screen.

import * as THREE from "three";

import { FigureStage, type FigureView, type StageView } from "../core/anchoring.ts";
import { FIGURES, figureById, type FigureInfo } from "../core/figures.ts";
import { compassWord, distance } from "../core/geo.ts";
import type { Display } from "../core/ports.ts";
import { relocate } from "../core/relocate.ts";
import { TourSession } from "../core/session.ts";
import { loadTour } from "../core/tour.ts";
import { TourFigures, type TourFiguresView } from "../core/tourfigures.ts";
import type { Tour } from "../core/types.ts";
import type { ViewModel } from "../core/view.ts";
import { WebAudio } from "./audio.ts";
import { contactShadow, loadFigure } from "./figures3d.ts";
import { browserStorage, fetchAssets, intervalScheduler, wallClock } from "./platform.ts";
import { openQuickLook, quickLookAvailable, usdzFor } from "./quicklook.ts";
import { AccelerometerSource, CompassSource, GeolocationSource, settleFix } from "./sensors.ts";
import { WebXRTracker, webxrArAvailable } from "./xr.ts";

const params = new URLSearchParams(location.search);
const TOUR_ID = (params.get("tour") ?? "falls-park").replace(/[^\w-]/g, "");
const BASE = `content/${TOUR_ID}/`;
const storage = browserStorage();

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing from ar.html`);
  return el as T;
};
/** A tap on an overlay control must not also count as a tap on the ground. */
const noSelect = (el: HTMLElement): void => el.addEventListener("beforexrselect", (e) => e.preventDefault());

const canvas = $<HTMLCanvasElement>("stage");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const lights = (scene: THREE.Scene): void => {
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x3a3328, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(4, 8, 3);
  scene.add(sun);
};

const shadowFor = (info: FigureInfo, scale: number): THREE.Mesh => {
  const r = info.footprintM * scale;
  // long animals throw a long shadow; a person a round one
  return info.heightM > 1.5 * info.footprintM ? contactShadow(r, r) : contactShadow(r * 0.55, r * 0.95);
};

/** One figure in a scene: a holder at once, the model inside it when it arrives. */
async function figureNode(info: FigureInfo, scale: number, holder: THREE.Group): Promise<THREE.AnimationMixer | null> {
  holder.add(shadowFor(info, scale));
  const loaded = await loadFigure(info, scale);
  holder.add(loaded.node);
  return loaded.mixer;
}

/** The figures of a stage, kept in a three.js scene. */
class FigureLayer {
  private readonly scene: THREE.Scene;
  private readonly nodes = new Map<string, { holder: THREE.Group; mixer: THREE.AnimationMixer | null }>();
  private last = performance.now();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  draw(figures: readonly FigureView[]): void {
    const seen = new Set<string>();
    for (const f of figures) {
      seen.add(f.id);
      let n = this.nodes.get(f.id);
      if (!n) {
        const info = figureById(f.model);
        const holder = new THREE.Group();
        const entry = { holder, mixer: null as THREE.AnimationMixer | null };
        if (info) void figureNode(info, f.scale, holder).then((m) => (entry.mixer = m));
        this.scene.add(holder);
        this.nodes.set(f.id, entry);
        n = entry;
      }
      n.holder.visible = f.visible;
      const { position: p, orientation: q } = f.pose;
      n.holder.position.set(p.x, p.y, p.z);
      n.holder.quaternion.set(q.x, q.y, q.z, q.w);
    }
    for (const [id, n] of this.nodes)
      if (!seen.has(id)) {
        this.scene.remove(n.holder);
        this.nodes.delete(id);
      }
    const now = performance.now();
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    for (const n of this.nodes.values()) n.mixer?.update(dt);
  }
}

// ---- pickers and the turning preview ----

let selected = FIGURES[0]!.id;
let pickHandler: ((id: string) => void) | null = null;

function renderPickers(onPick: (id: string) => void): void {
  for (const root of [$("picker"), $("xrPicker")]) {
    root.innerHTML = "";
    for (const f of FIGURES) {
      const b = document.createElement("button");
      b.textContent = f.name[0]!.toUpperCase() + f.name.slice(1);
      b.dataset.id = f.id;
      b.addEventListener("click", () => onPick(f.id));
      noSelect(b);
      root.appendChild(b);
    }
  }
}
function markPicked(): void {
  for (const root of [$("picker"), $("xrPicker")])
    for (const b of root.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.id === selected));
  $("credit").textContent = `Model: ${figureById(selected)!.credit}`;
}

const preview = {
  scene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(35, 1, 0.1, 100),
  turn: new THREE.Group(),
  mixer: null as THREE.AnimationMixer | null,
  token: 0,
};
lights(preview.scene);
preview.scene.add(preview.turn);
let dragging = false;
canvas.addEventListener("pointerdown", () => (dragging = true));
addEventListener("pointerup", () => (dragging = false));
canvas.addEventListener("pointermove", (e) => {
  if (dragging) preview.turn.rotation.y += e.movementX * 0.01;
});

function showPreview(id: string): void {
  const info = figureById(id)!;
  const token = ++preview.token;
  preview.turn.clear();
  preview.mixer = null;
  preview.turn.rotation.y = Math.PI * 0.8; // open on a three-quarter front view
  const holder = new THREE.Group();
  preview.turn.add(holder);
  void figureNode(info, 1, holder).then((m) => {
    if (token === preview.token) preview.mixer = m;
  });
  const h = info.heightM;
  const reach = Math.max(h, info.footprintM * 1.4);
  preview.camera.position.set(0, h * 0.75, reach * 3.1);
  preview.camera.lookAt(0, h * 0.45, 0);
}

function previewLoop(): void {
  let last = performance.now();
  renderer.setAnimationLoop(() => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio())) renderer.setSize(w, h, false);
    preview.camera.aspect = w / h;
    preview.camera.updateProjectionMatrix();
    const now = performance.now();
    preview.mixer?.update(Math.min((now - last) / 1000, 0.1));
    last = now;
    if (!dragging) preview.turn.rotation.y += 0.006;
    renderer.render(preview.scene, preview.camera);
  });
}

// ---- the overlay: the tour's guide and caption, the figure's prompt ----

/** The tour's Display on this page: one line of guidance, the caption, and messages. */
class ArTourDisplay implements Display {
  view: ViewModel | null = null;
  private note: { text: string; until: number } | null = null;

  render(view: ViewModel): void {
    this.view = view;
    const g = view.guide;
    $("arrow").hidden = g.arrow == null;
    if (g.arrow != null) $("arrow").style.transform = `rotate(${Math.round(g.arrow)}deg)`;
    $("guideDetail").textContent = this.note && this.note.until > Date.now() ? this.note.text : g.detail;
    $("caption").hidden = !view.caption;
    $("caption").textContent = view.caption;
    $("skip").hidden = !view.controls.skip;
    $("calib").hidden = !view.controls.calibrate;
    $("force").hidden = !view.controls.force;
  }

  notify(text: string): void {
    this.note = { text, until: Date.now() + 5000 };
    $("guideDetail").textContent = text;
  }
}

function setPrompt(text: string | null): void {
  $("prompt").textContent = text ?? "";
  $("prompt").hidden = !text;
}

// ---- AR on Android ----

interface Running {
  tracker: WebXRTracker;
  exiting: boolean;
}
let running: Running | null = null;

/** Start a WebXR session drawing `scene`; `frame` runs once per XR frame. */
async function startXr(
  scene: THREE.Scene,
  frame: (f: Parameters<Parameters<WebXRTracker["start"]>[0]>[0], tracker: WebXRTracker) => void,
  onEnd: () => void,
): Promise<WebXRTracker | null> {
  const camera = new THREE.PerspectiveCamera();
  const tracker = new WebXRTracker(renderer, $("xrOverlay"), () => renderer.render(scene, camera));
  renderer.setAnimationLoop(null);
  renderer.xr.enabled = true;
  const err = await tracker.start((f) => frame(f, tracker));
  if (err) {
    renderer.xr.enabled = false;
    setPrompt(err);
    return null;
  }
  tracker.onEnd = () => {
    renderer.xr.enabled = false;
    onEnd();
  };
  return tracker;
}

function reticle(scene: THREE.Scene): { group: THREE.Group; footprint: THREE.Mesh } {
  const group = new THREE.Group();
  const ring = (r0: number, r1: number, opacity: number): THREE.Mesh => {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(r0, r1, 48),
      new THREE.MeshBasicMaterial({ color: 0xffbe5a, transparent: true, opacity, depthWrite: false }),
    );
    m.rotation.x = -Math.PI / 2;
    return m;
  };
  group.add(ring(0.12, 0.17, 0.95));
  const footprint = ring(0.97, 1, 0.6);
  group.add(footprint);
  group.visible = false;
  scene.add(group);
  return { group, footprint };
}

function showReticle(r: ReturnType<typeof reticle>, v: StageView, show: boolean): void {
  r.group.visible = show && v.reticle != null;
  if (v.reticle) {
    r.group.position.set(v.reticle.position.x, v.reticle.position.y, v.reticle.position.z);
    const info = figureById(v.figures.find((f) => f.id === v.selected)?.model ?? v.selected);
    const fp = info ? info.footprintM : 1;
    r.footprint.scale.set(fp, fp, 1);
  }
}

function enterOverlay(kind: "free" | "tour" | "flat"): void {
  $("intro").hidden = true;
  $("xrOverlay").hidden = false;
  document.body.classList.toggle("flat", kind === "flat");
  $("xrPicker").hidden = kind !== "free";
  $("remove").hidden = kind !== "free";
  $("guide").hidden = kind === "free";
  $("resumeAr").hidden = true;
  $("quicklook").hidden = true;
  for (const id of ["skip", "calib", "force", "caption"]) $(id).hidden = true;
  setPrompt(null);
}

function backToIntro(message: string | null): void {
  running = null;
  pickHandler = null;
  $("xrOverlay").hidden = true;
  $("intro").hidden = false;
  document.body.classList.remove("flat");
  if (message) $("route").textContent = message;
  previewLoop();
}

/** Free placement: pick a figure, tap the ground, walk around it. */
async function startFree(): Promise<void> {
  enterOverlay("free");
  const scene = new THREE.Scene();
  lights(scene);
  const layer = new FigureLayer(scene);
  const ret = reticle(scene);
  let stage: FigureStage | null = null;
  let view: StageView | null = null;
  const tracker = await startXr(
    scene,
    (f) => {
      if (!stage) return;
      view = stage.frame(f);
      showReticle(ret, view, true);
      layer.draw(view.figures);
      setPrompt(view.prompt);
      $("readout").textContent = stageReadout(view);
    },
    () => backToIntro(null),
  );
  if (!tracker) return backToIntro($("prompt").textContent);
  stage = new FigureStage(tracker, FIGURES, { device: "phone" });
  stage.select(selected);
  running = { tracker, exiting: false };
  if (!tracker.canAnchor) setPrompt("This phone's browser cannot anchor; the figure is held by tracking alone.");
  tracker.xrSession?.addEventListener("select", () => {
    if (view?.canPlace) void stage?.place();
  });
  pickHandler = (id) => stage?.select(id);
  $("remove").onclick = () => stage?.clear();
  $("exit").onclick = () => tracker.stop();
}

/** The tour, around the tester ("here") or at the park, with each stop's figure in AR. */
async function startTour(where: "here" | "park", ar: boolean): Promise<void> {
  // the compass permission prompt must be the first await after the tap on iOS
  const compass = new CompassSource();
  const permission = await compass.request();
  enterOverlay(ar ? "tour" : "flat");
  const display = new ArTourDisplay();
  const audio = new WebAudio(fetchAssets);
  audio.unlock();
  if (permission) display.notify(permission);
  if (!ar) previewLoop();

  let tour: Tour;
  try {
    tour = (await loadTour(BASE, fetchAssets)).tour;
  } catch (e) {
    return backToIntro(`The tour package did not load (${e instanceof Error ? e.message : String(e)}).`);
  }
  if (where === "here") {
    setPrompt("Finding where you are. Stand still for a few seconds.");
    let facing: number | null = null;
    const stopCompass = compass.start((h) => (facing = h));
    const here = await settleFix((t) => display.notify(t));
    stopCompass();
    if (!here) return backToIntro("No GPS fix. Check location permission, step outside, and try again.");
    const moved = relocate(tour, here, { facingDeg: facing });
    tour = moved.tour;
    const first = tour.stops[0];
    display.notify(
      `${tour.stops.length} stops around you, scaled to ${Math.round(moved.scale * 100)}%.` +
        (first
          ? ` Stop 1 is ${Math.round(distance(here, first.position))} m ${facing == null ? "away" : `ahead (${compassWord(facing)})`}.`
          : ""),
    );
  }
  setPrompt(null);

  const session = new TourSession(
    tour,
    { clock: wallClock, scheduler: intervalScheduler, audio, display },
    { hasMap: false },
  );
  await session.start({ location: new GeolocationSource(), heading: compass, motion: new AccelerometerSource() });
  $("skip").onclick = () => session.skip();
  $("calib").onclick = () => session.calibrate();
  $("force").onclick = () => session.force();

  let ended = false;
  const finish = (message: string | null): void => {
    ended = true;
    session.stop();
    backToIntro(message);
  };

  if (!ar) {
    // iPhone: no AR session in the page. At a stop with a figure, Quick Look shows it.
    const urls = new Map<string, Promise<{ url: string; source: string }>>();
    for (const s of tour.stops) {
      const info = s.figure ? figureById(s.figure.model) : undefined;
      if (info && !urls.has(info.id)) urls.set(info.id, usdzFor(info));
    }
    const ready = new Map<string, string>();
    for (const [id, p] of urls) void p.then((r) => ready.set(id, r.url));
    const timer = setInterval(() => {
      if (ended) return clearInterval(timer);
      const st = session.engine.state;
      const info = st.atStop?.figure ? figureById(st.atStop.figure.model) : undefined;
      const url = info ? ready.get(info.id) : undefined;
      $("quicklook").hidden = !url;
      if (info && url) {
        $("quicklook").textContent = `See the ${info.name} here`;
        $("quicklook").onclick = () => openQuickLook(url);
      }
      setPrompt(display.view?.guide.title ?? null);
      $("readout").textContent = tourReadout(session, null, null);
    }, 250);
    $("exit").onclick = () => finish(null);
    return;
  }

  // Android: AR on top of the running tour. A screen lock or "Exit AR" ends the
  // AR session but not the tour; "Back to AR" starts a new one and re-places
  // the figure (or restores it, where the browser keeps anchors).
  const runAr = async (): Promise<void> => {
    $("resumeAr").hidden = true;
    const scene = new THREE.Scene();
    lights(scene);
    const layer = new FigureLayer(scene);
    const ret = reticle(scene);
    let figures: TourFigures | null = null;
    let fv: TourFiguresView | null = null;
    const tracker = await startXr(
      scene,
      (f) => {
        if (!figures) return;
        const st = session.engine.state;
        fv = figures.update({
          frame: f,
          fix: st.pos && st.accuracy != null ? { pos: st.pos, accuracy: st.accuracy } : null,
          heading: st.heading,
          headingSteady: st.headingSteady,
          atStop: st.atStop,
        });
        showReticle(ret, fv.stage, fv.mode === "tap");
        layer.draw(fv.stage.figures);
        setPrompt(fv.prompt ?? display.view?.guide.title ?? null);
        $("readout").textContent = tourReadout(session, fv, figures);
      },
      () => {
        if (ended) return;
        if (running?.exiting) return finish(null);
        $("resumeAr").hidden = false;
        setPrompt("AR paused (screen locked or closed). The tour is still running.");
        previewLoop();
      },
    );
    if (!tracker) {
      $("resumeAr").hidden = false;
      return;
    }
    figures = new TourFigures(tracker, tour, { storage, device: "phone" });
    running = { tracker, exiting: false };
    tracker.xrSession?.addEventListener("select", () => {
      if (fv?.mode === "tap") void figures?.tap();
    });
    $("exit").onclick = () => {
      if (running) running.exiting = true;
      tracker.stop();
    };
  };
  $("resumeAr").onclick = () => void runAr();
  $("exit").onclick = () => finish(null);
  await runAr();
}

// ---- the readouts: what is happening, in numbers, for the parking-lot test ----

function holdWords(f: FigureView): string {
  return f.hold === "anchored" ? "pinned (anchor)" : f.hold === "anchoring" ? "pinning…" : "tracking only (no anchor)";
}

function figureLines(f: FigureView): string[] {
  return [
    `${f.name.padEnd(10)} ${holdWords(f)}`,
    `           ${f.distanceM == null ? "–" : f.distanceM.toFixed(1)} m away · ${Math.round(f.aroundDeg)}° around`,
    `           corrected ${(f.correctionM * 100).toFixed(0)} cm since placed`,
  ];
}

function stageReadout(v: StageView): string {
  return [`tracking   ${v.quality}`, ...v.figures.flatMap(figureLines)].join("\n");
}

function tourReadout(session: TourSession, fv: TourFiguresView | null, figures: TourFigures | null): string {
  const st = session.engine.state;
  const next = session.tour.stops.find((s) => s.id === st.nextId);
  const lines = [
    `GPS        ${st.accuracy == null ? "no fix" : `±${Math.round(st.accuracy)} m`}`,
    `compass    ${st.heading == null ? "none" : `${Math.round(st.heading)}°${st.headingSteady ? "" : " (unsteady)"}`}`,
    `stop       ${st.atStop ? `at ${st.atStop.name}` : next && st.pos ? `${Math.round(distance(st.pos, next.position))} m to ${next.name}` : "–"}`,
  ];
  if (fv && figures) {
    lines.push(`tracking   ${fv.stage.quality}`, `north      ${fv.northYaw == null ? "learning" : "learned"}`);
    lines.push(`figure     ${fv.mode}${fv.waitingFor ? ` (waiting for ${fv.waitingFor})` : ""}`);
    for (const f of fv.stage.figures) lines.push(...figureLines(f));
  }
  return lines.join("\n");
}

// ---- boot: pick the route for this phone ----

async function main(): Promise<void> {
  renderPickers((id) => {
    selected = id;
    markPicked();
    showPreview(id);
    pickHandler?.(id);
  });
  markPicked();
  showPreview(selected);
  previewLoop();
  for (const id of ["exit", "remove", "resumeAr", "quicklook", "skip", "calib", "force"]) noSelect($(id));

  const goTour = $<HTMLButtonElement>("goTour");
  const goFree = $<HTMLButtonElement>("goFree");
  const goPark = $<HTMLButtonElement>("goPark");
  const route = $("route");
  if (await webxrArAvailable()) {
    goTour.textContent = "Walk the tour here";
    for (const b of [goTour, goFree, goPark]) b.disabled = false;
    route.textContent =
      "Android AR (ARCore in Chrome): each stop's figure is put on the ground near the stop and pinned with an anchor.";
    goTour.onclick = () => void startTour("here", true);
    goPark.onclick = () => void startTour("park", true);
    goFree.onclick = () => void startFree();
  } else if (quickLookAvailable()) {
    goTour.textContent = "Walk the tour here";
    for (const b of [goTour, goFree, goPark]) b.disabled = false;
    route.textContent =
      "iPhone: the tour runs in the page; at a figure's stop, \"See it here\" opens Apple's AR view, where you tap the ground once and the figure stays put.";
    goTour.onclick = () => void startTour("here", false);
    goPark.onclick = () => void startTour("park", false);
    goFree.textContent = "Preparing…";
    goFree.disabled = true;
    // prepare ahead of the tap: Quick Look has to open inside the tap itself
    const urls = new Map<string, string>();
    await Promise.all(FIGURES.map(async (f) => urls.set(f.id, (await usdzFor(f)).url)));
    goFree.textContent = "See a figure in your space";
    goFree.disabled = false;
    goFree.onclick = () => openQuickLook(urls.get(selected)!);
  } else {
    goTour.textContent = "AR not available here";
    route.textContent =
      "Open this page on an Android phone in Chrome (with Google Play Services for AR) or on an iPhone in Safari.";
  }
}

void main();
