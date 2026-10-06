// Bundle the parts of three.js the figure page uses into ONE minified file,
// vendor/three.js, served next to the app (no CDN: the tour must work offline
// and from any static host). ar.html maps "three" to it with an import map.
//
//   node tools/vendor_three.mjs      (npm run build runs it)
import { build } from "esbuild";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(readFileSync(join(root, "node_modules/three/package.json"), "utf8")).version;
mkdirSync(join(root, "vendor"), { recursive: true });
await build({
  stdin: {
    contents: ['export * from "three";', 'export { USDZExporter } from "three/addons/exporters/USDZExporter.js";'].join(
      "\n",
    ),
    resolveDir: root,
  },
  bundle: true,
  format: "esm",
  minify: true,
  target: "es2022",
  legalComments: "none",
  banner: { js: `/* three.js ${version}, MIT licence (vendor/three.LICENSE). Built by tools/vendor_three.mjs. */` },
  outfile: join(root, "vendor/three.js"),
  logLevel: "warning",
});
copyFileSync(join(root, "node_modules/three/LICENSE"), join(root, "vendor/three.LICENSE"));
console.log(`vendor/three.js: three ${version}`);
