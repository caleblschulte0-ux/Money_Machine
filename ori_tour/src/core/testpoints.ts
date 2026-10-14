// Test points: a tester's own figure sites, saved on the device. Stand
// somewhere (a parking lot, the falls), put a figure down, and "Set test
// point here" remembers where you stood and where the figure stood relative
// to you. Walk away, come back, and TourFigures puts it there again on its
// own, through the same code a tour stop uses. They live in Storage, survive
// reloads, and never touch the tour package.

import { figureById } from "./figures.ts";
import type { Storage } from "./ports.ts";
import { isLatLon, validateFigure } from "./tour.ts";
import type { FigureSite } from "./tourfigures.ts";
import type { LatLon, StopFigure } from "./types.ts";

export const TEST_POINTS_SCHEMA = "ori.testpoints/1";

export interface TestPoint extends FigureSite {
  /** When it was saved, ms since 1970 (from the device's Clock). */
  savedAt: number;
}

export interface NewTestPoint {
  /** Where the tester stood. */
  position: LatLon;
  /** The figure, relative to that spot. */
  figure: Pick<StopFigure, "model" | "scale" | "offset_m" | "bearing_deg" | "yaw_deg">;
  /** Which way the tester faced, degrees (used when the figure has no bearing). */
  facingDeg: number;
  /** Geofence radius, metres. Default 8 (two GPS errors). */
  radius_m?: number;
  savedAt: number;
}

/** Problems with a stored test point, or none. */
export function validateTestPoint(raw: unknown, at = "test point"): string[] {
  if (typeof raw !== "object" || raw === null) return [`${at}: not an object`];
  const p = raw as Record<string, unknown>;
  const errs: string[] = [];
  if (typeof p.id !== "string" || !p.id) errs.push(`${at}: id missing`);
  if (typeof p.name !== "string" || !p.name) errs.push(`${at}: name missing`);
  if (!isLatLon(p.position)) errs.push(`${at}: position invalid`);
  if (typeof p.radius_m !== "number" || !(p.radius_m > 0 && p.radius_m <= 100)) errs.push(`${at}: radius_m invalid`);
  if (typeof p.facingDeg !== "number" || !Number.isFinite(p.facingDeg)) errs.push(`${at}: facingDeg invalid`);
  if (typeof p.savedAt !== "number") errs.push(`${at}: savedAt invalid`);
  errs.push(...validateFigure(p.figure, at));
  return errs;
}

export class TestPoints {
  private readonly storage: Storage;
  private readonly key: string;
  private points: TestPoint[];
  /** Problems found when loading (bad entries are dropped, not fatal). */
  readonly loadProblems: string[] = [];

  constructor(storage: Storage, key = "ori-test-points") {
    this.storage = storage;
    this.key = key;
    this.points = this.load();
  }

  list(): readonly TestPoint[] {
    return this.points;
  }

  /** The points as figure sites, for TourFigures. */
  sites(): FigureSite[] {
    return [...this.points];
  }

  add(p: NewTestPoint): TestPoint {
    const n = this.points.reduce((m, x) => Math.max(m, Number(/^test-(\d+)$/.exec(x.id)?.[1] ?? 0)), 0) + 1;
    const name = figureById(p.figure.model)?.name ?? p.figure.model;
    const point: TestPoint = {
      id: `test-${n}`,
      name: `Test point ${n} (${name})`,
      position: { lat: p.position.lat, lon: p.position.lon },
      radius_m: p.radius_m ?? 8,
      facingDeg: p.facingDeg,
      savedAt: p.savedAt,
      figure: {
        ...p.figure,
        bearing_deg: p.figure.bearing_deg ?? null,
        anchoring: "auto",
        note: "Saved on this phone as a test point; not part of any tour.",
      },
    };
    const errs = validateTestPoint(point);
    if (errs.length) throw new Error(errs.join("; "));
    this.points = [...this.points, point];
    this.save();
    return point;
  }

  remove(id: string): void {
    this.points = this.points.filter((p) => p.id !== id);
    this.save();
  }

  clear(): void {
    this.points = [];
    this.storage.remove(this.key);
  }

  private save(): void {
    this.storage.set(this.key, JSON.stringify({ schema: TEST_POINTS_SCHEMA, points: this.points }));
  }

  private load(): TestPoint[] {
    const raw = this.storage.get(this.key);
    if (!raw) return [];
    let doc: unknown;
    try {
      doc = JSON.parse(raw);
    } catch {
      this.loadProblems.push("stored test points are not JSON; ignored");
      return [];
    }
    const d = doc as { schema?: unknown; points?: unknown };
    if (d?.schema !== TEST_POINTS_SCHEMA || !Array.isArray(d.points)) {
      this.loadProblems.push(`stored test points are not ${TEST_POINTS_SCHEMA}; ignored`);
      return [];
    }
    const out: TestPoint[] = [];
    d.points.forEach((p: unknown, i: number) => {
      const errs = validateTestPoint(p, `test point ${i + 1}`);
      if (errs.length) this.loadProblems.push(...errs);
      else out.push(p as TestPoint);
    });
    return out;
  }
}
