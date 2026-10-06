// The iPhone route to a world-locked figure. Safari on iPhone has no WebXR
// augmented reality, but it has AR Quick Look: hand it a USDZ model and iOS
// opens its own AR view (ARKit), where the visitor places the figure on the
// ground and it stays there as they walk around it.
//
// What that costs: Quick Look is Apple's viewer, not ours. Inside it the tour
// cannot run (no prompts, captions, narration triggers or readout), and the
// figure is placed by the visitor, not at a stop. It proves the anchoring on
// an iPhone today; a tour that runs on iPhones with figures needs a native
// app (ARKit) or an App Clip, which needs a Mac and an Apple developer account.
import * as THREE from "three";
import { USDZExporter } from "three/addons/exporters/USDZExporter.js";
import { buildFigure } from "./figures3d.js";
/** True on browsers that open AR Quick Look links (Safari and other browsers on iPhone and iPad). */
export function quickLookAvailable() {
    const a = document.createElement("a");
    return a.relList.supports("ar");
}
/** Export a figure to USDZ in the page (no server, so no file type to get wrong), as a blob URL. */
export async function usdzFor(spec) {
    const scene = new THREE.Scene();
    const fig = buildFigure(spec.id);
    // Quick Look puts the model's +z toward the viewer; our figures face -z
    const turn = new THREE.Group();
    turn.rotation.y = Math.PI + (spec.yawDeg * Math.PI) / 180;
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
export function openQuickLook(url) {
    const a = document.createElement("a");
    a.rel = "ar";
    // Quick Look only follows an AR link that wraps an image
    a.appendChild(document.createElement("img"));
    a.href = `${url}#allowsContentScaling=0`;
    a.click();
}
