// Shell fur: the figure's coat (FigureFur, src/core/figures.ts) drawn as
// `shells` copies of its mesh, each pushed a little further out along the
// skinned normal, keeping only the pixels where a strand passes through that
// layer. Strands thin towards the tip, so the coat reads as hair rather than
// a fuzzy hull. The copies share the model's geometry, skeleton and texture,
// so they move with its idle clip and add no download.
//
// Cost: one extra draw of the mesh per shell. URL switch ?fur=off.
import * as THREE from "three";
const FUR_ON = typeof location === "undefined" || new URLSearchParams(location.search).get("fur") !== "off";
const VERT_PARS = /* glsl */ `
attribute float furBare;
varying float vFurBare;
uniform float uFurShell;
uniform float uFurLen;
uniform vec3 uFurDown;
`;
// objectNormal is the skinned normal here; transformed the skinned position
const VERT_MAIN = /* glsl */ `
  vFurBare = furBare;
  transformed += normalize(objectNormal) * uFurShell * uFurLen;
  transformed += uFurDown * uFurLen * 0.8 * uFurShell * uFurShell;
`;
const FRAG_PARS = /* glsl */ `
varying float vFurBare;
uniform float uFurShell;
uniform float uFurStrands;
uniform vec3 uFurRoot;
uniform vec3 uFurTip;
float furHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
`;
// after <map_fragment>: diffuseColor holds the texture colour
const FRAG_MAIN = /* glsl */ `
  {
    if (vFurBare > 0.5) discard;
    // the model's painted hair and baked shading, kept as light and dark in the coat
    float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
    float shade = clamp(lum / 0.06, 0.35, 1.8);
    // strands lean together in clumps, more towards the tip
    vec2 clump = floor(vFurUv * 70.0);
    vec2 lean = vec2(furHash(clump + 3.0), furHash(clump + 9.0)) - 0.5;
    vec2 g = (vFurUv + lean * uFurShell * (2.5 / uFurStrands)) * uFurStrands;
    vec2 cell = floor(g);
    vec2 f = fract(g) - 0.5;
    float h = furHash(cell);
    vec2 c = vec2(furHash(cell + 17.0), furHash(cell + 41.0)) - 0.5;
    float d = length(f - c * 0.5);
    float len = 0.4 + 0.6 * h * h;             // most strands short, a few long
    if (uFurShell > len) discard;
    float r = 0.5 * (1.0 - uFurShell / len);   // thinning to the tip
    if (d > r) discard;
    float t = uFurShell / len;
    vec3 coat = mix(uFurRoot, uFurTip, t);
    diffuseColor.rgb = coat * shade * (0.8 + 0.4 * h) * (0.55 + 0.45 * uFurShell);
  }
`;
/** sRGB byte to linear, as the shader sees the texture. */
const linear = (b) => {
    const c = b / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
/**
 * Mark the parts that stay bare: each connected piece of the mesh whose
 * texture is, on average, brighter than `bareAbove` (the tusks are separate
 * pieces and the lightest) or darker than `bareBelow` (the eyes). Per piece, not per pixel, so dark stains on a
 * tusk do not sprout hair. Written as the `furBare` vertex attribute (0|1).
 */
function markBare(geometry, map, bareAbove, bareBelow) {
    if (geometry.getAttribute("furBare"))
        return;
    const uv = geometry.getAttribute("uv");
    const n = geometry.getAttribute("position").count;
    const bare = new Float32Array(n);
    const img = map.image;
    const S = 256;
    let px = null;
    try {
        const c = document.createElement("canvas");
        c.width = c.height = S;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, S, S);
        px = ctx.getImageData(0, 0, S, S).data;
    }
    catch {
        px = null; // no pixels (an old browser): grow everywhere rather than fail
    }
    if (px && uv) {
        const parent = new Int32Array(n).map((_, i) => i);
        const find = (i) => {
            while (parent[i] !== i)
                i = parent[i] = parent[parent[i]];
            return i;
        };
        const join = (a, b) => {
            parent[find(a)] = find(b);
        };
        const index = geometry.getIndex();
        if (index)
            for (let t = 0; t < index.count; t += 3) {
                join(index.getX(t), index.getX(t + 1));
                join(index.getX(t), index.getX(t + 2));
            }
        const sum = new Float64Array(n);
        const count = new Uint32Array(n);
        for (let i = 0; i < n; i++) {
            const u = uv.getX(i) - Math.floor(uv.getX(i));
            const v = uv.getY(i) - Math.floor(uv.getY(i)); // glTF: v runs down the image, as the canvas does
            const k = (Math.min(S - 1, Math.floor(v * S)) * S + Math.min(S - 1, Math.floor(u * S))) * 4;
            const l = 0.299 * linear(px[k]) + 0.587 * linear(px[k + 1]) + 0.114 * linear(px[k + 2]);
            const r = find(i);
            sum[r] += l;
            count[r] += 1;
        }
        for (let i = 0; i < n; i++) {
            const r = find(i);
            const mean = sum[r] / count[r];
            bare[i] = mean > bareAbove || mean < bareBelow ? 1 : 0;
        }
    }
    geometry.setAttribute("furBare", new THREE.BufferAttribute(bare, 1));
}
/** Darken and tint the bare mesh under the coat to the root colour, so gaps between strands read as dense fur. */
function rootTint(m, fur) {
    const root = new THREE.Color(fur.rootColor);
    m.onBeforeCompile = (shader) => {
        shader.uniforms.uFurRoot = { value: root };
        shader.vertexShader = shader.vertexShader.replace("void main() {", "attribute float furBare;\nvarying float vFurBare;\nvoid main() {\n  vFurBare = furBare;");
        shader.fragmentShader = shader.fragmentShader
            .replace("void main() {", "uniform vec3 uFurRoot;\nvarying float vFurBare;\nvoid main() {")
            .replace("#include <map_fragment>", `#include <map_fragment>
  {
    float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
    if (vFurBare < 0.5) diffuseColor.rgb = uFurRoot * clamp(lum / 0.06, 0.35, 1.8);
  }`);
    };
    m.customProgramCacheKey = () => "ori-fur-root";
    m.needsUpdate = true;
}
function shellMaterial(base, fur, shell, lenLocal, down) {
    const m = new THREE.MeshStandardMaterial({ map: base.map, roughness: 1, metalness: 0 });
    const uniforms = {
        uFurShell: { value: shell },
        uFurLen: { value: lenLocal },
        uFurDown: { value: down },
        uFurStrands: { value: fur.strands },
        uFurRoot: { value: new THREE.Color(fur.rootColor) },
        uFurTip: { value: new THREE.Color(fur.tipColor) },
    };
    m.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace("void main() {", `${VERT_PARS}\nvarying vec2 vFurUv;\nvoid main() {\n  vFurUv = uv;`)
            .replace("#include <skinning_vertex>", `#include <skinning_vertex>\n${VERT_MAIN}`);
        shader.fragmentShader = shader.fragmentShader
            .replace("void main() {", `${FRAG_PARS}\nvarying vec2 vFurUv;\nvoid main() {`)
            .replace("#include <map_fragment>", `#include <map_fragment>\n${FRAG_MAIN}`);
    };
    m.customProgramCacheKey = () => "ori-fur-shell";
    return m;
}
/**
 * Grow `fur` on every textured mesh under `root`. Call after the figure is
 * fitted to its size (fitToSize), so lengths come out in metres.
 */
export function growFur(root, fur) {
    if (!FUR_ON)
        return;
    root.updateMatrixWorld(true);
    const meshes = [];
    root.traverse((o) => {
        if (!(o instanceof THREE.Mesh))
            return;
        const mesh = o;
        if (mesh.material instanceof THREE.MeshStandardMaterial && mesh.material.map)
            meshes.push(mesh);
    });
    const ws = new THREE.Vector3();
    const inv = new THREE.Matrix4();
    for (const mesh of meshes) {
        const base = mesh.material;
        mesh.getWorldScale(ws);
        const lenLocal = fur.lengthM / ((ws.x + ws.y + ws.z) / 3);
        // the world's down, in the mesh's own space (a figure stays upright, so once is enough)
        inv.copy(mesh.matrixWorld).invert();
        const down = new THREE.Vector3(0, -1, 0).transformDirection(inv);
        markBare(mesh.geometry, base.map, fur.bareAbove, fur.bareBelow);
        rootTint(base, fur);
        for (let i = 1; i <= fur.shells; i++) {
            const shell = shellMaterial(base, fur, i / fur.shells, lenLocal, down);
            const copy = mesh instanceof THREE.SkinnedMesh
                ? new THREE.SkinnedMesh(mesh.geometry, shell)
                : new THREE.Mesh(mesh.geometry, shell);
            if (copy instanceof THREE.SkinnedMesh && mesh instanceof THREE.SkinnedMesh)
                copy.bind(mesh.skeleton, mesh.bindMatrix);
            copy.castShadow = false;
            copy.receiveShadow = false;
            copy.frustumCulled = mesh.frustumCulled;
            copy.name = `${mesh.name} fur ${i}`;
            copy.userData.fur = true;
            mesh.add(copy);
        }
    }
}
