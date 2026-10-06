// Figure test page (ar.html): put a figure in one spot and walk around it.
//
// Route per phone, decided at load:
//   Android, Chrome with ARCore  -> WebXR session here: the portable FigureStage
//                                   (src/core/anchoring.ts) runs on the WebXRTracker.
//   iPhone (Safari and friends)  -> AR Quick Look: iOS's own viewer anchors the figure.
//   anything else                -> the figure turns on screen; AR needs one of the above.

import * as THREE from "three";

import { FigureStage, type StageView } from "../core/anchoring.ts";
import { FIGURES, figureById } from "../core/figures.ts";
import { contactShadow, buildFigure } from "./figures3d.ts";
import { openQuickLook, quickLookAvailable, usdzFor } from "./quicklook.ts";
import { WebXRTracker, webxrArAvailable } from "./xr.ts";

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing from ar.html`);
  return el as T;
};

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

/** A figure with its contact shadow, ready to place. */
function figureNode(id: string): THREE.Group {
  const spec = figureById(id)!;
  const node = new THREE.Group();
  node.add(buildFigure(id));
  const r = spec.footprintM;
  node.add(id === "mammoth" ? contactShadow(r * 0.55, r * 0.95) : contactShadow(r, r));
  return node;
}

let selected = FIGURES[0]!.id;
const pickers: HTMLElement[] = [];
function renderPickers(onPick: (id: string) => void): void {
  for (const root of [$("picker"), $("xrPicker")]) {
    root.innerHTML = "";
    for (const f of FIGURES) {
      const b = document.createElement("button");
      b.textContent = f.name[0]!.toUpperCase() + f.name.slice(1);
      b.dataset.id = f.id;
      b.addEventListener("click", () => onPick(f.id));
      // a tap on a control must not also place a figure
      b.addEventListener("beforexrselect", (e) => e.preventDefault());
      root.appendChild(b);
    }
    pickers.push(root);
  }
}
function markPicked(): void {
  for (const root of pickers)
    for (const b of root.querySelectorAll("button")) b.setAttribute("aria-pressed", String(b.dataset.id === selected));
  $("credit").textContent = `Model: ${figureById(selected)!.credit}`;
}

// ---- preview: the selected figure turning on screen (drag to turn it) ----

const preview = {
  scene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(35, 1, 0.1, 100),
  node: null as THREE.Group | null,
};
lights(preview.scene);
const spin = 0.6;
let dragging = false;
canvas.addEventListener("pointerdown", () => (dragging = true));
addEventListener("pointerup", () => (dragging = false));
canvas.addEventListener("pointermove", (e) => {
  if (dragging && preview.node) preview.node.rotation.y += e.movementX * 0.01;
});

function showPreview(id: string): void {
  if (preview.node) preview.scene.remove(preview.node);
  preview.node = figureNode(id);
  preview.node.rotation.y = Math.PI * 0.8; // open on a three-quarter front view
  preview.scene.add(preview.node);
  const h = figureById(id)!.heightM;
  const reach = Math.max(h, figureById(id)!.footprintM * 1.4);
  preview.camera.position.set(0, h * 0.75, reach * 3.1);
  preview.camera.lookAt(0, h * 0.45, 0);
}

function previewLoop(): void {
  renderer.setAnimationLoop(() => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio())) renderer.setSize(w, h, false);
    preview.camera.aspect = w / h;
    preview.camera.updateProjectionMatrix();
    if (preview.node && !dragging) preview.node.rotation.y += spin * 0.01;
    renderer.render(preview.scene, preview.camera);
  });
}

// ---- AR on Android: FigureStage on the WebXR tracker ----

async function startXr(): Promise<void> {
  const scene = new THREE.Scene();
  lights(scene);
  const camera = new THREE.PerspectiveCamera();
  const nodes = new Map<string, THREE.Group>();

  const reticle = new THREE.Group();
  const ring = (r0: number, r1: number, opacity: number): THREE.Mesh => {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(r0, r1, 48),
      new THREE.MeshBasicMaterial({ color: 0xffbe5a, transparent: true, opacity, depthWrite: false }),
    );
    m.rotation.x = -Math.PI / 2;
    return m;
  };
  reticle.add(ring(0.12, 0.17, 0.95));
  const footprint = ring(0.97, 1, 0.6); // scaled to the figure's footprint
  reticle.add(footprint);
  reticle.visible = false;
  scene.add(reticle);

  const overlay = $("xrOverlay");
  const tracker = new WebXRTracker(renderer, overlay, () => renderer.render(scene, camera));
  const stage = new FigureStage(tracker, FIGURES, { device: "phone" });
  stage.select(selected);

  let view: StageView | null = null;
  const draw = (v: StageView): void => {
    view = v;
    reticle.visible = v.reticle != null;
    if (v.reticle) {
      reticle.position.set(v.reticle.position.x, v.reticle.position.y, v.reticle.position.z);
      const r = figureById(v.selected)!.footprintM;
      footprint.scale.set(r, r, 1);
    }
    const seen = new Set<string>();
    for (const f of v.figures) {
      seen.add(f.id);
      let n = nodes.get(f.id);
      if (!n) {
        n = figureNode(f.id);
        nodes.set(f.id, n);
        scene.add(n);
      }
      n.visible = f.visible;
      n.position.set(f.pose.position.x, f.pose.position.y, f.pose.position.z);
      n.quaternion.set(f.pose.orientation.x, f.pose.orientation.y, f.pose.orientation.z, f.pose.orientation.w);
    }
    for (const [id, n] of nodes)
      if (!seen.has(id)) {
        scene.remove(n);
        nodes.delete(id);
      }
    $("prompt").textContent = v.prompt;
    $("readout").textContent = readout(v);
  };

  overlay.hidden = false;
  $("intro").hidden = true;
  renderer.setAnimationLoop(null);
  renderer.xr.enabled = true;

  const err = await tracker.start((frame) => draw(stage.frame(frame)));
  if (err) {
    endXr(err);
    return;
  }
  if (!tracker.canAnchor)
    $("prompt").textContent = "This phone's browser cannot anchor; the figure is held by tracking alone.";
  tracker.xrSession?.addEventListener("select", () => {
    if (view?.canPlace) void stage.place();
  });
  tracker.onEnd = () => endXr(null);
  pickHandler = (id) => stage.select(id);
  $("remove").onclick = () => stage.clear();
  $("exit").onclick = () => tracker.stop();
  for (const id of ["remove", "exit"]) $(id).addEventListener("beforexrselect", (e) => e.preventDefault());
}

let pickHandler: ((id: string) => void) | null = null;

function endXr(error: string | null): void {
  renderer.xr.enabled = false;
  pickHandler = null;
  $("xrOverlay").hidden = true;
  $("intro").hidden = false;
  if (error) $("route").textContent = error;
  previewLoop();
}

function readout(v: StageView): string {
  const lines = [`tracking   ${v.quality}`];
  for (const f of v.figures) {
    const hold =
      f.hold === "anchored" ? "pinned (anchor)" : f.hold === "anchoring" ? "pinning…" : "tracking only (no anchor)";
    lines.push(
      `${f.name.padEnd(10)} ${hold}`,
      `           ${f.distanceM == null ? "–" : f.distanceM.toFixed(1)} m away · ${Math.round(f.aroundDeg)}° around`,
      `           corrected ${(f.correctionM * 100).toFixed(0)} cm since placed`,
    );
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

  const go = $<HTMLButtonElement>("go");
  const route = $("route");
  if (await webxrArAvailable()) {
    go.textContent = "Start AR";
    go.disabled = false;
    route.textContent = "Android AR (ARCore in Chrome): the figure is pinned with an anchor, with a live readout.";
    go.onclick = () => void startXr();
  } else if (quickLookAvailable()) {
    $("how1").textContent = "Tap the button below. iOS opens its AR view; point the phone at the ground.";
    go.textContent = "Preparing…";
    // export ahead of the tap: Quick Look has to open inside the tap itself
    const urls = new Map<string, string>();
    await Promise.all(FIGURES.map(async (f) => urls.set(f.id, await usdzFor(f))));
    go.textContent = "View it in your space";
    go.disabled = false;
    route.textContent =
      "iPhone: Apple's AR Quick Look holds the figure in place. It runs outside this page, so there is no readout.";
    go.onclick = () => openQuickLook(urls.get(selected)!);
  } else {
    go.textContent = "AR not available here";
    route.textContent =
      "Open this page on an Android phone in Chrome (with Google Play Services for AR) or on an iPhone in Safari.";
  }
}

void main();
