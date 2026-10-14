// The content schema: the JSON Schema (for non-TypeScript tools) and the
// player's own validator must agree, on the real package and on broken ones.

import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { FIGURES } from "../src/core/figures.ts";
import { validateTour } from "../src/core/tour.ts";
import { relocate } from "../src/core/relocate.ts";
import { syntheticWalk } from "../src/core/synthwalk.ts";
import { PKG, ROOT, fallsPark, readJson } from "./helpers.ts";

const ajv = new Ajv2020({ allErrors: true, strict: false });
(addFormats as unknown as (a: Ajv2020) => void)(ajv);
const tourSchema = ajv.compile(readJson(join(ROOT, "schemas", "ori.tour-1.schema.json")));
const traceSchema = ajv.compile(readJson(join(ROOT, "schemas", "ori.trace-1.schema.json")));

const raw = (): Record<string, unknown> & { stops: Record<string, unknown>[] } => readJson(join(PKG, "tour.json"));

test("the Falls Park package passes the JSON Schema and the player's validator", () => {
  const pkg = raw();
  assert.ok(tourSchema(pkg), JSON.stringify(tourSchema.errors));
  assert.deepEqual(validateTour(pkg), []);
});

test("a relocated test layout is still a valid package", () => {
  const { tour } = fallsPark();
  const moved = relocate(tour, { lat: 43.5446, lon: -96.7311 }, { facingDeg: 90 }).tour;
  assert.ok(tourSchema(moved), JSON.stringify(tourSchema.errors));
  assert.deepEqual(validateTour(moved), []);
});

const figureOf = (p: ReturnType<typeof raw>): Record<string, unknown> =>
  p.stops.find((s) => s.figure)!.figure as Record<string, unknown>;

const breakages: [string, (p: ReturnType<typeof raw>) => void][] = [
  ["wrong schema version", (p) => (p.schema = "ori.tour/2")],
  ["no stops", (p) => (p.stops = [])],
  ["stop without narration review status", (p) => delete (p.stops[0]?.narration as Record<string, unknown>).review],
  ["stop without sources list", (p) => delete p.stops[0]?.sources],
  ["negative radius", (p) => ((p.stops[0] as Record<string, unknown>).radius_m = -5)],
  ["facing with neither target nor bearing", (p) => delete (p.stops[0]?.facing as Record<string, unknown>).target],
  ["latitude out of range", (p) => ((p.stops[0] as Record<string, unknown>).position = { lat: 123, lon: 0 })],
  [
    "audio without captions",
    (p) => {
      const n = p.stops[0]?.narration as Record<string, unknown>;
      n.audio = "audio/x.m4a";
      delete n.cues;
    },
  ],
  ["safety rule missing", (p) => delete (p.safety as Record<string, unknown>).pictures_only_when_still],
  ["figure of an unknown model", (p) => ((figureOf(p).model as string) = "unicorn")],
  ["figure with no anchoring rule", (p) => delete figureOf(p).anchoring],
  ["figure with a negative offset", (p) => (figureOf(p).offset_m = -3)],
  ["figure without a note", (p) => delete figureOf(p).note],
];

for (const [name, breakIt] of breakages) {
  test(`both validators refuse: ${name}`, () => {
    const p = raw();
    breakIt(p);
    assert.equal(tourSchema(p), false, "JSON Schema accepted it");
    assert.notDeepEqual(validateTour(p), [], "player validator accepted it");
  });
}

test("the schema's figure models are exactly the player's figure list", () => {
  const schema = readJson<{ $defs: { figure: { properties: { model: { enum: string[] } } } } }>(
    join(ROOT, "schemas", "ori.tour-1.schema.json"),
  );
  assert.deepEqual([...schema.$defs.figure.properties.model.enum].sort(), FIGURES.map((f) => f.id).sort());
});

test("a synthetic walk is a valid ori.trace/1 file", () => {
  const { tour, map } = fallsPark();
  const { truth: _truth, ...trace } = syntheticWalk(tour, map);
  assert.ok(traceSchema(trace), JSON.stringify(traceSchema.errors?.slice(0, 3)));
});
