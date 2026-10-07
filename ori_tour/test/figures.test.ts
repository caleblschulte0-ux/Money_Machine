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
