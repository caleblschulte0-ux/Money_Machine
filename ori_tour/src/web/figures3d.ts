// The browser's 3D figures (src/core/figures.ts): loadFigure() reads the
// figure's real glTF model (meshopt-compressed) and fits it to its true size;
// if that fails (offline before first load, a bad file, an old phone) it
// falls back to a STAND-IN drawn here in code from simple shapes, with no
// external source, so a stop never loses its figure.
//
// Units are metres. Origin is the middle of the footprint on the ground; the
// figure's front (the mammoth's head, the settler's face) looks down -z, the
// convention in src/core/space.ts.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

import type { FigureInfo } from "../core/figures.ts";

/** Deterministic noise, so a figure looks the same on every load and every device. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const mat = (color: number, roughness = 0.9): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, flatShading: true });

/** An ellipsoid with a lumpy, shaggy surface. */
function shaggy(rx: number, ry: number, rz: number, lump: number, seed: number, m: THREE.Material): THREE.Mesh {
  const g = new THREE.IcosahedronGeometry(1, 3);
  const pos = g.getAttribute("position");
  const r = rng(seed);
  const v = new THREE.Vector3();
  // IcosahedronGeometry is non-indexed: displace equal vertices equally so it stays closed
  const memo = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const key = `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`;
    let k = memo.get(key);
    if (k === undefined) {
      k = 1 + (r() - 0.5) * lump;
      memo.set(key, k);
    }
    pos.setXYZ(i, v.x * rx * k, v.y * ry * k, v.z * rz * k);
  }
  g.computeVertexNormals();
  return new THREE.Mesh(g, m);
}

/** A tube whose radius tapers from r0 to r1 along a curve (trunks, tusks, tails, arms). */
function taperedTube(points: THREE.Vector3[], r0: number, r1: number, m: THREE.Material, radial = 10): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points);
  const segs = 24;
  const frames = curve.computeFrenetFrames(segs, false);
  const verts: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const c = curve.getPointAt(t);
    const r = r0 + (r1 - r0) * t;
    const n = frames.normals[i]!;
    const b = frames.binormals[i]!;
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      verts.push(
        c.x + r * (Math.cos(a) * n.x + Math.sin(a) * b.x),
        c.y + r * (Math.cos(a) * n.y + Math.sin(a) * b.y),
        c.z + r * (Math.cos(a) * n.z + Math.sin(a) * b.z),
      );
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j;
      const b = i * radial + ((j + 1) % radial);
      const c = (i + 1) * radial + j;
      const d = (i + 1) * radial + ((j + 1) % radial);
      index.push(a, c, b, b, c, d);
    }
  }
  // close the thick end
  const end = c0(curve, verts);
  for (let j = 0; j < radial; j++) index.push(end, (j + 1) % radial, j);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return new THREE.Mesh(g, m);
}

function c0(curve: THREE.CatmullRomCurve3, verts: number[]): number {
  const p = curve.getPointAt(0);
  verts.push(p.x, p.y, p.z);
  return verts.length / 3 - 1;
}

/** An open skirt of long hair hanging from y0 down to about y1, with a ragged hem. */
function hairSkirt(rx: number, rz: number, y0: number, y1: number, seed: number, m: THREE.Material): THREE.Mesh {
  const g = new THREE.CylinderGeometry(1, 1.08, y0 - y1, 40, 4, true);
  const pos = g.getAttribute("position");
  const r = rng(seed);
  const hem = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    let y = pos.getY(i);
    const z = pos.getZ(i);
    if (y < -(y0 - y1) / 2 + 1e-6) {
      const key = `${x.toFixed(4)},${z.toFixed(4)}`;
      let drop = hem.get(key);
      if (drop === undefined) {
        drop = r() * 0.35;
        hem.set(key, drop);
      }
      y -= drop;
    }
    pos.setXYZ(i, x * rx, y + (y0 + y1) / 2, z * rz);
  }
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, m);
  (m as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  return mesh;
}

function mammoth(): THREE.Group {
  const g = new THREE.Group();
  g.name = "mammoth";
  const fur = mat(0x6b4426);
  const furDark = mat(0x4a2d18);
  const ivory = mat(0xe9dfc6, 0.55);
  const dark = mat(0x1a1410, 0.6);
  const add = (m: THREE.Object3D, x: number, y: number, z: number): THREE.Object3D => {
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };

  // body: high at the shoulders, sloping down to the rump
  const body = add(shaggy(1.15, 0.95, 1.85, 0.12, 1, fur), 0, 2.0, 0.25);
  body.rotation.x = -0.12;
  add(shaggy(0.85, 0.7, 0.85, 0.14, 2, fur), 0, 2.6, -0.75); // shoulder hump
  add(hairSkirt(1.05, 1.75, 1.9, 0.95, 3, furDark.clone()), 0, 0, 0.2);

  // legs: columns with shaggy sleeves, dark round feet
  for (const [x, z] of [
    [-0.55, -0.95],
    [0.55, -0.95],
    [-0.55, 1.3],
    [0.55, 1.3],
  ] as const) {
    const leg = new THREE.CylinderGeometry(0.36, 0.32, 1.7, 12);
    add(new THREE.Mesh(leg, furDark), x, 0.85, z);
    add(shaggy(0.44, 0.55, 0.44, 0.2, 10 + x * 7 + z * 3, fur), x, 1.25, z);
    const foot = new THREE.CylinderGeometry(0.34, 0.37, 0.12, 14);
    add(new THREE.Mesh(foot, dark), x, 0.06, z);
  }

  // head and its high dome
  add(shaggy(0.62, 0.68, 0.62, 0.1, 4, fur), 0, 2.55, -1.95);
  add(shaggy(0.42, 0.5, 0.45, 0.12, 5, furDark), 0, 2.95, -1.85);
  for (const s of [-1, 1]) {
    const ear = shaggy(0.12, 0.26, 0.2, 0.15, 6 + s, furDark);
    add(ear, s * 0.58, 2.65, -1.75);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), dark);
    add(eye, s * 0.42, 2.6, -2.4);
    // tusks: out, down, forward, then curling up and in
    g.add(
      taperedTube(
        [
          new THREE.Vector3(s * 0.28, 2.15, -2.3),
          new THREE.Vector3(s * 0.45, 1.55, -2.85),
          new THREE.Vector3(s * 0.85, 1.2, -3.45),
          new THREE.Vector3(s * 1.0, 1.55, -3.95),
          new THREE.Vector3(s * 0.7, 2.0, -4.1),
        ],
        0.12,
        0.025,
        ivory,
      ),
    );
  }
  // trunk: hanging, curling slightly forward at the tip
  g.add(
    taperedTube(
      [
        new THREE.Vector3(0, 2.35, -2.45),
        new THREE.Vector3(0, 1.75, -2.75),
        new THREE.Vector3(0, 1.0, -2.75),
        new THREE.Vector3(0, 0.45, -2.6),
        new THREE.Vector3(0, 0.3, -2.4),
      ],
      0.24,
      0.08,
      furDark,
    ),
  );
  // tail with a tuft
  g.add(
    taperedTube(
      [new THREE.Vector3(0, 2.15, 2.05), new THREE.Vector3(0, 1.8, 2.3), new THREE.Vector3(0, 1.45, 2.3)],
      0.09,
      0.04,
      furDark,
    ),
  );
  add(shaggy(0.1, 0.18, 0.1, 0.3, 7, dark), 0, 1.38, 2.3);

  // centre the footprint (tusk tips to tail) on the origin
  g.position.z = 0;
  const box = new THREE.Box3().setFromObject(g);
  const shift = -(box.min.z + box.max.z) / 2;
  for (const c of g.children) c.position.z += shift;
  return g;
}

function settler(): THREE.Group {
  const g = new THREE.Group();
  g.name = "settler";
  const coat = mat(0x7a5a3a);
  const trousers = mat(0x3b3a36);
  const boots = mat(0x241a12, 0.7);
  const skin = mat(0xc99a78, 0.8);
  const hat = mat(0x2f2620);
  const shirt = mat(0xd8d0bd);
  const add = (m: THREE.Object3D, x: number, y: number, z: number): THREE.Object3D => {
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };

  for (const s of [-1, 1]) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.78, 10), trousers), s * 0.1, 0.48, 0);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.27), boots);
    add(boot, s * 0.1, 0.06, -0.04);
  }
  // long coat, open at the hem, over the shirt
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.9, 16, 1, true), coat), 0, 0.98, 0);
  coat.side = THREE.DoubleSide;
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.35, 16), coat), 0, 1.38, 0);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28, 0.02), shirt), 0, 1.4, -0.175);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.08, 10), skin), 0, 1.58, 0);
  // arms hanging at the sides, hands
  for (const s of [-1, 1]) {
    g.add(
      taperedTube(
        [
          new THREE.Vector3(s * 0.21, 1.5, 0),
          new THREE.Vector3(s * 0.26, 1.2, 0.02),
          new THREE.Vector3(s * 0.25, 0.92, -0.04),
        ],
        0.06,
        0.05,
        coat,
      ),
    );
    add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), skin), s * 0.25, 0.87, -0.05);
  }
  // head, nose (which way they face), wide-brim hat
  add(new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), skin), 0, 1.69, 0);
  add(new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), skin), 0, 1.68, -0.11);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.015, 24), hat), 0, 1.76, 0);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.12, 16), hat), 0, 1.83, 0);
  return g;
}

const BUILDERS: Record<string, () => THREE.Group> = { mammoth, "mammoth-calf": mammoth, settler };

/** The model for a figure id. Throws for an id with no model: a figure that silently draws as something else is a bug. */
export function buildFigure(id: string): THREE.Group {
  const build = BUILDERS[id];
  if (!build) throw new Error(`no 3D model for figure "${id}"`);
  const g = build();
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return g;
}

export const hasModel = (id: string): boolean => id in BUILDERS;

/** A soft dark patch on the ground under a figure: what makes it read as standing there, not floating. */
export function contactShadow(radiusX: number, radiusZ: number): THREE.Mesh {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, "rgba(0,0,0,0.55)");
  grad.addColorStop(0.6, "rgba(0,0,0,0.25)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radiusX * 2, radiusZ * 2),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.01;
  m.renderOrder = -1;
  return m;
}

/**
 * Scale an object to `heightM` tall, stand it on y = 0 and centre its
 * footprint on the origin, after turning its front to -z. Measures the real
 * (skinned, posed) geometry, so a model in any unit or offset fits.
 */
export function fitToSize(obj: THREE.Object3D, heightM: number, frontYawDeg = 0): THREE.Group {
  const turn = new THREE.Group();
  turn.rotation.y = (frontYawDeg * Math.PI) / 180;
  turn.add(obj);
  const outer = new THREE.Group();
  outer.add(turn);
  outer.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(outer, true);
  const size = box.getSize(new THREE.Vector3());
  const k = size.y > 0 ? heightM / size.y : 1;
  turn.scale.setScalar(k);
  turn.position.set(-((box.min.x + box.max.x) / 2) * k, -box.min.y * k, -((box.min.z + box.max.z) / 2) * k);
  return outer;
}

export interface LoadedFigure {
  node: THREE.Group;
  /** Plays the model's idle clip; advance it every frame. Null for a still figure. */
  mixer: THREE.AnimationMixer | null;
  source: "model" | "stand-in";
}

const files = new Map<string, Promise<ArrayBuffer>>();

/** The figure's model at true size (times `scale`), or its drawn stand-in if the model cannot be loaded. */
export async function loadFigure(info: FigureInfo, scale = 1): Promise<LoadedFigure> {
  const height = info.heightM * scale;
  try {
    let bytes = files.get(info.file.glb);
    if (!bytes) {
      bytes = fetch(info.file.glb).then((r) => {
        if (!r.ok) throw new Error(`${info.file.glb}: HTTP ${r.status}`);
        return r.arrayBuffer();
      });
      files.set(info.file.glb, bytes);
      bytes.catch(() => files.delete(info.file.glb));
    }
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    // parse a fresh copy per figure: two of the same model each get their own skeleton
    const gltf = await loader.parseAsync((await bytes).slice(0), "");
    const scene = gltf.scene;
    scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        if (info.file.tint != null && o.material instanceof THREE.MeshStandardMaterial) {
          o.material.color.setHex(info.file.tint);
        }
      }
    });
    const node = fitToSize(scene, height, info.file.frontYawDeg);
    let mixer: THREE.AnimationMixer | null = null;
    const clip = info.file.idleClip ? THREE.AnimationClip.findByName(gltf.animations, info.file.idleClip) : null;
    if (clip) {
      mixer = new THREE.AnimationMixer(scene);
      mixer.clipAction(clip).play();
    }
    return { node, mixer, source: "model" };
  } catch (e) {
    console.warn(`figure ${info.id}: model failed, showing the stand-in`, e);
    return { node: fitToSize(buildFigure(info.model), height), mixer: null, source: "stand-in" };
  }
}
