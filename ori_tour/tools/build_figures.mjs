// Figures, built and measured in a real browser (headless Chromium):
//
//   node tools/build_figures.mjs --usdz            write assets/figures/<id>.usdz from each glb with
//                                                  Blender (tools/usdz_blender.py, `pip install bpy`
//                                                  for Python 3.11; $BLENDER_PYTHON overrides
//                                                  python3.11): binary USD, the full mesh and
//                                                  textures, and the idle clip, which Quick Look
//                                                  plays. Needs no browser.
//   node tools/build_figures.mjs --views <dir>     PNG views of each figure as the phone draws it
//                                                  (front, side, top), to check which way it faces
//   node tools/build_figures.mjs --measure         load time of each figure on a slow phone
//                                                  connection (1.6 Mbit/s, 150 ms round trip)
//
// --views and --measure serve this folder, open a page that imports the BUILT app (dist/ and
// vendor/, so run `npm run build` first) and uses the same loadFigure() the
// phone uses: what is exported and measured is what a visitor gets.
// Chromium: $CHROMIUM, else /opt/pw-browsers/chromium (cloud sessions), else Playwright's own.
import { spawnSync } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createServer } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dequantize } from "@gltf-transform/functions";
import { MeshoptDecoder } from "meshoptimizer";
import { chromium } from "playwright-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const want = (flag) => args.includes(flag);
const valueOf = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : null);
if (!want("--usdz") && !want("--views") && !want("--measure")) {
  console.error("usage: node tools/build_figures.mjs [--usdz] [--views <dir>] [--measure]");
  process.exit(2);
}

const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
  ".usdz": "model/vnd.usdz+zip",
};
const PAGE = `<!doctype html><meta charset="utf-8"><canvas id="c" width="640" height="640"></canvas>
<script type="importmap">{"imports":{
  "three":"./vendor/three.js",
  "three/addons/loaders/GLTFLoader.js":"./vendor/three.js",
  "three/addons/libs/meshopt_decoder.module.js":"./vendor/three.js"}}</script>
<script type="module">
  import * as THREE from "three";
  import { FIGURES } from "./dist/core/figures.js";
  import { loadFigure } from "./dist/web/figures3d.js";
  const byId = (id) => FIGURES.find((f) => f.id === id);
  window.figureIds = FIGURES.map((f) => f.id);
  window.glbOf = (id) => byId(id).file.glb;

  window.timeLoad = async (id) => {
    const t0 = performance.now();
    const f = await loadFigure(byId(id), 1);
    return { ms: Math.round(performance.now() - t0), source: f.source };
  };

  window.views = async (id) => {
    const info = byId(id);
    const { node, source } = await loadFigure(info, 1);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x30343a);
    scene.add(new THREE.HemisphereLight(0xfff4e0, 0x3a3328, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(4, 8, 3);
    scene.add(sun);
    scene.add(node);
    // an arrow on the ground pointing -z: the direction the figure must face
    const arrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0.02, 0), info.heightM, 0xff3030);
    scene.add(arrow);
    const r = new THREE.WebGLRenderer({ canvas: document.getElementById("c"), preserveDrawingBuffer: true });
    const reach = Math.max(info.heightM, info.footprintM * 2) * 2.4;
    const cam = new THREE.PerspectiveCamera(40, 1, 0.05, 100);
    const shots = {};
    const shoot = (name, pos) => {
      cam.position.set(...pos);
      cam.lookAt(0, info.heightM * 0.45, 0);
      r.render(scene, cam);
      shots[name] = r.domElement.toDataURL("image/png");
    };
    shoot("front", [0, info.heightM * 0.6, -reach]); // standing where the figure looks
    shoot("side", [reach, info.heightM * 0.6, 0]);
    cam.up.set(0, 0, -1);
    shoot("top", [0, reach * 1.2, 0.001]);
    return { shots, source };
  };

  window.ready = true;
</script>`;

/** Write each figure's USDZ with Blender, from a plain (meshopt-decoded, dequantized) copy of its glb. */
async function writeUsdz() {
  const { FIGURES } = await import("../dist/core/figures.js");
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
  const tmp = mkdtempSync(join(tmpdir(), "ori-usdz-"));
  const py = process.env.BLENDER_PYTHON ?? "python3.11";
  try {
    for (const f of FIGURES) {
      const doc = await io.read(join(root, f.file.glb));
      await doc.transform(dequantize());
      for (const e of doc.getRoot().listExtensionsUsed())
        if (["EXT_meshopt_compression", "KHR_mesh_quantization"].includes(e.extensionName)) e.dispose();
      const plain = join(tmp, `${f.id}.glb`);
      await io.write(plain, doc);
      // Quick Look shows the model's +z to the viewer; the glb faces frontYawDeg, the figure turns by yawDeg
      const yaw = (((f.file.frontYawDeg + 180 + f.yawDeg) % 360) + 360) % 360;
      const out = join(root, f.file.usdz);
      const run = spawnSync(
        py,
        [join(root, "tools/usdz_blender.py"), plain, out, "--height", String(f.heightM), "--yaw", String(yaw),
          ...(f.file.idleClip ? ["--clip", f.file.idleClip] : [])],
        { encoding: "utf8" },
      );
      if (run.status !== 0) throw new Error(`${f.id}: Blender failed\n${run.stderr || run.stdout}`);
      const size = run.stdout.split("\n").find((l) => l.startsWith("size")) ?? "";
      console.log(`${f.id}: ${f.file.usdz} ${statSync(out).size} bytes, ${size}`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (want("--usdz")) await writeUsdz();
if (!want("--views") && !want("--measure")) process.exit(0);

const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (path === "/__figures.html") {
    res.writeHead(200, { "content-type": "text/html" });
    return res.end(PAGE);
  }
  const file = normalize(join(root, path));
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/__figures.html`;

const exe = process.env.CHROMIUM ?? (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const browser = await chromium.launch({
  executablePath: exe,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

async function openPage(throttle) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error("page error:", e.message));
  if (throttle) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    });
  }
  await page.goto(url);
  await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
  return { ctx, page };
}

try {
  const { ctx, page } = await openPage(false);
  const ids = await page.evaluate(() => window.figureIds);

  if (want("--views")) {
    const dir = valueOf("--views");
    mkdirSync(dir, { recursive: true });
    for (const id of ids) {
      const { shots, source } = await page.evaluate((i) => window.views(i), id);
      for (const [name, data] of Object.entries(shots))
        writeFileSync(join(dir, `${id}-${name}.png`), Buffer.from(data.split(",")[1], "base64"));
      console.log(`${id}: views written (${source})`);
    }
  }

  await ctx.close();

  if (want("--measure")) {
    console.log("load on a slow phone connection (1.6 Mbit/s down, 150 ms RTT, no cache), fetch + decode + fit:");
    for (const id of ids) {
      const { ctx: c, page: p } = await openPage(true);
      const r = await p.evaluate((i) => window.timeLoad(i), id);
      console.log(`  ${id.padEnd(13)} ${(r.ms / 1000).toFixed(1)} s (${r.source})`);
      await c.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
