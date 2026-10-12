// Gaussian splat figures in the browser (src/core/figures.ts FigureSplat), drawn
// with Spark (sparkjs.dev, MIT, bundled into vendor/spark.js). Spark is 2.5 MB,
// so it is imported only when a splat figure is first shown.

import * as THREE from "three";

import type * as SparkModule from "@sparkjsdev/spark";

import type { FigureSplat } from "../core/figures.ts";

type Spark = typeof SparkModule;

let spark: Promise<Spark> | null = null;
let renderer: THREE.WebGLRenderer | null = null;
const withRenderer = new WeakSet<THREE.Object3D>();

/** Let this page draw splats with `r` (a splat needs WebGL2). Call once, before any figure loads. */
export function useSplats(r: THREE.WebGLRenderer): void {
  renderer = r.capabilities.isWebGL2 ? r : null;
}

export const splatsAvailable = (): boolean => renderer != null;

/** A splat at true size: `heightM` tall, standing on y = 0, its front down -z. */
export async function loadSplat(splat: FigureSplat, heightM: number): Promise<THREE.Group> {
  spark ??= import("@sparkjsdev/spark");
  const { SplatMesh } = await spark;
  const mesh = new SplatMesh({ url: splat.file });
  await mesh.initialized;
  const box = mesh.getBoundingBox(true);
  const k = box.max.y > box.min.y ? heightM / (box.max.y - box.min.y) : 1;
  const turn = new THREE.Group();
  turn.rotation.y = (splat.frontYawDeg * Math.PI) / 180;
  mesh.scale.setScalar(k);
  mesh.position.set(-((box.min.x + box.max.x) / 2) * k, -box.min.y * k, -((box.min.z + box.max.z) / 2) * k);
  turn.add(mesh);
  const node = new THREE.Group();
  node.add(turn);
  node.userData.splat = true;
  return node;
}

/** A splat draws only in a scene that holds a SparkRenderer: add one to the scene `obj` is in, once. */
export async function attachSplatRenderer(obj: THREE.Object3D): Promise<void> {
  let root = obj;
  while (root.parent) root = root.parent;
  if (!renderer || withRenderer.has(root)) return;
  withRenderer.add(root);
  spark ??= import("@sparkjsdev/spark");
  const { SparkRenderer } = await spark;
  root.add(new SparkRenderer({ renderer }));
}
