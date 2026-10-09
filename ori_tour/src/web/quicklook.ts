// The iPhone route to a world-locked figure. Safari on iPhone has no WebXR
// augmented reality, but it has AR Quick Look: hand it a USDZ model and iOS
// opens its own AR view (ARKit), where the visitor places the figure on the
// ground and it stays there as they walk around it.
//
// What that costs: Quick Look is Apple's viewer, not ours. Inside it the tour
// cannot run (no prompts, captions, narration triggers or readout), and the
// figure is placed by the visitor, not at a stop. It proves the anchoring on
// an iPhone today. In the tour, an iPhone runs the walk in the page and offers
// a "See it here" button at a figure's stop, which opens the figure in Quick
// Look. A tour that keeps figures inside it on iPhones needs a native
// app (ARKit) or an App Clip, which needs a Mac and an Apple developer account.

import * as THREE from "three";
import { USDZExporter } from "three/addons/exporters/USDZExporter.js";

import type { FigureInfo } from "../core/figures.ts";
import { buildFigure } from "./figures3d.ts";

/** True on browsers that open AR Quick Look links (Safari and other browsers on iPhone and iPad). */
export function quickLookAvailable(): boolean {
  const a = document.createElement("a");
  return a.relList.supports("ar");
}

/**
 * A blob URL for the figure's USDZ: the prepared file (assets/figures/*.usdz,
 * made from the real model by tools/build_figures.mjs), or, if that cannot be
 * fetched, the code-drawn stand-in exported in the page. A blob URL needs no
 * server file type, which static hosts often get wrong for .usdz.
 */
export async function usdzFor(info: FigureInfo): Promise<{ url: string; source: "model" | "stand-in" }> {
  try {
    const r = await fetch(info.file.usdz);
    if (!r.ok) throw new Error(`${info.file.usdz}: HTTP ${r.status}`);
    const bytes = await r.arrayBuffer();
    return { url: URL.createObjectURL(new Blob([bytes], { type: "model/vnd.usdz+zip" })), source: "model" };
  } catch (e) {
    console.warn(`figure ${info.id}: USDZ failed, exporting the stand-in`, e);
    return { url: await exportStandIn(info), source: "stand-in" };
  }
}

async function exportStandIn(info: FigureInfo): Promise<string> {
  const scene = new THREE.Scene();
  const fig = buildFigure(info.standIn);
  // Quick Look puts the model's +z toward the viewer; our figures face -z
  const turn = new THREE.Group();
  turn.rotation.y = Math.PI + (info.yawDeg * Math.PI) / 180;
  turn.add(fig);
  scene.add(turn);
  const bytes = await new USDZExporter().parseAsync(scene, {
    quickLookCompatible: true,
    includeAnchoringProperties: true,
    ar: { anchoring: { type: "plane" }, planeAnchoring: { alignment: "horizontal" } },
  });
  return URL.createObjectURL(new Blob([bytes], { type: "model/vnd.usdz+zip" }));
}

/** Open Quick Look at true scale. Must run inside a tap. */
export function openQuickLook(url: string): void {
  const a = document.createElement("a");
  a.rel = "ar";
  // Quick Look only follows an AR link that wraps an image
  a.appendChild(document.createElement("img"));
  a.href = `${url}#allowsContentScaling=0`;
  a.click();
}
