// The figure files: present, inside their download budgets, the format the
// phone loader expects, credited, and cached for the stops that use them.

import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { FIGURES, figureById } from "../src/core/figures.ts";
import { fallsPark, ROOT } from "./helpers.ts";

/** The JSON chunk of a glb. */
function glbJson(path: string): { extensionsUsed?: string[]; animations?: { name?: string }[] } {
  const b = readFileSync(path);
  assert.equal(b.toString("latin1", 0, 4), "glTF", `${path}: not a glb`);
  assert.equal(b.readUInt32LE(4), 2, `${path}: glTF 2`);
  const n = b.readUInt32LE(12);
  return JSON.parse(b.toString("utf8", 20, 20 + n)) as ReturnType<typeof glbJson>;
}

test("every figure's glb and USDZ exist and fit their download budgets", () => {
  for (const f of FIGURES) {
    for (const kind of ["glb", "usdz"] as const) {
      const p = join(ROOT, f.file[kind]);
      assert.ok(existsSync(p), `${f.id}: ${f.file[kind]} missing (USDZ: node tools/build_figures.mjs --usdz)`);
      const size = statSync(p).size;
      assert.ok(size <= f.budgetBytes[kind], `${f.id}: ${kind} is ${size} bytes, budget ${f.budgetBytes[kind]}`);
    }
  }
});

test("every glb is meshopt-compressed and has the idle clip the figure plays", () => {
  for (const f of FIGURES) {
    const j = glbJson(join(ROOT, f.file.glb));
    assert.ok(j.extensionsUsed?.includes("EXT_meshopt_compression"), `${f.id}: not meshopt-compressed`);
    if (f.file.idleClip)
      assert.ok(
        j.animations?.some((a) => a.name === f.file.idleClip),
        `${f.id}: no "${f.file.idleClip}" clip`,
      );
  }
});

test("every USDZ is a zip with a USD layer at its root (what Quick Look opens)", () => {
  for (const f of FIGURES) {
    const b = readFileSync(join(ROOT, f.file.usdz));
    assert.equal(b.readUInt32LE(0), 0x04034b50, `${f.id}: not a zip`);
    const name = b.toString("utf8", 30, 30 + b.readUInt16LE(26));
    assert.match(name, /\.usdc?a?$/, `${f.id}: first entry ${name} is not a USD layer`);
  }
});

test("every USDZ is laid out the way AR Quick Look reads it: stored, 64-byte aligned, PNG or JPEG only", () => {
  for (const f of FIGURES) {
    const b = readFileSync(join(ROOT, f.file.usdz));
    let at = 0;
    const names: string[] = [];
    while (b.readUInt32LE(at) === 0x04034b50) {
      const method = b.readUInt16LE(at + 8);
      const size = b.readUInt32LE(at + 18);
      const nameLen = b.readUInt16LE(at + 26);
      const extraLen = b.readUInt16LE(at + 28);
      const name = b.toString("utf8", at + 30, at + 30 + nameLen);
      const data = at + 30 + nameLen + extraLen;
      assert.equal(method, 0, `${f.id}: ${name} is compressed; USDZ entries must be stored`);
      assert.equal(data % 64, 0, `${f.id}: ${name} data is not 64-byte aligned`);
      names.push(name);
      at = data + size;
    }
    assert.ok(names.length > 0, `${f.id}: no entries`);
    for (const n of names.slice(1))
      assert.match(n, /\.(png|jpe?g|usdc?a?)$/i, `${f.id}: ${n}: Quick Look shows only PNG and JPEG textures`);
  }
});

test("ports name no figure: a figure's fallback shape is catalogue data", () => {
  for (const f of FIGURES) assert.ok(["mammoth", "settler"].includes(f.standIn), `${f.id}: standIn ${f.standIn}`);
  for (const file of [
    "src/web/figures3d.ts",
    "src/web/quicklook.ts",
    "src/web/ar.ts",
    "src/web/xr.ts",
    "src/web/launch.ts",
  ]) {
    const src = readFileSync(join(ROOT, file), "utf8");
    for (const f of FIGURES)
      assert.ok(!src.includes(`"${f.id}"`), `${file} names figure "${f.id}"; put it in the catalogue instead`);
  }
});

test("the iPhone launcher is configured, not hard-coded", () => {
  const c = JSON.parse(readFileSync(join(ROOT, "config/launch.json"), "utf8")) as Record<string, unknown>;
  assert.equal(c.schema, "ori.launch/1");
  assert.equal(typeof c.key, "string");
  assert.match(String(c.sdkUrl), /^https:\/\//);
  const src = readFileSync(join(ROOT, "src/web/launch.ts"), "utf8");
  assert.ok(
    !/https?:\/\/launchar/.test(src.replace(/^\s*\/\/.*$/gm, "")),
    "the SDK address belongs in config/launch.json",
  );
});

test("every figure is credited, with its licence and source, in CREDITS.md", () => {
  const credits = readFileSync(join(ROOT, "CREDITS.md"), "utf8");
  for (const f of FIGURES) {
    assert.match(f.licence, /^(CC0 1\.0|CC BY 4\.0)$/, `${f.id}: open licences only`);
    assert.ok(credits.includes(f.sourceUrl), `${f.id}: source ${f.sourceUrl} not in CREDITS.md`);
    const file = f.file.glb.split("/").pop()!;
    assert.ok(credits.includes(file), `${f.id}: ${file} not in CREDITS.md`);
  }
});

test("the models a tour uses are cached for offline play", () => {
  const listed = new Set((JSON.parse(readFileSync(join(ROOT, "offline.json"), "utf8")) as { files: string[] }).files);
  for (const s of fallsPark().tour.stops) {
    if (!s.figure) continue;
    const glb = figureById(s.figure.model)!.file.glb;
    assert.ok(listed.has(glb), `${s.id}: ${glb} not cached offline`);
  }
});
