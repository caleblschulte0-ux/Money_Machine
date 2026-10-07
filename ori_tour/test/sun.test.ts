import assert from "node:assert/strict";
import { test } from "node:test";

import { sunDirection, sunPosition } from "../src/core/sun.ts";

const SIOUX_FALLS = { lat: 43.5446, lon: -96.7311 };

test("at the March equinox, solar noon on the equator puts the sun overhead", () => {
  // 2026-03-20 12:07 UTC is solar noon at longitude 0 (equation of time about -7 min)
  const s = sunPosition(Date.UTC(2026, 2, 20, 12, 7), { lat: 0, lon: 0 });
  assert.ok(s.elevationDeg > 89, `elevation ${s.elevationDeg}`);
});

test("midsummer at Falls Park: the sun peaks near 70 degrees, due south, and sets in the northwest", () => {
  let best = { t: 0, el: -90, az: 0 };
  const day = Date.UTC(2026, 5, 21);
  for (let m = 0; m < 24 * 60; m++) {
    const s = sunPosition(day + m * 60_000, SIOUX_FALLS);
    if (s.elevationDeg > best.el) best = { t: m, el: s.elevationDeg, az: s.azimuthDeg };
  }
  // 90 - latitude + the solstice declination (23.44)
  assert.ok(Math.abs(best.el - (90 - 43.5446 + 23.44)) < 0.3, `peak ${best.el}`);
  assert.ok(Math.abs(best.az - 180) < 2, `azimuth at the peak ${best.az}`);
  // solar noon is about 18:29 UTC (12 + 96.73/15 hours, plus the equation of time)
  assert.ok(Math.abs(best.t - (18 * 60 + 29)) <= 3, `solar noon at minute ${best.t}`);
  const evening = sunPosition(day + (2 * 60 + 30) * 60_000, SIOUX_FALLS); // 21:30 CDT
  assert.ok(evening.elevationDeg < 5 && evening.azimuthDeg > 290 && evening.azimuthDeg < 310, JSON.stringify(evening));
});

test("winter noon at Falls Park: low in the south", () => {
  const s = sunPosition(Date.UTC(2026, 11, 21, 18, 22), SIOUX_FALLS);
  assert.ok(Math.abs(s.elevationDeg - (90 - 43.5446 - 23.44)) < 0.5, `elevation ${s.elevationDeg}`);
});

test("the direction in tracking space follows north", () => {
  // north is straight ahead (-z) when northYaw = 0: a sun due south and level points to +z
  const d = sunDirection({ azimuthDeg: 180, elevationDeg: 0 }, 0);
  assert.ok(Math.abs(d.z - 1) < 1e-9 && Math.abs(d.x) < 1e-9 && Math.abs(d.y) < 1e-9);
  // due east is to the right (+x)
  const e = sunDirection({ azimuthDeg: 90, elevationDeg: 0 }, 0);
  assert.ok(Math.abs(e.x - 1) < 1e-9, JSON.stringify(e));
  // overhead is up whatever north is
  assert.ok(Math.abs(sunDirection({ azimuthDeg: 37, elevationDeg: 90 }, 1.2).y - 1) < 1e-9);
});
