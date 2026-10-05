// Shared test fixtures: the real Falls Park package, read from disk.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { prepareTour } from "../src/core/tour.ts";
import type { Tour, TourMap } from "../src/core/types.ts";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const PKG = join(ROOT, "content", "falls-park");

export const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;

/** A fresh, prepared copy of the Falls Park package (tests mutate freely). */
export const fallsPark = (): { tour: Tour; map: TourMap } =>
  prepareTour(readJson<Tour>(join(PKG, "tour.json")), readJson<TourMap>(join(PKG, "map.json")));
